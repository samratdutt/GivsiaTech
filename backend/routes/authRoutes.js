import express from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import Otp from "../models/Otp.js";
import PasswordReset from "../models/PasswordReset.js";
import { protect } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { sendSms, isSmsConfigured } from "../utils/sendSms.js";
import { sendEmail } from "../utils/sendEmail.js";
import { authLimiter, otpLimiter, passwordResetLimiter } from "../middleware/rateLimit.js";
import { isLocked, recordFailedLogin, recordSuccessfulLogin, logSecurityEvent } from "../utils/security.js";
import { timingSafeEqual } from "../utils/safeCompare.js";

const router = express.Router();
const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

const OTP_TTL_MS = 5 * 60 * 1000; // code must be verified within 5 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const VERIFIED_WINDOW_MS = 15 * 60 * 1000; // once verified, register has 15 minutes to complete
const MAX_OTP_ATTEMPTS = 5;

// tokenVersion is embedded so logout/password-change can invalidate a token
// server-side (see middleware/auth.js) instead of only forgetting it
// client-side — a stolen token would otherwise stay valid for the full
// JWT_EXPIRES_IN window regardless of what the real user does afterward.
const signToken = (id, tokenVersion) =>
  jwt.sign({ id, tokenVersion: tokenVersion || 0 }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

// Accepts "+<countrycode><number>" as-is; a bare 10-digit local number is
// assumed to be Indian (this app's market) and gets +91 prepended.
const normalizePhone = (raw) => {
  if (!raw) return null;
  const trimmed = raw.replace(/[\s-]/g, "");
  if (/^\+\d{8,15}$/.test(trimmed)) return trimmed;
  if (/^\d{10}$/.test(trimmed)) return `+91${trimmed}`;
  return null;
};

const hashOtp = (code) => crypto.createHash("sha256").update(code).digest("hex");

const generateOtp = () => String(crypto.randomInt(100000, 1000000));

// Same sha256-of-the-raw-value approach as hashOtp above, applied to a
// much longer random token — only the hash is ever persisted (see
// PasswordReset.tokenHash), so a database leak alone can't be replayed
// as a valid reset link.
const hashResetToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // reset link is valid for 30 minutes

// Verifies a Google ID token against our own OAuth client ID (the
// "audience") so a token minted for some other app can't be replayed here.
const verifyGoogleToken = async (idToken) => {
  if (!googleClient) {
    const err = new Error("Google sign-in is not configured on the server");
    err.status = 503;
    throw err;
  }
  if (!idToken) {
    const err = new Error("Google credential is required");
    err.status = 400;
    throw err;
  }
  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
    return ticket.getPayload();
  } catch {
    const err = new Error("Invalid or expired Google credential");
    err.status = 401;
    throw err;
  }
};

// @route   POST /api/auth/send-otp
// @desc    Sends a 6-digit code to a phone number for registration.
router.post("/send-otp", otpLimiter, asyncHandler(async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  if (!phone) {
    return res.status(400).json({ message: "A valid phone number is required" });
  }

  const existingUser = await User.findOne({ phone });
  if (existingUser) {
    return res.status(409).json({ message: "An account with this phone number already exists" });
  }

  const recent = await Otp.findOne({ phone, purpose: "register" }).sort({ _id: -1 });
  if (recent && Date.now() - recent._id.getTimestamp().getTime() < OTP_RESEND_COOLDOWN_MS) {
    return res.status(429).json({ message: "Please wait a minute before requesting another code" });
  }

  const code = generateOtp();
  await Otp.findOneAndDelete({ phone, purpose: "register" });
  await Otp.create({
    phone,
    purpose: "register",
    codeHash: hashOtp(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  // Twilio SMS if configured, otherwise a dev fallback that hands the code
  // straight back instead of it disappearing into a server log only.
  let channel = "dev";
  let delivered = false;
  let lastError = null;
  if (isSmsConfigured()) {
    const result = await sendSms({ to: phone, body: `Your GivsiaTech verification code is ${code}. It expires in 5 minutes.` });
    delivered = result.delivered;
    if (delivered) channel = "sms";
    else if (result.attempted) lastError = `SMS: ${result.error}`;
  }

  const payload = { message: "Verification code sent", channel };
  if (!delivered) {
    payload.devCode = code;
    payload.message = lastError
      ? `Delivery failed (${lastError}) — using dev fallback code`
      : "No SMS provider configured — using dev fallback code";
  }
  res.json(payload);
}));

// @route   POST /api/auth/verify-otp
// @desc    Verifies a code sent via /send-otp. On success the phone is
//          marked verified for VERIFIED_WINDOW_MS so /register can complete.
router.post("/verify-otp", otpLimiter, asyncHandler(async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const { code } = req.body;
  if (!phone || !code) {
    return res.status(400).json({ message: "Phone and code are required" });
  }

  const otp = await Otp.findOne({ phone, purpose: "register" });
  if (!otp || otp.expiresAt < new Date()) {
    return res.status(400).json({ message: "Code expired or not found — request a new one" });
  }
  if (otp.attempts >= MAX_OTP_ATTEMPTS) {
    return res.status(429).json({ message: "Too many incorrect attempts — request a new code" });
  }

  if (!timingSafeEqual(otp.codeHash, hashOtp(code))) {
    otp.attempts += 1;
    await otp.save();
    return res.status(400).json({ message: "Incorrect code" });
  }

  otp.verified = true;
  otp.expiresAt = new Date(Date.now() + VERIFIED_WINDOW_MS);
  await otp.save();

  res.json({ verified: true });
}));

// @route   POST /api/auth/register
// @desc    Register a new user. Role defaults to "client" - extra admin
//          accounts should be created by an existing admin via /api/users.
router.post("/register", authLimiter, async (req, res) => {
  try {
    const { name, email, password, confirmPassword, company, address } = req.body;
    const phone = normalizePhone(req.body.phone);

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }
    if (!phone) {
      return res.status(400).json({ message: "A valid phone number is required" });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Password and confirm password do not match" });
    }

    const verifiedOtp = await Otp.findOne({ phone, purpose: "register", verified: true, expiresAt: { $gt: new Date() } });
    if (!verifiedOtp) {
      return res.status(400).json({ message: "Please verify your phone number before registering" });
    }

    const [existingEmail, existingPhone] = await Promise.all([
      User.findOne({ email: email.toLowerCase() }),
      User.findOne({ phone }),
    ]);
    if (existingEmail) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }
    if (existingPhone) {
      return res.status(409).json({ message: "An account with this phone number already exists" });
    }

    const user = await User.create({ name, email, password, phone, phoneVerified: true, address, company, role: "client" });
    await verifiedOtp.deleteOne();

    res.status(201).json({
      token: signToken(user._id, user.tokenVersion),
      user: user.toSafeObject(),
    });
  } catch (err) {
    res.status(500).json({ message: "Registration failed", error: err.message });
  }
});

// @route   POST /api/auth/register-admin
// @desc    Register a new ADMIN account. Requires ADMIN_INVITE_CODE from
//          the server's .env to match — this is the "visible", supported
//          way to create admins instead of editing MongoDB by hand.
//          Rotate/remove ADMIN_INVITE_CODE from .env once your admins are set up.
router.post("/register-admin", authLimiter, async (req, res) => {
  try {
    const { name, email, password, confirmPassword, inviteCode, address } = req.body;
    const phone = normalizePhone(req.body.phone);

    if (!name || !email || !password || !inviteCode) {
      return res.status(400).json({ message: "Name, email, password and invite code are required" });
    }
    if (!phone) {
      return res.status(400).json({ message: "A valid phone number is required" });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Password and confirm password do not match" });
    }

    if (!process.env.ADMIN_INVITE_CODE) {
      return res.status(503).json({ message: "Admin registration is disabled — ADMIN_INVITE_CODE is not set on the server" });
    }

    if (!timingSafeEqual(inviteCode, process.env.ADMIN_INVITE_CODE)) {
      return res.status(403).json({ message: "Invalid admin invite code" });
    }

    const verifiedOtp = await Otp.findOne({ phone, purpose: "register", verified: true, expiresAt: { $gt: new Date() } });
    if (!verifiedOtp) {
      return res.status(400).json({ message: "Please verify your phone number before registering" });
    }

    const [existingEmail, existingPhone] = await Promise.all([
      User.findOne({ email: email.toLowerCase() }),
      User.findOne({ phone }),
    ]);
    if (existingEmail) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }
    if (existingPhone) {
      return res.status(409).json({ message: "An account with this phone number already exists" });
    }

    const user = await User.create({ name, email, password, phone, phoneVerified: true, address, role: "admin" });
    await verifiedOtp.deleteOne();

    res.status(201).json({
      token: signToken(user._id, user.tokenVersion),
      user: user.toSafeObject(),
    });
  } catch (err) {
    res.status(500).json({ message: "Admin registration failed", error: err.message });
  }
});

// @route   POST /api/auth/register-service
// @desc    Register a new SERVICE account (cold-outreach panel). Requires
//          SERVICE_INVITE_CODE from the server's .env to match — same
//          pattern as /register-admin. Rotate/remove SERVICE_INVITE_CODE
//          from .env once your service team is set up.
router.post("/register-service", authLimiter, async (req, res) => {
  try {
    const { name, email, password, confirmPassword, inviteCode, address } = req.body;
    const phone = normalizePhone(req.body.phone);

    if (!name || !email || !password || !inviteCode) {
      return res.status(400).json({ message: "Name, email, password and invite code are required" });
    }
    if (!phone) {
      return res.status(400).json({ message: "A valid phone number is required" });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Password and confirm password do not match" });
    }

    if (!process.env.SERVICE_INVITE_CODE) {
      return res.status(503).json({ message: "Service registration is disabled — SERVICE_INVITE_CODE is not set on the server" });
    }

    if (!timingSafeEqual(inviteCode, process.env.SERVICE_INVITE_CODE)) {
      return res.status(403).json({ message: "Invalid service invite code" });
    }

    const verifiedOtp = await Otp.findOne({ phone, purpose: "register", verified: true, expiresAt: { $gt: new Date() } });
    if (!verifiedOtp) {
      return res.status(400).json({ message: "Please verify your phone number before registering" });
    }

    const [existingEmail, existingPhone] = await Promise.all([
      User.findOne({ email: email.toLowerCase() }),
      User.findOne({ phone }),
    ]);
    if (existingEmail) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }
    if (existingPhone) {
      return res.status(409).json({ message: "An account with this phone number already exists" });
    }

    const user = await User.create({ name, email, password, phone, phoneVerified: true, address, role: "service" });
    await verifiedOtp.deleteOne();

    res.status(201).json({
      token: signToken(user._id, user.tokenVersion),
      user: user.toSafeObject(),
    });
  } catch (err) {
    res.status(500).json({ message: "Service registration failed", error: err.message });
  }
});

// @route   POST /api/auth/google-login
// @desc    Sign in with an existing account via a Google ID token. Auto-links
//          the Google identity to a matching-email account on first use
//          (safe because Google has already verified that email itself).
//          Returns 404 if no account exists yet — the frontend then sends
//          the user through /google-register to finish creating one.
router.post("/google-login", authLimiter, asyncHandler(async (req, res) => {
  const payload = await verifyGoogleToken(req.body.idToken);
  const { sub: googleId, email, email_verified: emailVerified } = payload;

  let user = await User.findOne({ googleId });
  if (!user && emailVerified) {
    user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      user.googleId = googleId;
      await user.save();
    }
  }

  if (!user) {
    return res.status(404).json({ message: "No account found for this Google email — please register" });
  }
  if (!user.isActive) {
    return res.status(403).json({ message: "This account has been deactivated" });
  }

  res.json({ token: signToken(user._id, user.tokenVersion), user: user.toSafeObject() });
}));

// @route   POST /api/auth/google-register
// @desc    Create a new account from a Google identity. Google supplies
//          name/email, so this only still needs the phone-OTP step every
//          other registration path requires, plus the matching invite code
//          when signing up as an admin or service account (role + inviteCode
//          from the register page's tab selection) — nothing else.
router.post("/google-register", authLimiter, asyncHandler(async (req, res) => {
  const payload = await verifyGoogleToken(req.body.idToken);
  const { sub: googleId, email, name, email_verified: emailVerified } = payload;

  if (!emailVerified) {
    return res.status(400).json({ message: "Your Google email is not verified" });
  }

  const { inviteCode, address, company, role: requestedRole } = req.body;
  const phone = normalizePhone(req.body.phone);
  if (!phone) {
    return res.status(400).json({ message: "A valid phone number is required" });
  }

  let role = "client";
  if (requestedRole === "admin" || requestedRole === "service") {
    const envVarName = requestedRole === "admin" ? "ADMIN_INVITE_CODE" : "SERVICE_INVITE_CODE";
    const expectedCode = process.env[envVarName];
    if (!expectedCode) {
      return res.status(503).json({ message: `${requestedRole} registration is disabled — ${envVarName} is not set on the server` });
    }
    if (!timingSafeEqual(inviteCode, expectedCode)) {
      return res.status(403).json({ message: `Invalid ${requestedRole} invite code` });
    }
    role = requestedRole;
  }

  const verifiedOtp = await Otp.findOne({ phone, purpose: "register", verified: true, expiresAt: { $gt: new Date() } });
  if (!verifiedOtp) {
    return res.status(400).json({ message: "Please verify your phone number before registering" });
  }

  const [existingGoogle, existingEmail, existingPhone] = await Promise.all([
    User.findOne({ googleId }),
    User.findOne({ email: email.toLowerCase() }),
    User.findOne({ phone }),
  ]);
  if (existingGoogle || existingEmail) {
    return res.status(409).json({ message: "An account with this Google email already exists — try logging in with Google instead" });
  }
  if (existingPhone) {
    return res.status(409).json({ message: "An account with this phone number already exists" });
  }

  const user = await User.create({ name, email, googleId, phone, phoneVerified: true, address, company, role });
  await verifiedOtp.deleteOne();

  res.status(201).json({ token: signToken(user._id, user.tokenVersion), user: user.toSafeObject() });
}));

// @route   POST /api/auth/login
router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (isLocked(user)) {
      return res.status(429).json({
        message: "Too many failed attempts on this account — please try again in a few minutes",
      });
    }

    if (!(await user.comparePassword(password))) {
      await recordFailedLogin(user, req.ip);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "This account has been deactivated" });
    }

    await recordSuccessfulLogin(user);

    res.json({
      token: signToken(user._id, user.tokenVersion),
      user: user.toSafeObject(),
    });
  } catch (err) {
    res.status(500).json({ message: "Login failed", error: err.message });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Request a password reset link by email — works for every role
//          (admin/client/service all share the same User model and login
//          form). Always returns the same generic message whether or not
//          the email has an account, so this endpoint can't be used to
//          probe which emails are registered.
router.post("/forgot-password", passwordResetLimiter, asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  const genericMessage = "If an account exists for that email, we've sent a password reset link to it.";
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    // Deliberately identical response/timing-shape to the "user found"
    // path below — no early-return-with-different-status here.
    return res.json({ message: genericMessage });
  }

  // Only one active reset link per account at a time — requesting a new
  // one invalidates any still-outstanding link instead of letting them stack up.
  await PasswordReset.deleteMany({ user: user._id });

  const rawToken = crypto.randomBytes(32).toString("hex");
  await PasswordReset.create({
    user: user._id,
    tokenHash: hashResetToken(rawToken),
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  });

  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`;

  const result = await sendEmail({
    to: user.email,
    subject: "Reset your GivsiaTech password",
    text: `We received a request to reset your GivsiaTech password. This link expires in 30 minutes:\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email — your password won't change unless you open the link above.`,
  });

  logSecurityEvent({
    type: "password_reset_requested",
    severity: "low",
    ip: req.ip,
    email: user.email,
    user: user._id,
    detail: `Password reset requested (${user.role})`,
  });

  const payload = { message: genericMessage };
  // Dev fallback, same philosophy as /send-otp's devCode above — only
  // ever exposed when SMTP genuinely isn't configured, so the reset flow
  // is still testable end-to-end locally without real email credentials.
  if (!result.delivered && !process.env.SMTP_HOST) {
    payload.devResetUrl = resetUrl;
  }

  res.json(payload);
}));

// @route   POST /api/auth/reset-password
// @desc    Complete a reset using the token emailed by /forgot-password.
//          Rejects a new password identical to the current one.
router.post("/reset-password", passwordResetLimiter, asyncHandler(async (req, res) => {
  const { token, newPassword, confirmPassword } = req.body;
  if (!token || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: "Token, new password, and confirmation are required" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  const resetDoc = await PasswordReset.findOne({
    tokenHash: hashResetToken(token),
    expiresAt: { $gt: new Date() },
  });
  if (!resetDoc) {
    return res.status(400).json({ message: "This reset link is invalid or has expired — request a new one" });
  }

  const user = await User.findById(resetDoc.user).select("+password");
  if (!user) {
    await resetDoc.deleteOne();
    return res.status(404).json({ message: "Account not found" });
  }

  if (await user.comparePassword(newPassword)) {
    return res.status(400).json({ message: "New password must be different from your current password" });
  }

  user.password = newPassword; // pre-save hook re-hashes it
  user.tokenVersion += 1; // a compromised password means any existing session could be too — kill them all
  await user.save();
  await PasswordReset.deleteMany({ user: user._id }); // burn this token and any other outstanding one

  logSecurityEvent({
    type: "password_reset_completed",
    severity: "medium",
    ip: req.ip,
    email: user.email,
    user: user._id,
    detail: `Password reset completed (${user.role})`,
  });

  // Fire-and-forget notice — lets the real owner know even if this reset
  // wasn't them (e.g. their email got compromised separately from this site).
  sendEmail({
    to: user.email,
    subject: "Your GivsiaTech password was changed",
    text: "Your password was just changed using the 'forgot password' link. If this wasn't you, contact support immediately.",
  });

  res.json({ message: "Password updated — you can now log in with your new password" });
}));

// @route   GET /api/auth/me
router.get("/me", protect, async (req, res) => {
  res.json({ user: req.user.toSafeObject() });
});

// @route   POST /api/auth/logout
// @desc    Invalidates the CURRENT token (and any other outstanding one)
//          server-side by bumping tokenVersion — without this, "logout" was
//          purely client-side (just forgetting the token), so a copied/
//          leaked token would stay fully valid until it naturally expired
//          (JWT_EXPIRES_IN, up to 7 days by default) regardless of logout.
router.post("/logout", protect, asyncHandler(async (req, res) => {
  req.user.tokenVersion += 1;
  await req.user.save();
  res.json({ message: "Logged out" });
}));

export default router;

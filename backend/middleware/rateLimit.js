import rateLimit from "express-rate-limit";
import { logSecurityEvent, registerViolation } from "../utils/security.js";

// Shared by every public-facing limiter below — logs the trip to the
// Security tab and counts it toward that IP's auto-block threshold (see
// registerViolation in utils/security.js). Limiters that only ever run
// behind an already-authenticated, role-gated route (upload, outreach)
// skip this — hitting those caps means a legitimate session is doing a lot
// of work, not an anonymous attacker probing the site.
const violationHandler = (reason) => (req, res, _next, options) => {
  logSecurityEvent({
    type: "rate_limit_exceeded",
    severity: "medium",
    ip: req.ip,
    path: req.originalUrl.split("?")[0],
    detail: `Rate limit exceeded on ${req.method} ${req.path} (${reason})`,
  });
  registerViolation(req.ip, "rate_limit_exceeded");
  res.status(options.statusCode).json(options.message);
};

// Brute-force protection on login/password-guessing endpoints.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts — please try again in a few minutes" },
  handler: violationHandler("auth"),
});

// OTP send is also rate-limited per-phone in the route itself; this caps
// it per-IP too so one IP can't hammer the SMS provider.
export const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many verification requests — please wait a bit before trying again" },
  handler: violationHandler("otp"),
});

// Givi is public and unauthenticated, and every message costs a Gemini
// free-tier quota unit — without a cap, one visitor (or a script) could
// burn the site's entire daily quota alone.
export const chatLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "You're sending messages a bit fast — please slow down." },
  handler: violationHandler("chat"),
});

// Covers both /forgot-password (prevents email-bombing an inbox and probing
// which emails have accounts) and /reset-password (prevents brute-forcing
// a guessed/leaked reset token). Same window/cap for both since either one
// hammered from one IP is the same kind of abuse.
export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many password reset attempts — please try again in a few minutes" },
  handler: violationHandler("password-reset"),
});

// Upload is authenticated (admin-only) but still capped to blunt storage
// exhaustion from a compromised/misbehaving admin session.
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many uploads — please slow down" },
});

// Cold-outreach drafting/sending is admin/service-only but still capped —
// each call spends a Gemini quota unit and/or an SMTP send, so a scripted
// or compromised session can't blast either at unlimited volume.
export const outreachLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many outreach requests — please slow down" },
});

// Business-lead discovery — each call spends real Google Places API quota
// ($), so this is capped tighter than the general bizlead CRUD limiter
// below, admin-only or not.
export const bizLeadDiscoverLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many discovery runs this hour — please slow down" },
});

// General bizlead CRUD/AI-generation/send/import/export — admin-only but
// still capped to blunt a compromised session from mass-generating AI
// drafts or mass-emailing scraped contacts.
export const bizLeadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests — please slow down" },
});

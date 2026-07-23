import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../context/AuthContext.jsx";
import AuthVisual from "../components/AuthVisual.jsx";
import PasswordInput from "../components/PasswordInput.jsx";
import OtpBoxes from "../components/OtpBoxes.jsx";
import ValidatedInput from "../components/ValidatedInput.jsx";
import { isValidEmail, isValidPhone } from "../utils/validators.js";

const RESEND_COOLDOWN = 60;
const googleEnabled = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

// Client-side only, for prefill display — the token is still verified
// server-side on submit, so a forged/garbage payload here can't do harm.
const decodeJwtPayload = (token) => {
  try {
    return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
};

const DASHBOARD_PATH = { client: "/dashboard/client", admin: "/dashboard/admin", service: "/dashboard/service" };
const MODE_LABEL = { client: "Sign up", admin: "Admin", service: "Service" };

export default function Register() {
  const { register, registerAdmin, registerService, registerWithGoogle, sendOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("client"); // "client" | "admin" | "service"
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    password: "",
    confirmPassword: "",
    company: "",
    inviteCode: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [googleAuth, setGoogleAuth] = useState(null); // { idToken, name, email }

  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpMessage, setOtpMessage] = useState("");
  const [devCode, setDevCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const channelLabel = { sms: "SMS", dev: "the code shown below (dev mode)" };

  // Fires an OS-level notification pop-up (gated on permission, exactly
  // like a native app would) the instant the code is sent, ahead of the
  // SMS message itself which arrives moments later. The glow effect can't
  // live in the OS notification chrome, so it's paired with an in-app toast
  // styled with .otp-toast for the visual effect.
  const notifyOtpSent = async (phone, channel) => {
    const text = `A verification code is on its way to ${phone} via ${channelLabel[channel] || "SMS"}`;
    setToast(text);

    if (navigator.vibrate) navigator.vibrate([200, 80, 200]);

    if (!("Notification" in window)) return;
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") return;

    new Notification("GivsiaTech", {
      body: text,
      icon: "/logo.png",
      tag: "givsia-otp",
    });
  };

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const resetOtpState = () => {
    setOtpSent(false);
    setOtpVerified(false);
    setOtpCode("");
    setOtpMessage("");
    setDevCode("");
    setCooldown(0); // cooldown is per phone number — a new number must not inherit the old one's lockout
  };

  const handlePhoneChange = (value) => {
    setForm({ ...form, phone: value });
    if (otpSent || otpVerified || cooldown > 0) resetOtpState();
  };

  const handleSendOtp = async () => {
    setOtpMessage("");
    setError("");
    setOtpSending(true);
    try {
      const data = await sendOtp(form.phone);
      setOtpSent(true);
      setCooldown(RESEND_COOLDOWN);
      setOtpMessage(data.message || "Verification code sent");
      setDevCode(data.devCode || "");
      await notifyOtpSent(form.phone, data.channel);
    } catch (err) {
      setOtpMessage(err.response?.data?.message || "Could not send verification code");
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    setOtpMessage("");
    setOtpVerifying(true);
    try {
      await verifyOtp(form.phone, otpCode);
      setOtpVerified(true);
      setOtpMessage("Phone number verified");
    } catch (err) {
      setOtpMessage(err.response?.data?.message || "Invalid code");
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleGoogleSuccess = (credentialResponse) => {
    setError("");
    const idToken = credentialResponse.credential;
    const payload = decodeJwtPayload(idToken);
    if (!idToken || !payload) {
      setError("Could not read your Google account — please try again");
      return;
    }
    setGoogleAuth({ idToken, name: payload.name || "", email: payload.email || "" });
  };

  const cancelGoogle = () => {
    setGoogleAuth(null);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!otpVerified) {
      setError("Please verify your phone number before creating an account");
      return;
    }
    if (!googleAuth && form.password !== form.confirmPassword) {
      setError("Password and confirm password do not match");
      return;
    }

    setLoading(true);
    try {
      if (googleAuth) {
        await registerWithGoogle({
          idToken: googleAuth.idToken,
          phone: form.phone,
          address: form.address,
          company: mode === "client" ? form.company : undefined,
          inviteCode: mode !== "client" ? form.inviteCode : undefined,
          role: mode !== "client" ? mode : undefined,
        });
        navigate(DASHBOARD_PATH[mode]);
        return;
      }

      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        address: form.address,
        password: form.password,
        confirmPassword: form.confirmPassword,
      };
      if (mode === "admin") {
        await registerAdmin({ ...payload, inviteCode: form.inviteCode });
      } else if (mode === "service") {
        await registerService({ ...payload, inviteCode: form.inviteCode });
      } else {
        await register({ ...payload, company: form.company });
      }
      navigate(DASHBOARD_PATH[mode]);
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrap}>
      <form onSubmit={handleSubmit} className="auth-form" style={styles.form}>
        <AuthVisual />

        <div style={styles.tabRow} role="tablist">
          {Object.keys(MODE_LABEL).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              className={mode === m ? "btn btn-primary" : "btn btn-ghost"}
              style={styles.tabBtn}
              onClick={() => { setMode(m); setError(""); }}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>

        <h2 style={styles.heading}>
          {mode === "admin" ? "Create an admin account" : mode === "service" ? "Create a service account" : "Create your account"}
        </h2>
        {error && <p style={styles.error}>{error}</p>}

        {googleEnabled && !googleAuth && (
          <>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError("Google sign-in failed")} width="308" />
            </div>
            <div style={styles.divider}><span>or</span></div>
          </>
        )}

        {googleAuth ? (
          <div style={styles.googleBadge}>
            <span>Signed in as <strong>{googleAuth.name}</strong> ({googleAuth.email}) via Google</span>
            <button type="button" onClick={cancelGoogle} style={styles.toggle}>Not you? Cancel</button>
          </div>
        ) : (
          <>
            <input placeholder="Full name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            {mode === "client" && (
              <input placeholder="Company (optional)" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            )}
            <ValidatedInput placeholder="Email *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required isValid={isValidEmail(form.email)} />
          </>
        )}

        <div style={styles.row}>
          <div style={{ flex: 1 }}>
            <ValidatedInput
              placeholder="Phone number *"
              type="tel"
              value={form.phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              required
              disabled={otpVerified}
              isValid={isValidPhone(form.phone)}
            />
          </div>
          <button
            type="button"
            className="btn"
            onClick={handleSendOtp}
            disabled={!form.phone || otpSending || otpVerified || cooldown > 0}
            style={styles.otpBtn}
          >
            {otpVerified ? "Verified ✓" : cooldown > 0 ? `Resend (${cooldown}s)` : otpSending ? "Sending..." : otpSent ? "Resend code" : "Send code"}
          </button>
        </div>

        {otpSent && !otpVerified && (
          <div className="otp-electric-panel">
            <OtpBoxes length={6} value={otpCode} onChange={setOtpCode} disabled={otpVerifying} autoFocus />
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleVerifyOtp}
              disabled={otpVerifying || otpCode.length !== 6}
              style={{ width: "100%" }}
            >
              {otpVerifying ? "Verifying..." : "Verify Now"}
            </button>
          </div>
        )}

        {otpVerified && (
          <div className="otp-electric-panel">
            <div className="otp-success-pop">
              <div className="otp-success-check">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="otp-success-title">Verified!</p>
              <p className="otp-success-sub">Phone number confirmed successfully.</p>
            </div>
          </div>
        )}

        {otpMessage && !otpVerified && <p style={styles.hint}>{otpMessage}</p>}
        {devCode && <p style={styles.hint}>Dev mode (no SMS provider configured) — your code is {devCode}</p>}

        <input placeholder="Address (optional)" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />

        {!googleAuth && (
          <>
            <PasswordInput placeholder="Password *" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
            <PasswordInput
              placeholder="Confirm password *"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              required
              minLength={6}
            />
          </>
        )}

        {mode !== "client" && (
          <PasswordInput
            placeholder={mode === "admin" ? "Admin invite code" : "Service invite code"}
            value={form.inviteCode}
            onChange={(e) => setForm({ ...form, inviteCode: e.target.value })}
            required
          />
        )}

        <button className="btn btn-primary" type="submit" disabled={loading || !otpVerified} style={{ width: "100%" }}>
          {loading ? "Creating account..." : mode === "admin" ? "Create admin account" : mode === "service" ? "Create service account" : "Create account"}
        </button>

        <p style={styles.foot}>
          Already have an account? <Link to="/login" style={{ color: "var(--lavender)" }}>Log in</Link>
        </p>
      </form>

      {toast && (
        <div className="otp-toast" role="status">
          <span className="otp-toast-icon">📩</span>
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px" },
  form: {
    width: 380,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: 36,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  heading: { marginBottom: 8 },
  tabRow: { display: "flex", gap: 6 },
  tabBtn: { flex: 1, fontSize: "0.78rem", padding: "8px 0", justifyContent: "center" },
  error: { color: "#ff6b6b", fontSize: "0.85rem" },
  hint: { color: "var(--text-dim)", fontSize: "0.78rem" },
  foot: { fontSize: "0.85rem", color: "var(--text-dim)", textAlign: "center" },
  row: { display: "flex", gap: 8 },
  otpBtn: { whiteSpace: "nowrap", fontSize: "0.78rem", padding: "0 12px" },
  divider: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "var(--text-dim)",
    fontSize: "0.75rem",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  googleBadge: {
    background: "var(--bg-soft)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    padding: "10px 14px",
    fontSize: "0.85rem",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  toggle: {
    background: "transparent",
    color: "var(--text-dim)",
    fontSize: "0.78rem",
    textAlign: "center",
    padding: "4px 0",
  },
};

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../context/AuthContext.jsx";
import AuthVisual from "../components/AuthVisual.jsx";
import PasswordInput from "../components/PasswordInput.jsx";
import ValidatedInput from "../components/ValidatedInput.jsx";
import { isValidEmail } from "../utils/validators.js";

const dashboardPath = { admin: "/dashboard/admin", client: "/dashboard/client", service: "/dashboard/service" };
const googleEnabled = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

export default function Login() {
  const { login, loginWithGoogle, forgotPassword } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // "login" | "forgot" — toggled inline rather than a separate route/page,
  // since requesting a reset link only ever needs an email address.
  // Completing the reset (entering a new password) happens on its own
  // /reset-password page instead, reached via the link emailed out below —
  // that's the actual security boundary, not something that can live
  // inline here without the token.
  const [mode, setMode] = useState("login");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");
  const [devResetUrl, setDevResetUrl] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      navigate(dashboardPath[user.role] || "/");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotMessage("");
    setDevResetUrl("");
    try {
      const data = await forgotPassword(forgotEmail);
      setForgotMessage(data.message);
      if (data.devResetUrl) setDevResetUrl(data.devResetUrl);
    } catch (err) {
      setForgotMessage(err.response?.data?.message || "Could not send a reset link right now — try again shortly.");
    } finally {
      setForgotLoading(false);
    }
  };

  const backToLogin = () => {
    setMode("login");
    setForgotEmail("");
    setForgotMessage("");
    setDevResetUrl("");
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError("");
    setGoogleLoading(true);
    try {
      const user = await loginWithGoogle(credentialResponse.credential);
      navigate(dashboardPath[user.role] || "/");
    } catch (err) {
      setError(err.response?.data?.message || "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  };

  if (mode === "forgot") {
    return (
      <div style={styles.wrap}>
        <form onSubmit={handleForgotSubmit} className="auth-form" style={styles.form}>
          <AuthVisual />
          <h2 style={styles.heading}>Reset your password</h2>
          <p style={styles.sub}>
            Enter the email on your account (works for admin, client, and service logins) and we'll send you a
            link to set a new password.
          </p>

          {!forgotMessage && (
            <>
              <ValidatedInput
                placeholder="Email"
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
                isValid={isValidEmail(forgotEmail)}
              />
              <button className="btn btn-primary" type="submit" disabled={forgotLoading} style={{ width: "100%" }}>
                {forgotLoading ? "Sending..." : "Send reset link"}
              </button>
            </>
          )}

          {forgotMessage && (
            <div style={styles.forgotResult}>
              <p style={{ margin: 0 }}>{forgotMessage}</p>
              {devResetUrl && (
                <p style={styles.hint}>
                  Dev mode (no SMTP configured) — <a href={devResetUrl} style={{ color: "var(--lavender)" }}>open your reset link</a>
                </p>
              )}
            </div>
          )}

          <p style={styles.foot}>
            <button type="button" onClick={backToLogin} className="link-btn" style={styles.linkBtn}>
              ← Back to login
            </button>
          </p>
        </form>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <form onSubmit={handleSubmit} className="auth-form" style={styles.form}>
        <AuthVisual />
        <h2 style={styles.heading}>Log in</h2>
        {error && <p style={styles.error}>{error}</p>}

        {googleEnabled && (
          <>
            <div style={{ display: "flex", justifyContent: "center", opacity: googleLoading ? 0.6 : 1, pointerEvents: googleLoading ? "none" : "auto" }}>
              <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError("Google sign-in failed")} width="308" />
            </div>
            <div style={styles.divider}><span>or</span></div>
          </>
        )}

        <ValidatedInput
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
          isValid={isValidEmail(form.email)}
        />
        <PasswordInput
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        <button type="button" onClick={() => setMode("forgot")} className="link-btn" style={styles.forgotLink}>
          Forgot password?
        </button>
        <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%" }}>
          {loading ? "Logging in..." : "Log in"}
        </button>
        <p style={styles.foot}>
          No account? <Link to="/register" style={{ color: "var(--lavender)" }}>Register</Link>
        </p>
      </form>
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
  error: { color: "#ff6b6b", fontSize: "0.85rem" },
  foot: { fontSize: "0.85rem", color: "var(--text-dim)", textAlign: "center" },
  sub: { color: "var(--text-dim)", fontSize: "0.85rem", lineHeight: 1.6, marginTop: -8 },
  forgotLink: { fontSize: "0.8rem", alignSelf: "flex-end", marginTop: -8 },
  forgotResult: {
    background: "var(--bg-soft)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "14px 16px",
    fontSize: "0.88rem",
    lineHeight: 1.6,
  },
  hint: { color: "var(--text-dim)", fontSize: "0.8rem", marginTop: 8 },
  linkBtn: { fontSize: "0.85rem" },
  divider: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "var(--text-dim)",
    fontSize: "0.75rem",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
};

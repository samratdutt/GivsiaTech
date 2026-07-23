import { useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import AuthVisual from "../components/AuthVisual.jsx";
import PasswordInput from "../components/PasswordInput.jsx";

// Reached via the link emailed by Login's "Forgot password?" flow
// (POST /auth/forgot-password) — the token in the URL is the actual
// security boundary here, not anything entered on this page. Works
// identically for every role (admin/client/service), same as login itself.
export default function ResetPassword() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";

  const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.newPassword !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, form.newPassword, form.confirmPassword);
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || "Could not reset your password — the link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div style={styles.wrap}>
        <div className="auth-form" style={styles.form}>
          <AuthVisual />
          <h2 style={styles.heading}>Invalid reset link</h2>
          <p style={styles.sub}>
            This link is missing its reset token — it may have been copied incorrectly. Request a new one from
            the login page.
          </p>
          <Link to="/login" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div style={styles.wrap}>
        <div className="auth-form" style={styles.form}>
          <AuthVisual />
          <h2 style={styles.heading}>Password updated</h2>
          <p style={styles.sub}>Your password has been changed. Log in with your new password to continue.</p>
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => navigate("/login")}>
            Go to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <form onSubmit={handleSubmit} className="auth-form" style={styles.form}>
        <AuthVisual />
        <h2 style={styles.heading}>Set a new password</h2>
        {email && <p style={styles.sub}>Resetting the password for <strong>{email}</strong>.</p>}
        {error && <p style={styles.error}>{error}</p>}

        <PasswordInput
          placeholder="New password"
          value={form.newPassword}
          onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
          minLength={6}
          required
        />
        <PasswordInput
          placeholder="Confirm new password"
          value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          minLength={6}
          required
        />
        <p style={styles.hint}>Must be at least 6 characters, and different from your current password.</p>

        <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%" }}>
          {loading ? "Updating..." : "Update password"}
        </button>
        <p style={styles.foot}>
          <Link to="/login" style={{ color: "var(--lavender)" }}>Back to login</Link>
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
  sub: { color: "var(--text-dim)", fontSize: "0.85rem", lineHeight: 1.6, marginTop: -8 },
  hint: { color: "var(--text-dim)", fontSize: "0.78rem", marginTop: -10 },
  error: { color: "#ff6b6b", fontSize: "0.85rem" },
  foot: { fontSize: "0.85rem", color: "var(--text-dim)", textAlign: "center" },
};

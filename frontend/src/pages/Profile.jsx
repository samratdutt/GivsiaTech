import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useConfirm } from "../context/ConfirmContext.jsx";
import PasswordInput from "../components/PasswordInput.jsx";
import ValidatedInput from "../components/ValidatedInput.jsx";
import { isValidEmail } from "../utils/validators.js";
import api from "../api/axios.js";

const emptyFounderForm = {
  degree: "", role: "", expertise: "", quote: "", email: "",
  facebook: "", instagram: "", linkedin: "", github: "", portfolio: "",
};

export default function Profile() {
  const { user, updateProfile, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [form, setForm] = useState({
    name: user?.name || "",
    address: user?.address || "",
    company: user?.company || "",
  });
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmNewPassword: "" });

  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsMessage, setDetailsMessage] = useState("");
  const [detailsError, setDetailsError] = useState("");

  const [savingPassword, setSavingPassword] = useState(false);
  const [pwMessage, setPwMessage] = useState("");
  const [pwError, setPwError] = useState("");

  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Only set for the two founder accounts (Founder.user is pre-linked to
  // their specific User IDs on the backend) — everyone else's /founders/me
  // call returns null and this whole section just doesn't render.
  const [founder, setFounder] = useState(null);
  const [founderForm, setFounderForm] = useState(emptyFounderForm);
  const [savingFounder, setSavingFounder] = useState(false);
  const [founderMessage, setFounderMessage] = useState("");
  const [founderError, setFounderError] = useState("");

  useEffect(() => {
    api.get("/founders/me").then((res) => {
      if (res.data.founder) {
        const f = res.data.founder;
        setFounder(f);
        setFounderForm({
          degree: f.degree || "",
          role: f.role || "",
          expertise: (f.expertise || []).join(", "),
          quote: f.quote || "",
          email: f.email || "",
          facebook: f.links?.facebook || "",
          instagram: f.links?.instagram || "",
          linkedin: f.links?.linkedin || "",
          github: f.links?.github || "",
          portfolio: f.links?.portfolio || "",
        });
      }
    }).catch(() => {});
  }, []);

  const handleFounderSubmit = async (e) => {
    e.preventDefault();
    setFounderError("");
    setFounderMessage("");
    setSavingFounder(true);
    try {
      const { data } = await api.patch("/founders/me", {
        degree: founderForm.degree,
        role: founderForm.role,
        expertise: founderForm.expertise.split(",").map((s) => s.trim()).filter(Boolean),
        quote: founderForm.quote,
        email: founderForm.email,
        links: {
          facebook: founderForm.facebook,
          instagram: founderForm.instagram,
          linkedin: founderForm.linkedin,
          github: founderForm.github,
          portfolio: founderForm.portfolio,
        },
      });
      setFounder(data.founder);
      setFounderMessage("Founder profile updated — now live on the About section.");
    } catch (err) {
      setFounderError(err.response?.data?.message || "Could not update founder profile");
    } finally {
      setSavingFounder(false);
    }
  };

  if (!user) return null;

  const handleDetailsSubmit = async (e) => {
    e.preventDefault();
    setDetailsError("");
    setDetailsMessage("");
    setSavingDetails(true);
    try {
      await updateProfile({ name: form.name, address: form.address, company: form.company });
      setDetailsMessage("Profile updated");
    } catch (err) {
      setDetailsError(err.response?.data?.message || "Could not update profile");
    } finally {
      setSavingDetails(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPwError("");
    setPwMessage("");

    if (pwForm.newPassword !== pwForm.confirmNewPassword) {
      setPwError("New password and confirmation do not match");
      return;
    }

    setSavingPassword(true);
    try {
      await updateProfile({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      setPwMessage("Password changed");
      setPwForm({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
    } catch (err) {
      setPwError(err.response?.data?.message || "Could not change password");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    setDeleteError("");
    if (!(await confirm("Permanently delete your account? This can't be undone — your name/email/phone will be anonymized and you'll be logged out everywhere."))) {
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount(deletePassword);
      navigate("/");
    } catch (err) {
      setDeleteError(err.response?.data?.message || "Could not delete your account");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="container" style={{ paddingTop: 120, paddingBottom: 80, maxWidth: 640 }}>
      <span className="eyebrow">{user.role}</span>
      <h1 style={{ margin: "12px 0 32px" }}>Your profile</h1>

      <div style={styles.card}>
        <h2 style={styles.cardHeading}>Account details</h2>
        <div style={styles.readonlyGrid}>
          <div style={styles.readonlyValue}>
            <span style={styles.readonlyLabel}>Email</span>
            <p style={styles.readonlyValue}>{user.email}</p>
          </div>
          <div style={styles.readonlyValue}>
            <span style={styles.readonlyLabel}>Phone</span>
            <p style={styles.readonlyValue}>{user.phone} {user.phoneVerified && <span style={styles.verifiedBadge}>Verified</span>}</p>
          </div>
          <div style={styles.readonlyValue}>
            <span style={styles.readonlyLabel}>Role</span>
            <p style={{ textTransform: "capitalize" }}>{user.role}</p>
          </div>
        </div>
        <p style={styles.hint}>Email, phone, and role can't be changed here — contact an admin if these need to change.</p>
      </div>

      <form onSubmit={handleDetailsSubmit} style={styles.card}>
        <h2 style={styles.cardHeading}>Edit details</h2>
        {detailsError && <p style={styles.error}>{detailsError}</p>}
        {detailsMessage && <p style={styles.success}>{detailsMessage}</p>}

        <label style={styles.label}>Full name</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />

        <label style={styles.label}>Address</label>
        <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Optional" />

        {user.role === "client" && (
          <>
            <label style={styles.label}>Company</label>
            <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Optional" />
          </>
        )}

        <button className="btn btn-primary" type="submit" disabled={savingDetails} style={{ marginTop: 8, alignSelf: "flex-start" }}>
          {savingDetails ? "Saving..." : "Save changes"}
        </button>
      </form>

      <form onSubmit={handlePasswordSubmit} style={styles.card}>
        <h2 style={styles.cardHeading}>Change password</h2>
        {pwError && <p style={styles.error}>{pwError}</p>}
        {pwMessage && <p style={styles.success}>{pwMessage}</p>}

        <label style={styles.label}>Current password</label>
        <PasswordInput
          value={pwForm.currentPassword}
          onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
          required
        />
        <label style={styles.label}>New password</label>
        <PasswordInput
          value={pwForm.newPassword}
          onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
          required
          minLength={6}
        />
        <label style={styles.label}>Confirm new password</label>
        <PasswordInput
          value={pwForm.confirmNewPassword}
          onChange={(e) => setPwForm({ ...pwForm, confirmNewPassword: e.target.value })}
          required
          minLength={6}
        />

        <button className="btn btn-ghost" type="submit" disabled={savingPassword} style={{ marginTop: 8, alignSelf: "flex-start" }}>
          {savingPassword ? "Updating..." : "Change password"}
        </button>
      </form>

      <form onSubmit={handleDeleteAccount} style={{ ...styles.card, borderColor: "#ff6b6b55" }}>
        <h2 style={{ ...styles.cardHeading, color: "#ff6b6b" }}>Danger zone</h2>
        <p style={styles.hint}>
          Permanently delete your account. Your name, email, and phone are anonymized (not just hidden) and you're
          logged out on every device immediately — this can't be undone.
        </p>
        {deleteError && <p style={styles.error}>{deleteError}</p>}

        <label style={styles.label}>Confirm your password</label>
        <PasswordInput
          value={deletePassword}
          onChange={(e) => setDeletePassword(e.target.value)}
          placeholder="Leave blank if you signed up with Google"
        />

        <button
          className="btn btn-ghost"
          type="submit"
          disabled={deleting}
          style={{ marginTop: 8, alignSelf: "flex-start", color: "#ff6b6b", borderColor: "#ff6b6b" }}
        >
          {deleting ? "Deleting..." : "Delete my account"}
        </button>
      </form>

      {founder && (
        <form onSubmit={handleFounderSubmit} style={styles.card}>
          <h2 style={styles.cardHeading}>Founder profile</h2>
          <p style={styles.hint}>Shown publicly on the website's About section — only you can edit this.</p>
          {founderError && <p style={styles.error}>{founderError}</p>}
          {founderMessage && <p style={styles.success}>{founderMessage}</p>}

          <label style={styles.label}>Degree</label>
          <input value={founderForm.degree} onChange={(e) => setFounderForm({ ...founderForm, degree: e.target.value })} />

          <label style={styles.label}>Role / qualification</label>
          <input value={founderForm.role} onChange={(e) => setFounderForm({ ...founderForm, role: e.target.value })} />

          <label style={styles.label}>Expertise (comma separated)</label>
          <input value={founderForm.expertise} onChange={(e) => setFounderForm({ ...founderForm, expertise: e.target.value })} />

          <label style={styles.label}>Quote</label>
          <textarea
            rows={3}
            value={founderForm.quote}
            onChange={(e) => setFounderForm({ ...founderForm, quote: e.target.value })}
            style={{ resize: "vertical" }}
          />

          <label style={styles.label}>Public email</label>
          <ValidatedInput type="email" value={founderForm.email} onChange={(e) => setFounderForm({ ...founderForm, email: e.target.value })} placeholder="Optional" isValid={isValidEmail(founderForm.email)} />

          <div className="responsive-grid-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={styles.label}>LinkedIn</label>
              <input value={founderForm.linkedin} onChange={(e) => setFounderForm({ ...founderForm, linkedin: e.target.value })} placeholder="https://linkedin.com/in/..." />
            </div>
            <div>
              <label style={styles.label}>GitHub</label>
              <input value={founderForm.github} onChange={(e) => setFounderForm({ ...founderForm, github: e.target.value })} placeholder="https://github.com/..." />
            </div>
            <div>
              <label style={styles.label}>Instagram</label>
              <input value={founderForm.instagram} onChange={(e) => setFounderForm({ ...founderForm, instagram: e.target.value })} placeholder="https://instagram.com/..." />
            </div>
            <div>
              <label style={styles.label}>Facebook</label>
              <input value={founderForm.facebook} onChange={(e) => setFounderForm({ ...founderForm, facebook: e.target.value })} placeholder="https://facebook.com/..." />
            </div>
            <div>
              <label style={styles.label}>Portfolio</label>
              <input value={founderForm.portfolio} onChange={(e) => setFounderForm({ ...founderForm, portfolio: e.target.value })} placeholder="https://..." />
            </div>
          </div>

          <button className="btn btn-primary" type="submit" disabled={savingFounder} style={{ marginTop: 8, alignSelf: "flex-start" }}>
            {savingFounder ? "Saving..." : "Save founder profile"}
          </button>
        </form>
      )}
    </div>
  );
}

const styles = {
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  cardHeading: { fontSize: "1rem", marginBottom: 4 },
  readonlyGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 },
  readonlyValue: { overflowWrap: "anywhere", minWidth: 0 },
  readonlyLabel: { fontSize: "0.72rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" },
  verifiedBadge: {
    fontSize: "0.68rem",
    color: "var(--yellow)",
    border: "1px solid var(--yellow)",
    borderRadius: 999,
    padding: "1px 8px",
    marginLeft: 6,
  },
  hint: { fontSize: "0.78rem", color: "var(--text-dim)" },
  label: { fontSize: "0.78rem", color: "var(--text-dim)" },
  error: { color: "#ff6b6b", fontSize: "0.85rem" },
  success: { color: "#4ade80", fontSize: "0.85rem" },
};

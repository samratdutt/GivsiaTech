import { useEffect, useState } from "react";
import api from "../api/axios.js";
import ValidatedInput from "./ValidatedInput.jsx";
import { isValidEmail } from "../utils/validators.js";

export default function ContactSection() {
  const [form, setForm] = useState({ name: "", email: "", company: "", serviceInterest: "other", message: "" });
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [services, setServices] = useState([]);

  useEffect(() => {
    api.get("/services").then((res) => setServices(res.data.services)).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("sending");
    try {
      await api.post("/contact", form);
      setStatus("sent");
      setForm({ name: "", email: "", company: "", serviceInterest: "other", message: "" });
    } catch (err) {
      setStatus("error");
    }
  };

  return (
    <section id="contact-form" style={styles.section}>
      <div className="container contact-grid" style={styles.grid}>
        <div style={{ position: "relative" }}>
          <span className="pulse-ring" style={{ width: 60, height: 60, top: -20, left: 200 }} />
          <span className="pulse-ring" style={{ width: 60, height: 60, top: -20, left: 200, animationDelay: "1s" }} />
          <span className="pulse-ring" style={{ width: 60, height: 60, top: -20, left: 200, animationDelay: "2s" }} />
          <span className="eyebrow">Get in touch</span>
          <h2 style={styles.heading}>Tell us what you're building</h2>
          <p style={styles.copy}>
            Whether it's a full site, an AI workflow, or a SaaS platform —
            send the details and we'll reply with next steps.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            placeholder="Your name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <ValidatedInput
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            isValid={isValidEmail(form.email)}
          />
          <input
            placeholder="Company (optional)"
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
          />
          <select
            value={form.serviceInterest}
            onChange={(e) => setForm({ ...form, serviceInterest: e.target.value })}
          >
            {services.map((s) => (
              <option key={s._id} value={s.key}>{s.title}</option>
            ))}
            <option value="other">Something else</option>
          </select>
          <textarea
            placeholder="What are you trying to build?"
            rows={4}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            required
          />
          <button className="btn btn-primary" type="submit" disabled={status === "sending"} style={{ width: "100%" }}>
            {status === "sending" ? "Sending..." : "Send message"}
          </button>
          {status === "sent" && <p style={styles.success}>Thanks — we'll be in touch soon.</p>}
          {status === "error" && <p style={styles.error}>Something went wrong. Try again in a moment.</p>}
        </form>
      </div>
    </section>
  );
}

const styles = {
  section: { padding: "100px 0" },
  grid: { display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 56, alignItems: "start" },
  heading: { fontSize: "2.1rem", margin: "16px 0 18px", lineHeight: 1.3 },
  copy: { color: "var(--text-dim)", lineHeight: 1.6, maxWidth: 420 },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: 28,
  },
  success: { color: "var(--lavender)", fontSize: "0.85rem" },
  error: { color: "#ff6b6b", fontSize: "0.85rem" },
};

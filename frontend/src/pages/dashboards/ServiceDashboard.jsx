import { useEffect, useState } from "react";
import api from "../../api/axios.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useConfirm } from "../../context/ConfirmContext.jsx";

export default function ServiceDashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [history, setHistory] = useState([]);

  const [recipient, setRecipient] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [notes, setNotes] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  const refreshHistory = () => {
    api.get("/outreach").then((res) => setHistory(res.data.history)).catch(() => {});
  };

  useEffect(refreshHistory, []);

  const deleteHistoryEntry = async (h) => {
    if (!(await confirm(`Delete this outreach record to ${h.recipientName || h.recipient}? This can't be undone.`))) return;
    try {
      await api.delete(`/outreach/${h._id}`);
      refreshHistory();
    } catch (err) {
      showToast(err.response?.data?.message || "Could not delete this record", "error");
    }
  };

  const handleGenerate = async () => {
    setError("");
    setResult("");
    if (!recipient) {
      setError("Enter the recipient's email address first");
      return;
    }
    setGenerating(true);
    try {
      const { data } = await api.post("/outreach/generate", { recipientName, notes });
      setSubject(data.draft.subject || "");
      setMessage(data.draft.message || "");
    } catch (err) {
      setError(err.response?.data?.message || "Could not generate a draft");
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setError("");
    setResult("");
    if (!recipient || !message.trim()) {
      setError("Recipient and message are required");
      return;
    }
    setSending(true);
    try {
      await api.post("/outreach/send", { recipient, recipientName, subject, message });
      setResult("Sent successfully.");
      setRecipient("");
      setRecipientName("");
      setNotes("");
      setSubject("");
      setMessage("");
      refreshHistory();
    } catch (err) {
      setError(err.response?.data?.message || "Could not send the message");
      refreshHistory(); // failed attempts are logged too — reflect that in the table
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="container" style={{ paddingTop: 120, paddingBottom: 80 }}>
      <span className="eyebrow">Service</span>
      <h1 style={{ margin: "12px 0 8px" }}>Welcome back, {user?.name}</h1>
      <p style={{ color: "var(--text-dim)", marginBottom: 32, maxWidth: 640 }}>
        Draft and send AI-assisted cold outreach emails for GivsiaTech. Every draft is grounded in the site's live
        pricing/portfolio — review and edit before sending.
      </p>

      <form onSubmit={handleSend} style={panel}>
        <div style={row}>
          <input
            placeholder="Recipient email *"
            type="email"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            style={{ flex: 1 }}
            required
          />
          <input
            placeholder="Recipient name (optional)"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>

        <textarea
          placeholder="Notes about this lead (optional) — e.g. runs a local bakery, asked about online ordering"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          style={textarea}
        />

        <button type="button" className="btn" onClick={handleGenerate} disabled={generating}>
          {generating ? "Generating..." : "Generate with AI"}
        </button>

        <input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />

        <textarea
          placeholder="Message — generate a draft above, or write your own"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={8}
          style={textarea}
        />

        {error && <p style={{ color: "#ff6b6b", fontSize: "0.85rem" }}>{error}</p>}
        {result && <p style={{ color: "#4ade80", fontSize: "0.85rem" }}>{result}</p>}

        <button className="btn btn-primary" type="submit" disabled={sending} style={{ width: "100%" }}>
          {sending ? "Sending..." : "Send email"}
        </button>
      </form>

      <h2 style={{ margin: "40px 0 16px", fontSize: "1.1rem" }}>Outreach history</h2>
      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Recipient</th>
              <th style={th}>Subject / message</th>
              <th style={th}>Status</th>
              <th style={th}>Sent by</th>
              <th style={th}>Date</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h._id}>
                <td style={td}>{h.recipientName ? `${h.recipientName} — ${h.recipient}` : h.recipient}</td>
                <td style={{ ...td, maxWidth: 320 }}>{h.subject ? `${h.subject}: ` : ""}{h.message}</td>
                <td style={td}>
                  <span style={{ color: h.status === "sent" ? "#4ade80" : "#ff6b6b" }}>{h.status}</span>
                  {h.error && <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>{h.error}</div>}
                </td>
                <td style={td}>{h.sentBy?.name || "—"}</td>
                <td style={td}>{new Date(h.createdAt).toLocaleString()}</td>
                <td style={td}>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: "6px 12px", fontSize: "0.75rem", color: "#ff6b6b", borderColor: "#5a2a2a" }}
                    onClick={() => deleteHistoryEntry(h)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr><td style={td} colSpan={6}>No outreach sent yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const panel = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 28,
  display: "flex",
  flexDirection: "column",
  gap: 14,
  maxWidth: 640,
};

const row = { display: "flex", gap: 10, flexWrap: "wrap" };
const textarea = { fontFamily: "inherit", resize: "vertical" };

const tableWrap = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, overflow: "auto" };
const table = { width: "100%", borderCollapse: "collapse" };
const th = { textAlign: "left", padding: "14px 18px", fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-dim)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" };
const td = { padding: "14px 18px", borderBottom: "1px solid var(--border)", fontSize: "0.85rem" };

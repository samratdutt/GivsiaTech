import { useEffect, useState } from "react";
import api from "../../../api/axios.js";
import { useToast } from "../../../context/ToastContext.jsx";
import { useConfirm } from "../../../context/ConfirmContext.jsx";
import { LEAD_STATUSES, WEBSITE_STATUSES, categoryLabel, statusMeta } from "../../../utils/bizLeadConstants.js";

export default function BizLeadDetail({ leadId, onClose, onChanged }) {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [lead, setLead] = useState(null);
  const [communications, setCommunications] = useState([]);
  const [noteText, setNoteText] = useState("");
  const [draft, setDraft] = useState(null); // { subject, message }
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

  const load = () => {
    api.get(`/bizleads/${leadId}`).then((res) => {
      setLead(res.data.lead);
      setCommunications(res.data.communications);
    }).catch(() => showToast("Could not load this lead", "error"));
  };

  useEffect(load, [leadId]);

  const patch = async (body) => {
    try {
      await api.patch(`/bizleads/${leadId}`, body);
      load();
      onChanged();
    } catch (err) {
      showToast(err.response?.data?.message || "Update failed", "error");
    }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    try {
      await api.post(`/bizleads/${leadId}/notes`, { text: noteText.trim() });
      setNoteText("");
      load();
    } catch {
      showToast("Could not add note", "error");
    }
  };

  const generate = async (kind) => {
    setGenerating(true);
    try {
      const { data } = await api.post(`/bizleads/${leadId}/generate-${kind}`);
      setDraft(data.draft);
    } catch (err) {
      showToast(err.response?.data?.message || "Generation failed", "error");
    } finally {
      setGenerating(false);
    }
  };

  const sendEmail = async () => {
    if (!draft?.message?.trim()) return;
    setSending(true);
    try {
      await api.post(`/bizleads/${leadId}/send-email`, draft);
      showToast("Email sent", "success");
      setDraft(null);
      load();
      onChanged();
    } catch (err) {
      showToast(err.response?.data?.message || "Send failed", "error");
    } finally {
      setSending(false);
    }
  };

  const deleteLead = async () => {
    if (!(await confirm(`Permanently delete "${lead.businessName}"? This can't be undone.`))) return;
    try {
      await api.delete(`/bizleads/${leadId}`);
      showToast("Lead deleted", "success");
      onChanged();
      onClose();
    } catch {
      showToast("Could not delete lead", "error");
    }
  };

  if (!lead) return null;
  const meta = statusMeta(lead.leadStatus);

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <h3 style={{ margin: 0 }}>{lead.businessName}</h3>
            <span style={{ ...styles.badge, borderColor: meta.color, color: meta.color }}>{meta.label}</span>
          </div>
          <button className="link-btn" onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        <section style={styles.section}>
          <h4 style={styles.sectionHeading}>Business info</h4>
          <div style={styles.infoGrid}>
            <Info label="Category" value={categoryLabel(lead.category)} />
            <Info label="Owner" value={lead.ownerName || "-"} />
            <Info label="Phone" value={(lead.phones || []).join(", ") || "-"} />
            <Info label="Email" value={lead.email || "-"} />
            <Info label="Address" value={lead.address || "-"} />
            <Info label="City / State / Country" value={[lead.city, lead.state, lead.country].filter(Boolean).join(", ") || "-"} />
            <Info label="Postal code" value={lead.postalCode || "-"} />
            <Info label="Rating" value={lead.rating ? `${lead.rating} (${lead.reviewCount || 0} reviews)` : "-"} />
            <Info label="Website status" value={lead.websiteStatus} />
            <Info label="AI confidence" value={`${lead.aiConfidenceScore}%`} />
            <Info label="Opportunity score" value={`${lead.opportunityScore}%`} />
            <Info label="Source" value={lead.source} />
            {lead.googleMapsLink && <Info label="Google Maps" value={<a href={lead.googleMapsLink} target="_blank" rel="noreferrer" style={{ color: "var(--lavender)" }}>Open link</a>} />}
            {lead.moduleType === "new-business" && (
              <>
                <Info label="Registration date" value={lead.registrationDate ? new Date(lead.registrationDate).toLocaleDateString() : "-"} />
                <Info label="Registration number" value={lead.registrationNumber || "-"} />
                <Info label="Directors" value={(lead.directors || []).join(", ") || "-"} />
              </>
            )}
          </div>
          {lead.description && <p style={styles.description}>{lead.description}</p>}
        </section>

        <section style={styles.section}>
          <h4 style={styles.sectionHeading}>Lead workflow</h4>
          <label style={styles.label}>Status</label>
          <select value={lead.leadStatus} onChange={(e) => patch({ leadStatus: e.target.value })}>
            {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <label style={styles.label}>Website status</label>
          <select value={lead.websiteStatus} onChange={(e) => patch({ websiteStatus: e.target.value })}>
            {WEBSITE_STATUSES.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
          <label style={styles.label}>Next follow-up</label>
          <input
            type="date"
            value={lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toISOString().slice(0, 10) : ""}
            onChange={(e) => patch({ nextFollowUpAt: e.target.value || null })}
          />
        </section>

        <section style={styles.section}>
          <h4 style={styles.sectionHeading}>AI outreach</h4>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button className="btn btn-ghost" onClick={() => generate("email")} disabled={generating}>Generate AI email</button>
            <button className="btn btn-ghost" onClick={() => generate("proposal")} disabled={generating}>Generate AI proposal</button>
          </div>
          {generating && <p style={styles.miniText}>Generating with AI...</p>}
          {draft && (
            <div style={styles.draftBox}>
              <label style={styles.label}>Subject</label>
              <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
              <label style={styles.label}>Message</label>
              <textarea rows={8} value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} style={{ resize: "vertical" }} />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="btn btn-primary" onClick={sendEmail} disabled={sending || !lead.email}>
                  {sending ? "Sending..." : lead.email ? "Send email" : "No email on file"}
                </button>
                <button className="btn btn-ghost" onClick={() => setDraft(null)}>Discard</button>
              </div>
            </div>
          )}
        </section>

        <section style={styles.section}>
          <h4 style={styles.sectionHeading}>Communication history</h4>
          {communications.length === 0 && <p style={styles.miniText}>No emails sent yet.</p>}
          {communications.map((c) => (
            <div key={c._id} style={styles.commRow}>
              <span style={{ color: c.status === "sent" ? "#4ade80" : "#ff6b6b" }}>{c.status}</span> — {c.subject || "(no subject)"}
              <span style={styles.miniText}> · {new Date(c.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </section>

        <section style={styles.section}>
          <h4 style={styles.sectionHeading}>Notes</h4>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a note..." style={{ flex: 1 }} />
            <button className="btn btn-ghost" onClick={addNote}>Add</button>
          </div>
          {(lead.notes || []).slice().reverse().map((n) => (
            <div key={n._id} style={styles.commRow}>
              {n.text}
              <span style={styles.miniText}> — {n.createdByName || n.createdBy?.name || "someone"}, {new Date(n.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </section>

        <section style={styles.section}>
          <h4 style={styles.sectionHeading}>Activity timeline</h4>
          {(lead.activityLog || []).slice().reverse().map((a) => (
            <div key={a._id} style={styles.commRow}>
              <strong style={{ textTransform: "capitalize" }}>{a.type.replace("-", " ")}</strong>: {a.detail}
              <span style={styles.miniText}> — {a.createdByName || a.createdBy?.name || "someone"}, {new Date(a.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </section>

        <button className="btn btn-ghost" style={{ color: "#ff6b6b" }} onClick={deleteLead}>Delete this lead</button>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div style={styles.infoLabel}>{label}</div>
      <div style={styles.infoValue}>{value}</div>
    </div>
  );
}

const styles = {
  backdrop: { position: "fixed", inset: 0, background: "rgba(5,4,10,0.72)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "flex-end", zIndex: 500 },
  drawer: { width: "100%", maxWidth: 620, height: "100%", background: "var(--surface)", borderLeft: "1px solid var(--border)", padding: 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  closeBtn: { fontSize: "1.4rem", background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer" },
  badge: { fontSize: "0.7rem", border: "1px solid", borderRadius: 999, padding: "2px 10px", display: "inline-block", marginTop: 6 },
  section: { borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 14 },
  sectionHeading: { margin: "0 0 10px", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-dim)" },
  infoGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 },
  infoLabel: { fontSize: "0.68rem", color: "var(--text-dim)", textTransform: "uppercase" },
  infoValue: { fontSize: "0.85rem", overflowWrap: "anywhere" },
  description: { fontSize: "0.85rem", color: "var(--text-dim)", marginTop: 10 },
  label: { fontSize: "0.78rem", color: "var(--text-dim)", display: "block", marginTop: 8 },
  draftBox: { background: "var(--bg-soft)", border: "1px solid var(--border)", borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 8 },
  miniText: { fontSize: "0.72rem", color: "var(--text-dim)" },
  commRow: { fontSize: "0.82rem", padding: "6px 0", borderBottom: "1px solid var(--border)" },
};

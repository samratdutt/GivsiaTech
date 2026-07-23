import { useEffect, useState, useCallback } from "react";
import api from "../../../api/axios.js";
import { useToast } from "../../../context/ToastContext.jsx";
import { useConfirm } from "../../../context/ConfirmContext.jsx";
import ValidatedInput from "../../../components/ValidatedInput.jsx";
import { isValidEmail } from "../../../utils/validators.js";
import {
  BIZ_LEAD_CATEGORIES, COUNTRIES, LEAD_STATUSES, WEBSITE_STATUSES, BUSINESS_SIZES,
  statusMeta, categoryLabel,
} from "../../../utils/bizLeadConstants.js";
import BizLeadAnalytics from "./BizLeadAnalytics.jsx";
import BizLeadDetail from "./BizLeadDetail.jsx";

const emptyFilters = {
  category: "", country: "", state: "", city: "", minRating: "", websiteStatus: "",
  leadStatus: "", minConfidence: "", recentDays: "", businessSize: "", search: "",
  hasEmail: false, hasContact: false,
};

const emptyManualLead = {
  businessName: "", category: "other", ownerName: "", phone: "", email: "",
  address: "", city: "", state: "", country: "India", postalCode: "",
  websiteStatus: "no-website", description: "",
};

async function downloadExport(params, format, showToast) {
  try {
    const res = await api.get("/bizleads/export", { params: { ...params, format }, responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch {
    showToast("Could not export leads right now", "error");
  }
}

export default function BizLeadsTab({ moduleType, title, subtitle, allowDiscovery }) {
  const { showToast } = useToast();
  const confirm = useConfirm();

  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const [detailId, setDetailId] = useState(null);
  const [showDiscover, setShowDiscover] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const queryParams = useCallback(() => {
    const p = { moduleType, page, limit: 25 };
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== "" && v !== false) p[k] = v;
    });
    return p;
  }, [moduleType, page, filters]);

  useEffect(() => {
    setLoading(true);
    api.get("/bizleads", { params: queryParams() })
      .then((res) => {
        setLeads(res.data.leads);
        setTotal(res.data.total);
        setPages(res.data.pages);
      })
      .catch(() => showToast("Could not load leads", "error"))
      .finally(() => setLoading(false));
  }, [queryParams, refreshTick]);

  const refresh = () => setRefreshTick((t) => t + 1);

  const updateFilter = (patch) => { setPage(1); setFilters((f) => ({ ...f, ...patch })); };
  const clearFilters = () => { setPage(1); setFilters(emptyFilters); };

  const toggleSelect = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleSelectAll = () => setSelected(selected.length === leads.length ? [] : leads.map((l) => l._id));

  const applyBulkStatus = async () => {
    if (!bulkStatus || !selected.length) return;
    await Promise.all(selected.map((id) => api.patch(`/bizleads/${id}`, { leadStatus: bulkStatus })));
    showToast(`Updated ${selected.length} lead(s)`, "success");
    setSelected([]);
    setBulkStatus("");
    refresh();
  };

  const bulkDelete = async () => {
    if (!selected.length) return;
    if (!(await confirm(`Permanently delete ${selected.length} lead(s)? This can't be undone.`))) return;
    await Promise.all(selected.map((id) => api.delete(`/bizleads/${id}`)));
    showToast("Deleted selected leads", "success");
    setSelected([]);
    refresh();
  };

  return (
    <div>
      <div style={styles.header}>
        <div>
          <h2 style={{ margin: 0 }}>{title}</h2>
          {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {allowDiscovery && (
            <button className="btn btn-primary" onClick={() => setShowDiscover(true)}>Discover via Google Places</button>
          )}
          <button className="btn btn-ghost" onClick={() => setShowImport(true)}>Import CSV</button>
          <button className="btn btn-ghost" onClick={() => setShowAdd(true)}>Add lead</button>
          <button className="btn btn-ghost" onClick={() => downloadExport(queryParams(), "csv", showToast)}>Export CSV</button>
          <button className="btn btn-ghost" onClick={() => downloadExport(queryParams(), "pdf", showToast)}>Export PDF</button>
        </div>
      </div>

      <BizLeadAnalytics moduleType={moduleType} refreshTick={refreshTick} />

      <div style={styles.filterBar}>
        <input placeholder="Search business name / description" value={filters.search} onChange={(e) => updateFilter({ search: e.target.value })} style={styles.filterInput} />
        <select value={filters.category} onChange={(e) => updateFilter({ category: e.target.value })} style={styles.filterInput}>
          <option value="">All categories</option>
          {BIZ_LEAD_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={filters.country} onChange={(e) => updateFilter({ country: e.target.value })} style={styles.filterInput}>
          <option value="">All countries</option>
          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input placeholder="State" value={filters.state} onChange={(e) => updateFilter({ state: e.target.value })} style={{ ...styles.filterInput, maxWidth: 130 }} />
        <input placeholder="City" value={filters.city} onChange={(e) => updateFilter({ city: e.target.value })} style={{ ...styles.filterInput, maxWidth: 130 }} />
        <select value={filters.websiteStatus} onChange={(e) => updateFilter({ websiteStatus: e.target.value })} style={styles.filterInput}>
          <option value="">Any website status</option>
          {WEBSITE_STATUSES.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
        </select>
        <select value={filters.leadStatus} onChange={(e) => updateFilter({ leadStatus: e.target.value })} style={styles.filterInput}>
          <option value="">Any lead status</option>
          {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={filters.businessSize} onChange={(e) => updateFilter({ businessSize: e.target.value })} style={styles.filterInput}>
          <option value="">Any size</option>
          {BUSINESS_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <input type="number" min="0" max="5" placeholder="Min rating" value={filters.minRating} onChange={(e) => updateFilter({ minRating: e.target.value })} style={{ ...styles.filterInput, maxWidth: 100 }} />
        <input type="number" min="0" max="100" placeholder="Min confidence %" value={filters.minConfidence} onChange={(e) => updateFilter({ minConfidence: e.target.value })} style={{ ...styles.filterInput, maxWidth: 130 }} />
        <select value={filters.recentDays} onChange={(e) => updateFilter({ recentDays: e.target.value })} style={styles.filterInput}>
          <option value="">Any time</option>
          <option value="1">Added today</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
        </select>
        <label style={styles.checkLabel}><input type="checkbox" checked={filters.hasEmail} onChange={(e) => updateFilter({ hasEmail: e.target.checked })} /> Has email</label>
        <label style={styles.checkLabel}><input type="checkbox" checked={filters.hasContact} onChange={(e) => updateFilter({ hasContact: e.target.checked })} /> Has phone</label>
        <button className="btn btn-ghost" onClick={clearFilters}>Clear filters</button>
      </div>

      {selected.length > 0 && (
        <div style={styles.bulkBar}>
          <span>{selected.length} selected</span>
          <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} style={styles.filterInput}>
            <option value="">Set status to...</option>
            {LEAD_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button className="btn btn-primary" onClick={applyBulkStatus} disabled={!bulkStatus}>Apply</button>
          <button className="btn btn-ghost" onClick={() => downloadExport({ ...queryParams() }, "csv", showToast)}>Export selection (all filtered)</button>
          <button className="btn btn-ghost" style={{ color: "#ff6b6b" }} onClick={bulkDelete}>Delete selected</button>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table className="admin-table" style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}><input type="checkbox" checked={leads.length > 0 && selected.length === leads.length} onChange={toggleSelectAll} /></th>
              <th style={styles.th}>Business</th>
              <th style={styles.th}>Category</th>
              <th style={styles.th}>Location</th>
              <th style={styles.th}>Rating</th>
              <th style={styles.th}>Website</th>
              <th style={styles.th}>Confidence</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Assigned</th>
              <th style={styles.th}>Added</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td style={styles.td} colSpan={10}>Loading...</td></tr>}
            {!loading && leads.length === 0 && <tr><td style={styles.td} colSpan={10}>No leads match these filters.</td></tr>}
            {!loading && leads.map((l) => {
              const meta = statusMeta(l.leadStatus);
              return (
                <tr key={l._id} style={{ cursor: "pointer" }}>
                  <td style={styles.td} onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.includes(l._id)} onChange={() => toggleSelect(l._id)} />
                  </td>
                  <td style={styles.td} onClick={() => setDetailId(l._id)}>
                    <strong>{l.businessName}</strong>
                    {l.email && <div style={styles.miniText}>{l.email}</div>}
                  </td>
                  <td style={styles.td} onClick={() => setDetailId(l._id)}>{categoryLabel(l.category)}</td>
                  <td style={styles.td} onClick={() => setDetailId(l._id)}>{[l.city, l.state, l.country].filter(Boolean).join(", ") || "-"}</td>
                  <td style={styles.td} onClick={() => setDetailId(l._id)}>{l.rating ? `${l.rating} (${l.reviewCount || 0})` : "-"}</td>
                  <td style={styles.td} onClick={() => setDetailId(l._id)}>{l.websiteStatus}</td>
                  <td style={styles.td} onClick={() => setDetailId(l._id)}>{l.aiConfidenceScore}%</td>
                  <td style={styles.td} onClick={() => setDetailId(l._id)}>
                    <span style={{ ...styles.badge, borderColor: meta.color, color: meta.color }}>{meta.label}</span>
                  </td>
                  <td style={styles.td} onClick={() => setDetailId(l._id)}>{l.assignedTo?.name || "-"}</td>
                  <td style={styles.td} onClick={() => setDetailId(l._id)}>{new Date(l.createdAt).toLocaleDateString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={styles.pagination}>
        <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
        <span>Page {page} of {pages} — {total} lead(s)</span>
        <button className="btn btn-ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>

      {detailId && (
        <BizLeadDetail leadId={detailId} onClose={() => setDetailId(null)} onChanged={refresh} />
      )}

      {showDiscover && (
        <DiscoverModal moduleType={moduleType} onClose={() => setShowDiscover(false)} onDone={() => { setShowDiscover(false); refresh(); }} showToast={showToast} />
      )}
      {showImport && (
        <ImportModal moduleType={moduleType} onClose={() => setShowImport(false)} onDone={() => { setShowImport(false); refresh(); }} showToast={showToast} />
      )}
      {showAdd && (
        <AddLeadModal moduleType={moduleType} onClose={() => setShowAdd(false)} onDone={() => { setShowAdd(false); refresh(); }} showToast={showToast} />
      )}
    </div>
  );
}

function DiscoverModal({ moduleType, onClose, onDone, showToast }) {
  const [form, setForm] = useState({ category: "other", city: "", state: "", country: "India" });
  const [running, setRunning] = useState(false);

  const run = async () => {
    if (!form.city.trim()) return showToast("City is required", "error");
    setRunning(true);
    try {
      const { data } = await api.post("/bizleads/discover", { ...form, moduleType });
      showToast(`Found ${data.created} new lead(s) (${data.skippedHasWebsite} already had a website, ${data.skippedDuplicate} duplicates skipped)`, "success");
      onDone();
    } catch (err) {
      showToast(err.response?.data?.message || "Discovery failed", "error");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Discover businesses via Google Places</h3>
        <p style={styles.miniText}>Uses Google's official Places API. Only businesses without a real website are kept.</p>
        <label style={styles.label}>Category</label>
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {BIZ_LEAD_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <label style={styles.label}>City *</label>
        <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="e.g. Mumbai" />
        <label style={styles.label}>State</label>
        <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="Optional" />
        <label style={styles.label}>Country</label>
        <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
        <div style={styles.modalActions}>
          <button className="btn btn-ghost" onClick={onClose} disabled={running}>Cancel</button>
          <button className="btn btn-primary" onClick={run} disabled={running}>{running ? "Searching..." : "Run discovery"}</button>
        </div>
      </div>
    </div>
  );
}

function ImportModal({ moduleType, onClose, onDone, showToast }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const run = async () => {
    if (!file) return showToast("Choose a CSV file first", "error");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("moduleType", moduleType);
      const { data } = await api.post("/bizleads/import-csv", formData, { headers: { "Content-Type": "multipart/form-data" } });
      showToast(`Imported ${data.created} lead(s), skipped ${data.skipped} (duplicate or missing name)`, "success");
      onDone();
    } catch (err) {
      showToast(err.response?.data?.message || "Import failed", "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Import leads from CSV</h3>
        <p style={styles.miniText}>
          Columns recognized (any order, header names are flexible): businessName, category, ownerName, phone,
          email, address, city, state, country, postalCode, googleMapsLink, rating, reviewCount, websiteStatus,
          websiteUrl, description, businessSize, leadStatus{moduleType === "new-business" && ", registrationDate, registrationNumber, directors"}.
        </p>
        <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files[0])} />
        <div style={styles.modalActions}>
          <button className="btn btn-ghost" onClick={onClose} disabled={uploading}>Cancel</button>
          <button className="btn btn-primary" onClick={run} disabled={uploading}>{uploading ? "Importing..." : "Import"}</button>
        </div>
      </div>
    </div>
  );
}

function AddLeadModal({ moduleType, onClose, onDone, showToast }) {
  const [form, setForm] = useState(emptyManualLead);
  const [saving, setSaving] = useState(false);

  const run = async () => {
    if (!form.businessName.trim()) return showToast("Business name is required", "error");
    setSaving(true);
    try {
      const { data } = await api.post("/bizleads", {
        ...form,
        moduleType,
        phones: form.phone ? [form.phone] : [],
      });
      showToast(data.possibleDuplicate ? "Added — note: a similar lead already exists" : "Lead added", "success");
      onDone();
    } catch (err) {
      showToast(err.response?.data?.message || "Could not add lead", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={{ ...styles.panel, maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Add a business lead manually</h3>
        <label style={styles.label}>Business name *</label>
        <input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
        <label style={styles.label}>Category</label>
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {BIZ_LEAD_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <label style={styles.label}>Owner name</label>
        <input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} />
        <label style={styles.label}>Phone</label>
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <label style={styles.label}>Email</label>
        <ValidatedInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} isValid={isValidEmail(form.email)} />
        <label style={styles.label}>Address</label>
        <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><label style={styles.label}>City</label><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div><label style={styles.label}>State</label><input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
          <div><label style={styles.label}>Country</label><input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
          <div><label style={styles.label}>Postal code</label><input value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} /></div>
        </div>
        <label style={styles.label}>Website status</label>
        <select value={form.websiteStatus} onChange={(e) => setForm({ ...form, websiteStatus: e.target.value })}>
          {WEBSITE_STATUSES.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
        </select>
        <label style={styles.label}>Description</label>
        <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ resize: "vertical" }} />
        <div style={styles.modalActions}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={run} disabled={saving}>{saving ? "Saving..." : "Add lead"}</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  subtitle: { color: "var(--text-dim)", fontSize: "0.85rem", margin: "4px 0 0", maxWidth: 560 },
  filterBar: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16, padding: 12, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 },
  filterInput: { padding: "6px 10px", fontSize: "0.82rem" },
  checkLabel: { display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", color: "var(--text-dim)" },
  bulkBar: { display: "flex", gap: 10, alignItems: "center", marginBottom: 12, padding: "10px 14px", background: "rgba(184,164,255,0.08)", border: "1px solid var(--border)", borderRadius: 8, flexWrap: "wrap" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 900 },
  th: { textAlign: "left", padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-dim)" },
  td: { padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: "0.85rem" },
  miniText: { fontSize: "0.72rem", color: "var(--text-dim)" },
  badge: { fontSize: "0.7rem", border: "1px solid", borderRadius: 999, padding: "2px 10px", whiteSpace: "nowrap" },
  pagination: { display: "flex", justifyContent: "center", alignItems: "center", gap: 16, marginTop: 16 },
  backdrop: { position: "fixed", inset: 0, background: "rgba(5,4,10,0.72)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500, padding: 20 },
  panel: { width: "100%", maxWidth: 480, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", gap: 8 },
  label: { fontSize: "0.78rem", color: "var(--text-dim)" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 },
};

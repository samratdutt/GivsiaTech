import { useEffect, useState, Fragment } from "react";
import api from "../../api/axios.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useConfirm } from "../../context/ConfirmContext.jsx";
import PasswordInput from "../../components/PasswordInput.jsx";
import { resolveImageUrl } from "../../utils/media.js";
import { downloadInvoice, INVOICE_AVAILABLE } from "../../utils/invoice.js";
import ValidatedInput from "../../components/ValidatedInput.jsx";
import { isValidEmail } from "../../utils/validators.js";
import BizLeadsTab from "./bizleads/BizLeadsTab.jsx";

// Uploads the picked (or dropped) file immediately and hands the resulting
// /uploads URL back to the caller — used for order pictures, manual-project
// pictures, and portfolio card background images. Drag-and-drop plus an
// upload progress bar make it obvious the file is actually going somewhere.
function ImageUploadField({ value, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  const upload = async (file) => {
    if (!file) return;
    setError("");
    setUploading(true);
    setProgress(0);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const { data } = await api.post("/uploads/image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (evt) => {
          if (evt.total) setProgress(Math.round((evt.loaded / evt.total) * 100));
        },
      });
      onUploaded(data.url);
    } catch (err) {
      setError(err.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleFile = (e) => {
    upload(e.target.files[0]);
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    upload(e.dataTransfer.files?.[0]);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      {value && (
        <div style={{ position: "relative" }}>
          <img
            key={value}
            src={resolveImageUrl(value)}
            alt=""
            className="upload-preview-img"
            style={{ width: 90, height: 60, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)", display: "block" }}
          />
          <button
            type="button"
            className="upload-remove-btn"
            onClick={() => onUploaded("")}
            title="Remove image"
            style={{
              position: "absolute", top: -8, right: -8, width: 22, height: 22, borderRadius: "50%",
              background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-dim)",
              fontSize: "0.7rem", lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
            }}
          >
            ✕
          </button>
        </div>
      )}
      <div style={{ minWidth: 200 }}>
        <label
          className={`upload-dropzone${dragging ? " upload-dropzone-active" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 14px", fontSize: "0.75rem", color: "var(--text-dim)" }}
        >
          {uploading ? `Uploading... ${progress}%` : value ? "Replace image (click or drag)" : "Drop image here, or click to choose"}
          <input type="file" accept="image/*" onChange={handleFile} disabled={uploading} style={{ display: "none" }} />
        </label>
        {uploading && (
          <div className="upload-progress-track" style={{ marginTop: 6 }}>
            <div className="upload-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        )}
        {error && <p style={{ fontSize: "0.72rem", color: "#ff6b6b", marginTop: 4 }}>{error}</p>}
      </div>
    </div>
  );
}

const TABS = ["overview", "orders", "renewals", "users", "messages", "pricing", "portfolio", "about", "transactions", "reviews", "activity", "security", "bizleads", "newbiz"];

// These two get a visually distinct "AI"-flavored button instead of the
// plain tab style — the spec calls for a clearly highlighted, dedicated
// entry point rather than blending in with the rest of the tab row.
const AI_TAB_LABELS = { bizleads: "AI Lead Finder", newbiz: "New Business Monitor" };

// Lets links like the homepage's "Start a project" (-> ?tab=orders for an
// admin) land directly on the right tab instead of always defaulting to
// Overview.
const initialTab = () => {
  const requested = new URLSearchParams(window.location.search).get("tab");
  return TABS.includes(requested) ? requested : "overview";
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState(initialTab);
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [leads, setLeads] = useState([]);
  const [pricingTiers, setPricingTiers] = useState([]);
  const [portfolioItems, setPortfolioItems] = useState([]);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [activity, setActivity] = useState([]);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [securitySummary, setSecuritySummary] = useState(null);
  const [securityEvents, setSecurityEvents] = useState([]);
  const [blockedIps, setBlockedIps] = useState([]);

  const clients = users.filter((u) => u.role === "client");

  const refreshAll = () => {
    api.get("/users/dashboard-summary").then((res) => setSummary(res.data)).catch(() => {});
    api.get("/users").then((res) => setUsers(res.data.users)).catch(() => {});
    api.get("/payments/orders").then((res) => setOrders(res.data.orders)).catch(() => {});
    api.get("/contact").then((res) => setLeads(res.data.messages)).catch(() => {});
    api.get("/pricing/all").then((res) => setPricingTiers(res.data.tiers)).catch(() => {});
    api.get("/portfolio/all").then((res) => setPortfolioItems(res.data.items)).catch(() => {});
    api.get("/company").then((res) => setCompanyInfo(res.data.info)).catch(() => {});
    api.get("/reviews").then((res) => setReviews(res.data.reviews)).catch(() => {});
    api.get("/activity").then((res) => setActivity(res.data.activity)).catch(() => {});
    api.get("/security/summary").then((res) => setSecuritySummary(res.data)).catch(() => {});
    api.get("/security/events").then((res) => setSecurityEvents(res.data.events)).catch(() => {});
    api.get("/security/blocked-ips").then((res) => setBlockedIps(res.data.blocked)).catch(() => {});
  };

  useEffect(refreshAll, []);

  return (
    <div className="container" style={{ paddingTop: 120, paddingBottom: 80 }}>
      <span className="eyebrow">Admin</span>
      <h1 style={{ margin: "12px 0 32px" }}>Welcome back, {user?.name}</h1>

      <div className="dashboard-tab-row" style={tabRow}>
        {TABS.filter((t) => !AI_TAB_LABELS[t]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={tab === t ? "btn btn-primary" : "btn btn-ghost"}
            style={{ textTransform: "capitalize" }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={aiTabRow}>
        {Object.entries(AI_TAB_LABELS).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="btn"
            style={{
              ...aiTabButton,
              ...(tab === t ? aiTabButtonActive : null),
            }}
          >
            <span style={aiBadge}>AI</span> {label}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview summary={summary} />}

      {tab === "orders" && (
        <OrdersTab
          orders={orders}
          clients={clients}
          expandedOrder={expandedOrder}
          setExpandedOrder={setExpandedOrder}
          refreshAll={refreshAll}
        />
      )}

      {tab === "renewals" && <RenewalsTab orders={orders} />}

      {tab === "users" && <UsersTab users={users} refreshAll={refreshAll} currentUserId={user?.id} />}

      {tab === "messages" && <LeadsTab leads={leads} refreshAll={refreshAll} />}

      {tab === "pricing" && <PricingTab tiers={pricingTiers} refreshAll={refreshAll} />}

      {tab === "portfolio" && <PortfolioTab items={portfolioItems} refreshAll={refreshAll} />}

      {tab === "about" && <AboutTab info={companyInfo} refreshAll={refreshAll} />}

      {tab === "transactions" && <TransactionsTab orders={orders} />}

      {tab === "reviews" && <ReviewsTab reviews={reviews} refreshAll={refreshAll} />}

      {tab === "activity" && <ActivityTab activity={activity} />}

      {tab === "security" && (
        <SecurityTab
          summary={securitySummary}
          events={securityEvents}
          blocked={blockedIps}
          refreshAll={refreshAll}
        />
      )}

      {tab === "bizleads" && (
        <BizLeadsTab
          moduleType="lead-finder"
          title="AI Business Lead Finder"
          subtitle="Discover businesses with no website via Google Places, or import/add leads manually. Draft AI outreach grounded in your real pricing and portfolio."
          allowDiscovery
        />
      )}

      {tab === "newbiz" && (
        <BizLeadsTab
          moduleType="new-business"
          title="New Business Monitor"
          subtitle="Newly registered businesses, sourced via CSV import from a licensed registry provider (e.g. Tofler, Probe42) or MCA's official bulk data — live scraping of government registries isn't ToS-compliant, so this module is import/manual-entry only."
        />
      )}
    </div>
  );
}

/* ---------------------------- Overview ---------------------------- */

function Overview({ summary }) {
  const stats = summary?.stats;
  return (
    <>
      <div style={cardGrid}>
        <StatCard label="Total users" value={stats?.totalUsers ?? "—"} />
        <StatCard label="Total orders" value={stats?.totalOrders ?? "—"} />
        <StatCard label="Active projects" value={stats?.activeProjects ?? "—"} />
        <StatCard label="New leads" value={stats?.newLeads ?? "—"} />
        <StatCard
          label="Revenue collected"
          value={stats ? `₹${((stats.totalRevenue || 0) / 100).toLocaleString("en-IN")}` : "—"}
        />
      </div>

      <h2 style={{ fontSize: "1.2rem", margin: "40px 0 16px" }}>Recent orders</h2>
      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Project</th>
              <th style={th}>Client</th>
              <th style={th}>Amount</th>
              <th style={th}>Payment</th>
              <th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {(summary?.recentOrders || []).map((o) => (
              <tr key={o._id}>
                <td style={td}>{o.title}</td>
                <td style={td}>{o.client?.name}</td>
                <td style={td}>₹{(o.amount / 100).toLocaleString("en-IN")}</td>
                <td style={td}>{o.paymentStatus}</td>
                <td style={td}>{o.status}</td>
              </tr>
            ))}
            {(!summary?.recentOrders || summary.recentOrders.length === 0) && (
              <tr><td style={td} colSpan={5}>No orders yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ----------------------------- Orders ------------------------------ */

function OrdersTab({ orders, clients, expandedOrder, setExpandedOrder, refreshAll }) {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [progressNote, setProgressNote] = useState("");
  const [progressStatus, setProgressStatus] = useState("");
  const [progressPercent, setProgressPercent] = useState("");
  const [detail, setDetail] = useState(null);

  const [publishForm, setPublishForm] = useState({ image: "", domain: "", hostingProvider: "", domainExpiryDate: "", hostingExpiryDate: "" });
  const [savingPublishDetails, setSavingPublishDetails] = useState(false);
  const [publishDetailsMessage, setPublishDetailsMessage] = useState("");

  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState({
    clientId: "", manualClientName: "", manualClientPhone: "", manualClientEmail: "",
    service: "website", title: "", description: "", techStack: "", amount: "",
    status: "completed", progressPercent: 100, paymentStatus: "paid", image: "",
  });
  const [manualError, setManualError] = useState("");
  const [creatingManual, setCreatingManual] = useState(false);

  const openOrder = async (orderId) => {
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
      setDetail(null);
      return;
    }
    setExpandedOrder(orderId);
    const { data } = await api.get(`/payments/orders/${orderId}`);
    setDetail(data.order);
    setPublishForm({
      image: data.order.image || "",
      domain: data.order.domain || "",
      hostingProvider: data.order.hostingProvider || "",
      domainExpiryDate: data.order.domainExpiryDate ? data.order.domainExpiryDate.slice(0, 10) : "",
      hostingExpiryDate: data.order.hostingExpiryDate ? data.order.hostingExpiryDate.slice(0, 10) : "",
    });
    setPublishDetailsMessage("");
  };

  const savePublishDetails = async (orderId) => {
    setSavingPublishDetails(true);
    setPublishDetailsMessage("");
    try {
      const { data } = await api.patch(`/payments/orders/${orderId}/publish-details`, publishForm);
      setDetail(data.order);
      setPublishDetailsMessage("Saved");
      refreshAll();
    } catch (err) {
      setPublishDetailsMessage(err.response?.data?.message || "Could not save");
    } finally {
      setSavingPublishDetails(false);
    }
  };

  const clearHostingDetails = async (orderId) => {
    if (!(await confirm("Clear domain, hosting provider, and renewal dates for this project?"))) return;
    const cleared = { domain: "", hostingProvider: "", domainExpiryDate: "", hostingExpiryDate: "" };
    setSavingPublishDetails(true);
    setPublishDetailsMessage("");
    try {
      const { data } = await api.patch(`/payments/orders/${orderId}/publish-details`, cleared);
      setDetail(data.order);
      setPublishForm({ ...publishForm, ...cleared });
      setPublishDetailsMessage("Cleared");
      refreshAll();
    } catch (err) {
      setPublishDetailsMessage(err.response?.data?.message || "Could not clear");
    } finally {
      setSavingPublishDetails(false);
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    await api.patch(`/payments/orders/${orderId}/status`, { status });
    refreshAll();
  };

  const submitProgress = async (orderId) => {
    if (!progressNote.trim()) return;
    await api.post(`/payments/orders/${orderId}/progress`, {
      note: progressNote,
      status: progressStatus || undefined,
      progressPercent: progressPercent === "" ? undefined : Number(progressPercent),
    });
    setProgressNote("");
    setProgressStatus("");
    setProgressPercent("");
    const { data } = await api.get(`/payments/orders/${orderId}`);
    setDetail(data.order);
    refreshAll();
  };

  const deleteOrder = async (o) => {
    if (!(await confirm(`Permanently delete "${o.title}"? This can't be undone.`))) return;
    try {
      await api.delete(`/payments/orders/${o._id}`);
      refreshAll();
    } catch (err) {
      showToast(err.response?.data?.message || "Could not delete project", "error");
    }
  };

  const publishToPortfolio = async (o) => {
    try {
      await api.post(`/portfolio/from-order/${o._id}`);
      refreshAll();
      showToast(`"${o.title}" was added to the Work section — head to the Portfolio tab to fine-tune it.`, "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Could not publish to portfolio", "error");
    }
  };

  const createManualOrder = async (e) => {
    e.preventDefault();
    setManualError("");
    setCreatingManual(true);
    try {
      await api.post("/payments/orders/manual", {
        ...manualForm,
        clientId: manualForm.clientId || undefined,
        techStack: manualForm.techStack.split(",").map((s) => s.trim()).filter(Boolean),
        amount: Number(manualForm.amount),
        progressPercent: Number(manualForm.progressPercent) || 0,
      });
      setManualForm({
        clientId: "", manualClientName: "", manualClientPhone: "", manualClientEmail: "",
        service: "website", title: "", description: "", techStack: "", amount: "",
        status: "completed", progressPercent: 100, paymentStatus: "paid", image: "",
      });
      setShowManualForm(false);
      refreshAll();
    } catch (err) {
      setManualError(err.response?.data?.message || "Could not add project");
    } finally {
      setCreatingManual(false);
    }
  };

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <button type="button" className="btn btn-ghost" onClick={() => setShowManualForm((v) => !v)}>
          {showManualForm ? "Cancel" : "+ Add project manually (offline deal)"}
        </button>
      </div>

      {showManualForm && (
        <form onSubmit={createManualOrder} style={{ ...card, marginBottom: 24, display: "flex", flexDirection: "column", gap: 12 }}>
          {manualError && <p style={{ color: "#ff6b6b", fontSize: "0.82rem" }}>{manualError}</p>}
          <p style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>
            Link an existing client, or leave that blank and fill in contact details for a walk-in with no account.
          </p>
          <div>
            <p style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginBottom: 6 }}>Project picture (used as the card background once published)</p>
            <ImageUploadField value={manualForm.image} onUploaded={(url) => setManualForm({ ...manualForm, image: url })} />
          </div>
          <select value={manualForm.clientId} onChange={(e) => setManualForm({ ...manualForm, clientId: e.target.value })}>
            <option value="">— No account (enter contact info below) —</option>
            {clients.map((c) => (
              <option key={c._id} value={c._id}>{c.name} ({c.email})</option>
            ))}
          </select>
          {!manualForm.clientId && (
            <div className="responsive-grid-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <input placeholder="Client name" value={manualForm.manualClientName} onChange={(e) => setManualForm({ ...manualForm, manualClientName: e.target.value })} required={!manualForm.clientId} />
              <input placeholder="Phone" value={manualForm.manualClientPhone} onChange={(e) => setManualForm({ ...manualForm, manualClientPhone: e.target.value })} />
              <input placeholder="Email" value={manualForm.manualClientEmail} onChange={(e) => setManualForm({ ...manualForm, manualClientEmail: e.target.value })} />
            </div>
          )}

          <div className="responsive-grid-form" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
            <select value={manualForm.service} onChange={(e) => setManualForm({ ...manualForm, service: e.target.value })}>
              <option value="website">Website</option>
              <option value="ai-automation">AI automation</option>
              <option value="saas">SaaS platform</option>
              <option value="app-development">App development</option>
              <option value="other">Other</option>
            </select>
            <input placeholder="Project title" value={manualForm.title} onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })} required />
          </div>
          <textarea
            placeholder="Description"
            rows={3}
            value={manualForm.description}
            onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
            style={{ resize: "vertical" }}
          />
          <input placeholder="Tech stack, comma separated (e.g. React, Node.js, MongoDB)" value={manualForm.techStack} onChange={(e) => setManualForm({ ...manualForm, techStack: e.target.value })} />

          <div className="responsive-grid-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
            <input type="number" placeholder="Amount (INR)" min={1} value={manualForm.amount} onChange={(e) => setManualForm({ ...manualForm, amount: e.target.value })} required />
            <select value={manualForm.status} onChange={(e) => setManualForm({ ...manualForm, status: e.target.value })}>
              <option value="completed">completed</option>
              <option value="in-progress">in-progress</option>
              <option value="pending">pending</option>
            </select>
            <input type="number" placeholder="Progress %" min={0} max={100} value={manualForm.progressPercent} onChange={(e) => setManualForm({ ...manualForm, progressPercent: e.target.value })} />
            <select value={manualForm.paymentStatus} onChange={(e) => setManualForm({ ...manualForm, paymentStatus: e.target.value })}>
              <option value="paid">paid</option>
              <option value="unpaid">unpaid</option>
            </select>
          </div>

          <button className="btn btn-primary" type="submit" disabled={creatingManual} style={{ alignSelf: "flex-start" }}>
            {creatingManual ? "Adding..." : "Add project"}
          </button>
        </form>
      )}

      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Image</th>
              <th style={th}>Project</th>
              <th style={th}>Client</th>
              <th style={th}>Amount</th>
              <th style={th}>Payment</th>
              <th style={th}>Status</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <Fragment key={o._id}>
                <tr>
                  <td style={td}>
                    {o.image ? (
                      <img src={resolveImageUrl(o.image)} alt="" style={{ width: 56, height: 38, objectFit: "cover", borderRadius: 4 }} />
                    ) : (
                      <span style={{ color: "var(--text-dim)", fontSize: "0.72rem" }}>—</span>
                    )}
                  </td>
                  <td style={td}>
                    {o.title}
                    {o.source === "offline" && <span style={offlineBadge}>offline</span>}
                  </td>
                  <td style={td}>{o.client?.name || o.manualClient?.name || "—"}</td>
                  <td style={td}>₹{(o.amount / 100).toLocaleString("en-IN")}</td>
                  <td style={td}>{o.paymentStatus}</td>
                  <td style={td}>
                    <select
                      value={o.status}
                      onChange={(e) => updateOrderStatus(o._id, e.target.value)}
                      style={{ padding: "6px 8px", fontSize: "0.8rem" }}
                    >
                      <option value="pending">pending</option>
                      <option value="in-progress">in-progress</option>
                      <option value="completed">completed</option>
                      <option value="cancelled">cancelled</option>
                    </select>
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: "0.75rem" }} onClick={() => openOrder(o._id)}>
                        {expandedOrder === o._id ? "Hide" : "Details"}
                      </button>
                      <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: "0.75rem" }} onClick={() => publishToPortfolio(o)}>
                        Publish to Work
                      </button>
                      {INVOICE_AVAILABLE.includes(o.paymentStatus) && (
                        <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: "0.75rem" }} onClick={() => downloadInvoice(o, showToast)}>
                          Invoice
                        </button>
                      )}
                      <button
                        className="btn btn-ghost"
                        style={{ padding: "6px 12px", fontSize: "0.75rem", color: "#ff6b6b", borderColor: "#5a2a2a" }}
                        onClick={() => deleteOrder(o)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedOrder === o._id && (
                  <tr>
                    <td style={{ ...td, background: "var(--bg-soft)" }} colSpan={7}>
                      {!detail ? (
                        <p style={{ color: "var(--text-dim)" }}>Loading...</p>
                      ) : (
                        <div className="glow-panel" style={{ padding: "16px 18px", borderRadius: 10, border: "1px solid var(--border)" }}>
                          <p style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginBottom: 10 }}>
                            Invoice {detail.invoiceNumber} &middot; {detail.description || "No description provided."}
                            {detail.techStack?.length > 0 && <> &middot; {detail.techStack.join(", ")}</>}
                          </p>

                          <div style={{ marginBottom: 14 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-dim)", marginBottom: 4 }}>
                              <span>Progress</span>
                              <span>{detail.progressPercent ?? 0}%</span>
                            </div>
                            <div className="progress-bar-track">
                              <div className="progress-bar-fill" style={{ width: `${detail.progressPercent ?? 0}%` }} />
                            </div>
                          </div>

                          <div style={{ marginBottom: 14 }}>
                            <p style={{ fontSize: "0.78rem", color: "var(--lavender)", marginBottom: 8 }}>Progress timeline</p>
                            {detail.progressUpdates?.length === 0 && (
                              <p style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>No updates posted yet.</p>
                            )}
                            {detail.progressUpdates?.slice().reverse().map((p) => (
                              <div key={p._id} style={timelineItem}>
                                <p style={{ fontSize: "0.85rem" }}>{p.note}</p>
                                <p style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                                  {p.postedBy?.name} &middot; {new Date(p.createdAt).toLocaleString()}
                                  {p.status && ` · marked ${p.status}`}
                                </p>
                              </div>
                            ))}
                          </div>

                          <div className="responsive-grid-form" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 90px auto", gap: 8 }}>
                            <input
                              placeholder="Post a progress update visible to the client..."
                              value={progressNote}
                              onChange={(e) => setProgressNote(e.target.value)}
                            />
                            <select
                              value={progressStatus}
                              onChange={(e) => setProgressStatus(e.target.value)}
                            >
                              <option value="">No status change</option>
                              <option value="pending">pending</option>
                              <option value="in-progress">in-progress</option>
                              <option value="completed">completed</option>
                              <option value="cancelled">cancelled</option>
                            </select>
                            <input
                              type="number"
                              placeholder="%"
                              min={0}
                              max={100}
                              value={progressPercent}
                              onChange={(e) => setProgressPercent(e.target.value)}
                            />
                            <button className="btn btn-primary" onClick={() => submitProgress(o._id)}>Post</button>
                          </div>

                          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                            <p style={{ fontSize: "0.78rem", color: "var(--lavender)", marginBottom: 8 }}>
                              Publish details — required before this project can go live in the Work section
                            </p>
                            <div style={{ marginBottom: 10 }}>
                              <ImageUploadField
                                value={publishForm.image}
                                onUploaded={(url) => setPublishForm({ ...publishForm, image: url })}
                              />
                            </div>
                            <div className="responsive-grid-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                              <input
                                placeholder="Domain (e.g. example.com)"
                                value={publishForm.domain}
                                onChange={(e) => setPublishForm({ ...publishForm, domain: e.target.value })}
                              />
                              <input
                                placeholder="Hosting provider"
                                value={publishForm.hostingProvider}
                                onChange={(e) => setPublishForm({ ...publishForm, hostingProvider: e.target.value })}
                              />
                            </div>
                            <div className="responsive-grid-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.72rem", color: "var(--text-dim)" }}>
                                Domain renewal date
                                <input
                                  type="date"
                                  value={publishForm.domainExpiryDate}
                                  onChange={(e) => setPublishForm({ ...publishForm, domainExpiryDate: e.target.value })}
                                />
                              </label>
                              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: "0.72rem", color: "var(--text-dim)" }}>
                                Hosting renewal date
                                <input
                                  type="date"
                                  value={publishForm.hostingExpiryDate}
                                  onChange={(e) => setPublishForm({ ...publishForm, hostingExpiryDate: e.target.value })}
                                />
                              </label>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                disabled={savingPublishDetails}
                                onClick={() => savePublishDetails(o._id)}
                              >
                                {savingPublishDetails ? "Saving..." : "Save publish details"}
                              </button>
                              {(detail.domain || detail.hostingProvider || detail.domainExpiryDate || detail.hostingExpiryDate) && (
                                <button
                                  type="button"
                                  className="btn btn-ghost"
                                  style={{ color: "#ff6b6b", borderColor: "#5a2a2a" }}
                                  disabled={savingPublishDetails}
                                  onClick={() => clearHostingDetails(o._id)}
                                >
                                  Clear domain &amp; hosting
                                </button>
                              )}
                              {publishDetailsMessage && (
                                <span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>{publishDetailsMessage}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {orders.length === 0 && (
              <tr><td style={td} colSpan={7}>No orders yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ---------------------------- Renewals ------------------------------ */
// Read-only monitoring view over the domain/hosting details admin recorded
// on each order pre-publish, sorted so the soonest-expiring renewal is on
// top and anything within 30 days (or already past) is flagged.

const DAY_MS = 24 * 60 * 60 * 1000;

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / DAY_MS);
}

function RenewalDate({ label, date }) {
  if (!date) return <span style={{ color: "var(--text-dim)" }}>{label}: —</span>;
  const days = daysUntil(date);
  const color = days < 0 ? "#ff6b6b" : days <= 30 ? "#e0b04a" : "var(--text)";
  const note = days < 0 ? `overdue ${Math.abs(days)}d` : `${days}d left`;
  return (
    <span style={{ color }}>
      {label}: {new Date(date).toLocaleDateString()} <span style={{ fontSize: "0.7rem" }}>({note})</span>
    </span>
  );
}

function RenewalsTab({ orders }) {
  const monitored = orders
    .filter((o) => o.domain || o.hostingProvider || o.domainExpiryDate || o.hostingExpiryDate)
    .slice()
    .sort((a, b) => {
      const soonest = (o) => {
        const d = [o.domainExpiryDate, o.hostingExpiryDate].filter(Boolean).map((d) => new Date(d).getTime());
        return d.length ? Math.min(...d) : Infinity;
      };
      return soonest(a) - soonest(b);
    });

  return (
    <div style={tableWrap}>
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Project</th>
            <th style={th}>Client</th>
            <th style={th}>Domain</th>
            <th style={th}>Hosting</th>
            <th style={th}>Domain renewal</th>
            <th style={th}>Hosting renewal</th>
          </tr>
        </thead>
        <tbody>
          {monitored.map((o) => (
            <tr key={o._id}>
              <td style={td}>{o.title}</td>
              <td style={td}>{o.client?.name || o.manualClient?.name || "—"}</td>
              <td style={td}>{o.domain || "—"}</td>
              <td style={td}>{o.hostingProvider || "—"}</td>
              <td style={td}><RenewalDate label="Domain" date={o.domainExpiryDate} /></td>
              <td style={td}><RenewalDate label="Hosting" date={o.hostingExpiryDate} /></td>
            </tr>
          ))}
          {monitored.length === 0 && (
            <tr><td style={td} colSpan={6}>No domain/hosting details recorded yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------- Transactions ---------------------------- */
// Every payment ever recorded on an order, in one ledger — Order already
// stores the essential fields (Razorpay IDs, amount, status, invoice,
// timestamps), so this is a read-only view over that same data rather
// than a separate system to keep in sync.

function TransactionsTab({ orders }) {
  const transactions = orders.filter((o) => o.paymentStatus !== "unpaid" || o.razorpayPaymentId);
  const totalPaid = transactions.filter((o) => o.paymentStatus === "paid").reduce((sum, o) => sum + o.amount, 0);

  return (
    <>
      <div style={{ ...cardGrid, marginBottom: 24 }}>
        <StatCard label="Total transactions" value={transactions.length} />
        <StatCard label="Total collected" value={`₹${(totalPaid / 100).toLocaleString("en-IN")}`} />
      </div>
      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Date</th>
              <th style={th}>Project</th>
              <th style={th}>Client</th>
              <th style={th}>Amount</th>
              <th style={th}>Status</th>
              <th style={th}>Razorpay order</th>
              <th style={th}>Razorpay payment</th>
              <th style={th}>Invoice</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((o) => (
              <tr key={o._id}>
                <td style={td}>{new Date(o.createdAt).toLocaleDateString()}</td>
                <td style={td}>{o.title}</td>
                <td style={td}>{o.client?.name || o.manualClient?.name || "—"}</td>
                <td style={td}>₹{(o.amount / 100).toLocaleString("en-IN")}</td>
                <td style={td}>{o.paymentStatus}</td>
                <td style={{ ...td, fontFamily: "monospace", fontSize: "0.72rem" }}>{o.razorpayOrderId || "—"}</td>
                <td style={{ ...td, fontFamily: "monospace", fontSize: "0.72rem" }}>{o.razorpayPaymentId || "—"}</td>
                <td style={td}>{o.invoiceNumber || "—"}</td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr><td style={td} colSpan={8}>No transactions yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* --------------------------- Reviews (moderation) --------------------------- */

function ReviewsTab({ reviews, refreshAll }) {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const average = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

  const deleteReview = async (r) => {
    if (!(await confirm(`Delete this review by ${r.client?.name || "a client"}? This can't be undone.`))) return;
    try {
      await api.delete(`/reviews/${r._id}`);
      refreshAll();
    } catch (err) {
      showToast(err.response?.data?.message || "Could not delete review", "error");
    }
  };

  return (
    <>
      <div style={{ ...cardGrid, marginBottom: 24 }}>
        <StatCard label="Average rating" value={`${average.toFixed(1)} / 5`} />
        <StatCard label="Total reviews" value={reviews.length} />
      </div>
      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Client</th>
              <th style={th}>Rating</th>
              <th style={th}>Comment</th>
              <th style={th}>Date</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((r) => (
              <tr key={r._id}>
                <td style={td}>{r.client?.name || "—"}</td>
                <td style={td}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</td>
                <td style={{ ...td, maxWidth: 320 }}>{r.comment}</td>
                <td style={td}>{new Date(r.createdAt).toLocaleDateString()}</td>
                <td style={td}>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: "6px 12px", fontSize: "0.75rem", color: "#ff6b6b", borderColor: "#5a2a2a" }}
                    onClick={() => deleteReview(r)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {reviews.length === 0 && (
              <tr><td style={td} colSpan={5}>No reviews yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ------------------------------ Users ------------------------------ */

function UsersTab({ users, refreshAll, currentUserId }) {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "client" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const createUser = async (e) => {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      await api.post("/users", form);
      setForm({ name: "", email: "", password: "", role: "client" });
      refreshAll();
    } catch (err) {
      setError(err.response?.data?.message || "Could not create user");
    } finally {
      setCreating(false);
    }
  };

  const setUserRole = async (userId, role) => {
    try {
      await api.patch(`/users/${userId}/role`, { role });
      refreshAll();
    } catch (err) {
      showToast(err.response?.data?.message || "Could not update role", "error");
    }
  };

  const toggleUserActive = async (u) => {
    try {
      await api.patch(`/users/${u._id}/status`, { isActive: !u.isActive });
      refreshAll();
    } catch (err) {
      showToast(err.response?.data?.message || "Could not update status", "error");
    }
  };

  const deleteUser = async (u) => {
    if (!(await confirm(`Permanently delete ${u.name}? This can't be undone.`))) return;
    try {
      await api.delete(`/users/${u._id}`);
      refreshAll();
    } catch (err) {
      showToast(err.response?.data?.message || "Could not delete user", "error");
    }
  };

  return (
    <>
      <form onSubmit={createUser} style={createForm}>
        <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <ValidatedInput placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required isValid={isValidEmail(form.email)} />
        <PasswordInput placeholder="Temp password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="client">client</option>
          <option value="admin">admin</option>
        </select>
        <button className="btn btn-primary" type="submit" disabled={creating}>
          {creating ? "Adding..." : "Add user"}
        </button>
      </form>
      {error && <p style={{ color: "#ff6b6b", fontSize: "0.82rem", marginBottom: 16 }}>{error}</p>}

      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Email</th>
              <th style={th}>Role</th>
              <th style={th}>Status</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id}>
                <td style={td}>{u.name}</td>
                <td style={td}>{u.email}</td>
                <td style={td}>
                  <select
                    value={u.role}
                    onChange={(e) => setUserRole(u._id, e.target.value)}
                    style={{ padding: "6px 8px", fontSize: "0.8rem" }}
                  >
                    <option value="client">client</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td style={td}>{u.isActive ? "Active" : "Inactive"}</td>
                <td style={td}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: "0.75rem" }} onClick={() => toggleUserActive(u)}>
                      {u.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: "6px 12px", fontSize: "0.75rem", color: "#ff6b6b", borderColor: "#5a2a2a" }}
                      onClick={() => deleteUser(u)}
                      disabled={u._id === currentUserId}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ------------------------------ Leads ------------------------------ */

function LeadsTab({ leads, refreshAll }) {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const setLeadStatus = async (leadId, status) => {
    await api.patch(`/contact/${leadId}/status`, { status });
    refreshAll();
  };

  const deleteLead = async (l) => {
    if (!(await confirm(`Permanently delete this message from ${l.name}? This can't be undone.`))) return;
    try {
      await api.delete(`/contact/${l._id}`);
      refreshAll();
    } catch (err) {
      showToast(err.response?.data?.message || "Could not delete message", "error");
    }
  };

  return (
    <div style={tableWrap}>
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Name</th>
            <th style={th}>Email</th>
            <th style={th}>Source</th>
            <th style={th}>Message</th>
            <th style={th}>Status</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l._id}>
              <td style={td}>{l.name}</td>
              <td style={td}>{l.email}</td>
              <td style={td}>
                {l.client ? (
                  <span style={offlineBadge}>customer{l.relatedOrder ? `: ${l.relatedOrder.title}` : ""}</span>
                ) : (
                  l.serviceInterest
                )}
              </td>
              <td style={{ ...td, maxWidth: 280 }}>{l.message}</td>
              <td style={td}>
                <select
                  value={l.status}
                  onChange={(e) => setLeadStatus(l._id, e.target.value)}
                  style={{ padding: "6px 8px", fontSize: "0.8rem" }}
                >
                  <option value="new">new</option>
                  <option value="contacted">contacted</option>
                  <option value="closed">closed</option>
                </select>
              </td>
              <td style={td}>
                <button
                  className="btn btn-ghost"
                  style={{ padding: "6px 12px", fontSize: "0.75rem", color: "#ff6b6b", borderColor: "#5a2a2a" }}
                  onClick={() => deleteLead(l)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {leads.length === 0 && (
            <tr><td style={td} colSpan={6}>No leads yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------ Pricing ------------------------------ */

function PricingTab({ tiers, refreshAll }) {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState({ name: "", price: "", desc: "", features: "", featured: false, order: 0, basePrice: "", serviceKey: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const createTier = async (e) => {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      await api.post("/pricing", {
        ...form,
        order: Number(form.order) || 0,
        features: form.features.split(",").map((f) => f.trim()).filter(Boolean),
      });
      setForm({ name: "", price: "", desc: "", features: "", featured: false, order: 0, basePrice: "", serviceKey: "" });
      refreshAll();
    } catch (err) {
      setError(err.response?.data?.message || "Could not create pricing tier");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (t) => {
    setEditingId(t._id);
    setEditForm({
      name: t.name,
      price: t.price,
      desc: t.desc,
      features: t.features.join(", "),
      featured: t.featured,
      order: t.order,
      basePrice: t.basePrice ?? "",
      serviceKey: t.serviceKey || "",
    });
  };

  const saveEdit = async (id) => {
    try {
      await api.patch(`/pricing/${id}`, {
        ...editForm,
        order: Number(editForm.order) || 0,
        features: editForm.features.split(",").map((f) => f.trim()).filter(Boolean),
      });
      setEditingId(null);
      refreshAll();
    } catch (err) {
      showToast(err.response?.data?.message || "Could not update pricing tier", "error");
    }
  };

  const toggleActive = async (t) => {
    try {
      await api.patch(`/pricing/${t._id}`, { isActive: !t.isActive });
      refreshAll();
    } catch (err) {
      showToast(err.response?.data?.message || "Could not update pricing tier", "error");
    }
  };

  const deleteTier = async (t) => {
    if (!(await confirm(`Delete pricing tier "${t.name}"? This can't be undone.`))) return;
    try {
      await api.delete(`/pricing/${t._id}`);
      refreshAll();
    } catch (err) {
      showToast(err.response?.data?.message || "Could not delete pricing tier", "error");
    }
  };

  return (
    <>
      <form onSubmit={createTier} className="responsive-grid-form" style={{ ...createForm, gridTemplateColumns: "1fr 1fr 1.4fr 1.4fr auto auto auto" }}>
        <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input placeholder="Price (e.g. From ₹25,000)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
        <input placeholder="Short description" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} required />
        <input placeholder="Features, comma separated" value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} />
        <input type="number" placeholder="Order" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} style={{ width: 80 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", color: "var(--text-dim)", whiteSpace: "nowrap" }}>
          <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} style={{ width: "auto" }} />
          Featured
        </label>
        <button className="btn btn-primary" type="submit" disabled={creating}>
          {creating ? "Adding..." : "Add tier"}
        </button>
        <input
          type="number"
          placeholder="Base price ₹ (for the request-project floor)"
          value={form.basePrice}
          onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
          style={{ gridColumn: "span 2" }}
        />
        <select value={form.serviceKey} onChange={(e) => setForm({ ...form, serviceKey: e.target.value })} style={{ gridColumn: "span 2" }}>
          <option value="">No linked service (no price floor)</option>
          <option value="website">Website</option>
          <option value="ai-automation">AI Automation</option>
          <option value="saas">SaaS Platform</option>
          <option value="app-development">App Development</option>
        </select>
      </form>
      <p style={{ color: "var(--text-dim)", fontSize: "0.78rem", margin: "-8px 0 16px" }}>
        Linking a tier to a service and setting its base price lets clients lower their own request amount by up to
        ₹5,000 below it, but no further — enforced on the server regardless of what the form allows.
      </p>
      {error && <p style={{ color: "#ff6b6b", fontSize: "0.82rem", marginBottom: 16 }}>{error}</p>}

      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Price</th>
              <th style={th}>Description</th>
              <th style={th}>Features</th>
              <th style={th}>Featured</th>
              <th style={th}>Order</th>
              <th style={th}>Base price / floor</th>
              <th style={th}>Status</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((t) => (
              <tr key={t._id}>
                {editingId === t._id ? (
                  <>
                    <td style={td}><input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></td>
                    <td style={td}><input value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} /></td>
                    <td style={td}><input value={editForm.desc} onChange={(e) => setEditForm({ ...editForm, desc: e.target.value })} /></td>
                    <td style={td}><input value={editForm.features} onChange={(e) => setEditForm({ ...editForm, features: e.target.value })} /></td>
                    <td style={td}>
                      <input type="checkbox" checked={editForm.featured} onChange={(e) => setEditForm({ ...editForm, featured: e.target.checked })} style={{ width: "auto" }} />
                    </td>
                    <td style={td}><input type="number" value={editForm.order} onChange={(e) => setEditForm({ ...editForm, order: e.target.value })} style={{ width: 60 }} /></td>
                    <td style={td}>
                      <input
                        type="number"
                        placeholder="Base ₹"
                        value={editForm.basePrice}
                        onChange={(e) => setEditForm({ ...editForm, basePrice: e.target.value })}
                        style={{ width: 90, marginBottom: 6 }}
                      />
                      <select value={editForm.serviceKey} onChange={(e) => setEditForm({ ...editForm, serviceKey: e.target.value })} style={{ fontSize: "0.75rem" }}>
                        <option value="">No linked service</option>
                        <option value="website">Website</option>
                        <option value="ai-automation">AI Automation</option>
                        <option value="saas">SaaS Platform</option>
                        <option value="app-development">App Development</option>
                      </select>
                    </td>
                    <td style={td}>{t.isActive ? "Active" : "Inactive"}</td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn-primary" style={{ padding: "6px 12px", fontSize: "0.75rem" }} onClick={() => saveEdit(t._id)}>Save</button>
                        <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: "0.75rem" }} onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={td}>{t.name}</td>
                    <td style={td}>{t.price}</td>
                    <td style={{ ...td, maxWidth: 220 }}>{t.desc}</td>
                    <td style={{ ...td, maxWidth: 260 }}>{t.features.join(", ")}</td>
                    <td style={td}>{t.featured ? "Yes" : "—"}</td>
                    <td style={td}>{t.order}</td>
                    <td style={td}>
                      {t.basePrice ? (
                        <>
                          ₹{t.basePrice.toLocaleString("en-IN")}
                          {t.serviceKey && <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>floor: ₹{(t.basePrice - 5000).toLocaleString("en-IN")} ({t.serviceKey})</div>}
                        </>
                      ) : "—"}
                    </td>
                    <td style={td}>{t.isActive ? "Active" : "Inactive"}</td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: "0.75rem" }} onClick={() => startEdit(t)}>Edit</button>
                        <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: "0.75rem" }} onClick={() => toggleActive(t)}>
                          {t.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: "6px 12px", fontSize: "0.75rem", color: "#ff6b6b", borderColor: "#5a2a2a" }}
                          onClick={() => deleteTier(t)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {tiers.length === 0 && (
              <tr><td style={td} colSpan={9}>No pricing tiers yet — add one above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ------------------------------ Portfolio ------------------------------ */
// Feeds both the "Work" section on the site and Givi's chat grounding for
// "what have you built" questions — editing here updates both at once.

function PortfolioTab({ items, refreshAll }) {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState({ title: "", tag: "", desc: "", stack: "", order: 0, image: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const createItem = async (e) => {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      await api.post("/portfolio", { ...form, order: Number(form.order) || 0 });
      setForm({ title: "", tag: "", desc: "", stack: "", order: 0, image: "" });
      refreshAll();
    } catch (err) {
      setError(err.response?.data?.message || "Could not create portfolio item");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (p) => {
    setEditingId(p._id);
    setEditForm({ title: p.title, tag: p.tag, desc: p.desc, stack: p.stack || "", order: p.order, image: p.image || "" });
  };

  const saveEdit = async (id) => {
    try {
      await api.patch(`/portfolio/${id}`, { ...editForm, order: Number(editForm.order) || 0 });
      setEditingId(null);
      refreshAll();
    } catch (err) {
      showToast(err.response?.data?.message || "Could not update portfolio item", "error");
    }
  };

  const toggleActive = async (p) => {
    try {
      await api.patch(`/portfolio/${p._id}`, { isActive: !p.isActive });
      refreshAll();
    } catch (err) {
      showToast(err.response?.data?.message || "Could not update portfolio item", "error");
    }
  };

  const deleteItem = async (p) => {
    if (!(await confirm(`Delete portfolio item "${p.title}"? This can't be undone.`))) return;
    try {
      await api.delete(`/portfolio/${p._id}`);
      refreshAll();
    } catch (err) {
      showToast(err.response?.data?.message || "Could not delete portfolio item", "error");
    }
  };

  return (
    <>
      <form onSubmit={createItem} style={{ ...card, marginBottom: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <p style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginBottom: 6 }}>Card background image</p>
          <ImageUploadField value={form.image} onUploaded={(url) => setForm({ ...form, image: url })} />
        </div>
        <div className="responsive-grid-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.6fr 1.2fr auto", gap: 12 }}>
          <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <input placeholder="Tag (e.g. SaaS, Coming soon)" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} required />
          <input placeholder="Description" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} required />
          <input placeholder="Stack (comma separated)" value={form.stack} onChange={(e) => setForm({ ...form, stack: e.target.value })} />
          <input type="number" placeholder="Order" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value })} style={{ width: 80 }} />
        </div>
        <button className="btn btn-primary" type="submit" disabled={creating} style={{ alignSelf: "flex-start" }}>
          {creating ? "Adding..." : "Add item"}
        </button>
      </form>
      {error && <p style={{ color: "#ff6b6b", fontSize: "0.82rem", marginBottom: 16 }}>{error}</p>}

      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Image</th>
              <th style={th}>Title</th>
              <th style={th}>Tag</th>
              <th style={th}>Description</th>
              <th style={th}>Stack</th>
              <th style={th}>Order</th>
              <th style={th}>Status</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p._id}>
                {editingId === p._id ? (
                  <>
                    <td style={td}>
                      <ImageUploadField value={editForm.image} onUploaded={(url) => setEditForm({ ...editForm, image: url })} />
                    </td>
                    <td style={td}><input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} /></td>
                    <td style={td}><input value={editForm.tag} onChange={(e) => setEditForm({ ...editForm, tag: e.target.value })} /></td>
                    <td style={td}><input value={editForm.desc} onChange={(e) => setEditForm({ ...editForm, desc: e.target.value })} /></td>
                    <td style={td}><input value={editForm.stack} onChange={(e) => setEditForm({ ...editForm, stack: e.target.value })} /></td>
                    <td style={td}><input type="number" value={editForm.order} onChange={(e) => setEditForm({ ...editForm, order: e.target.value })} style={{ width: 60 }} /></td>
                    <td style={td}>{p.isActive ? "Active" : "Inactive"}</td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn-primary" style={{ padding: "6px 12px", fontSize: "0.75rem" }} onClick={() => saveEdit(p._id)}>Save</button>
                        <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: "0.75rem" }} onClick={() => setEditingId(null)}>Cancel</button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={td}>
                      {p.image ? (
                        <img src={resolveImageUrl(p.image)} alt="" style={{ width: 56, height: 38, objectFit: "cover", borderRadius: 4 }} />
                      ) : (
                        <span style={{ color: "var(--text-dim)", fontSize: "0.72rem" }}>—</span>
                      )}
                    </td>
                    <td style={td}>{p.title}</td>
                    <td style={td}>{p.tag}</td>
                    <td style={{ ...td, maxWidth: 260 }}>{p.desc}</td>
                    <td style={{ ...td, maxWidth: 180 }}>{p.stack}</td>
                    <td style={td}>{p.order}</td>
                    <td style={td}>{p.isActive ? "Active" : "Inactive"}</td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: "0.75rem" }} onClick={() => startEdit(p)}>Edit</button>
                        <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: "0.75rem" }} onClick={() => toggleActive(p)}>
                          {p.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: "6px 12px", fontSize: "0.75rem", color: "#ff6b6b", borderColor: "#5a2a2a" }}
                          onClick={() => deleteItem(p)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td style={td} colSpan={8}>No portfolio items yet — add one above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* -------------------------------- About -------------------------------- */
// Feeds both the "About" section on the site and Givi's chat grounding for
// "tell me about your company" questions.

function AboutTab({ info, refreshAll }) {
  const [form, setForm] = useState({ heading: "", description: "", stats: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (info) setForm({ heading: info.heading, description: info.description, stats: info.stats });
  }, [info]);

  const updateStat = (i, field, value) => {
    const next = [...form.stats];
    next[i] = { ...next[i], [field]: value };
    setForm({ ...form, stats: next });
  };

  const addStat = () => setForm({ ...form, stats: [...form.stats, { value: "", label: "" }] });
  const removeStat = (i) => setForm({ ...form, stats: form.stats.filter((_, idx) => idx !== i) });

  const save = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    try {
      await api.patch("/company", form);
      setMessage("Saved");
      refreshAll();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save company info");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} style={{ ...tableWrap, padding: 24, display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
      {error && <p style={{ color: "#ff6b6b", fontSize: "0.82rem" }}>{error}</p>}
      {message && <p style={{ color: "#4ade80", fontSize: "0.82rem" }}>{message}</p>}

      <label style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>Heading</label>
      <input value={form.heading} onChange={(e) => setForm({ ...form, heading: e.target.value })} required />

      <label style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>Description</label>
      <textarea
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        rows={4}
        required
        style={{ resize: "vertical" }}
      />

      <label style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>Stats</label>
      {form.stats.map((s, i) => (
        <div key={i} style={{ display: "flex", gap: 8 }}>
          <input placeholder="Value (e.g. 5)" value={s.value} onChange={(e) => updateStat(i, "value", e.target.value)} style={{ width: 100 }} />
          <input placeholder="Label (e.g. Founding team)" value={s.label} onChange={(e) => updateStat(i, "label", e.target.value)} style={{ flex: 1 }} />
          <button type="button" className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: "0.75rem", color: "#ff6b6b", borderColor: "#5a2a2a" }} onClick={() => removeStat(i)}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-ghost" style={{ alignSelf: "flex-start" }} onClick={addStat}>
        + Add stat
      </button>

      <button className="btn btn-primary" type="submit" disabled={saving} style={{ alignSelf: "flex-start", marginTop: 8 }}>
        {saving ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}

/* ------------------------------ Activity ------------------------------ */

function ActivityTab({ activity }) {
  return (
    <div style={tableWrap}>
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>When</th>
            <th style={th}>Who</th>
            <th style={th}>Action</th>
            <th style={th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {activity.map((a) => (
            <tr key={a._id}>
              <td style={td}>{new Date(a.createdAt).toLocaleString()}</td>
              <td style={td}>
                {a.userName ? `${a.userName} (${a.role})` : "Anonymous"}
              </td>
              <td style={td}>{a.action}</td>
              <td style={td}>
                <span style={{ color: a.statusCode < 400 ? "#4ade80" : "#ff6b6b" }}>{a.statusCode}</span>
              </td>
            </tr>
          ))}
          {activity.length === 0 && (
            <tr><td style={td} colSpan={4}>No activity recorded yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const SEVERITY_COLOR = { low: "#a89fc7", medium: "#ffd94d", high: "#ff9f43", critical: "#ff6b6b" };

function SeverityBadge({ severity }) {
  return (
    <span
      style={{
        color: SEVERITY_COLOR[severity] || "#a89fc7",
        border: `1px solid ${SEVERITY_COLOR[severity] || "#a89fc7"}`,
        borderRadius: 20,
        padding: "2px 10px",
        fontSize: "0.72rem",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {severity}
    </span>
  );
}

function SecurityTab({ summary, events, blocked, refreshAll }) {
  const { showToast } = useToast();
  const [blockForm, setBlockForm] = useState({ ip: "", reason: "", durationHours: "" });
  const [blocking, setBlocking] = useState(false);

  const activeBlocks = blocked.filter((b) => !b.expiresAt || new Date(b.expiresAt) > new Date());

  const blockIp = async (e) => {
    e.preventDefault();
    if (!blockForm.ip.trim()) return;
    setBlocking(true);
    try {
      await api.post("/security/blocked-ips", {
        ip: blockForm.ip.trim(),
        reason: blockForm.reason.trim() || undefined,
        durationHours: blockForm.durationHours ? Number(blockForm.durationHours) : undefined,
      });
      showToast(`${blockForm.ip.trim()} blocked`, "success");
      setBlockForm({ ip: "", reason: "", durationHours: "" });
      refreshAll();
    } catch (err) {
      showToast(err.response?.data?.message || "Could not block this IP", "error");
    } finally {
      setBlocking(false);
    }
  };

  const unblockIp = async (id, ip) => {
    try {
      await api.delete(`/security/blocked-ips/${id}`);
      showToast(`${ip} unblocked`, "success");
      refreshAll();
    } catch (err) {
      showToast(err.response?.data?.message || "Could not unblock this IP", "error");
    }
  };

  return (
    <>
      <div style={cardGrid}>
        <StatCard label="Events (24h)" value={summary?.eventsLast24h ?? "—"} />
        <StatCard label="Events (7d)" value={summary?.eventsLast7d ?? "—"} />
        <StatCard label="Critical (24h)" value={summary?.severityCounts?.critical ?? "—"} />
        <StatCard label="Currently blocked IPs" value={summary?.blockedIpCount ?? "—"} />
      </div>

      <p style={{ color: "var(--text-dim)", fontSize: "0.82rem", margin: "16px 0 32px", maxWidth: 720 }}>
        Rate limits, failed logins, account lockouts, flagged spam/prompt-injection attempts, and rejected uploads
        are all logged here in real time. Repeated violations from the same IP within an hour auto-block it for
        24h; repeat offenders after that are blocked permanently.
      </p>

      <h2 style={{ fontSize: "1.2rem", margin: "0 0 16px" }}>Blocked IPs</h2>
      <form onSubmit={blockIp} style={{ ...createForm, gridTemplateColumns: "1fr 2fr 1fr auto" }}>
        <input
          placeholder="IP address"
          value={blockForm.ip}
          onChange={(e) => setBlockForm({ ...blockForm, ip: e.target.value })}
          required
        />
        <input
          placeholder="Reason (optional)"
          value={blockForm.reason}
          onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
        />
        <input
          placeholder="Hours (blank = permanent)"
          type="number"
          min="1"
          value={blockForm.durationHours}
          onChange={(e) => setBlockForm({ ...blockForm, durationHours: e.target.value })}
        />
        <button className="btn btn-primary" type="submit" disabled={blocking}>Block</button>
      </form>

      <div style={{ ...tableWrap, marginBottom: 40 }}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>IP</th>
              <th style={th}>Reason</th>
              <th style={th}>Source</th>
              <th style={th}>Expires</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {activeBlocks.map((b) => (
              <tr key={b._id}>
                <td style={td}>{b.ip}</td>
                <td style={td}>{b.reason}</td>
                <td style={td}>{b.autoBlocked ? "Auto" : `Manual (${b.blockedBy?.name || "admin"})`}</td>
                <td style={td}>{b.expiresAt ? new Date(b.expiresAt).toLocaleString() : "Permanent"}</td>
                <td style={td}>
                  <button className="btn btn-ghost" style={{ padding: "4px 10px" }} onClick={() => unblockIp(b._id, b.ip)}>
                    Unblock
                  </button>
                </td>
              </tr>
            ))}
            {activeBlocks.length === 0 && (
              <tr><td style={td} colSpan={5}>No IPs currently blocked.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: "1.2rem", margin: "0 0 16px" }}>Recent security events</h2>
      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>When</th>
              <th style={th}>Severity</th>
              <th style={th}>Type</th>
              <th style={th}>IP</th>
              <th style={th}>Detail</th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => (
              <tr key={ev._id}>
                <td style={td}>{new Date(ev.createdAt).toLocaleString()}</td>
                <td style={td}><SeverityBadge severity={ev.severity} /></td>
                <td style={{ ...td, textTransform: "capitalize" }}>{ev.type.replace(/_/g, " ")}</td>
                <td style={td}>{ev.ip || "—"}</td>
                <td style={td}>{ev.detail}</td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr><td style={td} colSpan={5}>No security events recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={statCard}>
      <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>{label}</p>
      <p style={{ fontFamily: "var(--font-body)", fontWeight: 700, fontSize: "1.8rem", color: "var(--yellow)" }}>{value}</p>
    </div>
  );
}

const cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 20 };
const statCard = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 22 };
const tabRow = { display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap" };
const aiTabRow = { display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap" };
const aiTabButton = {
  background: "linear-gradient(135deg, rgba(184,164,255,0.15), rgba(255,217,77,0.1))",
  border: "1px solid var(--lavender-deep)",
  color: "var(--text)",
  display: "flex",
  alignItems: "center",
  gap: 8,
};
const aiTabButtonActive = {
  background: "linear-gradient(135deg, var(--lavender-deep), var(--lavender-soft))",
  color: "#0a0810",
};
const aiBadge = {
  fontSize: "0.62rem",
  fontWeight: 700,
  letterSpacing: "0.05em",
  background: "var(--yellow)",
  color: "#221a00",
  borderRadius: 999,
  padding: "1px 6px",
};
const tableWrap = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, overflow: "auto" };
const table = { width: "100%", borderCollapse: "collapse" };
const th = { textAlign: "left", padding: "14px 18px", fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-dim)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" };
const td = { padding: "14px 18px", borderBottom: "1px solid var(--border)", fontSize: "0.85rem" };
const timelineItem = { borderLeft: "2px solid var(--lavender-deep)", paddingLeft: 12, marginBottom: 10 };
const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 20 };
const offlineBadge = {
  marginLeft: 8,
  fontSize: "0.65rem",
  padding: "2px 8px",
  borderRadius: 20,
  border: "1px solid var(--border)",
  color: "var(--text-dim)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};
const createForm = {
  display: "grid",
  gridTemplateColumns: "1.2fr 1.4fr 1fr 0.8fr auto",
  gap: 10,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 20,
  marginBottom: 12,
  alignItems: "center",
};

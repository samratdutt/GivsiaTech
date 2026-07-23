import { useEffect, useRef, useState } from "react";
import api from "../../api/axios.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { resolveImageUrl } from "../../utils/media.js";
import TermsModal from "../../components/TermsModal.jsx";
import { useConfirm } from "../../context/ConfirmContext.jsx";
import { downloadInvoice, INVOICE_AVAILABLE } from "../../utils/invoice.js";

const SERVICES = [
  { id: "website", label: "Website Build", defaultAmount: 25000 },
  { id: "ai-automation", label: "AI Automation", defaultAmount: 40000 },
  { id: "saas", label: "SaaS Platform", defaultAmount: 80000 },
  { id: "app-development", label: "App Development", defaultAmount: 45000 },
];

const CANCEL_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const isCancellable = (o) =>
  ["pending", "in-progress"].includes(o.status) && Date.now() - new Date(o.createdAt).getTime() <= CANCEL_WINDOW_MS;

function StarRating({ value, onChange, readOnly, size = 22 }) {
  return (
    <div style={{ display: "inline-flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          onClick={readOnly ? undefined : () => onChange(n)}
          style={{
            fontSize: size,
            cursor: readOnly ? "default" : "pointer",
            color: n <= value ? "var(--yellow)" : "var(--border)",
            transition: "color 0.15s ease",
            lineHeight: 1,
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

export default function ClientDashboard() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState({ service: "website", title: "", amount: 25000 });
  const [pricingTiers, setPricingTiers] = useState([]);
  const [paying, setPaying] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [showTerms, setShowTerms] = useState(false);
  const requestDetailsRef = useRef(null);

  // Landing here via the homepage's "Start a project" button (which links
  // to #request-project) should actually open the form and scroll to it,
  // not just silently land on the dashboard.
  useEffect(() => {
    if (window.location.hash !== "#request-project" || !requestDetailsRef.current) return;
    requestDetailsRef.current.open = true;
    requestDetailsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const [supportForm, setSupportForm] = useState({ message: "", relatedOrderId: "" });
  const [supportSending, setSupportSending] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");

  const [myReview, setMyReview] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");

  const fetchOrders = () => {
    api.get("/users/dashboard-summary").then((res) => setOrders(res.data.myOrders || []));
  };

  const fetchReview = () => {
    api.get("/reviews/me").then((res) => {
      if (res.data.review) {
        setMyReview(res.data.review);
        setReviewForm({ rating: res.data.review.rating, comment: res.data.review.comment });
      }
    }).catch(() => {});
  };

  useEffect(() => { fetchOrders(); fetchReview(); }, []);

  // Live pricing (admin-editable) rather than SERVICES' hardcoded fallback
  // amounts — keeps the request-project floor accurate if an admin changes
  // a tier's base price later, without needing a frontend redeploy.
  useEffect(() => {
    api.get("/pricing").then((res) => setPricingTiers(res.data.tiers)).catch(() => {});
  }, []);

  // The server is the real boundary (paymentRoutes.js create-order rejects
  // anything below this independently) — this floor is just for instant
  // feedback so a client isn't surprised by a rejection after submitting.
  const PRICE_FLOOR_DISCOUNT = 5000;
  const floorFor = (serviceId) => {
    const tier = pricingTiers.find((t) => t.serviceKey === serviceId);
    const fallback = SERVICES.find((s) => s.id === serviceId)?.defaultAmount;
    const base = tier?.basePrice ?? fallback;
    return base ? Math.max(base - PRICE_FLOOR_DISCOUNT, 1) : 1;
  };
  const amountFloor = floorFor(form.service);
  const amountTooLow = form.amount < amountFloor;

  // Submitting the request-project form doesn't start checkout directly —
  // it opens the Terms & Conditions gate first (business/security
  // requirement: a client must explicitly agree before a project is
  // requested or a payment starts). startCheckout only runs once they
  // agree, from TermsModal's onAgree below.
  const handleRequestSubmit = (e) => {
    e.preventDefault();
    if (amountTooLow) {
      showToast(`The amount can't be lower than ₹${amountFloor.toLocaleString("en-IN")} for this service`, "error");
      return;
    }
    setShowTerms(true);
  };

  const startCheckout = async () => {
    setShowTerms(false);
    setPaying(true);

    const ready = await loadRazorpayScript();
    if (!ready) {
      showToast("Could not load payment gateway. Check your connection.", "error");
      setPaying(false);
      return;
    }

    try {
      const { data } = await api.post("/payments/create-order", form);

      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "GivsiaTech",
        description: form.title,
        order_id: data.razorpayOrderId,
        handler: async (response) => {
          await api.post("/payments/verify", response);
          fetchOrders();
        },
        prefill: { name: user?.name, email: user?.email },
        theme: { color: "#8B6FE8" },
      });
      rzp.open();
    } catch (err) {
      showToast(err.response?.data?.message || "Could not start checkout", "error");
    } finally {
      setPaying(false);
    }
  };

  const toggleDetail = async (orderId) => {
    if (expanded === orderId) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(orderId);
    const { data } = await api.get(`/payments/orders/${orderId}`);
    setDetail(data.order);
  };

  const cancelOrder = async (orderId) => {
    if (!(await confirm("Cancel this project request? This can't be undone."))) return;
    setCancelling(orderId);
    try {
      const { data } = await api.patch(`/payments/orders/${orderId}/cancel`);
      showToast(
        data.refund
          ? `Project cancelled — a refund of ₹${(data.refund.amount / 100).toLocaleString("en-IN")} has been initiated`
          : "Project cancelled",
        "success"
      );
      fetchOrders();
    } catch (err) {
      showToast(err.response?.data?.message || "Could not cancel project", "error");
    } finally {
      setCancelling(null);
    }
  };

  const submitSupport = async (e) => {
    e.preventDefault();
    setSupportMessage("");
    setSupportSending(true);
    try {
      await api.post("/contact/support", {
        message: supportForm.message,
        relatedOrderId: supportForm.relatedOrderId || undefined,
      });
      setSupportMessage("Message sent — support will get back to you soon.");
      setSupportForm({ message: "", relatedOrderId: "" });
    } catch (err) {
      setSupportMessage(err.response?.data?.message || "Could not send message");
    } finally {
      setSupportSending(false);
    }
  };

  const submitReview = async (e) => {
    e.preventDefault();
    setReviewMessage("");
    setReviewSaving(true);
    try {
      const { data } = await api.post("/reviews", reviewForm);
      setMyReview(data.review);
      setReviewMessage("Thanks for the feedback — it's now live on the site.");
    } catch (err) {
      setReviewMessage(err.response?.data?.message || "Could not save review");
    } finally {
      setReviewSaving(false);
    }
  };

  const paidOrders = orders.filter((o) => o.paymentStatus === "paid" || o.razorpayPaymentId);

  return (
    <div className="container" style={{ paddingTop: 120, paddingBottom: 80 }}>
      <span className="eyebrow">Client</span>
      <h1 style={{ margin: "12px 0 8px" }}>Hi {user?.name}</h1>
      <p style={{ color: "var(--text-dim)", marginBottom: 32, fontSize: "0.9rem" }}>
        Track your project status, payments, and invoices below.
      </p>

      <details id="request-project" ref={requestDetailsRef} style={requestBox}>
        <summary style={requestSummary}>+ Request a new project</summary>
        <form onSubmit={handleRequestSubmit} className="responsive-grid-form" style={formStyle}>
          <select value={form.service} onChange={(e) => {
            const svc = SERVICES.find((s) => s.id === e.target.value);
            setForm({ ...form, service: svc.id, amount: floorFor(svc.id) + PRICE_FLOOR_DISCOUNT });
          }}>
            {SERVICES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <input
            placeholder="Project title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <div>
            <input
              type="number"
              placeholder="Amount (INR)"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              min={amountFloor}
              required
              style={amountTooLow ? { borderColor: "#ff6b6b" } : undefined}
            />
            <p style={{ fontSize: "0.72rem", color: amountTooLow ? "#ff6b6b" : "var(--text-dim)", marginTop: 4 }}>
              {amountTooLow
                ? `Can't go below ₹${amountFloor.toLocaleString("en-IN")} for this service`
                : `Minimum ₹${amountFloor.toLocaleString("en-IN")} for this service`}
            </p>
          </div>
          <button className="btn btn-primary" type="submit" disabled={paying || amountTooLow} style={{ alignSelf: "start" }}>
            {paying ? "Starting checkout..." : "Pay & start project"}
          </button>
        </form>
      </details>

      <h2 style={{ fontSize: "1.2rem", margin: "40px 0 16px" }}>Your projects</h2>
      {orders.length === 0 ? (
        <p style={{ color: "var(--text-dim)" }}>No projects yet — request one above.</p>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {orders.map((o) => {
            const hasImage = Boolean(o.image);
            const headerStyle = {
              ...cardTop,
              ...(hasImage
                ? {
                    backgroundImage: `linear-gradient(180deg, rgba(10,8,20,0.12) 0%, rgba(10,8,20,0.88) 100%), url(${resolveImageUrl(o.image)})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    borderRadius: 8,
                    padding: "16px 20px",
                    margin: "-20px -24px 16px",
                    minHeight: 120,
                    alignItems: "flex-end",
                  }
                : {}),
            };
            const hasHosting = o.domain || o.hostingProvider || o.domainExpiryDate || o.hostingExpiryDate;
            return (
            <div key={o._id} style={card}>
              <div style={headerStyle}>
                <div>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem", color: hasImage ? "#f4f2ff" : undefined }}>{o.title}</p>
                  <p style={{ color: hasImage ? "rgba(244,242,255,0.75)" : "var(--text-dim)", fontSize: "0.85rem" }}>{o.service} &middot; {o.invoiceNumber}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ color: hasImage ? "#f4f2ff" : undefined }}>₹{(o.amount / 100).toLocaleString("en-IN")}</p>
                  <span style={{ fontSize: "0.75rem", color: paymentStatusColor(o.paymentStatus, hasImage) }}>
                    {o.paymentStatus.replace("-", " ")}
                  </span>
                </div>
              </div>

              {o.status !== "cancelled" && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-dim)", marginBottom: 4 }}>
                    <span>Progress</span>
                    <span>{o.progressPercent ?? 0}%</span>
                  </div>
                  <div className="progress-bar-track">
                    <div className="progress-bar-fill" style={{ width: `${o.progressPercent ?? 0}%` }} />
                  </div>
                </div>
              )}

              {hasHosting && (
                <div style={hostingInfoBox}>
                  {o.domain && <span>Domain: <strong style={{ color: "var(--text)" }}>{o.domain}</strong></span>}
                  {o.hostingProvider && <span>Hosting: <strong style={{ color: "var(--text)" }}>{o.hostingProvider}</strong></span>}
                  {o.domainExpiryDate && <span>Domain renews: <strong style={{ color: "var(--text)" }}>{new Date(o.domainExpiryDate).toLocaleDateString()}</strong></span>}
                  {o.hostingExpiryDate && <span>Hosting renews: <strong style={{ color: "var(--text)" }}>{new Date(o.hostingExpiryDate).toLocaleDateString()}</strong></span>}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                <span style={statusBadge(o.status)}>{o.status}</span>
                <button className="btn btn-ghost" style={{ padding: "6px 14px", fontSize: "0.75rem" }} onClick={() => toggleDetail(o._id)}>
                  {expanded === o._id ? "Hide details" : "View status & invoice"}
                </button>
                {INVOICE_AVAILABLE.includes(o.paymentStatus) && (
                  <button className="btn btn-ghost" style={{ padding: "6px 14px", fontSize: "0.75rem" }} onClick={() => downloadInvoice(o, showToast)}>
                    Download invoice (PDF)
                  </button>
                )}
                {isCancellable(o) && (
                  <button
                    className="btn btn-ghost"
                    style={{ padding: "6px 14px", fontSize: "0.75rem", color: "#ff6b6b", borderColor: "#5a2a2a" }}
                    onClick={() => cancelOrder(o._id)}
                    disabled={cancelling === o._id}
                  >
                    {cancelling === o._id ? "Cancelling..." : "Cancel project"}
                  </button>
                )}
                {!isCancellable(o) && ["pending", "in-progress"].includes(o.status) && (
                  <span style={{ fontSize: "0.72rem", color: "var(--text-dim)", alignSelf: "center" }}>
                    Cancellation window passed — use Support below to request one
                  </span>
                )}
              </div>

              {expanded === o._id && (
                <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                  {!detail ? (
                    <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>Loading...</p>
                  ) : (
                    <>
                      <p style={{ fontSize: "0.78rem", color: "var(--lavender)", marginBottom: 8 }}>Project status timeline</p>
                      {detail.progressUpdates?.length === 0 && (
                        <p style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
                          No updates from the team yet — check back soon.
                        </p>
                      )}
                      {detail.progressUpdates?.slice().reverse().map((p) => (
                        <div key={p._id} style={timelineItem}>
                          <p style={{ fontSize: "0.85rem" }}>{p.note}</p>
                          <p style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                            {new Date(p.createdAt).toLocaleString()}
                            {p.status && ` · marked ${p.status}`}
                          </p>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      <h2 style={{ fontSize: "1.2rem", margin: "40px 0 16px" }}>Transactions</h2>
      {paidOrders.length === 0 ? (
        <p style={{ color: "var(--text-dim)" }}>No payments yet.</p>
      ) : (
        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Date</th>
                <th style={th}>Project</th>
                <th style={th}>Amount</th>
                <th style={th}>Status</th>
                <th style={th}>Payment ID</th>
                <th style={th}>Invoice</th>
              </tr>
            </thead>
            <tbody>
              {paidOrders.map((o) => (
                <tr key={o._id}>
                  <td style={td}>{new Date(o.createdAt).toLocaleDateString()}</td>
                  <td style={td}>{o.title}</td>
                  <td style={td}>₹{(o.amount / 100).toLocaleString("en-IN")}</td>
                  <td style={td}>{o.paymentStatus}</td>
                  <td style={{ ...td, fontFamily: "monospace", fontSize: "0.75rem" }}>{o.razorpayPaymentId || "—"}</td>
                  <td style={td}>
                    {INVOICE_AVAILABLE.includes(o.paymentStatus) ? (
                      <button
                        className="link-btn"
                        onClick={() => downloadInvoice(o, showToast)}
                        style={{ fontSize: "0.82rem" }}
                      >
                        {o.invoiceNumber || "Download"}
                      </button>
                    ) : (
                      o.invoiceNumber || "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="responsive-grid-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, marginTop: 48 }}>
        <div>
          <h2 style={{ fontSize: "1.2rem", marginBottom: 16 }}>Contact support</h2>
          <form onSubmit={submitSupport} style={card}>
            {orders.length > 0 && (
              <select
                value={supportForm.relatedOrderId}
                onChange={(e) => setSupportForm({ ...supportForm, relatedOrderId: e.target.value })}
                style={{ marginBottom: 12 }}
              >
                <option value="">General question</option>
                {orders.map((o) => (
                  <option key={o._id} value={o._id}>Re: {o.title}</option>
                ))}
              </select>
            )}
            <textarea
              placeholder="How can we help?"
              rows={4}
              value={supportForm.message}
              onChange={(e) => setSupportForm({ ...supportForm, message: e.target.value })}
              required
              style={{ marginBottom: 12, resize: "vertical" }}
            />
            <button className="btn btn-primary" type="submit" disabled={supportSending} style={{ width: "100%" }}>
              {supportSending ? "Sending..." : "Send message"}
            </button>
            {supportMessage && <p style={{ fontSize: "0.82rem", color: "var(--lavender)", marginTop: 10 }}>{supportMessage}</p>}
          </form>
        </div>

        <div>
          <h2 style={{ fontSize: "1.2rem", marginBottom: 16 }}>{myReview ? "Your review" : "Leave a review"}</h2>
          <form onSubmit={submitReview} style={card}>
            <div style={{ marginBottom: 14 }}>
              <StarRating value={reviewForm.rating} onChange={(n) => setReviewForm({ ...reviewForm, rating: n })} />
            </div>
            <textarea
              placeholder="How was working with us?"
              rows={4}
              value={reviewForm.comment}
              onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
              required
              style={{ marginBottom: 12, resize: "vertical" }}
            />
            <button className="btn btn-primary" type="submit" disabled={reviewSaving} style={{ width: "100%" }}>
              {reviewSaving ? "Saving..." : myReview ? "Update review" : "Submit review"}
            </button>
            {reviewMessage && <p style={{ fontSize: "0.82rem", color: "var(--lavender)", marginTop: 10 }}>{reviewMessage}</p>}
          </form>
        </div>
      </div>

      <TermsModal open={showTerms} onAgree={startCheckout} onClose={() => setShowTerms(false)} />
    </div>
  );
}

const requestBox = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 20,
};
const requestSummary = {
  cursor: "pointer",
  fontFamily: "var(--font-display)",
  fontSize: "0.9rem",
  color: "var(--lavender)",
};
const formStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr auto",
  gap: 14,
  marginTop: 18,
  alignItems: "center",
};
const card = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "20px 24px",
};
const cardTop = { display: "flex", justifyContent: "space-between", alignItems: "flex-start" };
const hostingInfoBox = {
  marginTop: 14,
  padding: "10px 14px",
  background: "var(--bg-soft)",
  borderRadius: 6,
  fontSize: "0.78rem",
  color: "var(--text-dim)",
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 6,
};
const timelineItem = { borderLeft: "2px solid var(--lavender-deep)", paddingLeft: 12, marginBottom: 10 };
const paymentStatusColor = (status, hasImage) => {
  if (status === "paid") return "var(--yellow)";
  if (status === "refunded" || status === "refund-pending") return "#ff9f6b";
  return hasImage ? "rgba(244,242,255,0.75)" : "var(--text-dim)";
};
const statusBadge = (status) => ({
  fontSize: "0.75rem",
  padding: "6px 14px",
  borderRadius: 20,
  textTransform: "capitalize",
  background: status === "completed" ? "rgba(184,164,255,0.15)" : "rgba(255,210,63,0.15)",
  color: status === "completed" ? "var(--lavender)" : "var(--yellow)",
});
const tableWrap = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, overflow: "auto" };
const table = { width: "100%", borderCollapse: "collapse" };
const th = { textAlign: "left", padding: "14px 18px", fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-dim)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" };
const td = { padding: "14px 18px", borderBottom: "1px solid var(--border)", fontSize: "0.85rem" };

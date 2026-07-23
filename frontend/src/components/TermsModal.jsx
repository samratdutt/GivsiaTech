import { useState } from "react";

// A blocking agreement gate shown before anything that commits the visitor
// to a paid engagement: starting checkout on an existing account (see
// ClientDashboard's request-project form) or heading toward registration
// from a pricing tier's "Get a quote" (see PricingSection). Reusable rather
// than duplicated so both call sites show identically-worded terms.
//
// Content is written to match how this business actually operates
// elsewhere in the app — e.g. the 2-day self-serve cancellation window
// mirrors CANCEL_WINDOW_MS in backend/routes/paymentRoutes.js, and the
// portfolio clause mirrors the publish-from-order flow in
// backend/routes/portfolioRoutes.js — not generic boilerplate that
// contradicts what the rest of the site does.
export default function TermsModal({ open, onAgree, onClose }) {
  const [checked, setChecked] = useState(false);

  if (!open) return null;

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="terms-modal-heading">
        <div style={styles.header}>
          <h2 id="terms-modal-heading" style={styles.heading}>Terms &amp; Conditions</h2>
          <button type="button" onClick={onClose} style={styles.closeBtn} aria-label="Close">×</button>
        </div>

        <div style={styles.body}>
          <p style={styles.intro}>
            Before requesting a project or starting a payment with GivsiaTech (Givsia Private Limited), please
            read and agree to the terms below.
          </p>

          <h3 style={styles.sectionTitle}>1. Quotes &amp; scope</h3>
          <p style={styles.text}>
            Prices shown on this site are starting estimates for a typical project of that type, not a final
            quote. The final scope, timeline, and price are confirmed with you before any work begins. Work
            starts only once payment is completed.
          </p>

          <h3 style={styles.sectionTitle}>2. Payments</h3>
          <p style={styles.text}>
            Payments are processed securely through Razorpay. We never see or store your card/UPI details
            ourselves. Your project moves to "in-progress" only once your payment is confirmed.
          </p>

          <h3 style={styles.sectionTitle}>3. Cancellations &amp; refunds</h3>
          <p style={styles.text}>
            You can cancel a project yourself, no questions asked, within 2 days of requesting it, from your
            dashboard. After that window, cancellations are handled case by case through Support — amounts
            already spent on completed work may not be refundable once work is underway.
          </p>

          <h3 style={styles.sectionTitle}>4. Ownership &amp; portfolio use</h3>
          <p style={styles.text}>
            Ownership of your finished deliverable transfers to you once it's paid in full. We keep the right
            to feature completed projects in our public portfolio (with your project's public-facing details
            only, never your account or contact information) — tell us if you'd rather we didn't, and we'll
            leave it out.
          </p>

          <h3 style={styles.sectionTitle}>5. Your data</h3>
          <p style={styles.text}>
            We collect the information needed to deliver and support your project — your account details,
            project requirements, and payment confirmation from Razorpay. We don't sell your data, and we don't
            share it beyond what's needed to run the service (e.g. payment processing, SMS verification).
          </p>

          <h3 style={styles.sectionTitle}>6. Liability</h3>
          <p style={styles.text}>
            We're not liable for indirect or consequential losses arising from your use of the delivered
            product. Our total liability for any project is capped at the amount you paid for that project.
          </p>

          <h3 style={styles.sectionTitle}>7. Changes to these terms</h3>
          <p style={styles.text}>
            We may update these terms occasionally as the business grows; the current version always applies to
            new project requests. These terms are governed by the laws of India.
          </p>
        </div>

        <label className="fancy-checkbox" style={styles.checkboxRow}>
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span className="fancy-checkbox-box">
            <svg className="fancy-checkbox-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <span className="fancy-checkbox-label">I have read and agree to the Terms &amp; Conditions above.</span>
        </label>

        <div style={styles.actions}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!checked}
            onClick={() => {
              setChecked(false);
              onAgree();
            }}
            style={{ opacity: checked ? 1 : 0.5 }}
          >
            Agree &amp; continue
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(5, 4, 10, 0.72)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 500,
    padding: 20,
  },
  panel: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "85vh",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "18px 22px",
    borderBottom: "1px solid var(--border)",
  },
  heading: { fontFamily: "var(--font-display)", fontSize: "1.15rem", margin: 0 },
  closeBtn: {
    background: "none",
    border: "none",
    color: "var(--text-dim)",
    fontSize: "1.6rem",
    lineHeight: 1,
    cursor: "pointer",
    padding: 4,
  },
  body: { padding: "18px 22px", overflowY: "auto", flex: 1 },
  intro: { color: "var(--text-dim)", fontSize: "0.88rem", marginBottom: 16, lineHeight: 1.6 },
  sectionTitle: { fontSize: "0.88rem", fontFamily: "var(--font-display)", margin: "16px 0 6px", color: "var(--lavender)" },
  text: { color: "var(--text-dim)", fontSize: "0.85rem", lineHeight: 1.65, margin: 0 },
  checkboxRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "16px 22px",
    borderTop: "1px solid var(--border)",
    fontSize: "0.85rem",
    color: "var(--text)",
    cursor: "pointer",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    padding: "0 22px 20px",
  },
};

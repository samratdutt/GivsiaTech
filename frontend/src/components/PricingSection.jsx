import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TermsModal from "./TermsModal.jsx";
import api from "../api/axios.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";

// Where agreeing to terms sends a "Get a quote" click, once logged in — a
// client goes straight to their own request-project panel instead of back
// through /register; mirrors Home.jsx's "Start a project" destination map.
const QUOTE_DESTINATION = {
  client: "/dashboard/client#request-project",
  admin: "/dashboard/admin?tab=orders",
};

// Must match the page-turn-left/-right animation-duration in index.css —
// content is swapped exactly at the halfway point (the keyframes' 50%
// mark), while the page is edge-on and invisible (backface-visibility:
// hidden), so the swap is never actually seen, only the turn itself.
const TURN_MS = 850;
const NARROW_BREAKPOINT = 760; // matches the .pricing-book media query

function ChevronIcon({ dir }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <path d={dir === "prev" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
    </svg>
  );
}

function PricingPage({ tier, side, turningClass, onQuoteClick, activeQuote }) {
  const sideClass = side === "left" ? "book-page-left" : side === "right" ? "book-page-right" : "book-page-single";
  if (!tier) return <div className={`book-page ${sideClass}`} />;

  return (
    <div className={`book-page ${sideClass}${tier.featured ? " is-featured" : ""}${turningClass ? ` ${turningClass}` : ""}`}>
      {tier.featured && <span style={styles.badge}>★ Most requested</span>}
      <h3 style={styles.tierName}>{tier.name}</h3>
      <p style={styles.price}>{tier.price}</p>
      <p style={styles.desc}>{tier.desc}</p>
      <ul style={styles.list}>
        {tier.features.map((f) => (
          <li key={f} style={styles.listItem}>› {f}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={(e) => onQuoteClick(e, tier)}
        className={tier.featured ? "btn btn-primary" : "btn btn-ghost"}
        style={{
          width: "100%",
          justifyContent: "center",
          ...(activeQuote === tier.name ? styles.quoteActive : {}),
        }}
      >
        Get a quote
      </button>
      <p className="book-page-includes">
        <strong>Every project includes:</strong> fixed price before work starts, full ownership on final payment,
        a 2-day cancellation window, and direct support from your dashboard.
      </p>
    </div>
  );
}

export default function PricingSection() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [activeQuote, setActiveQuote] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [showTerms, setShowTerms] = useState(false);
  const [pendingTier, setPendingTier] = useState(null);

  // Wide mode is a sliding window over the tier list, not fixed pairs —
  // left = tiers[index], right = tiers[index+1], always adjacent and in
  // order. Turning the right page moves the window forward by one (the
  // tier that was on the right becomes the new left, exactly like a real
  // book: turn the right page and what was on it is now to your left);
  // turning the left page moves it back by one. Narrow mode still shows
  // one tier at a time, index 0..tiers.length-1.
  const [index, setIndex] = useState(0);
  const [turning, setTurning] = useState(false);
  const [turnSide, setTurnSide] = useState(null); // "left" | "right" — which page actually turns
  const [isNarrow, setIsNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth < NARROW_BREAKPOINT);

  useEffect(() => {
    api.get("/pricing").then((res) => setTiers(res.data.tiers)).catch(() => {});
  }, []);

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < NARROW_BREAKPOINT);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Number of valid window positions: narrow = one per tier; wide = one
  // per adjacent pair (tiers.length - 1), never negative.
  const pageCount = isNarrow ? tiers.length : Math.max(tiers.length - 1, tiers.length ? 1 : 0);

  useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(pageCount - 1, 0)));
  }, [pageCount]);

  const leftTier = tiers[index];
  const rightTier = isNarrow ? null : tiers[index + 1];
  const canPrev = index > 0;
  const canNext = index < pageCount - 1;

  // Moving forward turns the right page (revealing the next tier there —
  // the left page just slides its content along to what the right page
  // was showing, with a quick cross-fade, never a rotation). Moving back
  // turns the left page, right page cross-fades. Also used directly by the
  // dot indicators for an arbitrary jump, still animating only one side.
  const turnTo = (targetIndex) => {
    if (turning || targetIndex === index || targetIndex < 0 || targetIndex >= pageCount) return;
    setTurnSide(targetIndex > index ? "right" : "left");
    setTurning(true);
    setTimeout(() => setIndex(targetIndex), TURN_MS / 2);
    setTimeout(() => { setTurning(false); setTurnSide(null); }, TURN_MS);
  };

  // Requesting a quote is a business-security-relevant step (it's the path
  // toward a paid engagement), so it's gated behind an explicit Terms &
  // Conditions agreement rather than navigating straight away.
  const handleQuoteClick = (e, tier) => {
    e.preventDefault();
    setPendingTier(tier);
    setShowTerms(true);
  };

  const proceedAfterAgree = () => {
    setShowTerms(false);
    setActiveQuote(pendingTier?.name);
    const serviceKey = pendingTier?.serviceKey;
    setTimeout(() => {
      setActiveQuote(null);
      if (!user) return navigate("/register");
      if (user.role === "service") {
        showToast("Service accounts can't request a project — that's only available for clients.", "info");
        return;
      }
      // A client lands on the request-project form pre-pointed at the exact
      // service this tier is linked to (see ClientDashboard.jsx's
      // ?service= handling), instead of a generic form they'd have to
      // re-select the service on themselves.
      if (user.role === "client" && serviceKey) {
        return navigate(`/dashboard/client?service=${encodeURIComponent(serviceKey)}#request-project`);
      }
      navigate(QUOTE_DESTINATION[user.role] || "/register");
    }, 400);
  };

  const singleTurnClass = turning ? (turnSide === "right" ? "is-turning-right" : "is-turning-left") : "";
  const leftClass = !turning ? "" : turnSide === "left" ? "is-turning-left" : "is-updating";
  const rightClass = !turning ? "" : turnSide === "right" ? "is-turning-right" : "is-updating";

  return (
    <section id="pricing" style={styles.section}>
      <div className="container">
        <span className="eyebrow">Pricing</span>
        <h2 style={styles.heading}>Starting points, not the whole story</h2>
        <p style={styles.sub}>
          Every project is scoped individually — these are starting ranges. Tell us what you need and we'll send a
          fixed quote. Turn the page to see the rest.
        </p>

        <div className="pricing-book">
          <button
            type="button"
            className="book-turn-btn book-turn-prev"
            onClick={() => turnTo(index - 1)}
            disabled={!canPrev || turning}
            aria-label="Turn to the previous page"
          >
            <ChevronIcon dir="prev" />
          </button>

          <div className="pricing-book-pages">
            {isNarrow ? (
              <PricingPage tier={leftTier} side="single" turningClass={singleTurnClass} onQuoteClick={handleQuoteClick} activeQuote={activeQuote} />
            ) : (
              <>
                <PricingPage tier={leftTier} side="left" turningClass={leftClass} onQuoteClick={handleQuoteClick} activeQuote={activeQuote} />
                <div className="book-spine" />
                <PricingPage tier={rightTier} side="right" turningClass={rightClass} onQuoteClick={handleQuoteClick} activeQuote={activeQuote} />
              </>
            )}
          </div>

          <button
            type="button"
            className="book-turn-btn book-turn-next"
            onClick={() => turnTo(index + 1)}
            disabled={!canNext || turning}
            aria-label="Turn to the next page"
          >
            <ChevronIcon dir="next" />
          </button>
        </div>

        {pageCount > 1 && (
          <div className="book-dots">
            {Array.from({ length: pageCount }).map((_, i) => (
              <button
                key={i}
                type="button"
                className={`book-dot${i === index ? " is-active" : ""}`}
                onClick={() => turnTo(i)}
                aria-label={`Go to page ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      <TermsModal open={showTerms} onAgree={proceedAfterAgree} onClose={() => setShowTerms(false)} />
    </section>
  );
}

const styles = {
  section: { padding: "140px 0" },
  heading: { fontSize: "2.2rem", margin: "16px 0 10px" },
  sub: { color: "var(--text-dim)", maxWidth: 520, marginBottom: 56, lineHeight: 1.6 },
  badge: {
    alignSelf: "flex-start",
    background: "var(--lavender)",
    color: "#1a1410",
    fontSize: "0.7rem",
    fontFamily: "var(--font-display)",
    letterSpacing: "0.06em",
    padding: "4px 12px",
    borderRadius: 20,
    marginBottom: 8,
  },
  tierName: { fontFamily: "var(--font-display)", fontSize: "1.1rem" },
  price: { fontSize: "1.6rem", color: "var(--yellow)", margin: "8px 0" },
  desc: { color: "var(--text-dim)", fontSize: "0.88rem", marginBottom: 14 },
  list: { listStyle: "none", padding: 0, marginBottom: 20, display: "flex", flexDirection: "column", gap: 10, flexGrow: 1 },
  listItem: { fontSize: "0.85rem", color: "var(--text-dim)", paddingLeft: 18, position: "relative" },
  quoteActive: {
    background: "var(--lavender)",
    color: "#1a1410",
    boxShadow: "0 0 24px rgba(184, 164, 255, 0.6)",
  },
};

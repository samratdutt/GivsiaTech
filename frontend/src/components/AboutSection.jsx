import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import api from "../api/axios.js";

gsap.registerPlugin(ScrollTrigger);

const SOCIAL_ICONS = {
  facebook: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
  instagram: (
    <>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  linkedin: (
    <>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </>
  ),
  github: <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />,
  portfolio: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </>
  ),
  email: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 6-10 7L2 6" />
    </>
  ),
};

function SocialIcon({ type }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="17" height="17">
      {SOCIAL_ICONS[type]}
    </svg>
  );
}

function FounderCard({ founder }) {
  const links = founder.links || {};
  const socialEntries = ["linkedin", "github", "instagram", "facebook", "portfolio"].filter((k) => links[k]);

  return (
    <div className="founder-card" style={styles.founderCard}>
      <p style={styles.founderName}>{founder.name}</p>
      {founder.degree && <p style={styles.founderMeta}>{founder.degree}</p>}
      {founder.role && <p style={styles.founderRole}>{founder.role}</p>}

      {founder.expertise?.length > 0 && (
        <div style={styles.expertiseRow}>
          {founder.expertise.map((e) => (
            <span key={e} style={styles.expertiseTag}>{e}</span>
          ))}
        </div>
      )}

      {founder.quote && <p style={styles.founderQuote}>&ldquo;{founder.quote}&rdquo;</p>}

      <div style={styles.socialRow}>
        {founder.email && (
          <a href={`mailto:${founder.email}`} className="founder-social-link" style={styles.socialLink} aria-label="Email" title="Email">
            <SocialIcon type="email" />
          </a>
        )}
        {socialEntries.map((k) => (
          <a key={k} href={links[k]} target="_blank" rel="noreferrer" className="founder-social-link" style={styles.socialLink} aria-label={k} title={k}>
            <SocialIcon type={k} />
          </a>
        ))}
      </div>
    </div>
  );
}

const FALLBACK = {
  heading: "A small, technical team — not an agency.",
  description:
    "GivsiaTech is the technology arm of Givsia Private Limited. We're founders and engineers who build the same production stack for clients that we use for our own products — no hand-off to a junior team, no templated builds. If we ship it, we maintain it.",
  stats: [
    { value: "5", label: "Founding team" },
    { value: "3", label: "Core service lines" },
    { value: "100%", label: "In-house build & support" },
  ],
};

export default function AboutSection() {
  const ref = useRef();
  const [info, setInfo] = useState(FALLBACK);
  const [founders, setFounders] = useState([]);

  useEffect(() => {
    api.get("/company").then((res) => { if (res.data.info) setInfo(res.data.info); }).catch(() => {});
    api.get("/founders").then((res) => setFounders(res.data.founders || [])).catch(() => {});
  }, []);

  useEffect(() => {
    gsap.fromTo(
      ref.current.querySelectorAll(".stat"),
      { y: 30, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
        stagger: 0.12,
        ease: "power3.out",
        scrollTrigger: { trigger: ref.current, start: "top 80%" },
      }
    );
  }, [info]);

  const [firstWord, ...rest] = info.heading.split(" — ");

  return (
    <section id="about" ref={ref} style={styles.section}>
      <div className="container about-grid" style={styles.grid}>
        <div style={{ position: "relative" }}>
          <svg
            className="deco-ring"
            width="180"
            height="180"
            viewBox="0 0 180 180"
            style={styles.decoRing}
          >
            <circle cx="90" cy="90" r="82" fill="none" stroke="#8B6FE8" strokeWidth="1" strokeDasharray="4 10" opacity="0.5" />
            <circle cx="90" cy="8" r="4" fill="#FFD23F" />
            <circle cx="172" cy="90" r="3" fill="#B8A4FF" />
          </svg>
          <span className="eyebrow">Who we are</span>
          <h2 style={styles.heading}>
            {rest.length ? (
              <>
                {firstWord} — <span style={{ color: "var(--lavender)" }}>{rest.join(" — ")}</span>
              </>
            ) : (
              info.heading
            )}
          </h2>
          <p style={styles.copy}>{info.description}</p>
        </div>
        <div style={styles.statsCol}>
          {info.stats.map((s) => (
            <div key={s.label} className="stat" style={styles.statBox}>
              <p style={styles.statValue}>{s.value}</p>
              <p style={styles.statLabel}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {founders.length > 0 && (
        <div className="container" style={styles.foundersWrap}>
          <span className="eyebrow">The people behind it</span>
          <h3 style={styles.foundersHeading}>Founders</h3>
          <div className="founders-grid" style={styles.foundersGrid}>
            {founders.map((f) => (
              <FounderCard key={f._id} founder={f} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

const styles = {
  section: { padding: "100px 0" },
  grid: { display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 48, alignItems: "center" },
  decoRing: { position: "absolute", top: -60, right: -40, zIndex: 0, pointerEvents: "none" },
  heading: { fontSize: "2rem", margin: "16px 0 22px", lineHeight: 1.3, position: "relative" },
  copy: { color: "var(--text-dim)", lineHeight: 1.7, maxWidth: 480, position: "relative" },
  statsCol: { display: "flex", flexDirection: "column", gap: 16 },
  statBox: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "20px 28px",
    display: "flex",
    alignItems: "baseline",
    gap: 16,
  },
  statValue: { fontFamily: "var(--font-display)", fontSize: "2rem", color: "var(--yellow)" },
  statLabel: { color: "var(--text-dim)", fontSize: "0.9rem" },

  foundersWrap: { marginTop: 100 },
  foundersHeading: { fontSize: "1.7rem", margin: "16px 0 32px" },
  foundersGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 },
  founderCard: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "28px 26px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  founderName: { fontFamily: "var(--font-display)", fontSize: "1.15rem" },
  founderMeta: { color: "var(--text-dim)", fontSize: "0.82rem" },
  founderRole: { color: "var(--lavender)", fontSize: "0.85rem", marginBottom: 4 },
  expertiseRow: { display: "flex", flexWrap: "wrap", gap: 8, margin: "8px 0" },
  expertiseTag: {
    fontSize: "0.7rem",
    padding: "4px 10px",
    borderRadius: 20,
    border: "1px solid var(--border)",
    color: "var(--text-dim)",
  },
  founderQuote: {
    fontStyle: "italic",
    color: "var(--text-dim)",
    fontSize: "0.88rem",
    lineHeight: 1.6,
    margin: "10px 0",
    borderLeft: "2px solid var(--lavender-deep)",
    paddingLeft: 12,
  },
  socialRow: { display: "flex", gap: 10, marginTop: 12 },
  socialLink: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    border: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--text-dim)",
    transition: "color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease",
  },
};

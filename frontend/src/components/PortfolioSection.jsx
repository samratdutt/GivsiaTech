import { useEffect, useState } from "react";
import TiltCard from "./TiltCard.jsx";
import api from "../api/axios.js";
import { resolveImageUrl } from "../utils/media.js";

export default function PortfolioSection() {
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    api.get("/portfolio").then((res) => setProjects(res.data.items)).catch(() => {});
  }, []);

  // Duplicated once so the marquee track can loop seamlessly at -50% translateX.
  const trackItems = [...projects, ...projects];

  return (
    <section id="work" style={styles.section}>
      <div className="container">
        <span className="eyebrow">Selected work</span>
        <h2 style={styles.heading}>What we've shipped</h2>
        <p style={styles.hint}>Hover to pause and read.</p>
      </div>

      <div className="marquee-viewport">
        <div className="marquee-track" style={{ animationDuration: "34s" }}>
          {trackItems.map((p, i) => {
            const muted = p.tag === "Coming soon";
            const hasImage = Boolean(p.image);
            const cardStyle = {
              ...styles.card,
              ...(muted ? styles.cardMuted : {}),
              ...(hasImage
                ? {
                    backgroundImage: `linear-gradient(180deg, rgba(10,8,20,0.35) 0%, rgba(10,8,20,0.88) 100%), url(${resolveImageUrl(p.image)})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : {}),
            };
            return (
              <div key={`${p._id}-${i}`} style={styles.cardWrap}>
                <TiltCard style={cardStyle}>
                  <span style={styles.cardTag}>{p.tag}</span>
                  <h3 style={{ ...styles.cardTitle, ...(hasImage ? styles.textOnImage : {}) }}>{p.title}</h3>
                  <p style={{ ...styles.cardCopy, ...(hasImage ? styles.textOnImage : {}) }}>{p.desc}</p>
                  <p style={{ ...styles.stack, ...(hasImage ? styles.textOnImage : {}) }}>{p.stack}</p>
                </TiltCard>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const styles = {
  section: { padding: "140px 0" },
  heading: { fontSize: "2.2rem", margin: "16px 0 8px" },
  hint: { color: "var(--text-dim)", fontSize: "0.82rem", marginBottom: 48 },
  cardWrap: { width: 340, flexShrink: 0 },
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "32px 26px",
    boxShadow: "0 24px 48px rgba(0,0,0,0.35)",
    height: "100%",
  },
  cardMuted: { opacity: 0.6, borderStyle: "dashed" },
  textOnImage: { color: "#f4f2ff" },
  cardTag: {
    fontFamily: "var(--font-display)",
    fontSize: "0.7rem",
    letterSpacing: "0.2em",
    color: "var(--yellow)",
    textTransform: "uppercase",
  },
  cardTitle: { fontSize: "1.4rem", margin: "14px 0 10px" },
  cardCopy: { color: "var(--text-dim)", lineHeight: 1.6, fontSize: "0.92rem", marginBottom: 16 },
  stack: { fontSize: "0.78rem", color: "var(--lavender-soft)", letterSpacing: "0.02em" },
};

import { useEffect, useRef, useState } from "react";
import api from "../api/axios.js";

function Stars({ rating, size = 16 }) {
  return (
    <span aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} style={{ fontSize: size, color: n <= rating ? "var(--yellow)" : "var(--border)" }}>★</span>
      ))}
    </span>
  );
}

export default function TestimonialsSection() {
  const [reviews, setReviews] = useState([]);
  const [average, setAverage] = useState(0);
  const [index, setIndex] = useState(0);
  const [key, setKey] = useState(0); // forces the flip-in animation to replay
  const sectionRef = useRef();
  const [inView, setInView] = useState(false);

  useEffect(() => {
    api.get("/reviews").then((res) => {
      setReviews(res.data.reviews || []);
      setAverage(res.data.average || 0);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setInView(true),
      { threshold: 0.3 }
    );
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || reviews.length < 2) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % reviews.length);
      setKey((k) => k + 1);
    }, 4200);
    return () => clearInterval(timer);
  }, [inView, reviews.length]);

  const goTo = (i) => {
    setIndex(i);
    setKey((k) => k + 1);
  };

  if (reviews.length === 0) return null; // nothing genuine to show yet — no placeholder quotes

  const r = reviews[index];

  return (
    <section ref={sectionRef} style={styles.section}>
      <div className="container">
        <span className="eyebrow">Client feedback</span>
        <div style={styles.headingRow}>
          <h2 style={styles.heading}>What clients say</h2>
          <div style={styles.avgBox}>
            <span style={styles.avgNumber}>{average.toFixed(1)}</span>
            <div>
              <Stars rating={Math.round(average)} />
              <p style={styles.avgLabel}>{reviews.length} review{reviews.length === 1 ? "" : "s"}</p>
            </div>
          </div>
        </div>

        <div style={styles.stage}>
          <blockquote key={key} className="flip-card-enter" style={styles.card}>
            <Stars rating={r.rating} size={18} />
            <p style={styles.quote}>&ldquo;{r.comment}&rdquo;</p>
            <footer style={styles.role}>{r.client?.name}{r.client?.company ? `, ${r.client.company}` : ""}</footer>
          </blockquote>
        </div>

        {reviews.length > 1 && (
          <div style={styles.dots}>
            {reviews.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Show review ${i + 1}`}
                style={{ ...styles.dot, background: i === index ? "var(--yellow)" : "var(--border)" }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

const styles = {
  section: { padding: "140px 0" },
  headingRow: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20, margin: "16px 0 48px" },
  heading: { fontSize: "2.2rem", margin: 0 },
  avgBox: { display: "flex", alignItems: "center", gap: 12 },
  avgNumber: { fontFamily: "var(--font-display)", fontSize: "2.4rem", color: "var(--yellow)" },
  avgLabel: { fontSize: "0.78rem", color: "var(--text-dim)", marginTop: 2 },
  stage: { perspective: 1200, maxWidth: 640 },
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "36px 32px",
    margin: 0,
    transformStyle: "preserve-3d",
  },
  quote: { fontSize: "1.15rem", lineHeight: 1.65, margin: "14px 0", fontStyle: "italic" },
  role: { fontSize: "0.8rem", color: "var(--text-dim)" },
  dots: { display: "flex", gap: 10, marginTop: 24 },
  dot: { width: 9, height: 9, borderRadius: "50%", border: "none" },
};

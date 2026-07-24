import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import OrbitCarousel from "./OrbitCarousel.jsx";
import api from "../api/axios.js";

gsap.registerPlugin(ScrollTrigger);

export default function ServicesSection() {
  const headingRef = useRef();
  const [services, setServices] = useState([]);

  useEffect(() => {
    api.get("/services").then((res) => setServices(res.data.services)).catch(() => {});
  }, []);

  useEffect(() => {
    gsap.fromTo(
      headingRef.current,
      { y: 30, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: { trigger: headingRef.current, start: "top 85%" },
      }
    );
  }, []);

  return (
    <section id="services" style={styles.section}>
      <div className="container">
        <div ref={headingRef}>
          <span className="eyebrow">What we do</span>
          <h2 style={styles.heading}>Ways we move your business forward</h2>
          <p style={styles.hint}>Orbit is paused — hover off a card to keep it spinning.</p>
        </div>

        <OrbitCarousel
          items={services}
          radius={300}
          height={380}
          duration={22}
          renderItem={(s) => (
            <div style={styles.card}>
              <span style={styles.cardTag}>{s.tag}</span>
              <h3 style={styles.cardTitle}>{s.title}</h3>
              <p style={styles.cardCopy}>{s.copy}</p>
            </div>
          )}
        />
      </div>
    </section>
  );
}

const styles = {
  section: { padding: "140px 0 100px" },
  heading: {
    fontSize: "2.4rem",
    margin: "16px 0 8px",
    maxWidth: 640,
    lineHeight: 1.3,
  },
  hint: { color: "var(--text-dim)", fontSize: "0.82rem", marginBottom: 40 },
  card: {
    width: 260,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "30px 24px",
    boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
  },
  cardTag: {
    fontFamily: "var(--font-display)",
    fontSize: "0.68rem",
    letterSpacing: "0.2em",
    color: "var(--lavender)",
    textTransform: "uppercase",
  },
  cardTitle: { fontSize: "1.2rem", margin: "12px 0 10px" },
  cardCopy: { color: "var(--text-dim)", lineHeight: 1.55, fontSize: "0.88rem" },
};

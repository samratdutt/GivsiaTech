import { Suspense } from "react";
import { useNavigate } from "react-router-dom";
import HeroScene from "../components/HeroScene.jsx";
import TypingHeadline from "../components/TypingHeadline.jsx";
import ServicesSection from "../components/ServicesSection.jsx";
import AboutSection from "../components/AboutSection.jsx";
import PortfolioSection from "../components/PortfolioSection.jsx";
import PricingSection from "../components/PricingSection.jsx";
import TestimonialsSection from "../components/TestimonialsSection.jsx";
import ContactSection from "../components/ContactSection.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";

const headlineSegments = [
  { text: "We engineer the " },
  { text: "web, AI, SaaS & mobile", accent: true, break: true },
  { text: "backbone of your business." },
];

// Where "Start a project" goes depends on who's asking: an anonymous
// visitor registers, a client jumps straight to the request-a-project form
// on their own dashboard, an admin jumps to project management, and a
// service account (which has no client-facing project of its own) gets an
// explanation instead of a confusing dead end.
const START_PROJECT_DESTINATION = {
  client: "/dashboard/client#request-project",
  admin: "/dashboard/admin?tab=orders",
};

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleStartProject = () => {
    if (!user) {
      navigate("/register");
      return;
    }
    if (user.role === "service") {
      showToast("Service accounts can't request a project — that's only available for clients. Use the Service Dashboard to send outreach instead.", "info");
      return;
    }
    navigate(START_PROJECT_DESTINATION[user.role] || "/register");
  };

  return (
    <>
      <section className="hero-section" style={styles.hero}>
        <Suspense fallback={null}>
          <HeroScene />
        </Suspense>
        <div style={styles.heroOverlay} />
        <div className="container hero-content" style={styles.heroContent}>
          <span className="eyebrow">Givsia Private Limited</span>
          <TypingHeadline segments={headlineSegments} style={styles.h1} />
          <p style={{ ...styles.sub, ...styles.fadeIn }}>
            GivsiaTech designs, builds, and ships production-ready websites,
            AI automation, and SaaS platforms — end to end.
          </p>
          <div className="hero-cta-row" style={{ ...styles.ctaRow, ...styles.fadeIn }}>
            <button type="button" onClick={handleStartProject} className="btn btn-primary">Start a project</button>
            <a href="#services" className="btn btn-ghost">See services</a>
          </div>
        </div>
      </section>

      <ServicesSection />
      <AboutSection />
      <PortfolioSection />
      <PricingSection />
      <TestimonialsSection />
      <ContactSection />
    </>
  );
}

const styles = {
  hero: {
    position: "relative",
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    overflow: "hidden",
  },
  heroOverlay: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(ellipse at 30% 50%, var(--hero-overlay-near) 0%, var(--hero-overlay-far) 75%)",
    pointerEvents: "none",
    transition: "background 0.4s ease",
  },
  heroContent: { position: "relative", zIndex: 2, paddingTop: 76, maxWidth: 680 },
  h1: { fontSize: "3.2rem", lineHeight: 1.18, margin: "18px 0 22px", minHeight: "2.4em" },
  sub: { color: "var(--text-dim)", fontSize: "1.1rem", lineHeight: 1.6, maxWidth: 540, marginBottom: 36 },
  ctaRow: { display: "flex", gap: 16 },
  fadeIn: { animation: "fade-up 0.8s ease 2.6s both" },
};

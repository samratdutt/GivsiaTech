export default function Footer() {
  return (
    <footer id="contact" style={styles.footer}>
      <div className="container" style={styles.inner}>
        <img src="/logo.png" alt="GivsiaTech" style={styles.logo} />
        <p style={styles.copy}>
          Built by Givsia Private Limited &mdash; Websites, AI Automation, SaaS &amp; App Development for growing businesses.
        </p>
        <p style={styles.small}>&copy; {new Date().getFullYear()} GivsiaTech. All rights reserved.</p>
      </div>
    </footer>
  );
}

const styles = {
  footer: { borderTop: "1px solid var(--border)", padding: "56px 0", marginTop: 80 },
  inner: { display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" },
  logo: { height: 28, opacity: 0.85 },
  copy: { color: "var(--text-dim)", fontSize: "0.9rem", maxWidth: 480 },
  small: { color: "var(--text-dim)", fontSize: "0.75rem", opacity: 0.6 },
};

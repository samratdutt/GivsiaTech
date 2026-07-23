import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

const dashboardPath = {
  admin: "/dashboard/admin",
  client: "/dashboard/client",
  service: "/dashboard/service",
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const onDashboard = user && location.pathname === dashboardPath[user.role];
  const onProfile = location.pathname === "/profile";
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu on route change, and lock body scroll while open
  // so the page behind the dropdown can't be scrolled at the same time.
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const navLinks = (
    <>
      <a href="/#services" className="navbar-link" onClick={() => setMenuOpen(false)}>Services</a>
      <a href="/#work" className="navbar-link" onClick={() => setMenuOpen(false)}>Work</a>
      <a href="/#about" className="navbar-link" onClick={() => setMenuOpen(false)}>About</a>
      <a href="/#pricing" className="navbar-link" onClick={() => setMenuOpen(false)}>Pricing</a>
      <a href="/#contact-form" className="navbar-link" onClick={() => setMenuOpen(false)}>Contact</a>
    </>
  );

  const authActions = user ? (
    <>
      <button
        className={`btn btn-ghost nav-dashboard-btn${onDashboard ? " nav-dashboard-btn-active" : ""}`}
        onClick={() => navigate(dashboardPath[user.role] || "/")}
      >
        {user.role} dashboard
      </button>
      <button
        className="btn btn-primary"
        onClick={() => {
          logout();
          navigate("/");
        }}
      >
        Log out
      </button>
      <Link
        to="/profile"
        className={`navbar-avatar${onProfile ? " navbar-avatar-active" : ""}`}
        title={`${user.name} — profile`}
        aria-label="Profile"
      >
        {user.name?.[0]?.toUpperCase() || "U"}
      </Link>
    </>
  ) : (
    <>
      <Link to="/login" className="btn btn-ghost">Log in</Link>
      <Link to="/register" className="btn btn-primary">Get started</Link>
    </>
  );

  return (
    <header className="navbar-glass" style={styles.header}>
      <div className="container" style={styles.inner}>
        <Link to="/" style={styles.brand}>
          <img src="/logo.png" alt="GivsiaTech" style={styles.logo} />
        </Link>

        <nav className="navbar-links-desktop" style={styles.nav}>{navLinks}</nav>

        <div className="navbar-actions-desktop" style={styles.actions}>
          <ThemeToggle />
          {authActions}
        </div>

        <div className="navbar-mobile-controls">
          <ThemeToggle />
          <button
            type="button"
            className={`navbar-hamburger${menuOpen ? " navbar-hamburger-open" : ""}`}
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            <span /><span /><span />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="navbar-mobile-panel">
          <nav className="navbar-mobile-links">{navLinks}</nav>
          <div className="navbar-mobile-actions">{authActions}</div>
        </div>
      )}
    </header>
  );
}

const styles = {
  header: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },
  inner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: 76,
  },
  brand: { display: "flex", alignItems: "center" },
  logo: { height: 34, width: "auto", objectFit: "contain" },
  nav: { display: "flex", gap: 32 },
  actions: { display: "flex", gap: 12, alignItems: "center" },
};

import { useEffect, useState } from "react";
import api from "../api/axios.js";
import { getVisitorId } from "../utils/visitor.js";

const STORAGE_KEY = "givsia_cookie_consent";
// Tracks whether the separate "send me info" opt-in step has already been
// shown once — it's a one-time ask, distinct from cookie consent, never
// re-prompted on later visits regardless of whether they subscribed.
const OPTIN_PROMPTED_KEY = "givsia_optin_prompted";

// Flat, single-color cookie mark (outline body with a bite notch + a few
// crumb dots) — colored per theme via the --cookie-icon-color CSS variable
// (white in dark mode, the light theme's ocean-blue accent in light mode),
// not the theme's usual multi-color gradient treatment.
function CookieIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" width="34" height="34">
      <path d="M12 3a9 9 0 1 0 9 9c0-.6-.5-1-1.1-.9a3.5 3.5 0 0 1-4-4c.1-.6-.3-1.1-.9-1.1a3.5 3.5 0 0 1-4-4c.1-.6-.3-1-1-1z" />
      <circle cx="8.5" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="15.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="11" cy="15" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="9.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [view, setView] = useState("main"); // "main" | "customize" | "optin"
  const [analytics, setAnalytics] = useState(false);
  const [optinForm, setOptinForm] = useState({ name: "", email: "", phone: "" });
  const [optinStatus, setOptinStatus] = useState("idle"); // idle | sending | sent | error

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => setVisible(true), 400);
      return () => clearTimeout(t);
    }
  }, []);

  // The bar spans the full width of the bottom of the screen, which
  // otherwise overlaps and blocks clicks on the chat launcher button
  // (also bottom-anchored) — nudge it up via a body class while the bar
  // is showing instead of coupling the two components directly.
  useEffect(() => {
    document.body.classList.toggle("cookie-bar-open", visible);
    return () => document.body.classList.remove("cookie-bar-open");
  }, [visible]);

  const save = (prefs) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prefs, essential: true, at: Date.now() }));
    // Lets VisitorTracker.jsx track the current page immediately if
    // analytics was just turned on, instead of waiting for the next
    // navigation (it can't just read localStorage on its own — nothing
    // fires a storage event within the same tab that wrote it).
    window.dispatchEvent(new Event("givsia-consent-changed"));

    if (!localStorage.getItem(OPTIN_PROMPTED_KEY)) {
      localStorage.setItem(OPTIN_PROMPTED_KEY, "1");
      setView("optin");
    } else {
      setVisible(false);
    }
  };

  const submitOptin = async (e) => {
    e.preventDefault();
    setOptinStatus("sending");
    try {
      await api.post("/visitors/signup", { ...optinForm, sessionId: getVisitorId() });
      setOptinStatus("sent");
      setTimeout(() => setVisible(false), 1800);
    } catch (err) {
      setOptinStatus("error");
    }
  };

  if (!visible) return null;

  return (
    <div className="cookie-bar">
      <div className="cookie-bar-inner">
        <div className="cookie-bar-icon"><CookieIcon /></div>

        {view === "main" && (
          <>
            <div className="cookie-bar-text">
              <h3 className="cookie-bar-title">Cookie settings</h3>
              <p className="cookie-bar-copy">
                We use local storage to keep you signed in and remember your theme, and optionally cookies for basic
                analytics to improve the site. No personal data is sold or shared.
              </p>
            </div>
            <div className="cookie-bar-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setView("customize")}>Customize</button>
              <button type="button" className="btn btn-ghost" onClick={() => save({ analytics: false })}>Reject</button>
              <button type="button" className="btn btn-primary" onClick={() => save({ analytics: true })}>Accept</button>
            </div>
          </>
        )}

        {view === "customize" && (
          <>
            <div className="cookie-bar-text">
              <h3 className="cookie-bar-title">Customize preferences</h3>
              <label className="cookie-pref-row">
                <span>
                  <strong>Essential</strong> — required for login and theme, always on
                </span>
                <input type="checkbox" checked disabled />
              </label>
              <label className="cookie-pref-row">
                <span>
                  <strong>Analytics</strong> — helps us understand site usage
                </span>
                <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} />
              </label>
            </div>
            <div className="cookie-bar-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setView("main")}>Back</button>
              <button type="button" className="btn btn-primary" onClick={() => save({ analytics })}>Save preferences</button>
            </div>
          </>
        )}

        {view === "optin" && (
          <>
            <div className="cookie-bar-text">
              <h3 className="cookie-bar-title">Want to hear about our services?</h3>
              {optinStatus === "sent" ? (
                <p className="cookie-bar-copy">Thanks — check your inbox!</p>
              ) : (
                <>
                  <p className="cookie-bar-copy">
                    Completely optional, and separate from the cookie choice above — leave your email (and phone, if
                    you like) and we'll send you one note about what GivsiaTech offers. We won't use it for anything
                    else or email you again unless you reach out first.
                  </p>
                  <form onSubmit={submitOptin} className="cookie-optin-form">
                    <input
                      type="text"
                      placeholder="Name (optional)"
                      value={optinForm.name}
                      onChange={(e) => setOptinForm({ ...optinForm, name: e.target.value })}
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      required
                      value={optinForm.email}
                      onChange={(e) => setOptinForm({ ...optinForm, email: e.target.value })}
                    />
                    <input
                      type="tel"
                      placeholder="Phone (optional)"
                      value={optinForm.phone}
                      onChange={(e) => setOptinForm({ ...optinForm, phone: e.target.value })}
                    />
                    <button type="submit" className="btn btn-primary" disabled={optinStatus === "sending"}>
                      {optinStatus === "sending" ? "Sending..." : "Send me info"}
                    </button>
                  </form>
                  {optinStatus === "error" && (
                    <p className="cookie-bar-copy" style={{ color: "#ff6b6b" }}>Something went wrong — try again later.</p>
                  )}
                </>
              )}
            </div>
            <div className="cookie-bar-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setVisible(false)}>
                {optinStatus === "sent" ? "Close" : "No thanks"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

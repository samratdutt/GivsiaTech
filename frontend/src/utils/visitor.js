// Shared by CookieConsent.jsx (writes consent) and VisitorTracker.jsx
// (reads it) — kept here instead of duplicated so the two never drift on
// the storage key or the shape of what's stored.
const CONSENT_KEY = "givsia_cookie_consent";
const VISITOR_ID_KEY = "givsia_visitor_id";

export function hasAnalyticsConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return false;
    return JSON.parse(raw)?.analytics === true;
  } catch {
    return false;
  }
}

// A random, anonymous per-browser id — not tied to a name/email unless the
// visitor separately submits the opt-in form (see CookieConsent.jsx), which
// sends this same id along so admin can (optionally) see which analytics
// session a signup came from.
export function getVisitorId() {
  let id = localStorage.getItem(VISITOR_ID_KEY);
  if (!id) {
    id = typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(VISITOR_ID_KEY, id);
  }
  return id;
}

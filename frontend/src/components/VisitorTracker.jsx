import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import api from "../api/axios.js";
import { hasAnalyticsConsent, getVisitorId } from "../utils/visitor.js";

// Fires a lightweight pageview ping on every route change, but only once
// the visitor has explicitly opted into analytics cookies (see
// CookieConsent.jsx) — a no-op otherwise. Also listens for the
// "givsia-consent-changed" event CookieConsent dispatches right after
// saving, so accepting analytics mid-visit tracks the current page
// immediately instead of waiting for the next navigation.
export default function VisitorTracker() {
  const location = useLocation();

  useEffect(() => {
    const track = () => {
      if (!hasAnalyticsConsent()) return;
      api.post("/visitors/track", {
        sessionId: getVisitorId(),
        path: location.pathname,
        referrer: document.referrer || "",
      }).catch(() => {});
    };

    track();
    window.addEventListener("givsia-consent-changed", track);
    return () => window.removeEventListener("givsia-consent-changed", track);
  }, [location.pathname]);

  return null;
}

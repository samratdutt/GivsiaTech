// Shared live-format checks for ValidatedInput (see components/ValidatedInput.jsx).
// Deliberately format-only — matching what the field itself can tell just
// from the characters typed, not "does this email/phone actually exist."
// Real validity (a phone that actually receives the OTP, an email that
// isn't already registered) is still enforced server-side exactly as before;
// this is purely the live red/green cue while typing.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value) {
  return EMAIL_RE.test(String(value || "").trim());
}

// Mirrors backend/routes/authRoutes.js's normalizePhone acceptance rule:
// either "+<countrycode><8-15 digits>" as typed, or a bare 10-digit local
// number (assumed Indian, +91 gets prepended server-side).
const PHONE_INTL_RE = /^\+\d{8,15}$/;
const PHONE_LOCAL_RE = /^\d{10}$/;

export function isValidPhone(value) {
  const trimmed = String(value || "").replace(/[\s-]/g, "");
  return PHONE_INTL_RE.test(trimmed) || PHONE_LOCAL_RE.test(trimmed);
}

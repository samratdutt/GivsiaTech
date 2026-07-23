function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </svg>
  );
}

// Drop-in replacement for <input> (same props work unchanged) that shows a
// live red/green status icon at the right edge once the field has content —
// red while the value doesn't match `isValid`, green the instant it does.
// Used for email/phone fields specifically (see utils/validators.js) across
// Register, Login, Contact, and the admin "add user" form.
export default function ValidatedInput({ isValid, value, style, ...props }) {
  const hasContent = String(value ?? "").length > 0;

  return (
    <div className="validated-field">
      <input
        value={value}
        style={{ ...style, paddingRight: hasContent ? 40 : undefined }}
        {...props}
      />
      {hasContent && (
        <span className={`validated-field-icon ${isValid ? "is-valid" : "is-invalid"}`}>
          {isValid ? <CheckIcon /> : <AlertIcon />}
        </span>
      )}
    </div>
  );
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="26" height="26">
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    </svg>
  );
}

// Themed replacement for window.confirm() — every destructive action
// sitewide (delete an order/review/user/lead/tier/portfolio item/outreach
// record, cancel a project) goes through this instead of the native
// browser dialog, mounted once via ConfirmContext/ConfirmProvider.
export default function ConfirmDialog({ open, message, onCancel, onConfirm }) {
  if (!open) return null;

  return (
    <div className="confirm-backdrop" onClick={onCancel}>
      <div className="confirm-panel" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-describedby="confirm-message">
        <div className="confirm-icon"><WarningIcon /></div>
        <p id="confirm-message" className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} autoFocus>Confirm</button>
        </div>
      </div>
    </div>
  );
}

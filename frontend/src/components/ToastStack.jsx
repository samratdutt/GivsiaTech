const ICONS = {
  success: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <path d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  ),
};

// Small, top-of-screen, auto-dismissing feedback popups — used everywhere
// the app needs to report the result of an action (saved, deleted, failed,
// blocked) without blocking the page the way window.alert() does.
export default function ToastStack({ toasts, dismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-item toast-item-${t.type}${t.leaving ? " toast-item-leaving" : ""}`}
          onClick={() => dismiss(t.id)}
        >
          <span className="toast-item-icon">{ICONS[t.type] || ICONS.info}</span>
          <span className="toast-item-message">{t.message}</span>
        </div>
      ))}
    </div>
  );
}

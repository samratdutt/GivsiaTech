import { createContext, useCallback, useContext, useRef, useState } from "react";
import ToastStack from "../components/ToastStack.jsx";

const ToastContext = createContext(null);
const EXIT_DURATION_MS = 300; // must match the CSS toast-slide-out animation duration
let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  // Two-phase removal — mark "leaving" first so the exit animation can
  // play, then actually drop it from state once that animation finishes.
  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), EXIT_DURATION_MS);
  }, []);

  const showToast = useCallback((message, type = "info", duration = 4500) => {
    const id = ++idCounter;
    setToasts((prev) => [...prev, { id, message, type, leaving: false }]);
    timers.current[id] = setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast, dismiss }}>
      {children}
      <ToastStack toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

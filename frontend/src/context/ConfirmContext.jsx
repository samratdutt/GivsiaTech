import { createContext, useCallback, useContext, useRef, useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog.jsx";

const ConfirmContext = createContext(null);

// Same shape as ToastContext — one dialog instance mounted globally,
// resolved with a Promise<boolean> so call sites can do
// `if (!(await confirm("..."))) return;`, a near 1:1 swap for the
// `if (!confirm("...")) return;` pattern this replaces everywhere.
export function ConfirmProvider({ children }) {
  const [message, setMessage] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback((msg) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setMessage(msg);
    });
  }, []);

  const settle = (result) => {
    setMessage(null);
    resolveRef.current?.(result);
    resolveRef.current = null;
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={message !== null}
        message={message}
        onCancel={() => settle(false)}
        onConfirm={() => settle(true)}
      />
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);

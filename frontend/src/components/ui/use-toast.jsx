import React from "react";

const ToastContext = React.createContext({
  toasts: [],
  push: () => {},
  remove: () => {},
});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = React.useState([]);

  const push = React.useCallback(({ title, description, variant = "default", duration = 3200 }) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, title, description, variant }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const remove = React.useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const value = React.useMemo(() => ({ toasts, push, remove }), [toasts, push, remove]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const { push } = React.useContext(ToastContext);
  return {
    toast: ({ title, description, variant, duration }) => push({ title, description, variant, duration }),
  };
}

// export “toast” helper (style shadcn)
export const toast = (opts) => {
  // hook-less bridge: consumers import { toast } directly
  // We'll mount a hidden event. Toaster listens and pushes.
  const ev = new CustomEvent("app:toast", { detail: opts });
  window.dispatchEvent(ev);
};

// internal helper for Toaster to subscribe
export function _subscribeToasts(cb) {
  const handler = (e) => cb(e.detail);
  window.addEventListener("app:toast", handler);
  return () => window.removeEventListener("app:toast", handler);
}

// For consumers that use <Toaster /> already
export default ToastContext;

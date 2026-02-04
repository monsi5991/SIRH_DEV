// src/components/ui/use-toast.js
import * as React from "react";
import PropTypes from "prop-types";

/**
 * Contexte + Provider
 * - IDs forts (crypto)
 * - auto-dismiss avec nettoyage des timeouts
 * - remove() public et safe
 * - valeur par défaut typée correctement
 */

const noop = () => {};
const ToastContext = React.createContext({
  toasts: [],
  push: noop,
  remove: noop,
});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = React.useState([]);
  // stocke les timeouts pour cleanup
  const timersRef = React.useRef(new Map());

  const push = React.useCallback(
    ({ title, description, variant = "default", duration = 3200 } = {}) => {
      const id = cryptoRandomId();
      setToasts((t) => [...t, { id, title, description, variant }]);

      if (duration > 0) {
        const timer = setTimeout(() => {
          setToasts((t) => t.filter((x) => x.id !== id));
          timersRef.current.delete(id);
        }, duration);
        timersRef.current.set(id, timer);
      }
      return id;
    },
    []
  );

  const remove = React.useCallback((id) => {
    // supprime le toast et nettoie son timer s’il existe
    setToasts((t) => t.filter((x) => x.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  // cleanup à l’unmount
  React.useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const value = React.useMemo(() => ({ toasts, push, remove }), [toasts, push, remove]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

/**
 * Hook d’usage (style shadcn)
 * - expose toast(), remove(), toasts
 */
export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within <ToastProvider />");
  }
  return {
    toast: ({ title, description, variant, duration } = {}) =>
      ctx.push({ title, description, variant, duration }),
    remove: ctx.remove,
    toasts: ctx.toasts,
  };
}

/**
 * Helper “toast” sans hook (bridge CustomEvent)
 * - safe côté SSR
 */
export const toast = (opts = {}) => {
  if (typeof window === "undefined") return;
  try {
    const ev = new CustomEvent("app:toast", { detail: opts });
    window.dispatchEvent(ev);
  } catch {
    // Fallback très ancien navigateur
    const ev = document.createEvent?.("CustomEvent");
    if (ev?.initCustomEvent) {
      ev.initCustomEvent("app:toast", true, true, opts);
      window.dispatchEvent(ev);
    }
  }
};

/**
 * Abonnement pour un composant <Toaster />
 * - retourne une fonction de désabonnement
 */
export function _subscribeToasts(cb) {
  const handler = (e) => cb(e.detail);
  if (typeof window !== "undefined") {
    window.addEventListener("app:toast", handler);
    return () => window.removeEventListener("app:toast", handler);
  }
  return () => {};
}

// Export par défaut conservé pour compat
export default ToastContext;

/* Utils */
function cryptoRandomId() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const b = new Uint32Array(2);
    crypto.getRandomValues(b);
    return b[0].toString(36) + b[1].toString(36);
    }
  return Math.random().toString(36).slice(2);
}

// src/components/ui/toaster.jsx
import * as React from "react";
import PropTypes from "prop-types";

import {
  ToastProvider as RadixProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
} from "./toast";
import { ToastProvider as AppToastProvider, useToast, _subscribeToasts } from "./use-toast";

/**
 * <BridgeSubscriber />
 * Écoute l’événement global "app:toast" (helper toast()) et pousse dans le contexte.
 */
function BridgeSubscriber() {
  const { toast } = useToast();
  React.useEffect(() => {
    const unsub = _subscribeToasts((opts) => toast(opts));
    return () => unsub?.();
  }, [toast]);
  return null;
}

/**
 * Mappe une position style sonner vers des classes shadcn (viewport).
 */
function viewportPositionClass(position) {
  switch (position) {
    case "top-right":
      return "fixed top-0 right-0 flex max-h-screen w-full flex-col p-4 md:max-w-[420px] gap-2 z-[100]";
    case "top-left":
      return "fixed top-0 left-0 flex max-h-screen w-full flex-col p-4 md:max-w-[420px] gap-2 z-[100]";
    case "bottom-right":
      return "fixed bottom-0 right-0 flex max-h-screen w-full flex-col p-4 md:max-w-[420px] gap-2 z-[100]";
    case "bottom-left":
      return "fixed bottom-0 left-0 flex max-h-screen w-full flex-col p-4 md:max-w-[420px] gap-2 z-[100]";
    case "top-center":
      return "fixed top-0 left-1/2 -translate-x-1/2 flex max-h-screen w-full max-w-[640px] flex-col p-4 gap-2 z-[100]";
    case "bottom-center":
      return "fixed bottom-0 left-1/2 -translate-x-1/2 flex max-h-screen w-full max-w-[640px] flex-col p-4 gap-2 z-[100]";
    default:
      return "fixed top-0 right-0 flex max-h-screen w-full flex-col p-4 md:max-w-[420px] gap-2 z-[100]";
  }
}

function ToastList({ closeButton, position }) {
  const { toasts, remove } = useToast();

  return (
    <>
      {toasts.map((t) => (
        <Toast
          key={t.id}
          onOpenChange={(open) => {
            if (!open) remove(t.id);
          }}
          data-variant={t.variant ?? "default"}
          className="group"
        >
          {t.title && <ToastTitle>{t.title}</ToastTitle>}
          {t.description && <ToastDescription>{t.description}</ToastDescription>}
          {closeButton !== false && <ToastClose />}
        </Toast>
      ))}

      <ToastViewport className={viewportPositionClass(position)} />
    </>
  );
}

ToastList.propTypes = {
  closeButton: PropTypes.bool,
  position: PropTypes.string,
};

/**
 * Toaster
 */
export function Toaster({
  theme = "system",
  position = "top-right",
  swipeDirection = "right",
  closeButton = true,
  defaultDuration = 3200,
}) {
  const resolvedTheme =
    theme === "system"
      ? (typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-color-scheme: dark)")?.matches
          ? "dark"
          : "light")
      : theme;

  return (
    <AppToastProvider>
      <div data-theme={resolvedTheme}>
        <RadixProvider swipeDirection={swipeDirection} duration={defaultDuration}>
          <BridgeSubscriber />
          <ToastList closeButton={closeButton} position={position} />
        </RadixProvider>
      </div>
    </AppToastProvider>
  );
}

Toaster.propTypes = {
  theme: PropTypes.string,
  position: PropTypes.string,
  swipeDirection: PropTypes.string,
  closeButton: PropTypes.bool,
  defaultDuration: PropTypes.number,
};

export default Toaster;

// src/components/ui/toaster.jsx
import * as React from "react";
import {
  ToastProvider as RadixProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
} from "./toast";
import { ToastProvider as AppToastProvider, useToast, _subscribeToasts } from "./use-toast";
import PropTypes from "prop-types";

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
          // onOpenChange est déclenché quand l’utilisateur ferme le toast (clic/gesture).
          onOpenChange={(open) => {
            if (!open) remove(t.id);
          }}
          // data-variant pour tes styles conditionnels Tailwind/CSS si besoin
          data-variant={t.variant ?? "default"}
          className="group"
        >
          {t.title && <ToastTitle>{t.title}</ToastTitle>}
          {t.description && <ToastDescription>{t.description}</ToastDescription>}
          {closeButton !== false && <ToastClose />}
        </Toast>
      ))}
      {/* Positionnement du viewport */}
      <ToastViewport className={viewportPositionClass(position)} />
    </>
  );
}

/**
 * Toaster
 * Props similaires à ton ancien composant:
 * - theme: "light" | "dark" | "system" (utilisé comme data-theme pour tes styles)
 * - position: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center" | "bottom-center"
 * - swipeDirection: "right" | "left" | "up" | "down" (Radix)
 * - closeButton: bool (afficher le bouton de fermeture)
 * - defaultDuration: durée par défaut pour Radix (les auto-dismiss viennent déjà du provider custom)
 */
export function Toaster({
  theme = "system",
  position = "top-right",
  swipeDirection = "right",
  closeButton = true,
  defaultDuration = 3200,
}) {
  // Résolution du thème system -> data-theme (tes styles peuvent cibler [data-theme="dark"])
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

export default Toaster;

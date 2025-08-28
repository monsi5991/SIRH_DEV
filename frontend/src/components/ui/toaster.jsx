// src/components/ui/toaster.jsx
import React from "react";
import PropTypes from "prop-types";
import { Toaster as SonnerToaster } from "sonner";

/**
 * Props:
 * - theme: "light" | "dark" | "system" (par défaut "system")
 * - ...props : toute prop supportée par sonner
 *
 * Détection "system" via matchMedia si aucune prop theme fournie.
 */
export function Toaster({
  theme = "system",
  position = "top-right",
  expand = true,
  richColors = true,
  closeButton = true,
  ...props
}) {
  // Détecte le thème système si "system"
  const resolvedTheme =
    theme === "system"
      ? (typeof window !== "undefined" &&
         window.matchMedia &&
         window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light")
      : theme;

  return (
    <SonnerToaster
      theme={resolvedTheme}
      richColors={richColors}
      closeButton={closeButton}
      position={position}
      expand={expand}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}

Toaster.propTypes = {
  theme: PropTypes.oneOf(["light", "dark", "system"]),
  position: PropTypes.string,
  expand: PropTypes.bool,
  richColors: PropTypes.bool,
  closeButton: PropTypes.bool,
};

export default Toaster;

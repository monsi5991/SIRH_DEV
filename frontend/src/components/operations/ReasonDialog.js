// src/components/operations/ReasonDialog.jsx
import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import PropTypes from "prop-types";
import { Button } from "../ui/button";

export default function ReasonDialog({ open, title = "Motif requis", label = "Expliquez votre décision", actionLabel = "Confirmer", onConfirm, onClose }) {
  const ref = useRef(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) { setReason(""); return; }
    const prev = document.activeElement;
    ref.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="reason-title" tabIndex={-1} ref={ref}
           className="bg-white w-full max-w-lg rounded-2xl shadow-xl outline-none">
        <div className="p-4 flex items-center justify-between border-b">
          <h2 id="reason-title" className="font-semibold">{title}</h2>
          <button type="button" aria-label="Fermer" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">
          <label htmlFor="reason" className="block text-sm text-gray-600 mb-2">{label}</label>
          <textarea id="reason" value={reason} onChange={(e)=>setReason(e.target.value)}
                    rows={4} className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" type="button" onClick={onClose}>Annuler</Button>
            <Button type="button" disabled={!reason.trim()} onClick={() => onConfirm?.(reason.trim())}
                    className="bg-emerald-600 hover:bg-emerald-700">{actionLabel}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

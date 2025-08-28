// src/components/operations/LeaveFormDialog.js
import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { X, Calendar } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

export default function LeaveFormDialog({ open, onClose, onSubmit, defaultEmployee }) {
  const rootRef = useRef(null);
  const [employee, setEmployee] = useState(defaultEmployee || "");
  const [start, setStart]       = useState("");
  const [end, setEnd]           = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // focus + ESC pour fermer
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    rootRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      // reset quand on ferme
      setSubmitting(false);
      setError("");
      setStart("");
      setEnd("");
      setEmployee(defaultEmployee || "");
    }
  }, [open, defaultEmployee]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!employee.trim() || !start || !end) {
      setError("Veuillez renseigner l’employé, la date de début et la date de fin.");
      return;
    }
    try {
      setSubmitting(true);
      await onSubmit({ employee: employee.trim(), start, end }); // status = Pending côté page
    } catch (err) {
      setError(err?.message || "Échec de l’envoi de la demande.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="leave-dialog-title"
        tabIndex={-1}
        ref={rootRef}
        className="bg-white w-full max-w-lg rounded-2xl shadow-xl outline-none"
      >
        <Card className="border-0 shadow-none">
          <CardHeader className="flex items-center justify-between">
            <CardTitle id="leave-dialog-title" className="flex items-center gap-2">
              <Calendar className="w-5 h-5" /> Demander un congé
            </CardTitle>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </CardHeader>
          <CardContent>
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Employé</label>
                <input
                  type="text"
                  value={employee}
                  onChange={(e) => setEmployee(e.target.value)}
                  placeholder="Ex: Awa Diop"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Début</label>
                  <input
                    type="date"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Fin</label>
                  <input
                    type="date"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Annuler
                </Button>
                <Button type="submit" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
                  {submitting ? "Envoi…" : "Envoyer la demande"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

LeaveFormDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  defaultEmployee: PropTypes.string,
};

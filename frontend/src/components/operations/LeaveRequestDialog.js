import React, { useState } from "react";
import PropTypes from "prop-types";
import { post } from "../../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";

export default function LeaveRequestDialog({
  open,
  onClose,
  onCreated,
  defaultEmployee = "",
}) {
  const [employee, setEmployee] = useState(defaultEmployee);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!employee || !start || !end) {
      setErr("Employé, date de début et date de fin sont obligatoires.");
      return;
    }
    setSubmitting(true);
    try {
      // Backend attendu: { employee, start, end, status? }
      await post("/operations/leaves", {
        employee,
        start,
        end,
        status: "Pending",
      });
      onCreated?.();
      onClose?.();
    } catch (e2) {
      setErr(e2?.message || "Échec de la création");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Demander un congé</CardTitle>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Fermer"
            >
              ✕
            </button>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              {err && <div className="text-sm text-red-600">{err}</div>}

              <div>
                <label className="block text-sm text-gray-700 mb-1">Employé</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={employee}
                  onChange={(e) => setEmployee(e.target.value)}
                  placeholder="Ex: Awa Diop"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Début</label>
                  <input
                    type="date"
                    className="w-full border rounded-lg px-3 py-2"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Fin</label>
                  <input
                    type="date"
                    className="w-full border rounded-lg px-3 py-2"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={onClose}>
                  Annuler
                </Button>
                <Button type="submit" disabled={submitting}>
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

LeaveRequestDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onCreated: PropTypes.func,
  defaultEmployee: PropTypes.string,
};

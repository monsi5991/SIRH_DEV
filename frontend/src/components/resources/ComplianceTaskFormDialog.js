import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";

const Schema = z.object({
  label: z.string().min(3, "Libellé requis"),
  category: z.string().min(2, "Catégorie requise"),
  employeeId: z.string().optional(),
  dueAt: z.string().optional(),
  notes: z.string().optional(),
  obligationKey: z.string().optional(),
});

export default function ComplianceTaskFormDialog({ open, onClose, onSubmit, employees = [], obligations = [] }) {
  const [form, setForm] = useState({ label: "", category: "", employeeId: "", dueAt: "", notes: "", obligationKey: "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));
  const employeeOptions = useMemo(() => employees || [], [employees]);

  const submit = async (e) => {
    e.preventDefault();
    const parsed = Schema.safeParse(form);
    if (!parsed.success) {
      const next = {};
      parsed.error.issues.forEach((i) => { next[i.path[0]] = i.message; });
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSubmit({ ...parsed.data, employeeId: parsed.data.employeeId || null, dueAt: parsed.data.dueAt || null, notes: parsed.data.notes || "", obligationKey: parsed.data.obligationKey || "" });
      onClose();
      setForm({ label: "", category: "", employeeId: "", dueAt: "", notes: "", obligationKey: "" });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouvelle tâche conformité</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <input className="w-full border rounded-lg px-3 py-2" placeholder="Libellé" value={form.label} onChange={(e) => set("label", e.target.value)} />
          {errors.label && <p className="text-xs text-red-600">{errors.label}</p>}
          <div className="grid grid-cols-2 gap-3">
            <input className="border rounded-lg px-3 py-2" placeholder="Catégorie" value={form.category} onChange={(e) => set("category", e.target.value)} />
            <input type="date" className="border rounded-lg px-3 py-2" value={form.dueAt} onChange={(e) => set("dueAt", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select className="border rounded-lg px-3 py-2" value={form.employeeId} onChange={(e) => set("employeeId", e.target.value)}>
              <option value="">Affectation (optionnel)</option>
              {employeeOptions.map((emp) => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>)}
            </select>
            <select className="border rounded-lg px-3 py-2" value={form.obligationKey} onChange={(e) => set("obligationKey", e.target.value)}>
              <option value="">Obligation (optionnel)</option>
              {obligations.map((o) => <option key={o.id || o.key} value={o.key}>{o.key} — {o.label}</option>)}
            </select>
          </div>
          <textarea rows={3} className="w-full border rounded-lg px-3 py-2" placeholder="Notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Annuler</Button><Button type="submit" disabled={saving}>{saving ? "Création..." : "Créer"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

ComplianceTaskFormDialog.propTypes = { open: PropTypes.bool.isRequired, onClose: PropTypes.func.isRequired, onSubmit: PropTypes.func.isRequired, employees: PropTypes.array, obligations: PropTypes.array };

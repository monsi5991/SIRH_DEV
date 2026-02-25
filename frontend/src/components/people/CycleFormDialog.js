import React, { useState } from "react";
import PropTypes from "prop-types";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";

const Schema = z.object({
  name: z.string().min(2, "Nom requis"),
  period: z.string().min(2, "Période requise"),
  startDate: z.string().min(1, "Date début requise"),
  endDate: z.string().min(1, "Date fin requise"),
});

export default function CycleFormDialog({ open, onClose, onSubmit }) {
  const [form, setForm] = useState({ name: "", period: "", startDate: "", endDate: "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

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
      await onSubmit(parsed.data);
      onClose();
      setForm({ name: "", period: "", startDate: "", endDate: "" });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouveau cycle d’évaluation</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <input className="w-full border rounded-lg px-3 py-2" placeholder="Nom" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} />
          {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
          <input className="w-full border rounded-lg px-3 py-2" placeholder="Période (ex: 2026-H1)" value={form.period} onChange={(e) => setForm((s) => ({ ...s, period: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <input type="date" className="border rounded-lg px-3 py-2" value={form.startDate} onChange={(e) => setForm((s) => ({ ...s, startDate: e.target.value }))} />
            <input type="date" className="border rounded-lg px-3 py-2" value={form.endDate} onChange={(e) => setForm((s) => ({ ...s, endDate: e.target.value }))} />
          </div>
          {(errors.startDate || errors.endDate || errors.period) && <p className="text-xs text-red-600">{errors.startDate || errors.endDate || errors.period}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Annuler</Button><Button type="submit" disabled={saving}>{saving ? "Création..." : "Créer"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

CycleFormDialog.propTypes = { open: PropTypes.bool.isRequired, onClose: PropTypes.func.isRequired, onSubmit: PropTypes.func.isRequired };

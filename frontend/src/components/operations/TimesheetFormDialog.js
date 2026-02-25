import React, { useState } from "react";
import PropTypes from "prop-types";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";

const Schema = z.object({
  employee: z.string().min(2, "Employé requis"),
  date: z.string().min(1, "Date requise"),
  hours: z.coerce.number().min(0.5, "Heures invalides").max(24, "Max 24h"),
  project: z.string().optional(),
  note: z.string().optional(),
  type: z.enum(["REG", "OT_DAY", "OT_NIGHT", "OT_SUN", "OT_HOL"]).default("REG"),
  premium: z.union([z.literal(""), z.coerce.number().min(0).max(5)]).optional(),
});

export default function TimesheetFormDialog({ open, onClose, onSubmit }) {
  const [form, setForm] = useState({ employee: "", date: new Date().toISOString().slice(0, 10), hours: "8", project: "", note: "", type: "REG", premium: "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

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
      await onSubmit({
        employee: parsed.data.employee,
        date: parsed.data.date,
        hours: parsed.data.hours,
        project: parsed.data.project || undefined,
        note: parsed.data.note || undefined,
        type: parsed.data.type,
        premium: parsed.data.premium === "" ? undefined : Number(parsed.data.premium),
      });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouvelle feuille de temps</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <input className="w-full border rounded-lg px-3 py-2" placeholder="Employé" value={form.employee} onChange={(e) => set("employee", e.target.value)} />
          {errors.employee && <p className="text-xs text-red-600">{errors.employee}</p>}
          <div className="grid grid-cols-2 gap-3">
            <input type="date" className="w-full border rounded-lg px-3 py-2" value={form.date} onChange={(e) => set("date", e.target.value)} />
            <input type="number" min="0.5" max="24" step="0.5" className="w-full border rounded-lg px-3 py-2" value={form.hours} onChange={(e) => set("hours", e.target.value)} />
          </div>
          {(errors.date || errors.hours) && <p className="text-xs text-red-600">{errors.date || errors.hours}</p>}
          <div className="grid grid-cols-2 gap-3">
            <input className="w-full border rounded-lg px-3 py-2" placeholder="Projet" value={form.project} onChange={(e) => set("project", e.target.value)} />
            <select className="w-full border rounded-lg px-3 py-2" value={form.type} onChange={(e) => set("type", e.target.value)}>
              <option value="REG">REG</option><option value="OT_DAY">OT_DAY</option><option value="OT_NIGHT">OT_NIGHT</option><option value="OT_SUN">OT_SUN</option><option value="OT_HOL">OT_HOL</option>
            </select>
          </div>
          <input type="number" step="0.01" min="0" placeholder="Premium (optionnel)" className="w-full border rounded-lg px-3 py-2" value={form.premium} onChange={(e) => set("premium", e.target.value)} />
          <textarea rows={3} className="w-full border rounded-lg px-3 py-2" placeholder="Note" value={form.note} onChange={(e) => set("note", e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : "Créer"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

TimesheetFormDialog.propTypes = { open: PropTypes.bool.isRequired, onClose: PropTypes.func.isRequired, onSubmit: PropTypes.func.isRequired };

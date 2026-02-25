import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";

const Schema = z.object({
  title: z.string().min(2, "Titre requis"),
  status: z.enum(["on_track", "at_risk", "off_track"]),
  progress: z.coerce.number().min(0, "Min 0").max(100, "Max 100"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export default function GoalEditDialog({ open, goal, onClose, onSubmit }) {
  const [form, setForm] = useState({ title: "", status: "on_track", progress: 0, startDate: "", endDate: "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!goal) return;
    setForm({
      title: goal.title || "",
      status: goal.status || "on_track",
      progress: goal.progress ?? 0,
      startDate: goal.startDate ? String(goal.startDate).slice(0, 10) : "",
      endDate: goal.endDate ? String(goal.endDate).slice(0, 10) : "",
    });
  }, [goal]);

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
      await onSubmit(parsed.data);
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Éditer l’objectif</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <input className="w-full border rounded-lg px-3 py-2" value={form.title} onChange={(e) => set("title", e.target.value)} />
          {errors.title && <p className="text-xs text-red-600">{errors.title}</p>}
          <div className="grid grid-cols-2 gap-3">
            <select className="border rounded-lg px-3 py-2" value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="on_track">En bonne voie</option>
              <option value="at_risk">À risque</option>
              <option value="off_track">En retard</option>
            </select>
            <input type="number" min="0" max="100" className="border rounded-lg px-3 py-2" value={form.progress} onChange={(e) => set("progress", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="date" className="border rounded-lg px-3 py-2" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
            <input type="date" className="border rounded-lg px-3 py-2" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
          </div>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Annuler</Button><Button type="submit" disabled={saving}>{saving ? "Sauvegarde..." : "Enregistrer"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

GoalEditDialog.propTypes = { open: PropTypes.bool.isRequired, goal: PropTypes.object, onClose: PropTypes.func.isRequired, onSubmit: PropTypes.func.isRequired };

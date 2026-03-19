import React, { useState } from "react";
import PropTypes from "prop-types";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";

const Schema = z.object({
  title: z.string().min(3, "Titre requis"),
  date: z.string().min(1, "Date requise"),
  time: z.string().optional(),
  type: z.enum(["meeting", "training", "deadline", "other"]),
  description: z.string().optional(),
  location: z.string().optional(),
  attendees: z.string().optional(),
});

export default function EventFormDialog({ open, onClose, onSubmit }) {
  const [form, setForm] = useState({ title: "", date: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10), time: "10:00", type: "meeting", description: "", location: "", attendees: "" });
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
      await onSubmit({ ...parsed.data, attendees: parsed.data.attendees?.split(",").map((x) => x.trim()).filter(Boolean) || [] });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouvel evenement</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <input className="w-full border rounded-lg px-3 py-2" placeholder="Titre de l'evenement" value={form.title} onChange={(e) => set("title", e.target.value)} />
          {errors.title && <p className="text-xs text-red-600">{errors.title}</p>}
          <div className="grid grid-cols-3 gap-3">
            <input type="date" className="border rounded-lg px-3 py-2" value={form.date} onChange={(e) => set("date", e.target.value)} />
            <input type="time" className="border rounded-lg px-3 py-2" value={form.time} onChange={(e) => set("time", e.target.value)} />
            <select className="border rounded-lg px-3 py-2" value={form.type} onChange={(e) => set("type", e.target.value)}>
              <option value="meeting">Reunion</option>
              <option value="training">Formation</option>
              <option value="deadline">Echeance</option>
              <option value="other">Autre</option>
            </select>
          </div>
          <input className="w-full border rounded-lg px-3 py-2" placeholder="Lieu" value={form.location} onChange={(e) => set("location", e.target.value)} />
          <textarea className="w-full border rounded-lg px-3 py-2" rows={3} placeholder="Objectif, contexte ou informations utiles" value={form.description} onChange={(e) => set("description", e.target.value)} />
          <input className="w-full border rounded-lg px-3 py-2" placeholder="Participants (emails separes par une virgule)" value={form.attendees} onChange={(e) => set("attendees", e.target.value)} />
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Annuler</Button><Button type="submit" disabled={saving}>{saving ? "Creation..." : "Creer"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

EventFormDialog.propTypes = { open: PropTypes.bool.isRequired, onClose: PropTypes.func.isRequired, onSubmit: PropTypes.func.isRequired };

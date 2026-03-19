import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";

const Schema = z.object({
  employee: z.string().min(2, "Employé requis (min 2 caractères)"),
  date: z.string().min(1, "Date requise"),
  category: z.string().min(2, "Catégorie requise"),
  amount: z.coerce.number().positive("Montant invalide"),
  currency: z.string().length(3, "Devise sur 3 lettres").transform((v) => v.toUpperCase()),
  taxTreatment: z.enum(["REIMBURSEMENT", "TAXABLE", "MIXED"]).default("REIMBURSEMENT"),
  note: z.string().optional(),
});

const TEMPLATES = {
  mission: {
    label: "Mission",
    category: "Mission",
    taxTreatment: "REIMBURSEMENT",
    helper: "Transport, hôtel et repas liés à une mission validée.",
  },
  deplacement: {
    label: "Déplacement",
    category: "Transport",
    taxTreatment: "REIMBURSEMENT",
    helper: "Taxi, carburant ou déplacement terrain avec justificatif.",
  },
  repas: {
    label: "Repas",
    category: "Repas",
    taxTreatment: "REIMBURSEMENT",
    helper: "Repas professionnel plafonné selon la politique frais.",
  },
};

export default function ExpenseFormDialog({ open, onClose, onSubmit, preset }) {
  const [form, setForm] = useState({
    employee: "",
    date: new Date().toISOString().slice(0, 10),
    category: "",
    amount: "",
    currency: "XOF",
    taxTreatment: "REIMBURSEMENT",
    note: "",
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const template = preset ? TEMPLATES[preset] : null;

  const canSubmit = useMemo(() => !saving, [saving]);

  React.useEffect(() => {
    if (!open) return;
    if (!template) return;
    setForm((current) => ({
      ...current,
      category: current.category || template.category,
      taxTreatment: template.taxTreatment,
      note: current.note || template.helper,
    }));
  }, [open, template]);

  const submit = async (e) => {
    e.preventDefault();
    const parsed = Schema.safeParse(form);
    if (!parsed.success) {
      const next = {};
      for (const issue of parsed.error.issues) next[issue.path[0]] = issue.message;
      setErrors(next);
      return;
    }

    setErrors({});
    try {
      setSaving(true);
      await onSubmit({
        employee: parsed.data.employee,
        date: parsed.data.date,
        category: parsed.data.category,
        amount: parsed.data.amount,
        currency: parsed.data.currency,
        taxTreatment: parsed.data.taxTreatment,
        note: parsed.data.note || undefined,
      });
      onClose();
      setForm({
        employee: "",
        date: new Date().toISOString().slice(0, 10),
        category: "",
        amount: "",
        currency: "XOF",
        taxTreatment: "REIMBURSEMENT",
        note: "",
      });
    } finally {
      setSaving(false);
    }
  };

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle dépense</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
            <div className="text-sm font-medium text-slate-900">Créer en 30 secondes</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(TEMPLATES).map(([key, item]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, category: item.category, taxTreatment: item.taxTreatment, note: item.helper }))}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${preset === key ? "bg-emerald-600 text-white" : "bg-white text-emerald-700"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="text-xs text-slate-600">Choisissez un modèle puis ajustez le montant. Le justificatif photo peut être ajouté dans la prochaine itération backend.</div>
          </div>
          <div>
            <label className="text-sm">Employé *</label>
            <input className="w-full border rounded-lg px-3 py-2" value={form.employee} onChange={(e) => set("employee", e.target.value)} />
            {errors.employee && <p className="text-xs text-red-600">{errors.employee}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm">Date *</label>
              <input type="date" className="w-full border rounded-lg px-3 py-2" value={form.date} onChange={(e) => set("date", e.target.value)} />
              {errors.date && <p className="text-xs text-red-600">{errors.date}</p>}
            </div>
            <div>
              <label className="text-sm">Montant *</label>
              <input type="number" min="1" className="w-full border rounded-lg px-3 py-2" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
              {errors.amount && <p className="text-xs text-red-600">{errors.amount}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm">Catégorie *</label>
              <input className="w-full border rounded-lg px-3 py-2" value={form.category} onChange={(e) => set("category", e.target.value)} />
              {errors.category && <p className="text-xs text-red-600">{errors.category}</p>}
            </div>
            <div>
              <label className="text-sm">Devise</label>
              <input maxLength={3} className="w-full border rounded-lg px-3 py-2" value={form.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} />
              {errors.currency && <p className="text-xs text-red-600">{errors.currency}</p>}
            </div>
          </div>
          <div>
            <label className="text-sm">Traitement fiscal</label>
            <select className="w-full border rounded-lg px-3 py-2" value={form.taxTreatment} onChange={(e) => set("taxTreatment", e.target.value)}>
              <option value="REIMBURSEMENT">Remboursement</option>
              <option value="TAXABLE">Taxable</option>
              <option value="MIXED">Mixte</option>
            </select>
          </div>
          <div>
            <label className="text-sm">Commentaire</label>
            <textarea className="w-full border rounded-lg px-3 py-2" rows={3} value={form.note} onChange={(e) => set("note", e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">Décrivez le contexte si le montant peut être discuté à la validation.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            Statuts visibles ensuite: Brouillon, Soumis, Validé N+1, Validé RH, Validé Finance, Payé, Rejeté.
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={!canSubmit}>{saving ? "Enregistrement..." : "Créer"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

ExpenseFormDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  preset: PropTypes.oneOf(["mission", "deplacement", "repas"]),
};

ExpenseFormDialog.defaultProps = {
  preset: null,
};

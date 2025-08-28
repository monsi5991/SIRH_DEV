// frontend/src/components/people/GoalFormDialog.js
import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { X } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDebouncedValue } from '../../hooks/useEmployees';
import { fetchEmployees, fetchCycles, createGoal } from '../../lib/peopleApi';
import { toast } from 'sonner';

const GoalSchema = z.object({
  employeeId: z.string().min(1, "Sélectionnez un collaborateur"),
  cycleId: z.string().optional(),
  title: z.string().min(2, "Titre trop court"),
  status: z.enum(['on_track', 'at_risk', 'off_track']).default('on_track'),
  progress: z.coerce.number().min(0).max(100).default(0),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export default function GoalFormDialog({ open, onClose, onCreated }) {
  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(GoalSchema),
    defaultValues: { employeeId: '', cycleId: '', title: '', status: 'on_track', progress: 0, startDate: '', endDate: '' }
  });

  const [cycles, setCycles] = React.useState([]);
  const [opts, setOpts] = React.useState({ employees: [], loading: false, q: '' });
  const qDebounced = useDebouncedValue(opts.q, 300);

  useEffect(() => {
    if (!open) return;
    reset();
    fetchCycles().then(setCycles).catch(() => setCycles([]));
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    let keep = true;
    setOpts(s => ({ ...s, loading: true }));
    fetchEmployees({ q: qDebounced, page: 1, pageSize: 20 })
      .then(res => { if (keep) setOpts(s => ({ ...s, employees: res.items || [] })); })
      .catch(() => { if (keep) setOpts(s => ({ ...s, employees: [] })); })
      .finally(() => { if (keep) setOpts(s => ({ ...s, loading: false })); });
    return () => { keep = false; };
  }, [qDebounced, open]);

  if (!open) return null;

  const onSubmit = async (values) => {
    try {
      await createGoal(values);
      toast({ title: "Objectif créé", description: "L’objectif a été ajouté avec succès." });
      onCreated?.();
      onClose?.();
    } catch (e) {
      toast({ title: "Erreur", description: e?.message || "Échec création objectif", variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onKeyDown={(e) => e.key === 'Escape' && onClose?.()}>
      <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Nouvel objectif</h2>
          <button onClick={onClose} aria-label="Fermer" className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
          <div className="md:col-span-2">
            <label className="text-sm text-gray-700">Collaborateur</label>
            <div className="mt-1 flex gap-2">
              <input
                className="flex-1 border rounded-lg px-3 py-2"
                placeholder="Rechercher..."
                value={opts.q}
                onChange={e => setOpts(s => ({ ...s, q: e.target.value }))}
              />
              <select className="border rounded-lg px-3 py-2 min-w-[220px]" {...register('employeeId')}>
                <option value="">— Sélectionner —</option>
                {opts.employees.map(e => (
                  <option key={e.id} value={e.id}>{e.firstName} {e.lastName} — {e.department || '—'}</option>
                ))}
              </select>
            </div>
            {errors.employeeId && <p className="text-xs text-red-600 mt-1">{errors.employeeId.message}</p>}
          </div>

          <div>
            <label className="text-sm text-gray-700">Cycle</label>
            <select className="mt-1 w-full border rounded-lg px-3 py-2" {...register('cycleId')}>
              <option value="">— (optionnel) —</option>
              {cycles.map(c => <option key={c.id} value={c.id}>{c.name} — {c.period}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-700">Statut</label>
            <select className="mt-1 w-full border rounded-lg px-3 py-2" {...register('status')}>
              <option value="on_track">On track</option>
              <option value="at_risk">At risk</option>
              <option value="off_track">Off track</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="text-sm text-gray-700">Titre</label>
            <input className="mt-1 w-full border rounded-lg px-3 py-2" {...register('title')} />
            {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <label className="text-sm text-gray-700">Progression (%)</label>
            <input type="number" min={0} max={100} className="mt-1 w-full border rounded-lg px-3 py-2" {...register('progress', { valueAsNumber: true })} />
          </div>

          <div>
            <label className="text-sm text-gray-700">Début</label>
            <input type="date" className="mt-1 w-full border rounded-lg px-3 py-2" {...register('startDate')} />
          </div>

          <div>
            <label className="text-sm text-gray-700">Fin</label>
            <input type="date" className="mt-1 w-full border rounded-lg px-3 py-2" {...register('endDate')} />
          </div>

          <div className="md:col-span-2 flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 border rounded-lg">Annuler</button>
            <button type="submit" disabled={isSubmitting} className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
              Créer l’objectif
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

GoalFormDialog.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onCreated: PropTypes.func,
};

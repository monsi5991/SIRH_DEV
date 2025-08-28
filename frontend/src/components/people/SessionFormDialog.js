// src/components/people/SessionFormDialog.js
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { X, Plus } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  fetchEmployees, fetchCourses, createCourse,
  createSession, enrollToSession
} from '../../lib/peopleApi';
import { useDebouncedValue } from '../../hooks/useEmployees';
import { toast } from 'sonner';

const CourseSchema = z.object({
  title: z.string().min(2),
  mandatory: z.boolean().optional()
});

const SessionSchema = z.object({
  courseId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  location: z.string().optional(),
  capacity: z.coerce.number().optional(),
});

export default function SessionFormDialog({ open, onClose, onCreated }) {
  const [courses, setCourses] = useState([]);
  const [emp, setEmp] = useState({ q: '', options: [], selecting: [] });
  const qDebounced = useDebouncedValue(emp.q, 300);

  const {
    register, handleSubmit, reset, formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(SessionSchema),
    defaultValues: { courseId: '', startDate: '', endDate: '', location: '', capacity: '' }
  });

  useEffect(() => {
    if (!open) return;
    reset();
    fetchCourses()
      .then(setCourses)
      .catch(() => {
        setCourses([]);
        toast.error("Erreur", { description: "Impossible de charger les cours" });
      });
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    let keep = true;
    fetchEmployees({ q: qDebounced, page: 1, pageSize: 30 })
      .then(res => { if (keep) setEmp(s => ({ ...s, options: res.items || [] })); })
      .catch(() => { if (keep) setEmp(s => ({ ...s, options: [] })); });
    return () => { keep = false; };
  }, [qDebounced, open]);

  if (!open) return null;

  const addCourseQuick = async () => {
    const title = prompt("Titre du cours ?");
    if (!title) return;
    try {
      const c = await createCourse({ title, mandatory: false });
      setCourses(prev => [c, ...prev]);
      toast.success("Cours créé", { description: c.title });
    } catch (e) {
      toast.error("Erreur", { description: e?.message || "Échec création cours" });
    }
  };

  const onSubmit = async (values) => {
    try {
      const session = await createSession(values);
      if (emp.selecting.length > 0) {
        await enrollToSession(session.id, emp.selecting.map(x => x.id));
      }
      toast.success("Session planifiée", { description: "Participants inscrits." });
      onCreated?.();
      onClose?.();
    } catch (e) {
      toast.error("Erreur", { description: e?.message || "Échec planification" });
    }
  };

  const toggleSelect = (employee) => {
    setEmp(s => {
      const exists = s.selecting.some(x => x.id === employee.id);
      return exists
        ? { ...s, selecting: s.selecting.filter(x => x.id !== employee.id) }
        : { ...s, selecting: [...s.selecting, employee] };
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onKeyDown={(e) => e.key === 'Escape' && onClose?.()}>
      <div className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Planifier une session</h2>
          <button onClick={onClose} aria-label="Fermer" className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="text-sm text-gray-700">Cours</label>
            <div className="mt-1 flex gap-2">
              <select className="flex-1 border rounded-lg px-3 py-2" {...register('courseId')}>
                <option value="">— Sélectionner —</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <button type="button" className="px-3 py-2 border rounded-lg" onClick={addCourseQuick}>
                <Plus className="w-4 h-4 inline-block mr-1" /> Cours
              </button>
            </div>
            {errors.courseId && <p className="text-xs text-red-600 mt-1">{errors.courseId.message}</p>}
          </div>

          <div>
            <label className="text-sm text-gray-700">Début</label>
            <input type="date" className="mt-1 w-full border rounded-lg px-3 py-2" {...register('startDate')} />
            {errors.startDate && <p className="text-xs text-red-600 mt-1">{errors.startDate.message}</p>}
          </div>

          <div>
            <label className="text-sm text-gray-700">Fin</label>
            <input type="date" className="mt-1 w-full border rounded-lg px-3 py-2" {...register('endDate')} />
            {errors.endDate && <p className="text-xs text-red-600 mt-1">{errors.endDate.message}</p>}
          </div>

          <div>
            <label className="text-sm text-gray-700">Lieu</label>
            <input className="mt-1 w-full border rounded-lg px-3 py-2" {...register('location')} />
          </div>

          <div>
            <label className="text-sm text-gray-700">Capacité</label>
            <input type="number" className="mt-1 w-full border rounded-lg px-3 py-2" {...register('capacity', { valueAsNumber: true })} />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm text-gray-700">Inscrire des collaborateurs</label>
            <div className="mt-1 flex gap-2">
              <input
                className="flex-1 border rounded-lg px-3 py-2"
                placeholder="Rechercher…"
                value={emp.q}
                onChange={e => setEmp(s => ({ ...s, q: e.target.value }))}
              />
            </div>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-auto border rounded-lg p-2">
              {emp.options.map(u => {
                const selected = emp.selecting.some(x => x.id === u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleSelect(u)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${selected ? 'bg-emerald-50 border-emerald-200' : 'hover:bg-gray-50'}`}
                  >
                    <span className="truncate">{u.firstName} {u.lastName} — {u.department || '—'}</span>
                    {selected && <span className="text-emerald-700 text-xs">Ajouté</span>}
                  </button>
                );
              })}
              {!emp.options.length && <div className="text-sm text-gray-500 px-2 py-1">Aucun résultat…</div>}
            </div>

            {emp.selecting.length > 0 && (
              <div className="mt-2 text-xs text-gray-600">
                {emp.selecting.length} sélectionné(s)
              </div>
            )}
          </div>

          <div className="md:col-span-2 flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 border rounded-lg">Annuler</button>
            <button type="submit" disabled={isSubmitting} className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
              Planifier
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

SessionFormDialog.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onCreated: PropTypes.func,
};

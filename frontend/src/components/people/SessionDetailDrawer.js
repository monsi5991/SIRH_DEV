// src/components/people/SessionDetailDrawer.js
import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  X, Calendar, MapPin, Users, Loader2, Edit3, Copy, Trash2,
  CheckCircle2, UserMinus
} from 'lucide-react';
import {
  getSession,
  updateSession,
  duplicateSession,
  cancelSession,
  markAttendance,
  unenrollFromSession
} from '../../lib/peopleApi';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { emitTrainingChanged, emitRefreshCounters } from '../../lib/events';

// helpers
const toDateInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fromDateInput = (v) => (v ? new Date(`${v}T00:00:00`) : null);

const AttendanceBadge = ({ status }) => {
  if (!status) return null;
  const map = {
    enrolled:  { cls: 'bg-gray-100 text-gray-700',      label: 'Inscrit' },
    present:   { cls: 'bg-emerald-100 text-emerald-800',label: 'Présent' },
    absent:    { cls: 'bg-rose-100 text-rose-800',      label: 'Absent' },
    completed: { cls: 'bg-blue-100 text-blue-800',      label: 'Terminé' },
  };
  const s = map[status] || map.enrolled;
  return <Badge className={s.cls}>{s.label}</Badge>;
};
AttendanceBadge.propTypes = { status: PropTypes.string };

export default function SessionDetailDrawer({ open, session, onClose }) {
  const [loading, setLoading] = useState(false);
  const [full, setFull]       = useState(session || null);
  const [editMode, setEditMode] = useState(false);

  // form state (édition)
  const [startDate, setStartDate] = useState(toDateInput(session?.startDate));
  const [endDate, setEndDate]     = useState(toDateInput(session?.endDate));
  const [location, setLocation]   = useState(session?.location || '');
  const [capacity, setCapacity]   = useState(session?.capacity ?? '');

  // recharge si session change / ouverture
  useEffect(() => {
    let keep = true;

    const needFetch =
      !!open &&
      session &&
      (!session.course || !Array.isArray(session.enrollments));

    const run = async () => {
      if (!needFetch) {
        setFull(session || null);
        setStartDate(toDateInput(session?.startDate));
        setEndDate(toDateInput(session?.endDate));
        setLocation(session?.location || '');
        setCapacity(session?.capacity ?? '');
        return;
      }
      try {
        setLoading(true);
        const s = await getSession(session.id);
        if (keep) {
          setFull(s);
          setStartDate(toDateInput(s?.startDate));
          setEndDate(toDateInput(s?.endDate));
          setLocation(s?.location || '');
          setCapacity(s?.capacity ?? '');
        }
      } catch {
        if (keep) setFull(session);
      } finally {
        if (keep) setLoading(false);
      }
    };

    run();
    return () => { keep = false; };
  }, [open, session]);

  // source unique pour l’affichage (évite les incohérences avant la fin du fetch)
  const s = full || session;

  const enrolled = (s?.enrollments || []).length;
  const cap      = s?.capacity ?? null;
  const left     = cap ? Math.max(0, cap - enrolled) : null;

  const statusBadge = useMemo(() => {
    const st = s?.startDate ? new Date(s.startDate) : null;
    const en = s?.endDate ? new Date(s.endDate) : null;
    if (!st || !en) return null;
    const now = new Date();
    if (en < now)             return <Badge className="bg-gray-100 text-gray-800">Terminée</Badge>;
    if (st <= now && en >= now) return <Badge className="bg-emerald-100 text-emerald-800">En cours</Badge>;
    return <Badge className="bg-blue-100 text-blue-800">À venir</Badge>;
  }, [s?.startDate, s?.endDate]);

  const doSave = async () => {
    if (!startDate || !endDate) {
      toast.error('Dates requises'); return;
    }
    const sd = fromDateInput(startDate);
    const ed = fromDateInput(endDate);
    if (sd > ed) {
      toast.error('La date de début doit précéder la date de fin'); return;
    }
    try {
      setLoading(true);
      const body = {
        startDate: sd.toISOString(),
        endDate:   ed.toISOString(),
        location:  location || null,
        capacity:  capacity === '' || capacity === null ? null : Number(capacity),
      };
      const updated = await updateSession(s.id, body);
      setFull(updated);
      setEditMode(false);
      toast.success('Session mise à jour');
      emitTrainingChanged({ reason: 'session_updated', id: s.id });
      emitRefreshCounters();
    } catch (e) {
      toast.error(e?.message || 'Échec de mise à jour');
    } finally {
      setLoading(false);
    }
  };

  const doDuplicate = async () => {
    if (!confirm("Dupliquer cette session ? (par défaut +7 jours)")) return;
    try {
      setLoading(true);
      await duplicateSession(s.id, {}); // backend gère +7 jours si vide
      toast.success('Session dupliquée');
      emitTrainingChanged({ reason: 'session_duplicated', id: s.id });
      emitRefreshCounters();
    } catch (e) {
      toast.error(e?.message || 'Échec duplication');
    } finally {
      setLoading(false);
    }
  };

  const doCancel = async () => {
    if (!confirm("Annuler et supprimer cette session (et inscriptions) ?")) return;
    try {
      setLoading(true);
      await cancelSession(s.id);
      toast.success('Session annulée');
      emitTrainingChanged({ reason: 'session_cancelled', id: s.id });
      emitRefreshCounters();
      onClose?.(); // on ferme après suppression
    } catch (e) {
      toast.error(e?.message || 'Échec annulation');
    } finally {
      setLoading(false);
    }
  };

  const doMarkAll = async (status) => {
    try {
      setLoading(true);
      const res = await markAttendance(s.id, { status });
      setFull((prev) => ({ ...(prev || s), enrollments: res?.enrollments || [] }));
      toast.success(
        status === 'present' ? 'Tous marqués présents'
        : status === 'absent' ? 'Tous marqués absents'
        : 'Tous marqués terminés'
      );
    } catch (e) {
      toast.error(e?.message || 'Échec mise à jour présence');
    } finally {
      setLoading(false);
      emitTrainingChanged({ reason: 'attendance_bulk', id: s.id });
      emitRefreshCounters();
    }
  };

  const doUnenroll = async (empId) => {
    if (!confirm('Désinscrire ce participant ?')) return;
    try {
      setLoading(true);
      await unenrollFromSession(s.id, empId);
      setFull((prev) => ({
        ...(prev || s),
        enrollments: ((prev || s)?.enrollments || []).filter(e => e.employeeId !== empId)
      }));
      toast.success('Participant désinscrit');
      emitTrainingChanged({ reason: 'unenrolled', id: s.id });
      emitRefreshCounters();
    } catch (e) {
      toast.error(e?.message || 'Échec désinscription');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      onKeyDown={(e) => e.key === 'Escape' && onClose?.()}
    >
      {/* overlay */}
      <div className="flex-1 bg-black/40" onClick={onClose} />

      {/* panel */}
      <div className="ml-auto relative w-full max-w-2xl h-full bg-white shadow-xl border-l flex flex-col">
        {/* HEADER sticky */}
        <div className="sticky top-0 z-10 border-b bg-white">
          <div className="px-6 py-4 flex items-start sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold truncate">
                  {s?.course?.title || 'Session de formation'}
                </h2>
                {statusBadge}
              </div>
              <p className="text-sm text-gray-500 truncate">
                {s?.location || '—'}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="p-2 rounded-md hover:bg-gray-100 text-gray-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ACTIONS sticky, responsive */}
        <div className="sticky top-[64px] z-10 bg-white border-b">
          <div className="px-6 py-3 flex flex-wrap items-center gap-2">
            <button
              className="px-3 py-2 rounded-lg border hover:bg-gray-50 flex items-center gap-2 disabled:opacity-60"
              onClick={() => setEditMode(v => !v)}
              disabled={loading}
            >
              <Edit3 className="w-4 h-4" /> {editMode ? 'Annuler' : 'Modifier'}
            </button>
            <button
              className="px-3 py-2 rounded-lg border hover:bg-gray-50 flex items-center gap-2 disabled:opacity-60"
              onClick={doDuplicate}
              disabled={loading}
            >
              <Copy className="w-4 h-4" /> Dupliquer
            </button>
            <button
              className="px-3 py-2 rounded-lg border hover:bg-rose-50 text-rose-700 flex items-center gap-2 disabled:opacity-60"
              onClick={doCancel}
              disabled={loading}
            >
              <Trash2 className="w-4 h-4" /> Annuler
            </button>

            <div className="ml-auto flex items-center gap-2">
              <button
                className="px-3 py-2 rounded-lg border hover:bg-gray-50 text-sm disabled:opacity-60"
                onClick={() => doMarkAll('present')}
                disabled={loading}
                title="Marquer tous présents"
              >
                Tous présents
              </button>
              <button
                className="px-3 py-2 rounded-lg border hover:bg-gray-50 text-sm disabled:opacity-60"
                onClick={() => doMarkAll('absent')}
                disabled={loading}
              >
                Tous absents
              </button>
              <button
                className="px-3 py-2 rounded-lg border hover:bg-gray-50 text-sm flex items-center gap-1 disabled:opacity-60"
                onClick={() => doMarkAll('completed')}
                disabled={loading}
              >
                <CheckCircle2 className="w-4 h-4" /> Terminer
              </button>
            </div>
          </div>
        </div>

        {/* CONTENU défilant */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Bloc infos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
              <div className="w-full">
                <div className="text-sm text-gray-600">Période</div>
                {!editMode ? (
                  <div className="font-medium">
                    {s?.startDate ? new Date(s.startDate).toLocaleDateString() : '—'} → {s?.endDate ? new Date(s.endDate).toLocaleDateString() : '—'}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="date"
                      className="border rounded-lg px-3 py-2 w-full"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                    <span className="self-center text-gray-400">→</span>
                    <input
                      type="date"
                      className="border rounded-lg px-3 py-2 w-full"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
              <div className="w-full">
                <div className="text-sm text-gray-600">Lieu</div>
                {!editMode ? (
                  <div className="font-medium">{s?.location || '—'}</div>
                ) : (
                  <input
                    className="border rounded-lg px-3 py-2 w-full"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Lieu"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Capacité */}
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
            <div className="w-full">
              <div className="text-sm text-gray-600">Capacité</div>
              {!editMode ? (
                <div className="font-medium">
                  {cap ? `${enrolled} / ${cap}${left !== null ? ` (${left} restants)` : ''}` : '—'}
                </div>
              ) : (
                <input
                  type="number"
                  className="border rounded-lg px-3 py-2 w-40"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  placeholder="Capacité (optionnel)"
                />
              )}
            </div>
          </div>

          {editMode && (
            <div>
              <button
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                onClick={doSave}
                disabled={loading}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Sauvegarde…
                  </span>
                ) : 'Enregistrer'}
              </button>
            </div>
          )}

          {/* Participants */}
          <div>
            <div className="text-sm text-gray-600 mb-2">Participants</div>

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
              </div>
            ) : enrolled > 0 ? (
              <ul className="divide-y rounded-lg border">
                {(s.enrollments || []).map((e, idx) => (
                  <li
                    key={e.id || e.employeeId || e.employee?.id || idx}
                    className="px-3 py-2 text-sm flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {e.employee?.firstName} {e.employee?.lastName}
                        {e.employee?.department ? ` — ${e.employee.department}` : ''}
                      </div>
                      <div className="text-xs text-gray-500">{e.employee?.site || ''}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <AttendanceBadge status={e.status} />
                      <button
                        className="px-2 py-1 rounded-lg border text-rose-700 hover:bg-rose-50 flex items-center gap-1 disabled:opacity-60"
                        onClick={() => doUnenroll(e.employeeId)}
                        title="Désinscrire"
                        disabled={loading}
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">Aucun participant inscrit.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

SessionDetailDrawer.propTypes = {
  open: PropTypes.bool,
  session: PropTypes.shape({
    id: PropTypes.string,
    course: PropTypes.shape({ title: PropTypes.string }),
    startDate: PropTypes.string,
    endDate: PropTypes.string,
    location: PropTypes.string,
    capacity: PropTypes.number,
    enrollments: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string,
        employeeId: PropTypes.string,
        employee: PropTypes.shape({
          id: PropTypes.string,
          firstName: PropTypes.string,
          lastName: PropTypes.string,
          department: PropTypes.string,
          site: PropTypes.string,
        }),
        status: PropTypes.string,
      })
    ),
  }),
  onClose: PropTypes.func,
};

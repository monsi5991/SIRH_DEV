// src/pages/people/FormationPage.js
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { BookOpen, AlertTriangle, Plus, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';

import { useExpiringCerts } from '../../hooks/useTraining';
import { fetchSessions } from '../../lib/peopleApi';
import SessionFormDialog from '../../components/people/SessionFormDialog';
import SessionDetailDrawer from '../../components/people/SessionDetailDrawer';

// événements pour la sidebar
import { emitTrainingChanged, emitRefreshCounters } from '../../lib/events';

export default function FormationPage() {
  const { certs, loading: loadingCerts } = useExpiringCerts(30);

  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);

  // Drawer détail
  const [selectedSession, setSelectedSession] = useState(null);

  const loadSessions = useCallback(async () => {
    try {
      setLoadingSessions(true);
      const s = await fetchSessions();
      setSessions(Array.isArray(s) ? s : []);
    } catch (e) {
      setSessions([]);
      toast.error('Échec du chargement des sessions');
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // synchro sidebar — sessions
  useEffect(() => {
    if (!loadingSessions) {
      emitTrainingChanged({ reason: 'sessions_loaded', count: sessions.length });
      emitRefreshCounters();
    }
  }, [loadingSessions, sessions.length]);

  // synchro sidebar — certifs
  useEffect(() => {
    if (!loadingCerts) {
      emitTrainingChanged({ reason: 'certs_loaded', count: (certs || []).length });
      emitRefreshCounters();
    }
  }, [loadingCerts, certs]);

  const sessionsSoon14 = useMemo(() => {
    const now = new Date();
    const in14d = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    return sessions.filter(s => {
      const start = s?.startDate ? new Date(s.startDate) : null;
      return start && start >= now && start <= in14d;
    }).length;
  }, [sessions]);

  const renderCapacity = (s) => {
    const enrolled = s.enrollments?.length || 0;
    if (!s.capacity) return <Badge className="bg-gray-100 text-gray-800">Capacité : —</Badge>;
    const left = Math.max(0, s.capacity - enrolled);
    const cls =
      left === 0
        ? 'bg-red-100 text-red-800'
        : left <= 3
        ? 'bg-amber-100 text-amber-800'
        : 'bg-emerald-100 text-emerald-800';
    return <Badge className={cls}>{enrolled} / {s.capacity} ({left} restants)</Badge>;
  };

  const statusChip = (s) => {
    const st = s?.startDate ? new Date(s.startDate) : null;
    const en = s?.endDate ? new Date(s.endDate) : null;
    if (!st || !en) return null;
    const now = new Date();
    if (en < now) return <Badge className="bg-gray-100 text-gray-800">Terminé</Badge>;
    if (st <= now && en >= now) return <Badge className="bg-emerald-100 text-emerald-800">En cours</Badge>;
    return <Badge className="bg-blue-100 text-blue-800">À venir</Badge>;
  };

  const onRefresh = async () => {
    await loadSessions();
    emitTrainingChanged({ reason: 'manual_refresh' });
    emitRefreshCounters();
  };

  const onCreatedSession = () => {
    toast.success('Session créée');
    emitRefreshCounters();
    loadSessions();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Formation &amp; Conformité</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" /> Rafraîchir
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setOpenCreate(true)}>
            <Plus className="w-4 h-4 mr-2" /> Planifier une session
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Certifs à renouveler (&lt; 30 j)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCerts ? (
              <p className="text-sm text-gray-500">Chargement…</p>
            ) : (
              <ul className="text-sm space-y-2">
                {(certs || []).map((c) => (
                  <li key={c.id} className="flex items-center justify-between">
                    <span className="truncate">
                      {c.employee?.firstName} {c.employee?.lastName} — {c.name}
                    </span>
                    <span className="text-gray-500">
                      {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : ''}
                    </span>
                  </li>
                ))}
                {!((certs || []).length) && (
                  <p className="text-gray-500">Aucune expiration prévue sous 30 jours.</p>
                )}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Taux complétion obligatoires</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-gray-600">À connecter</p></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Sessions à venir (&lt; 14 j)</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-gray-900">{sessionsSoon14}</p>
            <p className="text-sm text-gray-500">Nombre de sessions qui démarrent dans les 14 prochains jours.</p>
          </CardContent>
        </Card>
      </div>

      {/* Liste des sessions – même look que Performance */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" /> Sessions planifiées
          </CardTitle>
          <Button variant="outline" onClick={onRefresh}>Rafraîchir</Button>
        </CardHeader>
        <CardContent>
          {loadingSessions ? (
            <p className="text-sm text-gray-500">Chargement…</p>
          ) : sessions.length ? (
            <div className="space-y-3">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSession(s)}
                  className="
                    w-full text-left
                    rounded-xl border border-gray-200
                    px-4 py-3
                    flex items-center justify-between gap-3
                    hover:bg-gray-50 hover:shadow-sm transition
                  "
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-medium truncate">{s.course?.title || 'Cours'}</div>
                      {statusChip(s)}
                    </div>
                    <div className="mt-1 text-sm text-gray-500 truncate">
                      {s.startDate ? new Date(s.startDate).toLocaleDateString() : '—'}
                      {' \u2192 '}
                      {s.endDate ? new Date(s.endDate).toLocaleDateString() : '—'}
                      {' \u00B7 '}
                      {s.location || '—'}
                    </div>
                  </div>

                  {/* badge à droite comme sur Performance */}
                  <div className="shrink-0">
                    {renderCapacity(s)}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Aucune session planifiée.</p>
          )}
        </CardContent>
      </Card>

      <SessionFormDialog
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onCreated={onCreatedSession}
      />

      <SessionDetailDrawer
        open={!!selectedSession}
        session={selectedSession}
        onClose={() => setSelectedSession(null)}
      />
    </div>
  );
}

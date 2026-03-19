// src/pages/people/FormationPage.js
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { BookOpen, AlertTriangle, Plus, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
import PageHeader from '../../components/common/PageHeader';
import SectionCard from '../../components/common/SectionCard';
import HelpTooltip from '../../components/common/HelpTooltip';
import EmptyState from '../../components/common/EmptyState';

import { useExpiringCerts } from '../../hooks/useTraining';
import { fetchSessions } from '../../lib/peopleApi';
import SessionFormDialog from '../../components/people/SessionFormDialog';
import SessionDetailDrawer from '../../components/people/SessionDetailDrawer';

// événements pour la sidebar
import { emitTrainingChanged, emitRefreshCounters } from '../../lib/events';

export default function FormationPage() {
  const { certs, loading: loadingCerts } = useExpiringCerts(90);

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

  const certificationBuckets = useMemo(() => ({
    due90: (certs || []).length,
    due60: (certs || []).filter((cert) => cert?.expiresAt && (new Date(cert.expiresAt) - new Date()) / 86400000 <= 60).length,
    due30: (certs || []).filter((cert) => cert?.expiresAt && (new Date(cert.expiresAt) - new Date()) / 86400000 <= 30).length,
  }), [certs]);

  const recommendations = useMemo(() => {
    const items = [];
    if (certificationBuckets.due30 > 0) items.push("Prioriser les certifications qui expirent sous 30 jours.");
    if (sessionsSoon14 === 0) items.push("Planifier au moins une session prochainement pour alimenter le plan annuel.");
    if (sessions.length > 0) items.push("Rapprocher les inscriptions des compétences critiques manquantes avant revue manager.");
    if (!items.length) items.push("Portefeuille formation stable: maintenir le suivi des présences et renouvellements.");
    return items.slice(0, 3);
  }, [certificationBuckets.due30, sessionsSoon14, sessions.length]);

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
      <PageHeader
        title="Formation & compétences"
        description="Catalogue, plan annuel, certifications et alertes d’expiration à piloter simplement."
        actions={(
          <div className="flex gap-2">
            <Button variant="outline" onClick={onRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" /> Rafraîchir
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setOpenCreate(true)}>
              <Plus className="w-4 h-4 mr-2" /> Planifier une session
            </Button>
          </div>
        )}
      >
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-emerald-100 bg-white p-4 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs uppercase tracking-wide text-slate-500">Certifs &lt; 90 j</div><div className="mt-2 text-2xl font-bold text-slate-900">{certificationBuckets.due90}</div></div>
          <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs uppercase tracking-wide text-slate-500">Certifs &lt; 60 j</div><div className="mt-2 text-2xl font-bold text-amber-700">{certificationBuckets.due60}</div></div>
          <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs uppercase tracking-wide text-slate-500">Certifs &lt; 30 j</div><div className="mt-2 text-2xl font-bold text-rose-700">{certificationBuckets.due30}</div></div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><div className="font-medium">Assistant UX</div><div className="mt-1">Affichez d’abord les expirations proches puis ouvrez la session ou le salarié concerné.</div></div>
        </div>
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Certifs à renouveler (90 / 60 / 30)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCerts ? (
              <p className="text-sm text-gray-500">Chargement…</p>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="rounded-xl border border-slate-200 px-3 py-2 flex items-center justify-between"><span>Sous 90 jours</span><Badge variant="outline">{certificationBuckets.due90}</Badge></div>
                <div className="rounded-xl border border-slate-200 px-3 py-2 flex items-center justify-between"><span>Sous 60 jours</span><Badge className="bg-amber-100 text-amber-800">{certificationBuckets.due60}</Badge></div>
                <div className="rounded-xl border border-slate-200 px-3 py-2 flex items-center justify-between"><span>Sous 30 jours</span><Badge className="bg-rose-100 text-rose-800">{certificationBuckets.due30}</Badge></div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="inline-flex items-center gap-2">Recommandations <HelpTooltip content="Recommandation simple basée sur les certifications qui expirent et les sessions planifiées. Sans moteur IA, uniquement des règles métier explicites." /></CardTitle></CardHeader>
          <CardContent><ul className="space-y-2 text-sm text-gray-700">{recommendations.map((item) => <li key={item} className="rounded-xl border border-slate-200 px-3 py-2">{item}</li>)}</ul></CardContent>
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
      <SectionCard
        title={<span className="inline-flex items-center gap-2"><BookOpen className="w-5 h-5" /> Sessions planifiées <HelpTooltip content="Historique complet par salarié à ouvrir depuis le détail de session. Utilisez cette liste comme plan annuel opérationnel." /></span>}
        description="Plan annuel, sessions à venir et capacité restante."
      >
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

                <div className="shrink-0">
                  {renderCapacity(s)}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={BookOpen}
            title="Aucune session planifiée"
            description="Planifiez une session pour alimenter le plan de formation annuel."
            actionLabel="Planifier une session"
            onAction={() => setOpenCreate(true)}
            compact
          />
        )}
      </SectionCard>

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

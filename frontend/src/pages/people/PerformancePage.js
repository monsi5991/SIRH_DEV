import React, { useEffect, useMemo, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { TrendingUp, RefreshCw, Plus, Pencil, Trash2, CalendarPlus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
import PageHeader from '../../components/common/PageHeader';
import SectionCard from '../../components/common/SectionCard';
import HelpTooltip from '../../components/common/HelpTooltip';
import EmptyState from '../../components/common/EmptyState';

import { fetchGoals, deleteGoal, updateGoal, createCycle } from '../../lib/peopleApi';
import { emitGoalsChanged, emitRefreshCounters } from '../../lib/events';
import GoalFormDialog from '../../components/people/GoalFormDialog';
import GoalEditDialog from '../../components/people/GoalEditDialog';
import CycleFormDialog from '../../components/people/CycleFormDialog';

const StatusBadge = ({ status }) => {
  const map = {
    on_track: { cls: 'bg-emerald-100 text-emerald-800', label: 'En bonne voie' },
    at_risk: { cls: 'bg-amber-100 text-amber-800', label: 'À risque' },
    off_track: { cls: 'bg-rose-100 text-rose-800', label: 'En retard' },
  };
  const s = map[status] || map.on_track;
  return <Badge className={s.cls}>{s.label}</Badge>;
};
StatusBadge.propTypes = { status: PropTypes.string };

export default function PerformancePage() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [openCycle, setOpenCycle] = useState(false);
  const [goalToEdit, setGoalToEdit] = useState(null);

  const loadGoals = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchGoals();
      setGoals(Array.isArray(data) ? data : []);
    } catch {
      setGoals([]);
      toast.error('Échec du chargement des objectifs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadGoals(); }, [loadGoals]);
  const activeGoals = useMemo(() => (Array.isArray(goals) ? goals.length : 0), [goals]);

  useEffect(() => {
    if (!loading) {
      emitGoalsChanged({ source: 'performance_page', activeGoals, total: activeGoals });
      emitRefreshCounters();
    }
  }, [loading, activeGoals]);

  const onRefresh = async () => {
    await loadGoals();
    emitRefreshCounters();
  };

  const onDelete = async (id) => {
    if (!confirm('Supprimer cet objectif ?')) return;
    try {
      await deleteGoal(id);
      toast.success('Objectif supprimé');
      await loadGoals();
      emitRefreshCounters();
    } catch (e) {
      toast.error(e?.message || 'Échec suppression');
    }
  };

  const onUpdateGoal = async (payload) => {
    if (!goalToEdit) return;
    await updateGoal(goalToEdit.id, payload);
    toast.success('Objectif mis à jour');
    await loadGoals();
  };

  const onCreateCycle = async (payload) => {
    await createCycle(payload);
    toast.success('Cycle créé');
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Évaluations & objectifs"
        description="Cycle annuel, objectifs SMART, évaluation 50/25/25 et plan de développement individuel."
        actions={(
          <div className="flex gap-2">
            <Button variant="outline" onClick={onRefresh}><RefreshCw className="w-4 h-4 mr-2" /> Rafraîchir</Button>
            <Button variant="outline" onClick={() => setOpenCycle(true)}><CalendarPlus className="w-4 h-4 mr-2" /> Nouveau cycle</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setOpenCreate(true)}><Plus className="w-4 h-4 mr-2" /> Nouvel objectif</Button>
          </div>
        )}
      >
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-emerald-100 bg-white p-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs uppercase tracking-wide text-slate-500">Cycle recommandé</div><div className="mt-2 text-xl font-bold text-slate-900">Janv. objectifs</div><div className="mt-1 text-xs text-slate-500">Déc. évaluation • PDI à la clôture</div></div>
          <div className="rounded-xl border border-slate-200 p-3"><div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">Modèle SMART <HelpTooltip content="Un bon objectif est Spécifique, Mesurable, Atteignable, Réaliste et Temporellement défini." /></div><div className="mt-2 text-sm text-slate-700">Encouragez un verbe d’action, une cible chiffrée et une date de fin explicite.</div></div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><div className="text-xs uppercase tracking-wide text-emerald-700">Évaluation</div><div className="mt-2 text-lg font-bold text-emerald-800">50 / 25 / 25</div><div className="mt-1 text-xs text-emerald-700">Objectifs / technique / comportements</div></div>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5" /> Couverture objectifs</CardTitle></CardHeader><CardContent><p className="text-sm text-gray-600">Objectifs actifs: {activeGoals}</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Check-ins ce trimestre</CardTitle></CardHeader><CardContent><p className="text-sm text-gray-600">À connecter.</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Entretiens en retard</CardTitle></CardHeader><CardContent><p className="text-sm text-gray-600">À connecter.</p></CardContent></Card>
      </div>

      <SectionCard
        title={<span className="inline-flex items-center gap-2">Objectifs en cours <HelpTooltip content="Avant validation manager, vérifiez la progression, le niveau de risque et la clarté SMART de chaque objectif." /></span>}
        description="Synthèse actionnable pour managers et RH."
      >
        {loading ? <p className="text-sm text-gray-500">Chargement…</p> : activeGoals ? (
          <div className="divide-y rounded-lg border">
            {goals.map((g) => (
              <div key={g.id} className="px-3 py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><div className="font-medium truncate">{g.title}</div><StatusBadge status={g.status} /></div>
                  <div className="text-xs text-gray-500 mt-1 truncate">{g.cycle?.name ? g.cycle.name : 'Cycle'} • {g.employee?.firstName} {g.employee?.lastName}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-gray-600 w-10 text-right">{typeof g.progress === 'number' ? `${g.progress}%` : '—'}</div>
                  <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-2 bg-gray-900 rounded-full" style={{ width: `${Math.max(0, Math.min(100, g.progress ?? 0))}%` }} /></div>
                  <Button variant="outline" size="icon" onClick={() => setGoalToEdit(g)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="outline" size="icon" onClick={() => onDelete(g.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={TrendingUp}
            title="Aucun objectif en cours"
            description="Créez un cycle puis ajoutez des objectifs SMART pour lancer la campagne."
            actionLabel="Nouvel objectif"
            onAction={() => setOpenCreate(true)}
            compact
          />
        )}
      </SectionCard>

      <Card>
        <CardHeader className="flex items-center justify-between"><CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5" /> Objectifs en cours</CardTitle><Button variant="outline" onClick={onRefresh}>Rafraîchir</Button></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-4"><div className="text-sm font-medium text-slate-900">Objectifs</div><div className="mt-2 text-2xl font-bold text-slate-900">{activeGoals}</div><div className="mt-1 text-xs text-slate-500">Portefeuille actif</div></div>
            <div className="rounded-xl border border-slate-200 p-4"><div className="text-sm font-medium text-slate-900">À risque</div><div className="mt-2 text-2xl font-bold text-amber-700">{goals.filter((goal) => goal.status === 'at_risk' || goal.status === 'off_track').length}</div><div className="mt-1 text-xs text-slate-500">Priorité de revue manager</div></div>
            <div className="rounded-xl border border-slate-200 p-4"><div className="text-sm font-medium text-slate-900">Progression moyenne</div><div className="mt-2 text-2xl font-bold text-slate-900">{activeGoals ? Math.round(goals.reduce((acc, goal) => acc + (goal.progress || 0), 0) / activeGoals) : 0}%</div><div className="mt-1 text-xs text-slate-500">Sur les objectifs actifs</div></div>
          </div>
        </CardContent>
      </Card>

      <GoalFormDialog open={openCreate} onClose={() => setOpenCreate(false)} onCreated={loadGoals} />
      <GoalEditDialog open={!!goalToEdit} goal={goalToEdit} onClose={() => setGoalToEdit(null)} onSubmit={onUpdateGoal} />
      <CycleFormDialog open={openCycle} onClose={() => setOpenCycle(false)} onSubmit={onCreateCycle} />
    </div>
  );
}

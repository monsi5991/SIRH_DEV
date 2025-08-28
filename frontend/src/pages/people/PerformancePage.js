// frontend/src/pages/people/PerformancePage.js
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { TrendingUp, RefreshCw, Plus, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';

import { fetchGoals, deleteGoal } from '../../lib/peopleApi';
import { emitGoalsChanged, emitRefreshCounters } from '../../lib/events';

// Status → badge
const StatusBadge = ({ status }) => {
  const map = {
    on_track: { cls: 'bg-emerald-100 text-emerald-800', label: 'En bonne voie' },
    at_risk:  { cls: 'bg-amber-100 text-amber-800', label: 'À risque' },
    off_track:{ cls: 'bg-rose-100 text-rose-800', label: 'En retard' },
  };
  const s = map[status] || map.on_track;
  return <Badge className={s.cls}>{s.label}</Badge>;
};
StatusBadge.propTypes = { status: PropTypes.string };

export default function PerformancePage() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadGoals = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchGoals(); // éventuellement filtré par salarié si besoin
      setGoals(Array.isArray(data) ? data : []);
    } catch {
      setGoals([]);
      toast.error('Échec du chargement des objectifs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadGoals(); }, [loadGoals]);

  // Nombre réellement affiché à l’écran
  const activeGoals = useMemo(() => (Array.isArray(goals) ? goals.length : 0), [goals]);

  // 🔔 Synchronisation Sidebar (override perf)
  useEffect(() => {
    if (!loading) {
      emitGoalsChanged({ source: 'performance_page', activeGoals, total: activeGoals });
      emitRefreshCounters();
    }
  }, [loading, activeGoals]);

  const onRefresh = async () => {
    await loadGoals();
    emitGoalsChanged({ source: 'performance_refresh', activeGoals, total: activeGoals });
    emitRefreshCounters();
  };

  const onDelete = async (id) => {
    if (!confirm('Supprimer cet objectif ?')) return;
    try {
      await deleteGoal(id);
      toast.success('Objectif supprimé');
      await loadGoals();
      emitGoalsChanged({ source: 'performance_delete', activeGoals, total: activeGoals });
      emitRefreshCounters();
    } catch (e) {
      toast.error(e?.message || 'Échec suppression');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Performance &amp; Objectifs</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" /> Rafraîchir
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => toast.info('À connecter')}>
            <Plus className="w-4 h-4 mr-2" /> Nouvel objectif
          </Button>
        </div>
      </div>

      {/* KPIs (placeholder) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" /> Couverture objectifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">À connecter ou à implémenter.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Check-ins ce trimestre</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-gray-600">À connecter.</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Entretiens en retard</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-gray-600">À connecter.</p></CardContent>
        </Card>
      </div>

      {/* Liste des objectifs */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" /> Objectifs en cours
          </CardTitle>
          <Button variant="outline" onClick={onRefresh}>Rafraîchir</Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-500">Chargement…</p>
          ) : activeGoals ? (
            <div className="divide-y rounded-lg border">
              {goals.map((g) => (
                <div key={g.id} className="px-3 py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium truncate">{g.title}</div>
                      <StatusBadge status={g.status} />
                    </div>
                    <div className="text-xs text-gray-500 mt-1 truncate">
                      {g.cycle?.name ? g.cycle.name : 'Cycle'} • {g.employee?.firstName} {g.employee?.lastName}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-xs text-gray-600 w-10 text-right">
                      {typeof g.progress === 'number' ? `${g.progress}%` : '—'}
                    </div>
                    <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-2 bg-gray-900 rounded-full"
                        style={{ width: `${Math.max(0, Math.min(100, g.progress ?? 0))}%` }}
                      />
                    </div>

                    <Button variant="outline" size="icon" onClick={() => toast.info('Édition à connecter')}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => onDelete(g.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Aucun objectif en cours.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

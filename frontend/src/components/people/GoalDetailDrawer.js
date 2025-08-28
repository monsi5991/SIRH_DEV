// frontend/src/components/people/GoalDetailDrawer.jsx
import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { X, Calendar, User2, Target, CheckCircle, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { getGoal, updateGoal, deleteGoal } from "../../lib/peopleApi";

function ProgressBar({ value = 0 }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="w-40 h-2 rounded bg-gray-200 dark:bg-gray-800" aria-label={`Progression ${v}%`}>
      <div className="h-2 rounded bg-emerald-600" style={{ width: `${v}%` }} />
    </div>
  );
}
ProgressBar.propTypes = { value: PropTypes.number };

const STATUS_LABEL = {
  on_track: "On track",
  at_risk: "At risk",
  off_track: "Off track",
};

const STATUS_BADGE = {
  on_track: "bg-emerald-100 text-emerald-800",
  at_risk: "bg-amber-100 text-amber-800",
  off_track: "bg-rose-100 text-rose-800",
};

export default function GoalDetailDrawer({ goalId, open, onOpenChange, onUpdated }) {
  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(false);

  const employeeName = useMemo(() => {
    const e = goal?.employee;
    if (!e) return "—";
    return `${e.firstName || ""} ${e.lastName || ""}`.trim() || "—";
  }, [goal]);

  useEffect(() => {
    if (!open || !goalId) return;
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const g = await getGoal(goalId);
        if (alive) setGoal(g);
      } catch (e) {
        toast.error("Erreur", { description: "Impossible de charger l’objectif." });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [open, goalId]);

  if (!open) return null;

  const close = () => onOpenChange?.(false);

  const markCompleted = async () => {
    try {
      await updateGoal(goalId, { progress: 100, status: "on_track" });
      toast.success("Objectif complété");
      const g = await getGoal(goalId);
      setGoal(g);
      onUpdated?.();
    } catch (e) {
      toast.error("Erreur", { description: e?.message || "Échec de la mise à jour" });
    }
  };

  const quickBump = async (delta) => {
    try {
      const next = Math.max(0, Math.min(100, (goal?.progress ?? 0) + delta));
      await updateGoal(goalId, { progress: next });
      const g = await getGoal(goalId);
      setGoal(g);
      onUpdated?.();
    } catch (e) {
      toast.error("Erreur", { description: e?.message || "Échec de la mise à jour" });
    }
  };

  const remove = async () => {
    if (!window.confirm("Supprimer cet objectif ?")) return;
    try {
      await deleteGoal(goalId);
      toast.success("Objectif supprimé");
      onUpdated?.();
      close();
    } catch (e) {
      toast.error("Erreur", { description: e?.message || "Échec de la suppression" });
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={close} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b">
          <div className="min-w-0">
            <h3 className="font-semibold truncate">{goal?.title || "Objectif"}</h3>
            {/* pas d’ID technique affiché */}
          </div>
          <button onClick={close} aria-label="Fermer"><X className="w-5 h-5" /></button>
        </header>

        {/* Body */}
        <div className="p-4 space-y-4 overflow-auto">
          {loading ? (
            <div className="space-y-2">
              <div className="h-5 bg-gray-100 rounded animate-pulse" />
              <div className="h-24 bg-gray-100 rounded animate-pulse" />
            </div>
          ) : goal ? (
            <>
              <div className="text-sm text-gray-700 space-y-2">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  <span className={`px-2 py-0.5 rounded ${STATUS_BADGE[goal.status] || "bg-gray-100 text-gray-800"}`}>
                    {STATUS_LABEL[goal.status] || goal.status}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <User2 className="w-4 h-4" />
                  <span>{employeeName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {goal.startDate ? new Date(goal.startDate).toLocaleDateString() : "—"} →{" "}
                    {goal.endDate ? new Date(goal.endDate).toLocaleDateString() : "—"}
                  </span>
                </div>
                {goal.cycle?.name && (
                  <div className="text-xs text-gray-500">
                    Cycle : {goal.cycle.name} {goal.cycle.period ? `(${goal.cycle.period})` : ""}
                  </div>
                )}
              </div>

              <div className="mt-2">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-600">Progression</span>
                  <span className="font-medium">{goal.progress ?? 0}%</span>
                </div>
                <ProgressBar value={goal.progress ?? 0} />
                <div className="mt-3 flex gap-2">
                  <button className="px-2 py-1 rounded border" onClick={() => quickBump(-10)}>-10%</button>
                  <button className="px-2 py-1 rounded border" onClick={() => quickBump(-5)}>-5%</button>
                  <button className="px-2 py-1 rounded border" onClick={() => quickBump(+5)}>+5%</button>
                  <button className="px-2 py-1 rounded border" onClick={() => quickBump(+10)}>+10%</button>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-red-600">Objectif introuvable.</p>
          )}
        </div>

        {/* Footer actions */}
        <div className="mt-auto p-4 border-t flex items-center gap-2">
          <button
            className="px-3 py-2 rounded border inline-flex items-center gap-2"
            onClick={markCompleted}
          >
            <CheckCircle className="w-4 h-4" /> Marquer complété
          </button>
          <button
            className="ml-auto px-3 py-2 rounded bg-rose-600 text-white inline-flex items-center gap-2"
            onClick={remove}
          >
            Supprimer
          </button>
        </div>
      </aside>
    </div>
  );
}

GoalDetailDrawer.propTypes = {
  goalId: PropTypes.string,
  open: PropTypes.bool,
  onOpenChange: PropTypes.func,
  onUpdated: PropTypes.func,
};

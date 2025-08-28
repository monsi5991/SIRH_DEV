// src/pages/people/PerformanceDetailPage.js
import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { getGoal, deleteGoal } from "../../lib/peopleApi";
import { cn } from "../../lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog";

function StatusBadge({ status }) {
  const map = {
    on_track: "bg-emerald-600 text-white",
    at_risk: "bg-amber-500 text-white",
    off_track: "bg-rose-600 text-white",
  };
  const label =
    status === "on_track" ? "On track" :
    status === "at_risk" ? "À risque" :
    status === "off_track" ? "En retard" : (status || "—");
  return (
    <span className={cn("inline-flex items-center rounded px-2 py-0.5 text-xs", map[status] || "bg-muted text-foreground")}>
      {label}
    </span>
  );
}
StatusBadge.propTypes = {
  status: PropTypes.string, // ✅ règle ESLint satisfaite
};

function ProgressBar({ value = 0 }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="w-full h-2 rounded bg-gray-200 dark:bg-gray-800">
      <div className="h-2 rounded bg-primary" style={{ width: `${v}%` }} />
    </div>
  );
}
ProgressBar.propTypes = {
  value: PropTypes.number, // ✅ règle ESLint satisfaite
};

export default function PerformanceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getGoal(id);
        if (alive) setGoal(data);
      } catch (e) {
        toast.error("Erreur", { description: "Impossible de charger l’objectif" });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  const employeeName = useMemo(
    () => (goal?.employee ? `${goal.employee.firstName || ""} ${goal.employee.lastName || ""}`.trim() : "—"),
    [goal]
  );

  const handleDelete = async () => {
    try {
      setRemoving(true);
      await deleteGoal(id);
      toast.success("Objectif supprimé");
      navigate("/people/performance");
    } catch (e) {
      toast.error("Erreur", { description: "Échec de la suppression" });
    } finally {
      setRemoving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-6 w-40 bg-muted rounded animate-pulse" />
        <div className="h-24 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="p-6">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
        <p className="mt-4 text-sm text-red-600">Objectif introuvable.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:underline mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          <h1 className="text-2xl font-semibold truncate">{goal.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <StatusBadge status={goal.status} />
            <span>{goal.cycle?.name || goal.cycle?.period || "Cycle inconnu"}</span>
            <span>•</span>
            <span>{employeeName}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button className="px-3 py-2 rounded-md border inline-flex items-center gap-2" onClick={() => toast("Édition à venir")}>
            <Pencil className="w-4 h-4" /> Éditer
          </button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="px-3 py-2 rounded-md border inline-flex items-center gap-2 hover:bg-red-50">
                <Trash2 className="w-4 h-4" /> Supprimer
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer cet objectif ?</AlertDialogTitle>
                <AlertDialogDescription>
                  <span className="block mb-1 font-medium">{goal.title}</span>
                  Cette action est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={removing}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {removing ? "Suppression…" : "Supprimer"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Contenu */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border p-4 space-y-3">
          <h2 className="font-medium">Progression</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm tabular-nums">{goal.progress}%</span>
            <div className="flex-1"><ProgressBar value={goal.progress} /></div>
          </div>
        </div>

        <div className="rounded-xl border p-4 space-y-2">
          <h2 className="font-medium">Période</h2>
          <div className="text-sm text-muted-foreground">
            Début : {goal.startDate ? new Date(goal.startDate).toLocaleDateString() : "—"}<br />
            Fin : {goal.endDate ? new Date(goal.endDate).toLocaleDateString() : "—"}
          </div>
        </div>

        <div className="rounded-xl border p-4 space-y-2 md:col-span-2">
          <h2 className="font-medium">Cycle & Employé</h2>
          <div className="text-sm text-muted-foreground">
            Cycle : {goal.cycle?.name || goal.cycle?.period || "—"}<br />
            Employé : {employeeName}
          </div>
        </div>
      </div>
    </div>
  );
}

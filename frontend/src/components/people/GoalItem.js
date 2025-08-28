// frontend/src/components/people/GoalItem.js
"use client";

import React, { useState, memo } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { Edit2, Trash2 } from "lucide-react";
import { updateGoal, deleteGoal } from "../../lib/peopleApi";
import { toast } from "sonner";
import { cn } from "../../lib/utils";

// shadcn/ui (chemin à ajuster si besoin)
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
} from "../ui/alert-dialog";

// ---- UI helpers
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
StatusBadge.propTypes = { status: PropTypes.string };

function ProgressBar({ value = 0 }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="w-40 h-2 rounded bg-gray-200 dark:bg-gray-800" aria-label={`Progression ${v}%`}>
      <div className="h-2 rounded bg-primary" style={{ width: `${v}%` }} />
    </div>
  );
}
ProgressBar.propTypes = { value: PropTypes.number };

// ---- Composant principal
function GoalItemComponent({ goal, onChanged, onRemoved }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: goal.title,
    status: goal.status,
    progress: goal.progress,
  });
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const save = async () => {
    try {
      setSaving(true);
      await updateGoal(goal.id, {
        title: form.title,
        status: form.status,
        progress: Number(form.progress) || 0,
      });
      toast.success("Objectif mis à jour");
      setEditing(false);
      onChanged?.();
    } catch (e) {
      toast.error("Erreur", { description: e?.message || "Échec de la mise à jour" });
    } finally {
      setSaving(false);
    }
  };

  // ⛔️ PLUS DE window.confirm ICI
  const handleDelete = async () => {
    try {
      setRemoving(true);
      await deleteGoal(goal.id);
      toast.success("Objectif supprimé");
      onRemoved?.(goal.id);
    } catch (e) {
      toast.error("Erreur", { description: e?.message || "Échec de la suppression" });
    } finally {
      setRemoving(false);
    }
  };

  if (editing) {
    return (
      <li className="flex items-center gap-2">
        <input
          className="flex-1 border rounded-lg px-2 py-1 text-sm"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <select
          className="border rounded-lg px-2 py-1 text-sm"
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
        >
          <option value="on_track">On track</option>
          <option value="at_risk">At risk</option>
          <option value="off_track">Off track</option>
        </select>
        <input
          type="number"
          min={0}
          max={100}
          className="w-20 border rounded-lg px-2 py-1 text-sm"
          value={form.progress}
          onChange={(e) => setForm({ ...form, progress: e.target.value })}
        />
        <button
          onClick={save}
          disabled={saving}
          className="px-2 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
          title="Enregistrer"
        >
          Enregistrer
        </button>
        <button
          onClick={() => {
            setEditing(false);
            setForm({ title: goal.title, status: goal.status, progress: goal.progress });
          }}
          className="px-2 py-1 rounded-lg border"
          title="Annuler"
        >
          Annuler
        </button>
      </li>
    );
  }

  return (
    <li className="group grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border bg-card p-3 hover:shadow-sm">
      {/* zone cliquable -> détails */}
      <Link
        to={`/people/performance/${goal.id}`}
        className="min-w-0 flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg p-1 -m-1"
        aria-label={`Voir l’objectif ${goal.title}`}
      >
        <div className="min-w-0">
          <div className="font-medium truncate">{goal.title}</div>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <StatusBadge status={goal.status} />
            <span>{goal.cycle?.name || goal.cycle?.period || "Cycle inconnu"}</span>
            <span>•</span>
            <span>
              {goal.employee ? `${goal.employee.firstName || ""} ${goal.employee.lastName || ""}`.trim() : "—"}
            </span>
          </div>
        </div>
      </Link>

      {/* droite : progression + actions */}
      <div className="flex items-center gap-3">
        <span className="text-xs tabular-nums w-10 text-right">{goal.progress}%</span>
        <ProgressBar value={goal.progress} />

        <button
          className="px-2 py-1 rounded-lg border"
          onClick={() => setEditing(true)}
          title="Éditer"
          aria-label="Éditer l’objectif"
        >
          <Edit2 className="w-4 h-4" />
        </button>

        {/* confirmation PRO via AlertDialog */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              className="px-2 py-1 rounded-lg border hover:bg-red-50"
              title="Supprimer"
              aria-label="Supprimer l’objectif"
            >
              <Trash2 className="w-4 h-4" />
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
    </li>
  );
}

GoalItemComponent.propTypes = {
  goal: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string,
    status: PropTypes.string,
    progress: PropTypes.number,
    employee: PropTypes.object,
    cycle: PropTypes.object,
  }).isRequired,
  onChanged: PropTypes.func,
  onRemoved: PropTypes.func,
};

export default memo(GoalItemComponent);

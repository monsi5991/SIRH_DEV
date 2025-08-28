// frontend/src/pages/resources/CompliancePage.js
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
// (Badge non utilisé ici)
import { toast } from "sonner";
import { ShieldCheck, AlertTriangle, CheckCircle2, ClipboardList } from "lucide-react";
import { useApp } from "../../contexts/AppContext";
import { get, patch } from "../../lib/api";

export default function CompliancePage() {
  const { formatDate } = useApp();
  const [summary, setSummary] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const [s, t] = await Promise.all([
        get("/resources/compliance/summary"),
        get("/resources/compliance/tasks?status=todo"),
      ]);
      setSummary(s?.kpis || null);
      setTasks(Array.isArray(t?.items) ? t.items : []);
    } catch (e) {
      setErr(e?.message || "Erreur chargement conformité");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markDone = async (taskId) => {
    try {
      await patch(`/resources/compliance/tasks/${taskId}`, { status: "done" });
      toast.success("Tâche marquée comme faite");
      await load();
    } catch (e) {
      toast.error(e?.message || "Échec mise à jour");
    }
  };

  const addEvidenceUrl = async (taskId) => {
    const url = window.prompt("URL de la preuve (PDF/image) :", "");
    if (!url) return;
    try {
      await patch(`/resources/compliance/tasks/${taskId}`, { evidenceUrl: url });
      toast.success("Preuve ajoutée");
      await load();
    } catch (e) {
      toast.error(e?.message || "Échec ajout de preuve");
    }
  };

  const kpiCards = useMemo(() => {
    if (!summary) return [];
    const pct = summary.total ? Math.round((summary.done / summary.total) * 100) : 0;
    return [
      { title: "Tâches conformité", value: summary.total, icon: ClipboardList, color: "text-gray-600", bg: "bg-gray-100" },
      { title: "Terminées", value: summary.done, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-100" },
      { title: "En retard", value: summary.overdue, icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-100" },
      { title: "Taux global", value: `${pct}%`, icon: ShieldCheck, color: "text-blue-600", bg: "bg-blue-100" },
    ];
  }, [summary]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Conformité RH – Sénégal (MVP)</h1>
        <Button variant="outline" onClick={load}>Rafraîchir</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiCards.map((c, i) => {
          const Icon = c.icon;
          return (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">{c.title}</div>
                    <div className="text-2xl font-bold text-gray-900">{c.value ?? "—"}</div>
                  </div>
                  <div className={`w-12 h-12 rounded-lg ${c.bg} flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${c.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tâches à faire */}
      <Card>
        <CardHeader>
          <CardTitle>Tâches à traiter</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-500">Chargement…</p>
          ) : err ? (
            <p className="text-sm text-red-600">{err}</p>
          ) : tasks.length ? (
            <div className="space-y-3">
              {tasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between border rounded-lg p-3 hover:bg-gray-50"
                >
                  <div>
                    <div className="font-medium">
                      {t.label}
                      {t.employee && (
                        <span className="text-gray-500 font-normal">
                          {" "}
                          — {t.employee.firstName} {t.employee.lastName}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      Échéance : {t.dueAt ? formatDate(t.dueAt) : "—"}
                      {t.evidenceUrl && (
                        <a
                          className="ml-2 text-blue-600 underline"
                          href={t.evidenceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Preuve
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => addEvidenceUrl(t.id)}>
                      Preuve
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => markDone(t.id)}
                    >
                      Marquer fait
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Aucune tâche à afficher.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

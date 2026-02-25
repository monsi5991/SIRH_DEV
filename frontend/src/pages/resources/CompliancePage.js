import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { ShieldCheck, AlertTriangle, CheckCircle2, ClipboardList, Plus, Paperclip } from "lucide-react";
import { useApp } from "../../contexts/AppContext";
import { get, patch, post } from "../../lib/api";
import ComplianceTaskFormDialog from "../../components/resources/ComplianceTaskFormDialog";
import { kpiStart, kpiSuccess, kpiError, kpiComplianceEvidence } from "../../lib/kpiTracker";
import EvidenceUploadDialog from "../../components/resources/EvidenceUploadDialog";

export default function CompliancePage() {
  const { formatDate } = useApp();
  const [summary, setSummary] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [openTask, setOpenTask] = useState(false);
  const [openEvidence, setOpenEvidence] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [obligations, setObligations] = useState([]);

  const load = async () => {
    setLoading(true); setErr("");
    try {
      const [s, t, emps, obls] = await Promise.all([
        get("/resources/compliance/summary"),
        get("/resources/compliance/tasks?status=todo"),
        get("/people/employees?status=ACTIVE"),
        get("/resources/compliance/obligations"),
      ]);
      setSummary(s?.kpis || { total: 0, done: 0, overdue: 0 });
      setTasks(t?.items || []);
      setEmployees(emps?.employees || emps?.items || []);
      setObligations(obls?.items || []);
    } catch (e) {
      setErr(e?.message || "Erreur chargement");
      setSummary(null); setTasks([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const markDone = async (taskId) => {
    try {
      await patch(`/resources/compliance/tasks/${taskId}`, { status: "done" });
      toast.success("Tâche marquée comme faite");
      await load();
    } catch (e) { toast.error(e?.message || "Échec mise à jour"); }
  };

  const addEvidenceUrl = async (taskId, url) => {
    await patch(`/resources/compliance/tasks/${taskId}`, { evidenceUrl: url });
  };

  const addEvidenceFile = async (taskId, file) => {
    const fd = new FormData();
    fd.append("file", file);
    await post(`/resources/compliance/tasks/${taskId}/evidence`, fd);
  };

  const createTask = async (payload) => {
    const t0 = kpiStart("compliance");
    try {
      await post("/resources/compliance/tasks", payload);
      const required = [payload.label, payload.category];
      const filled = required.filter(Boolean).length / required.length;
      kpiSuccess("compliance", t0, filled);
      kpiComplianceEvidence(0, 1);
    } catch (e) {
      kpiError("compliance");
      throw e;
    }
    toast.success("Tâche créée");
    await load();
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={load}>Rafraîchir</Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setOpenTask(true)}><Plus className="w-4 h-4 mr-2" /> Nouvelle tâche</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiCards.map((c, i) => {
          const Icon = c.icon;
          return <Card key={i}><CardContent className="p-6"><div className="flex items-center justify-between"><div><div className="text-sm text-gray-600">{c.title}</div><div className="text-2xl font-bold text-gray-900">{c.value ?? "—"}</div></div><div className={`w-12 h-12 rounded-lg ${c.bg} flex items-center justify-center`}><Icon className={`w-6 h-6 ${c.color}`} /></div></div></CardContent></Card>;
        })}
      </div>

      <Card>
        <CardHeader><CardTitle>Tâches à traiter</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-gray-500">Chargement…</p> : err ? <p className="text-sm text-red-600">{err}</p> : tasks.length ? (
            <div className="space-y-3">
              {tasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between border rounded-lg p-3 hover:bg-gray-50">
                  <div>
                    <div className="font-medium">{t.label}</div>
                    <div className="text-xs text-gray-500">{t.category} • échéance: {t.dueAt ? formatDate(t.dueAt) : "—"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setSelectedTask(t); setOpenEvidence(true); }}><Paperclip className="w-4 h-4 mr-1" /> Preuve</Button>
                    <Button size="sm" onClick={() => markDone(t.id)}>Marquer fait</Button>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-gray-500">Aucune tâche.</p>}
        </CardContent>
      </Card>

      <ComplianceTaskFormDialog open={openTask} onClose={() => setOpenTask(false)} onSubmit={createTask} employees={employees} obligations={obligations} />
      <EvidenceUploadDialog
        open={openEvidence}
        onClose={() => { setOpenEvidence(false); setSelectedTask(null); }}
        onUploadFile={async (file) => { if (!selectedTask) return; await addEvidenceFile(selectedTask.id, file); kpiComplianceEvidence(1, 0); toast.success("Preuve ajoutée"); await load(); }}
        onSaveUrl={async (url) => { if (!selectedTask) return; await addEvidenceUrl(selectedTask.id, url); kpiComplianceEvidence(1, 0); toast.success("Preuve ajoutée"); await load(); }}
      />
    </div>
  );
}

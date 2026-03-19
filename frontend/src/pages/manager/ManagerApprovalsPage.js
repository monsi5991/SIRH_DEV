import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ClipboardList, RefreshCw } from "lucide-react";
import { get } from "../../lib/api";
import { useApp } from "../../contexts/AppContext";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import PageHeader from "../../components/common/PageHeader";
import SectionCard from "../../components/common/SectionCard";
import EmptyState from "../../components/common/EmptyState";
import usePageMeta from "../../hooks/usePageMeta";

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function priorityBadge(priority) {
  const key = String(priority || "").toUpperCase();
  if (key === "HIGH") return "border-rose-200 bg-rose-50 text-rose-700";
  if (key === "NORMAL") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function approvalLabel(type) {
  const key = String(type || "").toUpperCase();
  if (key === "LEAVE") return "Conges";
  if (key === "TIMESHEET") return "Feuilles de temps";
  if (key === "EXPENSE") return "Depenses";
  if (key === "HR_REQUEST") return "Demandes RH";
  return "Validation";
}

function approvalRoute(item) {
  const type = String(item?.type || "").toUpperCase();
  if (type === "LEAVE") return item?.id ? `/operations/leaves?request=${encodeURIComponent(item.id)}` : "/operations/leaves";
  if (type === "EXPENSE") return item?.id ? `/operations/expenses?expense=${encodeURIComponent(item.id)}` : "/operations/expenses";
  if (type === "TIMESHEET") {
    const month = String(item?.submittedAt || "").slice(0, 7);
    const employee = item?.employeeName ? encodeURIComponent(item.employeeName) : "";
    if (month && employee) return `/operations/time?tsMonth=${month}&emp=${employee}`;
    return "/operations/time";
  }
  if (type === "HR_REQUEST") return "/requests/hr";
  return "/manager/dashboard";
}

export default function ManagerApprovalsPage() {
  const navigate = useNavigate();
  const { formatDate } = useApp();
  usePageMeta(
    "Validations manager",
    "Centralisez les demandes a approuver, reperez les blocages et ouvrez directement le bon module."
  );

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await get("/dashboard/manager");
      setData(response || null);
    } catch (e) {
      setData(null);
      setError(e?.message || "Impossible de charger les validations manager.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const approvalsSummary = useMemo(() => {
    const raw = data?.approvalsSummary || {};
    return [
      { key: "leave", label: "Conges", value: num(raw.leavePendingCount), path: "/operations/leaves" },
      { key: "timesheet", label: "Feuilles de temps", value: num(raw.timesheetPendingCount), path: "/operations/time" },
      { key: "expense", label: "Depenses", value: num(raw.expensePendingCount), path: "/operations/expenses" },
      { key: "hrRequest", label: "Demandes RH", value: num(raw.hrRequestPendingCount), path: "/requests/hr" },
    ];
  }, [data]);

  const pendingApprovals = useMemo(
    () => (Array.isArray(data?.pendingApprovals) ? data.pendingApprovals : []),
    [data]
  );

  const totalOpen = useMemo(
    () => approvalsSummary.reduce((total, item) => total + item.value, 0),
    [approvalsSummary]
  );

  const highPriorityCount = useMemo(
    () => pendingApprovals.filter((item) => String(item.priority || "").toUpperCase() === "HIGH").length,
    [pendingApprovals]
  );

  const sameDayCount = useMemo(
    () => pendingApprovals.filter((item) => num(item.ageInDays) <= 1).length,
    [pendingApprovals]
  );

  const oldestApprovalAge = useMemo(
    () => pendingApprovals.reduce((max, item) => Math.max(max, num(item.ageInDays)), 0),
    [pendingApprovals]
  );

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Chargement des validations manager...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Validations manager"
        description="Retrouvez toutes les demandes de votre equipe a arbitrer, puis ouvrez directement le bon module pour agir."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate("/manager/dashboard")}>
              Retour au pilotage
            </Button>
            <Button variant="outline" onClick={load}>
              <RefreshCw className="mr-2 h-4 w-4" /> Rafraichir
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-emerald-100 bg-white p-4 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">A traiter</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{totalOpen}</div>
            <div className="mt-1 text-xs text-slate-500">Toutes validations ouvertes</div>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
            <div className="text-xs uppercase tracking-wide text-rose-700">Urgent</div>
            <div className="mt-2 text-2xl font-bold text-rose-700">{highPriorityCount}</div>
            <div className="mt-1 text-xs text-rose-700">Demandes a traiter en priorite</div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <div className="text-xs uppercase tracking-wide text-emerald-700">Recu aujourd&apos;hui</div>
            <div className="mt-2 text-2xl font-bold text-emerald-700">{sameDayCount}</div>
            <div className="mt-1 text-xs text-emerald-700">Pour repondre sans delai</div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="text-xs uppercase tracking-wide text-amber-700">Plus ancien dossier</div>
            <div className="mt-2 text-2xl font-bold text-amber-700">{oldestApprovalAge} j</div>
            <div className="mt-1 text-xs text-amber-700">Age de la validation la plus ancienne</div>
          </div>
        </div>
      </PageHeader>

      {error ? (
        <SectionCard className="border-rose-200 bg-rose-50" title="Chargement indisponible">
          <div className="text-sm text-rose-700">{error}</div>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Vue par module"
        description="Reperez en un coup d'oeil ou se trouvent les demandes en attente dans votre perimetre."
        className="border-emerald-100 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {approvalsSummary.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => navigate(item.path)}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50/40"
            >
              <div className="text-xs uppercase tracking-wide text-slate-500">{item.label}</div>
              <div className="mt-2 text-3xl font-bold text-slate-900">{item.value}</div>
              <div className="mt-2 text-sm text-slate-600">Ouvrir le module</div>
            </button>
          ))}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard
          title="Validations prioritaires"
          description="Chaque ligne renvoie vers la bonne page pour traiter la demande sans recherche supplementaire."
          className="border-emerald-100 shadow-sm"
        >
          {pendingApprovals.length ? (
            <div className="space-y-3">
              {pendingApprovals.map((item) => (
                <Card key={`${item.type}-${item.id}`} className="border-slate-200 shadow-none">
                  <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900">{item.employeeName || "Collaborateur"}</p>
                        <Badge className={priorityBadge(item.priority)}>{item.priority || "LOW"}</Badge>
                        <Badge variant="outline">{approvalLabel(item.type)}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-700">{item.title || approvalLabel(item.type)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Recu le {item.submittedAt ? formatDate(item.submittedAt) : "—"} · En attente depuis {num(item.ageInDays)} jour(s)
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                      onClick={() => navigate(approvalRoute(item))}
                    >
                      Ouvrir le dossier
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CheckCircle2}
              title="Aucune validation en attente"
              description="Votre equipe n&apos;a pas de demande bloquee pour le moment."
              compact
            />
          )}
        </SectionCard>

        <SectionCard
          title="Raccourcis utiles"
          description="Allez directement vers le bon flux selon le type de demande a arbitrer."
          className="border-emerald-100 shadow-sm"
        >
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => navigate("/operations/leaves")}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50/40"
            >
              <div>
                <div className="font-medium text-slate-900">Conges et absences</div>
                <div className="mt-1 text-sm text-slate-600">Valider rapidement les absences et verifier l&apos;impact equipe.</div>
              </div>
              <Badge variant="outline">{num(data?.approvalsSummary?.leavePendingCount)}</Badge>
            </button>
            <button
              type="button"
              onClick={() => navigate("/operations/time")}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50/40"
            >
              <div>
                <div className="font-medium text-slate-900">Feuilles de temps</div>
                <div className="mt-1 text-sm text-slate-600">Traiter les saisies en attente avant cloture hebdomadaire ou mensuelle.</div>
              </div>
              <Badge variant="outline">{num(data?.approvalsSummary?.timesheetPendingCount)}</Badge>
            </button>
            <button
              type="button"
              onClick={() => navigate("/operations/expenses")}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50/40"
            >
              <div>
                <div className="font-medium text-slate-900">Depenses</div>
                <div className="mt-1 text-sm text-slate-600">Verifier les justificatifs et accelerer les remboursements a approuver.</div>
              </div>
              <Badge variant="outline">{num(data?.approvalsSummary?.expensePendingCount)}</Badge>
            </button>
            <button
              type="button"
              onClick={() => navigate("/requests/hr")}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50/40"
            >
              <div>
                <div className="font-medium text-slate-900">Demandes RH</div>
                <div className="mt-1 text-sm text-slate-600">Suivre attestations, changements RH et demandes qui attendent votre retour.</div>
              </div>
              <Badge variant="outline">{num(data?.approvalsSummary?.hrRequestPendingCount)}</Badge>
            </button>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" /> Bon reflexe manager
              </div>
              <p className="mt-2">
                Traitez d&apos;abord les demandes les plus anciennes ou celles qui bloquent la presence, la paie ou un document attendu par le collaborateur.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <div className="flex items-center gap-2 font-medium text-slate-900">
                <ClipboardList className="h-4 w-4" /> Ce que cette page centralise
              </div>
              <p className="mt-2">
                Conges, temps, depenses et demandes RH de l&apos;equipe sont regroupes ici pour reduire les allers-retours et les validations oubliees.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

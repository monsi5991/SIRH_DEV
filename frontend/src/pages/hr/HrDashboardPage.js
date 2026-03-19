import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import PageHeader from "../../components/common/PageHeader";
import SectionCard from "../../components/common/SectionCard";
import EmptyState from "../../components/common/EmptyState";
import HelpTooltip from "../../components/common/HelpTooltip";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  RefreshCw,
  ShieldAlert,
  Users,
  UserPlus,
  Wallet,
} from "lucide-react";

const DASHBOARD_PERIOD_MONTHS = 12;

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value) {
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(num(value)))} XOF`;
}

function formatPercent(value, digits = 1) {
  return `${num(value).toFixed(digits)}%`;
}

function monthStart(date, delta = 0) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function startOfDay(value) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(value) {
  const d = new Date(value);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addDays(value, days) {
  const d = new Date(value);
  d.setDate(d.getDate() + days);
  return d;
}

function businessDaysBetweenInclusive(from, to) {
  const start = startOfDay(from);
  const end = startOfDay(to);
  if (end < start) return 0;
  let count = 0;
  for (let current = new Date(start); current <= end; current = addDays(current, 1)) {
    const day = current.getDay();
    if (day >= 1 && day <= 5) count += 1;
  }
  return count;
}

function overlapBusinessDays(start, end, rangeStart, rangeEnd) {
  const safeStart = startOfDay(start);
  const safeEnd = startOfDay(end);
  const safeRangeStart = startOfDay(rangeStart);
  const safeRangeEnd = startOfDay(rangeEnd);
  if (safeEnd < safeRangeStart || safeStart > safeRangeEnd) return 0;
  const from = safeStart > safeRangeStart ? safeStart : safeRangeStart;
  const to = safeEnd < safeRangeEnd ? safeEnd : safeRangeEnd;
  return businessDaysBetweenInclusive(from, to);
}

function isActiveInRange(employee, start, end) {
  const join = employee?.joinDate ? startOfDay(employee.joinDate) : null;
  const exit = employee?.endDate ? startOfDay(employee.endDate) : null;
  return (!join || join <= endOfDay(end)) && (!exit || exit >= startOfDay(start));
}

function matchesFilter(employee, siteFilter, departmentFilter) {
  if (siteFilter && employee?.site !== siteFilter) return false;
  if (departmentFilter && employee?.department !== departmentFilter) return false;
  return true;
}

function monthsDifference(from, to = new Date()) {
  const start = new Date(from);
  if (Number.isNaN(start.getTime())) return 0;
  return (to.getFullYear() - start.getFullYear()) * 12 + (to.getMonth() - start.getMonth());
}

function complianceTone(itemKey, value) {
  if (value <= 0) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (itemKey === "cnss" || itemKey === "ipres") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function actionTone(value) {
  if (value >= 5) return "border-rose-200 bg-rose-50 text-rose-700";
  if (value > 0) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function perimeterSummary(siteFilter, departmentFilter) {
  if (!siteFilter && !departmentFilter) return "Tous les sites · Tous les départements";
  if (siteFilter && departmentFilter) return `${siteFilter} · ${departmentFilter}`;
  if (siteFilter) return `${siteFilter} · Tous les départements`;
  return `Tous les sites · ${departmentFilter}`;
}

export default function HrDashboardPage() {
  const navigate = useNavigate();
  const [siteFilter, setSiteFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [showZeros, setShowZeros] = useState(false);
  const [data, setData] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [compliance, setCompliance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [dashboardRes, employeeRes, leavesRes, complianceRes] = await Promise.all([
        get("/dashboard/hr"),
        get("/people/employees?page=1&pageSize=500"),
        get("/operations/leaves"),
        get("/resources/compliance/summary").catch(() => ({ kpis: { total: 0, overdue: 0 }, overdue: [] })),
      ]);
      setData(dashboardRes || null);
      setEmployees(Array.isArray(employeeRes?.items) ? employeeRes.items : []);
      setLeaves(Array.isArray(leavesRes?.leaves) ? leavesRes.leaves : Array.isArray(leavesRes) ? leavesRes : []);
      setCompliance(complianceRes || null);
    } catch (e) {
      setData(null);
      setEmployees([]);
      setLeaves([]);
      setCompliance(null);
      setError(e?.message || "Erreur de chargement du tableau de bord");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sites = useMemo(
    () => Array.from(new Set(employees.map((item) => item?.site).filter(Boolean))).sort(),
    [employees]
  );
  const departments = useMemo(
    () => Array.from(new Set(employees.map((item) => item?.department).filter(Boolean))).sort(),
    [employees]
  );

  const scopedEmployees = useMemo(
    () => employees.filter((employee) => matchesFilter(employee, siteFilter, departmentFilter)),
    [employees, siteFilter, departmentFilter]
  );

  const scopedEmployeeIds = useMemo(
    () => new Set(scopedEmployees.map((employee) => employee.id)),
    [scopedEmployees]
  );

  const scopedLeaves = useMemo(
    () => leaves.filter((leave) => !leave?.employeeId || scopedEmployeeIds.has(leave.employeeId)),
    [leaves, scopedEmployeeIds]
  );

  const trendRows = useMemo(() => {
    const now = new Date();
    return Array.from({ length: DASHBOARD_PERIOD_MONTHS }).map((_, index) => {
      const start = monthStart(now, index - (DASHBOARD_PERIOD_MONTHS - 1));
      const end = addDays(monthStart(start, 1), -1);
      const activeEmployees = scopedEmployees.filter((employee) => isActiveInRange(employee, start, end));
      const leavers = scopedEmployees.filter((employee) => {
        if (!employee?.endDate) return false;
        const endDate = new Date(employee.endDate);
        return endDate >= start && endDate <= end;
      }).length;
      const leaveDays = scopedLeaves
        .filter((leave) => String(leave?.status || "").toLowerCase() === "approved")
        .reduce((total, leave) => {
          if (!leave?.start || !leave?.end) return total;
          return total + overlapBusinessDays(leave.start, leave.end, start, end);
        }, 0);

      return {
        start,
        end,
        headcount: activeEmployees.length,
        leavers,
        leaveDays,
      };
    });
  }, [scopedEmployees, scopedLeaves]);

  const overviewCards = useMemo(() => {
    const now = new Date();
    const activeNow = scopedEmployees.filter((employee) => {
      const status = String(employee?.status || "ACTIVE").toUpperCase();
      return status === "ACTIVE" && isActiveInRange(employee, now, now);
    });
    const payroll = activeNow.reduce((total, employee) => total + num(employee?.baseSalary), 0);
    const averageHeadcount = trendRows.length
      ? trendRows.reduce((total, row) => total + row.headcount, 0) / trendRows.length
      : 0;
    const trailingLeavers = trendRows.reduce((total, row) => total + row.leavers, 0);
    const last30Start = addDays(now, -29);
    const activeLast30 = scopedEmployees.filter((employee) => isActiveInRange(employee, last30Start, now));
    const approvedLeaveDays30 = scopedLeaves
      .filter((leave) => String(leave?.status || "").toLowerCase() === "approved")
      .reduce((total, leave) => {
        if (!leave?.start || !leave?.end) return total;
        return total + overlapBusinessDays(leave.start, leave.end, last30Start, now);
      }, 0);
    const theoreticalDays30 = activeLast30.length * businessDaysBetweenInclusive(last30Start, now);
    const absenceRate30 = theoreticalDays30 ? (approvedLeaveDays30 / theoreticalDays30) * 100 : 0;

    return [
      {
        key: "headcount",
        label: "Employés",
        value: `${activeNow.length}`,
        helper: "Effectif actif dans le périmètre sélectionné.",
        icon: Users,
        path: "/people/directory",
        tone: "bg-emerald-50 text-emerald-700",
      },
      {
        key: "payroll",
        label: "Salaire mensuel",
        value: formatMoney(payroll),
        helper: "Estimation basée sur le salaire brut mensuel visible dans les dossiers.",
        icon: Wallet,
        path: "/analytics/reports",
        tone: "bg-teal-50 text-teal-700",
      },
      {
        key: "turnover",
        label: "Turnover 12 mois",
        value: formatPercent(averageHeadcount ? (trailingLeavers / averageHeadcount) * 100 : 0, 1),
        helper: "Sorties cumulées sur 12 mois rapportées à l’effectif moyen.",
        icon: ArrowRight,
        path: "/analytics/reports",
        tone: "bg-amber-50 text-amber-700",
      },
      {
        key: "absence",
        label: "Absences 30 jours",
        value: formatPercent(absenceRate30, 2),
        helper: "Taux basé sur les congés approuvés sur les 30 derniers jours ouvrables.",
        icon: CalendarClock,
        path: "/operations/leaves",
        tone: "bg-violet-50 text-violet-700",
      },
      {
        key: "hires",
        label: "Entrées ce mois",
        value: `${num(data?.globalKpis?.hiresThisMonth)}`,
        helper: "Nouvelles arrivées à finaliser sur la période en cours.",
        icon: UserPlus,
        path: "/people/directory",
        tone: "bg-sky-50 text-sky-700",
      },
      {
        key: "hrRequests",
        label: "Demandes RH ouvertes",
        value: `${num(data?.openHrRequestsSummary?.totalOpen)}`,
        helper: "Demandes en attente de traitement ou de réponse RH.",
        icon: ClipboardList,
        path: "/requests/hr",
        tone: "bg-orange-50 text-orange-700",
      },
    ];
  }, [data?.globalKpis?.hiresThisMonth, data?.openHrRequestsSummary?.totalOpen, scopedEmployees, scopedLeaves, trendRows]);

  const complianceCards = useMemo(() => {
    const complianceByCategory = compliance?.kpis?.byCategory || {};
    const inspections = Object.entries(complianceByCategory).reduce((total, [category, values]) => {
      if (/(inspection|inspection_it|inspection_travail|legal)/i.test(category)) {
        return total + Math.max(0, num(values?.total) - num(values?.done));
      }
      return total;
    }, 0);

    return [
      {
        key: "cnss",
        label: "Références sociales manquantes",
        value: scopedEmployees.filter((employee) => !employee?.cnss).length,
        helper: "Référence organisme social absente sur un dossier salarié.",
        path: "/resources/compliance",
      },
      {
        key: "ipres",
        label: "Références retraite manquantes",
        value: scopedEmployees.filter((employee) => !employee?.ipres).length,
        helper: "Référence retraite ou pension manquante avant paie et déclarations.",
        path: "/resources/compliance",
      },
      {
        key: "cdd",
        label: "Risque CDI",
        value: scopedEmployees.filter((employee) => {
          const type = String(employee?.contractType || "").toUpperCase();
          return type === "CDD" && monthsDifference(employee?.joinDate, new Date()) >= 22;
        }).length,
        helper: "CDD successifs proches de 24 mois cumulés.",
        path: "/people/contracts",
      },
      {
        key: "inspection",
        label: "Inspections / preuves",
        value: inspections || num(compliance?.kpis?.overdue),
        helper: "Obligations, inspections et justificatifs en retard.",
        path: "/resources/compliance",
      },
    ];
  }, [compliance, scopedEmployees]);

  const actionItems = useMemo(() => {
    const now = new Date();
    const next7 = addDays(now, 7);
    const contractsEnding = (data?.contractsEndingSoonGlobal || []).filter((row) => {
      const employee = employees.find((item) => item.id === row.employeeId);
      return employee ? matchesFilter(employee, siteFilter, departmentFilter) : !siteFilter && !departmentFilter;
    }).length;
    const missingDocs = (data?.missingMandatoryDocuments || []).filter((row) => {
      const employee = employees.find((item) => item.id === row.employeeId);
      return employee ? matchesFilter(employee, siteFilter, departmentFilter) : !siteFilter && !departmentFilter;
    }).length;
    const incompleteFiles = (data?.incompleteEmployeeFiles || []).filter((row) => {
      const employee = employees.find((item) => item.id === row.employeeId);
      return employee ? matchesFilter(employee, siteFilter, departmentFilter) : !siteFilter && !departmentFilter;
    }).length;
    const probationEndingSoon = scopedEmployees.filter((employee) => {
      if (!employee?.joinDate) return false;
      const probationEnd = addDays(new Date(employee.joinDate), 90);
      return probationEnd >= startOfDay(now) && probationEnd <= endOfDay(next7);
    }).length;
    const pendingLeaves = scopedLeaves.filter((leave) => String(leave?.status || "").toLowerCase() === "pending").length;
    const pendingHrRequests = num(data?.openHrRequestsSummary?.totalOpen);
    const activeCampaigns = num(data?.talentSummary?.activeCampaignsCount);
    const upcomingTrainingSessions = num(data?.trainingSummary?.upcomingSessionsCount);

    return [
      {
        key: "missing-docs",
        title: "Documents à compléter",
        count: missingDocs,
        detail: "Contrats signés, pièces d’identité et justificatifs manquants.",
        path: "/people/documents",
      },
      {
        key: "incomplete-files",
        title: "Profils incomplets",
        count: incompleteFiles,
        detail: "Coordonnées, références sociales ou données RH à compléter.",
        path: "/people/directory",
      },
      {
        key: "contracts",
        title: "Contrats à renouveler",
        count: contractsEnding,
        detail: "Préparer le renouvellement, la sortie ou la bascule avant échéance.",
        path: "/people/contracts",
      },
      {
        key: "probation",
        title: "Décisions période d’essai",
        count: probationEndingSoon,
        detail: "Décision attendue sous 7 jours sur les fins d’essai.",
        path: "/people/contracts",
      },
      {
        key: "leaves",
        title: "Congés à valider",
        count: pendingLeaves,
        detail: "Demandes en attente dans le circuit N+1 puis RH.",
        path: "/operations/leaves",
      },
      {
        key: "hr-requests",
        title: "Demandes RH ouvertes",
        count: pendingHrRequests,
        detail: "Attestations, changements RH et demandes administratives à reprendre.",
        path: "/requests/hr",
      },
      {
        key: "training",
        title: "Sessions formation à préparer",
        count: upcomingTrainingSessions,
        detail: "Sessions à venir, inscriptions et rappels à sécuriser côté RH.",
        path: "/people/training",
      },
      {
        key: "performance",
        title: "Campagnes performance actives",
        count: activeCampaigns,
        detail: "Objectifs, entretiens et relances manager à suivre sans attendre la clôture.",
        path: "/people/performance",
      },
    ];
  }, [
    data?.contractsEndingSoonGlobal,
    data?.incompleteEmployeeFiles,
    data?.missingMandatoryDocuments,
    data?.openHrRequestsSummary?.totalOpen,
    data?.talentSummary?.activeCampaignsCount,
    data?.trainingSummary?.upcomingSessionsCount,
    departmentFilter,
    employees,
    scopedEmployees,
    scopedLeaves,
    siteFilter,
  ]);

  const visibleActionItems = useMemo(() => {
    const filtered = showZeros ? actionItems : actionItems.filter((item) => item.count > 0);
    return filtered.slice(0, 5);
  }, [actionItems, showZeros]);

  const hiddenActionCount = useMemo(() => {
    const filtered = showZeros ? actionItems : actionItems.filter((item) => item.count > 0);
    return Math.max(0, filtered.length - 5);
  }, [actionItems, showZeros]);

  const visibleComplianceCards = useMemo(
    () => (showZeros ? complianceCards : complianceCards.filter((item) => item.value > 0)),
    [complianceCards, showZeros]
  );

  const totalUrgencies = useMemo(
    () => actionItems.reduce((total, item) => total + item.count, 0),
    [actionItems]
  );

  const activeAlertsCount = useMemo(
    () => actionItems.filter((item) => item.count > 0).length,
    [actionItems]
  );

  const totalComplianceIssues = useMemo(
    () => complianceCards.reduce((total, item) => total + item.value, 0),
    [complianceCards]
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="rounded-3xl border border-emerald-100 bg-white p-8 shadow-sm">
          <div className="text-sm text-slate-500">Chargement du tableau de bord…</div>
          <div className="mt-3 h-2 w-56 overflow-hidden rounded-full bg-emerald-100">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-emerald-500" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 bg-gradient-to-b from-[#f2f8f6] via-[#f8fbfa] to-white p-4 md:p-5">
      <PageHeader
        title="Pilotage RH"
        description="Vos urgences RH, la conformité sociale et les indicateurs clés du jour."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="ghost"
              className="rounded-xl text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
              aria-pressed={showZeros}
              onClick={() => setShowZeros((current) => !current)}
            >
              {showZeros ? "Masquer les zéros" : "Afficher les zéros"}
            </Button>
            <Button
              variant="outline"
              className="rounded-xl border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"
              onClick={() => navigate("/people/documents")}
            >
              Parcours salariés
            </Button>
            <Button
              variant="outline"
              className="rounded-xl border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"
              onClick={() => navigate("/analytics/reports")}
            >
              Voir rapports
            </Button>
            <Button
              variant="outline"
              className="rounded-xl border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"
              onClick={load}
              aria-label="Actualiser le tableau de bord"
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Actualiser
            </Button>
          </div>
        }
      >
        <div className="relative overflow-hidden rounded-[28px] border border-emerald-200/60 bg-[linear-gradient(135deg,#065f46_0%,#0f766e_45%,#155e75_100%)] p-4 text-white shadow-[0_24px_60px_-28px_rgba(4,120,87,0.55)] md:p-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(52,211,153,0.18),transparent_32%)]" />
          <div className="relative space-y-4">
            <Badge className="w-fit border border-white/20 bg-white/10 text-emerald-50 backdrop-blur-sm">
              Pilotage RH
            </Badge>
              <div className="space-y-1.5">
                <div className="text-2xl font-semibold tracking-tight md:text-[2rem]">Priorités RH du jour</div>
                <p className="max-w-2xl text-sm leading-5 text-emerald-50/85">
                  Traitez les urgences, sécurisez la conformité sociale et gardez une vue nette de votre périmètre.
                </p>
              </div>
            <div className="grid gap-2.5 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/12 bg-white/10 p-3.5 backdrop-blur-sm">
                <div className="text-xs uppercase tracking-[0.18em] text-emerald-50/70">Urgences</div>
                <div className="mt-1.5 text-2xl font-semibold">{totalUrgencies}</div>
                <div className="mt-0.5 text-xs text-emerald-50/75">{activeAlertsCount} sujet(s) actifs</div>
              </div>
              <div className="rounded-2xl border border-white/12 bg-white/10 p-3.5 backdrop-blur-sm">
                <div className="text-xs uppercase tracking-[0.18em] text-emerald-50/70">Conformité</div>
                <div className="mt-1.5 text-2xl font-semibold">{totalComplianceIssues}</div>
                <div className="mt-0.5 text-xs text-emerald-50/75">point(s) à suivre</div>
              </div>
              <div className="rounded-2xl border border-white/12 bg-white/10 p-3.5 backdrop-blur-sm">
                <div className="text-xs uppercase tracking-[0.18em] text-emerald-50/70">Effectif</div>
                <div className="mt-1.5 text-2xl font-semibold">{scopedEmployees.length}</div>
                <div className="mt-0.5 text-xs text-emerald-50/75">sur le périmètre courant</div>
              </div>
            </div>
            <div className="flex flex-col gap-2.5 rounded-[22px] border border-white/12 bg-white/10 px-4 py-3 backdrop-blur-sm lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-50/70">Filtrer</div>
                <div className="text-xs text-emerald-50/85">{perimeterSummary(siteFilter, departmentFilter)}</div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-emerald-50">Site</span>
                  <select
                    className="h-10 w-full min-w-[170px] rounded-2xl border border-white/15 bg-white/95 px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300"
                    value={siteFilter}
                    onChange={(e) => setSiteFilter(e.target.value)}
                  >
                    <option value="">Tous les sites</option>
                    {sites.map((site) => (
                      <option key={site} value={site}>
                        {site}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-emerald-50">Département</span>
                  <select
                    className="h-10 w-full min-w-[170px] rounded-2xl border border-white/15 bg-white/95 px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-300"
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                  >
                    <option value="">Tous les départements</option>
                    {departments.map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </div>
        </div>
      </PageHeader>

      {error ? (
        <SectionCard className="border-rose-200 bg-rose-50" title="Erreur de chargement">
          <div className="text-sm text-rose-700">{error}</div>
        </SectionCard>
      ) : null}

      <SectionCard
        title={
          <span className="inline-flex items-center gap-2">
            <BriefcaseBusiness className="h-5 w-5 text-emerald-700" /> À traiter aujourd’hui
            <HelpTooltip content="Les urgences sont limitées aux actions immédiates côté RH. Les lignes à zéro restent masquées par défaut pour garder une home lisible." />
          </span>
        }
        description="Les dossiers qui demandent une action RH immédiate."
        className="border border-emerald-100/80 bg-white/90 shadow-[0_18px_45px_-30px_rgba(15,118,110,0.35)] backdrop-blur-sm"
        headerClassName="pb-4"
      >
        <div className="space-y-2.5">
          {visibleActionItems.length ? (
            visibleActionItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => navigate(item.path)}
                className="group flex w-full items-center justify-between gap-3 rounded-[22px] border border-emerald-100 bg-[linear-gradient(135deg,rgba(255,255,255,1)_0%,rgba(236,253,245,0.9)_100%)] px-4 py-3.5 text-left transition hover:-translate-y-[1px] hover:border-emerald-200 hover:shadow-[0_18px_30px_-24px_rgba(4,120,87,0.5)] focus:outline-none focus:ring-2 focus:ring-emerald-200"
                aria-label={`${item.title}, ${item.count} à traiter`}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className={`mt-1 h-10 w-1.5 flex-none rounded-full ${item.count >= 5 ? "bg-rose-500" : item.count > 0 ? "bg-amber-500" : "bg-emerald-500"}`} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900">{item.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.detail}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={actionTone(item.count)}>{item.count}</Badge>
                  <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5" />
                </div>
              </button>
            ))
          ) : (
            <EmptyState
              icon={CheckCircle2}
              title="Rien à traiter aujourd’hui"
              description="Aucune urgence RH sur le périmètre sélectionné. Vous pouvez afficher les zéros pour vérifier les autres indicateurs."
              compact
            />
          )}

          {hiddenActionCount > 0 ? (
            <div className="flex justify-end">
              <Button variant="ghost" className="rounded-xl text-emerald-700 hover:bg-emerald-50" onClick={() => navigate("/analytics/reports")}>
                Voir tout ({hiddenActionCount + 5})
              </Button>
            </div>
          ) : null}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard
          title={
            <span className="inline-flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" /> Conformité sociale
              <HelpTooltip content="Vue courte des sujets de conformité les plus sensibles sur votre périmètre : affiliations sociales, contrats, inspections et justificatifs." />
            </span>
          }
          description="Les points qui peuvent bloquer une déclaration, un contrôle ou une décision contractuelle."
          actions={
            <Button
              variant="outline"
              className="rounded-xl border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
              onClick={() => navigate("/resources/compliance")}
            >
              Voir détails
            </Button>
          }
          className="border border-amber-100/80 bg-white/90 shadow-[0_18px_45px_-30px_rgba(245,158,11,0.28)] backdrop-blur-sm"
          headerClassName="pb-4"
        >
          {visibleComplianceCards.length ? (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {visibleComplianceCards.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`group rounded-[22px] border p-3.5 text-left transition hover:-translate-y-[1px] hover:shadow-[0_18px_30px_-24px_rgba(0,0,0,0.28)] focus:outline-none focus:ring-2 focus:ring-emerald-200 ${complianceTone(item.key, item.value)}`}
                  aria-label={`${item.label}, ${item.value}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{item.label}</div>
                      <div className="mt-1.5 text-2xl font-bold">{item.value}</div>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 opacity-70 transition group-hover:translate-x-0.5" />
                  </div>
                  <div className="mt-2 text-xs leading-5 opacity-90">{item.helper}</div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CheckCircle2}
              title="Aucun point bloquant"
              description="Aucune alerte de conformité prioritaire n’est remontée sur ce périmètre."
              compact
            />
          )}
        </SectionCard>

        <SectionCard
          title={
            <span className="inline-flex items-center gap-2">
              <Users className="h-5 w-5 text-sky-600" /> Aperçu RH
              <HelpTooltip content="Vue courte des indicateurs les plus consultés: effectif, masse salariale, dynamique du mois, demandes RH ouvertes et absences." />
            </span>
          }
          description="Une lecture rapide de l’entreprise sans changer d’écran ni perdre votre contexte RH."
          className="border border-sky-100/80 bg-white/90 shadow-[0_18px_45px_-30px_rgba(14,165,233,0.24)] backdrop-blur-sm"
          headerClassName="pb-4"
        >
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {overviewCards.map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => navigate(card.path)}
                  className="group rounded-[22px] border border-slate-200 bg-[linear-gradient(160deg,rgba(255,255,255,1)_0%,rgba(248,250,252,0.94)_100%)] p-3.5 text-left transition hover:-translate-y-[1px] hover:border-emerald-200 hover:shadow-[0_18px_30px_-24px_rgba(14,165,233,0.35)] focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  aria-label={`${card.label}: ${card.value}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                        {card.label}
                        <HelpTooltip content={card.helper} side="right" />
                      </div>
                      <div className="text-[1.7rem] font-bold text-slate-900">{card.value}</div>
                    </div>
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.tone}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center text-[11px] font-medium text-emerald-700 opacity-0 transition group-hover:opacity-100">
                    Voir détail <ChevronRight className="ml-1 h-3.5 w-3.5" />
                  </div>
                </button>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

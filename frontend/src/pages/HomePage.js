import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  CheckCircle2,
  Clock,
  FileCheck,
  FileText,
  HandCoins,
  Search,
  UserCheck,
  UserPlus,
  Users,
  Workflow,
} from "lucide-react";

import { get } from "../lib/api";
import { useApp } from "../contexts/AppContext";
import { useAuth } from "../contexts/AuthContext";

import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import PageHeader from "../components/common/PageHeader";
import SectionCard from "../components/common/SectionCard";
import EmptyState from "../components/common/EmptyState";
import KPIChip from "../components/common/KPIChip";
import ListItem from "../components/common/ListItem";
import { KpiGridSkeleton, ListSkeleton } from "../components/common/Skeletons";

import { checkPermission, normalizeRoles, resolveTeamEmployeeIds, SCOPES } from "../lib/permissions";

const MAX_TODO_ITEMS = 8;

function getEmployeeList(payload) {
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.employees)) return payload.employees;
  if (Array.isArray(payload)) return payload;
  return [];
}

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysUntil(date) {
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((target - today) / (24 * 60 * 60 * 1000));
}

function severityLabel(days) {
  if (days <= 2) return "Urgent";
  if (days <= 7) return "Cette semaine";
  return "À planifier";
}

function buildHolidays(referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const nextYear = year + 1;

  const fixed = [
    { m: 1, d: 1, name: "Jour de l’an" },
    { m: 4, d: 4, name: "Fête de l’indépendance" },
    { m: 5, d: 1, name: "Fête du Travail" },
    { m: 8, d: 15, name: "Assomption" },
    { m: 11, d: 1, name: "Toussaint" },
    { m: 12, d: 25, name: "Noël" },
  ];

  const items = [year, nextYear].flatMap((y) =>
    fixed.map((f) => ({
      id: `${y}-${f.m}-${f.d}`,
      name: f.name,
      date: new Date(y, f.m - 1, f.d),
    }))
  );

  return items
    .filter((h) => h.date >= new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate()))
    .sort((a, b) => a.date - b.date)
    .slice(0, 4);
}

function resolveBirthday(employee, now = new Date()) {
  const direct = toDate(employee?.birthDate || employee?.dateOfBirth);
  if (!direct) return null;

  const month = direct.getMonth();
  const day = direct.getDate();

  const year = now.getFullYear();
  let birthday = new Date(year, month, day);
  if (birthday < new Date(year, now.getMonth(), now.getDate())) {
    birthday = new Date(year + 1, month, day);
  }

  return { date: birthday };
}

export default function HomePage() {
  const navigate = useNavigate();
  const { formatDate } = useApp();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [summary, setSummary] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [onboardingCases, setOnboardingCases] = useState([]);
  const [directoryCounters, setDirectoryCounters] = useState(null);

  const tenantName =
    user?.tenant?.name ||
    (user?.email ? user.email.split("@")[1] : null) ||
    "Mon espace";

  const firstName = user?.firstName || (user?.email ? user.email.split("@")[0] : "");

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");

      const [
        summaryRes,
        employeesRes,
        leavesRes,
        timesheetsRes,
        expensesRes,
        onboardingRes,
        countersRes,
      ] = await Promise.allSettled([
        get("/dashboard/summary"),
        get("/people/employees?page=1&pageSize=500").catch(() => get("/employees")),
        get("/operations/leaves").catch(() => ({ leaves: [] })),
        get("/operations/timesheets").catch(() => ({ timesheets: [] })),
        get("/operations/expenses").catch(() => ({ expenses: [] })),
        get("/documents/onboarding/cases?status=open").catch(() => ({ items: [] })),
        get("/people/counters/directory").catch(() => null),
      ]);

      if (!active) return;

      if (summaryRes.status === "rejected") {
        setError(summaryRes.reason?.message || "Impossible de charger le dashboard.");
        setSummary(null);
      } else {
        setSummary(summaryRes.value || null);
      }

      setEmployees(employeesRes.status === "fulfilled" ? getEmployeeList(employeesRes.value) : []);
      setLeaves(leavesRes.status === "fulfilled" ? leavesRes.value?.leaves || [] : []);
      setTimesheets(timesheetsRes.status === "fulfilled" ? timesheetsRes.value?.timesheets || [] : []);
      setExpenses(expensesRes.status === "fulfilled" ? expensesRes.value?.expenses || [] : []);
      setOnboardingCases(onboardingRes.status === "fulfilled" ? onboardingRes.value?.items || [] : []);
      setDirectoryCounters(countersRes.status === "fulfilled" ? countersRes.value : null);

      setLoading(false);
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const roles = useMemo(() => normalizeRoles(user?.roles || user?.role || []), [user]);

  const visibilityScope = useMemo(() => {
    if (roles.includes("ADMIN") || roles.includes("HR")) return SCOPES.COMPANY;
    if (roles.includes("MANAGER")) return SCOPES.TEAM;
    return SCOPES.SELF;
  }, [roles]);

  const teamEmployeeIds = useMemo(() => resolveTeamEmployeeIds(employees, user?.employeeId), [employees, user]);

  const canSeeEmployeeData = (employeeId) =>
    checkPermission({
      user,
      requiredScope: visibilityScope,
      targetEmployeeId: employeeId || undefined,
      teamEmployeeIds,
    });

  const scopedLeaves = useMemo(
    () => leaves.filter((item) => canSeeEmployeeData(item.employeeId)),
    [leaves, visibilityScope, user, teamEmployeeIds]
  );

  const scopedTimesheets = useMemo(
    () => timesheets.filter((item) => canSeeEmployeeData(item.employeeId)),
    [timesheets, visibilityScope, user, teamEmployeeIds]
  );

  const scopedExpenses = useMemo(
    () => expenses.filter((item) => canSeeEmployeeData(item.employeeId)),
    [expenses, visibilityScope, user, teamEmployeeIds]
  );

  const scopedEmployees = useMemo(
    () => employees.filter((employee) => canSeeEmployeeData(employee.id)),
    [employees, visibilityScope, user, teamEmployeeIds]
  );

  const todoItems = useMemo(() => {
    const pendingLeaves = scopedLeaves.filter((l) => l.status === "Pending").length;
    const submittedTimesheets = scopedTimesheets.filter((t) => t.status === "Submitted").length;
    const submittedExpenses = scopedExpenses.filter((e) => e.status === "Submitted").length;

    const onboardingOpen = onboardingCases.filter((c) => {
      if (visibilityScope === SCOPES.COMPANY) return true;
      if (!c.employeeId) return false;
      return canSeeEmployeeData(c.employeeId);
    }).length;

    const soonEndContracts = scopedEmployees.filter((e) => {
      const d = toDate(e.endDate);
      if (!d) return false;
      const days = daysUntil(d);
      return days >= 0 && days <= 30;
    }).length;

    const probationEnding = scopedEmployees.filter((e) => {
      const join = toDate(e.joinDate);
      if (!join) return false;
      const probationEnd = new Date(join);
      probationEnd.setDate(probationEnd.getDate() + 90);
      const days = daysUntil(probationEnd);
      return days >= 0 && days <= 14;
    }).length;

    const localMissingProfiles = scopedEmployees.filter(
      (e) => !e.phone || !e.department || !e.position
    ).length;

    const missingDocuments =
      visibilityScope === SCOPES.COMPANY && directoryCounters
        ? Number(directoryCounters.profilesIncomplete || 0) + Number(directoryCounters.docsExpiring || 0)
        : localMissingProfiles;

    const items = [
      {
        id: "leaves-pending",
        icon: Calendar,
        title: "Demandes de congés à approuver",
        subtitle: "Validez les absences en attente pour éviter les retards planning.",
        badge: `${pendingLeaves} en attente`,
        href: "/operations/leaves",
        visible: pendingLeaves > 0,
        severity: "warning",
      },
      {
        id: "timesheets-submitted",
        icon: Clock,
        title: "Feuilles de temps à valider",
        subtitle: "Des feuilles de temps attendent une validation manager/RH.",
        badge: `${submittedTimesheets} à valider`,
        href: "/operations/time",
        visible: submittedTimesheets > 0,
        severity: "warning",
      },
      {
        id: "expenses-submitted",
        icon: HandCoins,
        title: "Dépenses à traiter",
        subtitle: "Finalisez les dépenses soumises pour fluidifier les remboursements.",
        badge: `${submittedExpenses} soumises`,
        href: "/operations/expenses",
        visible: submittedExpenses > 0,
        severity: "info",
      },
      {
        id: "missing-docs",
        icon: FileText,
        title: "Documents RH à compléter",
        subtitle: "Profils incomplets et justificatifs proches d’expiration.",
        badge: `${missingDocuments} éléments`,
        href: "/people/directory",
        visible: missingDocuments > 0,
        severity: "danger",
      },
      {
        id: "onboarding-open",
        icon: UserPlus,
        title: "Onboarding actifs",
        subtitle: "Des parcours d’intégration sont en cours.",
        badge: `${onboardingOpen} parcours`,
        href: "/documents/onboarding",
        visible: onboardingOpen > 0,
        severity: "info",
      },
      {
        id: "probation-reminder",
        icon: Users,
        title: "Fin de période d’essai proche",
        subtitle: "Préparez les entretiens de fin de période d’essai.",
        badge: `${probationEnding} à suivre`,
        href: "/people/directory",
        visible: probationEnding > 0,
        severity: "warning",
      },
      {
        id: "contract-reminder",
        icon: FileCheck,
        title: "Contrats arrivant à échéance",
        subtitle: "Anticipez les renouvellements ou sorties collaborateurs.",
        badge: `${soonEndContracts} contrats`,
        href: "/people/contracts",
        visible: soonEndContracts > 0,
        severity: "danger",
      },
    ];

    return items
      .filter((item) => item.visible)
      .slice(0, MAX_TODO_ITEMS)
      .sort((a, b) => {
        const rank = { danger: 3, warning: 2, info: 1 };
        return (rank[b.severity] || 0) - (rank[a.severity] || 0);
      });
  }, [
    scopedLeaves,
    scopedTimesheets,
    scopedExpenses,
    scopedEmployees,
    onboardingCases,
    directoryCounters,
    visibilityScope,
  ]);

  const filteredTodoItems = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return todoItems;
    return todoItems.filter((item) => {
      const hay = `${item.title} ${item.subtitle} ${item.badge}`.toLowerCase();
      return hay.includes(term);
    });
  }, [todoItems, searchQuery]);

  const holidays = useMemo(() => buildHolidays(new Date()), []);

  const upcomingBirthdays = useMemo(() => {
    const now = new Date();
    return scopedEmployees
      .map((e) => {
        const birthday = resolveBirthday(e, now);
        if (!birthday) return null;
        return {
          id: e.id,
          name: `${e.firstName || ""} ${e.lastName || ""}`.trim() || e.email || "Employé",
          date: birthday.date,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.date - b.date)
      .slice(0, 4);
  }, [scopedEmployees]);

  const awayToday = useMemo(() => {
    const now = new Date();
    return scopedLeaves
      .filter((l) => {
        if (l.status !== "Approved") return false;
        const start = toDate(l.start);
        const end = toDate(l.end);
        if (!start || !end) return false;
        return start <= now && end >= now;
      })
      .slice(0, 5);
  }, [scopedLeaves]);

  const approvalSnapshot = useMemo(() => {
    const pendingLeaves = scopedLeaves.filter((l) => l.status === "Pending").length;
    const pendingTimesheets = scopedTimesheets.filter((t) => t.status === "Submitted").length;
    const pendingExpenses = scopedExpenses.filter((e) => e.status === "Submitted").length;
    const total = pendingLeaves + pendingTimesheets + pendingExpenses;
    return {
      total,
      rows: [
        { id: "app-leaves", label: "Congés", count: pendingLeaves, href: "/operations/leaves" },
        { id: "app-time", label: "Temps", count: pendingTimesheets, href: "/operations/time" },
        { id: "app-expenses", label: "Dépenses", count: pendingExpenses, href: "/operations/expenses" },
      ].filter((x) => x.count > 0),
    };
  }, [scopedLeaves, scopedTimesheets, scopedExpenses]);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader title="Chargement du dashboard" description="Préparation de vos actions du jour" />
        <KpiGridSkeleton />
        <SectionCard title="À faire"><ListSkeleton rows={6} /></SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 md:space-y-7">
      <PageHeader
        title={`Bonjour, ${firstName || "équipe"}`}
        description="Vos priorités RH, validations et repères du jour"
        actions={<Badge variant="outline">{tenantName}</Badge>}
      >
        <div className="relative w-full md:max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher une action, un salarié ou un module"
            className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </PageHeader>

      {error ? (
        <EmptyState
          title="Le dashboard n’a pas pu être chargé"
          description={error}
          actionLabel="Réessayer"
          onAction={() => window.location.reload()}
          compact
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <KPIChip icon={Users} label="Employés actifs" value={summary?.activeEmployees ?? 0} tone="success" />
        <KPIChip icon={UserCheck} label="Absents aujourd’hui" value={awayToday.length} tone="warning" />
        <KPIChip
          icon={CheckCircle2}
          label="Approbations"
          value={approvalSnapshot.total}
          tone={approvalSnapshot.total > 0 ? "danger" : "neutral"}
        />
        <KPIChip icon={Calendar} label="Événements semaine" value={summary?.pendingValidations?.events ?? 0} tone="info" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <SectionCard
          title="À faire"
          description="Traitez d’abord ce qui débloque l’activité, la paie ou les validations"
          className="xl:col-span-2"
          actions={<Button size="sm" variant="outline" onClick={() => navigate("/requests/hr")}>Voir tout</Button>}
        >
          {filteredTodoItems.length ? (
            <div className="space-y-2">
              {filteredTodoItems.map((item) => (
                <ListItem
                  key={item.id}
                  icon={item.icon}
                  title={item.title}
                  subtitle={item.subtitle}
                  badge={item.badge}
                  badgeVariant={item.severity === "danger" ? "destructive" : "secondary"}
                  actionLabel="Ouvrir"
                  onClick={() => navigate(item.href)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CheckCircle2}
              title="Aucune action urgente"
              description="Aucune action prioritaire sur votre périmètre."
              compact
            />
          )}
        </SectionCard>

        <SectionCard
          title="À la une"
          description="Un raccourci utile pour sécuriser vos opérations RH"
          className="bg-gradient-to-b from-white to-emerald-50/40"
        >
          <div className="space-y-3">
            <div className="text-sm text-gray-700">
              Centralisez les validations, les parcours RH et le suivi documentaire dans un seul espace de pilotage.
            </div>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => navigate("/admin/workflows")}>Ouvrir les circuits RH</Button>
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard title="Repères calendaires" description="Vue indicative à confirmer selon votre pays et vos règles internes.">
          {holidays.length ? (
            <div className="space-y-2">
              {holidays.map((holiday) => {
                const d = daysUntil(holiday.date);
                return (
                  <ListItem
                    key={holiday.id}
                    icon={Calendar}
                    title={holiday.name}
                    subtitle={formatDate(holiday.date)}
                    badge={`${d} jour${d > 1 ? "s" : ""}`}
                    badgeVariant="outline"
                  />
                );
              })}
            </div>
          ) : (
            <EmptyState title="Aucun jour férié à afficher" compact />
          )}
        </SectionCard>

        <SectionCard title="Anniversaires à venir" description="À partir des dates de naissance renseignées dans les dossiers salariés.">
          {upcomingBirthdays.length ? (
            <div className="space-y-2">
              {upcomingBirthdays.map((birthday) => {
                const d = daysUntil(birthday.date);
                return (
                  <ListItem
                    key={birthday.id}
                    icon={Users}
                    title={birthday.name}
                    subtitle={formatDate(birthday.date)}
                    badge={severityLabel(d)}
                    badgeVariant="secondary"
                  />
                );
              })}
            </div>
          ) : (
            <EmptyState title="Aucun anniversaire renseigné" description="Complétez les dates de naissance pour alimenter ce suivi." compact />
          )}
        </SectionCard>

        <SectionCard title="Qui est absent aujourd’hui ?" description="Basé sur les congés approuvés en cours">
          {awayToday.length ? (
            <div className="space-y-2">
              {awayToday.map((leave) => (
                <ListItem
                  key={leave.id}
                  icon={UserCheck}
                  title={leave.employee || "Employé"}
                  subtitle={`${formatDate(leave.start)} au ${formatDate(leave.end)}`}
                  badge={leave.type || "Congé"}
                  badgeVariant="secondary"
                  actionLabel="Voir"
                  onClick={() => navigate(`/operations/leaves?request=${leave.id}`)}
                />
              ))}
            </div>
          ) : (
            <EmptyState title="Aucune absence aujourd’hui" compact />
          )}
        </SectionCard>

        <SectionCard title="Mes approbations" description="Demandes en attente de décision">
          {approvalSnapshot.rows.length ? (
            <div className="space-y-2">
              {approvalSnapshot.rows.map((row) => (
                <ListItem
                  key={row.id}
                  icon={Workflow}
                  title={row.label}
                  subtitle={`${row.count} demande${row.count > 1 ? "s" : ""} en attente`}
                  badge={`${row.count}`}
                  badgeVariant={row.count > 0 ? "destructive" : "outline"}
                  actionLabel="Traiter"
                  onClick={() => navigate(row.href)}
                />
              ))}
            </div>
          ) : (
            <EmptyState title="Aucune approbation en attente" compact />
          )}
        </SectionCard>
      </div>
    </div>
  );
}

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  Fingerprint,
  LogIn,
  LogOut,
  SendHorizontal,
  ShieldAlert,
  TimerReset,
} from "lucide-react";
import { get, post, put } from "../../lib/api";
import { useApp } from "../../contexts/AppContext";
import useEmployeeDashboardData from "../../hooks/useEmployeeDashboardData";
import RegularizationActionCards from "../../components/employee/RegularizationActionCards";
import RegularizationDetailDrawer from "../../components/employee/RegularizationDetailDrawer";
import RegularizationHero from "../../components/employee/RegularizationHero";
import PageHeader from "../../components/common/PageHeader";
import SectionCard from "../../components/common/SectionCard";
import SectionHeader from "../../components/common/SectionHeader";
import SummaryCard from "../../components/common/SummaryCard";
import InfoBanner from "../../components/common/InfoBanner";
import KPIGrid from "../../components/common/KPIGrid";
import TimelineList from "../../components/common/TimelineList";
import EmptyState from "../../components/common/EmptyState";
import StatusBadge from "../../components/common/StatusBadge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../../components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../components/ui/accordion";
import { useToast } from "../../components/ui/use-toast";

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toIsoDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + delta);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function requestedLeaveDays({ start, end, halfDay }) {
  if (!start || !end) return 0;
  const from = new Date(start);
  const to = new Date(end);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return 0;
  if (halfDay && halfDay !== "NONE") return 0.5;
  let count = 0;
  for (let day = new Date(from); day <= to; day = addDays(day, 1)) {
    const weekday = day.getDay();
    if (weekday >= 1 && weekday <= 5) count += 1;
  }
  return count;
}

async function tryGetGeo() {
  if (!navigator?.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: Number(position.coords?.latitude || 0),
          longitude: Number(position.coords?.longitude || 0),
          accuracy: Number(position.coords?.accuracy || 0),
        }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 3000, maximumAge: 120000 }
    );
  });
}

function attendanceLabel(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "IN_PROGRESS") return "En cours";
  if (normalized === "ON_TIME") return "À jour";
  if (normalized === "LATE") return "Entrée tardive";
  if (normalized === "ABSENT") return "Non pointé";
  return normalized || "Non pointé";
}

function formatRegularizationCode(code) {
  const normalized = String(code || "").toUpperCase();
  const labels = {
    MISSING_TIMESHEET: "Jour non saisi",
    REJECTED_TIMESHEET: "Régularisation rejetée",
    PENDING_MANAGER_APPROVAL: "En attente de validation",
    INCOMPLETE_CLOCKING: "Pointage incomplet",
    ZERO_HOURS: "Heures nulles",
    EXCESSIVE_HOURS: "Heures élevées",
    PENDING_LEAVE_NO_TIMESHEET: "Congé en attente",
  };
  return labels[normalized] || normalized.replaceAll("_", " ");
}

function normalizeRegularizationItem(item, formatDate) {
  return {
    id: item.id,
    title: item.title || formatRegularizationCode(item.code),
    date: item.date || "",
    dateLabel: item.date ? formatDate(item.date) : "Date inconnue",
    code: item.code || "",
    codeLabel: formatRegularizationCode(item.code),
    detail: item.detail || "",
    severity: item.severity || "",
    status: item.status || "",
    suggestedAction: item.suggestedAction || "",
    escalationEligible: Boolean(item.escalationEligible),
    timesheetId: item.timesheetId || "",
  };
}

function buildFallbackMissingItem(date, formatDate) {
  return {
    id: `missing_${date}`,
    title: "Journée non renseignée",
    date,
    dateLabel: formatDate(date),
    code: "MISSING_TIMESHEET",
    codeLabel: formatRegularizationCode("MISSING_TIMESHEET"),
    detail: "Aucune feuille de temps n'a été soumise pour cette date ouvrée.",
    severity: "HIGH",
    status: "",
    suggestedAction: "Déclarer la journée",
    escalationEligible: false,
  };
}

const INITIAL_LEAVE_FORM = {
  start: "",
  end: "",
  type: "CP",
  halfDay: "NONE",
  reason: "",
};

const INITIAL_MANUAL_FORM = {
  date: new Date().toISOString().slice(0, 10),
  hours: "8",
  project: "",
  note: "",
};
const INITIAL_REGULARIZATION_FORM = {
  date: "",
  hours: "8",
  project: "",
  note: "",
};

const FALLBACK_LEAVE_TYPES = [
  { code: "CP", label: "Congés payés" },
  { code: "RTT", label: "RTT" },
  { code: "SICK", label: "Maladie" },
  { code: "PARENTAL", label: "Parental" },
  { code: "EXCEPTIONAL", label: "Exceptionnel" },
  { code: "UNPAID", label: "Sans solde" },
];

export default function EmployeeTimeAbsencesPage() {
  const { formatDate } = useApp();
  const { toast } = useToast();
  const dashboard = useEmployeeDashboardData();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "today";

  const [clockData, setClockData] = useState(null);
  const [clockLoading, setClockLoading] = useState(true);
  const [clockBusy, setClockBusy] = useState(false);

  const [leaveTypes, setLeaveTypes] = useState(FALLBACK_LEAVE_TYPES);
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [balanceLoading, setBalanceLoading] = useState(true);

  const [anomalies, setAnomalies] = useState(null);
  const [anomalyLoading, setAnomalyLoading] = useState(true);
  const [anomalyBusy, setAnomalyBusy] = useState(false);

  const [timesheetRows, setTimesheetRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [regularizationDrawerOpen, setRegularizationDrawerOpen] = useState(false);
  const [regularizationDetailGroupId, setRegularizationDetailGroupId] = useState("");
  const [regularizationEditOpen, setRegularizationEditOpen] = useState(false);
  const [regularizationSelectedItem, setRegularizationSelectedItem] = useState(null);
  const [regularizationForm, setRegularizationForm] = useState(INITIAL_REGULARIZATION_FORM);
  const [regularizationSubmitting, setRegularizationSubmitting] = useState(false);

  const [leaveForm, setLeaveForm] = useState(INITIAL_LEAVE_FORM);
  const [manualForm, setManualForm] = useState(INITIAL_MANUAL_FORM);

  const loadClock = useCallback(async () => {
    setClockLoading(true);
    try {
      const response = await get("/operations/timesheets/clock/today");
      setClockData(response || null);
    } catch (_e) {
      setClockData(null);
    } finally {
      setClockLoading(false);
    }
  }, []);

  const loadLeaveTypes = useCallback(async () => {
    try {
      const response = await get("/operations/leaves/types");
      const items = Array.isArray(response?.items) ? response.items : [];
      setLeaveTypes(items.length ? items.map((item) => ({
        code: String(item.code || "CP").toUpperCase(),
        label: item.label || item.code || "Type",
      })) : FALLBACK_LEAVE_TYPES);
    } catch (_e) {
      setLeaveTypes(FALLBACK_LEAVE_TYPES);
    }
  }, []);

  const loadLeaveBalances = useCallback(async () => {
    setBalanceLoading(true);
    try {
      const response = await get("/operations/leaves/balances");
      setLeaveBalances(Array.isArray(response?.items) ? response.items : []);
    } catch (_e) {
      setLeaveBalances([]);
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  const loadAnomalies = useCallback(async () => {
    setAnomalyLoading(true);
    try {
      const response = await get("/operations/timesheets/anomalies/self", {
        params: { windowDays: 30 },
      });
      setAnomalies(response || null);
    } catch (_e) {
      setAnomalies(null);
    } finally {
      setAnomalyLoading(false);
    }
  }, []);

  const loadTimesheetHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await get("/operations/timesheets");
      setTimesheetRows(Array.isArray(response?.timesheets) ? response.timesheets : []);
    } catch (_e) {
      setTimesheetRows([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.allSettled([
      dashboard.reload(),
      loadClock(),
      loadLeaveBalances(),
      loadAnomalies(),
      loadTimesheetHistory(),
    ]);
  }, [dashboard, loadClock, loadLeaveBalances, loadAnomalies, loadTimesheetHistory]);

  useEffect(() => {
    Promise.allSettled([
      loadClock(),
      loadLeaveTypes(),
      loadLeaveBalances(),
      loadAnomalies(),
      loadTimesheetHistory(),
    ]);
  }, [loadClock, loadLeaveTypes, loadLeaveBalances, loadAnomalies, loadTimesheetHistory]);

  const attendance = useMemo(
    () => clockData?.attendance || dashboard.data?.todayAttendance || null,
    [clockData, dashboard.data]
  );

  const effectiveBalances = useMemo(() => {
    if (leaveBalances.length) {
      return leaveBalances.map((balance) => ({
        leaveTypeCode: balance.leaveTypeCode || "CP",
        leaveTypeLabel: balance.leaveTypeLabel || balance.leaveTypeCode || "Type",
        balanceDays: number(balance.available),
        pendingRequestsDays: number(balance.pending),
      }));
    }
    return (dashboard.data?.leaveBalances || []).map((balance) => ({
      leaveTypeCode: balance.leaveTypeCode,
      leaveTypeLabel: balance.leaveTypeLabel,
      balanceDays: number(balance.balanceDays),
      pendingRequestsDays: number(balance.pendingRequestsDays),
    }));
  }, [leaveBalances, dashboard.data]);

  const weekHours = useMemo(() => {
    const weekStart = startOfWeek(new Date());
    const weekEnd = addDays(weekStart, 6);
    return timesheetRows
      .filter((row) => {
        const date = new Date(row.date);
        return date >= weekStart && date <= weekEnd;
      })
      .reduce((sum, row) => sum + number(row.hours), 0);
  }, [timesheetRows]);

  const mainLeaveBalance = useMemo(
    () =>
      effectiveBalances.find((item) =>
        ["CP", "ANNUAL"].includes(String(item.leaveTypeCode || "").toUpperCase())
      ) || effectiveBalances[0] || null,
    [effectiveBalances]
  );
  const secondaryLeaveBalances = useMemo(
    () =>
      effectiveBalances.filter((item) => item.leaveTypeCode !== mainLeaveBalance?.leaveTypeCode),
    [effectiveBalances, mainLeaveBalance?.leaveTypeCode]
  );

  const upcomingLeave = dashboard.data?.upcomingLeaves?.[0] || null;
  const anomalyItems = useMemo(
    () => (Array.isArray(anomalies?.items) ? anomalies.items : []),
    [anomalies]
  );
  const requestedDays = useMemo(() => requestedLeaveDays(leaveForm), [leaveForm]);
  const selectedBalance = useMemo(
    () => effectiveBalances.find((item) => item.leaveTypeCode === leaveForm.type) || null,
    [effectiveBalances, leaveForm.type]
  );
  const estimatedRemaining = selectedBalance ? Math.max(0, selectedBalance.balanceDays - requestedDays) : null;

  const historyItems = useMemo(
    () =>
      timesheetRows.slice(0, 6).map((row) => ({
        id: row.id,
        title: `${row.date ? formatDate(row.date) : "Date inconnue"} · ${number(row.hours).toFixed(2)} h`,
        description: row.project || row.note || "Saisie de temps",
        meta: String(row.type || "REG"),
        submeta: row.status || "",
        status: row.status || "SUBMITTED",
      })),
    [timesheetRows, formatDate]
  );

  const leaveHistoryItems = useMemo(
    () =>
      (dashboard.data?.recentRequests || [])
        .filter((item) => String(item.type || "").toUpperCase() === "LEAVE")
        .slice(0, 5)
        .map((item) => ({
          id: item.id,
          title: item.label || "Demande d'absence",
          description: item.currentApproverName ? `Circuit: ${item.currentApproverName}` : "Demande d'absence",
          meta: item.createdAt ? formatDate(item.createdAt) : "",
          status: item.status,
        })),
    [dashboard.data, formatDate]
  );

  const blockingCount = number(anomalies?.summary?.blockingCount);
  const missingRegularizationItems = useMemo(() => {
    const missingItems = anomalyItems
      .filter((item) => String(item.code || "").toUpperCase() === "MISSING_TIMESHEET")
      .map((item) => normalizeRegularizationItem(item, formatDate));

    if (missingItems.length) return missingItems;

    return (dashboard.data?.timeToFill?.missingDays || []).map((date) =>
      buildFallbackMissingItem(date, formatDate)
    );
  }, [anomalyItems, dashboard.data, formatDate]);

  const rejectedRegularizationItems = useMemo(
    () =>
      anomalyItems
        .filter((item) => {
          const code = String(item.code || "").toUpperCase();
          const status = String(item.status || "").toUpperCase();
          return code === "REJECTED_TIMESHEET" || status === "REJECTED";
        })
        .map((item) => normalizeRegularizationItem(item, formatDate)),
    [anomalyItems, formatDate]
  );

  const pendingValidationItems = useMemo(
    () =>
      anomalyItems
        .filter((item) => String(item.code || "").toUpperCase() === "PENDING_MANAGER_APPROVAL")
        .map((item) => normalizeRegularizationItem(item, formatDate)),
    [anomalyItems, formatDate]
  );

  const anomalyCorrectionItems = useMemo(
    () =>
      anomalyItems
        .filter((item) => {
          const code = String(item.code || "").toUpperCase();
          return !["MISSING_TIMESHEET", "REJECTED_TIMESHEET", "PENDING_MANAGER_APPROVAL"].includes(code);
        })
        .map((item) => normalizeRegularizationItem(item, formatDate)),
    [anomalyItems, formatDate]
  );

  const actionableRegularizationCount = useMemo(
    () =>
      new Set(
        [...missingRegularizationItems, ...rejectedRegularizationItems, ...anomalyCorrectionItems]
          .map((item) => item.date || item.id)
          .filter(Boolean)
      ).size,
    [missingRegularizationItems, rejectedRegularizationItems, anomalyCorrectionItems]
  );

  const regularizationPeriodLabel = useMemo(() => {
    const from = anomalies?.period?.from || dashboard.data?.timeToFill?.currentPeriod?.start;
    const to = anomalies?.period?.to || dashboard.data?.timeToFill?.currentPeriod?.end;
    if (!from || !to) return "";
    return `${formatDate(from)} - ${formatDate(to)}`;
  }, [anomalies, dashboard.data, formatDate]);

  const regularizationGroups = useMemo(() => {
    const anomalyBlockingCount = anomalyCorrectionItems.filter((item) => String(item.severity || "").toUpperCase() === "HIGH").length;
    const groups = [
      {
        id: "missing",
        title: "Jours manquants",
        detailTitle: "Jours manquants à régulariser",
        detailDescription: "Commencez par les journées non saisies pour éviter un blocage du cycle temps.",
        description: `${missingRegularizationItems.length} journée(s) n'ont pas encore été saisies.`,
        count: missingRegularizationItems.length,
        items: missingRegularizationItems,
        tone: "warning",
        icon: CalendarClock,
        actionTitle: "Jours manquants",
        actionDescription: "Commencez par compléter les journées non saisies.",
        primaryActionLabel: "Déclarer mes jours",
        secondaryActionLabel: "Voir le détail",
        detailPrimaryActionLabel: "Aller à la correction",
        previewItems: missingRegularizationItems.slice(0, 2).map((item) => ({
          id: item.id,
          title: item.title,
          meta: [item.dateLabel, item.suggestedAction].filter(Boolean).join(" · "),
        })),
        remainingCount: Math.max(0, missingRegularizationItems.length - 2),
      },
      {
        id: "anomalies",
        title: "Anomalies",
        detailTitle: "Anomalies à corriger",
        detailDescription: "Vérifiez les écarts de pointage et les incohérences de saisie avant la validation.",
        description: anomalyBlockingCount > 0
          ? `${anomalyCorrectionItems.length} anomalie(s), dont ${anomalyBlockingCount} bloquante(s).`
          : `${anomalyCorrectionItems.length} anomalie(s) à corriger ou vérifier.`,
        count: anomalyCorrectionItems.length,
        items: anomalyCorrectionItems,
        tone: anomalyBlockingCount > 0 ? "danger" : "warning",
        icon: AlertTriangle,
        actionTitle: "Anomalies",
        actionDescription: anomalyBlockingCount > 0
          ? "Corrigez d'abord les anomalies bloquantes."
          : "Vérifiez les écarts de pointage et les incohérences.",
        primaryActionLabel: "Corriger",
        secondaryActionLabel: "Voir le détail",
        detailPrimaryActionLabel: "Aller à la correction",
        detailSecondaryActionLabel: anomalyBlockingCount > 0 ? "Demander l'aide RH" : "",
        previewItems: anomalyCorrectionItems.slice(0, 2).map((item) => ({
          id: item.id,
          title: item.title,
          meta: [item.dateLabel, item.codeLabel].filter(Boolean).join(" · "),
        })),
        remainingCount: Math.max(0, anomalyCorrectionItems.length - 2),
      },
      {
        id: "rejected",
        title: "Rejets / à revoir",
        detailTitle: "Régularisations rejetées",
        detailDescription: "Ces journées ont été rejetées et demandent une correction ou une nouvelle soumission.",
        description: `${rejectedRegularizationItems.length} régularisation(s) ont été rejetées et doivent être revues.`,
        count: rejectedRegularizationItems.length,
        items: rejectedRegularizationItems,
        tone: "danger",
        icon: ShieldAlert,
        actionTitle: "Rejets / à revoir",
        actionDescription: "Reprenez les cas rejetés puis renvoyez-les après correction.",
        primaryActionLabel: "Revoir et corriger",
        secondaryActionLabel: "Voir le détail",
        detailPrimaryActionLabel: "Aller à la correction",
        detailSecondaryActionLabel: "Demander l'aide RH",
        previewItems: rejectedRegularizationItems.slice(0, 2).map((item) => ({
          id: item.id,
          title: item.title,
          meta: [item.dateLabel, item.codeLabel].filter(Boolean).join(" · "),
        })),
        remainingCount: Math.max(0, rejectedRegularizationItems.length - 2),
      },
      {
        id: "pending",
        title: "En attente de validation",
        detailTitle: "Régularisations en attente de validation",
        detailDescription: "Ces régularisations ont été envoyées. La prochaine action utile est une relance si nécessaire.",
        description: `${pendingValidationItems.length} régularisation(s) attendent encore une réponse.`,
        count: pendingValidationItems.length,
        items: pendingValidationItems,
        tone: "info",
        icon: BellRing,
        actionTitle: "En attente de validation",
        actionDescription: "Surveillez ces cas et relancez votre responsable si le délai devient bloquant.",
        primaryActionLabel: "Relancer mon responsable",
        secondaryActionLabel: "Voir le détail",
        detailPrimaryActionLabel: "Relancer mon responsable",
        previewItems: pendingValidationItems.slice(0, 2).map((item) => ({
          id: item.id,
          title: item.title,
          meta: [item.dateLabel, item.codeLabel].filter(Boolean).join(" · "),
        })),
        remainingCount: Math.max(0, pendingValidationItems.length - 2),
      },
    ];

    return groups;
  }, [
    anomalyCorrectionItems,
    missingRegularizationItems,
    pendingValidationItems,
    rejectedRegularizationItems,
  ]);

  const visibleRegularizationGroups = useMemo(
    () => regularizationGroups.filter((group) => group.count > 0),
    [regularizationGroups]
  );

  const primaryRegularizationGroup = useMemo(
    () =>
      regularizationGroups.find((group) => group.id === "rejected" && group.count > 0) ||
      regularizationGroups.find((group) => group.id === "missing" && group.count > 0) ||
      regularizationGroups.find((group) => group.id === "anomalies" && group.count > 0) ||
      regularizationGroups.find((group) => group.id === "pending" && group.count > 0) ||
      null,
    [regularizationGroups]
  );

  const regularizationDetailGroup = useMemo(
    () => regularizationGroups.find((group) => group.id === regularizationDetailGroupId) || null,
    [regularizationGroups, regularizationDetailGroupId]
  );

  const handleClock = useCallback(async (type) => {
    setClockBusy(true);
    try {
      const geo = await tryGetGeo();
      await post(type === "in" ? "/operations/timesheets/clock/in" : "/operations/timesheets/clock/out", {
        source: "WEB_APP",
        geo,
      });
      toast({
        title: type === "in" ? "Entrée enregistrée" : "Sortie enregistrée",
        description: type === "in"
          ? "Votre pointage d'entrée est bien pris en compte."
          : "Votre pointage de sortie est bien pris en compte.",
      });
      await refreshAll();
      window.dispatchEvent(new CustomEvent("app:counters:refresh"));
    } catch (e) {
      toast({
        title: "Pointage impossible",
        description: e?.message || "Une erreur est survenue pendant le pointage.",
        variant: "destructive",
      });
    } finally {
      setClockBusy(false);
    }
  }, [refreshAll, toast]);

  const handleManualSubmit = async (event) => {
    event.preventDefault();
    if (!manualForm.date || number(manualForm.hours) <= 0) {
      toast({
        title: "Saisie invalide",
        description: "Renseignez une date et un nombre d'heures supérieur à zéro.",
        variant: "destructive",
      });
      return;
    }

    setManualSubmitting(true);
    try {
      await post("/operations/timesheets", {
        date: manualForm.date,
        hours: number(manualForm.hours),
        project: manualForm.project || "Déclaration employé",
        note: manualForm.note || null,
        type: "REG",
      });
      toast({
        title: "Temps enregistré",
        description: "Votre déclaration de temps a été ajoutée.",
      });
      setManualForm(INITIAL_MANUAL_FORM);
      await refreshAll();
      window.dispatchEvent(new CustomEvent("app:counters:refresh"));
    } catch (e) {
      toast({
        title: "Déclaration impossible",
        description: e?.message || "Les heures n'ont pas pu être enregistrées.",
        variant: "destructive",
      });
    } finally {
      setManualSubmitting(false);
    }
  };

  const openRegularizationCorrection = (item) => {
    if (!item?.date) return;
    const existingRow = item.timesheetId
      ? timesheetRows.find((row) => row.id === item.timesheetId) || null
      : null;
    setRegularizationDrawerOpen(false);
    setRegularizationSelectedItem(item);
    setRegularizationForm({
      date: toIsoDate(existingRow?.date) || item.date,
      hours: existingRow ? String(number(existingRow.hours || 0) || 8) : "8",
      project: existingRow?.project || (item.timesheetId ? "Régularisation corrective" : "Régularisation"),
      note: existingRow?.note || item.detail || item.title || "",
    });
    setRegularizationEditOpen(true);
  };

  const handleRegularizationCorrectionSubmit = async (event) => {
    event.preventDefault();
    if (!regularizationForm.date || number(regularizationForm.hours) <= 0) {
      toast({
        title: "Saisie invalide",
        description: "Renseignez une date et un nombre d'heures supérieur à zéro.",
        variant: "destructive",
      });
      return;
    }

    setRegularizationSubmitting(true);
    try {
      if (regularizationSelectedItem?.timesheetId) {
        await put(`/operations/timesheets/${regularizationSelectedItem.timesheetId}`, {
          date: regularizationForm.date,
          hours: number(regularizationForm.hours),
          project: regularizationForm.project || "Régularisation",
          note: regularizationForm.note || null,
        });
      } else {
        await post("/operations/timesheets", {
          date: regularizationForm.date,
          hours: number(regularizationForm.hours),
          project: regularizationForm.project || "Régularisation",
          note: regularizationForm.note || null,
          type: "REG",
        });
      }
      toast({
        title: regularizationSelectedItem?.timesheetId ? "Régularisation mise à jour" : "Régularisation enregistrée",
        description: regularizationSelectedItem?.timesheetId
          ? "La feuille de temps a été corrigée pour cette date."
          : "Une saisie corrective a été ajoutée pour cette date.",
      });
      setRegularizationEditOpen(false);
      setRegularizationSelectedItem(null);
      setRegularizationForm(INITIAL_REGULARIZATION_FORM);
      await refreshAll();
      window.dispatchEvent(new CustomEvent("app:counters:refresh"));
    } catch (e) {
      toast({
        title: "Régularisation impossible",
        description: e?.message || "La saisie corrective n'a pas pu être enregistrée.",
        variant: "destructive",
      });
    } finally {
      setRegularizationSubmitting(false);
    }
  };

  const handleLeaveSubmit = async (event) => {
    event.preventDefault();
    if (!leaveForm.start || !leaveForm.end) {
      toast({
        title: "Dates requises",
        description: "Renseignez une date de début et une date de fin.",
        variant: "destructive",
      });
      return;
    }
    if (leaveForm.end < leaveForm.start) {
      toast({
        title: "Période invalide",
        description: "La date de fin doit être postérieure à la date de début.",
        variant: "destructive",
      });
      return;
    }

    setLeaveSubmitting(true);
    try {
      await post("/operations/leaves", {
        start: leaveForm.start,
        end: leaveForm.end,
        type: leaveForm.type || "CP",
        paid: true,
        ...(leaveForm.halfDay !== "NONE" ? { halfDay: leaveForm.halfDay } : {}),
        ...(leaveForm.reason.trim() ? { reason: leaveForm.reason.trim() } : {}),
      });
      toast({
        title: "Demande envoyée",
        description: "Votre demande d'absence a bien été envoyée.",
      });
      setLeaveForm(INITIAL_LEAVE_FORM);
      await refreshAll();
      window.dispatchEvent(new CustomEvent("app:counters:refresh"));
      setSearchParams({ tab: "absences" });
    } catch (e) {
      toast({
        title: "Envoi impossible",
        description: e?.message || "La demande d'absence n'a pas pu être créée.",
        variant: "destructive",
      });
    } finally {
      setLeaveSubmitting(false);
    }
  };

  const handleAnomalyReminder = async (audience) => {
    setAnomalyBusy(true);
    try {
      await post("/operations/timesheets/anomalies/remind", {
        audience,
        windowDays: 30,
        reason: "Relance employé sur anomalies de pointage",
      });
      toast({
        title: "Relance envoyée",
        description: audience === "MANAGER" ? "Votre responsable a été relancé." : "Une relance a été envoyée.",
      });
    } catch (e) {
      toast({
        title: "Relance impossible",
        description: e?.message || "La relance n'a pas pu être envoyée.",
        variant: "destructive",
      });
    } finally {
      setAnomalyBusy(false);
    }
  };

  const handleEscalateToHr = async () => {
    setAnomalyBusy(true);
    try {
      await post("/operations/timesheets/anomalies/escalate-to-hr", {
        windowDays: 30,
        reason: "Demande d'aide employé - responsable indisponible",
      });
      toast({
        title: "Aide RH demandée",
        description: "L'équipe RH a été prévenue pour aider sur les anomalies bloquantes.",
      });
    } catch (e) {
      toast({
        title: "Demande d'aide impossible",
        description: e?.message || "La demande d'aide n'a pas pu être envoyée.",
        variant: "destructive",
      });
    } finally {
      setAnomalyBusy(false);
    }
  };

  const openRegularizationDetail = (groupOrId) => {
    const groupId = typeof groupOrId === "string" ? groupOrId : groupOrId?.id;
    if (!groupId) return;
    setRegularizationDetailGroupId(groupId);
    setRegularizationDrawerOpen(true);
  };

  const closeRegularizationDetail = (open) => {
    setRegularizationDrawerOpen(open);
    if (!open) setRegularizationDetailGroupId("");
  };

  const handleRegularizationPrimaryAction = async (group) => {
    if (!group) return;
    if (group.id === "pending") {
      await handleAnomalyReminder("MANAGER");
      return;
    }
    setRegularizationDrawerOpen(false);
    setRegularizationDetailGroupId("");
    setSearchParams({ tab: "today" });
  };

  const handleRegularizationSecondaryAction = async (group) => {
    if (!group) return;
    if (["anomalies", "rejected"].includes(group.id) && blockingCount > 0) {
      await handleEscalateToHr();
    }
  };

  if (dashboard.loading && !dashboard.data) {
    return <div className="p-6 text-sm text-slate-500">Chargement des temps & absences…</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Temps & absences"
        description="Une vue plus simple, séparée entre aujourd'hui, les absences et les régularisations."
        actions={<Button variant="outline" onClick={refreshAll}>Rafraîchir</Button>}
      />

      {dashboard.error ? (
        <InfoBanner tone="warning" title="Chargement partiel" description={dashboard.error} />
      ) : null}

      <KPIGrid className="xl:grid-cols-3">
        <SummaryCard
          label="Statut du jour"
          value={attendanceLabel(attendance?.status)}
          helper={`Entrée ${formatDateTime(attendance?.clockInTime)} · Sortie ${formatDateTime(attendance?.clockOutTime)}`}
          tone={blockingCount > 0 ? "warning" : "info"}
        />
        <SummaryCard
          label="Solde congés principal"
          value={mainLeaveBalance ? `${mainLeaveBalance.balanceDays.toFixed(1)} j` : "—"}
          helper={mainLeaveBalance ? `${mainLeaveBalance.leaveTypeLabel} · ${mainLeaveBalance.pendingRequestsDays.toFixed(1)} j en attente` : "Aucun solde disponible"}
          tone="success"
        />
        <SummaryCard
          label="Régularisations à traiter"
          value={number(anomalies?.summary?.anomaliesCount || dashboard.data?.timeToFill?.missingDays?.length)}
          helper={`${blockingCount} bloquante(s) · ${number(anomalies?.summary?.missingDays || dashboard.data?.timeToFill?.missingDays?.length)} jour(s) concernés`}
          tone={blockingCount > 0 ? "warning" : "neutral"}
        />
      </KPIGrid>

      <Tabs value={activeTab} onValueChange={(value) => setSearchParams({ tab: value })} className="space-y-6">
        <TabsList className="flex h-auto flex-wrap gap-2 rounded-2xl bg-slate-100 p-2">
          <TabsTrigger value="today">Aujourd&apos;hui</TabsTrigger>
          <TabsTrigger value="absences">Absences</TabsTrigger>
          <TabsTrigger value="regularizations">Régularisations</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-6">
          {blockingCount > 0 ? (
            <InfoBanner
              tone="warning"
              title="Alerte critique"
              description={`${blockingCount} anomalie(s) bloquante(s) peuvent impacter la validation des temps ou la paie.`}
              action={<Button variant="outline" onClick={() => setSearchParams({ tab: "regularizations" })}>Traiter maintenant</Button>}
            />
          ) : null}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <SectionCard>
              <SectionHeader
                title="Statut du jour"
                description="Pointez votre entrée ou votre sortie sans ouvrir les autres fonctions."
              />
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Présence</p>
                    <div className="mt-2">
                      <StatusBadge status={attendance?.status || "ABSENT"} label={attendanceLabel(attendance?.status)} />
                    </div>
                  </div>
                  <Fingerprint className="h-5 w-5 text-slate-500" />
                </div>
                <div className="mt-4 space-y-1 text-sm text-slate-600">
                  <p>Entrée: {formatDateTime(attendance?.clockInTime)}</p>
                  <p>Sortie: {formatDateTime(attendance?.clockOutTime)}</p>
                  <p>Heures cumulées: {number(attendance?.totalHours).toFixed(2)} h</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    onClick={() => handleClock("in")}
                    disabled={clockBusy || clockLoading || clockData?.attendance?.canClockIn === false}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <LogIn className="h-4 w-4" />
                    Pointer entrée
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleClock("out")}
                    disabled={clockBusy || clockLoading || clockData?.attendance?.canClockOut === false}
                  >
                    <LogOut className="h-4 w-4" />
                    Pointer sortie
                  </Button>
                </div>
              </div>
            </SectionCard>

            <SectionCard>
              <SectionHeader
                title="Déclaration rapide"
                description="Ajoutez une saisie sans mélanger les autres parcours."
              />
              <form onSubmit={handleManualSubmit} className="mt-4 space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="manual-date">Date</Label>
                    <Input id="manual-date" type="date" value={manualForm.date} onChange={(e) => setManualForm((prev) => ({ ...prev, date: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="manual-hours">Heures</Label>
                    <Input id="manual-hours" type="number" min="0" step="0.25" value={manualForm.hours} onChange={(e) => setManualForm((prev) => ({ ...prev, hours: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="manual-project">Projet / activité</Label>
                  <Input id="manual-project" value={manualForm.project} onChange={(e) => setManualForm((prev) => ({ ...prev, project: e.target.value }))} placeholder="Ex. mission terrain, support, projet client" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="manual-note">Commentaire</Label>
                  <Textarea id="manual-note" rows={3} value={manualForm.note} onChange={(e) => setManualForm((prev) => ({ ...prev, note: e.target.value }))} placeholder="Contexte utile pour la régularisation" />
                </div>
                <Button type="submit" disabled={manualSubmitting}>
                  <TimerReset className="h-4 w-4" />
                  {manualSubmitting ? "Enregistrement…" : "Déclarer ces heures"}
                </Button>
              </form>
            </SectionCard>
          </div>

          <SectionCard>
            <SectionHeader
              title="Repère secondaire"
              description="Seulement le contexte utile après l'action du jour."
            />
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Prochaine absence</p>
                  <p className="text-sm font-semibold text-slate-900">{upcomingLeave?.leaveTypeLabel || "Aucune absence planifiée"}</p>
                  <p className="text-sm text-slate-600">
                    {upcomingLeave?.startDate ? `${formatDate(upcomingLeave.startDate)} - ${formatDate(upcomingLeave.endDate)}` : "Aucune absence à venir pour le moment."}
                  </p>
                </div>
                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                  {weekHours.toFixed(1)} h saisies cette semaine
                </div>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="absences" className="space-y-6">
          <SectionCard>
            <SectionHeader
              title="Soldes de congés"
              description="Votre solde principal en premier. Les autres compteurs restent disponibles en second niveau."
            />
            <div className="mt-4">
              {mainLeaveBalance ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{mainLeaveBalance.leaveTypeLabel}</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{mainLeaveBalance.balanceDays.toFixed(1)} j</p>
                  <p className="mt-1 text-sm text-slate-600">{mainLeaveBalance.pendingRequestsDays.toFixed(1)} j en attente de validation</p>
                </div>
              ) : null}
              {!effectiveBalances.length && !balanceLoading ? (
                <EmptyState
                  icon={CalendarClock}
                  title="Aucun solde disponible"
                  description="Les soldes de congés apparaitront ici dès qu'ils seront disponibles."
                  compact
                />
              ) : null}
              {secondaryLeaveBalances.length ? (
                <Accordion type="single" collapsible className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4">
                  <AccordionItem value="other-balances" className="border-b-0">
                    <AccordionTrigger className="py-4 text-sm font-semibold text-slate-900 hover:no-underline">
                      Voir les autres soldes
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {secondaryLeaveBalances.slice(0, 2).map((item) => (
                          <div key={item.leaveTypeCode} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{item.leaveTypeLabel}</p>
                            <p className="mt-2 text-xl font-semibold text-slate-900">{item.balanceDays.toFixed(1)} j</p>
                            <p className="mt-1 text-sm text-slate-600">{item.pendingRequestsDays.toFixed(1)} j en attente</p>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              ) : null}
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <SectionCard>
              <SectionHeader
                title="Demander une absence"
                description="Choisissez une période, le type d'absence et visualisez l'impact estimé sur votre solde."
              />
              <form onSubmit={handleLeaveSubmit} className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="leave-start">Début</Label>
                    <Input id="leave-start" type="date" value={leaveForm.start} onChange={(e) => setLeaveForm((prev) => ({ ...prev, start: e.target.value }))} min={toIsoDate(new Date()) || undefined} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="leave-end">Fin</Label>
                    <Input id="leave-end" type="date" value={leaveForm.end} onChange={(e) => setLeaveForm((prev) => ({ ...prev, end: e.target.value }))} min={leaveForm.start || toIsoDate(new Date()) || undefined} />
                  </div>
                  <div className="space-y-1">
                    <Label>Type d'absence</Label>
                    <Select value={leaveForm.type} onValueChange={(value) => setLeaveForm((prev) => ({ ...prev, type: value }))}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner un type" /></SelectTrigger>
                      <SelectContent>
                        {leaveTypes.map((item) => (
                          <SelectItem key={item.code} value={item.code}>{item.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Fraction</Label>
                    <Select value={leaveForm.halfDay} onValueChange={(value) => setLeaveForm((prev) => ({ ...prev, halfDay: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">Journée complète</SelectItem>
                        <SelectItem value="AM">Demi-journée matin</SelectItem>
                        <SelectItem value="PM">Demi-journée après-midi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="leave-reason">Motif</Label>
                  <Textarea id="leave-reason" rows={4} value={leaveForm.reason} onChange={(e) => setLeaveForm((prev) => ({ ...prev, reason: e.target.value }))} placeholder="Précisez le contexte ou l'information utile au valideur" />
                </div>

                {selectedBalance ? (
                  <InfoBanner
                    tone="info"
                    title="Impact estimé sur le solde"
                    description={
                      requestedDays > 0
                        ? `${requestedDays.toFixed(1)} jour(s) demandés sur ${selectedBalance.leaveTypeLabel}. Solde estimé après demande: ${estimatedRemaining?.toFixed(1) || "—"} jour(s).`
                        : `Solde actuel ${selectedBalance.leaveTypeLabel}: ${selectedBalance.balanceDays.toFixed(1)} jour(s).`
                    }
                  />
                ) : null}

                <Button type="submit" disabled={leaveSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
                  <SendHorizontal className="h-4 w-4" />
                  {leaveSubmitting ? "Envoi…" : "Envoyer la demande"}
                </Button>
              </form>
            </SectionCard>

            <SectionCard>
              <SectionHeader
                title="Mes absences"
                description="À venir d'abord, puis un historique compact des dernières demandes d'absence."
              />
              <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">Absences à venir</h3>
                  <TimelineList
                    items={(dashboard.data?.upcomingLeaves || []).map((leave) => ({
                      id: leave.id,
                      title: leave.leaveTypeLabel,
                      description: "Absence planifiée",
                      meta: `${formatDate(leave.startDate)} - ${formatDate(leave.endDate)}`,
                      status: leave.status,
                    }))}
                    emptyTitle="Aucune absence planifiée"
                    emptyDescription="Vos prochaines absences seront listées ici."
                  />
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">Dernières demandes</h3>
                  <TimelineList
                    items={leaveHistoryItems}
                    emptyTitle="Aucune demande récente"
                    emptyDescription="Les dernières demandes d'absence apparaitront ici."
                  />
                </div>
              </div>
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="regularizations" className="space-y-6">
          <RegularizationHero
            actionableCount={actionableRegularizationCount}
            blockingCount={blockingCount}
            title={
              actionableRegularizationCount > 0
                ? "Traiter mes régularisations"
                : pendingValidationItems.length > 0
                ? "Suivre mes validations en attente"
                : "Aucune régularisation critique"
            }
            description={
              actionableRegularizationCount > 0 && blockingCount > 0
                ? "Commencez par les cas bloquants, puis corrigez le reste pour remettre votre cycle temps à niveau."
                : actionableRegularizationCount > 0
                ? "Corrigez les cas réellement actionnables, puis surveillez les validations en attente si nécessaire."
                : pendingValidationItems.length > 0
                ? "Aucune correction directe n'est requise, mais des validations restent en attente."
                : "Votre cycle temps ne présente pas de correction urgente sur la période."
            }
            recommendation={anomalies?.recommendations?.[0] || ""}
            periodLabel={regularizationPeriodLabel}
            primaryActionLabel={primaryRegularizationGroup ? (primaryRegularizationGroup.id === "pending" ? "Relancer mon responsable" : "Corriger mes temps") : ""}
            onPrimaryAction={
              primaryRegularizationGroup
                ? () => handleRegularizationPrimaryAction(primaryRegularizationGroup)
                : null
            }
          />

          <SectionCard>
            <SectionHeader
              title="Actions recommandées"
              description="Chaque carte correspond à une catégorie de cas. Ouvrez le détail seulement quand vous en avez besoin."
            />
            <div className="mt-4">
              <RegularizationActionCards
                groups={visibleRegularizationGroups.map((group) => ({
                  ...group,
                  onPrimaryAction: () => handleRegularizationPrimaryAction(group),
                  onSecondaryAction: () => openRegularizationDetail(group),
                }))}
              />
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.85fr_1.15fr]">
            <SectionCard>
              <SectionHeader
                title="Besoin d'aide ?"
                description="Les relances restent secondaires. Commencez d'abord par corriger vos temps."
                actions={(
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" disabled={anomalyBusy || anomalyLoading} onClick={() => handleAnomalyReminder("MANAGER")}>
                      <BellRing className="h-4 w-4" />
                      Relancer mon responsable
                    </Button>
                    <Button variant="outline" disabled={anomalyBusy || anomalyLoading || blockingCount <= 0} onClick={handleEscalateToHr}>
                      <ShieldAlert className="h-4 w-4" />
                      Demander l'aide RH
                    </Button>
                  </div>
                )}
              />
              <div className="mt-4 space-y-3">
                <p className="text-sm text-slate-600">
                  Utilisez la relance si vos régularisations ont déjà été envoyées mais restent sans réponse.
                </p>
                <p className="text-sm text-slate-600">
                  Demandez l'aide RH uniquement si les anomalies bloquantes persistent ou si votre responsable est indisponible.
                </p>
              </div>
            </SectionCard>

            <SectionCard>
              <SectionHeader
                title="Historique compact"
                description="Dernières saisies utiles pour vérifier rapidement ce qui a déjà été déclaré."
              />
              <div className="mt-4">
                {historyLoading ? (
                  <div className="text-sm text-slate-500">Chargement des saisies…</div>
                ) : (
                  <TimelineList
                    items={historyItems.slice(0, 4)}
                    emptyTitle="Aucune saisie récente"
                    emptyDescription="Vos dernières déclarations de temps apparaitront ici."
                  />
                )}
              </div>
            </SectionCard>
          </div>

          <RegularizationDetailDrawer
            open={regularizationDrawerOpen}
            onOpenChange={closeRegularizationDetail}
            group={regularizationDetailGroup}
            onPrimaryAction={handleRegularizationPrimaryAction}
            onSecondaryAction={handleRegularizationSecondaryAction}
            onItemAction={openRegularizationCorrection}
          />

          <Sheet
            open={regularizationEditOpen}
            onOpenChange={(open) => {
              setRegularizationEditOpen(open);
              if (!open) {
                setRegularizationSelectedItem(null);
                setRegularizationForm(INITIAL_REGULARIZATION_FORM);
              }
            }}
          >
            <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
              <SheetHeader>
                <SheetTitle>
                  {regularizationSelectedItem?.timesheetId ? "Corriger la feuille de temps" : "Ajouter une saisie corrective"}
                </SheetTitle>
                <SheetDescription>
                  {regularizationSelectedItem?.timesheetId
                    ? "Mettez à jour directement la feuille signalée dans les régularisations."
                    : "Ajoutez une saisie pour corriger une date qui n'avait pas encore de feuille de temps."}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                {regularizationSelectedItem?.timesheetId ? (
                  <InfoBanner
                    tone="info"
                    title="Modification directe activée"
                    description={
                      ["REJECTED", "IN_PROGRESS"].includes(String(regularizationSelectedItem.status || "").toUpperCase())
                        ? "Cette correction mettra à jour la feuille existante et la renverra automatiquement."
                        : "Cette correction met à jour directement la feuille de temps existante."
                    }
                  />
                ) : null}

                <form onSubmit={handleRegularizationCorrectionSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="regularization-date">Date</Label>
                      <Input
                        id="regularization-date"
                        type="date"
                        value={regularizationForm.date}
                        onChange={(e) => setRegularizationForm((prev) => ({ ...prev, date: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="regularization-hours">Heures</Label>
                      <Input
                        id="regularization-hours"
                        type="number"
                        min="0"
                        step="0.25"
                        value={regularizationForm.hours}
                        onChange={(e) => setRegularizationForm((prev) => ({ ...prev, hours: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="regularization-project">Projet / activité</Label>
                    <Input
                      id="regularization-project"
                      value={regularizationForm.project}
                      onChange={(e) => setRegularizationForm((prev) => ({ ...prev, project: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="regularization-note">Commentaire</Label>
                    <Textarea
                      id="regularization-note"
                      rows={4}
                      value={regularizationForm.note}
                      onChange={(e) => setRegularizationForm((prev) => ({ ...prev, note: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={regularizationSubmitting}>
                      {regularizationSubmitting
                        ? "Enregistrement…"
                        : regularizationSelectedItem?.timesheetId
                        ? "Mettre à jour la feuille"
                        : "Ajouter la saisie"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setRegularizationEditOpen(false);
                        setRegularizationSelectedItem(null);
                        setRegularizationForm(INITIAL_REGULARIZATION_FORM);
                      }}
                    >
                      Annuler
                    </Button>
                  </div>
                </form>
              </div>
            </SheetContent>
          </Sheet>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  FileText,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { get } from "../../lib/api";
import usePageMeta from "../../hooks/usePageMeta";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmt(v, unit = "") {
  const n = num(v);
  if (unit === "%") return `${n.toFixed(1)}%`;
  if (unit === "h") return `${n.toFixed(1)} h`;
  return `${n.toFixed(0)}`;
}

function toDateTimeLabel(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const SEGMENTS = [
  { id: "all", label: "Tous" },
  { id: "workforce", label: "Effectif" },
  { id: "operations", label: "Opérations" },
  { id: "service", label: "Service RH" },
  { id: "talent", label: "Talents" },
  { id: "compliance", label: "Conformité" },
];

const INDICATOR_DEFINITIONS = [
  {
    key: "turnover12mPercent",
    label: "Turnover 12 mois",
    segment: "workforce",
    unit: "%",
    direction: "down",
    good: 12,
    watch: 18,
    target: "< 12% annuel",
    formula: "Départs 12 mois / Effectif moyen 12 mois",
    action: "Renforcer rétention et qualité onboarding sur équipes à risque.",
  },
  {
    key: "absenceRate30dPercent",
    label: "Absentéisme 30 jours",
    segment: "workforce",
    unit: "%",
    direction: "down",
    good: 5,
    watch: 8,
    target: "< 5%",
    formula: "Jours d'absence approuvés / Jours théoriques",
    action: "Analyser par site/manager et traiter les causes récurrentes.",
  },
  {
    key: "timesheetCompliance30dPercent",
    label: "Conformité pointage 30 jours",
    segment: "operations",
    unit: "%",
    direction: "up",
    good: 95,
    watch: 85,
    target: ">= 95%",
    formula: "Jours pointés / Jours attendus",
    action: "Renforcer relances automatiques et verrou de clôture période.",
  },
  {
    key: "avgLeaveValidationHours30d",
    label: "Délai validation congés",
    segment: "operations",
    unit: "h",
    direction: "down",
    good: 48,
    watch: 96,
    target: "< 48h",
    formula: "Temps moyen entre création et décision congé",
    action: "Réduire goulots de validation manager en pic d'activité.",
  },
  {
    key: "hrRequestSla30dPercent",
    label: "Respect SLA demandes RH",
    segment: "service",
    unit: "%",
    direction: "up",
    good: 90,
    watch: 75,
    target: ">= 90%",
    formula: "Demandes closes dans SLA / Demandes closes",
    action: "Optimiser workflow et escalade sur catégories lentes.",
  },
  {
    key: "avgHrRequestResolutionHours30d",
    label: "Délai moyen traitement demandes RH",
    segment: "service",
    unit: "h",
    direction: "down",
    good: 72,
    watch: 120,
    target: "< 72h",
    formula: "Somme des délais de clôture / volume clos",
    action: "Limiter temps d'attente inter-acteurs et relancer SLA.",
  },
  {
    key: "trainingParticipation90dPercent",
    label: "Participation formation 90 jours",
    segment: "talent",
    unit: "%",
    direction: "up",
    good: 40,
    watch: 25,
    target: ">= 40%",
    formula: "Salariés formés 90j / Effectif actif",
    action: "Prioriser populations critiques et managers de proximité.",
  },
  {
    key: "interviewCompletion90dPercent",
    label: "Complétion entretiens 90 jours",
    segment: "talent",
    unit: "%",
    direction: "up",
    good: 90,
    watch: 70,
    target: ">= 90%",
    formula: "Entretiens réalisés / Entretiens planifiés",
    action: "Imposer deadlines, relances et visibilité manager.",
  },
  {
    key: "goalsAtRiskPercent",
    label: "Objectifs à risque",
    segment: "talent",
    unit: "%",
    direction: "down",
    good: 20,
    watch: 35,
    target: "< 20%",
    formula: "Objectifs off-track / Objectifs totaux",
    action: "Revue mensuelle des objectifs en retard et coaching ciblé.",
  },
  {
    key: "profileCompletenessPercent",
    label: "Complétude dossiers salariés",
    segment: "compliance",
    unit: "%",
    direction: "up",
    good: 98,
    watch: 90,
    target: ">= 98%",
    formula: "Dossiers complets / Dossiers totaux",
    action: "Lancer campagne de régularisation documentaire.",
  },
  {
    key: "mandatoryDocumentCoveragePercent",
    label: "Couverture docs obligatoires",
    segment: "compliance",
    unit: "%",
    direction: "up",
    good: 95,
    watch: 85,
    target: ">= 95%",
    formula: "Salariés avec pièces obligatoires / Effectif total",
    action: "Bloquer onboarding/mobilité tant que pièces manquantes.",
  },
];

const ALERT_DEFINITIONS = [
  {
    key: "contractsEndingIn60d",
    label: "Contrats à échéance (60j)",
    good: 0,
    watch: 3,
  },
  {
    key: "pendingHrRequests",
    label: "Demandes RH en attente",
    good: 3,
    watch: 8,
  },
  {
    key: "pendingLeaves",
    label: "Congés en attente",
    good: 5,
    watch: 12,
  },
  {
    key: "pendingExpenses",
    label: "Dépenses en attente",
    good: 5,
    watch: 12,
  },
  {
    key: "profilesIncomplete",
    label: "Dossiers incomplets",
    good: 1,
    watch: 5,
  },
  {
    key: "missingMandatoryDocs",
    label: "Docs obligatoires manquants",
    good: 1,
    watch: 5,
  },
];

function evaluateStatus(value, config) {
  const n = num(value);
  if (config.direction === "up") {
    if (n >= config.good) return "ok";
    if (n >= config.watch) return "watch";
    return "critical";
  }
  if (n <= config.good) return "ok";
  if (n <= config.watch) return "watch";
  return "critical";
}

function evaluateAlert(value, config) {
  const n = num(value);
  if (n <= config.good) return "ok";
  if (n <= config.watch) return "watch";
  return "critical";
}

function statusUi(status) {
  if (status === "ok") {
    return {
      label: "OK",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      textClass: "text-emerald-700",
    };
  }
  if (status === "watch") {
    return {
      label: "A surveiller",
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
      textClass: "text-amber-700",
    };
  }
  return {
    label: "Critique",
    badgeClass: "bg-red-50 text-red-700 border-red-200",
    textClass: "text-red-700",
  };
}

function buildRecommendations(indicators = [], alerts = []) {
  const priorityIndicators = indicators
    .filter((i) => i.status !== "ok")
    .sort((a, b) => (a.status === "critical" ? -1 : 1) - (b.status === "critical" ? -1 : 1))
    .slice(0, 4)
    .map((i) => `${i.label}: ${i.action}`);

  const priorityAlerts = alerts
    .filter((a) => a.status === "critical")
    .slice(0, 2)
    .map((a) => `${a.label}: ${fmt(a.value)} élément(s) à traiter rapidement.`);

  const items = [...priorityIndicators, ...priorityAlerts];
  if (!items.length) {
    items.push(
      "Niveau de performance RH stable: maintenir la revue mensuelle et surveiller les signaux faibles."
    );
  }
  return items.slice(0, 6);
}

function latestRows(rows = [], count = 4) {
  if (!Array.isArray(rows)) return [];
  return rows.slice(-count);
}

export default function AnalyticsReportsPage() {
  usePageMeta(
    "Rapports RH",
    "Rapports RH consolidés pour piloter absentéisme, qualité de service RH, conformité documentaire et performance des équipes."
  );
  const [months, setMonths] = useState(12);
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState("all");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (nextMonths = months) => {
    setLoading(true);
    setError("");
    try {
      const res = await get("/analytics/hr/overview", { params: { months: nextMonths } });
      setData(res || null);
    } catch (e) {
      setData(null);
      setError(e?.message || "Impossible de charger les rapports RH");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(months);
  }, [months]); // eslint-disable-line react-hooks/exhaustive-deps

  const generatedAt = useMemo(() => toDateTimeLabel(data?.generatedAt), [data]);
  const highlights = useMemo(() => data?.highlights || {}, [data]);
  const series = useMemo(() => data?.series || {}, [data]);
  const breakdowns = useMemo(() => data?.breakdowns || {}, [data]);
  const alerts = useMemo(() => data?.alerts || {}, [data]);

  const indicatorRows = useMemo(
    () =>
      INDICATOR_DEFINITIONS.map((definition) => {
        const value = num(highlights[definition.key]);
        const status = evaluateStatus(value, definition);
        return {
          ...definition,
          value,
          status,
        };
      }),
    [highlights]
  );

  const filteredIndicators = useMemo(() => {
    const q = query.trim().toLowerCase();
    return indicatorRows.filter((row) => {
      if (segment !== "all" && row.segment !== segment) return false;
      if (!q) return true;
      return (
        row.label.toLowerCase().includes(q) ||
        row.formula.toLowerCase().includes(q) ||
        row.target.toLowerCase().includes(q) ||
        row.action.toLowerCase().includes(q)
      );
    });
  }, [indicatorRows, query, segment]);

  const alertRows = useMemo(
    () =>
      ALERT_DEFINITIONS.map((definition) => {
        const value = num(alerts[definition.key]);
        const status = evaluateAlert(value, definition);
        return {
          ...definition,
          value,
          status,
        };
      }),
    [alerts]
  );

  const requestsByType = useMemo(() => {
    const rows = Array.isArray(breakdowns.requestsByType) ? breakdowns.requestsByType : [];
    return rows.slice(0, 8).map((r) => ({ label: r.label, value: r.value }));
  }, [breakdowns]);

  const leavesByType = useMemo(() => {
    const rows = Array.isArray(breakdowns.leaveByType) ? breakdowns.leaveByType : [];
    return rows.slice(0, 8).map((r) => ({ label: r.label, value: r.value }));
  }, [breakdowns]);

  const latestSlaRows = useMemo(() => latestRows(series.requestsSla, 4), [series]);
  const latestComplianceRows = useMemo(() => latestRows(series.timesheetCompliance, 4), [series]);

  const score = useMemo(() => {
    if (!indicatorRows.length) return 0;
    const scoreByStatus = { ok: 100, watch: 65, critical: 35 };
    const total = indicatorRows.reduce((acc, row) => acc + (scoreByStatus[row.status] || 0), 0);
    return Number((total / indicatorRows.length).toFixed(1));
  }, [indicatorRows]);

  const criticalIndicatorCount = useMemo(
    () => indicatorRows.filter((row) => row.status === "critical").length,
    [indicatorRows]
  );

  const criticalAlertCount = useMemo(
    () => alertRows.filter((row) => row.status === "critical").length,
    [alertRows]
  );

  const recommendations = useMemo(
    () => buildRecommendations(indicatorRows, alertRows),
    [indicatorRows, alertRows]
  );

  const keyMetrics = useMemo(
    () => [
      {
        id: "activeHeadcount",
        label: "Effectif actif",
        unit: "",
        value: highlights.activeHeadcount,
        hint: "Collaborateurs actifs à date",
        icon: Users,
      },
      {
        id: "turnover12mPercent",
        label: "Turnover 12 mois",
        unit: "%",
        value: highlights.turnover12mPercent,
        hint: "Départs / effectif moyen",
        icon: TriangleAlert,
      },
      {
        id: "absenceRate30dPercent",
        label: "Absentéisme 30 jours",
        unit: "%",
        value: highlights.absenceRate30dPercent,
        hint: "Jours absents / jours théoriques",
        icon: CalendarClock,
      },
      {
        id: "hrRequestSla30dPercent",
        label: "SLA demandes RH",
        unit: "%",
        value: highlights.hrRequestSla30dPercent,
        hint: "Demandes closes dans le SLA",
        icon: ShieldCheck,
      },
      {
        id: "timesheetCompliance30dPercent",
        label: "Conformité pointage 30 jours",
        unit: "%",
        value: highlights.timesheetCompliance30dPercent,
        hint: "Jours pointés / attendus",
        icon: CheckCircle2,
      },
      {
        id: "profileCompletenessPercent",
        label: "Complétude dossiers",
        unit: "%",
        value: highlights.profileCompletenessPercent,
        hint: "Dossiers salariés complets",
        icon: FileText,
      },
    ],
    [highlights]
  );

  if (loading) return <div className="p-6">Chargement des rapports RH...</div>;

  const scoreTone =
    score >= 80
      ? "bg-emerald-500"
      : score >= 65
        ? "bg-cyan-500"
        : score >= 50
          ? "bg-amber-500"
          : "bg-red-500";

  return (
    <div className="p-6 space-y-5 bg-gradient-to-b from-slate-50 via-white to-white">
      <Card className="border-0 shadow-xl text-white overflow-hidden">
        <CardContent
          className="p-6 md:p-7"
          style={{
            background:
              "radial-gradient(circle at 15% 15%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 35%), linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #0f766e 100%)",
          }}
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs">
                <Sparkles className="h-3.5 w-3.5" />
                Rapport RH consolidé
              </div>
              <h1 className="text-2xl md:text-3xl font-bold">Rapports RH</h1>
              <p className="text-sm text-slate-100 max-w-2xl">
                Vue decisionnelle des KPI RH calculee depuis vos donnees operationnelles pour les revues RH, direction et multisites.
              </p>
              <div className="text-xs text-slate-200">Dernière génération: {generatedAt}</div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant={months === 6 ? "default" : "outline"} onClick={() => setMonths(6)}>
                6 mois
              </Button>
              <Button variant={months === 12 ? "default" : "outline"} onClick={() => setMonths(12)}>
                12 mois
              </Button>
              <Button variant="outline" onClick={() => load(months)}>
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Rafraîchir
              </Button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/20 bg-white/10 p-4">
              <div className="text-xs text-slate-200">Score global RH</div>
              <div className="mt-1 flex items-center gap-2">
                <div className="text-3xl font-bold">{score.toFixed(1)}%</div>
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${scoreTone}`} />
              </div>
              <div className="text-xs text-slate-200 mt-1">
                {criticalIndicatorCount} indicateur(s) critique(s)
              </div>
            </div>

            <div className="rounded-xl border border-white/20 bg-white/10 p-4">
              <div className="text-xs text-slate-200">Risques opérationnels</div>
              <div className="mt-1 text-3xl font-bold">{criticalAlertCount}</div>
              <div className="text-xs text-slate-200 mt-1">
                alertes critiques à traiter prioritairement
              </div>
            </div>

            <div className="rounded-xl border border-white/20 bg-white/10 p-4">
              <div className="text-xs text-slate-200">Actions recommandées</div>
              <div className="mt-1 text-3xl font-bold">{recommendations.length}</div>
              <div className="text-xs text-slate-200 mt-1">
                recommandations prêtes pour le pilotage RH
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">Erreur de chargement</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-slate-900">Filtrer les indicateurs</CardTitle>
          <CardDescription>
            Recherche rapide et filtre par domaine RH pour passer vite d&apos;un diagnostic global a un plan d&apos;action.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 pl-9 text-sm shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
              placeholder="Rechercher un indicateur, une cible ou une action..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="text"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {SEGMENTS.map((item) => (
              <Button
                key={item.id}
                variant={segment === item.id ? "default" : "outline"}
                onClick={() => setSegment(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {keyMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.id} className="border-slate-200 shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                      {metric.label}
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                      {fmt(metric.value, metric.unit)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{metric.hint}</div>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-slate-700" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Catalogue décisionnel des KPI RH</CardTitle>
          <CardDescription>
            {filteredIndicators.length} indicateur(s) affiché(s) sur {indicatorRows.length}.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2 px-2 font-medium text-slate-500">Indicateur</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-500">Valeur</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-500">Cible</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-500">Statut</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-500">Formule</th>
                  <th className="text-left py-2 px-2 font-medium text-slate-500">Action RH</th>
                </tr>
              </thead>
              <tbody>
                {filteredIndicators.map((row) => {
                  const ui = statusUi(row.status);
                  return (
                    <tr key={row.key} className="border-b align-top">
                      <td className="py-2 px-2 font-medium text-slate-900">{row.label}</td>
                      <td className="py-2 px-2">{fmt(row.value, row.unit)}</td>
                      <td className="py-2 px-2">{row.target}</td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className={ui.badgeClass}>
                          {ui.label}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-slate-600">{row.formula}</td>
                      <td className="py-2 px-2 text-slate-600">{row.action}</td>
                    </tr>
                  );
                })}
                {!filteredIndicators.length ? (
                  <tr>
                    <td colSpan={6} className="text-center text-slate-500 py-6 px-2">
                      Aucun indicateur ne correspond au filtre actuel.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Risques opérationnels RH
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {alertRows.map((row) => {
              const ui = statusUi(row.status);
              return (
                <div
                  key={row.key}
                  className="border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2"
                >
                  <span className="text-slate-700">{row.label}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{fmt(row.value)}</Badge>
                    <span className={`text-xs font-medium ${ui.textClass}`}>{ui.label}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Volumes de demandes RH</CardTitle>
            <CardDescription>Répartition par type sur la période sélectionnée.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {requestsByType.map((row) => (
              <div
                key={row.label}
                className="border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between"
              >
                <span>{row.label}</span>
                <Badge variant="outline">{fmt(row.value)}</Badge>
              </div>
            ))}
            {!requestsByType.length ? (
              <div className="text-slate-500 text-sm">Aucune donnée disponible.</div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Volumes de congés</CardTitle>
            <CardDescription>Répartition par type sur la période sélectionnée.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {leavesByType.map((row) => (
              <div
                key={row.label}
                className="border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between"
              >
                <span>{row.label}</span>
                <Badge variant="outline">{fmt(row.value)}</Badge>
              </div>
            ))}
            {!leavesByType.length ? (
              <div className="text-slate-500 text-sm">Aucune donnée disponible.</div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Tendance mensuelle (lecture texte)</CardTitle>
            <CardDescription>
              Suivi sans graphique des derniers points utiles pour la gouvernance RH.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                Respect SLA demandes RH
              </div>
              <div className="space-y-2">
                {latestSlaRows.map((row) => (
                  <div
                    key={`sla-${row.label}`}
                    className="border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between"
                  >
                    <span>{row.label}</span>
                    <Badge variant="outline">{fmt(row.value, "%")}</Badge>
                  </div>
                ))}
                {!latestSlaRows.length ? (
                  <div className="text-slate-500">Aucune donnée disponible.</div>
                ) : null}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                Conformité pointage
              </div>
              <div className="space-y-2">
                {latestComplianceRows.map((row) => (
                  <div
                    key={`compliance-${row.label}`}
                    className="border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between"
                  >
                    <span>{row.label}</span>
                    <Badge variant="outline">{fmt(row.value, "%")}</Badge>
                  </div>
                ))}
                {!latestComplianceRows.length ? (
                  <div className="text-slate-500">Aucune donnée disponible.</div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-600" />
              Recommandations d&apos;action RH
            </CardTitle>
            <CardDescription>
              Priorisation automatique basée sur les KPI en dérive et les alertes critiques.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {recommendations.map((item, index) => (
              <div
                key={`recommendation-${index}`}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 flex items-start gap-2"
              >
                <span className="mt-0.5 text-slate-500">{index + 1}.</span>
                <span className="text-slate-700">{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

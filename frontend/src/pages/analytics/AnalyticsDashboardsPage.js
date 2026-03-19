import React, { useEffect, useMemo, useState } from "react";
import { get } from "../../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  ArrowDownRight,
  ArrowUpRight,
  GraduationCap,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Users,
} from "lucide-react";
import {
  GroupedBarChart,
  ScorePeopleStrip,
  SemiGauge,
} from "../../components/charts/PerformanceKpiVisuals";
import usePageMeta from "../../hooks/usePageMeta";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, num(value)));
}

function shortMonth(label = "") {
  const txt = String(label || "");
  if (!/^\d{4}-\d{2}$/.test(txt)) return txt || "-";
  const [y, m] = txt.split("-");
  return `${m}/${y.slice(2)}`;
}

function scoreLabel(score) {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Solide";
  if (score >= 50) return "A surveiller";
  return "Critique";
}

function scoreTone(score) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 65) return "bg-cyan-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
}

export default function AnalyticsDashboardsPage() {
  usePageMeta(
    "Tableau de bord KPI RH",
    "Lecture synthétique des KPI RH pour piloter effectif, rétention, opérations et développement dans un contexte multisite."
  );
  const [months, setMonths] = useState(6);
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
      setError(e?.message || "Impossible de charger les indicateurs RH");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(months);
  }, [months]); // eslint-disable-line react-hooks/exhaustive-deps

  const highlights = useMemo(() => data?.highlights || {}, [data]);
  const alerts = useMemo(() => data?.alerts || {}, [data]);
  const series = useMemo(() => data?.series || {}, [data]);
  const breakdowns = useMemo(() => data?.breakdowns || {}, [data]);

  const performanceModel = useMemo(() => {
    const hiresRows = Array.isArray(series.hires) ? series.hires : [];
    const leaversRows = Array.isArray(series.leavers) ? series.leavers : [];

    const hiresTotal = hiresRows.reduce((acc, x) => acc + num(x.value), 0);
    const leaversTotal = leaversRows.reduce((acc, x) => acc + num(x.value), 0);
    const movementTotal = hiresTotal + leaversTotal;

    const recruiting = movementTotal
      ? clamp((hiresTotal / movementTotal) * 100)
      : 55;

    const retention = clamp(100 - num(highlights.turnover12mPercent) * 3.2);

    const operations = clamp(
      (num(highlights.timesheetCompliance30dPercent) +
        num(highlights.hrRequestSla30dPercent) +
        clamp(100 - num(highlights.absenceRate30dPercent) * 7)) /
        3
    );

    const development = clamp(
      (clamp(num(highlights.trainingParticipation90dPercent) * 1.4) +
        num(highlights.interviewCompletion90dPercent) +
        clamp(100 - num(highlights.goalsAtRiskPercent) * 2.5)) /
        3
    );

    const overall = clamp((recruiting + retention + operations + development) / 4);

    return {
      overall,
      pillars: [
        {
          id: "recruiting",
          label: "Recrutement",
          value: recruiting,
          subtitle: `${hiresTotal} entrées / ${leaversTotal} sorties`,
          icon: Users,
        },
        {
          id: "retention",
          label: "Rétention",
          value: retention,
          subtitle: `Turnover 12m: ${num(highlights.turnover12mPercent).toFixed(1)}%`,
          icon: ShieldCheck,
        },
        {
          id: "operations",
          label: "Excellence opérationnelle",
          value: operations,
          subtitle: `SLA ${num(highlights.hrRequestSla30dPercent).toFixed(1)}%`,
          icon: Sparkles,
        },
        {
          id: "development",
          label: "Développement des talents",
          value: development,
          subtitle: `Formation ${num(highlights.trainingParticipation90dPercent).toFixed(1)}%`,
          icon: GraduationCap,
        },
      ],
      hiresTotal,
      leaversTotal,
    };
  }, [highlights, series]);

  const movementRows = useMemo(() => {
    const hiresRows = Array.isArray(series.hires) ? series.hires : [];
    const leaversRows = Array.isArray(series.leavers) ? series.leavers : [];
    return hiresRows.map((h, idx) => ({
      label: shortMonth(h.label),
      hires: num(h.value),
      leavers: num(leaversRows[idx]?.value),
    }));
  }, [series]);

  const contractMix = useMemo(() => {
    const rows = Array.isArray(breakdowns.contractTypes) ? breakdowns.contractTypes : [];
    const max = Math.max(1, ...rows.map((r) => num(r.value)));
    return rows.slice(0, 6).map((r) => ({
      label: r.label,
      value: num(r.value),
      width: Math.max(5, Math.round((num(r.value) / max) * 100)),
    }));
  }, [breakdowns]);

  if (loading) return <div className="p-6">Chargement des indicateurs RH…</div>;

  return (
    <div className="p-6 space-y-5 bg-gradient-to-b from-slate-50 via-white to-white">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tableau de bord KPI RH</h1>
          <p className="text-sm text-slate-600">
            Vue synthétique du pilotage RH pour direction, RH et responsables multisites.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={months === 6 ? "default" : "outline"} onClick={() => setMonths(6)}>6 mois</Button>
          <Button variant={months === 12 ? "default" : "outline"} onClick={() => setMonths(12)}>12 mois</Button>
          <Button variant="outline" onClick={() => load(months)}>
            <RefreshCw className="h-4 w-4 mr-1.5" /> Rafraîchir
          </Button>
        </div>
      </div>

      {error ? (
        <Card>
          <CardHeader><CardTitle>Erreur de chargement</CardTitle></CardHeader>
          <CardContent className="text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}

      <Card className="border-0 shadow-lg text-white overflow-hidden">
        <CardContent
          className="p-6 md:p-7"
          style={{
            background:
              "radial-gradient(circle at 15% 15%, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0) 38%), linear-gradient(135deg, #0f172a 0%, #1d4ed8 52%, #0891b2 100%)",
          }}
        >
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-center">
            <div className="xl:col-span-2 space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs">
                <Sparkles className="h-3.5 w-3.5" />
                Performance RH globale
              </div>
              <div className="flex items-end gap-3">
                <div className="text-5xl font-extrabold leading-none">
                  {performanceModel.overall.toFixed(1)}%
                </div>
                <Badge className={`mb-1 text-white border-white/25 ${scoreTone(performanceModel.overall)}`}>
                  {scoreLabel(performanceModel.overall)}
                </Badge>
              </div>
              <div className="text-sm text-blue-100 max-w-2xl">
                Score consolidé basé sur 4 piliers: recrutement, retention, excellence operationnelle et developpement des talents.
              </div>
            </div>

            <div className="rounded-2xl bg-white/12 border border-white/20 p-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-blue-100 text-xs">Effectif actif</div>
                <div className="text-xl font-bold">{num(highlights.activeHeadcount)}</div>
              </div>
              <div>
                <div className="text-blue-100 text-xs">Turnover</div>
                <div className="text-xl font-bold">{num(highlights.turnover12mPercent).toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-blue-100 text-xs">Absentéisme</div>
                <div className="text-xl font-bold">{num(highlights.absenceRate30dPercent).toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-blue-100 text-xs">SLA RH</div>
                <div className="text-xl font-bold">{num(highlights.hrRequestSla30dPercent).toFixed(1)}%</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {performanceModel.pillars.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <Card key={pillar.id} className="border-slate-200 shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-800">{pillar.label}</div>
                  <Icon className="h-4 w-4 text-indigo-500" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-3xl font-bold text-slate-900">{pillar.value.toFixed(1)}%</div>
                  {pillar.value >= 60 ? (
                    <ArrowUpRight className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="h-5 w-5 text-red-500" />
                  )}
                </div>
                <ScorePeopleStrip value={pillar.value} />
                <div className="text-xs text-slate-500">{pillar.subtitle}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <Card className="xl:col-span-3 border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Mouvements d&apos;effectif: entrees vs sorties</CardTitle>
          </CardHeader>
          <CardContent>
            <GroupedBarChart
              rows={movementRows}
              leftKey="hires"
              rightKey="leavers"
              leftLabel="Entrées"
              rightLabel="Sorties"
              leftColorClass="bg-cyan-500"
              rightColorClass="bg-orange-500"
              valueFormatter={(v) => `${num(v)}`}
            />
          </CardContent>
        </Card>

        <Card className="xl:col-span-2 border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Mix contrats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {contractMix.map((c) => (
              <div key={c.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>{c.label}</span>
                  <span className="font-semibold text-slate-800">{c.value}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400"
                    style={{ width: `${c.width}%` }}
                  />
                </div>
              </div>
            ))}
            {!contractMix.length ? (
              <div className="text-sm text-slate-500">Aucune donnee disponible sur la periode choisie.</div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Jauges de performance</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {performanceModel.pillars.map((pillar) => (
            <SemiGauge
              key={`g-${pillar.id}`}
              value={pillar.value}
              label={pillar.label}
              subtitle={scoreLabel(pillar.value)}
            />
          ))}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-red-500" />
            Alertes RH prioritaires
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 text-sm">
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 flex items-center justify-between">
            <span>Contrats a echeance (60j)</span>
            <Badge variant="destructive">{num(alerts.contractsEndingIn60d)}</Badge>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 flex items-center justify-between">
            <span>Demandes RH en attente</span>
            <Badge variant="outline">{num(alerts.pendingHrRequests)}</Badge>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 flex items-center justify-between">
            <span>Congés en attente</span>
            <Badge variant="outline">{num(alerts.pendingLeaves)}</Badge>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 flex items-center justify-between">
            <span>Dépenses en attente</span>
            <Badge variant="outline">{num(alerts.pendingExpenses)}</Badge>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 flex items-center justify-between">
            <span>Dossiers incomplets</span>
            <Badge variant="destructive">{num(alerts.profilesIncomplete)}</Badge>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 flex items-center justify-between">
            <span>Docs obligatoires manquants</span>
            <Badge variant="destructive">{num(alerts.missingMandatoryDocs)}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

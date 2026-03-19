import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { get } from "../../lib/api";
import { useApp } from "../../contexts/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { MiniLineChart } from "../../components/charts/SimpleCharts";
import usePageMeta from "../../hooks/usePageMeta";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function ManagerDashboardPage() {
  const { formatDate } = useApp();
  const navigate = useNavigate();
  usePageMeta("Pilotage manager", "Validations, présence, charge d'équipe et alertes RH pour votre périmètre.");
  const [data, setData] = useState(null);
  const [externalInsights, setExternalInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connectorError, setConnectorError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    setConnectorError("");
    try {
      const [managerRes, connectorRes] = await Promise.allSettled([
        get("/dashboard/manager"),
        get("/connectors/insights/dashboard", {
          params: { country: "SN", city: "Dakar", lang: "fr" },
        }),
      ]);

      if (managerRes.status === "fulfilled") {
        setData(managerRes.value || null);
      } else {
        setData(null);
        setError(managerRes.reason?.message || "Erreur de chargement du dashboard manager");
      }

      if (connectorRes.status === "fulfilled") {
        setExternalInsights(connectorRes.value || null);
      } else {
        setExternalInsights(null);
        setConnectorError(connectorRes.reason?.message || "Contexte externe indisponible");
      }
    } catch (e) {
      setData(null);
      setError(e?.message || "Erreur de chargement du dashboard manager");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const approvals = useMemo(() => data?.approvalsSummary || {}, [data]);

  if (loading) return <div className="p-6">Chargement du pilotage manager…</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pilotage manager</h1>
          <p className="text-sm text-gray-600">Suivez les validations, la présence, la charge et les alertes de votre équipe.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/manager/approvals")}>Voir validations</Button>
          <Button variant="outline" onClick={load}>Rafraîchir</Button>
        </div>
      </div>

      {error ? (
        <Card>
          <CardHeader><CardTitle>Erreur de chargement</CardTitle></CardHeader>
          <CardContent className="text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}

      {connectorError ? (
        <Card>
          <CardHeader><CardTitle>Connecteurs externes</CardTitle></CardHeader>
          <CardContent className="text-sm text-orange-700">{connectorError}</CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-gray-500">Congés</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{num(approvals.leavePendingCount)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-gray-500">Dépenses</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{num(approvals.expensePendingCount)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-gray-500">Demandes RH</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{num(approvals.hrRequestPendingCount)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-gray-500">Formations</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{num(approvals.trainingPendingCount)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-gray-500">Feuilles de temps</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{num(approvals.timesheetPendingCount)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-gray-500">Absentéisme 30j</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{num(data?.teamKpis?.absenceRatePercent).toFixed(2)}%</CardContent></Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>À valider</CardTitle>
              <Button variant="outline" size="sm" onClick={() => navigate("/manager/approvals")}>Centraliser</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(data?.pendingApprovals || []).map((a) => (
              <div key={a.type + a.id} className="border rounded-lg p-2 flex items-center justify-between">
                <div>
                  <div className="font-medium">{a.employeeName}</div>
                  <div className="text-xs text-gray-500">{a.type} - {a.title} - soumis le {formatDate(a.submittedAt)}</div>
                </div>
                <Badge variant={a.priority === "HIGH" ? "destructive" : "outline"}>{a.priority}</Badge>
              </div>
            ))}
            {!data?.pendingApprovals?.length ? <div className="text-gray-500">Aucune validation urgente.</div> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Présence équipe aujourd&apos;hui</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="border rounded-lg p-2">Présents: <b>{num(data?.teamAttendanceToday?.presentCount)}</b></div>
              <div className="border rounded-lg p-2">Absents: <b>{num(data?.teamAttendanceToday?.onLeaveCount) + num(data?.teamAttendanceToday?.unjustifiedAbsenceCount)}</b></div>
              <div className="border rounded-lg p-2">Télétravail: <b>{num(data?.teamAttendanceToday?.remoteCount)}</b></div>
              <div className="border rounded-lg p-2">Équipe totale: <b>{num(data?.teamAttendanceToday?.totalTeamMembers)}</b></div>
            </div>
            {(data?.teamAbsentees || []).slice(0, 5).map((a) => (
              <div key={a.employeeId + a.status} className="border rounded-lg p-2">
                <div className="font-medium">{a.employeeName}</div>
                <div className="text-xs text-gray-500">{a.status} {a.leaveTypeLabel ? `- ${a.leaveTypeLabel}` : ""}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Planning & charge équipe (semaine)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(data?.teamPlanningWeek?.days || []).map((d) => (
              <div key={String(d.date)} className="border rounded-lg p-2 flex items-center justify-between">
                <div>{formatDate(d.date)}</div>
                <div className="text-xs text-gray-500">{num(d.plannedHeadcount)}/{num(d.requiredHeadcount)}</div>
                <Badge variant={d.underStaffed ? "destructive" : "outline"}>{d.underStaffed ? "Sous-effectif" : "OK"}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Suivi performance & entretiens</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(data?.performanceCampaignsSummary || []).slice(0, 5).map((c) => (
              <div key={c.campaignId} className="border rounded-lg p-2">
                <div className="font-medium">{c.campaignName} ({c.period})</div>
                <div className="text-xs text-gray-500">Complétés: {num(c.completedCount)} / {num(c.teamTotalParticipants)}</div>
              </div>
            ))}
            {(data?.interviewsToDo || []).slice(0, 4).map((i) => (
              <div key={i.id} className="border rounded-lg p-2">
                <div className="font-medium">{i.employeeName}</div>
                <div className="text-xs text-gray-500">
                  {i.campaignName} • {i.scheduledAt ? formatDate(i.scheduledAt) : "À planifier"} • {i.status}
                </div>
              </div>
            ))}
            {!data?.performanceCampaignsSummary?.length && !data?.interviewsToDo?.length ? (
              <div className="text-gray-500">Aucune campagne active.</div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Risques & alertes RH équipe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="font-medium mb-1">Fin période d&apos;essai</div>
              {(data?.probationEndingSoon || []).slice(0, 4).map((x) => (
                <div key={x.employeeId} className="border rounded-lg p-2 mb-1">{x.employeeName} - {formatDate(x.probationEndDate)}</div>
              ))}
              {!data?.probationEndingSoon?.length ? <div className="text-gray-500">Aucune alerte période d&apos;essai.</div> : null}
            </div>

            <div>
              <div className="font-medium mb-1">Fin de contrats</div>
              {(data?.contractsEndingSoon || []).slice(0, 4).map((x) => (
                <div key={x.employeeId + String(x.endDate)} className="border rounded-lg p-2 mb-1">{x.employeeName} - {x.contractType} - {formatDate(x.endDate)}</div>
              ))}
              {!data?.contractsEndingSoon?.length ? <div className="text-gray-500">Aucune fin de contrat proche.</div> : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Indicateurs rapides équipe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="border rounded-lg p-2">Absentéisme 30j: <b>{num(data?.teamKpis?.absenceRatePercent).toFixed(2)}%</b></div>
            <div className="border rounded-lg p-2">Heures supplémentaires: <b>{num(data?.teamKpis?.overtimeHours).toFixed(2)}h</b></div>
            <div className="border rounded-lg p-2">Turnover 12 mois: <b>{num(data?.teamKpis?.teamTurnoverLast12Months)}</b></div>
            <div className="pt-2">
              <div className="font-medium mb-1">Heures sup par collaborateur</div>
              {(data?.teamKpis?.overtimeHoursPerEmployee || []).slice(0, 6).map((r) => (
                <div key={r.employeeId} className="flex items-center justify-between border rounded px-2 py-1 mb-1">
                  <span>{r.employeeName}</span>
                  <span>{num(r.hours).toFixed(2)}h</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contexte externe équipe</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 xl:grid-cols-2 gap-4 text-sm">
          <div className="border rounded-lg p-3">
            <div className="font-medium mb-2">Météo locale (impact présence)</div>
            <MiniLineChart
              data={(externalInsights?.weather?.next7Days || []).map((d) => ({
                label: formatDate(d.label),
                value: d.tempMax,
              }))}
              valueKey="value"
              labelKey="label"
              stroke="#EA580C"
              areaFill="rgba(234, 88, 12, 0.12)"
              valueFormatter={(v) => `${num(v).toFixed(1)}°C`}
            />
          </div>
          <div className="border rounded-lg p-3">
            <div className="font-medium mb-2">Prochains jours fériés</div>
            {(externalInsights?.holidays?.upcoming || []).slice(0, 6).map((h) => (
              <div key={h.id} className="border rounded px-2 py-1 mb-1 flex items-center justify-between">
                <span className="truncate mr-2">{h.name}</span>
                <Badge variant="outline">{formatDate(h.date)}</Badge>
              </div>
            ))}
            {!externalInsights?.holidays?.upcoming?.length ? (
              <div className="text-gray-500">Aucun jour férié à venir.</div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

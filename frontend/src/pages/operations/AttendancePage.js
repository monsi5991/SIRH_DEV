import React, { useEffect, useMemo, useState } from "react";
import { get } from "../../lib/api";
import { useApp } from "../../contexts/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { CalendarClock, RefreshCw } from "lucide-react";
import PageHeader from "../../components/common/PageHeader";
import SectionCard from "../../components/common/SectionCard";
import EmptyState from "../../components/common/EmptyState";
import HelpTooltip from "../../components/common/HelpTooltip";
import { TableSkeleton } from "../../components/common/Skeletons";

function dayKey(value) {
  const d = new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeek(value) {
  const date = new Date(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value, days) {
  const d = new Date(value);
  d.setDate(d.getDate() + days);
  return d;
}

function classifyPresence(hours) {
  if (hours <= 0) return { label: "Absence", tone: "bg-rose-50 text-rose-700 border-rose-200", anomaly: true, note: "Aucun pointage ou aucune feuille saisie." };
  if (hours < 4) return { label: "Sortie anticipée", tone: "bg-amber-50 text-amber-700 border-amber-200", anomaly: true, note: "Volume très inférieur à la journée de référence." };
  if (hours < 8) return { label: "Retard / journée incomplète", tone: "bg-amber-50 text-amber-700 border-amber-200", anomaly: true, note: "Temps déclaré inférieur à l’horaire de référence." };
  return { label: "Présent", tone: "bg-emerald-50 text-emerald-700 border-emerald-200", anomaly: false, note: "Journée conforme ou proche de la norme." };
}

export default function AttendancePage() {
  const { formatDate } = useApp();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [viewMode, setViewMode] = useState("day");
  const [anomaliesOnly, setAnomaliesOnly] = useState(false);
  const [timesheets, setTimesheets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [timesheetsRes, employeesRes] = await Promise.all([
        get("/operations/timesheets"),
        get("/people/employees?page=1&pageSize=500").catch(() => get("/employees?page=1&pageSize=500")),
      ]);
      setTimesheets(Array.isArray(timesheetsRes?.timesheets) ? timesheetsRes.timesheets : []);
      setEmployees(Array.isArray(employeesRes?.items) ? employeesRes.items : Array.isArray(employeesRes?.employees) ? employeesRes.employees : []);
    } catch (e) {
      setError(e?.message || "Erreur de chargement du pointage");
      setTimesheets([]);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    const selectedDate = new Date(date);
    const weekStart = startOfWeek(selectedDate);
    const weekEnd = addDays(weekStart, 6);
    return employees
      .filter((employee) => String(employee?.status || "ACTIVE").toUpperCase() === "ACTIVE")
      .map((employee) => {
        const employeeRows = timesheets.filter((row) => {
          if (row.employeeId !== employee.id) return false;
          const rowDate = new Date(row.date);
          if (viewMode === "week") {
            return rowDate >= weekStart && rowDate <= weekEnd;
          }
          return dayKey(rowDate) === dayKey(selectedDate);
        });
        const totalHours = employeeRows.reduce((acc, row) => acc + Number(row.hours || 0), 0);
        const latestStatus = employeeRows[employeeRows.length - 1]?.status || "Submitted";
        const presence = classifyPresence(totalHours);
        return {
          employeeId: employee.id,
          employeeName: `${employee.firstName || ""} ${employee.lastName || ""}`.trim(),
          department: employee.department || "—",
          site: employee.site || "—",
          totalHours,
          latestStatus,
          ...presence,
        };
      })
      .filter((row) => !anomaliesOnly || row.anomaly)
      .sort((left, right) => Number(right.anomaly) - Number(left.anomaly) || left.employeeName.localeCompare(right.employeeName));
  }, [anomaliesOnly, date, employees, timesheets, viewMode]);

  const counters = useMemo(() => ({
    present: rows.filter((row) => row.label === "Présent").length,
    anomalies: rows.filter((row) => row.anomaly).length,
    absent: rows.filter((row) => row.label === "Absence").length,
  }), [rows]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Pointage & présence"
        description="Suivi jour ou semaine avec focus anomalies, retards, absences et sorties anticipées."
        actions={(
          <div className="flex items-center gap-2">
            <input type="date" className="rounded border px-2 py-1" value={date} onChange={(event) => setDate(event.target.value)} />
            <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" /> Rafraîchir</Button>
          </div>
        )}
      >
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-emerald-100 bg-white p-4 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs uppercase tracking-wide text-slate-500">Présents</div><div className="mt-2 text-2xl font-bold text-emerald-700">{counters.present}</div></div>
          <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs uppercase tracking-wide text-slate-500">Anomalies</div><div className="mt-2 text-2xl font-bold text-amber-700">{counters.anomalies}</div></div>
          <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs uppercase tracking-wide text-slate-500">Absences</div><div className="mt-2 text-2xl font-bold text-rose-700">{counters.absent}</div></div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><div className="font-medium">Impact paie</div><div className="mt-1">Les anomalies peuvent impacter la paie selon le règlement intérieur et la politique temps.</div></div>
        </div>
      </PageHeader>

      <SectionCard
        title={<span className="inline-flex items-center gap-2">Lecture du pointage <HelpTooltip content="Activez le filtre des anomalies pour traiter rapidement retards, absences et journées incomplètes." /></span>}
        description="Vérifiez d’abord les cas non conformes avant de relancer les équipes."
        className="border-emerald-100 shadow-sm"
        contentClassName="space-y-4"
      >
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setViewMode("day")} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${viewMode === "day" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700"}`}>Vue jour</button>
          <button type="button" onClick={() => setViewMode("week")} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${viewMode === "week" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700"}`}>Vue semaine</button>
          <button type="button" onClick={() => setAnomaliesOnly((current) => !current)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${anomaliesOnly ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-700"}`}>Anomalies seulement</button>
          <Badge variant="outline">Conseil RH: définissez vos relances selon vos horaires et vos règles internes.</Badge>
        </div>

        {loading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : error ? (
          <EmptyState icon={CalendarClock} title="Chargement impossible" description={error} actionLabel="Réessayer" onAction={load} compact />
        ) : rows.length ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="border px-4 py-3">Employé</th>
                  <th className="border px-4 py-3">Département</th>
                  <th className="border px-4 py-3">Site</th>
                  <th className="border px-4 py-3">Heures</th>
                  <th className="border px-4 py-3">Présence</th>
                  <th className="border px-4 py-3">Commentaire</th>
                  <th className="border px-4 py-3">Statut feuille</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.employeeId}-${viewMode}-${date}`} className="hover:bg-slate-50/70">
                    <td className="border px-4 py-3 font-medium text-slate-900">{row.employeeName}</td>
                    <td className="border px-4 py-3">{row.department}</td>
                    <td className="border px-4 py-3">{row.site}</td>
                    <td className="border px-4 py-3">{row.totalHours.toFixed(1)} h</td>
                    <td className="border px-4 py-3"><Badge className={`border ${row.tone}`}>{row.label}</Badge></td>
                    <td className="border px-4 py-3 text-slate-600">{row.note}</td>
                    <td className="border px-4 py-3"><Badge variant="outline">{row.latestStatus}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={CalendarClock}
            title="Aucun pointage sur cette période"
            description={`Aucune donnée visible pour ${formatDate(date)}. Sélectionnez une autre date ou désactivez le filtre anomalies.`}
            compact
          />
        )}
      </SectionCard>
    </div>
  );
}

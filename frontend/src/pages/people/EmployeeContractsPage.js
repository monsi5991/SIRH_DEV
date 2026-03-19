import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, FileCheck2, RefreshCw } from "lucide-react";
import { get } from "../../lib/api";
import { useApp } from "../../contexts/AppContext";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import PageHeader from "../../components/common/PageHeader";
import SectionCard from "../../components/common/SectionCard";
import EmptyState from "../../components/common/EmptyState";
import HelpTooltip from "../../components/common/HelpTooltip";
import StatusBadge from "../../components/common/StatusBadge";
import { TableSkeleton } from "../../components/common/Skeletons";
import EmployeeFormDialog from "../../components/people/EmployeeFormDialog";
import { updateEmployee as apiUpdateEmployee } from "../../hooks/useEmployees";

function monthsBetween(from, to = new Date()) {
  if (!from) return 0;
  const start = new Date(from);
  if (Number.isNaN(start.getTime())) return 0;
  return (to.getFullYear() - start.getFullYear()) * 12 + (to.getMonth() - start.getMonth());
}

function probationEndDate(joinDate) {
  if (!joinDate) return null;
  const date = new Date(joinDate);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + 90);
  return date;
}

function isWithinDays(value, days) {
  if (!value) return false;
  const now = new Date();
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return false;
  const diff = Math.ceil((target - now) / 86400000);
  return diff >= 0 && diff <= days;
}

function isExpired(value) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date < new Date();
}

function formatFullName(employee) {
  return `${employee?.firstName || ""} ${employee?.lastName || ""}`.trim() || "Employé";
}

export default function EmployeeContractsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { formatDate } = useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [contractType, setContractType] = useState("");
  const [department, setDepartment] = useState("");
  const [site, setSite] = useState("");
  const [status, setStatus] = useState("");
  const [riskOnly, setRiskOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("endDate");
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [renewalReason, setRenewalReason] = useState("");
  const pageSize = 12;

  const deepLinkedEmployeeId = useMemo(() => new URLSearchParams(location.search).get("employeeId") || "", [location.search]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await get("/people/employees?page=1&pageSize=500").catch(() => get("/employees?page=1&pageSize=500"));
      const rows = Array.isArray(response?.items) ? response.items : Array.isArray(response?.employees) ? response.employees : [];
      setItems(rows);
    } catch (e) {
      setError(e?.message || "Erreur de chargement des contrats");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!deepLinkedEmployeeId) return;
    setPage(1);
  }, [deepLinkedEmployeeId]);

  const departments = useMemo(
    () => Array.from(new Set(items.map((item) => item?.department).filter(Boolean))).sort(),
    [items]
  );
  const sites = useMemo(
    () => Array.from(new Set(items.map((item) => item?.site).filter(Boolean))).sort(),
    [items]
  );

  const rows = useMemo(() => {
    const filtered = items.filter((employee) => {
      const fullName = formatFullName(employee).toLowerCase();
      const matchesSearch = !search.trim() || [fullName, employee?.position, employee?.department, employee?.site].join(" ").toLowerCase().includes(search.trim().toLowerCase());
      const matchesType = !contractType || employee?.contractType === contractType;
      const matchesDepartment = !department || employee?.department === department;
      const matchesSite = !site || employee?.site === site;
      const matchesStatus = !status || String(employee?.status || "").toUpperCase() === status;
      const matchesDeepLink = !deepLinkedEmployeeId || employee.id === deepLinkedEmployeeId;
      const cddRisk = String(employee?.contractType || "").toUpperCase() === "CDD" && monthsBetween(employee?.joinDate) >= 22;
      const probationSoon = isWithinDays(probationEndDate(employee?.joinDate), 7);
      const expiringSoon = isWithinDays(employee?.endDate, 60);
      const expired = isExpired(employee?.endDate);
      const risk = cddRisk || probationSoon || expiringSoon || expired;
      return matchesSearch && matchesType && matchesDepartment && matchesSite && matchesStatus && matchesDeepLink && (!riskOnly || risk);
    });

    return filtered.sort((left, right) => {
      if (sortBy === "name") return formatFullName(left).localeCompare(formatFullName(right));
      if (sortBy === "department") return String(left?.department || "").localeCompare(String(right?.department || ""));
      if (sortBy === "contractType") return String(left?.contractType || "").localeCompare(String(right?.contractType || ""));
      const leftDate = left?.endDate ? new Date(left.endDate).getTime() : Number.MAX_SAFE_INTEGER;
      const rightDate = right?.endDate ? new Date(right.endDate).getTime() : Number.MAX_SAFE_INTEGER;
      return leftDate - rightDate;
    });
  }, [contractType, deepLinkedEmployeeId, department, items, page, riskOnly, search, site, sortBy, status]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pagedRows = rows.slice((page - 1) * pageSize, page * pageSize);

  const counters = useMemo(() => ({
    cddRisk: rows.filter((employee) => String(employee?.contractType || "").toUpperCase() === "CDD" && monthsBetween(employee?.joinDate) >= 22).length,
    probationSoon: rows.filter((employee) => isWithinDays(probationEndDate(employee?.joinDate), 7)).length,
    expired: rows.filter((employee) => isExpired(employee?.endDate)).length,
    expiringSoon: rows.filter((employee) => isWithinDays(employee?.endDate, 60)).length,
  }), [rows]);

  const handleRenew = (employee) => {
    if (String(employee?.contractType || "").toUpperCase() === "CDD") {
      const reason = window.prompt("Motif du CDD (obligatoire pour préparer le renouvellement)");
      if (!reason || !reason.trim()) {
        window.alert("Le motif du CDD est obligatoire pour lancer le renouvellement.");
        return;
      }
      setRenewalReason(reason.trim());
    } else {
      setRenewalReason("");
    }
    setEditingEmployee(employee);
  };

  const handleSubmit = async (payload) => {
    if (!editingEmployee) return;
    await apiUpdateEmployee(editingEmployee.id, payload);
    setEditingEmployee(null);
    setRenewalReason("");
    await load();
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Contrats employés"
        description="Contrats, échéances et risques juridiques à suivre côté RH."
        actions={<Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" /> Rafraîchir</Button>}
      >
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-emerald-100 bg-white p-4 md:grid-cols-5">
          <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs uppercase tracking-wide text-slate-500">CDD risque 24 mois</div><div className="mt-2 text-2xl font-bold text-amber-700">{counters.cddRisk}</div></div>
          <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs uppercase tracking-wide text-slate-500">Essai à J-7</div><div className="mt-2 text-2xl font-bold text-amber-700">{counters.probationSoon}</div></div>
          <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs uppercase tracking-wide text-slate-500">Contrats expirés</div><div className="mt-2 text-2xl font-bold text-rose-700">{counters.expired}</div></div>
          <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs uppercase tracking-wide text-slate-500">Échéance 60 jours</div><div className="mt-2 text-2xl font-bold text-slate-900">{counters.expiringSoon}</div></div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><div className="font-medium">Alerte juridique</div><div className="mt-1">Suivez les CDD prolongés ou renouvelés pour anticiper tout risque de requalification selon la loi locale.</div></div>
        </div>
      </PageHeader>

      <SectionCard
        title={<span className="inline-flex items-center gap-2">Filtres contrats <HelpTooltip content="Filtrez par type, site, département et statut. Activez “à risque” pour faire ressortir uniquement les dossiers urgents." /></span>}
        description="Recherche, tri et filtre à risque pour aller droit aux contrats sensibles."
        className="border-emerald-100 shadow-sm"
        contentClassName="space-y-4"
      >
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-6">
          <input className="h-11 rounded-xl border border-slate-200 px-3 xl:col-span-2" placeholder="Rechercher un employé ou un poste" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          <select className="h-11 rounded-xl border border-slate-200 px-3" value={contractType} onChange={(event) => { setContractType(event.target.value); setPage(1); }}>
            <option value="">Tous types</option>
            <option value="CDI">CDI</option>
            <option value="CDD">CDD</option>
            <option value="STAGE">Stage</option>
            <option value="INTERIM">Intérim</option>
            <option value="APPRENTISSAGE">Apprentissage</option>
          </select>
          <select className="h-11 rounded-xl border border-slate-200 px-3" value={department} onChange={(event) => { setDepartment(event.target.value); setPage(1); }}>
            <option value="">Tous départements</option>
            {departments.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select className="h-11 rounded-xl border border-slate-200 px-3" value={site} onChange={(event) => { setSite(event.target.value); setPage(1); }}>
            <option value="">Tous sites</option>
            {sites.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select className="h-11 rounded-xl border border-slate-200 px-3" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="">Tous statuts</option>
            <option value="ACTIVE">Actif</option>
            <option value="INACTIVE">Inactif</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => { setRiskOnly(false); setPage(1); }} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${!riskOnly ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700"}`}>Tous</button>
          <button type="button" onClick={() => { setRiskOnly(true); setPage(1); }} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${riskOnly ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700"}`}>À risque</button>
          <select className="ml-auto h-9 rounded-lg border border-slate-200 px-2 text-sm" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="endDate">Tri: fin de contrat</option>
            <option value="name">Tri: nom</option>
            <option value="department">Tri: département</option>
            <option value="contractType">Tri: type</option>
          </select>
        </div>
      </SectionCard>

      <SectionCard title="Référentiel des contrats" description="Vue RH avec badges de risque et actions immédiates." className="border-emerald-100 shadow-sm">
        {loading ? (
          <TableSkeleton rows={8} cols={8} />
        ) : error ? (
          <EmptyState icon={FileCheck2} title="Impossible de charger les contrats" description={error} actionLabel="Réessayer" onAction={load} compact />
        ) : pagedRows.length ? (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="border px-4 py-3">Employé</th>
                    <th className="border px-4 py-3">Type</th>
                    <th className="border px-4 py-3">Début</th>
                    <th className="border px-4 py-3">Fin</th>
                    <th className="border px-4 py-3">Renouvellements</th>
                    <th className="border px-4 py-3">Essai fin</th>
                    <th className="border px-4 py-3">Convention / brut</th>
                    <th className="border px-4 py-3">Statut</th>
                    <th className="border px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((employee) => {
                    const cddRisk = String(employee?.contractType || "").toUpperCase() === "CDD" && monthsBetween(employee?.joinDate) >= 22;
                    const probationSoon = isWithinDays(probationEndDate(employee?.joinDate), 7);
                    const expiringSoon = isWithinDays(employee?.endDate, 60);
                    const expired = isExpired(employee?.endDate);
                    return (
                      <tr key={employee.id} className="hover:bg-slate-50/70">
                        <td className="border px-4 py-3">
                          <button type="button" className="font-medium text-slate-900 underline decoration-dotted" onClick={() => navigate(`/people/directory?employeeId=${employee.id}`)}>{formatFullName(employee)}</button>
                          <div className="mt-1 text-xs text-slate-500">{employee.department || "—"} · {employee.site || "—"}</div>
                        </td>
                        <td className="border px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {employee.contractType ? <Badge variant="outline">{employee.contractType}</Badge> : <span className="text-slate-400">—</span>}
                            {cddRisk ? <Badge className="border-amber-200 bg-amber-50 text-amber-700">CDD à risque</Badge> : null}
                          </div>
                        </td>
                        <td className="border px-4 py-3">{employee.joinDate ? formatDate(employee.joinDate) : "—"}</td>
                        <td className="border px-4 py-3">{employee.endDate ? formatDate(employee.endDate) : "—"}</td>
                        <td className="border px-4 py-3">{cddRisk ? ">= 1 à vérifier" : "—"}</td>
                        <td className="border px-4 py-3">
                          {probationEndDate(employee.joinDate) ? formatDate(probationEndDate(employee.joinDate)) : "—"}
                          {probationSoon ? <div className="mt-1 text-xs text-amber-700">Décision attendue J-7</div> : null}
                        </td>
                        <td className="border px-4 py-3">
                          <div>{employee.isCadre ? "Cadres" : "Générale"}</div>
                          <div className="mt-1 text-xs text-slate-500">{employee.baseSalary ? `${new Intl.NumberFormat("fr-FR").format(employee.baseSalary)} XOF` : "Brut à renseigner"}</div>
                        </td>
                        <td className="border px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <StatusBadge status={employee.status || "ACTIVE"} />
                            {expired ? <Badge className="border-rose-200 bg-rose-50 text-rose-700">Expiré</Badge> : null}
                            {!expired && expiringSoon ? <Badge className="border-amber-200 bg-amber-50 text-amber-700">Échéance 60 j</Badge> : null}
                          </div>
                        </td>
                        <td className="border px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleRenew(employee)}>Renouveler</Button>
                            <Button size="sm" variant="outline" onClick={() => navigate(`/operations/leaves?employeeId=${employee.id}`)}>Absences</Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <span>{rows.length} contrat(s) dans le filtre courant</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Précédent</Button>
                <span>Page {page} / {totalPages}</span>
                <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Suivant</Button>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={AlertTriangle}
            title="Aucun contrat dans ce périmètre"
            description="Modifiez les filtres ou désactivez le mode “à risque” pour élargir la recherche."
            compact
          />
        )}
      </SectionCard>

      {renewalReason ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Motif CDD capturé pour ce renouvellement: <span className="font-medium">{renewalReason}</span>
        </div>
      ) : null}

      <EmployeeFormDialog
        open={!!editingEmployee}
        initialData={editingEmployee}
        onClose={() => {
          setEditingEmployee(null);
          setRenewalReason("");
        }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

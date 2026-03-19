import React, { useEffect, useMemo, useState } from "react";
import { get } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { FileText, RefreshCw } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import PageHeader from "../../components/common/PageHeader";
import SectionCard from "../../components/common/SectionCard";
import EmptyState from "../../components/common/EmptyState";
import { TableSkeleton } from "../../components/common/Skeletons";
import { checkPermission, normalizeRoles } from "../../lib/permissions";
import { useApp } from "../../contexts/AppContext";
import StatusBadge from "../../components/common/StatusBadge";
import HelpTooltip from "../../components/common/HelpTooltip";

function toRows(items = []) {
  return items.map((r) => ({
    id: r.id,
    type: r.type || "OTHER",
    employee:
      r.employee?.firstName || r.employee?.lastName
        ? `${r.employee?.firstName || ""} ${r.employee?.lastName || ""}`.trim()
        : "—",
    title: r.title || r.type || "Demande RH",
    submittedAt: r.submittedAt || r.createdAt,
    status: r.status || "SUBMITTED",
  }));
}

function normalizeStatus(status) {
  const s = String(status || "").toUpperCase();
  if (["DRAFT", "SUBMITTED", "PENDING_MANAGER", "PENDING_HR"].includes(s)) return "pending";
  if (["APPROVED", "CLOSED"].includes(s)) return "approved";
  if (["REJECTED", "CANCELED"].includes(s)) return "rejected";
  return "pending";
}

const CATALOG = [
  { label: "Attestation travail / salaire", type: "ATTESTATION", helper: "Génération documentaire après validation RH." },
  { label: "Duplicata bulletin / acompte / prêt", type: "PAYROLL_SUPPORT", helper: "Canal paie, avec pièces et justification si nécessaire." },
  { label: "Télétravail", type: "REMOTE_WORK", helper: "Formulaire avec période, jours et validation manager." },
  { label: "Mutation / promotion", type: "DATA_CHANGE", helper: "Changement de poste, site ou rattachement." },
  { label: "Démission / sortie", type: "OTHER", helper: "Préavis et documents de sortie à confirmer selon le contrat, la convention et le pays." },
  { label: "Autre demande RH", type: "OTHER", helper: "Utilisez ce type pour les cas hors catalogue standard." },
];

function scopeLabel(scope) {
  if (scope === "company") return "toute l’organisation";
  if (scope === "team") return "mon équipe";
  return "mes demandes";
}

export default function HrRequestsPage() {
  const { user } = useAuth();
  const { formatDate } = useApp();
  const [scope, setScope] = useState("self");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const roles = normalizeRoles(user?.roles || user?.role || []);
      const isStrictEmployee =
        roles.includes("EMPLOYEE") &&
        !roles.includes("MANAGER") &&
        !roles.includes("HR") &&
        !roles.includes("ADMIN");
      const canCompany = checkPermission({
        user,
        requiredPermissions: ["all", "admin_read"],
        mode: "anyOf",
      });
      const canTeam = checkPermission({
        user,
        requiredPermissions: ["team_read", "team_write", "approvals_read", "approvals_write"],
        mode: "anyOf",
      });
      const nextScope = isStrictEmployee ? "self" : canCompany ? "company" : canTeam ? "team" : "self";
      setScope(nextScope);

      const response = await get(`/requests/hr?scope=${nextScope}&limit=200${typeFilter ? `&type=${typeFilter}` : ""}`);
      setRows(toRows(response?.items || []));
    } catch (e) {
      setError(e?.message || "Erreur de chargement des demandes RH");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [typeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const counters = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;

    for (const row of rows) {
      const state = normalizeStatus(row.status);
      if (state === "pending") pending += 1;
      else if (state === "approved") approved += 1;
      else if (state === "rejected") rejected += 1;
    }

    return { pending, approved, rejected, total: rows.length };
  }, [rows]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Demandes RH"
        description={`Catalogue de services RH et suivi des demandes pour ${scopeLabel(scope)}.`}
        actions={<Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" /> Rafraîchir</Button>}
      >
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-emerald-100 bg-white p-4 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs uppercase tracking-wide text-slate-500">Total</div><div className="mt-2 text-2xl font-bold text-slate-900">{counters.total}</div></div>
          <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs uppercase tracking-wide text-slate-500">En attente</div><div className="mt-2 text-2xl font-bold text-amber-700">{counters.pending}</div></div>
          <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs uppercase tracking-wide text-slate-500">Approuvées</div><div className="mt-2 text-2xl font-bold text-emerald-700">{counters.approved}</div></div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><div className="font-medium">Point d’attention</div><div className="mt-1">Vérifiez toujours le contrat, la convention et les règles locales avant de valider une demande sensible.</div></div>
        </div>
      </PageHeader>

      <SectionCard
        title={<span className="inline-flex items-center gap-2">Catalogue des demandes <HelpTooltip content="Chaque type de demande indique clairement le bon canal RH, les pièces à prévoir et le niveau de validation attendu." /></span>}
        description="Des libellés simples pour aider salariés, managers et RH à choisir la bonne demande du premier coup."
        actions={(
          <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="">Tous types</option>
            <option value="ATTESTATION">Attestation</option>
            <option value="PAYROLL_SUPPORT">Paie</option>
            <option value="REMOTE_WORK">Télétravail</option>
            <option value="DATA_CHANGE">Changement RH</option>
            <option value="OTHER">Autres</option>
          </select>
        )}
        className="border-emerald-100 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {CATALOG.map((item) => (
            <div key={`${item.type}-${item.label}`} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="font-medium text-slate-900">{item.label}</div>
              <div className="mt-2 text-sm text-slate-600">{item.helper}</div>
              <div className="mt-3"><StatusBadge status={item.type} label={item.type} className="bg-slate-100 text-slate-700 border-slate-200" /></div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Suivi des demandes RH" description="Vue lisible des statuts, des dates et des demandes à reprendre rapidement." className="border-emerald-100 shadow-sm">
        {loading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : error ? (
          <EmptyState icon={FileText} title="Impossible de charger les demandes" description={error} actionLabel="Réessayer" onAction={load} compact />
        ) : rows.length ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="border px-4 py-3">Type</th>
                  <th className="border px-4 py-3">Employé</th>
                  <th className="border px-4 py-3">Demande</th>
                  <th className="border px-4 py-3">Soumise le</th>
                  <th className="border px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70">
                    <td className="border px-4 py-3">{row.type}</td>
                    <td className="border px-4 py-3">{row.employee}</td>
                    <td className="border px-4 py-3">{row.title}</td>
                    <td className="border px-4 py-3">{row.submittedAt ? formatDate(row.submittedAt) : "—"}</td>
                    <td className="border px-4 py-3"><StatusBadge status={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={FileText}
            title="Aucune demande visible"
            description="Aucune demande RH ne correspond au scope ou au type sélectionné."
            compact
          />
        )}
      </SectionCard>
    </div>
  );
}

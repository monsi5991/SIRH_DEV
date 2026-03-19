import React, { useEffect, useState } from "react";
import { get } from "../../lib/api";
import { useApp } from "../../contexts/AppContext";
import { ShieldAlert } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import PageHeader from "../../components/common/PageHeader";
import SectionCard from "../../components/common/SectionCard";
import EmptyState from "../../components/common/EmptyState";
import HelpTooltip from "../../components/common/HelpTooltip";
import { TableSkeleton } from "../../components/common/Skeletons";
import usePageMeta from "../../hooks/usePageMeta";

export default function AdminAuditLogPage() {
  const { formatDate } = useApp();
  usePageMeta(
    "Journal d'audit",
    "Historique des actions sensibles, validations et modifications pour renforcer la traçabilite du SIRH."
  );
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [period, setPeriod] = useState("30");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (type) params.set("type", type);
      if (period) params.set("days", period);
      const r = await get(`/admin/audit-log?${params.toString()}`);
      setItems(Array.isArray(r?.items) ? r.items : []);
    } catch (e) {
      setError(e?.message || "Erreur de chargement de l’audit log");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Journal d’audit"
        description="Retrouvez les actions sensibles, exports, validations et changements importants sur votre espace RH multisite."
        actions={(
          <div className="flex items-center gap-2">
            <input
              className="border rounded px-2 py-1"
              placeholder="Qui, quoi, sur quel dossier"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className="border rounded px-2 py-1"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="">Tous types</option>
              <option value="POLICY">POLICY</option>
              <option value="LEAVE">LEAVE</option>
              <option value="EMPLOYEE">EMPLOYEE</option>
              <option value="DOCUMENT">DOCUMENT</option>
              <option value="TIMESHEET">TIMESHEET</option>
              <option value="EXPENSE">EXPENSE</option>
            </select>
            <select className="border rounded px-2 py-1" value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="7">7 jours</option>
              <option value="30">30 jours</option>
              <option value="90">90 jours</option>
              <option value="365">12 mois</option>
            </select>
            <Button variant="outline" onClick={load}>Rafraîchir</Button>
          </div>
        )}
      />

      <SectionCard
        title={<span className="inline-flex items-center gap-2">Actions sensibles <HelpTooltip content="Filtrez par utilisateur, type d’action, période et objet pour retrouver rapidement qui a modifié, validé ou exporté quoi." /></span>}
        description="Conservez ces traces pour reconstituer une décision, contrôler un accès ou documenter un incident."
      >
        {loading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : error ? (
          <EmptyState
            icon={ShieldAlert}
            title="Impossible de charger l’audit log"
            description={error}
            actionLabel="Réessayer"
            onAction={load}
            compact
          />
        ) : items.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 border text-left">Date</th>
                  <th className="p-2 border text-left">Type</th>
                  <th className="p-2 border text-left">Entité</th>
                  <th className="p-2 border text-left">Auteur</th>
                  <th className="p-2 border text-left">Source</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="p-2 border">{formatDate(i.createdAt)}</td>
                    <td className="p-2 border"><Badge variant="outline">{i.type}</Badge></td>
                    <td className="p-2 border">{i.entity} • {i.entityId}</td>
                    <td className="p-2 border">{i.actorId || "système"}</td>
                    <td className="p-2 border">{i.source || "audit_event"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={ShieldAlert}
            title="Aucun événement d’audit"
            description="Les prochaines actions sensibles apparaîtront ici."
            compact
          />
        )}
      </SectionCard>
    </div>
  );
}

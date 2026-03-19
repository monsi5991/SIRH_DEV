import React, { useEffect, useMemo, useState } from "react";
import { get } from "../../lib/api";
import { Shield } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import PageHeader from "../../components/common/PageHeader";
import SectionCard from "../../components/common/SectionCard";
import EmptyState from "../../components/common/EmptyState";
import HelpTooltip from "../../components/common/HelpTooltip";
import { ListSkeleton } from "../../components/common/Skeletons";
import usePageMeta from "../../hooks/usePageMeta";

function rolePreview(role) {
  const name = String(role || "").toUpperCase();
  if (name.includes("HR")) return "Voit l’entreprise, les dossiers salariés, les circuits RH et les exports RH.";
  if (name.includes("MANAGER")) return "Voit son équipe, valide les demandes et suit les objectifs/absences.";
  if (name.includes("EMPLOYEE")) return "Voit uniquement ses données, demandes, documents et indicateurs personnels.";
  if (name.includes("ADMIN")) return "Voit la configuration, les rôles, l’audit et la gouvernance applicative.";
  return "Aperçu à compléter selon la matrice de permissions.";
}

export default function AdminPermissionsPage() {
  usePageMeta(
    "Roles & permissions",
    "Matrice des acces pour distribuer clairement les droits RH, manager, employe et administration."
  );
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await get("/admin/roles-permissions");
      setItems(Array.isArray(r?.items) ? r.items : []);
    } catch (e) {
      setError(e?.message || "Erreur chargement rôles et permissions");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const summary = useMemo(() => {
    const totalRoles = items.length;
    const totalUsers = items.reduce((total, item) => total + Number(item.userCount || 0), 0);
    const highPrivilegeRoles = items.filter((item) => item.permissions.includes("all")).length;
    const emptyRoles = items.filter((item) => !item.permissions.length).length;
    return { totalRoles, totalUsers, highPrivilegeRoles, emptyRoles };
  }, [items]);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Rôles & permissions"
        description="Expliquez clairement qui peut voir, modifier, valider ou administrer dans votre SIRH."
        actions={<Button variant="outline" onClick={load}>Rafraîchir</Button>}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Roles</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{summary.totalRoles}</div>
          <div className="mt-1 text-sm text-slate-600">Profils d&apos;acces distincts</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Utilisateurs rattaches</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{summary.totalUsers}</div>
          <div className="mt-1 text-sm text-slate-600">Somme des utilisateurs par role</div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-xs uppercase tracking-wide text-amber-700">Acces larges</div>
          <div className="mt-2 text-3xl font-bold text-amber-700">{summary.highPrivilegeRoles}</div>
          <div className="mt-1 text-sm text-amber-700">Roles avec permission globale</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Roles a completer</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{summary.emptyRoles}</div>
          <div className="mt-1 text-sm text-slate-600">Sans permission associee</div>
        </div>
      </div>

      <SectionCard
        title={<span className="inline-flex items-center gap-2">Matrice des permissions <HelpTooltip content="Chaque rôle doit expliquer clairement ce qu’il peut consulter, modifier ou valider, sans jargon technique inutile." /></span>}
        description="Lecture simple: volume d’utilisateurs, droits clés et aperçu métier de l’expérience par rôle."
      >
        {loading ? (
          <ListSkeleton rows={5} />
        ) : error ? (
          <EmptyState
            icon={Shield}
            title="Impossible de charger la matrice"
            description={error}
            actionLabel="Réessayer"
            onAction={load}
            compact
          />
        ) : items.length ? (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-gray-900">{item.role}</div>
                  <Badge variant="outline">{item.userCount} utilisateur(s)</Badge>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {rolePreview(item.role)}
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.permissions.length ? item.permissions.map((p) => (
                    <Badge key={`${item.id}-${p}`} variant="secondary">{p}</Badge>
                  )) : <span className="text-sm text-gray-500">Aucune permission.</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Shield}
            title="Aucun rôle configuré"
            description="Créez des rôles pour répartir les droits d’accès."
            compact
          />
        )}
      </SectionCard>
    </div>
  );
}

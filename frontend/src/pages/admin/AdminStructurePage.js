import React, { useEffect, useMemo, useState } from "react";
import { get } from "../../lib/api";
import { Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import PageHeader from "../../components/common/PageHeader";
import SectionCard from "../../components/common/SectionCard";
import EmptyState from "../../components/common/EmptyState";
import HelpTooltip from "../../components/common/HelpTooltip";
import { ListSkeleton } from "../../components/common/Skeletons";
import usePageMeta from "../../hooks/usePageMeta";

export default function AdminStructurePage() {
  usePageMeta(
    "Organisation",
    "Sites, departements et rattachements manager pour garder une lecture claire du perimetre RH multisite."
  );
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await get("/admin/organization");
      setData(r || null);
    } catch (e) {
      setError(e?.message || "Erreur chargement organisation");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const summary = data?.summary || {};
  const departments = data?.departments || [];
  const sites = data?.sites || [];
  const managers = data?.managers || [];
  const topSite = useMemo(() => sites[0] || null, [sites]);
  const averageReportsPerManager = useMemo(() => {
    if (!managers.length) return 0;
    return (managers.reduce((total, item) => total + Number(item.reports || 0), 0) / managers.length).toFixed(1);
  }, [managers]);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Organisation"
        description="Clarifiez la structure, les sites et les rattachements pour que les scopes RH et manager restent fiables."
        actions={<Button variant="outline" onClick={load}>Rafraîchir</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card><CardHeader><CardTitle className="text-base">Effectif total</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{summary.totalEmployees ?? 0}</div><div className="mt-1 text-sm text-slate-500">Population RH suivie</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Actifs</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{summary.activeEmployees ?? 0}</div><div className="mt-1 text-sm text-slate-500">Collaborateurs en poste</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Inactifs</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{summary.inactiveEmployees ?? 0}</div><div className="mt-1 text-sm text-slate-500">Sortis ou suspendus</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Départements</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{summary.departments ?? 0}</div><div className="mt-1 text-sm text-slate-500">Pôles structurés</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Sites</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{summary.sites ?? 0}</div><div className="mt-1 text-sm text-slate-500">{topSite ? `Site principal: ${topSite.name}` : "Aucun site dominant"}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Managers</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{summary.managers ?? 0}</div><div className="mt-1 text-sm text-slate-500">{averageReportsPerManager} rattachement(s) en moyenne</div></CardContent></Card>
      </div>

      <SectionCard title={<span className="inline-flex items-center gap-2">Départements <HelpTooltip content="Une structure claire aide la direction, les RH et les managers a comprendre qui travaille ou, sur quel site, et dans quel perimetre de responsabilite." /></span>} description="Verifiez ici si la structure colle vraiment a votre organisation du terrain.">
        {loading ? (
          <ListSkeleton rows={5} />
        ) : error ? (
          <EmptyState
            icon={Building2}
            title="Chargement impossible"
            description={error}
            actionLabel="Réessayer"
            onAction={load}
            compact
          />
        ) : departments.length ? (
          <div className="space-y-2">
            {departments.map((d) => (
              <div key={d.name} className="border rounded-lg p-3 flex items-center justify-between">
                <div className="font-medium">{d.name}</div>
                <div className="text-sm text-gray-600">{d.headcount} employé(s)</div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Building2}
            title="Aucun département configuré"
            description="Ajoutez des départements pour structurer l’organisation."
            compact
          />
        )}
      </SectionCard>

      <SectionCard title="Sites" description="Lisez rapidement les volumes par site pour confirmer que le pilotage multisite reflète bien la réalité opérationnelle.">
        {loading ? (
          <ListSkeleton rows={4} />
        ) : error ? (
          <EmptyState
            icon={Building2}
            title="Chargement impossible"
            description={error}
            actionLabel="Réessayer"
            onAction={load}
            compact
          />
        ) : sites.length ? (
          <div className="space-y-2">
            {sites.map((s) => (
              <div key={s.name} className="border rounded-lg p-3 flex items-center justify-between">
                <div className="font-medium">{s.name}</div>
                <div className="text-sm text-gray-600">{s.headcount} employé(s)</div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Building2}
            title="Aucun site configuré"
            description="Ajoutez des sites pour répartir vos équipes."
            compact
          />
        )}
      </SectionCard>

      <SectionCard title="Managers & rattachements" description="Ce que voit un manager dépend directement de ce rattachement. Un mauvais rattachement crée tout de suite du bruit sur les validations, absences et indicateurs.">
        {loading ? (
          <ListSkeleton rows={5} />
        ) : error ? (
          <EmptyState
            icon={Building2}
            title="Chargement impossible"
            description={error}
            actionLabel="Réessayer"
            onAction={load}
            compact
          />
        ) : managers.length ? (
          <div className="space-y-2">
            {managers.map((m) => (
              <div key={m.id} className="border rounded-lg p-3 flex items-center justify-between">
                <div className="font-medium">{m.name}</div>
                <div className="text-sm text-gray-600">{m.reports} collaborateur(s) rattaché(s)</div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Building2}
            title="Aucun rattachement manager détecté"
            description="Affectez des managers pour rendre les validations et les tableaux de bord équipe vraiment fiables."
            compact
          />
        )}
      </SectionCard>
    </div>
  );
}

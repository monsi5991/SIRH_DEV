import React, { useEffect, useState } from "react";
import { get } from "../../lib/api";
import { useApp } from "../../contexts/AppContext";
import { Workflow } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import PageHeader from "../../components/common/PageHeader";
import SectionCard from "../../components/common/SectionCard";
import EmptyState from "../../components/common/EmptyState";
import HelpTooltip from "../../components/common/HelpTooltip";
import { ListSkeleton } from "../../components/common/Skeletons";
import usePageMeta from "../../hooks/usePageMeta";

function stepLabel(step) {
  const labels = {
    collect: "Informations salarié",
    generate: "Documents",
    sign: "Signature",
    files: "Pièces",
    register: "Déclarations",
    archive: "Archivage",
    letter: "Lettre de sortie",
    approvals: "Validations",
    finalpay: "Solde de tout compte",
    equipment: "Restitutions",
    orgs: "Organismes sociaux",
    docs: "Documents de sortie",
  };
  return labels[step] || step || "Étape non définie";
}

export default function AdminWorkflowsPage() {
  const { formatDate } = useApp();
  usePageMeta(
    "Circuits RH",
    "Suivi des integrations, sorties et taches de conformite pour garder des parcours RH lisibles et tracables."
  );
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await get("/admin/workflows");
      setData(r || null);
    } catch (e) {
      setError(e?.message || "Erreur de chargement des parcours RH");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onboarding = data?.items?.onboarding || [];
  const offboarding = data?.items?.offboarding || [];
  const compliance = data?.items?.compliance || [];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Circuits RH"
        description="Suivez les parcours d’intégration, de sortie et les tâches de conformité avec une lecture simple de la prochaine action à mener."
        actions={<Button variant="outline" onClick={load}>Rafraîchir</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader><CardTitle className="text-base">Intégrations ouvertes</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data?.kpis?.onboardingOpen ?? 0}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Sorties ouvertes</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data?.kpis?.offboardingOpen ?? 0}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Conformité ouverte</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data?.kpis?.complianceOpen ?? 0}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Approbations en attente</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data?.kpis?.approvalsPending ?? 0}</div></CardContent></Card>
      </div>

      <SectionCard title={<span className="inline-flex items-center gap-2">Parcours d’intégration <HelpTooltip content="L’objectif n’est pas de montrer le moteur, mais la prochaine action à réaliser et le point de blocage pour chaque arrivée." /></span>} description="Repérez les intégrations qui avancent, celles qui bloquent et les dossiers à relancer avant prise de poste.">
        {loading ? (
          <ListSkeleton rows={4} />
        ) : error ? (
          <EmptyState
            icon={Workflow}
            title="Chargement impossible"
            description={error}
            actionLabel="Réessayer"
            onAction={load}
            compact
          />
        ) : onboarding.length ? (
          <div className="space-y-2">
            {onboarding.map((i) => (
              <div key={i.id} className="border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{i.employeeName || "Employé"}</div>
                  <div className="text-xs text-gray-500">Créé le {formatDate(i.createdAt)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{stepLabel(i.currentStep)}</Badge>
                  <Badge variant="outline">{i.status === "open" ? "Ouvert" : i.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Workflow}
            title="Aucun parcours d’intégration actif"
            description="Les prochains parcours d’intégration apparaîtront ici."
            compact
          />
        )}
      </SectionCard>

      <SectionCard title="Parcours de sortie" description="Sécurisez les départs en gardant visibles les validations, documents et restitutions encore attendues.">
        {loading ? (
          <ListSkeleton rows={4} />
        ) : error ? (
          <EmptyState
            icon={Workflow}
            title="Chargement impossible"
            description={error}
            actionLabel="Réessayer"
            onAction={load}
            compact
          />
        ) : offboarding.length ? (
          <div className="space-y-2">
            {offboarding.map((i) => (
              <div key={i.id} className="border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{i.employeeName || "Employé"}</div>
                  <div className="text-xs text-gray-500">Créé le {formatDate(i.createdAt)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{stepLabel(i.currentStep)}</Badge>
                  <Badge variant="outline">{i.status === "open" ? "Ouvert" : i.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Workflow}
            title="Aucun parcours de sortie actif"
            description="Les sorties collaborateurs à traiter apparaîtront ici."
            compact
          />
        )}
      </SectionCard>

      <SectionCard title="Tâches conformité" description="Regroupez ici les tâches qui exposent l’entreprise à un risque légal, documentaire ou de traçabilité.">
        {loading ? (
          <ListSkeleton rows={6} />
        ) : error ? (
          <EmptyState
            icon={Workflow}
            title="Chargement impossible"
            description={error}
            actionLabel="Réessayer"
            onAction={load}
            compact
          />
        ) : compliance.length ? (
          <div className="space-y-2">
            {compliance.map((i) => (
              <div key={i.id} className="border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{i.label}</div>
                  <div className="text-xs text-gray-500">{i.category || "—"} • échéance: {i.dueAt ? formatDate(i.dueAt) : "—"}</div>
                </div>
                <Badge variant="outline">{i.status}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Workflow}
            title="Aucune tâche de parcours"
            description="Les actions de conformité en cours apparaîtront ici."
            compact
          />
        )}
      </SectionCard>
    </div>
  );
}

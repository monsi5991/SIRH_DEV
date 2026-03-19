import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Home, TimerReset } from "lucide-react";
import useEmployeeDashboardData from "../../hooks/useEmployeeDashboardData";
import PageHeader from "../../components/common/PageHeader";
import SectionCard from "../../components/common/SectionCard";
import SectionHeader from "../../components/common/SectionHeader";
import ActionCard from "../../components/common/ActionCard";
import InfoBanner from "../../components/common/InfoBanner";
import { Button } from "../../components/ui/button";

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function EmployeeIndicatorsPage() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useEmployeeDashboardData();

  const missingDays = number(data?.timeToFill?.missingDays?.length);
  const openRequests = number(data?.myRequestsSummary?.totalOpen);
  const quickSummary = useMemo(
    () =>
      [
        missingDays > 0 ? `${missingDays} jour(s) à régulariser` : null,
        openRequests > 0 ? `${openRequests} demande(s) ouverte(s)` : null,
      ].filter(Boolean).join(" · "),
    [missingDays, openRequests]
  );

  if (loading && !data) {
    return <div className="p-6 text-sm text-slate-500">Chargement des indicateurs personnels…</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Mes indicateurs"
        description="Cette vue a été réduite au minimum pour éviter de dupliquer l'accueil employé."
        actions={(
          <>
            <Button variant="outline" onClick={reload}>Rafraîchir</Button>
            <Button onClick={() => navigate("/employee/dashboard")}>Retour à l'accueil</Button>
          </>
        )}
      />

      <InfoBanner
        tone="info"
        title="Vue secondaire de compatibilité"
        description={
          quickSummary || "L'accueil employé reste la page principale pour suivre vos priorités, demandes et échéances."
        }
      />

      {error ? (
        <InfoBanner tone="warning" title="Chargement partiel" description={error} />
      ) : null}

      <SectionCard>
        <SectionHeader
          title="Accès rapides"
          description="Les seuls raccourcis utiles ici, sans répéter le dashboard."
        />
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <ActionCard
            icon={Home}
            title="Revenir à l'accueil"
            description="Retrouvez la vue principale employé avec priorités, demandes récentes et événements."
            primaryActionLabel="Ouvrir l'accueil"
            onPrimaryAction={() => navigate("/employee/dashboard")}
            tone="success"
          />
          <ActionCard
            icon={TimerReset}
            title="Régulariser mes temps"
            description={missingDays ? `${missingDays} jour(s) nécessitent une action.` : "Aucune anomalie de temps visible actuellement."}
            primaryActionLabel="Ouvrir Temps & absences"
            onPrimaryAction={() => navigate("/employee/time")}
            tone={missingDays ? "warning" : "neutral"}
          />
          <ActionCard
            icon={ClipboardList}
            title="Suivre mes demandes"
            description={openRequests ? `${openRequests} demande(s) restent ouvertes.` : "Aucune demande ouverte à ce jour."}
            primaryActionLabel="Voir mes demandes"
            onPrimaryAction={() => navigate("/employee/requests")}
            tone={openRequests ? "info" : "neutral"}
          />
        </div>
      </SectionCard>
    </div>
  );
}

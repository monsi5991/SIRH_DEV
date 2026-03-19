import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpenCheck, BriefcaseBusiness, GraduationCap } from "lucide-react";
import { useApp } from "../../contexts/AppContext";
import useEmployeeDashboardData from "../../hooks/useEmployeeDashboardData";
import PageHeader from "../../components/common/PageHeader";
import SectionCard from "../../components/common/SectionCard";
import SectionHeader from "../../components/common/SectionHeader";
import SummaryCard from "../../components/common/SummaryCard";
import ActionCard from "../../components/common/ActionCard";
import KPIGrid from "../../components/common/KPIGrid";
import TimelineList from "../../components/common/TimelineList";
import InfoBanner from "../../components/common/InfoBanner";
import EmptyState from "../../components/common/EmptyState";
import { Button } from "../../components/ui/button";

export default function EmployeeTrainingsPage() {
  const navigate = useNavigate();
  const { formatDate } = useApp();
  const dashboard = useEmployeeDashboardData();

  const nextTraining = dashboard.data?.learningStatus?.nextPlannedTraining || null;
  const lastTraining = dashboard.data?.learningStatus?.lastCompletedTraining || null;
  const visibleMilestones = useMemo(
    () =>
      [
        nextTraining
          ? {
              id: `next-${nextTraining.id}`,
              title: nextTraining.title,
              description: "Prochaine formation planifiée",
              meta: nextTraining.sessionDate ? formatDate(nextTraining.sessionDate) : "Date à confirmer",
              status: "PENDING",
            }
          : null,
        lastTraining
          ? {
              id: `last-${lastTraining.id}`,
              title: lastTraining.title,
              description: "Dernière formation complétée",
              meta: lastTraining.completedAt ? formatDate(lastTraining.completedAt) : "Date non disponible",
              status: "APPROVED",
            }
          : null,
      ].filter(Boolean),
    [nextTraining, lastTraining, formatDate]
  );

  if (dashboard.loading && !dashboard.data) {
    return <div className="p-6 text-sm text-slate-500">Chargement de l'espace formation…</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Formation & carrière"
        description="Suivez vos prochaines formations et les actions de développement réellement visibles pour votre profil."
        actions={(
          <>
            <Button variant="outline" onClick={() => dashboard.reload()}>
              Rafraîchir
            </Button>
            <Button onClick={() => navigate("/employee/requests?service=general_support&new=1")}>
              Parler de mon développement
            </Button>
          </>
        )}
      />

      <InfoBanner
        tone="info"
        title="Catalogue learning non connecté"
        description="Cet espace présente d'abord les formations connues et des ressources recommandées. Aucun LMS complet n'est encore branché, donc nous évitons de présenter un faux catalogue."
      />

      {dashboard.error ? (
        <InfoBanner
          tone="warning"
          title="Chargement partiel"
          description={dashboard.error}
        />
      ) : null}

      <KPIGrid className="xl:grid-cols-2">
        <SummaryCard
          icon={GraduationCap}
          label="À suivre maintenant"
          value={nextTraining?.title || "Aucune session"}
          helper={nextTraining?.sessionDate ? `Prévue le ${formatDate(nextTraining.sessionDate)}` : "Aucune formation planifiée pour le moment"}
          tone="warning"
        />
        <SummaryCard
          icon={BookOpenCheck}
          label="Dernière formation"
          value={lastTraining?.title || "Aucune session suivie"}
          helper={lastTraining?.completedAt ? `Terminée le ${formatDate(lastTraining.completedAt)}` : "Aucun historique remonté"}
          tone="success"
        />
      </KPIGrid>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard>
          <SectionHeader
            title="À suivre maintenant"
            description="Votre prochaine étape concrète côté apprentissage ou développement."
          />
          <div className="mt-4">
            {nextTraining ? (
              <ActionCard
                icon={GraduationCap}
                title={nextTraining.title}
                description={nextTraining.sessionDate ? `Session prévue le ${formatDate(nextTraining.sessionDate)}.` : "Une prochaine session a été identifiée."}
                primaryActionLabel="Voir mes objectifs"
                onPrimaryAction={() => navigate("/employee/performance")}
                secondaryActionLabel="Ouvrir une demande"
                onSecondaryAction={() => navigate("/employee/requests?service=general_support&new=1")}
                tone="warning"
              />
            ) : (
              <EmptyState
                icon={GraduationCap}
                title="Aucune formation planifiée"
                description="Aucune session n'est remontée pour votre profil. Vous pouvez demander un accompagnement ou consulter les ressources recommandées."
                actionLabel="Ouvrir une demande"
                onAction={() => navigate("/employee/requests?service=general_support&new=1")}
                compact
              />
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Repères de développement"
          description="Les éléments réellement visibles dans votre espace aujourd'hui."
        >
          <div className="mt-4">
            <TimelineList
              items={visibleMilestones}
              emptyTitle="Aucun parcours visible"
              emptyDescription="Les parcours et sessions suivis seront listés ici dès qu'ils seront remontés par l'API learning."
            />
          </div>
        </SectionCard>
      </div>

      <InfoBanner
        tone="info"
        title="Ressources utiles centralisées"
        description="Les procédures et contenus d'information détaillés restent dans Aide RH pour éviter un doublon avec cet espace développement."
        action={<Button variant="outline" onClick={() => navigate("/employee/help")}>Voir Aide RH</Button>}
      />

      <SectionCard>
        <SectionHeader
          title="Mon développement"
          description="Actions rapides pour faire avancer vos sujets de carrière."
        />
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <ActionCard
            icon={BriefcaseBusiness}
            title="Suivre mes objectifs"
            description="Reliez vos apprentissages aux objectifs et aux entretiens en cours."
            primaryActionLabel="Ouvrir Performance"
            onPrimaryAction={() => navigate("/employee/performance")}
            tone="success"
          />
          <ActionCard
            icon={BookOpenCheck}
            title="Consulter l'aide"
            description="Parcourez les procédures et ressources utiles avant d'ouvrir une demande."
            primaryActionLabel="Voir Aide RH"
            onPrimaryAction={() => navigate("/employee/help")}
            tone="info"
          />
          <ActionCard
            icon={GraduationCap}
            title="Demander un accompagnement"
            description="Demandez un échange sur votre développement, une formation ou une évolution de parcours."
            primaryActionLabel="Nouvelle demande"
            onPrimaryAction={() => navigate("/employee/requests?service=general_support&new=1")}
            tone="warning"
          />
        </div>
      </SectionCard>
    </div>
  );
}

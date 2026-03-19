import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarClock,
  Target,
  TrendingUp,
} from "lucide-react";
import { useApp } from "../../contexts/AppContext";
import useEmployeeDashboardData from "../../hooks/useEmployeeDashboardData";
import PageHeader from "../../components/common/PageHeader";
import SectionCard from "../../components/common/SectionCard";
import SectionHeader from "../../components/common/SectionHeader";
import SummaryCard from "../../components/common/SummaryCard";
import ActionCard from "../../components/common/ActionCard";
import KPIGrid from "../../components/common/KPIGrid";
import InfoBanner from "../../components/common/InfoBanner";
import TimelineList from "../../components/common/TimelineList";
import EmptyState from "../../components/common/EmptyState";
import StatusBadge from "../../components/common/StatusBadge";
import { Button } from "../../components/ui/button";
import { Progress } from "../../components/ui/progress";

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function averageProgress(objectives) {
  if (!objectives.length) return 0;
  const total = objectives.reduce((sum, item) => sum + number(item.progressPercent), 0);
  return Math.round(total / objectives.length);
}

function daysUntil(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / 86400000);
}

export default function EmployeePerformancePage() {
  const navigate = useNavigate();
  const { formatDate } = useApp();
  const { data, loading, error, reload } = useEmployeeDashboardData();

  const objectives = useMemo(
    () => (Array.isArray(data?.myObjectivesShort) ? data.myObjectivesShort : []),
    [data]
  );
  const interviews = useMemo(
    () => (Array.isArray(data?.myUpcomingInterviews) ? data.myUpcomingInterviews : []),
    [data]
  );

  const progressAverage = useMemo(() => averageProgress(objectives), [objectives]);
  const nextInterview = interviews[0] || null;
  const objectivesSummary = data?.myObjectivesSummary || {};
  const prioritizedObjectives = useMemo(
    () =>
      [...objectives].sort((left, right) => {
        const leftStatus = String(left.status || "").toUpperCase();
        const rightStatus = String(right.status || "").toUpperCase();
        const leftRisk = leftStatus === "OFF_TRACK" ? 2 : number(left.progressPercent) === 0 ? 1 : 0;
        const rightRisk = rightStatus === "OFF_TRACK" ? 2 : number(right.progressPercent) === 0 ? 1 : 0;
        if (leftRisk !== rightRisk) return rightRisk - leftRisk;
        return daysUntil(left.dueDate) - daysUntil(right.dueDate);
      }),
    [objectives]
  );
  const focusObjectives = useMemo(
    () =>
      prioritizedObjectives.filter((item) => {
        const dueInDays = daysUntil(item.dueDate);
        const status = String(item.status || "").toUpperCase();
        return status === "OFF_TRACK" || number(item.progressPercent) === 0 || dueInDays <= 14;
      }).slice(0, 3),
    [prioritizedObjectives]
  );
  const nextActions = useMemo(() => {
    const actions = [];
    if (focusObjectives[0]) {
      const item = focusObjectives[0];
      actions.push({
        id: `objective-${item.id}`,
        title: "Objectif à sécuriser",
        description: item.title,
        helper:
          String(item.status || "").toUpperCase() === "OFF_TRACK"
            ? "Objectif en retard ou à risque"
            : number(item.progressPercent) === 0
            ? "Objectif non démarré"
            : "Échéance proche",
      });
    }
    if (nextInterview) {
      actions.push({
        id: `interview-${nextInterview.id}`,
        title: "Entretien à préparer",
        description: nextInterview.type || "Entretien",
        helper: nextInterview.scheduledAt ? `Prévu le ${formatDate(nextInterview.scheduledAt)}` : "Date à confirmer",
      });
    }
    if (!actions.length && objectives.length) {
      actions.push({
        id: "progress",
        title: "Progression à maintenir",
        description: `${progressAverage}% de progression moyenne`,
        helper: "Continuez à mettre à jour vos objectifs visibles",
      });
    }
    return actions.slice(0, 2);
  }, [focusObjectives, nextInterview, objectives.length, progressAverage, formatDate]);

  const interviewTimeline = useMemo(
    () =>
      interviews.map((item) => ({
        id: item.id,
        title: item.type || "Entretien",
        description: item.managerName ? `Avec ${item.managerName}` : "Entretien planifié",
        meta: item.scheduledAt ? formatDate(item.scheduledAt) : "Date à confirmer",
        status: item.status || "PENDING",
      })),
    [interviews, formatDate]
  );

  if (loading && !data) {
    return <div className="p-6 text-sm text-slate-500">Chargement du suivi performance…</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Performance & objectifs"
        description="Suivez vos objectifs, préparez vos entretiens et gardez une vue claire sur vos prochaines étapes."
        actions={<Button variant="outline" onClick={reload}>Rafraîchir</Button>}
      />

      {error ? (
        <InfoBanner tone="warning" title="Chargement partiel" description={error} />
      ) : null}

      {nextActions.length ? (
        <InfoBanner
          tone={focusObjectives.length ? "warning" : "info"}
          title="À préparer maintenant"
          description={nextActions.map((item) => `${item.title}: ${item.description}`).join(" · ")}
        />
      ) : null}

      <KPIGrid>
        <SummaryCard
          icon={Target}
          label="Objectifs actifs"
          value={number(objectivesSummary.total)}
          helper={`${number(objectivesSummary.onTrack)} en bonne voie · ${number(objectivesSummary.late)} à surveiller`}
          tone="success"
        />
        <SummaryCard
          icon={TrendingUp}
          label="Progression moyenne"
          value={`${progressAverage}%`}
          helper="Moyenne calculée sur vos objectifs visibles"
          tone="info"
        />
        <SummaryCard
          icon={CalendarClock}
          label="Prochain entretien"
          value={nextInterview?.scheduledAt ? formatDate(nextInterview.scheduledAt) : "Aucun planifié"}
          helper={nextInterview?.type || "Aucune échéance d'entretien remontée"}
          tone="warning"
        />
      </KPIGrid>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard>
          <SectionHeader
            title="Mes objectifs"
            description="Visualisez la progression, les échéances et les objectifs qui méritent une attention particulière."
          />
          <div className="mt-4 space-y-3">
            {prioritizedObjectives.length ? prioritizedObjectives.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-500">
                      {item.dueDate ? `Échéance ${formatDate(item.dueDate)}` : "Sans date de fin renseignée"}
                    </p>
                    {String(item.status || "").toUpperCase() === "OFF_TRACK" ? (
                      <p className="text-xs font-medium text-rose-700">À surveiller en priorité</p>
                    ) : number(item.progressPercent) === 0 ? (
                      <p className="text-xs font-medium text-amber-700">Pas encore démarré</p>
                    ) : daysUntil(item.dueDate) <= 14 ? (
                      <p className="text-xs font-medium text-amber-700">Échéance proche</p>
                    ) : null}
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Progression</span>
                    <span>{number(item.progressPercent)}%</span>
                  </div>
                  <Progress value={number(item.progressPercent)} className="h-2 bg-slate-100" />
                </div>
              </div>
            )) : (
              <EmptyState
                icon={Target}
                title="Aucun objectif actif"
                description="Vos objectifs apparaitront ici dès qu'un cycle sera publié pour votre profil."
                actionLabel="Besoin d'aide"
                onAction={() => navigate("/employee/help")}
                compact
              />
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Mes entretiens"
          description="Vos prochains rendez-vous et étapes de préparation."
        >
          <div className="mt-4">
            <TimelineList
              items={interviewTimeline}
              emptyTitle="Aucun entretien planifié"
              emptyDescription="Les prochains entretiens individuels et points d'étape seront listés ici."
            />
          </div>
        </SectionCard>
      </div>

      <SectionCard>
        <SectionHeader
          title="Plan d'action"
          description="Les prochaines actions utiles à partir de vos objectifs et de vos entretiens."
        />
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <ActionCard
            icon={CalendarClock}
            title="Préparer mon prochain entretien"
            description="Rassemblez vos points d'avancement, vos risques et vos besoins de soutien."
            primaryActionLabel="Demander un échange"
            onPrimaryAction={() => navigate("/employee/requests?service=general_support&new=1")}
            tone="warning"
          />
          <ActionCard
            icon={TrendingUp}
            title="Développer mes compétences"
            description="Consultez les ressources de formation et les pistes de développement disponibles."
            primaryActionLabel="Voir Formation & carrière"
            onPrimaryAction={() => navigate("/employee/trainings")}
            tone="info"
          />
        </div>
      </SectionCard>
    </div>
  );
}

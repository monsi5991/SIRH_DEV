import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  Rocket,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useApp } from "../../contexts/AppContext";
import { useAuth } from "../../contexts/AuthContext";
import useEmployeeDashboardData from "../../hooks/useEmployeeDashboardData";
import useEmployeeProfile from "../../hooks/useEmployeeProfile";
import useEmployeePayslips from "../../hooks/useEmployeePayslips";
import { Button } from "../../components/ui/button";
import PageHeader from "../../components/common/PageHeader";
import SectionCard from "../../components/common/SectionCard";
import SectionHeader from "../../components/common/SectionHeader";
import SummaryCard from "../../components/common/SummaryCard";
import ActionCard from "../../components/common/ActionCard";
import InfoBanner from "../../components/common/InfoBanner";
import KPIGrid from "../../components/common/KPIGrid";
import TimelineList from "../../components/common/TimelineList";
import EmptyState from "../../components/common/EmptyState";
import StatusBadge from "../../components/common/StatusBadge";

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function employeeContextText(profile) {
  const bits = [
    profile?.professional?.position,
    profile?.professional?.department,
  ].filter(Boolean);
  return bits.join(" · ");
}

export default function EmployeeDashboardPage() {
  const navigate = useNavigate();
  const { formatDate } = useApp();
  const { user } = useAuth();
  const dashboard = useEmployeeDashboardData();
  const profileState = useEmployeeProfile();
  const payslipsState = useEmployeePayslips({ auto: true });

  const latestPayslip = payslipsState.items?.[0] || null;

  const priorityCards = useMemo(() => {
    const items = [];
    const missingDays = dashboard.data?.timeToFill?.missingDays?.length || 0;
    const pendingDocs = dashboard.data?.pendingDocuments?.length || 0;
    const openRequests = dashboard.data?.myRequestsSummary?.totalOpen || 0;
    const completionPercent = number(profileState.meta.completionPercent);

    if (missingDays > 0) {
      items.push({
        id: "time",
        icon: Clock3,
        title: "Compléter mes temps",
        description: `${missingDays} jour(s) nécessitent encore une régularisation.`,
        primaryActionLabel: "Ouvrir Temps & absences",
        onPrimaryAction: () => navigate("/employee/time?tab=regularizations"),
        tone: "warning",
      });
    }
    if (completionPercent > 0 && completionPercent < 100) {
      items.push({
        id: "profile",
        icon: ShieldCheck,
        title: "Compléter mon profil",
        description: `Votre profil est complété à ${completionPercent}%. Quelques informations facilitent la paie et les démarches RH.`,
        primaryActionLabel: "Mettre à jour mon profil",
        onPrimaryAction: () => navigate("/employee/profile"),
        tone: "success",
      });
    }
    if (openRequests > 0) {
      items.push({
        id: "requests",
        icon: Rocket,
        title: "Suivre mes demandes ouvertes",
        description: `${openRequests} demande(s) sont toujours en traitement.`,
        primaryActionLabel: "Voir mes demandes",
        onPrimaryAction: () => navigate("/employee/requests"),
        tone: "neutral",
      });
    }
    if (pendingDocs > 0) {
      items.push({
        id: "documents",
        icon: FileText,
        title: "Lire mes documents à consulter",
        description: `${pendingDocs} politique(s) ou document(s) attendent encore votre attention.`,
        primaryActionLabel: "Ouvrir Aide RH",
        onPrimaryAction: () => navigate("/employee/help"),
        tone: "info",
      });
    }

    return items.slice(0, 3);
  }, [dashboard.data, navigate, profileState.meta.completionPercent]);

  const deadlines = useMemo(() => {
    const items = [];
    const interview = dashboard.data?.myUpcomingInterviews?.[0];
    const training = dashboard.data?.learningStatus?.nextPlannedTraining;
    const leave = dashboard.data?.upcomingLeaves?.[0];

    if (interview?.scheduledAt) {
      items.push({
        id: `interview-${interview.id}`,
        title: "Prochain entretien",
        description: interview.type || "Entretien",
        meta: formatDate(interview.scheduledAt),
        status: interview.status,
      });
    }
    if (training?.sessionDate) {
      items.push({
        id: `training-${training.id}`,
        title: "Prochaine formation",
        description: training.title,
        meta: formatDate(training.sessionDate),
        status: "PENDING",
      });
    }
    if (leave?.startDate) {
      items.push({
        id: `leave-${leave.id}`,
        title: "Prochaine absence",
        description: leave.leaveTypeLabel,
        meta: `${formatDate(leave.startDate)} - ${formatDate(leave.endDate)}`,
        status: leave.status,
      });
    }
    if (latestPayslip?.period) {
      items.push({
        id: `payslip-${latestPayslip.period}`,
        title: "Dernier bulletin publié",
        description: `Bulletin ${latestPayslip.period}`,
        meta: latestPayslip.createdAt ? formatDate(latestPayslip.createdAt) : "Disponible",
        status: "PAID",
      });
    }
    return items.slice(0, 3);
  }, [dashboard.data, latestPayslip, formatDate]);

  const requestTimeline = useMemo(
    () =>
      (dashboard.data?.recentRequests || []).slice(0, 3).map((request) => ({
        id: request.id,
        title: request.label,
        description: request.type,
        meta: request.createdAt ? formatDate(request.createdAt) : "",
        submeta: request.currentApproverName || "",
        status: request.status,
      })),
    [dashboard.data, formatDate]
  );

  const headlineEvent = deadlines[0] || null;

  if (dashboard.loading && !dashboard.data) {
    return <div className="p-6 text-sm text-slate-500">Chargement de votre espace employé…</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={`Bonjour ${user?.firstName || "dans votre espace RH"}`}
        description={
          employeeContextText(profileState.profile)
            ? `${employeeContextText(profileState.profile)} · Voici ce qui mérite votre attention aujourd'hui.`
            : "Voici les actions et échéances qui méritent votre attention aujourd'hui."
        }
      />

      {dashboard.error ? (
        <InfoBanner tone="warning" title="Chargement partiel" description={dashboard.error} />
      ) : null}

      <KPIGrid className="xl:grid-cols-3">
        <SummaryCard
          icon={Sparkles}
          label="Actions requises"
          value={priorityCards.length}
          helper="Tâches à traiter en priorité aujourd'hui"
          tone="warning"
        />
        <SummaryCard
          icon={FileText}
          label="Demandes ouvertes"
          value={number(dashboard.data?.myRequestsSummary?.totalOpen)}
          helper="Demandes encore en traitement"
          tone="info"
          action={<Button variant="ghost" size="sm" className="h-auto px-0 text-emerald-700" onClick={() => navigate("/employee/requests")}>Voir le suivi</Button>}
        />
        <SummaryCard
          icon={CalendarClock}
          label="Prochain événement"
          value={headlineEvent?.title || "Aucun"}
          helper={headlineEvent ? `${headlineEvent.description} · ${headlineEvent.meta}` : "Aucune échéance proche"}
          tone="success"
        />
      </KPIGrid>

      <SectionCard>
        <SectionHeader
          title="Mes actions prioritaires"
          description="Seulement les actions qui méritent une attention immédiate."
        />
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {priorityCards.length ? priorityCards.map((item) => (
            <ActionCard
              key={item.id}
              icon={item.icon}
              title={item.title}
              description={item.description}
              primaryActionLabel={item.primaryActionLabel}
              onPrimaryAction={item.onPrimaryAction}
              tone={item.tone}
            />
          )) : (
            <div className="md:col-span-3">
              <EmptyState
                icon={CheckCircle2}
                title="Aucune action urgente"
                description="Votre espace RH est à jour. Les éléments secondaires restent disponibles plus bas si besoin."
                compact
              />
            </div>
          )}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard
          title="Mes demandes récentes"
          description="Les dernières demandes utiles, sans afficher tout l'historique."
          actions={<Button variant="outline" size="sm" onClick={() => navigate("/employee/requests")}>Voir tout</Button>}
        >
          <div className="mt-4 space-y-3">
            {requestTimeline.length ? requestTimeline.map((request) => (
              <div key={request.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">{request.title}</p>
                    <p className="text-sm text-slate-600">{request.description}</p>
                    <p className="text-xs text-slate-500">{[request.meta, request.submeta].filter(Boolean).join(" · ")}</p>
                  </div>
                  <StatusBadge status={request.status} />
                </div>
              </div>
            )) : (
              <EmptyState
                icon={FileText}
                title="Aucune demande récente"
                description="Vos demandes en traitement apparaîtront ici."
                actionLabel="Ouvrir Mes demandes"
                onAction={() => navigate("/employee/requests")}
                compact
              />
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Mes prochains événements"
          description="Les échéances RH à venir, sans exposer tout le reste dès l'arrivée sur la page."
          actions={<Button variant="outline" size="sm" onClick={() => navigate("/employee/time")}>Voir le détail</Button>}
        >
          <div className="mt-4">
            <TimelineList
              items={deadlines}
              emptyTitle="Aucun événement proche"
              emptyDescription="Les prochains événements RH apparaitront ici."
            />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

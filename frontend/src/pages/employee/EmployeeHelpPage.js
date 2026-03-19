import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpenCheck, CircleHelp, LifeBuoy, Search, ShieldAlert } from "lucide-react";
import PageHeader from "../../components/common/PageHeader";
import SectionCard from "../../components/common/SectionCard";
import SectionHeader from "../../components/common/SectionHeader";
import ActionCard from "../../components/common/ActionCard";
import InfoBanner from "../../components/common/InfoBanner";
import EmptyState from "../../components/common/EmptyState";
import StatusBadge from "../../components/common/StatusBadge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import useEmployeeHelpResources from "../../hooks/useEmployeeHelpResources";
import useEmployeeProfile from "../../hooks/useEmployeeProfile";
import { acknowledgeEmployeePolicy } from "../../lib/employeeSelfApi";
import { HR_FAQ_ITEMS } from "./employeeSelfServiceConfig";
import { openSecureFileUrl } from "../../lib/secureFiles";
import { useToast } from "../../components/ui/use-toast";

export default function EmployeeHelpPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { policies, loading, error, reload } = useEmployeeHelpResources();
  const profileState = useEmployeeProfile();
  const [query, setQuery] = useState("");
  const [ackBusyId, setAckBusyId] = useState("");

  const filteredFaq = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return HR_FAQ_ITEMS;
    return HR_FAQ_ITEMS.filter((item) =>
      [item.question, item.answer].join(" ").toLowerCase().includes(normalized)
    );
  }, [query]);

  const filteredPolicies = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const items = policies.map((policy) => ({
      id: policy.id,
      title: policy.title,
      description: policy.category || "Politique RH",
      meta: policy.versions?.[0]?.language || "FR",
      url: policy.versions?.[0]?.fileUrl || null,
      acknowledgedAt: policy.currentEmployeeAcknowledgedAt || null,
      pendingAck: Boolean(policy.currentEmployeePendingAck),
    }));
    if (!normalized) return items.slice(0, 8);
    return items.filter((item) =>
      [item.title, item.description, item.meta].join(" ").toLowerCase().includes(normalized)
    );
  }, [policies, query]);

  const pendingPoliciesCount = useMemo(
    () => filteredPolicies.filter((item) => item.pendingAck).length,
    [filteredPolicies]
  );

  const handleAcknowledge = async (policyId) => {
    if (!profileState.meta.employeeId) {
      toast({
        title: "Compte incomplet",
        description: "Impossible de confirmer la lecture tant que votre compte n'est pas complètement relié.",
        variant: "destructive",
      });
      return;
    }

    setAckBusyId(policyId);
    try {
      await acknowledgeEmployeePolicy(policyId, profileState.meta.employeeId);
      await reload();
      window.dispatchEvent(new CustomEvent("app:counters:refresh"));
      toast({
        title: "Lecture confirmée",
        description: "Votre confirmation de lecture a bien été enregistrée.",
      });
    } catch (e) {
      toast({
        title: "Action impossible",
        description: e?.message || "La lecture n'a pas pu être confirmée.",
        variant: "destructive",
      });
    } finally {
      setAckBusyId("");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Aide RH"
        description="Le point d'entrée unique pour les réponses, les procédures utiles et les documents d'information visibles pour votre profil."
        actions={<Button variant="outline" onClick={reload}>Rafraîchir</Button>}
      />

      <InfoBanner
        tone="info"
        title="Le centre d'aide"
        description={
          pendingPoliciesCount > 0
            ? `${pendingPoliciesCount} document(s) attendent encore votre confirmation de lecture.`
            : "Commencez ici pour retrouver FAQ, procédures et documents utiles avant d'ouvrir une demande."
        }
      />

      <SectionCard>
        <SectionHeader
          title="Rechercher une réponse ou une procédure"
          description="Cherchez une règle, une politique ou une réponse rapide avant d'ouvrir une demande."
        />
        <div className="mt-4 relative max-w-2xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex. bulletin, congés, attestation, pointage"
            className="pl-10"
          />
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionCard
          title="FAQ RH"
          description="Réponses rapides aux questions les plus fréquentes."
        >
          <div className="mt-4 space-y-3">
            {filteredFaq.length ? filteredFaq.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">{item.question}</p>
                <p className="mt-2 text-sm text-slate-600">{item.answer}</p>
              </div>
            )) : (
              <EmptyState
                icon={CircleHelp}
                title="Aucune réponse trouvée"
                description="Essayez avec d'autres mots-clés ou ouvrez une demande."
                actionLabel="Ouvrir une demande"
                onAction={() => navigate("/employee/requests?new=1")}
                compact
              />
            )}
          </div>
        </SectionCard>

        <div className="space-y-4">
          <ActionCard
            icon={LifeBuoy}
            title="Contacter l'équipe RH"
            description="Si la FAQ et les procédures ne suffisent pas, ouvrez une demande pour suivre simplement son avancement."
            primaryActionLabel="Nouvelle demande"
            onPrimaryAction={() => navigate("/employee/requests?new=1")}
            secondaryActionLabel="Voir mes demandes"
            onSecondaryAction={() => navigate("/employee/requests")}
            tone="success"
          />

          <ActionCard
            icon={ShieldAlert}
            title="Urgence ou incident"
            description="En cas de sujet sensible ou urgent lié à la paie, au contrat ou à un incident, utilisez le formulaire de demande et précisez le contexte."
            primaryActionLabel="Signaler un incident"
            onPrimaryAction={() => navigate("/employee/requests?new=1&service=general_support")}
            tone="warning"
          />
        </div>
      </div>

      <SectionCard
        title="Documents à lire & procédures"
        description="Les politiques et procédures sont regroupées ici pour éviter leur dispersion dans plusieurs pages."
      >
        {error ? (
          <InfoBanner
            tone="warning"
            title="Ressources momentanément indisponibles"
            description={error}
          />
        ) : null}

        {!error && !loading ? (
          filteredPolicies.length ? (
            <div className="space-y-3">
              {filteredPolicies.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <StatusBadge
                          status={item.pendingAck ? "PENDING" : "APPROVED"}
                          label={item.pendingAck ? "À lire" : "Lu"}
                        />
                      </div>
                      <p className="text-sm text-slate-600">{item.description}</p>
                      <p className="text-xs text-slate-500">{item.meta}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.url ? (
                        <Button variant="outline" size="sm" onClick={() => openSecureFileUrl(item.url)}>
                          Ouvrir
                        </Button>
                      ) : null}
                      {item.pendingAck ? (
                        <Button size="sm" disabled={ackBusyId === item.id} onClick={() => handleAcknowledge(item.id)}>
                          {ackBusyId === item.id ? "Enregistrement…" : "Confirmer la lecture"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={BookOpenCheck}
              title="Aucune ressource publiée"
              description="Les politiques et procédures utiles seront listées ici."
              compact
            />
          )
        ) : (
          <div className="text-sm text-slate-500">Chargement des ressources…</div>
        )}
      </SectionCard>

      <SectionCard
        title="Situations fréquentes"
        description="Raccourcis utiles pour gagner du temps dans les démarches les plus courantes."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <ActionCard
            icon={BookOpenCheck}
            title="Comprendre mon bulletin"
            description="Accéder à la paie, télécharger le dernier bulletin et consulter les explications principales."
            primaryActionLabel="Ouvrir la paie"
            onPrimaryAction={() => navigate("/employee/pay-documents?tab=payroll")}
          />
          <ActionCard
            icon={CircleHelp}
            title="Mettre à jour mes données"
            description="Coordonnées, informations bancaires et contacts d'urgence."
            primaryActionLabel="Mettre à jour mon profil"
            onPrimaryAction={() => navigate("/employee/profile")}
          />
          <ActionCard
            icon={LifeBuoy}
            title="Suivre une demande"
            description="Vérifier l'avancement de vos demandes."
            primaryActionLabel="Voir mes demandes"
            onPrimaryAction={() => navigate("/employee/requests")}
          />
        </div>
      </SectionCard>
    </div>
  );
}

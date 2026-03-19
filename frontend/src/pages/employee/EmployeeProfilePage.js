import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Save, UserRound } from "lucide-react";
import { useApp } from "../../contexts/AppContext";
import { useAuth } from "../../contexts/AuthContext";
import PageHeader from "../../components/common/PageHeader";
import SectionCard from "../../components/common/SectionCard";
import SectionHeader from "../../components/common/SectionHeader";
import InfoBanner from "../../components/common/InfoBanner";
import ProfileCompletionCard from "../../components/common/ProfileCompletionCard";
import EmptyState from "../../components/common/EmptyState";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../components/ui/accordion";
import useEmployeeProfile from "../../hooks/useEmployeeProfile";
import { useToast } from "../../components/ui/use-toast";

const EDIT_MODE_LABELS = {
  editable: "Modifiable directement",
  review: "Modifiable directement",
  readonly: "Lecture seule",
};

const EDIT_MODE_CLASSES = {
  editable: "border-emerald-200 bg-emerald-50 text-emerald-700",
  review: "border-emerald-200 bg-emerald-50 text-emerald-700",
  readonly: "border-slate-200 bg-slate-100 text-slate-600",
};

function sectionValues(profile) {
  return {
    personal: {
      firstName: profile?.personal?.firstName || "",
      lastName: profile?.personal?.lastName || "",
      phone: profile?.personal?.phone || "",
      country: profile?.personal?.country || "",
      birthDate: profile?.personal?.birthDate || "",
      nationality: profile?.personal?.nationality || "",
      familyStatus: profile?.personal?.familyStatus || "",
      dependants: profile?.personal?.dependants ?? "",
      addressPersonal: profile?.personal?.addressPersonal || "",
    },
    professional: {
      phoneWhatsApp: profile?.professional?.phoneWhatsApp || "",
      addressWork: profile?.professional?.addressWork || "",
    },
    payment: {
      bankName: profile?.payment?.bankName || "",
      bankIban: profile?.payment?.bankIban || "",
      bankAccount: profile?.payment?.bankAccount || "",
      mobileMoneyProvider: profile?.payment?.mobileMoneyProvider || "",
      mobileMoneyNumber: profile?.payment?.mobileMoneyNumber || "",
    },
    emergency: {
      emergencyName: profile?.emergency?.emergencyName || "",
      emergencyPhone: profile?.emergency?.emergencyPhone || "",
      emergencyRelation: profile?.emergency?.emergencyRelation || "",
    },
  };
}

function validateSection(section, values) {
  const errors = {};

  if (section === "personal") {
    if (!String(values.firstName || "").trim()) errors.firstName = "Le prénom est requis.";
    if (!String(values.lastName || "").trim()) errors.lastName = "Le nom est requis.";
    if (values.birthDate && Number.isNaN(new Date(values.birthDate).getTime())) {
      errors.birthDate = "Date de naissance invalide.";
    }
    if (values.dependants !== "" && Number(values.dependants) < 0) {
      errors.dependants = "Le nombre doit être positif.";
    }
  }

  if (section === "payment") {
    if (values.bankIban && String(values.bankIban).trim().length < 5) {
      errors.bankIban = "Référence bancaire trop courte.";
    }
    if (values.mobileMoneyNumber && String(values.mobileMoneyNumber).trim().length < 6) {
      errors.mobileMoneyNumber = "Numéro Mobile Money trop court.";
    }
  }

  if (section === "emergency") {
    const hasEmergencyData =
      String(values.emergencyName || "").trim() ||
      String(values.emergencyPhone || "").trim() ||
      String(values.emergencyRelation || "").trim();
    if (hasEmergencyData && !String(values.emergencyPhone || "").trim()) {
      errors.emergencyPhone = "Le téléphone du contact d'urgence est requis.";
    }
  }

  return errors;
}

function FieldLabel({ label, mode }) {
  return (
    <div className="mb-1 flex flex-wrap items-center gap-2">
      <Label>{label}</Label>
      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${EDIT_MODE_CLASSES[mode] || EDIT_MODE_CLASSES.readonly}`}>
        {EDIT_MODE_LABELS[mode] || EDIT_MODE_LABELS.readonly}
      </span>
    </div>
  );
}

function FieldError({ error }) {
  if (!error) return null;
  return <p className="mt-1 text-xs text-rose-600">{error}</p>;
}

export default function EmployeeProfilePage() {
  const navigate = useNavigate();
  const { formatDate } = useApp();
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const profileState = useEmployeeProfile();
  const canEdit = hasPermission("self_write") || hasPermission("self_update") || hasPermission("all");
  const [activeTab, setActiveTab] = useState("personal");
  const [forms, setForms] = useState(sectionValues(null));
  const [sectionErrors, setSectionErrors] = useState({
    personal: {},
    professional: {},
    payment: {},
    emergency: {},
  });

  const serverValues = useMemo(() => sectionValues(profileState.profile), [profileState.profile]);

  useEffect(() => {
    setForms(serverValues);
  }, [serverValues]);

  const dirtySections = useMemo(
    () => ({
      personal: JSON.stringify(forms.personal) !== JSON.stringify(serverValues.personal),
      professional: JSON.stringify(forms.professional) !== JSON.stringify(serverValues.professional),
      payment: JSON.stringify(forms.payment) !== JSON.stringify(serverValues.payment),
      emergency: JSON.stringify(forms.emergency) !== JSON.stringify(serverValues.emergency),
    }),
    [forms, serverValues]
  );

  const updateField = (section, field, value) => {
    profileState.clearMessages();
    setForms((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
    setSectionErrors((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: "",
      },
    }));
  };

  const saveSection = async (section) => {
    const nextErrors = validateSection(section, forms[section]);
    setSectionErrors((prev) => ({ ...prev, [section]: nextErrors }));
    if (Object.keys(nextErrors).length) return;

    try {
      await profileState.saveSection(section, forms[section]);
      toast({
        title: "Profil mis à jour",
        description: "Les informations de cette section ont été enregistrées.",
      });
    } catch (e) {
      toast({
        title: "Sauvegarde impossible",
        description: e?.message || "La section n'a pas pu être enregistrée.",
        variant: "destructive",
      });
    }
  };

  if (profileState.loading && !profileState.profile) {
    return <div className="p-6 text-sm text-slate-500">Chargement de votre profil…</div>;
  }

  if (!profileState.profile) {
    return (
      <div className="p-6">
        <EmptyState
          icon={UserRound}
          title="Profil indisponible"
          description={profileState.error || "Votre compte n'est pas encore complètement relié à vos informations personnelles."}
          actionLabel="Demander de l'aide"
          onAction={() => navigate("/employee/requests?service=data_change&new=1")}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Mon profil"
        description="Vérifiez et mettez à jour les informations utiles à votre paie, à vos démarches et aux situations d'urgence."
      />

      {!canEdit ? (
        <InfoBanner
          tone="warning"
          title="Mode lecture seule"
          description="Votre profil est visible mais les mises à jour directes ne sont pas autorisées pour votre compte."
        />
      ) : null}

      {profileState.error ? (
        <InfoBanner tone="warning" title="Dernière opération incomplète" description={profileState.error} />
      ) : null}
      {profileState.success ? (
        <InfoBanner tone="success" title="Sauvegarde réussie" description={profileState.success} />
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <ProfileCompletionCard
          percent={Number(profileState.meta.completionPercent || 0)}
          missingFields={profileState.meta.missingFields || []}
          lastUpdatedAt={profileState.meta.lastUpdatedAt ? formatDate(profileState.meta.lastUpdatedAt) : ""}
          onPrimaryAction={() => setActiveTab("personal")}
        />

        <InfoBanner
          tone="info"
          title="Mise à jour directe"
          description="Les sections modifiables sont enregistrées immédiatement. Si une information ne peut pas être changée ici, vous pouvez demander une correction."
          action={
            <Button variant="outline" onClick={() => navigate("/employee/requests?service=data_change&new=1")}>
              Demander une correction
            </Button>
          }
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex h-auto flex-wrap gap-2 rounded-2xl bg-slate-100 p-2">
          <TabsTrigger value="personal">Informations personnelles</TabsTrigger>
          <TabsTrigger value="professional">Coordonnées professionnelles</TabsTrigger>
          <TabsTrigger value="employment">Emploi & contrat</TabsTrigger>
          <TabsTrigger value="payment">Banque & paiement</TabsTrigger>
          <TabsTrigger value="emergency">Contacts d'urgence</TabsTrigger>
          <TabsTrigger value="administrative">Pièces administratives</TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <SectionCard>
            <SectionHeader
              title="Informations personnelles"
              description="Commencez par les informations de contact réellement utiles au quotidien."
              actions={canEdit ? (
                <Button
                  onClick={() => saveSection("personal")}
                  disabled={!dirtySections.personal || profileState.savingSection === "personal"}
                >
                  <Save className="h-4 w-4" />
                  {profileState.savingSection === "personal" ? "Enregistrement…" : "Enregistrer"}
                </Button>
              ) : null}
            />

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <FieldLabel label="Prénom" mode="editable" />
                <Input value={forms.personal.firstName} onChange={(e) => updateField("personal", "firstName", e.target.value)} disabled={!canEdit} />
                <FieldError error={sectionErrors.personal.firstName} />
              </div>
              <div>
                <FieldLabel label="Nom" mode="editable" />
                <Input value={forms.personal.lastName} onChange={(e) => updateField("personal", "lastName", e.target.value)} disabled={!canEdit} />
                <FieldError error={sectionErrors.personal.lastName} />
              </div>
              <div>
                <FieldLabel label="Téléphone personnel" mode="editable" />
                <Input value={forms.personal.phone} onChange={(e) => updateField("personal", "phone", e.target.value)} disabled={!canEdit} />
              </div>
              <div className="md:col-span-2">
                <FieldLabel label="Adresse personnelle" mode="review" />
                <Textarea rows={4} value={forms.personal.addressPersonal} onChange={(e) => updateField("personal", "addressPersonal", e.target.value)} disabled={!canEdit} />
              </div>
            </div>

            <Accordion type="single" collapsible className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4">
              <AccordionItem value="personal-details" className="border-b-0">
                <AccordionTrigger className="py-4 text-sm font-semibold text-slate-900 hover:no-underline">
                  Informations complémentaires
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <FieldLabel label="Pays / nationalité principale" mode="review" />
                      <Input value={forms.personal.country} onChange={(e) => updateField("personal", "country", e.target.value)} disabled={!canEdit} />
                    </div>
                    <div>
                      <FieldLabel label="Date de naissance" mode="review" />
                      <Input type="date" value={forms.personal.birthDate} onChange={(e) => updateField("personal", "birthDate", e.target.value)} disabled={!canEdit} />
                      <FieldError error={sectionErrors.personal.birthDate} />
                    </div>
                    <div>
                      <FieldLabel label="Nationalité" mode="review" />
                      <Input value={forms.personal.nationality} onChange={(e) => updateField("personal", "nationality", e.target.value)} disabled={!canEdit} />
                    </div>
                    <div>
                      <FieldLabel label="Situation familiale" mode="review" />
                      <Input value={forms.personal.familyStatus} onChange={(e) => updateField("personal", "familyStatus", e.target.value)} disabled={!canEdit} />
                    </div>
                    <div>
                      <FieldLabel label="Personnes à charge" mode="review" />
                      <Input type="number" min="0" value={forms.personal.dependants} onChange={(e) => updateField("personal", "dependants", e.target.value)} disabled={!canEdit} />
                      <FieldError error={sectionErrors.personal.dependants} />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </SectionCard>
        </TabsContent>

        <TabsContent value="professional">
          <SectionCard>
            <SectionHeader
              title="Coordonnées professionnelles"
              description="Les informations de contact utiles en premier, puis l'organisation en lecture simple."
              actions={canEdit ? (
                <Button
                  onClick={() => saveSection("professional")}
                  disabled={!dirtySections.professional || profileState.savingSection === "professional"}
                >
                  <Save className="h-4 w-4" />
                  {profileState.savingSection === "professional" ? "Enregistrement…" : "Enregistrer"}
                </Button>
              ) : null}
            />

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <FieldLabel label="Email professionnel" mode="readonly" />
                <Input value={profileState.profile.professional.email || ""} disabled />
              </div>
              <div>
                <FieldLabel label="WhatsApp professionnel" mode="review" />
                <Input value={forms.professional.phoneWhatsApp} onChange={(e) => updateField("professional", "phoneWhatsApp", e.target.value)} disabled={!canEdit} />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Département", value: profileState.profile.professional.department || "Non renseigné" },
                { label: "Site", value: profileState.profile.professional.site || "Non renseigné" },
                { label: "Poste", value: profileState.profile.professional.position || "Non renseigné" },
                { label: "Responsable", value: profileState.profile.professional.managerName || "Non renseigné" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{item.label}</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>

            <Accordion type="single" collapsible className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4">
              <AccordionItem value="professional-details" className="border-b-0">
                <AccordionTrigger className="py-4 text-sm font-semibold text-slate-900 hover:no-underline">
                  Localisation professionnelle
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-1">
                    <FieldLabel label="Adresse de travail / localisation" mode="review" />
                    <Textarea rows={4} value={forms.professional.addressWork} onChange={(e) => updateField("professional", "addressWork", e.target.value)} disabled={!canEdit} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </SectionCard>
        </TabsContent>

        <TabsContent value="employment">
          <SectionCard>
            <SectionHeader
              title="Emploi & contrat"
              description="Les données contractuelles sont affichées ici en lecture seule."
            />

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              {[
                { label: "Statut", value: profileState.profile.employment.status || "Non renseigné" },
                { label: "Type de contrat", value: profileState.profile.employment.contractType || "Non renseigné" },
                { label: "Matricule interne", value: profileState.profile.employment.internalMatricule || "Non renseigné" },
                { label: "Date d'entrée", value: profileState.profile.employment.joinDate ? formatDate(profileState.profile.employment.joinDate) : "Non renseignée" },
                { label: "Date de fin", value: profileState.profile.employment.endDate ? formatDate(profileState.profile.employment.endDate) : "Non renseignée" },
                { label: "Organisation", value: profileState.profile.professional.department || "Non renseignée" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{item.label}</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>

            <InfoBanner
              className="mt-4"
              tone="warning"
              title="Besoin de corriger une donnée contractuelle ?"
              description="Les modifications de contrat, poste, site ou statut doivent passer par une demande de correction."
              action={<Button variant="outline" onClick={() => navigate("/employee/requests?service=contract_question&new=1")}>Créer une demande</Button>}
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="payment">
          <SectionCard>
            <SectionHeader
              title="Banque & paiement"
              description="Montrez d'abord le canal de paiement principal, puis les références détaillées si nécessaire."
              actions={canEdit ? (
                <Button
                  onClick={() => saveSection("payment")}
                  disabled={!dirtySections.payment || profileState.savingSection === "payment"}
                >
                  <Save className="h-4 w-4" />
                  {profileState.savingSection === "payment" ? "Enregistrement…" : "Enregistrer"}
                </Button>
              ) : null}
            />

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <FieldLabel label="Banque" mode="editable" />
                <Input value={forms.payment.bankName} onChange={(e) => updateField("payment", "bankName", e.target.value)} disabled={!canEdit} />
              </div>
              <div>
                <FieldLabel label="Opérateur Mobile Money" mode="editable" />
                <Input value={forms.payment.mobileMoneyProvider} onChange={(e) => updateField("payment", "mobileMoneyProvider", e.target.value)} disabled={!canEdit} />
              </div>
              <div>
                <FieldLabel label="Numéro Mobile Money" mode="editable" />
                <Input value={forms.payment.mobileMoneyNumber} onChange={(e) => updateField("payment", "mobileMoneyNumber", e.target.value)} disabled={!canEdit} />
                <FieldError error={sectionErrors.payment.mobileMoneyNumber} />
              </div>
            </div>

            <Accordion type="single" collapsible className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4">
              <AccordionItem value="payment-details" className="border-b-0">
                <AccordionTrigger className="py-4 text-sm font-semibold text-slate-900 hover:no-underline">
                  Références bancaires détaillées
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <FieldLabel label="IBAN / RIB" mode="review" />
                      <Input value={forms.payment.bankIban} onChange={(e) => updateField("payment", "bankIban", e.target.value)} disabled={!canEdit} />
                      <FieldError error={sectionErrors.payment.bankIban} />
                    </div>
                    <div>
                      <FieldLabel label="Compte bancaire" mode="review" />
                      <Input value={forms.payment.bankAccount} onChange={(e) => updateField("payment", "bankAccount", e.target.value)} disabled={!canEdit} />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </SectionCard>
        </TabsContent>

        <TabsContent value="emergency">
          <SectionCard>
            <SectionHeader
              title="Contacts d'urgence"
              description="À renseigner pour accélérer le traitement en cas de situation critique."
              actions={canEdit ? (
                <Button
                  onClick={() => saveSection("emergency")}
                  disabled={!dirtySections.emergency || profileState.savingSection === "emergency"}
                >
                  <Save className="h-4 w-4" />
                  {profileState.savingSection === "emergency" ? "Enregistrement…" : "Enregistrer"}
                </Button>
              ) : null}
            />

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <FieldLabel label="Nom du contact" mode="editable" />
                <Input value={forms.emergency.emergencyName} onChange={(e) => updateField("emergency", "emergencyName", e.target.value)} disabled={!canEdit} />
              </div>
              <div>
                <FieldLabel label="Téléphone" mode="editable" />
                <Input value={forms.emergency.emergencyPhone} onChange={(e) => updateField("emergency", "emergencyPhone", e.target.value)} disabled={!canEdit} />
                <FieldError error={sectionErrors.emergency.emergencyPhone} />
              </div>
              <div>
                <FieldLabel label="Lien avec vous" mode="editable" />
                <Input value={forms.emergency.emergencyRelation} onChange={(e) => updateField("emergency", "emergencyRelation", e.target.value)} disabled={!canEdit} />
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="administrative">
          <SectionCard>
            <SectionHeader
              title="Pièces administratives"
              description="Références administratives utiles. Les documents sont centralisés dans Paie & documents."
            />

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">CNSS</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{profileState.profile.administrative.cnss || "Non renseigné"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">IPRES</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{profileState.profile.administrative.ipres || "Non renseigné"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Dernière mise à jour</p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {profileState.meta.lastUpdatedAt ? formatDate(profileState.meta.lastUpdatedAt) : "Inconnue"}
                </p>
              </div>
            </div>

            <InfoBanner
              className="mt-4"
              tone="info"
              title="Documents déplacés dans un espace dédié"
              description={`${profileState.profile.administrative.documents?.length || 0} document(s) administratif(s) sont disponibles dans Paie & documents pour éviter de surcharger votre profil.`}
              action={<Button variant="outline" onClick={() => navigate("/employee/pay-documents?tab=documents")}>Voir mes documents</Button>}
            />
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

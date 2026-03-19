// frontend/src/pages/documents/OnboardingPage.js
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import { Users, Plus, Rocket, DownloadCloud, ListChecks } from "lucide-react";

import TemplatePicker from "../../components/documents/TemplatePicker";
import WorkflowStepper from "../../components/documents/WorkflowStepper";
import Checklist from "../../components/documents/Checklist";
import EmployeeIdentityForm from "../../components/documents/EmployeeIdentityForm";
import { z } from "zod";

import { listOnboarding, startOnboarding } from "../../lib/documentsApi";
import usePageMeta from "../../hooks/usePageMeta";

const STEPS = [
  { key: "collect", label: "Infos collaborateur" },
  { key: "generate", label: "Génération documents" },
  { key: "sign", label: "Signature (OTP)" },
  { key: "files", label: "Collecte pièces" },
  { key: "register", label: "Registre & Déclarations" },
  { key: "archive", label: "Archivage" },
];

export default function OnboardingPage() {
  usePageMeta("Parcours d’intégration", "Démarrez et suivez les intégrations salariés avec documents, pièces et étapes clés.");
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [creating, setCreating] = useState(false);

  const [employee, setEmployee] = useState({
    firstName: "",
    lastName: "",
    email: "",
    manager: "",
    position: "",
  });

  const [selectedTemplates, setSelectedTemplates] = useState([]);

  const [checklist, setChecklist] = useState([
    { key: "social", label: "Affiliation organisme social préparée", hint: "Selon le pays et le statut du salarié", done: false },
    { key: "pension", label: "Affiliation retraite / pension préparée", done: false },
    { key: "rib", label: "Coordonnées bancaires ou Mobile Money récupérées", done: false },
    { key: "id", label: "Pièce d’identité collectée", done: false },
    { key: "charte", label: "Charte IT signée", done: false },
  ]);

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await listOnboarding({ status: "open" });
      // backend -> { items: [...] }
      setCases(res?.items || []);
    } catch (e) {
      setErr(e?.message || "Erreur chargement des dossiers");
      setCases([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const EmployeeSchema = z.object({
    firstName: z.string().min(2, "Prénom requis"),
    lastName: z.string().min(2, "Nom requis"),
    email: z.string().email("Email invalide"),
    position: z.string().optional(),
    manager: z.string().optional(),
  });

  const start = async () => {
    const parsedEmployee = EmployeeSchema.safeParse(employee);
    if (!parsedEmployee.success) {
      toast.error(parsedEmployee.error.issues[0]?.message || "Formulaire employé invalide");
      return;
    }
    if (!selectedTemplates.length) {
      toast.error("Sélectionnez au moins un modèle");
      return;
    }

    setCreating(true);
    try {
      const payload = {
        employee,
        templates: selectedTemplates,
        checklist: checklist.map(({ key, done, label, hint }) => ({
          key,
          done,
          ...(label ? { label } : {}),
          ...(hint ? { hint } : {}),
        })),
      };

      await startOnboarding(payload);

      toast.success("Parcours d’intégration créé");
      window.dispatchEvent(new Event("app:counters:refresh"));
      window.dispatchEvent(new Event("documents:changed"));

      setEmployee({ firstName: "", lastName: "", email: "", manager: "", position: "" });
      setSelectedTemplates([]);
      setChecklist((prev) => prev.map((i) => ({ ...i, done: false })));

      await load();
    } catch (e) {
      toast.error(e?.message || "Échec création");
    } finally {
      setCreating(false);
    }
  };

  const toggleChecklist = (it) => {
    setChecklist((prev) =>
      prev.map((x) => (x.key === it.key ? { ...x, done: !x.done } : x))
    );
  };

  const onboardingOpen = useMemo(
    () => cases.filter((c) => c.status !== "closed"),
    [cases]
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Parcours d’intégration</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load}>
            <DownloadCloud className="w-4 h-4 mr-2" /> Rafraîchir
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 text-sm text-gray-700">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4" />
            <span>
              Base d’intégration prête pour l’Afrique de l’Ouest francophone : contrat, affiliations sociales, registre du personnel, matériel et signatures.
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5" /> Ouvrir un parcours d’intégration
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <EmployeeIdentityForm employee={employee} setEmployee={setEmployee} extraField={{ key: "position", label: "Poste" }} />

          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">Modèles de documents</div>
            <TemplatePicker scope="onboarding" value={selectedTemplates} onChange={setSelectedTemplates} />
          </div>

          <Checklist title="Check-list de conformité" items={checklist} onToggle={toggleChecklist} />

          <div className="flex justify-end">
            <Button onClick={start} disabled={creating} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" /> Créer le dossier
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" /> Dossiers ouverts
          </CardTitle>
        </CardHeader>

        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-500">Chargement…</p>
          ) : err ? (
            <p className="text-sm text-red-600">{err}</p>
          ) : onboardingOpen.length ? (
            <div className="space-y-3">
              {onboardingOpen.map((c) => {
                const idx = Math.max(0, STEPS.findIndex((s) => s.key === c.currentStep));
                return (
                  <div key={c.id} className="border rounded-lg p-4 hover:shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">
                          {c.employee?.firstName} {c.employee?.lastName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {c.employee?.email} • {c.employee?.position || "—"}
                        </div>
                      </div>
                      <Badge className="bg-blue-50 text-blue-700 border border-blue-200">
                        {`${idx + 1}/${STEPS.length}`}
                      </Badge>
                    </div>
                    <div className="mt-3">
                      <WorkflowStepper steps={STEPS} current={idx < 0 ? 0 : idx} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Aucun parcours d’intégration en cours.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

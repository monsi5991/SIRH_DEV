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

import { listOnboarding, startOnboarding } from "../../lib/documentsApi";

const STEPS = [
  { key: "collect", label: "Infos collaborateur" },
  { key: "generate", label: "Génération documents" },
  { key: "sign", label: "Signature (OTP)" },
  { key: "files", label: "Collecte pièces" },
  { key: "register", label: "Registre & Déclarations" },
  { key: "archive", label: "Archivage" },
];

export default function OnboardingPage() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [creating, setCreating] = useState(false);

  const [employee, setEmployee] = useState({
    firstName: "",
    lastName: "",
    email: "",
    position: "",
  });

  const [selectedTemplates, setSelectedTemplates] = useState([]);

  const [checklist, setChecklist] = useState([
    { key: "ipres", label: "Formulaire affiliation IPRES", hint: "Impression ou signature si dispo", done: false },
    { key: "css", label: "Formulaire affiliation CSS", done: false },
    { key: "rib", label: "RIB récupéré", done: false },
    { key: "id", label: "CNI/Passport collecté", done: false },
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

  const start = async () => {
    if (!employee.firstName || !employee.lastName || !employee.email) {
      toast.error("Veuillez renseigner nom, prénom, email");
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

      toast.success("Dossier d’onboarding créé");
      window.dispatchEvent(new Event("app:counters:refresh"));
      window.dispatchEvent(new Event("documents:changed"));

      setEmployee({ firstName: "", lastName: "", email: "", position: "" });
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
        <h1 className="text-2xl font-bold text-gray-900">Onboarding Sénégal</h1>
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
              Pack Sénégal : Contrat, IPRES, CSS, registre du personnel, check-list matériel, OTP pour signatures.
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5" /> Démarrer un onboarding
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-sm text-gray-600">Prénom *</label>
              <input
                className="w-full mt-1 border rounded-lg px-3 py-2"
                value={employee.firstName}
                onChange={(e) => setEmployee((s) => ({ ...s, firstName: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm text-gray-600">Nom *</label>
              <input
                className="w-full mt-1 border rounded-lg px-3 py-2"
                value={employee.lastName}
                onChange={(e) => setEmployee((s) => ({ ...s, lastName: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm text-gray-600">Email *</label>
              <input
                className="w-full mt-1 border rounded-lg px-3 py-2"
                type="email"
                value={employee.email}
                onChange={(e) => setEmployee((s) => ({ ...s, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm text-gray-600">Poste</label>
              <input
                className="w-full mt-1 border rounded-lg px-3 py-2"
                value={employee.position}
                onChange={(e) => setEmployee((s) => ({ ...s, position: e.target.value }))}
              />
            </div>
          </div>

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
            <p className="text-sm text-gray-500">Aucun dossier en cours.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

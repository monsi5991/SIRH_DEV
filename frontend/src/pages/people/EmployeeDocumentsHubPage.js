import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import { get } from "../../lib/api";
import {
  createEmployee as apiCreateEmployee,
} from "../../hooks/useEmployees";
import {
  getOffboarding,
  getOnboarding,
  startOnboarding,
  startOffboarding,
  updateOnboardingStatus,
  updateOffboardingStatus,
  updateOnboardingTask,
  updateOffboardingTask,
} from "../../lib/documentsApi";
import {
  ChevronRight,
  ClipboardCheck,
  DoorOpen,
  ExternalLink,
  FileText,
  FolderOpen,
  Plus,
  RefreshCw,
  Rocket,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Checkbox } from "../../components/ui/checkbox";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import PageHeader from "../../components/common/PageHeader";
import SectionCard from "../../components/common/SectionCard";
import EmptyState from "../../components/common/EmptyState";
import { ListSkeleton } from "../../components/common/Skeletons";
import { openSecureFileUrl } from "../../lib/secureFiles";

const CONTRACT_TYPES = ["CDI", "CDD", "STAGE", "INTERIM", "APPRENTISSAGE"];
const EXIT_TYPES = [
  { value: "demission", label: "Démission" },
  { value: "fin_cdd", label: "Fin CDD" },
  { value: "licenciement", label: "Licenciement" },
  { value: "retraite", label: "Retraite" },
];

const ONBOARDING_TASKS = [
  { key: "contract-signed", task: "Contrat signé", assignedTo: "RH" },
  { key: "identity-card", task: "Carte identité fournie", assignedTo: "Salarié" },
  { key: "diploma", task: "Diplôme fourni", assignedTo: "Salarié" },
  { key: "bank-account", task: "Compte bancaire fourni", assignedTo: "Salarié" },
  { key: "social-registry", task: "Référence organisme social", assignedTo: "RH" },
  { key: "pension-registry", task: "Référence retraite / pension", assignedTo: "RH" },
  { key: "position-setup", task: "Poste configuré", assignedTo: "Manager" },
  { key: "it-access", task: "Accès IT", assignedTo: "IT" },
];

const OFFBOARDING_TASKS = [
  { key: "work-certificate", task: "Certificat travail", assignedTo: "RH" },
  { key: "final-pay", task: "Solde tout compte", assignedTo: "Paie" },
  { key: "equipment-return", task: "Restitution matériel", assignedTo: "Manager" },
  { key: "it-removal", task: "Suppression accès IT", assignedTo: "IT" },
  { key: "archive-file", task: "Archivage dossier", assignedTo: "RH" },
];

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR");
}

function employeeLabel(employee) {
  return `${employee?.firstName || ""} ${employee?.lastName || ""}`.trim() || "Employé";
}

function statusBadgeClass(statusKey) {
  if (statusKey === "DONE") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (statusKey === "IN_PROGRESS") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function progressBarClass(percent) {
  if (percent >= 100) return "bg-emerald-500";
  if (percent > 0) return "bg-amber-500";
  return "bg-slate-300";
}

function workflowTypeLabel(type) {
  if (type === "Onboarding") return "Intégration";
  if (type === "Offboarding") return "Sortie";
  return type || "Parcours";
}

function createTaskDrafts(definitions, dueDate, managerName) {
  return definitions.map((item) => ({
    id: item.key,
    key: item.key,
    task: item.task,
    status: "PENDING",
    assignedTo: item.assignedTo === "Manager" && managerName ? managerName : item.assignedTo,
    dueDate: dueDate || "",
  }));
}

function StepIndicator({ current, steps }) {
  return (
    <div className="flex flex-wrap gap-2">
      {steps.map((step, index) => {
        const active = index === current;
        const done = index < current;
        return (
          <div
            key={step}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
              active
                ? "bg-emerald-600 text-white"
                : done
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20">{index + 1}</span>
            {step}
          </div>
        );
      })}
    </div>
  );
}

function WorkflowDetailDialog({ workflow, open, onOpenChange, onRefresh }) {
  const [savingTaskId, setSavingTaskId] = useState("");
  const [closing, setClosing] = useState(false);

  const toggleTask = async (task) => {
    if (!workflow) return;
    setSavingTaskId(task.id);
    try {
      if (workflow.type === "Onboarding") {
        await updateOnboardingTask(workflow.id, task.id, {
          status: task.status === "DONE" ? "PENDING" : "DONE",
        });
      } else {
        await updateOffboardingTask(workflow.id, task.id, {
          status: task.status === "DONE" ? "PENDING" : "DONE",
        });
      }
      await onRefresh();
    } catch (error) {
      toast.error(error?.message || "Impossible de mettre à jour la tâche");
    } finally {
      setSavingTaskId("");
    }
  };

  const completeWorkflow = async () => {
    if (!workflow) return;
    setClosing(true);
    try {
      if (workflow.type === "Onboarding") {
        await updateOnboardingStatus(workflow.id, { status: "closed" });
      } else {
        await updateOffboardingStatus(workflow.id, { status: "closed" });
      }
      toast.success("Workflow terminé");
      onOpenChange(false);
      await onRefresh();
    } catch (error) {
      toast.error(error?.message || "Impossible de clôturer le parcours");
    } finally {
      setClosing(false);
    }
  };

  if (!workflow) return null;

  const info = workflow.workflowInfo || {};
  const canComplete = workflow.progress?.completed === workflow.progress?.total && workflow.progress?.total > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {workflow.type === "Onboarding" ? <Rocket className="h-5 w-5 text-emerald-700" /> : <DoorOpen className="h-5 w-5 text-amber-700" />}
            {workflowTypeLabel(workflow.type)} · {employeeLabel(workflow.employee)}
          </DialogTitle>
          <DialogDescription>
            Suivi opérationnel des tâches RH, documents et actions transverses.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">Résumé</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={statusBadgeClass(workflow.statusKey)}>{workflow.statusLabel}</Badge>
                <Badge variant="outline">{workflow.progress?.label || "0/0 tâches"}</Badge>
              </div>
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="text-slate-500">Employé</div>
                  <div className="mt-1 font-medium text-slate-900">{employeeLabel(workflow.employee)}</div>
                  <div className="text-xs text-slate-500">{workflow.employee?.email || "—"}</div>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="text-slate-500">Type</div>
                  <div className="mt-1 font-medium text-slate-900">{workflowTypeLabel(workflow.type)}</div>
                </div>
                {workflow.type === "Onboarding" ? (
                  <>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="text-slate-500">Date début</div>
                      <div className="mt-1 font-medium text-slate-900">{formatDate(info.startDate)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="text-slate-500">Manager</div>
                      <div className="mt-1 font-medium text-slate-900">{info.managerName || "—"}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="text-slate-500">Département / site</div>
                      <div className="mt-1 font-medium text-slate-900">{info.department || "—"} · {info.site || "—"}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="text-slate-500">Type contrat</div>
                      <div className="mt-1 font-medium text-slate-900">{info.contractType || "—"}</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="text-slate-500">Date départ</div>
                      <div className="mt-1 font-medium text-slate-900">{formatDate(info.departureDate)}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="text-slate-500">Type sortie</div>
                      <div className="mt-1 font-medium text-slate-900">{info.exitType || "—"}</div>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="text-slate-500">Motif</div>
                      <div className="mt-1 font-medium text-slate-900">{info.reason || "—"}</div>
                    </div>
                  </>
                )}
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="text-slate-500">Documents générés</div>
                  {workflow.generatedDocuments?.length ? (
                    <div className="mt-3 space-y-2">
                      {workflow.generatedDocuments.map((document) => (
                        <button
                          key={document.id || document.url}
                          type="button"
                          onClick={() => openSecureFileUrl(document.url)}
                          className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50/60"
                        >
                          <span className="inline-flex items-center gap-2">
                            <FileText className="h-4 w-4 text-emerald-700" />
                            {document.label}
                          </span>
                          <ExternalLink className="h-4 w-4 text-slate-400" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-slate-500">
                      Les modèles sélectionnés seront générés automatiquement dans le dossier salarié.
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">Checklist</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(workflow.checklist || []).map((task) => (
                <div key={task.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={task.status === "DONE"}
                        onCheckedChange={() => toggleTask(task)}
                        disabled={savingTaskId === task.id}
                      />
                      <div>
                        <div className="font-medium text-slate-900">{task.task}</div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span>Assigné à: {task.assignedTo || "—"}</span>
                          <span>Échéance: {formatDate(task.dueDate)}</span>
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline">{task.status === "DONE" ? "Fait" : "À faire"}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          <Button onClick={completeWorkflow} disabled={!canComplete || closing} className="bg-emerald-600 hover:bg-emerald-700">
            Clôturer le parcours
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OnboardingDialog({ open, onOpenChange, employees, onCreated }) {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState("existing");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [employeeDraft, setEmployeeDraft] = useState({
    firstName: "",
    lastName: "",
    email: "",
    position: "",
  });
  const [form, setForm] = useState({
    startDate: "",
    managerId: "",
    department: "",
    site: "",
    contractType: "CDI",
  });
  const [saving, setSaving] = useState(false);
  const [checklist, setChecklist] = useState([]);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeId) || null,
    [employees, selectedEmployeeId]
  );
  const selectedManagerName = useMemo(() => {
    if (!form.managerId) return "";
    const manager = employees.find((employee) => employee.id === form.managerId);
    return manager ? employeeLabel(manager) : "";
  }, [employees, form.managerId]);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setMode("existing");
    setSelectedEmployeeId("");
    setEmployeeDraft({ firstName: "", lastName: "", email: "", position: "" });
    setForm({ startDate: "", managerId: "", department: "", site: "", contractType: "CDI" });
    setChecklist(createTaskDrafts(ONBOARDING_TASKS, "", ""));
  }, [open]);

  useEffect(() => {
    if (!selectedEmployee) return;
    setForm((current) => ({
      ...current,
      managerId: current.managerId || selectedEmployee.managerId || "",
      department: current.department || selectedEmployee.department || "",
      site: current.site || selectedEmployee.site || "",
      contractType: current.contractType || selectedEmployee.contractType || "CDI",
    }));
    setEmployeeDraft((current) => ({
      ...current,
      position: current.position || selectedEmployee.position || "",
    }));
  }, [selectedEmployee]);

  useEffect(() => {
    if (!open) return;
    setChecklist((current) =>
      current.map((task) => ({
        ...task,
        dueDate: task.dueDate || form.startDate || "",
        assignedTo: task.key === "position-setup" ? (selectedManagerName || "Manager") : task.assignedTo,
      }))
    );
  }, [form.startDate, selectedManagerName, open]);

  const next = () => {
    if (step === 0) {
      if (mode === "existing" && !selectedEmployeeId) {
        toast.error("Sélectionnez un salarié ou passez en création");
        return;
      }
      if (mode === "new" && (!employeeDraft.firstName || !employeeDraft.lastName || !employeeDraft.email)) {
        toast.error("Renseignez prénom, nom et email du salarié");
        return;
      }
    }
    if (step === 1) {
      if (!form.startDate || !form.department || !form.site || !form.contractType) {
        toast.error("Renseignez la date de début, le département, le site et le type de contrat");
        return;
      }
    }
    setStep((current) => Math.min(current + 1, 2));
  };

  const save = async () => {
    setSaving(true);
    try {
      let employeeId = selectedEmployeeId;
      let employeePayload = selectedEmployee || null;

      if (mode === "new") {
        const created = await apiCreateEmployee({
          firstName: employeeDraft.firstName,
          lastName: employeeDraft.lastName,
          email: employeeDraft.email,
          position: employeeDraft.position || null,
          country: "SN",
          status: "ACTIVE",
          joinDate: form.startDate,
          department: form.department,
          site: form.site,
          contractType: form.contractType,
          managerId: form.managerId || undefined,
        });
        employeeId = created?.id;
        employeePayload = created;
      }

      if (!employeeId) {
        throw new Error("Aucun salarié sélectionné");
      }

      await startOnboarding({
        employeeId,
        employee: employeePayload
          ? {
              firstName: employeePayload.firstName,
              lastName: employeePayload.lastName,
              email: employeePayload.email,
              position: employeePayload.position,
            }
          : employeeDraft,
        workflowInfo: {
          startDate: form.startDate,
          managerId: form.managerId || null,
          managerName: selectedManagerName || null,
          department: form.department,
          site: form.site,
          contractType: form.contractType,
          position: (employeePayload?.position || employeeDraft.position || "").trim() || null,
        },
        checklist,
      });

      toast.success("Onboarding créé");
      onOpenChange(false);
      await onCreated();
    } catch (error) {
      toast.error(error?.message || "Impossible de créer l’onboarding");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Nouvel onboarding</DialogTitle>
          <DialogDescription>Créez un parcours d’intégration complet et suivez chaque tâche dès la création.</DialogDescription>
        </DialogHeader>

        <StepIndicator current={step} steps={["Salarié", "Informations", "Checklist"]} />

        {step === 0 ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant={mode === "existing" ? "default" : "outline"} onClick={() => setMode("existing")}>
                Sélection salarié
              </Button>
              <Button variant={mode === "new" ? "default" : "outline"} onClick={() => setMode("new")}>
                Créer salarié
              </Button>
            </div>

            {mode === "existing" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Salarié</label>
                <select
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3"
                  value={selectedEmployeeId}
                  onChange={(event) => setSelectedEmployeeId(event.target.value)}
                >
                  <option value="">Sélectionner un salarié</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employeeLabel(employee)} · {employee.position || employee.department || "—"}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Prénom</span>
                  <Input value={employeeDraft.firstName} onChange={(event) => setEmployeeDraft((current) => ({ ...current, firstName: event.target.value }))} />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Nom</span>
                  <Input value={employeeDraft.lastName} onChange={(event) => setEmployeeDraft((current) => ({ ...current, lastName: event.target.value }))} />
                </label>
                <label className="space-y-1 text-sm md:col-span-2">
                  <span className="font-medium text-slate-700">Email</span>
                  <Input type="email" value={employeeDraft.email} onChange={(event) => setEmployeeDraft((current) => ({ ...current, email: event.target.value }))} />
                </label>
                <label className="space-y-1 text-sm md:col-span-2">
                  <span className="font-medium text-slate-700">Poste</span>
                  <Input value={employeeDraft.position} onChange={(event) => setEmployeeDraft((current) => ({ ...current, position: event.target.value }))} />
                </label>
              </div>
            )}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Date début</span>
              <Input type="date" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Manager</span>
              <select className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3" value={form.managerId} onChange={(event) => setForm((current) => ({ ...current, managerId: event.target.value }))}>
                <option value="">Sélectionner un manager</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employeeLabel(employee)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Département</span>
              <Input value={form.department} onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Site</span>
              <Input value={form.site} onChange={(event) => setForm((current) => ({ ...current, site: event.target.value }))} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Type contrat</span>
              <select className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3" value={form.contractType} onChange={(event) => setForm((current) => ({ ...current, contractType: event.target.value }))}>
                {CONTRACT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            {(checklist || []).map((task, index) => (
              <div key={task.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={task.status === "DONE"}
                      onCheckedChange={(checked) =>
                        setChecklist((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, status: checked ? "DONE" : "PENDING" } : item
                          )
                        )
                      }
                    />
                    <div>
                      <div className="font-medium text-slate-900">{task.task}</div>
                      <div className="text-xs text-slate-500">Cette tâche sera créée automatiquement dans le parcours.</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:w-[340px]">
                    <Input
                      value={task.assignedTo || ""}
                      onChange={(event) =>
                        setChecklist((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, assignedTo: event.target.value } : item
                          )
                        )
                      }
                      placeholder="Assigné à"
                    />
                    <Input
                      type="date"
                      value={task.dueDate ? String(task.dueDate).slice(0, 10) : ""}
                      onChange={(event) =>
                        setChecklist((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, dueDate: event.target.value } : item
                          )
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <DialogFooter>
          {step > 0 ? (
            <Button variant="outline" onClick={() => setStep((current) => Math.max(current - 1, 0))}>
              Retour
            </Button>
          ) : null}
          {step < 2 ? (
            <Button onClick={next} className="bg-emerald-600 hover:bg-emerald-700">
              Continuer
            </Button>
          ) : (
            <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              Créer l’onboarding
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OffboardingDialog({ open, onOpenChange, employees, onCreated }) {
  const [step, setStep] = useState(0);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [form, setForm] = useState({
    departureDate: "",
    reason: "",
    exitType: "demission",
  });
  const [saving, setSaving] = useState(false);
  const [checklist, setChecklist] = useState([]);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeId) || null,
    [employees, selectedEmployeeId]
  );

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setSelectedEmployeeId("");
    setForm({ departureDate: "", reason: "", exitType: "demission" });
    setChecklist(createTaskDrafts(OFFBOARDING_TASKS, "", ""));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setChecklist((current) =>
      current.map((task) => ({
        ...task,
        dueDate: task.dueDate || form.departureDate || "",
      }))
    );
  }, [form.departureDate, open]);

  const next = () => {
    if (step === 0 && !selectedEmployeeId) {
      toast.error("Sélectionnez un salarié");
      return;
    }
    if (step === 1 && (!form.departureDate || !form.reason || !form.exitType)) {
      toast.error("Renseignez la date, le motif et le type de sortie");
      return;
    }
    setStep((current) => Math.min(current + 1, 2));
  };

  const save = async () => {
    if (!selectedEmployeeId || !selectedEmployee) {
      toast.error("Sélectionnez un salarié");
      return;
    }

    setSaving(true);
    try {
      await startOffboarding({
        employeeId: selectedEmployeeId,
        employee: {
          firstName: selectedEmployee.firstName,
          lastName: selectedEmployee.lastName,
          email: selectedEmployee.email,
        },
        workflowInfo: {
          departureDate: form.departureDate,
          reason: form.reason,
          exitType: form.exitType,
        },
        checklist,
      });

      toast.success("Départ créé");
      onOpenChange(false);
      await onCreated();
    } catch (error) {
      toast.error(error?.message || "Impossible de créer le départ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Nouveau départ</DialogTitle>
          <DialogDescription>Préparez la sortie du salarié et affectez immédiatement les tâches clés de départ.</DialogDescription>
        </DialogHeader>

        <StepIndicator current={step} steps={["Salarié", "Départ", "Checklist"]} />

        {step === 0 ? (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Salarié</label>
            <select
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3"
              value={selectedEmployeeId}
              onChange={(event) => setSelectedEmployeeId(event.target.value)}
            >
              <option value="">Sélectionner un salarié</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employeeLabel(employee)} · {employee.position || employee.department || "—"}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Date départ</span>
              <Input type="date" value={form.departureDate} onChange={(event) => setForm((current) => ({ ...current, departureDate: event.target.value }))} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Type sortie</span>
              <select className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3" value={form.exitType} onChange={(event) => setForm((current) => ({ ...current, exitType: event.target.value }))}>
                {EXIT_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="font-medium text-slate-700">Motif</span>
              <Textarea value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} />
            </label>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            {(checklist || []).map((task, index) => (
              <div key={task.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={task.status === "DONE"}
                      onCheckedChange={(checked) =>
                        setChecklist((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, status: checked ? "DONE" : "PENDING" } : item
                          )
                        )
                      }
                    />
                    <div>
                      <div className="font-medium text-slate-900">{task.task}</div>
                      <div className="text-xs text-slate-500">La tâche sera ouverte dès la création du dossier de départ.</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:w-[340px]">
                    <Input
                      value={task.assignedTo || ""}
                      onChange={(event) =>
                        setChecklist((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, assignedTo: event.target.value } : item
                          )
                        )
                      }
                      placeholder="Assigné à"
                    />
                    <Input
                      type="date"
                      value={task.dueDate ? String(task.dueDate).slice(0, 10) : ""}
                      onChange={(event) =>
                        setChecklist((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, dueDate: event.target.value } : item
                          )
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <DialogFooter>
          {step > 0 ? (
            <Button variant="outline" onClick={() => setStep((current) => Math.max(current - 1, 0))}>
              Retour
            </Button>
          ) : null}
          {step < 2 ? (
            <Button onClick={next} className="bg-emerald-600 hover:bg-emerald-700">
              Continuer
            </Button>
          ) : (
            <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              Créer le départ
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function EmployeeDocumentsHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [onboarding, setOnboarding] = useState([]);
  const [offboarding, setOffboarding] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [offboardingOpen, setOffboardingOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const requestedEmployeeId = searchParams.get("employeeId");
  const requestedWorkflowId = searchParams.get("workflowId");
  const requestedWorkflowType = searchParams.get("workflowType");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [onb, off, employeeRes] = await Promise.all([
        get("/documents/onboarding/cases?status=open"),
        get("/documents/offboarding/cases?status=open"),
        get("/people/employees?page=1&pageSize=200"),
      ]);
      const nextOnboarding = Array.isArray(onb?.items) ? onb.items : [];
      const nextOffboarding = Array.isArray(off?.items) ? off.items : [];
      const nextEmployees = Array.isArray(employeeRes?.items) ? employeeRes.items : [];
      setOnboarding(nextOnboarding);
      setOffboarding(nextOffboarding);
      setEmployees(nextEmployees);
      return { onboarding: nextOnboarding, offboarding: nextOffboarding, employees: nextEmployees };
    } catch (e) {
      setError(e?.message || "Erreur de chargement des parcours RH");
      setOnboarding([]);
      setOffboarding([]);
      setEmployees([]);
      return { onboarding: [], offboarding: [], employees: [] };
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      const fresh = await load();
      if (cancelled) return;

      if (!requestedWorkflowId || !requestedWorkflowType) return;

      let workflow = [...(fresh?.onboarding || []), ...(fresh?.offboarding || [])].find(
        (item) => item.id === requestedWorkflowId && item.type === requestedWorkflowType
      );

      if (!workflow) {
        try {
          workflow = requestedWorkflowType.toLowerCase().startsWith("off")
            ? await getOffboarding(requestedWorkflowId)
            : await getOnboarding(requestedWorkflowId);
        } catch {
          workflow = null;
        }
      }

      if (!cancelled && workflow) setSelectedWorkflow(workflow);
    };

    sync();
    return () => {
      cancelled = true;
    };
  }, [requestedWorkflowId, requestedWorkflowType]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeCases = useMemo(
    () =>
      [...onboarding, ...offboarding].sort(
        (a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
      ),
    [onboarding, offboarding]
  );

  const focusedEmployee = useMemo(
    () => employees.find((employee) => employee.id === requestedEmployeeId) || null,
    [employees, requestedEmployeeId]
  );

  const visibleCases = useMemo(
    () => activeCases.filter((workflow) => !requestedEmployeeId || workflow.employee?.id === requestedEmployeeId),
    [activeCases, requestedEmployeeId]
  );

  const activeCount = visibleCases.length;

  const openWorkflow = (workflow) => {
    setSelectedWorkflow(workflow);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("workflowId", workflow.id);
    nextParams.set("workflowType", workflow.type);
    setSearchParams(nextParams, { replace: true });
  };

  const closeWorkflow = () => {
    setSelectedWorkflow(null);
    if (!searchParams.has("workflowId") && !searchParams.has("workflowType")) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("workflowId");
    nextParams.delete("workflowType");
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Parcours salariés"
        description={
          focusedEmployee
            ? `Pilotez l’intégration, les départs et les documents clés pour ${employeeLabel(focusedEmployee)}.`
            : "Pilotez l’intégration, les départs et les documents clés depuis un seul module RH."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={load}>
              <RefreshCw className="mr-2 h-4 w-4" /> Rafraîchir
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setOnboardingOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Nouvel onboarding
            </Button>
            <Button className="bg-slate-900 hover:bg-slate-800" onClick={() => setOffboardingOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Nouveau départ
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-emerald-100">
          <CardHeader><CardTitle className="text-base">Onboarding en cours</CardTitle></CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-bold text-slate-900">{onboarding.length}</div>
            <Rocket className="h-8 w-8 text-emerald-600" />
          </CardContent>
        </Card>
        <Card className="border-amber-100">
          <CardHeader><CardTitle className="text-base">Offboarding en cours</CardTitle></CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-bold text-slate-900">{offboarding.length}</div>
            <DoorOpen className="h-8 w-8 text-amber-600" />
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardHeader><CardTitle className="text-base">Dossiers actifs</CardTitle></CardHeader>
          <CardContent className="flex items-end justify-between">
            <div className="text-3xl font-bold text-slate-900">{activeCount}</div>
            <FolderOpen className="h-8 w-8 text-slate-600" />
          </CardContent>
        </Card>
      </div>

      <SectionCard
        title="Dossiers actifs"
        description="Chaque ligne ouvre le détail du parcours pour suivre les tâches, la progression et la clôture."
        className="border-emerald-100 shadow-sm"
      >
        {loading ? (
          <ListSkeleton rows={6} />
        ) : error ? (
          <EmptyState
            icon={FolderOpen}
            title="Impossible de charger les parcours"
            description={error}
            actionLabel="Réessayer"
            onAction={load}
            compact
          />
        ) : visibleCases.length ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="border px-4 py-3">Employé</th>
                  <th className="border px-4 py-3">Type</th>
                  <th className="border px-4 py-3">Statut</th>
                  <th className="border px-4 py-3">Progression</th>
                  <th className="border px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleCases.map((workflow) => (
                  <tr key={`${workflow.type}-${workflow.id}`} className="hover:bg-slate-50/70">
                    <td className="border px-4 py-3">
                      <div className="font-medium text-slate-900">{employeeLabel(workflow.employee)}</div>
                      <div className="text-xs text-slate-500">{workflow.employee?.position || workflow.employee?.email || "—"}</div>
                    </td>
                    <td className="border px-4 py-3">
                      <Badge variant="outline">{workflowTypeLabel(workflow.type)}</Badge>
                    </td>
                    <td className="border px-4 py-3">
                      <Badge className={statusBadgeClass(workflow.statusKey)}>{workflow.statusLabel}</Badge>
                    </td>
                    <td className="border px-4 py-3">
                      <div className="min-w-[180px]">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{workflow.progress?.label || "0/0 tâches"}</span>
                          <span>{workflow.progress?.percent || 0}%</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-slate-100">
                          <div
                            className={`h-2 rounded-full ${progressBarClass(workflow.progress?.percent || 0)}`}
                            style={{ width: `${workflow.progress?.percent || 0}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="border px-4 py-3">
                      <Button variant="outline" size="sm" onClick={() => openWorkflow(workflow)}>
                        Ouvrir <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={ClipboardCheck}
            title="Aucun parcours actif"
            description={
              focusedEmployee
                ? "Aucun parcours actif n'est ouvert pour ce collaborateur."
                : "Créez un onboarding ou un départ pour suivre les tâches d’intégration et de sortie."
            }
            actionLabel="Nouvel onboarding"
            onAction={() => setOnboardingOpen(true)}
            compact
          />
        )}
      </SectionCard>

      <OnboardingDialog
        open={onboardingOpen}
        onOpenChange={setOnboardingOpen}
        employees={employees}
        onCreated={load}
      />

      <OffboardingDialog
        open={offboardingOpen}
        onOpenChange={setOffboardingOpen}
        employees={employees}
        onCreated={load}
      />

      <WorkflowDetailDialog
        workflow={selectedWorkflow}
        open={Boolean(selectedWorkflow)}
        onOpenChange={(open) => {
          if (!open) closeWorkflow();
        }}
        onRefresh={async () => {
          const fresh = await load();
          if (!selectedWorkflow) return;
          let latest = [...(fresh?.onboarding || []), ...(fresh?.offboarding || [])].find(
            (item) => item.id === selectedWorkflow.id && item.type === selectedWorkflow.type
          );
          if (!latest) {
            try {
              latest = selectedWorkflow.type === "Offboarding"
                ? await getOffboarding(selectedWorkflow.id)
                : await getOnboarding(selectedWorkflow.id);
            } catch {
              latest = null;
            }
          }
          if (latest) setSelectedWorkflow(latest);
          else closeWorkflow();
        }}
      />
    </div>
  );
}

StepIndicator.propTypes = {
  current: PropTypes.number.isRequired,
  steps: PropTypes.arrayOf(PropTypes.string).isRequired,
};

WorkflowDetailDialog.propTypes = {
    workflow: PropTypes.shape({
      id: PropTypes.string,
      type: PropTypes.string,
      statusKey: PropTypes.string,
      statusLabel: PropTypes.string,
      employee: PropTypes.object,
      workflowInfo: PropTypes.object,
      generatedDocuments: PropTypes.arrayOf(PropTypes.object),
      progress: PropTypes.shape({
      completed: PropTypes.number,
      total: PropTypes.number,
      percent: PropTypes.number,
      label: PropTypes.string,
    }),
    checklist: PropTypes.arrayOf(PropTypes.object),
  }),
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  onRefresh: PropTypes.func.isRequired,
};

WorkflowDetailDialog.defaultProps = {
  workflow: null,
};

OnboardingDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  employees: PropTypes.arrayOf(PropTypes.object).isRequired,
  onCreated: PropTypes.func.isRequired,
};

OffboardingDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onOpenChange: PropTypes.func.isRequired,
  employees: PropTypes.arrayOf(PropTypes.object).isRequired,
  onCreated: PropTypes.func.isRequired,
};

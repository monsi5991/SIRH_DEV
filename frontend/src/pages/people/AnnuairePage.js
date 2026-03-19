import React, { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../../contexts/AppContext";
import { useAuth } from "../../contexts/AuthContext";
import {
  Briefcase,
  Building2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit,
  Eye,
  FilterX,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Upload,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Avatar } from "../../components/ui/avatar";
import SectionCard from "../../components/common/SectionCard";
import EmptyState from "../../components/common/EmptyState";
import HelpTooltip from "../../components/common/HelpTooltip";
import StatusBadge from "../../components/common/StatusBadge";
import { TableSkeleton } from "../../components/common/Skeletons";
import {
  useEmployees,
  useEmployeeDetail,
  createEmployee as apiCreateEmployee,
  updateEmployee as apiUpdateEmployee,
  uploadEmployeeDocument,
} from "../../hooks/useEmployees";
import EmployeeFormDialog from "../../components/people/EmployeeFormDialog";
import { emitEmployeesChanged, emitRefreshCounters } from "../../lib/events";
import { openSecureFileUrl } from "../../lib/secureFiles";
import { normalizeRoles } from "../../lib/permissions";

const DIRECTORY_VIEW_STORAGE_KEY = "people.directory.savedView";

function formatMoney(value) {
  return `${new Intl.NumberFormat("fr-FR").format(Number(value || 0))} XOF`;
}

function formatFullName(employee) {
  return `${employee?.firstName || ""} ${employee?.lastName || ""}`.trim() || "Employé";
}

function yearsOfService(value) {
  if (!value) return "—";
  const joinDate = new Date(value);
  if (Number.isNaN(joinDate.getTime())) return "—";
  const today = new Date();
  const months = (today.getFullYear() - joinDate.getFullYear()) * 12 + (today.getMonth() - joinDate.getMonth());
  if (months < 1) return "< 1 mois";
  if (months < 12) return `${months} mois`;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  if (!remMonths) return `${years} an${years > 1 ? "s" : ""}`;
  return `${years} an${years > 1 ? "s" : ""} ${remMonths} mois`;
}

function getInitials(employee) {
  return `${employee?.firstName?.[0] || ""}${employee?.lastName?.[0] || ""}`.toUpperCase() || "EM";
}

function readSavedView() {
  try {
    const raw = localStorage.getItem(DIRECTORY_VIEW_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function EmployeeProfile360({ employeeId, onClose, onEdit, canEdit, canSeeSensitiveData, canUploadDocuments }) {
  const ref = useRef(null);
  const { employee, loading, error, setEmployee } = useEmployeeDetail(employeeId);

  useEffect(() => {
    if (!employeeId) return;
    const previous = document.activeElement;
    ref.current?.focus();
    const onKey = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [employeeId, onClose]);

  if (!employeeId) return null;

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const doc = await uploadEmployeeDocument(employeeId, { file, label: file.name, type: "autre" });
      const base = employee ?? {};
      const docs = Array.isArray(base.documents) ? base.documents : [];
      setEmployee({ ...base, documents: [doc, ...docs] });
      emitEmployeesChanged({ action: "doc_upload", employeeId });
    } catch (uploadError) {
      alert(uploadError?.message || "Impossible d’ajouter le document");
    } finally {
      event.target.value = "";
    }
  };

  const managerName = employee?.manager ? `${employee.manager.firstName || ""} ${employee.manager.lastName || ""}`.trim() : "Non défini";
  const complianceAlerts = [
    canSeeSensitiveData && !employee?.cnss ? "Référence organisme social non renseignée" : null,
    canSeeSensitiveData && !employee?.ipres ? "Référence retraite / pension non renseignée" : null,
    !employee?.contractType ? "Type de contrat à compléter" : null,
    employee?.contractType === "CDD" && employee?.joinDate && yearsOfService(employee.joinDate) !== "—" ? "Vérifier le cumul CDD et le risque 24 mois" : null,
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-dialog-title"
        className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white outline-none"
      >
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16 bg-emerald-600">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 text-xl font-semibold text-white">
                  {getInitials(employee || {})}
                </div>
              </Avatar>
              <div>
                <h2 id="employee-dialog-title" className="text-2xl font-bold text-slate-900">
                  {loading ? "Chargement…" : formatFullName(employee || {})}
                </h2>
                <div className="mt-1 text-sm text-slate-600">{employee?.position || "Fonction non renseignée"}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline">{employee?.department || "Département non renseigné"}</Badge>
                  <Badge variant="outline">{employee?.site || "Site non renseigné"}</Badge>
                  <StatusBadge status={employee?.status || "ACTIVE"} />
                  {employee?.contractType ? <Badge variant="outline">{employee.contractType}</Badge> : null}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start">
              {canEdit ? (
                <Button variant="outline" onClick={() => onEdit?.(employee)}>
                  <Edit className="mr-2 h-4 w-4" /> Modifier
                </Button>
              ) : null}
              <button onClick={onClose} aria-label="Fermer" className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          {complianceAlerts.length ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <div className="font-medium">Informations critiques visibles immédiatement</div>
              <div className="mt-1 flex flex-wrap gap-2">
                {complianceAlerts.map((alert) => <Badge key={alert} className="border-amber-200 bg-white text-amber-700">{alert}</Badge>)}
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">Identité & contact</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-3 text-sm"><div className="text-slate-500">Email</div><div className="mt-1 font-medium text-slate-900">{employee?.email || "—"}</div></div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm"><div className="text-slate-500">Téléphone</div><div className="mt-1 font-medium text-slate-900">{employee?.phone || "—"}</div></div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm"><div className="text-slate-500">Site</div><div className="mt-1 font-medium text-slate-900">{employee?.site || "—"}</div></div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm"><div className="text-slate-500">Manager</div><div className="mt-1 font-medium text-slate-900">{managerName}</div></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{canSeeSensitiveData ? "Conformité & contrat" : "Contrat & suivi RH"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-xl border border-slate-200 p-3"><div className="text-slate-500">Date d’embauche</div><div className="mt-1 font-medium text-slate-900">{employee?.joinDate ? new Date(employee.joinDate).toLocaleDateString() : "—"}</div></div>
              <div className="rounded-xl border border-slate-200 p-3"><div className="text-slate-500">Fin de contrat</div><div className="mt-1 font-medium text-slate-900">{employee?.endDate ? new Date(employee.endDate).toLocaleDateString() : "—"}</div></div>
              <div className="rounded-xl border border-slate-200 p-3"><div className="text-slate-500">Type de contrat</div><div className="mt-1 font-medium text-slate-900">{employee?.contractType || "—"}</div></div>
              {canSeeSensitiveData ? (
                <div className="rounded-xl border border-slate-200 p-3"><div className="text-slate-500">Organisme social / retraite</div><div className="mt-1 font-medium text-slate-900">{employee?.cnss || "—"} / {employee?.ipres || "—"}</div></div>
              ) : (
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="text-slate-500">Suivi administratif</div>
                  <div className="mt-1 font-medium text-slate-900">Les références sociales et les informations sensibles sont gérées côté RH.</div>
                </div>
              )}
              <div className="rounded-xl border border-slate-200 p-3"><div className="text-slate-500">Ancienneté</div><div className="mt-1 font-medium text-slate-900">{yearsOfService(employee?.joinDate)}</div></div>
            </CardContent>
          </Card>

          {canSeeSensitiveData ? (
            <Card>
              <CardHeader>
                <CardTitle>Rémunération</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-xl border border-slate-200 p-3"><div className="text-slate-500">Salaire de base</div><div className="mt-1 font-medium text-slate-900">{employee?.baseSalary ? formatMoney(employee.baseSalary) : "—"}</div></div>
                <div className="rounded-xl border border-slate-200 p-3"><div className="text-slate-500">Banque / RIB</div><div className="mt-1 font-medium text-slate-900 break-all">{employee?.bankName || "—"} {employee?.bankIban ? `· ${employee.bankIban}` : ""}</div></div>
                <div className="rounded-xl border border-slate-200 p-3"><div className="text-slate-500">AT / parts famille</div><div className="mt-1 font-medium text-slate-900">{employee?.atRate != null ? `${(employee.atRate * 100).toFixed(2)}%` : "—"} · {employee?.familyParts ?? "—"}</div></div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Documents</span>
                {canUploadDocuments ? (
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-emerald-700">
                    <Upload className="h-4 w-4" /> Ajouter
                    <input type="file" className="hidden" onChange={handleUpload} />
                  </label>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {error ? <div className="text-sm text-rose-600">{String(error)}</div> : null}
              {!employee?.documents?.length ? (
                <div className="text-sm text-slate-500">Aucun document rattaché.</div>
              ) : (
                <div className="space-y-2">
                  {employee.documents.map((document) => (
                    <div key={document.id} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                      <button
                        type="button"
                        onClick={() => openSecureFileUrl(document.url)}
                        className="font-medium text-slate-900 underline decoration-dotted"
                      >
                        {document.label}
                      </button>
                      <div className="mt-1 text-xs text-slate-500">{document.type} · {document.expiresAt ? `Expire le ${new Date(document.expiresAt).toLocaleDateString()}` : "Sans échéance"}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Objectifs & compétences</CardTitle>
            </CardHeader>
            <CardContent>
              {!employee?.goals?.length && !employee?.certifications?.length ? (
                <div className="text-sm text-slate-500">Aucun objectif ni certificat visible.</div>
              ) : (
                <div className="space-y-3">
                  {(employee?.goals || []).slice(0, 4).map((goal) => (
                    <div key={goal.id} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-slate-900">{goal.title}</span>
                        <Badge variant="outline">{goal.progress ?? 0}%</Badge>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{goal.status || "En cours"}</div>
                    </div>
                  ))}
                  {(employee?.certifications || []).slice(0, 3).map((certification) => (
                    <div key={certification.id} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                      <div className="font-medium text-slate-900">{certification.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{certification.expiresAt ? `Expire le ${new Date(certification.expiresAt).toLocaleDateString()}` : "Sans date d’expiration"}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline RH</CardTitle>
            </CardHeader>
            <CardContent>
              {!employee?.activities?.length ? (
                <div className="text-sm text-slate-500">Aucun événement RH rattaché pour le moment.</div>
              ) : (
                <div className="space-y-3">
                  {employee.activities.map((activity) => (
                    <div key={activity.id} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                      <div className="font-medium text-slate-900">{activity.title}</div>
                      <div className="mt-1 text-xs text-slate-500">{activity.when ? new Date(activity.when).toLocaleDateString() : "—"}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

EmployeeProfile360.propTypes = {
  employeeId: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onEdit: PropTypes.func,
  canEdit: PropTypes.bool,
  canSeeSensitiveData: PropTypes.bool,
  canUploadDocuments: PropTypes.bool,
};

EmployeeProfile360.defaultProps = {
  employeeId: null,
  onEdit: null,
  canEdit: false,
  canSeeSensitiveData: false,
  canUploadDocuments: false,
};

export default function AnnuairePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useApp();
  const { user } = useAuth();
  const pageSize = 12;
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({ country: "SN", department: "", site: "", status: "" });
  const [page, setPage] = useState(1);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState(null);
  const [savedView, setSavedView] = useState(() => readSavedView());
  const employeeIdFromQuery = useMemo(() => new URLSearchParams(location.search).get("employeeId") || "", [location.search]);
  const roleSet = useMemo(
    () => new Set(normalizeRoles(user?.roles || user?.role || [])),
    [user]
  );
  const canEditDirectory = roleSet.has("HR") || roleSet.has("ADMIN") || roleSet.has("IT");
  const canSeeSensitiveData = canEditDirectory;
  const isManagerOnlyView = roleSet.has("MANAGER") && !canEditDirectory;

  const { items: employees, total, loading, error, refetch } = useEmployees({
    search: searchQuery,
    ...filters,
    page,
    pageSize,
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const employeesShown = employees.length;
  const activeCount = useMemo(() => employees.filter((employee) => employee?.status === "ACTIVE").length, [employees]);
  const cddCount = useMemo(() => employees.filter((employee) => String(employee?.contractType || "") === "CDD").length, [employees]);
  const missingComplianceCount = useMemo(
    () => employees.filter((employee) => !employee?.cnss || !employee?.ipres).length,
    [employees]
  );
  const firstItemIndex = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItemIndex = Math.min(page * pageSize, total);

  const departmentOptions = useMemo(
    () => ["", ...Array.from(new Set(employees.map((employee) => employee?.department).filter(Boolean))).sort()],
    [employees]
  );
  const siteOptions = useMemo(
    () => ["", ...Array.from(new Set(employees.map((employee) => employee?.site).filter(Boolean))).sort()],
    [employees]
  );

  const quickViews = [
    { key: "all", label: "Tous", filters: { department: "", site: "", status: "" } },
    { key: "active", label: "Actifs", filters: { department: "", site: "", status: "ACTIVE" } },
    { key: "inactive", label: "Inactifs", filters: { department: "", site: "", status: "INACTIVE" } },
    { key: "dakar", label: "Site Dakar", filters: { department: "", site: "Dakar", status: "" } },
    { key: "hr", label: "RH", filters: { department: "RH", site: "", status: "" } },
  ];

  const hasActiveFilters = Boolean(searchQuery.trim() || filters.department || filters.site || filters.status);

  const handleCreateClick = () => {
    if (!canEditDirectory) return;
    setEditEmployee(null);
    setFormOpen(true);
  };

  const handleEditClick = (employee) => {
    if (!canEditDirectory) return;
    setEditEmployee(employee);
    setFormOpen(true);
  };

  const resetFilters = () => {
    setSearchQuery("");
    setPage(1);
    setFilters((current) => ({ ...current, department: "", site: "", status: "" }));
  };

  const saveCurrentView = () => {
    const next = {
      searchQuery,
      filters: { ...filters },
      label: filters.status ? `Vue ${filters.status.toLowerCase()}` : "Vue personnalisée",
    };
    try {
      localStorage.setItem(DIRECTORY_VIEW_STORAGE_KEY, JSON.stringify(next));
      setSavedView(next);
    } catch {
      setSavedView(next);
    }
  };

  const applySavedView = () => {
    if (!savedView) return;
    setSearchQuery(savedView.searchQuery || "");
    setFilters((current) => ({ ...current, ...(savedView.filters || {}) }));
    setPage(1);
  };

  const handleFormSubmit = async (values) => {
    try {
      if (editEmployee) await apiUpdateEmployee(editEmployee.id, values);
      else await apiCreateEmployee(values);
      setFormOpen(false);
      setEditEmployee(null);
      await refetch();
      emitEmployeesChanged({ action: editEmployee ? "update" : "create" });
      emitRefreshCounters();
    } catch (saveError) {
      alert(saveError?.message || "Erreur lors de la sauvegarde");
    }
  };

  useEffect(() => {
    if (!employeeIdFromQuery) return;
    setSelectedEmployeeId(employeeIdFromQuery);
  }, [employeeIdFromQuery]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <section className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/80 to-teal-50/60 shadow-sm">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-100 blur-3xl" />
        <div className="relative p-5 md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700/80">Employés</div>
              <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">{t("directory.title") || "Annuaire des employés"}</h1>
              <p className="max-w-2xl text-sm text-slate-600">
                Recherche instantanée, filtres rapides, vue sauvegardée et actions directes pour accéder au profil, contrat, documents ou absences {isManagerOnlyView ? "de votre équipe" : "de votre périmètre"}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={savedView ? applySavedView : undefined} disabled={!savedView}>
                Charger ma vue
              </Button>
              {canEditDirectory ? (
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleCreateClick}>
                  <Plus className="mr-2 h-4 w-4" /> Ajouter un employé
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-emerald-100 bg-white/90 p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Effectif affiché</div><div className="mt-2 text-3xl font-bold text-slate-900">{employeesShown}</div><div className="mt-1 text-xs text-slate-500">{total} salarié(s) au total</div></div>
            <div className="rounded-2xl border border-emerald-100 bg-white/90 p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Actifs</div><div className="mt-2 text-3xl font-bold text-emerald-700">{activeCount}</div><div className="mt-1 text-xs text-slate-500">sur cette page</div></div>
            <div className="rounded-2xl border border-emerald-100 bg-white/90 p-4"><div className="text-xs uppercase tracking-wide text-slate-500">CDD visibles</div><div className="mt-2 text-3xl font-bold text-amber-700">{cddCount}</div><div className="mt-1 text-xs text-slate-500">à suivre côté contrats</div></div>
            <div className="rounded-2xl border border-emerald-100 bg-white/90 p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Conformité à compléter</div><div className="mt-2 text-3xl font-bold text-rose-700">{missingComplianceCount}</div><div className="mt-1 text-xs text-slate-500">Références sociales ou retraite manquantes</div></div>
          </div>
        </div>
      </section>

      <SectionCard
        title={<span className="inline-flex items-center gap-2">Recherche & filtres <HelpTooltip content="Toutes les listes RH doivent rester actionnables: recherchez par nom, filtrez par site/département et sauvegardez votre vue la plus utilisée." /></span>}
        description="Moins de clics: recherche en direct, filtres visibles et réinitialisation immédiate."
        actions={
          hasActiveFilters ? (
            <Button variant="outline" size="sm" onClick={resetFilters} className="border-emerald-200 text-emerald-700">
              <FilterX className="mr-2 h-4 w-4" /> Réinitialiser
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={saveCurrentView}>Sauvegarder cette vue</Button>
          )
        }
        className="border-emerald-100 shadow-sm"
        contentClassName="space-y-4"
      >
        <div className="flex flex-col gap-3 xl:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Rechercher un nom, un poste ou un email"
              className="h-11 w-full rounded-xl border border-emerald-100 bg-white pl-10 pr-4"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:w-[500px]">
            <select className="h-11 rounded-xl border border-emerald-100 bg-white px-3" value={filters.department} onChange={(event) => { setFilters((current) => ({ ...current, department: event.target.value })); setPage(1); }}>
              <option value="">Tous les départements</option>
              {departmentOptions.filter(Boolean).map((department) => <option key={department} value={department}>{department}</option>)}
            </select>
            <select className="h-11 rounded-xl border border-emerald-100 bg-white px-3" value={filters.site} onChange={(event) => { setFilters((current) => ({ ...current, site: event.target.value })); setPage(1); }}>
              <option value="">Tous les sites</option>
              {siteOptions.filter(Boolean).map((site) => <option key={site} value={site}>{site}</option>)}
            </select>
            <select className="h-11 rounded-xl border border-emerald-100 bg-white px-3" value={filters.status} onChange={(event) => { setFilters((current) => ({ ...current, status: event.target.value })); setPage(1); }}>
              <option value="">Tous statuts</option>
              <option value="ACTIVE">Actifs</option>
              <option value="INACTIVE">Inactifs</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {quickViews.map((view) => {
            const isActive = filters.department === view.filters.department && filters.site === view.filters.site && filters.status === view.filters.status;
            return (
              <button
                key={view.key}
                type="button"
                onClick={() => {
                  setFilters((current) => ({ ...current, ...view.filters }));
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${isActive ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}
              >
                {view.label}
              </button>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="Liste des collaborateurs"
        description="Colonnes métiers essentielles pour la gestion RH quotidienne."
        actions={<span className="text-xs text-slate-500">{firstItemIndex}-{lastItemIndex} / {total}</span>}
        className="border-emerald-100 shadow-sm"
      >
        {loading ? (
          <TableSkeleton rows={8} cols={8} />
        ) : employees.length ? (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="border px-4 py-3">Nom</th>
                    <th className="border px-4 py-3">Poste</th>
                    <th className="border px-4 py-3">Département</th>
                    <th className="border px-4 py-3">Site</th>
                    <th className="border px-4 py-3">Manager</th>
                    <th className="border px-4 py-3">Type contrat</th>
                    <th className="border px-4 py-3">Statut</th>
                    <th className="border px-4 py-3">Ancienneté</th>
                    <th className="border px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => {
                    const managerName = employee?.manager ? `${employee.manager.firstName || ""} ${employee.manager.lastName || ""}`.trim() : "—";
                    return (
                      <tr key={employee.id} className="hover:bg-slate-50/70">
                        <td className="border px-4 py-3">
                          <button type="button" className="text-left" onClick={() => setSelectedEmployeeId(employee.id)}>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 bg-emerald-600">
                                <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 text-sm font-semibold text-white">{getInitials(employee)}</div>
                              </Avatar>
                              <div>
                                <div className="font-medium text-slate-900 underline decoration-dotted">{formatFullName(employee)}</div>
                                <div className="text-xs text-slate-500">{employee.email || "Email non renseigné"}</div>
                              </div>
                            </div>
                          </button>
                        </td>
                        <td className="border px-4 py-3">{employee.position || "—"}</td>
                        <td className="border px-4 py-3">{employee.department || "—"}</td>
                        <td className="border px-4 py-3">{employee.site || "—"}</td>
                        <td className="border px-4 py-3">{managerName || "—"}</td>
                        <td className="border px-4 py-3">
                          {employee.contractType ? <Badge variant="outline">{employee.contractType}</Badge> : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="border px-4 py-3"><StatusBadge status={employee.status || "ACTIVE"} /></td>
                        <td className="border px-4 py-3">{yearsOfService(employee.joinDate)}</td>
                        <td className="border px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => setSelectedEmployeeId(employee.id)}><Eye className="mr-2 h-4 w-4" /> Voir profil</Button>
                            <Button size="sm" variant="outline" onClick={() => navigate(`/people/documents?employeeId=${employee.id}`)}>Documents</Button>
                            <Button size="sm" variant="outline" onClick={() => navigate(`/people/contracts?employeeId=${employee.id}`)}>Contrat</Button>
                            <Button size="sm" variant="outline" onClick={() => navigate(`/operations/leaves?employeeId=${employee.id}`)}>Absences</Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-600">Affichage <span className="font-semibold text-slate-900">{firstItemIndex}-{lastItemIndex}</span> sur <span className="font-semibold text-slate-900">{total}</span> collaborateurs</div>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="border-emerald-200" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Précédent
                </Button>
                <span className="text-sm font-medium text-slate-700">Page {page} / {totalPages}</span>
                <Button variant="outline" className="border-emerald-200" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>
                  Suivant <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Users}
            title="Aucun employé trouvé"
            description={error || "Essayez d’élargir les filtres ou ajoutez un nouveau salarié."}
            actionLabel={canEditDirectory ? "Ajouter un employé" : ""}
            onAction={canEditDirectory ? handleCreateClick : null}
          />
        )}
      </SectionCard>

      <EmployeeFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditEmployee(null); }}
        onSubmit={handleFormSubmit}
        initialData={editEmployee}
      />

      <EmployeeProfile360
        employeeId={selectedEmployeeId}
        onClose={() => setSelectedEmployeeId(null)}
        onEdit={(employee) => handleEditClick(employee)}
        canEdit={canEditDirectory}
        canSeeSensitiveData={canSeeSensitiveData}
        canUploadDocuments={canEditDirectory}
      />
    </div>
  );
}

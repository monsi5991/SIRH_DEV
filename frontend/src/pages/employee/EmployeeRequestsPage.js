import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FilePlus2, Filter, FolderOpen, Search } from "lucide-react";
import { useApp } from "../../contexts/AppContext";
import PageHeader from "../../components/common/PageHeader";
import SectionCard from "../../components/common/SectionCard";
import SectionHeader from "../../components/common/SectionHeader";
import ActionCard from "../../components/common/ActionCard";
import InfoBanner from "../../components/common/InfoBanner";
import RequestStatusCard from "../../components/common/RequestStatusCard";
import TimelineList from "../../components/common/TimelineList";
import EmptyState from "../../components/common/EmptyState";
import StatusBadge from "../../components/common/StatusBadge";
import RequestCreateDrawer from "../../components/employee/RequestCreateDrawer";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../components/ui/sheet";
import useEmployeeRequests from "../../hooks/useEmployeeRequests";
import { deleteEmployeeRequestAttachment, uploadEmployeeRequestAttachment } from "../../lib/employeeSelfApi";
import { openSecureFileUrl } from "../../lib/secureFiles";
import { EMPLOYEE_REQUEST_SERVICES } from "./employeeSelfServiceConfig";
import { useToast } from "../../components/ui/use-toast";

const OPEN_STATUSES = new Set(["SUBMITTED", "PENDING_MANAGER", "PENDING_HR"]);
const CLOSED_STATUSES = new Set(["APPROVED", "REJECTED", "CANCELED", "CLOSED"]);

function getServiceById(id) {
  return EMPLOYEE_REQUEST_SERVICES.find((item) => item.id === id) || EMPLOYEE_REQUEST_SERVICES[0];
}

function employeeStatusLabel(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "PENDING_MANAGER" || normalized === "PENDING_HR") return "En cours";
  if (normalized === "APPROVED" || normalized === "CLOSED") return "Terminée";
  if (normalized === "REJECTED") return "Rejetée";
  if (normalized === "CANCELED") return "Annulée";
  if (normalized === "SUBMITTED") return "Reçue";
  return "Reçue";
}

function progressLabelForRequest(request) {
  const normalized = String(request?.status || "").toUpperCase();
  if (normalized === "PENDING_MANAGER") return "En cours de confirmation";
  if (normalized === "PENDING_HR") return "En cours de traitement";
  if (normalized === "APPROVED") return "Demande traitée";
  if (normalized === "REJECTED") return "À corriger puis renvoyer";
  if (normalized === "CANCELED") return "Demande annulée";
  if (normalized === "CLOSED") return "Demande traitée";
  return "Demande reçue";
}

function priorityLabel(value) {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "LOW") return "Basse";
  if (normalized === "HIGH") return "Importante";
  if (normalized === "URGENT") return "Urgente";
  return "Normale";
}

function requestTypeLabel(item) {
  if (item?.payload?.serviceLabel) return item.payload.serviceLabel;
  const normalized = String(item?.type || "").toUpperCase();
  const labels = {
    ATTESTATION: "Attestation",
    DATA_CHANGE: "Mise à jour de mes informations",
    REMOTE_WORK: "Télétravail",
    IT_ACCESS: "Accès ou support",
    PAYROLL_SUPPORT: "Question paie",
    OTHER: "Autre demande",
  };
  return labels[normalized] || "Demande";
}

function formatRequestDateTime(value) {
  if (!value) return "Date inconnue";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Date inconnue";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeTimelineActions(item, formatDate) {
  const actions = Array.isArray(item?.workflowInstance?.actions) ? item.workflowInstance.actions : [];
  if (!actions.length) {
    return [
      {
        id: `${item?.id || "request"}-submitted`,
        title: "Demande enregistrée",
        description: item?.description || "Votre demande a bien été transmise.",
        meta: item?.createdAt ? formatDate(item.createdAt) : "",
        status: item?.status || "SUBMITTED",
        statusLabel: employeeStatusLabel(item?.status || "SUBMITTED"),
      },
    ];
  }

  return actions.map((action) => ({
    id: action.id,
        title: action.displayActionLabel || String(action.action || "ACTION").replaceAll("_", " "),
    description: action.comment || "Mise à jour de la demande",
    meta: action.createdAt ? formatDate(action.createdAt) : "",
    submeta: [action.actorName, action.actorRoleLabel].filter(Boolean).join(" · "),
    status: action.status || item?.status || "SUBMITTED",
    statusLabel: employeeStatusLabel(action.status || item?.status || "SUBMITTED"),
  }));
}

function payloadEntries(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  return Object.entries(payload).filter(([key, value]) => key !== "attachments" && value != null && value !== "");
}

function formatPayloadKey(key) {
  return String(key || "")
    .replace(/([A-Z])/g, " $1")
    .replaceAll("_", " ")
    .replace(/^\w/, (char) => char.toUpperCase())
    .trim();
}

const INITIAL_FORM = {
  title: "",
  description: "",
  priority: "NORMAL",
  payload: {},
};

export default function EmployeeRequestsPage() {
  const { formatDate } = useApp();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    items,
    loading,
    detailLoading,
    creating,
    commenting,
    error,
    selectedRequest,
    reload,
    loadDetail,
    create,
    cancel,
    addComment,
  } = useEmployeeRequests();

  const requestedService = searchParams.get("service");
  const createOpen = searchParams.get("new") === "1";
  const [selectedServiceId, setSelectedServiceId] = useState(requestedService || EMPLOYEE_REQUEST_SERVICES[0].id);
  const [search, setSearch] = useState("");
  const [viewFilter, setViewFilter] = useState("open");
  const [detailOpen, setDetailOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");

  useEffect(() => {
    if (requestedService) setSelectedServiceId(requestedService);
  }, [requestedService]);

  useEffect(() => {
    setCommentDraft("");
  }, [selectedRequest?.id, detailOpen]);

  const selectedService = useMemo(() => getServiceById(selectedServiceId), [selectedServiceId]);
  const frequentServices = useMemo(() => EMPLOYEE_REQUEST_SERVICES.slice(0, 4), []);

  const visibleItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return items
      .filter((item) => {
        const status = String(item.status || "").toUpperCase();
        if (viewFilter === "open") return OPEN_STATUSES.has(status);
        if (viewFilter === "in_progress") return status === "PENDING_MANAGER" || status === "PENDING_HR";
        if (viewFilter === "closed") return CLOSED_STATUSES.has(status);
        return true;
      })
      .filter((item) => {
        if (!normalizedSearch) return true;
        return [item.title, item.type, item.description]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      });
  }, [items, search, viewFilter]);

  const requestCards = useMemo(
    () =>
      visibleItems.map((item) => ({
        ...item,
        typeLabel: requestTypeLabel(item),
        dateLabel: item.createdAt ? formatDate(item.createdAt) : "Date inconnue",
        description: item.description || "Aucun détail complémentaire",
        progressLabel: progressLabelForRequest(item),
        statusLabel: employeeStatusLabel(item.status),
        priorityLabel: item.priority ? priorityLabel(item.priority) : "",
      })),
    [visibleItems, formatDate]
  );

  const recentItems = requestCards.slice(0, 6);

  const setQueryParams = (updates) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value == null || value === "") next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next);
  };

  const openCreateDrawer = (serviceId = selectedServiceId) => {
    setSelectedServiceId(serviceId);
    setQueryParams({ new: "1", service: serviceId });
  };

  const discardDraftAttachments = async (attachments) => {
    const currentAttachments = Array.isArray(attachments) ? attachments : [];
    if (!currentAttachments.length) return;
    await Promise.allSettled(
      currentAttachments
        .map((attachment) => attachment?.id)
        .filter(Boolean)
        .map((attachmentId) => deleteEmployeeRequestAttachment(attachmentId))
    );
  };

  const clearForm = () => setForm(INITIAL_FORM);

  const handleCreateDrawerChange = async (open) => {
    if (!open) {
      await discardDraftAttachments(form.payload.attachments);
      clearForm();
      setQueryParams({ new: null });
    }
  };

  const handleServiceChange = (serviceId) => {
    setSelectedServiceId(serviceId);
    setQueryParams({ service: serviceId, ...(createOpen ? { new: "1" } : {}) });
  };

  const resetForm = async () => {
    await discardDraftAttachments(form.payload.attachments);
    clearForm();
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePayloadChange = (fieldId, value) => {
    setForm((prev) => ({
      ...prev,
      payload: {
        ...prev.payload,
        [fieldId]: value,
      },
    }));
  };

  const handleAttachmentUpload = async (files) => {
    const nextFiles = Array.from(files || []);
    if (!nextFiles.length) return;

    setAttachmentUploading(true);
    try {
      const uploaded = [];
      for (const file of nextFiles) {
        const formData = new FormData();
        formData.append("file", file);
        const attachment = await uploadEmployeeRequestAttachment(formData);
        uploaded.push(attachment);
      }
      setForm((prev) => ({
        ...prev,
        payload: {
          ...prev.payload,
          attachments: [...(Array.isArray(prev.payload.attachments) ? prev.payload.attachments : []), ...uploaded],
        },
      }));
      toast({
        title: "Pièce jointe ajoutée",
        description: `${uploaded.length} fichier(s) prêt(s) à être envoyé(s) avec la demande.`,
      });
    } catch (e) {
      toast({
        title: "Ajout impossible",
        description: e?.message || "La pièce jointe n'a pas pu être envoyée.",
        variant: "destructive",
      });
    } finally {
      setAttachmentUploading(false);
    }
  };

  const handleRemoveAttachment = (attachmentId) => {
    deleteEmployeeRequestAttachment(attachmentId)
      .catch(() => null)
      .finally(() => {
        setForm((prev) => ({
          ...prev,
          payload: {
            ...prev.payload,
            attachments: (Array.isArray(prev.payload.attachments) ? prev.payload.attachments : []).filter(
              (item) => item.id !== attachmentId
            ),
          },
        }));
      });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedService) return;

    if (!form.description.trim()) {
      toast({
        title: "Description requise",
        description: "Décrivez votre besoin pour faciliter le traitement de votre demande.",
        variant: "destructive",
      });
      return;
    }

    try {
      const created = await create({
        type: selectedService.backendType,
        title: form.title.trim() || selectedService.title,
        description: form.description.trim(),
        priority: form.priority,
        payload: {
          serviceId: selectedService.id,
          serviceLabel: selectedService.label,
          ...form.payload,
        },
      });

      toast({
        title: "Demande créée",
        description: "Votre demande a bien été enregistrée.",
      });
      clearForm();
      setQueryParams({ new: null, service: selectedService.id });
      if (created?.id) {
        await loadDetail(created.id);
        setDetailOpen(true);
      }
    } catch (e) {
      toast({
        title: "Création impossible",
        description: e?.message || "La demande n'a pas pu être créée.",
        variant: "destructive",
      });
    }
  };

  const openRequestDetail = async (request) => {
    await loadDetail(request.id);
    setCommentDraft("");
    setDetailOpen(true);
  };

  const cancelRequest = async (request) => {
    try {
      await cancel(request.id);
      toast({
        title: "Demande annulée",
        description: "La demande a bien été annulée.",
      });
    } catch (e) {
      toast({
        title: "Annulation impossible",
        description: e?.message || "La demande n'a pas pu être annulée.",
        variant: "destructive",
      });
    }
  };

  const handleAddComment = async (event) => {
    event.preventDefault();
    const message = commentDraft.trim();
    if (!selectedRequest?.id || !message) return;

    try {
      await addComment(selectedRequest.id, message);
      setCommentDraft("");
      toast({
        title: "Commentaire envoyé",
        description: "Votre message a été ajouté au fil d'échange de la demande.",
      });
    } catch (e) {
      toast({
        title: "Envoi impossible",
        description: e?.message || "Le commentaire n'a pas pu être envoyé.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Mes demandes"
        description="Créez une demande quand vous en avez besoin, puis suivez simplement où elle en est."
        actions={(
          <>
            <Button variant="outline" onClick={reload}>Rafraîchir</Button>
            <Button onClick={() => openCreateDrawer()}>
              <FilePlus2 className="h-4 w-4" />
              Nouvelle demande
            </Button>
          </>
        )}
      />

      {error ? (
        <InfoBanner tone="warning" title="Chargement partiel" description={error} />
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <SectionCard>
          <SectionHeader
            title="Services fréquents"
            description="Quelques services courants pour démarrer vite. Les autres restent disponibles dans le drawer de création."
            actions={<Button variant="outline" onClick={() => openCreateDrawer()}>Voir tous les services</Button>}
          />
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {frequentServices.map((service) => (
              <ActionCard
                key={service.id}
                title={service.label}
                description={service.description}
                primaryActionLabel="Créer une demande"
                onPrimaryAction={() => openCreateDrawer(service.id)}
                tone={selectedServiceId === service.id ? "success" : "neutral"}
              />
            ))}
          </div>
        </SectionCard>

        <SectionCard>
          <SectionHeader
            title="Suivi de mes demandes"
            description="Filtrez vos demandes et ouvrez le détail seulement quand c'est utile."
            actions={(
              <div className="relative min-w-[220px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un objet ou un type"
                  className="pl-10"
                />
              </div>
            )}
          />

          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { id: "open", label: "Ouvertes" },
              { id: "in_progress", label: "En cours" },
              { id: "closed", label: "Clôturées" },
              { id: "all", label: "Toutes" },
            ].map((filter) => (
              <Button
                key={filter.id}
                variant={viewFilter === filter.id ? "default" : "outline"}
                size="sm"
                onClick={() => setViewFilter(filter.id)}
              >
                <Filter className="h-3.5 w-3.5" />
                {filter.label}
              </Button>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="text-sm text-slate-500">Chargement des demandes…</div>
            ) : recentItems.length ? (
              recentItems.map((request) => (
                <RequestStatusCard
                  key={request.id}
                  request={request}
                  onSelect={openRequestDetail}
                  onCancel={cancelRequest}
                  canCancel={OPEN_STATUSES.has(String(request.status || "").toUpperCase())}
                />
              ))
            ) : (
              <EmptyState
                icon={FolderOpen}
                title="Aucune demande à afficher"
                description="Changez de filtre ou ouvrez une nouvelle demande RH."
                actionLabel="Créer une demande"
                onAction={() => openCreateDrawer()}
              />
            )}
          </div>
        </SectionCard>
      </div>

      <RequestCreateDrawer
        open={createOpen}
        onOpenChange={handleCreateDrawerChange}
        services={EMPLOYEE_REQUEST_SERVICES}
        selectedServiceId={selectedServiceId}
        onServiceChange={handleServiceChange}
        selectedService={selectedService}
        form={form}
        onFormChange={handleFormChange}
        onPayloadChange={handlePayloadChange}
        attachments={Array.isArray(form.payload.attachments) ? form.payload.attachments : []}
        onFilesSelected={handleAttachmentUpload}
        onRemoveAttachment={handleRemoveAttachment}
        attachmentUploading={attachmentUploading}
        onSubmit={handleSubmit}
        onReset={resetForm}
        creating={creating}
      />

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{selectedRequest?.title || "Détail de la demande"}</SheetTitle>
            <SheetDescription>
              {selectedRequest
                ? `${requestTypeLabel(selectedRequest)} · ${selectedRequest.createdAt ? formatDate(selectedRequest.createdAt) : "Date inconnue"}`
                : "Suivi détaillé de votre demande."}
            </SheetDescription>
          </SheetHeader>

          {detailLoading ? (
            <div className="mt-6 text-sm text-slate-500">Chargement du détail…</div>
          ) : selectedRequest ? (
            <div className="mt-6 space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Statut</p>
                    <StatusBadge status={selectedRequest.status} label={employeeStatusLabel(selectedRequest.status)} />
                  </div>
                  {selectedRequest.priority ? (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Priorité</p>
                      <p className="text-sm font-medium text-slate-900">{priorityLabel(selectedRequest.priority)}</p>
                    </div>
                  ) : null}
                </div>
                <p className="mt-4 text-sm text-slate-700">
                  {selectedRequest.description || "Aucune description complémentaire."}
                </p>
              </div>

              {payloadEntries(selectedRequest.payload).length ? (
                <SectionCard
                  title="Informations transmises"
                  description="Données communiquées au moment de la création de la demande."
                >
                  <div className="mt-4 space-y-3">
                    {payloadEntries(selectedRequest.payload).map(([key, value]) => (
                      <div key={key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{formatPayloadKey(key)}</p>
                        <p className="mt-2 text-sm text-slate-900">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              ) : null}

              {Array.isArray(selectedRequest.payload?.attachments) && selectedRequest.payload.attachments.length ? (
                <SectionCard
                  title="Pièces jointes"
                  description="Fichiers transmis avec la demande."
                >
                  <div className="mt-4 space-y-3">
                    {selectedRequest.payload.attachments.map((attachment) => (
                      <div key={attachment.id || attachment.url} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{attachment.name || "Pièce jointe"}</p>
                          <p className="text-xs text-slate-500">{attachment.mimeType || "Fichier"}</p>
                        </div>
                        {attachment.url ? (
                          <Button variant="outline" size="sm" onClick={() => openSecureFileUrl(attachment.url)}>
                            Ouvrir
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </SectionCard>
              ) : null}

              <SectionCard
                title="Échanges"
                description="Ajoutez une précision ou répondez à l'équipe en charge sans quitter le détail."
              >
                <div className="mt-4 space-y-3">
                  {Array.isArray(selectedRequest.conversation) && selectedRequest.conversation.length ? (
                    selectedRequest.conversation.map((comment) => (
                      <div
                        key={comment.id || `${comment.createdAt}-${comment.authorId || "system"}`}
                        className={`rounded-2xl border p-4 shadow-sm ${
                          comment.isOwnMessage
                            ? "border-emerald-200 bg-emerald-50/70"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900">{comment.authorName || "Utilisateur"}</p>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                                {comment.authorRoleLabel || "Échange"}
                              </span>
                              {comment.actionLabel && comment.actionLabel !== "Commentaire" ? (
                                <span className="text-xs text-slate-500">{comment.actionLabel}</span>
                              ) : null}
                            </div>
                            <p className="text-xs text-slate-500">{formatRequestDateTime(comment.createdAt)}</p>
                          </div>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{comment.message}</p>
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      icon={FolderOpen}
                      title="Pas encore d'échange"
                      description="Le fil apparaîtra ici dès qu'un message sera ajouté par vous ou par l'équipe en charge."
                      compact
                    />
                  )}
                </div>

                <form onSubmit={handleAddComment} className="mt-4 space-y-3">
                  <Textarea
                    rows={3}
                    value={commentDraft}
                    onChange={(event) => setCommentDraft(event.target.value)}
                    placeholder="Ajouter un commentaire ou une précision utile…"
                  />
                  <div className="flex justify-end">
                    <Button type="submit" disabled={commenting || !commentDraft.trim()}>
                      {commenting ? "Envoi…" : "Envoyer le commentaire"}
                    </Button>
                  </div>
                </form>
              </SectionCard>

              <SectionCard
                title="Étapes de la demande"
                description="Les principales étapes enregistrées pour votre demande."
              >
                <div className="mt-4">
                  <TimelineList
                    items={normalizeTimelineActions(selectedRequest, formatDate)}
                    emptyTitle="Pas encore d'étape détaillée"
                    emptyDescription="Les étapes apparaîtront ici dès qu'une mise à jour sera enregistrée."
                  />
                </div>
              </SectionCard>
            </div>
          ) : (
            <EmptyState
              icon={FolderOpen}
              title="Aucune demande sélectionnée"
              description="Choisissez une demande depuis la liste pour afficher son détail."
              compact
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

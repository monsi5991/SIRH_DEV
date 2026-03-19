import React from "react";
import PropTypes from "prop-types";
import { Info, Paperclip, SendHorizontal, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import InfoBanner from "../common/InfoBanner";

export default function RequestCreateDrawer({
  open,
  onOpenChange,
  services,
  selectedServiceId,
  onServiceChange,
  selectedService,
  form,
  onFormChange,
  onPayloadChange,
  attachments,
  onFilesSelected,
  onRemoveAttachment,
  attachmentUploading,
  onSubmit,
  onReset,
  creating,
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Nouvelle demande RH</SheetTitle>
          <SheetDescription>
            Choisissez un service, décrivez votre besoin et envoyez votre demande sans encombrer la vue principale.
          </SheetDescription>
        </SheetHeader>

        <InfoBanner
          className="mt-6"
          tone="info"
          title="Pièces jointes"
          description="Ajoutez si besoin un ou plusieurs fichiers utiles au traitement de la demande."
        />

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="request-service">Service</Label>
              <select
                id="request-service"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={selectedServiceId}
                onChange={(e) => onServiceChange(e.target.value)}
              >
                {services.map((service) => (
                  <option key={service.id} value={service.id}>{service.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="request-priority">Priorité</Label>
              <select
                id="request-priority"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.priority}
                onChange={(e) => onFormChange("priority", e.target.value)}
              >
                <option value="LOW">Basse</option>
                <option value="NORMAL">Normale</option>
                <option value="HIGH">Haute</option>
                <option value="URGENT">Urgente</option>
              </select>
            </div>
          </div>

          {selectedService ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-600">
                  <Info className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">{selectedService.label}</p>
                  <p className="text-sm text-slate-600">{selectedService.description}</p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="space-y-1">
            <Label htmlFor="request-title">Objet</Label>
            <Input
              id="request-title"
              value={form.title}
              onChange={(e) => onFormChange("title", e.target.value)}
              placeholder={selectedService?.title || "Ex. Demande RH"}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="request-description">Description</Label>
            <Textarea
              id="request-description"
              rows={5}
              value={form.description}
              onChange={(e) => onFormChange("description", e.target.value)}
              placeholder="Précisez le contexte, l'attendu et toute échéance utile."
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {selectedService?.payloadFields?.map((field) => (
              <div key={field.id} className="space-y-1">
                <Label htmlFor={`payload-${field.id}`}>{field.label}</Label>
                {field.type === "textarea" ? (
                  <Textarea
                    id={`payload-${field.id}`}
                    rows={4}
                    value={form.payload[field.id] || ""}
                    onChange={(e) => onPayloadChange(field.id, e.target.value)}
                    placeholder={field.placeholder || ""}
                  />
                ) : (
                  <Input
                    id={`payload-${field.id}`}
                    type={field.type}
                    value={form.payload[field.id] || ""}
                    onChange={(e) => onPayloadChange(field.id, e.target.value)}
                    placeholder={field.placeholder || ""}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="request-attachments">Pièces jointes</Label>
            <Input
              id="request-attachments"
              type="file"
              multiple
              onChange={(e) => {
                onFilesSelected(e.target.files);
                e.target.value = "";
              }}
            />
            <p className="text-xs text-slate-500">Formats acceptés: PDF, JPG, PNG, WEBP, DOC, DOCX.</p>
            {attachmentUploading ? (
              <p className="text-xs text-slate-500">Envoi des pièces jointes…</p>
            ) : null}
            {attachments.length ? (
              <div className="space-y-2">
                {attachments.map((attachment) => (
                  <div key={attachment.id || attachment.url} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Paperclip className="h-4 w-4 text-slate-500" />
                      <p className="truncate text-sm text-slate-900">{attachment.name || "Pièce jointe"}</p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => onRemoveAttachment(attachment.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" disabled={creating || attachmentUploading}>
              <SendHorizontal className="h-4 w-4" />
              {creating ? "Création…" : "Envoyer la demande"}
            </Button>
            <Button type="button" variant="outline" onClick={onReset}>
              Réinitialiser
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

RequestCreateDrawer.propTypes = {
  open: PropTypes.bool,
  onOpenChange: PropTypes.func,
  services: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      title: PropTypes.string,
      description: PropTypes.string,
      payloadFields: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string.isRequired,
          label: PropTypes.string.isRequired,
          type: PropTypes.string,
          placeholder: PropTypes.string,
        })
      ),
    })
  ),
  selectedServiceId: PropTypes.string,
  onServiceChange: PropTypes.func,
  selectedService: PropTypes.shape({
    id: PropTypes.string,
    label: PropTypes.string,
    title: PropTypes.string,
    description: PropTypes.string,
    payloadFields: PropTypes.array,
  }),
  form: PropTypes.shape({
    title: PropTypes.string,
    description: PropTypes.string,
    priority: PropTypes.string,
    payload: PropTypes.object,
  }),
  onFormChange: PropTypes.func,
  onPayloadChange: PropTypes.func,
  attachments: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
      url: PropTypes.string,
    })
  ),
  onFilesSelected: PropTypes.func,
  onRemoveAttachment: PropTypes.func,
  attachmentUploading: PropTypes.bool,
  onSubmit: PropTypes.func,
  onReset: PropTypes.func,
  creating: PropTypes.bool,
};

RequestCreateDrawer.defaultProps = {
  open: false,
  onOpenChange: () => {},
  services: [],
  selectedServiceId: "",
  onServiceChange: () => {},
  selectedService: null,
  form: {
    title: "",
    description: "",
    priority: "NORMAL",
    payload: {},
  },
  onFormChange: () => {},
  onPayloadChange: () => {},
  attachments: [],
  onFilesSelected: () => {},
  onRemoveAttachment: () => {},
  attachmentUploading: false,
  onSubmit: () => {},
  onReset: () => {},
  creating: false,
};

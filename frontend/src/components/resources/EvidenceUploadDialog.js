import React, { useState } from "react";
import PropTypes from "prop-types";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";

const UrlSchema = z.string().url("URL invalide").optional().or(z.literal(""));

export default function EvidenceUploadDialog({ open, onClose, onUploadFile, onSaveUrl }) {
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!file && !url) {
      setError("Choisissez un fichier ou une URL de preuve.");
      return;
    }
    if (url) {
      const ok = UrlSchema.safeParse(url);
      if (!ok.success) {
        setError(ok.error.issues[0]?.message || "URL invalide");
        return;
      }
    }
    setSaving(true);
    try {
      if (file) await onUploadFile(file);
      else await onSaveUrl(url);
      onClose();
      setFile(null);
      setUrl("");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Ajouter une preuve</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div>
            <label className="text-sm">Fichier</label>
            <input type="file" className="w-full border rounded-lg px-3 py-2" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <div className="text-xs text-gray-500 text-center">ou</div>
          <div>
            <label className="text-sm">URL</label>
            <input className="w-full border rounded-lg px-3 py-2" placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Annuler</Button><Button type="submit" disabled={saving}>{saving ? "Envoi..." : "Valider"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

EvidenceUploadDialog.propTypes = { open: PropTypes.bool.isRequired, onClose: PropTypes.func.isRequired, onUploadFile: PropTypes.func.isRequired, onSaveUrl: PropTypes.func.isRequired };

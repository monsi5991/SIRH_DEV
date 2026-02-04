// src/features/leaves/components/LeaveDetailsPanel.jsx
import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { X, MessageSquare, History } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { LeavesAPI } from "../api/leaves.client";
import { useToast } from "../../../components/ui/use-toast";

const MIN_SKELETON_MS = 180;

export default function LeaveDetailsPanel({ id, open, onClose, formatDate }) {
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [leave, setLeave] = useState(null);
  const [logs, setLogs] = useState([]);
  const [comments, setComments] = useState([]);
  const [message, setMessage] = useState("");

  const dialogRef = useRef(null);
  const abortRef = useRef(null);
  const lastLoadedRef = useRef(null); // empêche un re-load inutile avec le même id

  // Lock scroll body quand ouvert
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevOverflow; };
  }, [open]);

  // Focus + Échap
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    dialogRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [open, onClose]);

  // Chargement data (⚠️ dépendances SANS `toast` pour éviter la boucle)
  useEffect(() => {
    if (!open || !id) return;

    // si on a déjà chargé ce même id et que le panneau est toujours ouvert, ne rien refaire
    if (lastLoadedRef.current === id && leave) return;

    // Annule la requête précédente
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // reset d'état
    setNotFound(false);
    setLeave(null);
    setLogs([]);
    setComments([]);
    setLoading(true);

    const t0 = Date.now();

    (async () => {
      try {
        // 1) Détails (avec fallback côté client)
        const d = await LeavesAPI.one(id);
        if (controller.signal.aborted) return;

        const found = d?.leave || null;
        setLeave(found);
        setLogs(Array.isArray(d?.logs) ? d.logs : []);

        // 2) Commentaires (optionnels)
        try {
          const c = await LeavesAPI.comments.list(id);
          if (!controller.signal.aborted) {
            setComments(Array.isArray(c?.comments) ? c.comments : []);
          }
        } catch {
          if (!controller.signal.aborted) setComments([]);
        }

        const elapsed = Date.now() - t0;
        const wait = elapsed < MIN_SKELETON_MS ? MIN_SKELETON_MS - elapsed : 0;
        await new Promise((r) => setTimeout(r, wait));
        if (controller.signal.aborted) return;

        setNotFound(!found);
        lastLoadedRef.current = id;
      } catch (e) {
        if (!controller.signal.aborted) {
          // Erreur réseau → on notifie, mais pas de boucle
          // (ne pas mettre `toast` en dépendance de l’effet)
          toast({ title: "Erreur de chargement", description: e?.message, variant: "destructive" });
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
    // ⛔ NE PAS AJOUTER `toast` ICI — il change d'identité à chaque render !
  }, [open, id]); // ← deps corrigées

  async function addComment() {
    if (!message.trim()) return;
    try {
      const r = await LeavesAPI.comments.add(id, message.trim());
      setComments((c) => [...c, r.comment]);
      setMessage("");
    } catch (e) {
      toast({ title: "Impossible d’ajouter le commentaire", description: e?.message, variant: "destructive" });
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/40" onClick={onClose} aria-hidden>
      <aside
        className="absolute right-0 top-0 h-full w-full sm:w-[520px] bg-white shadow-xl p-4 overflow-y-auto outline-none"
        role="dialog" aria-modal="true" aria-label="Détails du congé"
        tabIndex={-1} ref={dialogRef} onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-lg">Détails du congé</h2>
          <button aria-label="Fermer" onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X />
          </button>
        </div>

        {loading ? (
          <PanelSkeleton />
        ) : notFound ? (
          <p className="text-sm text-red-600">Demande introuvable.</p>
        ) : !leave ? (
          <PanelSkeleton />
        ) : (
          <>
            <div className="space-y-1 mb-4">
              <div className="text-sm text-gray-600">{leave.employee || "—"}</div>
              <div className="text-sm">
                {(formatDate?.(leave.start)) || "—"} — {(formatDate?.(leave.end)) || "—"}
              </div>
              <div className="text-sm">
                Type&nbsp;: {leave.type || "—"} · ½ journée&nbsp;: {leave.halfDay || "—"} · Payé&nbsp;: {leave.paid ? "Oui" : "Non"}
              </div>
              <div className="text-sm">
                Demandé le&nbsp;: {leave.createdAt ? (formatDate?.(leave.createdAt) || new Date(leave.createdAt).toLocaleDateString("fr-FR")) : "—"}
              </div>
              <Badge className="mt-2">{leave.status || "—"}</Badge>
            </div>

            <section className="mb-6">
              <h3 className="flex items-center gap-2 font-medium text-sm text-gray-700 mb-2">
                <History className="w-4 h-4" /> Historique
              </h3>
              <ul className="space-y-2">
                {(logs || []).length ? (
                  logs.map((l) => (
                    <li key={l.id || `${l.action}-${l.createdAt}`} className="text-sm">
                      <span className="font-medium">{l.action}</span>
                      {(l.fromStatus || l.toStatus) ? (<> ({l.fromStatus ?? "—"} → {l.toStatus ?? "—"})</>) : null}
                      {l.reason ? <> — {l.reason}</> : null}
                      <span className="text-gray-500"> · {l.createdAt ? new Date(l.createdAt).toLocaleString() : ""}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-gray-500">Aucun historique.</li>
                )}
              </ul>
            </section>

            <section>
              <h3 className="flex items-center gap-2 font-medium text-sm text-gray-700 mb-2">
                <MessageSquare className="w-4 h-4" /> Commentaires
              </h3>
              <div className="space-y-2 mb-3">
                {(comments || []).length ? (
                  comments.map((c) => (
                    <div key={c.id || `c-${c.createdAt}`} className="text-sm border rounded p-2">
                      <div className="text-gray-600">{c.createdAt ? new Date(c.createdAt).toLocaleString() : ""}</div>
                      <div>{c.message}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-500">Aucun commentaire.</div>
                )}
              </div>
              <div className="flex items-start gap-2">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={2}
                  className="flex-1 border rounded p-2"
                  placeholder="Ajouter un commentaire…"
                />
                <Button onClick={addComment}>Envoyer</Button>
              </div>
            </section>
          </>
        )}
      </aside>
    </div>
  );
}

LeaveDetailsPanel.propTypes = {
  id: PropTypes.string,
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  formatDate: PropTypes.func,
};

function PanelSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-4 bg-gray-200 rounded w-1/3" />
      <div className="h-4 bg-gray-200 rounded w-1/2" />
      <div className="h-4 bg-gray-200 rounded w-2/3" />
      <div className="h-4 bg-gray-200 rounded w-1/4" />
      <div className="h-40 bg-gray-100 rounded" />
      <div className="h-24 bg-gray-100 rounded" />
    </div>
  );
}

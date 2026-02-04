// src/pages/operations/LeavesPage.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { post, put, get, API_BASE_URL } from "../../lib/api";
import { useApp } from "../../contexts/AppContext";
import {
  Calendar, Plus, Search as SearchIcon,
  CheckCircle, XCircle, Clock, Download
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import LeaveFormDialog from "../../components/operations/LeaveFormDialog";
import ReasonDialog from "../../components/operations/ReasonDialog";
import BulkBar from "../../components/operations/BulkBar";
import LeaveDetailsPanel from "../../features/leaves/components/LeaveDetailsPanel";
import { useToast } from "../../components/ui/use-toast";

const TABS = ["pending", "approved", "rejected"];
const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 50));

export default function LeavesPage() {
  const { t, formatDate, refreshValidationCounts } = useApp();
  const { toast } = useToast();
  const location = useLocation();

  // Onglets ↔ status
  const [activeTab, setActiveTab] = useState("pending");

  // Données (on charge TOUT puis on filtre côté client)
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Recherche simple (champ du header)
  const [q, setQ] = useState("");

  // Sélection/bulk
  const [selected, setSelected] = useState(() => new Set());
  const [mutatingIds, setMutatingIds] = useState(() => new Set());
  const [bulkAction, setBulkAction] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [reasonDialog, setReasonDialog] = useState(null); // { id, status } | null

  // Détails panneau latéral
  const [detailsId, setDetailsId] = useState(null);

  // anti-flicker
  const cacheRef = useRef({ rows: [], ts: 0 });
  const abortRef = useRef(null);

  // deep-link une seule fois
  const deepLinkedRef = useRef(false);

  // refs pour deep-link highlight
  const refs = useRef({});
  const getRef = (id) => {
    if (!refs.current[id]) refs.current[id] = React.createRef();
    return refs.current[id];
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Approved": return "bg-green-100 text-green-800";
      case "Rejected": return "bg-red-100 text-red-800";
      case "Pending":  return "bg-orange-100 text-orange-800";
      default:         return "bg-gray-100 text-gray-800";
    }
  };
  const getStatusIcon = (status) => {
    switch (status) {
      case "Approved": return <CheckCircle className="w-4 h-4" />;
      case "Rejected": return <XCircle className="w-4 h-4" />;
      default:         return <Clock className="w-4 h-4" />;
    }
  };

  // ======= LOAD (client-driven) — on charge toutes les demandes une fois =======
  const load = async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setErr("");
    setLoading(true);

    try {
      const res = await get("/operations/leaves", { signal: controller.signal });
      const list = Array.isArray(res?.leaves) ? res.leaves : Array.isArray(res) ? res : [];
      cacheRef.current = { rows: list, ts: Date.now() };
      setLeaves(list);
    } catch (e) {
      if (e.name !== "AbortError") {
        setErr(e?.message || "Erreur lors du chargement des congés");
        setLeaves(cacheRef.current.rows.length ? cacheRef.current.rows : []);
      }
    } finally {
      setLoading(false);
      idle(() => refreshValidationCounts?.().catch(() => undefined));
    }
  };

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deep-link (onglet + highlight ligne) — une seule fois
  useEffect(() => {
    if (deepLinkedRef.current) return;
    const sp = new URLSearchParams(location.search);
    const qId = sp.get("request");
    const hashId = location.hash?.startsWith("#leave-") ? location.hash.slice(7) : null;
    const targetId = qId || hashId;
    if (!targetId || leaves.length === 0) return;

    const target = leaves.find((l) => l.id === targetId);
    if (target?.status) {
      const key = String(target.status).toLowerCase();
      if (TABS.includes(key)) setActiveTab(key);
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = refs.current[targetId]?.current;
        if (el) {
          try {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("row-highlight");
            setTimeout(() => el.classList.remove("row-highlight"), 1500);
          } catch { /* ignore */ }
        }
      });
    });

    deepLinkedRef.current = true;
  }, [location.search, location.hash, leaves]);

  // ======= Filtres & compteurs côté client =======
  const filteredBySearch = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return leaves;
    return leaves.filter((l) => {
      const hay = [
        l.employee, l.status, l.type, l.halfDay,
        l.paid === true ? "oui" : l.paid === false ? "non" : "",
      ].join(" ").toLowerCase();
      return hay.includes(term);
    });
  }, [leaves, q]);

  const buckets = useMemo(() => ({
    pending:  filteredBySearch.filter((l) => l.status === "Pending"),
    approved: filteredBySearch.filter((l) => l.status === "Approved"),
    rejected: filteredBySearch.filter((l) => l.status === "Rejected"),
  }), [filteredBySearch]);

  // ======= Helpers sélection =======
  const isSelected = (id) => selected.has(id);
  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleAllVisible = () => {
    const list = buckets[activeTab];
    setSelected((prev) => {
      const next = new Set(prev);
      const ids = list.map((r) => r.id);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };
  // reset sélection si on change d’onglet / recherche
  useEffect(() => { setSelected(new Set()); }, [activeTab, q]);

  // ======= Mutations =======
  const updateStatusOptimistic = async ({ id, status, reason }) => {
    setMutatingIds((s) => new Set(s).add(id));
    const prev = leaves;
    // optimiste local
    setLeaves((old) => old.map((l) => (l.id === id ? { ...l, status } : l)));
    try {
      await put(`/operations/leaves/${id}/status`, { status, reason });
      toast({ title: status === "Approved" ? "Demande approuvée" : "Demande rejetée" });
      idle(() => {
        refreshValidationCounts?.().catch(() => undefined);
        window.dispatchEvent(new CustomEvent("app:counters:refresh"));
      });
    } catch (e) {
      // rollback
      setLeaves(prev);
      toast({ title: "Échec de la mise à jour", description: e?.message, variant: "destructive" });
    } finally {
      setMutatingIds((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  };

  const approve = (id) => setReasonDialog({ id, status: "Approved" });
  const reject  = (id) => setReasonDialog({ id, status: "Rejected" });

  const handleConfirmReason = async (reason) => {
    if (!reasonDialog) return;
    const { id, status } = reasonDialog;
    setReasonDialog(null);
    await updateStatusOptimistic({ id, status, reason: sanitizeReason(status, reason) });
  };

  // Création
  const handleCreateLeave = async ({ employee, start, end, type, paid, halfDay }) => {
    try {
      const payload = { employee, start, end, status: "Pending" };
      if (type) payload.type = type;
      if (typeof paid === "boolean") payload.paid = paid;
      if (halfDay) payload.halfDay = halfDay;

      const res = await post("/operations/leaves", payload);
      const created = res?.leave || res;

      setLeaves((prev) => [created, ...prev].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      setFormOpen(false);
      toast({ title: "Demande créée", description: "En attente d’approbation." });
      idle(() => {
        refreshValidationCounts?.().catch(() => undefined);
        window.dispatchEvent(new CustomEvent("app:counters:refresh"));
      });
    } catch (e) {
      toast({ title: "Échec de la création", description: e?.message, variant: "destructive" });
    }
  };

  // Bulk
  const doBulk = async (status, reason) => {
    const ids = Array.from(selected).filter((id) => {
      const r = leaves.find((l) => l.id === id);
      return r && r.status === "Pending";
    });
    if (!ids.length) return;

    setBulkBusy(true);
    const prev = leaves;
    // optimiste
    setLeaves((old) => old.map((l) => (ids.includes(l.id) ? { ...l, status } : l)));
    try {
      // pas d’endpoint bulk côté backend original → on boucle
      await Promise.all(ids.map((id) => put(`/operations/leaves/${id}/status`, { status, reason })));
      toast({ title: `(${ids.length}) demande${ids.length>1?"s":""} ${status === "Approved" ? "approuvée(s)" : "rejetée(s)"}` });
      setSelected(new Set());
      idle(() => {
        refreshValidationCounts?.().catch(() => undefined);
        window.dispatchEvent(new CustomEvent("app:counters:refresh"));
      });
    } catch (e) {
      setLeaves(prev);
      toast({ title: "Échec de l’action en masse", description: e?.message, variant: "destructive" });
    } finally {
      setBulkBusy(false);
      setBulkAction(null);
    }
  };

  const renderTable = (list) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-50 text-left text-sm text-gray-600">
            <th className="px-4 py-2 w-10">
              <input
                type="checkbox"
                aria-label="Tout sélectionner"
                onChange={toggleAllVisible}
                checked={list.length > 0 && list.every((r) => selected.has(r.id))}
                ref={(el) => {
                  if (el) {
                    const some = list.some((r) => selected.has(r.id));
                    const all = list.length > 0 && list.every((r) => selected.has(r.id));
                    el.indeterminate = some && !all;
                  }
                }}
              />
            </th>
            <th className="px-4 py-2">Employé</th>
            <th className="px-4 py-2">Période</th>
            <th className="px-4 py-2">Type</th>
            <th className="px-4 py-2">½ journée</th>
            <th className="px-4 py-2">Payé</th>
            <th className="px-4 py-2">Demandé le</th>
            <th className="px-4 py-2">Statut</th>
            <th className="px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => {
            const pending = r.status === "Pending";
            const busy = mutatingIds.has(r.id);
            return (
              <tr key={r.id} ref={getRef(r.id)} className="border-b hover:bg-gray-50">
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    aria-label={`Sélectionner ${r.employee}`}
                    checked={isSelected(r.id)}
                    onChange={() => toggleOne(r.id)}
                  />
                </td>
                <td className="px-4 py-2">
                  <button className="underline decoration-dotted hover:text-emerald-700" onClick={()=>setDetailsId(r.id)}>
                    {r.employee}
                  </button>
                </td>
                <td className="px-4 py-2">
                  {formatDate(r.start)} — {formatDate(r.end)}
                </td>
                <td className="px-4 py-2">{r.type || "—"}</td>
                <td className="px-4 py-2">{r.halfDay || "—"}</td>
                <td className="px-4 py-2">{typeof r.paid === "boolean" ? (r.paid ? "Oui" : "Non") : "—"}</td>
                <td className="px-4 py-2">{r.createdAt ? formatDate(r.createdAt) : "—"}</td>
                <td className="px-4 py-2">
                  <Badge className={getStatusColor(r.status)}>
                    {getStatusIcon(r.status)}
                    <span className="ml-1">{t?.(`common.${(r.status || "").toLowerCase()}`) || r.status}</span>
                  </Badge>
                </td>
                <td className="px-4 py-2">
                  {pending ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => approve(r.id)}
                        disabled={busy}
                        className="text-green-700 border-green-200 hover:bg-green-50"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" /> Approuver
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => reject(r.id)}
                        disabled={busy}
                        className="text-red-700 border-red-200 hover:bg-red-50"
                      >
                        <XCircle className="w-4 h-4 mr-1" /> Rejeter
                      </Button>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
          {!list.length && (
            <tr>
              <td colSpan={9} className="text-center text-sm text-gray-500 py-6">
                Aucune demande.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-6 space-y-6 table-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t?.("leaves.title") || "Congés"}</h1>
          <p className="text-gray-600 mt-1">Gérez les demandes de congés de votre équipe</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const qs = new URLSearchParams({
                ...(q ? { q } : {}),
                status: activeTab === "pending" ? "Pending" : activeTab === "approved" ? "Approved" : "Rejected",
              }).toString();
              const url = `${API_BASE_URL}/operations/leaves/export.csv${qs ? `?${qs}` : ""}`;
              window.location.href = url;
            }}
          >
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setFormOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {t?.("leaves.requestLeave") || "Demander un congé"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Demandes de Congés
            </CardTitle>
            <div className="relative w-full max-w-xs">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                type="text"
                placeholder="Rechercher par employé, statut…"
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                aria-label="Rechercher"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-sm text-gray-500 flex items-center py-8" aria-live="polite">Chargement…</div>
          ) : err ? (
            <div className="text-sm text-red-600 flex items-center py-8" role="alert">{err}</div>
          ) : (
            <div>
              {/* Onglets -> filtres client + compteurs corrects */}
              <div role="tablist" aria-label="Onglets congés" className="inline-flex items-center gap-2 rounded-lg bg-muted p-1 text-muted-foreground">
                <button
                  role="tab"
                  aria-selected={activeTab === "pending"}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${activeTab === "pending" ? "bg-white text-foreground shadow" : "hover:bg-gray-100"}`}
                  onClick={() => setActiveTab("pending")}
                  type="button"
                >
                  <span className="inline-flex items-center gap-2">
                    <Clock className="w-4 h-4" /> En attente ({buckets.pending.length})
                  </span>
                </button>
                <button
                  role="tab"
                  aria-selected={activeTab === "approved"}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${activeTab === "approved" ? "bg-white text-foreground shadow" : "hover:bg-gray-100"}`}
                  onClick={() => setActiveTab("approved")}
                  type="button"
                >
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Approuvées ({buckets.approved.length})
                  </span>
                </button>
                <button
                  role="tab"
                  aria-selected={activeTab === "rejected"}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${activeTab === "rejected" ? "bg-white text-foreground shadow" : "hover:bg-gray-100"}`}
                  onClick={() => setActiveTab("rejected")}
                  type="button"
                >
                  <span className="inline-flex items-center gap-2">
                    <XCircle className="w-4 h-4" /> Rejetées ({buckets.rejected.length})
                  </span>
                </button>
              </div>

              <div className="mt-6">
                {renderTable(buckets[activeTab])}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk actions bar */}
      <BulkBar
        count={Array.from(selected).filter((id)=> {
          const r = leaves.find(l => l.id === id);
          return r && r.status === "Pending";
        }).length}
        busy={bulkBusy}
        onApprove={() => setBulkAction("Approved")}
        onReject={() => setBulkAction("Rejected")}
      />

      {/* Dialog de création */}
      <LeaveFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreateLeave}
        defaultEmployee=""
      />

      {/* Dialog motif (unitaire) */}
      <ReasonDialog
        open={!!reasonDialog}
        title={reasonDialog?.status === "Approved" ? "Motif d’approbation (optionnel)" : "Motif de rejet (obligatoire)"}
        label={reasonDialog?.status === "Approved" ? "Commentaire (optionnel)" : "Expliquez votre décision"}
        actionLabel="Confirmer"
        onClose={() => setReasonDialog(null)}
        onConfirm={(reason) => {
          let r = reason;
          if (reasonDialog?.status === "Approved" && !r) r = undefined;
          if (reasonDialog?.status === "Rejected" && !r) return; // motif requis
          return handleConfirmReason(r);
        }}
      />

      {/* Dialog motif (bulk) */}
      <ReasonDialog
        open={!!bulkAction}
        title={bulkAction === "Approved" ? "Approuver en masse" : "Rejeter en masse"}
        label="Motif"
        actionLabel={bulkAction === "Approved" ? "Approuver" : "Rejeter"}
        onClose={() => setBulkAction(null)}
        onConfirm={(reason) => doBulk(bulkAction, reason)}
      />

      {/* Panneau de détails */}
      <LeaveDetailsPanel
        id={detailsId}
        open={!!detailsId}
        onClose={()=>setDetailsId(null)}
        formatDate={formatDate}
      />
    </div>
  );
}

function sanitizeReason(status, reason) {
  if (status === "Rejected") return (reason || "").trim();
  return reason?.trim() || undefined;
}

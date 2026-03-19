// src/pages/operations/LeavesPage.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { post, put, get, API_BASE_URL } from "../../lib/api";
import { useApp } from "../../contexts/AppContext";
import {
  Calendar, Plus, Search as SearchIcon,
  CheckCircle, XCircle, Clock, Download, AlertTriangle
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import LeaveFormDialog from "../../components/operations/LeaveFormDialog";
import ReasonDialog from "../../components/operations/ReasonDialog";
import BulkBar from "../../components/operations/BulkBar";
import LeaveDetailsPanel from "../../features/leaves/components/LeaveDetailsPanel";
import { useToast } from "../../components/ui/use-toast";
import PageHeader from "../../components/common/PageHeader";
import SectionCard from "../../components/common/SectionCard";
import EmptyState from "../../components/common/EmptyState";
import HelpTooltip from "../../components/common/HelpTooltip";
import { TableSkeleton } from "../../components/common/Skeletons";

const TABS = ["pending", "approved", "rejected"];
const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 50));

export default function LeavesPage() {
  const { t, formatDate, refreshValidationCounts } = useApp();
  const { toast } = useToast();
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const focusEmployeeId = params.get("employeeId") || "";

  // Onglets ↔ status
  const [activeTab, setActiveTab] = useState("pending");

  // Données (on charge TOUT puis on filtre côté client)
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState([]);

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
  const [escalateDialog, setEscalateDialog] = useState(null);

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

  const getStatusPresentation = (leave) => {
    const status = leave?.status;
    const stage = leave?.approvalStage;
    if (status === "Approved") {
      return {
        className: "bg-green-100 text-green-800",
        icon: <CheckCircle className="w-4 h-4" />,
        label: "Approuvée",
      };
    }
    if (status === "Rejected") {
      return {
        className: "bg-red-100 text-red-800",
        icon: <XCircle className="w-4 h-4" />,
        label: "Rejetée",
      };
    }
    if (stage === "PENDING_HR") {
      return {
        className: "bg-sky-100 text-sky-800",
        icon: <Clock className="w-4 h-4" />,
        label: leave?.approvalStageLabel || "En attente RH",
      };
    }
    return {
      className: "bg-amber-100 text-amber-800",
      icon: <Clock className="w-4 h-4" />,
      label: leave?.approvalStageLabel || "En attente manager",
    };
  };

  // ======= LOAD (client-driven) — on charge toutes les demandes une fois =======
  const load = async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setErr("");
    setLoading(true);

    try {
      const [res, typesRes] = await Promise.all([
        get("/operations/leaves", { signal: controller.signal }),
        get("/operations/leaves/types", { signal: controller.signal }).catch(() => ({ items: [] })),
      ]);
      const list = Array.isArray(res?.leaves) ? res.leaves : Array.isArray(res) ? res : [];
      cacheRef.current = { rows: list, ts: Date.now() };
      setLeaves(list);
      setLeaveTypes(Array.isArray(typesRes?.items) ? typesRes.items : []);
    } catch (e) {
      if (e.name !== "AbortError") {
        setErr(e?.message || "Erreur lors du chargement des congés");
        setLeaves(cacheRef.current.rows.length ? cacheRef.current.rows : []);
        setLeaveTypes([]);
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

  useEffect(() => {
    let active = true;
    if (!focusEmployeeId) {
      setLeaveBalances([]);
      return () => {
        active = false;
      };
    }
    get(`/operations/leaves/balances?employeeId=${focusEmployeeId}`)
      .then((res) => {
        if (!active) return;
        setLeaveBalances(Array.isArray(res?.items) ? res.items : []);
      })
      .catch(() => {
        if (!active) return;
        setLeaveBalances([]);
      });
    return () => {
      active = false;
    };
  }, [focusEmployeeId]);

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
    const scoped = focusEmployeeId ? leaves.filter((l) => l.employeeId === focusEmployeeId) : leaves;
    if (!term) return scoped;
    return scoped.filter((l) => {
      const hay = [
        l.employee, l.status, l.type, l.halfDay,
        l.paid === true ? "oui" : l.paid === false ? "non" : "",
      ].join(" ").toLowerCase();
      return hay.includes(term);
    });
  }, [focusEmployeeId, leaves, q]);

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
    try {
      const response = await put(`/operations/leaves/${id}/status`, { status, reason });
      const updated = response?.leave || null;
      if (updated?.id) {
        setLeaves((old) => old.map((leave) => (leave.id === updated.id ? { ...leave, ...updated } : leave)));
      }
      toast({
        title:
          response?.actionResult === "FORWARDED_TO_HR"
            ? "Transmise aux RH"
            : status === "Approved"
            ? "Demande approuvée"
            : "Demande rejetée",
        description: response?.message || undefined,
      });
      idle(() => {
        refreshValidationCounts?.().catch(() => undefined);
        window.dispatchEvent(new CustomEvent("app:counters:refresh"));
      });
    } catch (e) {
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

  const handleEscalateToHr = async (id, reason) => {
    setMutatingIds((s) => new Set(s).add(id));
    try {
      const response = await post(`/operations/leaves/${id}/escalate-to-hr`, {
        reason: reason?.trim() || "Manager indisponible",
      });
      const updated = response?.leave || null;
      if (updated?.id) {
        setLeaves((old) => old.map((leave) => (leave.id === updated.id ? { ...leave, ...updated } : leave)));
      }
      toast({
        title: "Relais RH activé",
        description: response?.message || "La demande est désormais en attente RH.",
      });
      idle(() => {
        refreshValidationCounts?.().catch(() => undefined);
        window.dispatchEvent(new CustomEvent("app:counters:refresh"));
      });
    } catch (e) {
      toast({
        title: "Escalade impossible",
        description: e?.message || "La demande n'a pas pu être transmise aux RH.",
        variant: "destructive",
      });
    } finally {
      setMutatingIds((s) => { const n = new Set(s); n.delete(id); return n; });
      setEscalateDialog(null);
    }
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
      toast({ title: "Demande créée", description: res?.message || "En attente d’approbation." });
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
      return r && r.status === "Pending" && r.canApprove;
    });
    if (!ids.length) return;

    setBulkBusy(true);
    try {
      const results = await Promise.all(ids.map((id) => put(`/operations/leaves/${id}/status`, { status, reason })));
      const updatedRows = results.map((result) => result?.leave).filter(Boolean);
      if (updatedRows.length) {
        setLeaves((old) =>
          old.map((leave) => updatedRows.find((updated) => updated.id === leave.id) || leave)
        );
      }
      toast({ title: `(${ids.length}) demande${ids.length>1?"s":""} traitée(s)` });
      setSelected(new Set());
      idle(() => {
        refreshValidationCounts?.().catch(() => undefined);
        window.dispatchEvent(new CustomEvent("app:counters:refresh"));
      });
    } catch (e) {
      toast({ title: "Échec de l’action en masse", description: e?.message, variant: "destructive" });
    } finally {
      setBulkBusy(false);
      setBulkAction(null);
    }
  };

  const renderTable = (list) => (
    !list.length ? (
      <EmptyState
        icon={Calendar}
        title="Aucune demande sur cet onglet"
        description="Les nouvelles demandes apparaîtront ici."
        compact
      />
    ) : (
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 text-left text-sm text-gray-600">
              <th className="px-4 py-2 w-10 border">
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
              <th className="px-4 py-2 border">Employé</th>
              <th className="px-4 py-2 border">Période</th>
              <th className="px-4 py-2 border">Type</th>
              <th className="px-4 py-2 border">½ journée</th>
              <th className="px-4 py-2 border">Payé</th>
              <th className="px-4 py-2 border">Demandé le</th>
              <th className="px-4 py-2 border">Statut</th>
              <th className="px-4 py-2 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const pending = r.status === "Pending";
              const busy = mutatingIds.has(r.id);
              const presentation = getStatusPresentation(r);
              return (
                <tr key={r.id} ref={getRef(r.id)} className="border-b transition-colors duration-150 hover:bg-gray-50">
                  <td className="px-4 py-2 border">
                    <input
                      type="checkbox"
                      aria-label={`Sélectionner ${r.employee}`}
                      checked={isSelected(r.id)}
                      onChange={() => toggleOne(r.id)}
                    />
                  </td>
                  <td className="px-4 py-2 border">
                    <button className="underline decoration-dotted hover:text-emerald-700" onClick={() => setDetailsId(r.id)}>
                      {r.employee}
                    </button>
                  </td>
                  <td className="px-4 py-2 border">
                    {formatDate(r.start)} — {formatDate(r.end)}
                  </td>
                  <td className="px-4 py-2 border">{r.type || "—"}</td>
                  <td className="px-4 py-2 border">{r.halfDay || "—"}</td>
                  <td className="px-4 py-2 border">{typeof r.paid === "boolean" ? (r.paid ? "Oui" : "Non") : "—"}</td>
                  <td className="px-4 py-2 border">{r.createdAt ? formatDate(r.createdAt) : "—"}</td>
                  <td className="px-4 py-2 border">
                    <Badge className={presentation.className}>
                      {presentation.icon}
                      <span className="ml-1">{presentation.label}</span>
                    </Badge>
                    {pending ? (
                      <div className="mt-1 text-xs text-slate-500">
                        {r.managerName ? `Manager: ${r.managerName}` : "Traitement RH direct"}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 border">
                    {pending ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {r.canApprove ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => approve(r.id)}
                            disabled={busy}
                            className="text-green-700 border-green-200 hover:bg-green-50"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" /> {r.approveActionLabel || "Approuver"}
                          </Button>
                        ) : null}
                        {r.canReject ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => reject(r.id)}
                            disabled={busy}
                            className="text-red-700 border-red-200 hover:bg-red-50"
                          >
                            <XCircle className="w-4 h-4 mr-1" /> Rejeter
                          </Button>
                        ) : null}
                        {r.canEscalateToHr ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEscalateDialog({ id: r.id })}
                            disabled={busy}
                            className="text-amber-700 border-amber-200 hover:bg-amber-50"
                          >
                            <AlertTriangle className="w-4 h-4 mr-1" /> Escalader RH
                          </Button>
                        ) : null}
                        {!r.canApprove && !r.canReject && !r.canEscalateToHr ? (
                          <span className="text-xs text-slate-500">En attente d’un autre niveau de validation.</span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )
  );

  return (
    <div className="p-6 space-y-6 table-page">
      <PageHeader
        title={t?.("leaves.title") || "Congés"}
        description={focusEmployeeId ? "Vue ciblée sur un salarié avec workflow de validation et solde visible." : "Gérez les demandes de congés de votre équipe avec règles et validations explicites."}
        actions={(
          <>
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
          </>
        )}
      />

      <SectionCard
        title={(
          <span className="inline-flex items-center gap-2">
            Cadre de gestion des absences
            <HelpTooltip content="Rendez visibles vos règles internes, le circuit de validation et les soldes pour limiter les erreurs de saisie." />
          </span>
        )}
        description="Les règles sont visibles avant action pour éviter les rejets inutiles."
        className="border-emerald-100 shadow-sm"
        contentClassName="space-y-4"
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                <div className="text-sm font-semibold text-slate-900">Congé annuel</div>
                <div className="mt-2 text-2xl font-bold text-emerald-700">25 j</div>
                <div className="mt-1 text-xs text-slate-600">Exemple de base annuelle à adapter selon votre politique et votre pays.</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Congé principal</div>
                <div className="mt-2 text-2xl font-bold text-slate-900">12 j min.</div>
                <div className="mt-1 text-xs text-slate-600">À poser en continu sur la période principale, sauf dérogation RH.</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Période conseillée</div>
                <div className="mt-2 text-2xl font-bold text-slate-900">1 mai - 31 oct.</div>
                <div className="mt-1 text-xs text-slate-600">Paramétrable par politique interne et jours fériés locaux.</div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                Workflow de validation
                <HelpTooltip content="Manager en premier, RH en second niveau, Direction si la politique ou la durée l’exige. La page garde ce chemin visible pour éviter les incompréhensions." />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <Badge className="border-amber-200 bg-amber-50 text-amber-700">En attente N+1</Badge>
                <span className="text-slate-400">→</span>
                <Badge className="border-orange-200 bg-orange-50 text-orange-700">Validation RH</Badge>
                <span className="text-slate-400">→</span>
                <Badge className="border-sky-200 bg-sky-50 text-sky-700">Direction si requis</Badge>
                <span className="text-slate-400">→</span>
                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Approuvé / Rejeté</Badge>
              </div>
            </div>

            {focusEmployeeId ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Filtre salarié actif. Cette vue a été ouverte depuis l’annuaire ou la page contrats.
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              Soldes et types d’absence
              <HelpTooltip content="Si un salarié est ciblé via employeeId, ses soldes acquis / pris / restants remontent ici. Sinon, on affiche le catalogue des types d’absence disponibles." />
            </div>
            <div className="mt-3 space-y-2">
              {focusEmployeeId && leaveBalances.length ? leaveBalances.slice(0, 6).map((row) => (
                <div key={`${row.leaveTypeCode}-${row.periodYear || ''}`} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-900">{row.leaveTypeLabel}</span>
                    <span className="text-slate-900">{Number(row.available || row.balanceDays || 0).toFixed(1)} j</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Acquis {Number(row.acquired || 0).toFixed(1)} · Pris {Number(row.consumed || row.used || 0).toFixed(1)} · En attente {Number(row.pending || row.pendingRequestsDays || 0).toFixed(1)}
                  </div>
                </div>
              )) : leaveTypes.slice(0, 6).map((type) => (
                <div key={type.id || type.code} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-900">{type.label}</span>
                    <Badge variant="outline">{type.code}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {type.requiresDocument ? "Justificatif requis" : "Sans justificatif systématique"} · {type.category || "Autre"}
                  </div>
                </div>
              ))}
              {!focusEmployeeId && !leaveTypes.length ? (
                <div className="text-sm text-slate-500">Aucun type d’absence paramétré.</div>
              ) : null}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title={(
          <span className="inline-flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Demandes de congés
          </span>
        )}
        actions={(
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
        )}
      >
        {loading ? (
          <TableSkeleton rows={6} cols={9} />
        ) : err ? (
          <EmptyState
            icon={XCircle}
            title="Impossible de charger les demandes"
            description={err}
            actionLabel="Réessayer"
            onAction={load}
            compact
          />
        ) : (
          <div>
            {focusEmployeeId && !filteredBySearch.length ? (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <AlertTriangle className="mr-2 inline h-4 w-4" />
                Aucun historique de congé ne correspond à ce salarié dans le périmètre chargé.
              </div>
            ) : null}
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
            <div className="mt-6">{renderTable(buckets[activeTab])}</div>
          </div>
        )}
      </SectionCard>

      {/* Bulk actions bar */}
      <BulkBar
        count={Array.from(selected).filter((id)=> {
          const r = leaves.find(l => l.id === id);
          return r && r.status === "Pending" && r.canApprove;
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

      <ReasonDialog
        open={!!escalateDialog}
        title="Escalader vers les RH"
        label="Motif d’escalade"
        actionLabel="Transmettre"
        onClose={() => setEscalateDialog(null)}
        onConfirm={(reason) => handleEscalateToHr(escalateDialog?.id, reason)}
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

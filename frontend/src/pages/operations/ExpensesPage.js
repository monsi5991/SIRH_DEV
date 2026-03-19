import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { get, post, put as putReq, del as delReq } from "../../lib/api";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Receipt, CheckCircle, XCircle, DollarSign, Plus, Trash2, RefreshCw } from "lucide-react";
import ExpenseFormDialog from "../../components/operations/ExpenseFormDialog";
import { useApp } from "../../contexts/AppContext";
import { kpiStart, kpiSuccess, kpiError } from "../../lib/kpiTracker";
import PageHeader from "../../components/common/PageHeader";
import SectionCard from "../../components/common/SectionCard";
import EmptyState from "../../components/common/EmptyState";
import HelpTooltip from "../../components/common/HelpTooltip";
import { TableSkeleton } from "../../components/common/Skeletons";

const hashRows = (arr) => {
  try {
    return JSON.stringify(
      (arr || []).map((r) => ({
        id: r.id,
        employee: r.employee,
        date: r.date,
        category: r.category,
        amount: r.amount,
        currency: r.currency,
        status: r.status || "Submitted",
        taxTreatment: r.taxTreatment,
      }))
    );
  } catch {
    return "";
  }
};

function formatTaxTreatment(value) {
  const raw = String(value || "").toUpperCase();
  const canonical = raw === "REMBOURSEMENT" || raw === "REMBURSEMENT" ? "REIMBURSEMENT" : raw;
  if (canonical === "REIMBURSEMENT") return "Remboursement";
  if (canonical === "TAXABLE") return "Taxable";
  if (canonical === "MIXED") return "Mixte";
  return value || "—";
}

function statusLabel(status) {
  if (status === "Approved") return "Validé RH";
  if (status === "Paid") return "Payé";
  if (status === "Rejected") return "Rejeté";
  if (status === "Draft") return "Brouillon";
  return "Soumis";
}

export default function ExpensesPage() {
  const { formatDate, refreshValidationCounts } = useApp();
  const location = useLocation();

  const [rows, setRows] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [preset, setPreset] = useState(null);

  const refs = useRef({});
  const abortRef = useRef(null);
  const cacheRef = useRef({ rows: [], hash: "", fetchedAt: 0 });
  const firstRefreshBurstGuardRef = useRef(false);

  const getRef = (id) => {
    if (!refs.current[id]) refs.current[id] = React.createRef();
    return refs.current[id];
  };

  const load = async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const data = await get("/operations/expenses", { signal: controller.signal });
      const next = (data.expenses || []).map((expense) => ({ ...expense, status: expense.status || "Submitted" }));
      const nextHash = hashRows(next);

      if (nextHash !== cacheRef.current.hash) {
        cacheRef.current = { rows: next, hash: nextHash, fetchedAt: Date.now() };
        setRows(next);
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        console.debug("expenses: load ignored error:", e);
      }
    }
  };

  useEffect(() => {
    if (cacheRef.current.rows.length) setRows(cacheRef.current.rows);
    (async () => {
      await load().catch(() => undefined);

      const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
      if (!firstRefreshBurstGuardRef.current) {
        firstRefreshBurstGuardRef.current = true;
        idle(() => {
          refreshValidationCounts?.().catch(() => undefined);
          window.dispatchEvent(new CustomEvent("app:counters:refresh"));
        });
      }
    })();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshValidationCounts]);

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const queryId = sp.get("expense");
    const hashId = location.hash?.startsWith("#exp-") ? location.hash.slice(5) : null;
    const targetId = queryId || hashId;
    if (!targetId || rows.length === 0) return;

    requestAnimationFrame(() => {
      const el = refs.current[targetId]?.current;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("row-highlight");
        setTimeout(() => el.classList.remove("row-highlight"), 1200);
      }
    });
  }, [location.search, location.hash, rows]);

  const addExpense = async (payload) => {
    const t0 = kpiStart("expenses");
    try {
      await post("/operations/expenses", payload);
      const required = [payload.employee, payload.date, payload.category, payload.amount];
      const filled = required.filter(Boolean).length / required.length;
      kpiSuccess("expenses", t0, filled);
    } catch (e) {
      kpiError("expenses");
      throw e;
    }

    await load().catch(() => undefined);
    setPreset(null);
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 50));
    idle(() => {
      refreshValidationCounts?.().catch(() => undefined);
      window.dispatchEvent(new CustomEvent("app:counters:refresh"));
    });
  };

  const updateStatus = async (id, status) => {
    if (status === "Rejected") {
      const reason = window.prompt("Motif du rejet (obligatoire)");
      if (!reason || !reason.trim()) {
        window.alert("Le motif du rejet est obligatoire.");
        return;
      }
    }
    await putReq(`/operations/expenses/${id}`, { status });
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, status } : row)));
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 50));
    idle(() => {
      refreshValidationCounts?.().catch(() => undefined);
      window.dispatchEvent(new CustomEvent("app:counters:refresh"));
    });
  };

  const remove = async (id) => {
    if (!window.confirm("Supprimer cette note de frais ?")) return;
    await delReq(`/operations/expenses/${id}`);
    setRows((prev) => prev.filter((row) => row.id !== id));
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 50));
    idle(() => {
      refreshValidationCounts?.().catch(() => undefined);
      window.dispatchEvent(new CustomEvent("app:counters:refresh"));
    });
  };

  const filtered = useMemo(
    () => rows.filter((row) => !statusFilter || row.status === statusFilter),
    [rows, statusFilter]
  );

  const counters = useMemo(() => ({
    submitted: rows.filter((row) => row.status === "Submitted").length,
    approved: rows.filter((row) => row.status === "Approved").length,
    paid: rows.filter((row) => row.status === "Paid").length,
    rejected: rows.filter((row) => row.status === "Rejected").length,
  }), [rows]);

  const statusBadge = (status) => (
    <Badge className={
      status === "Approved" ? "bg-green-100 text-green-800" :
      status === "Paid" ? "bg-emerald-100 text-emerald-800" :
      status === "Rejected" ? "bg-red-100 text-red-800" :
      "bg-orange-100 text-orange-800"
    }>
      {statusLabel(status)}
    </Badge>
  );

  return (
    <div className="space-y-6 p-6 table-page">
      <PageHeader
        title="Notes de frais"
        description="Création rapide, statuts clairs et validation sans friction pour transport, repas, hôtel ou mission."
        actions={(
          <div className="flex items-center gap-2">
            <select className="rounded border px-2 py-1" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Tous statuts</option>
              <option value="Submitted">Soumis</option>
              <option value="Approved">Validé RH</option>
              <option value="Paid">Payé</option>
              <option value="Rejected">Rejeté</option>
            </select>
            <Button variant="outline" onClick={() => load()}><RefreshCw className="mr-2 h-4 w-4" /> Rafraîchir</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setPreset(null); setOpenCreate(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Ajouter
            </Button>
          </div>
        )}
      >
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-emerald-100 bg-white p-4 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs uppercase tracking-wide text-slate-500">Soumises</div><div className="mt-2 text-2xl font-bold text-amber-700">{counters.submitted}</div></div>
          <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs uppercase tracking-wide text-slate-500">Validées RH</div><div className="mt-2 text-2xl font-bold text-slate-900">{counters.approved}</div></div>
          <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs uppercase tracking-wide text-slate-500">Payées</div><div className="mt-2 text-2xl font-bold text-emerald-700">{counters.paid}</div></div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><div className="font-medium">Workflow visible</div><div className="mt-1">Brouillon → Soumis → Validé N+1 → Validé RH → Validé Finance → Payé / Rejeté.</div></div>
        </div>
      </PageHeader>

      <SectionCard
        title={<span className="inline-flex items-center gap-2">Création rapide <HelpTooltip content="Utilisez les modèles Mission, Déplacement ou Repas pour pré-remplir la catégorie et limiter la saisie à quelques champs." /></span>}
        description="Préparez une note de frais complète en quelques champs, même depuis un mobile."
        className="border-emerald-100 shadow-sm"
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { setPreset("mission"); setOpenCreate(true); }}>Modèle Mission</Button>
          <Button variant="outline" onClick={() => { setPreset("deplacement"); setOpenCreate(true); }}>Modèle Déplacement</Button>
          <Button variant="outline" onClick={() => { setPreset("repas"); setOpenCreate(true); }}>Modèle Repas</Button>
        </div>
      </SectionCard>

      <SectionCard title="Suivi des dépenses" description="Table lisible avec validation rapide et rejet cadré." className="border-emerald-100 shadow-sm">
        {rows.length ? (
          <div className="overflow-x-auto contain-layout min-h-table rounded-2xl border border-slate-200">
            <table className="min-w-full table-fixed border-collapse">
              <colgroup>
                <col style={{ width: "12rem" }} />
                <col style={{ width: "9rem" }} />
                <col style={{ width: "10rem" }} />
                <col style={{ width: "10rem" }} />
                <col style={{ width: "10rem" }} />
                <col style={{ width: "7rem" }} />
                <col style={{ width: "22rem" }} />
              </colgroup>
              <thead>
                <tr className="bg-gray-50 text-left text-sm text-slate-600">
                  <th className="border p-2">Employé</th>
                  <th className="border p-2">Date</th>
                  <th className="border p-2">Catégorie</th>
                  <th className="border p-2">Montant</th>
                  <th className="border p-2">Traitement fiscal</th>
                  <th className="border p-2">Statut</th>
                  <th className="border p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} ref={getRef(row.id)} className="hover:bg-gray-50">
                    <td className="border p-2">{row.employee}</td>
                    <td className="border p-2">{formatDate(row.date)}</td>
                    <td className="border p-2">{row.category}</td>
                    <td className="border p-2">{new Intl.NumberFormat("fr-FR").format(row.amount)} {row.currency}</td>
                    <td className="border p-2">{formatTaxTreatment(row.taxTreatment)}</td>
                    <td className="border p-2">{statusBadge(row.status)}</td>
                    <td className="border p-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => updateStatus(row.id, "Approved")} className="border-green-200 text-green-600 hover:bg-green-50">
                          <CheckCircle className="mr-1 h-4 w-4" /> Valider
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => updateStatus(row.id, "Paid")} className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                          <DollarSign className="mr-1 h-4 w-4" /> Payer
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => updateStatus(row.id, "Rejected")} className="border-red-200 text-red-600 hover:bg-red-50">
                          <XCircle className="mr-1 h-4 w-4" /> Rejeter
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => remove(row.id)} className="text-gray-600">
                          <Trash2 className="mr-1 h-4 w-4" /> Suppr.
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length ? <div className="p-4 text-sm text-gray-500">Aucune note de frais sur ce filtre.</div> : null}
          </div>
        ) : (
          <EmptyState
            icon={Receipt}
            title="Aucune note de frais"
            description="Créez une première note à partir d’un modèle Mission, Déplacement ou Repas."
            actionLabel="Créer une note"
            onAction={() => { setPreset(null); setOpenCreate(true); }}
            compact
          />
        )}
      </SectionCard>

      {!rows.length ? <TableSkeleton rows={0} cols={0} /> : null}

      <ExpenseFormDialog open={openCreate} onClose={() => { setOpenCreate(false); setPreset(null); }} onSubmit={addExpense} preset={preset} />
    </div>
  );
}

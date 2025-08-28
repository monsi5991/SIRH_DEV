// src/pages/operations/ExpensesPage.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { get, post, put as putReq, del as delReq } from "../../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Receipt, CheckCircle, XCircle, DollarSign, Plus, Trash2 } from "lucide-react";
import { useApp } from "../../contexts/AppContext";

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

export default function ExpensesPage() {
  const { formatDate, refreshValidationCounts } = useApp();
  const location = useLocation();

  const [rows, setRows] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");

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
      const next = (data.expenses || []).map(e => ({ ...e, status: e.status || "Submitted" }));
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
    const qId = sp.get("expense");
    const h = location.hash?.startsWith("#exp-") ? location.hash.slice(5) : null;
    const targetId = qId || h;
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

  const addExpense = async () => {
    const employee = prompt("Employé", "John Doe");
    if (!employee) return;
    const date = prompt("Date (YYYY-MM-DD)", new Date().toISOString().slice(0,10));
    const category = prompt("Catégorie", "Repas");
    const amount = Number(prompt("Montant", "25000"));
    const currency = prompt("Devise", "XOF") || "XOF";
    // ✅ traitement fiscal optionnel
    const taxTreatment = prompt("Traitement fiscal (REIMBURSEMENT, BENEFIT_TAXABLE, PER_DIEM_EXEMPT) [optionnel]", "REIMBURSEMENT") || undefined;

    await post("/operations/expenses", { employee, date, category, amount, currency, taxTreatment });

    await load().catch(() => undefined);
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 50));
    idle(() => {
      refreshValidationCounts?.().catch(() => undefined);
      window.dispatchEvent(new CustomEvent("app:counters:refresh"));
    });
  };

  const updateStatus = async (id, status) => {
    await putReq(`/operations/expenses/${id}/status`, { status });
    setRows(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 50));
    idle(() => {
      refreshValidationCounts?.().catch(() => undefined);
      window.dispatchEvent(new CustomEvent("app:counters:refresh"));
    });
  };

  const remove = async (id) => {
    if (!window.confirm("Supprimer cette note de frais ?")) return;
    await delReq(`/operations/expenses/${id}`);
    setRows(prev => prev.filter(r => r.id !== id));
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 50));
    idle(() => {
      refreshValidationCounts?.().catch(() => undefined);
      window.dispatchEvent(new CustomEvent("app:counters:refresh"));
    });
  };

  const filtered = useMemo(
    () => rows.filter(r => !statusFilter || r.status === statusFilter),
    [rows, statusFilter]
  );

  const statusBadge = (s) => (
    <Badge className={
      s === "Approved" ? "bg-green-100 text-green-800" :
      s === "Paid"     ? "bg-emerald-100 text-emerald-800" :
      s === "Rejected" ? "bg-red-100 text-red-800" :
                         "bg-orange-100 text-orange-800"
    }>
      {s}
    </Badge>
  );

  return (
    <div className="p-6 space-y-6 table-page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dépenses</h1>
        <div className="flex items-center gap-2">
          <select
            className="border rounded px-2 py-1"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">Tous statuts</option>
            <option value="Submitted">Submitted</option>
            <option value="Approved">Approved</option>
            <option value="Paid">Paid</option>
            <option value="Rejected">Rejected</option>
          </select>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={addExpense}>
            <Plus className="w-4 h-4 mr-2" /> Ajouter
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" /> Notes de frais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto contain-layout min-h-table">
            <table className="min-w-full border table-fixed">
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
                <tr className="bg-gray-50 text-left">
                  <th className="p-2 border">Employé</th>
                  <th className="p-2 border">Date</th>
                  <th className="p-2 border">Catégorie</th>
                  <th className="p-2 border">Montant</th>
                  <th className="p-2 border">Traitement fiscal</th>
                  <th className="p-2 border">Statut</th>
                  <th className="p-2 border">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} ref={getRef(r.id)} className="hover:bg-gray-50">
                    <td className="p-2 border">{r.employee}</td>
                    <td className="p-2 border">{formatDate(r.date)}</td>
                    <td className="p-2 border">{r.category}</td>
                    <td className="p-2 border">
                      {new Intl.NumberFormat("fr-FR").format(r.amount)} {r.currency}
                    </td>
                    <td className="p-2 border">{r.taxTreatment || "—"}</td>
                    <td className="p-2 border">{statusBadge(r.status)}</td>
                    <td className="p-2 border">
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "Approved")}
                          className="text-green-600 border-green-200 hover:bg-green-50">
                          <CheckCircle className="w-4 h-4 mr-1" /> Approuver
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "Paid")}
                          className="text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                          <DollarSign className="w-4 h-4 mr-1" /> Payer
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "Rejected")}
                          className="text-red-600 border-red-200 hover:bg-red-50">
                          <XCircle className="w-4 h-4 mr-1" /> Rejeter
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => remove(r.id)} className="text-gray-600">
                          <Trash2 className="w-4 h-4 mr-1" /> Suppr.
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && <div className="text-sm text-gray-500 p-4">Aucune note de frais.</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

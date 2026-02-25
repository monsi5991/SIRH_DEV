// src/pages/operations/TimePage.js
import React, { useEffect, useMemo, useRef, useState, startTransition } from "react";
import PropTypes from "prop-types";
import { useLocation } from "react-router-dom";
import { get, post, put as putReq, del as delReq } from "../../lib/api";
import { useApp } from "../../contexts/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { CalendarDays, CheckCircle, XCircle, Eye, Plus, Trash2 } from "lucide-react";
import TimesheetFormDialog from "../../components/operations/TimesheetFormDialog";
import { kpiStart, kpiSuccess, kpiError } from "../../lib/kpiTracker";

/* ----------------------------------------------------
 * Helpers
 * ---------------------------------------------------- */
const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 50));

function ymKey(d) {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
function monthLabelFR(year, month /*1-12*/) {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}
function initials(name = "") {
  const parts = String(name).trim().split(/\s+/);
  return (parts[0]?.[0] || "").concat(parts[1]?.[0] || "").toUpperCase();
}
function statusBadgeCls(s) {
  if (s === "Approved") return "bg-green-100 text-green-800";
  if (s === "Rejected") return "bg-red-100 text-red-800";
  return "bg-orange-100 text-orange-800";
}

/* ----------------------------------------------------
 * Détail (panneau) : employé + mois
 * ---------------------------------------------------- */
function DetailPanel({
  open,
  onClose,
  items,
  employee,
  year,
  month,
  onBulkStatus,
  onBulkDelete,
  formatDate,
}) {
  const [localRows, setLocalRows] = useState(items || []);
  const [selected, setSelected] = useState(() => new Set());
  const [statusFilter, setStatusFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const panelRef = useRef(null);

  // sync on open/refresh
  useEffect(() => {
    setLocalRows(items || []);
    setSelected(new Set());
  }, [items, open]);

  // raccourcis clavier (A/R, Esc, Ctrl+A)
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelected(new Set(filtered.map((r) => r.id)));
        return;
      }
      if (!selected.size) return;
      if (e.key.toLowerCase() === "a" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleBulk("Approved").catch(() => undefined);
      }
      if (e.key.toLowerCase() === "r" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleBulk("Rejected").catch(() => undefined);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, selected, localRows]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!statusFilter) return localRows;
    return localRows.filter((r) => r.status === statusFilter);
  }, [localRows, statusFilter]);

  const totals = useMemo(() => {
    let sum = 0, s = 0, a = 0, r = 0;
    for (const t of localRows) {
      sum += Number(t.hours) || 0;
      if (t.status === "Submitted") s++;
      else if (t.status === "Approved") a++;
      else if (t.status === "Rejected") r++;
    }
    return { sum, s, a, r };
  }, [localRows]);

  const allSelected = selected.size > 0 && filtered.every((r) => selected.has(r.id));
  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.id)));
  };

  async function handleBulk(status) {
    const ids = filtered.filter((x) => selected.has(x.id)).map((x) => x.id);
    if (!ids.length) return;
    try {
      setBusy(true);
      await onBulkStatus(ids, status);
      setLocalRows((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, status } : r)));
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    const ids = filtered.filter((x) => selected.has(x.id)).map((x) => x.id);
    if (!ids.length) return;
    if (!window.confirm(`Supprimer ${ids.length} ligne(s) ?`)) return;
    try {
      setBusy(true);
      await onBulkDelete(ids);
      setLocalRows((prev) => prev.filter((r) => !ids.includes(r.id)));
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="absolute inset-0 bg-black/40" />

      <div
        ref={panelRef}
        className="ml-auto h-full w-full max-w-3xl bg-white shadow-xl flex flex-col"
      >
        {/* Header sticky */}
        <div className="sticky top-0 z-10 bg-white border-b px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-600 text-white grid place-items-center text-sm">
              {initials(employee)}
            </div>
            <div>
              <div className="font-semibold leading-tight">{employee}</div>
              <div className="text-xs text-gray-500">{monthLabelFR(year, month)}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              className="border rounded px-2 py-1 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Tous statuts</option>
              <option value="Submitted">Submitted</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
            <span className="text-sm text-gray-600">
              Total: <b>{totals.sum}</b> h
            </span>
            <Button variant="outline" onClick={onClose}>Fermer</Button>
          </div>
        </div>

        {/* Barre d’actions sélection (sticky) */}
        <div className="sticky top-[53px] bg-gray-50 border-b px-5 py-2 flex items-center gap-3">
          <input
            type="checkbox"
            aria-label="Tout sélectionner"
            checked={allSelected}
            onChange={toggleAll}
          />
          <span className="text-sm text-gray-600">
            {selected.size} sélectionnée(s)
          </span>
          <Button
            size="sm"
            onClick={() => handleBulk("Approved")}
            disabled={!selected.size || busy}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <CheckCircle className="w-4 h-4 mr-1" /> Tout approuver
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleBulk("Rejected")}
            disabled={!selected.size || busy}
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            <XCircle className="w-4 h-4 mr-1" /> Tout rejeter
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDelete}
            disabled={!selected.size || busy}
            className="text-gray-700"
          >
            <Trash2 className="w-4 h-4 mr-1" /> Supprimer
          </Button>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-auto">
          <table className="min-w-full table-fixed">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="p-2 border w-10" />
                <th className="p-2 border w-40">Date</th>
                <th className="p-2 border">Projet</th>
                <th className="p-2 border">Note</th>
                <th className="p-2 border w-28">Type</th>
                <th className="p-2 border w-24">Premium</th>
                <th className="p-2 border w-24">Heures</th>
                <th className="p-2 border w-28">Statut</th>
              </tr>
            </thead>
            <tbody>
              <tr className="h-0"><td colSpan={8} className="p-0" /></tr>
              {filtered
                .slice()
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="p-2 border text-center">
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggleOne(r.id)}
                        aria-label="Sélectionner la ligne"
                      />
                    </td>
                    <td className="p-2 border">{formatDate(r.date)}</td>
                    <td className="p-2 border">{r.project || "—"}</td>
                    <td className="p-2 border">{r.note || "—"}</td>
                    <td className="p-2 border">{r.type || "REG"}</td>
                    <td className="p-2 border text-right">{r.premium ?? "—"}</td>
                    <td className="p-2 border text-right">{r.hours}</td>
                    <td className="p-2 border">
                      <Badge className={statusBadgeCls(r.status)}>{r.status}</Badge>
                    </td>
                  </tr>
                ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={8} className="p-6 text-sm text-gray-500">
                    Aucune ligne pour ce filtre.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer sticky (totaux) */}
        <div className="sticky bottom-0 bg-white border-t px-5 py-2 text-sm flex items-center gap-4">
          <span>Total mois : <b>{totals.sum}</b> h</span>
          <span>Submitted : {totals.s}</span>
          <span>Approved : {totals.a}</span>
          <span>Rejected : {totals.r}</span>
        </div>
      </div>
    </div>
  );
}

DetailPanel.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  items: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      date: PropTypes.oneOfType([PropTypes.instanceOf(Date), PropTypes.string]).isRequired,
      hours: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      project: PropTypes.string,
      note: PropTypes.string,
      status: PropTypes.string,
      employee: PropTypes.string,
      type: PropTypes.string,     // ✅ optionnel
      premium: PropTypes.number,  // ✅ optionnel
    })
  ).isRequired,
  employee: PropTypes.string.isRequired,
  year: PropTypes.number.isRequired,
  month: PropTypes.number.isRequired, // 1-12
  onBulkStatus: PropTypes.func.isRequired,
  onBulkDelete: PropTypes.func.isRequired,
  formatDate: PropTypes.func.isRequired,
};

DetailPanel.defaultProps = {
  items: [],
};

/* ----------------------------------------------------
 * Page principale : agrégée par (employé, mois)
 * ---------------------------------------------------- */
export default function TimePage() {
  const { formatDate, refreshValidationCounts } = useApp();
  const location = useLocation();

  const [rows, setRows] = useState([]);          // brut API
  const [statusFilter, setStatusFilter] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [openDetail, setOpenDetail] = useState(false);
  const [detailCtx, setDetailCtx] = useState(null); // { employee, year, month, items: [] }

  // anti-flicker
  const abortRef = useRef(null);
  const cacheRef = useRef({ rows: [], fetchedAt: 0 });

  const load = async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const data = await get("/operations/timesheets", { signal: controller.signal });
      const list = (data?.timesheets || []).map((t) => ({ ...t, status: t.status || "Submitted" }));
      startTransition(() => {
        setRows(list);
        cacheRef.current = { rows: list, fetchedAt: Date.now() };
      });
    } catch (e) {
      if (e?.name !== "AbortError") {
        setRows(cacheRef.current.rows.length ? cacheRef.current.rows : []);
        if (process.env.NODE_ENV !== "production") {
          console.debug("timesheets: load error", e);
        }
      }
    }
  };

  useEffect(() => {
    if (cacheRef.current.rows.length) setRows(cacheRef.current.rows);
    (async () => {
      await load().catch(() => undefined);
      idle(() => refreshValidationCounts?.().catch(() => undefined));
    })();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshValidationCounts]);

  // Deep-link: ?tsMonth=YYYY-MM&emp=Name
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    const ym = sp.get("tsMonth");
    const emp = sp.get("emp");
    if (!ym || !emp || rows.length === 0) return;
    const [yStr, mStr] = ym.split("-");
    const y = Number(yStr), m = Number(mStr);
    const items = rows.filter((r) => r.employee === emp && ymKey(r.date) === ym);
    if (items.length) {
      setDetailCtx({ employee: emp, year: y, month: m, items });
      setOpenDetail(true);
    }
  }, [location.search, rows]);

  // Agrégation par (employé, mois)
  const aggregates = useMemo(() => {
    const map = new Map(); // key = employee|YYYY-MM
    for (const r of rows) {
      if (statusFilter && r.status !== statusFilter) continue;
      const ym = ymKey(r.date);
      const key = `${r.employee}|${ym}`;
      const bucket = map.get(key) || {
        employee: r.employee,
        ym,
        year: Number(ym.slice(0, 4)),
        month: Number(ym.slice(5)),
        totalHours: 0,
        counts: { Submitted: 0, Approved: 0, Rejected: 0 },
        items: [],
      };
      bucket.totalHours += Number(r.hours) || 0;
      bucket.counts[r.status] = (bucket.counts[r.status] || 0) + 1;
      bucket.items.push(r);
      map.set(key, bucket);
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => b.year - a.year || b.month - a.month || a.employee.localeCompare(b.employee));
    return arr;
  }, [rows, statusFilter]);

  const openDetails = (bucket) => {
    setDetailCtx({ employee: bucket.employee, year: bucket.year, month: bucket.month, items: bucket.items });
    setOpenDetail(true);
  };

  // Actions globales (création/maj/suppression)
  const addTimesheet = async (payload) => {
    const t0 = kpiStart("timesheets");
    try {
      await post("/operations/timesheets", { ...payload, status: "Submitted" });
      const required = [payload.employee, payload.date, payload.hours];
      const filled = required.filter(Boolean).length / required.length;
      kpiSuccess("timesheets", t0, filled);
    } catch (e) {
      kpiError("timesheets");
      throw e;
    }
    await load().catch(() => undefined);
    idle(() => {
      refreshValidationCounts?.().catch(() => undefined);
      window.dispatchEvent(new CustomEvent("app:counters:refresh"));
    });
  };

  const bulkStatus = async (ids, status) => {
    await Promise.allSettled(ids.map((id) => putReq(`/operations/timesheets/${id}`, { status })));
    setRows((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, status } : r)));
    idle(() => {
      refreshValidationCounts?.().catch(() => undefined);
      window.dispatchEvent(new CustomEvent("app:counters:refresh"));
    });
  };

  const bulkDelete = async (ids) => {
    await Promise.allSettled(ids.map((id) => delReq(`/operations/timesheets/${id}`)));
    setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
    idle(() => {
      refreshValidationCounts?.().catch(() => undefined);
      window.dispatchEvent(new CustomEvent("app:counters:refresh"));
    });
  };

  return (
    <div className="p-6 space-y-6 table-page">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Feuilles de temps</h1>
        <div className="flex items-center gap-2">
          <select
            className="border rounded px-2 py-1"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Tous statuts</option>
            <option value="Submitted">Submitted</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setOpenCreate(true)}>
            <Plus className="w-4 h-4 mr-2" /> Ajouter
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5" /> Mois / Heures (agrégé)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full border table-fixed">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="p-2 border w-56">Employé</th>
                  <th className="p-2 border w-56">Mois</th>
                  <th className="p-2 border w-28">Heures</th>
                  <th className="p-2 border w-56">Statut</th>
                  <th className="p-2 border w-[200px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr className="h-0"><td colSpan={5} className="p-0" /></tr>
                {aggregates.map((b) => {
                  const st = b.counts;
                  const statusSummary = (
                    <div className="flex gap-1 flex-wrap">
                      {st.Approved > 0 && (
                        <Badge className="bg-green-100 text-green-800">{st.Approved} ✓</Badge>
                      )}
                      {st.Submitted > 0 && (
                        <Badge className="bg-orange-100 text-orange-800">{st.Submitted} •</Badge>
                      )}
                      {st.Rejected > 0 && (
                        <Badge className="bg-red-100 text-red-800">{st.Rejected} ✕</Badge>
                      )}
                    </div>
                  );

                  return (
                    <tr key={`${b.employee}|${b.ym}`} className="hover:bg-gray-50">
                      <td className="p-2 border">{b.employee}</td>
                      <td className="p-2 border capitalize">{monthLabelFR(b.year, b.month)}</td>
                      <td className="p-2 border">{b.totalHours}</td>
                      <td className="p-2 border">{statusSummary}</td>
                      <td className="p-2 border">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDetails(b)}
                          className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                        >
                          <Eye className="w-4 h-4 mr-1" /> Détails
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {!aggregates.length && (
                  <tr>
                    <td colSpan={5} className="p-6 text-sm text-gray-500">
                      Aucune feuille.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Panneau de détail */}
      {detailCtx && (
        <DetailPanel
          open={openDetail}
          onClose={() => setOpenDetail(false)}
          items={detailCtx.items}
          employee={detailCtx.employee}
          year={detailCtx.year}
          month={detailCtx.month}
          onBulkStatus={bulkStatus}
          onBulkDelete={bulkDelete}
          formatDate={formatDate}
        />
      )}

      <TimesheetFormDialog open={openCreate} onClose={() => setOpenCreate(false)} onSubmit={addTimesheet} />
    </div>
  );
}

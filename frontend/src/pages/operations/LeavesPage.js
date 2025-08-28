// src/pages/operations/LeavesPage.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { get, put, post } from "../../lib/api";
import { useApp } from "../../contexts/AppContext";
import {
  Calendar,
  Plus,
  Filter,
  Search as SearchIcon,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import LeaveFormDialog from "../../components/operations/LeaveFormDialog";

const TABS = ["pending", "approved", "rejected"];
const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 50));

export default function LeavesPage() {
  const { t, formatDate, refreshValidationCounts } = useApp();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState("pending");
  const [leaves, setLeaves] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  // anti-flicker / anti-jitter
  const cacheRef = useRef({ rows: [], fetchedAt: 0 });
  const abortRef = useRef(null);
  const mountedRef = useRef(true);

  // refs pour deep-link highlight
  const refs = useRef({});
  const getRef = (id) => {
    if (!refs.current[id]) refs.current[id] = React.createRef();
    return refs.current[id];
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Approved":
        return "bg-green-100 text-green-800";
      case "Rejected":
        return "bg-red-100 text-red-800";
      case "Pending":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };
  const getStatusIcon = (status) => {
    switch (status) {
      case "Approved":
        return <CheckCircle className="w-4 h-4" />;
      case "Rejected":
        return <XCircle className="w-4 h-4" />;
      case "Pending":
        return <Clock className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const load = async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setErr("");
    setLoading(true);

    try {
      const res = await get("/operations/leaves", { signal: controller.signal });
      const list = Array.isArray(res?.leaves) ? res.leaves : Array.isArray(res) ? res : [];
      if (!mountedRef.current) return;

      cacheRef.current = { rows: list, fetchedAt: Date.now() };
      setLeaves(list);
    } catch (e) {
      if (e.name !== "AbortError") {
        setErr(e?.message || "Erreur lors du chargement des congés");
        setLeaves(cacheRef.current.rows.length ? cacheRef.current.rows : []);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
      idle(() => refreshValidationCounts?.().catch(() => undefined));
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    if (cacheRef.current.rows.length) {
      setLeaves(cacheRef.current.rows);
      setLoading(false);
    }
    load().catch(() => undefined);

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // deep-link
  useEffect(() => {
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
          } catch {}
        }
      });
    });
  }, [location.search, location.hash, leaves]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = term
      ? leaves.filter(
          (l) =>
            (l.employee || "").toLowerCase().includes(term) ||
            (l.status || "").toLowerCase().includes(term)
        )
      : leaves;

    return {
      pending: base.filter((l) => l.status === "Pending"),
      approved: base.filter((l) => l.status === "Approved"),
      rejected: base.filter((l) => l.status === "Rejected"),
    };
  }, [leaves, search]);

  const approve = async (id) => {
    try {
      await put(`/operations/leaves/${id}/status`, { status: "Approved" });
      setLeaves((prev) => prev.map((l) => (l.id === id ? { ...l, status: "Approved" } : l)));
      idle(() => {
        refreshValidationCounts?.().catch(() => undefined);
        window.dispatchEvent(new CustomEvent("app:counters:refresh"));
      });
    } catch (e) {
      alert(e?.message || "Échec de la mise à jour");
    }
  };

  const reject = async (id) => {
    try {
      await put(`/operations/leaves/${id}/status`, { status: "Rejected" });
      setLeaves((prev) => prev.map((l) => (l.id === id ? { ...l, status: "Rejected" } : l)));
      idle(() => {
        refreshValidationCounts?.().catch(() => undefined);
        window.dispatchEvent(new CustomEvent("app:counters:refresh"));
      });
    } catch (e) {
      alert(e?.message || "Échec de la mise à jour");
    }
  };

  // ⬇️ création : on ajoute type / paid / halfDay si fournis par le dialog
  const handleCreateLeave = async ({ employee, start, end, type, paid, halfDay }) => {
    const payload = { employee, start, end, status: "Pending" };
    if (type) payload.type = type;
    if (typeof paid === "boolean") payload.paid = paid;
    if (halfDay) payload.halfDay = halfDay;

    const res = await post("/operations/leaves", payload);
    const created = res?.leave || res;
    setLeaves((prev) => [created, ...prev].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    setFormOpen(false);
    idle(() => {
      refreshValidationCounts?.().catch(() => undefined);
      window.dispatchEvent(new CustomEvent("app:counters:refresh"));
    });
  };

  const renderTable = (list) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-50 text-left text-sm text-gray-600">
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
          {list.map((r) => (
            <tr key={r.id} ref={getRef(r.id)} className="border-b hover:bg-gray-50">
              <td className="px-4 py-2">{r.employee}</td>
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
                  <span className="ml-1">
                    {t?.(`common.${(r.status || "").toLowerCase()}`) || r.status}
                  </span>
                </Badge>
              </td>
              <td className="px-4 py-2">
                {r.status === "Pending" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => approve(r.id)}
                      className="text-green-600 border-green-200 hover:bg-green-50"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" /> Approuver
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => reject(r.id)}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <XCircle className="w-4 h-4 mr-1" /> Rejeter
                    </Button>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">—</span>
                )}
              </td>
            </tr>
          ))}
          {!list.length && (
            <tr>
              <td colSpan={8} className="text-center text-sm text-gray-500 py-6">
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
        <Button
          className="bg-emerald-600 hover:bg-emerald-700"
          onClick={() => setFormOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          {t?.("leaves.requestLeave") || "Demander un congé"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Demandes de Congés
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  type="text"
                  placeholder="Rechercher..."
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Filtrer
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-sm text-gray-500 flex items-center py-8">Chargement…</div>
          ) : err ? (
            <div className="text-sm text-red-600 flex items-center py-8">{err}</div>
          ) : (
            <div>
              <div className="inline-flex items-center gap-2 rounded-lg bg-muted p-1 text-muted-foreground">
                {TABS.map((tab) => (
                  <button
                    key={tab}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${
                      activeTab === tab ? "bg-white text-foreground shadow" : "hover:bg-gray-100"
                    }`}
                    onClick={() => setActiveTab(tab)}
                    type="button"
                  >
                    {tab === "pending" && (
                      <span className="inline-flex items-center gap-2">
                        <Clock className="w-4 h-4" /> En attente ({filtered.pending.length})
                      </span>
                    )}
                    {tab === "approved" && (
                      <span className="inline-flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" /> Approuvées ({filtered.approved.length})
                      </span>
                    )}
                    {tab === "rejected" && (
                      <span className="inline-flex items-center gap-2">
                        <XCircle className="w-4 h-4" /> Rejetées ({filtered.rejected.length})
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="mt-6">
                {activeTab === "pending" && renderTable(filtered.pending)}
                {activeTab === "approved" && renderTable(filtered.approved)}
                {activeTab === "rejected" && renderTable(filtered.rejected)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de création */}
      <LeaveFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreateLeave}
        defaultEmployee=""
      />
    </div>
  );
}

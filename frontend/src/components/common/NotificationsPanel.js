import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { get, post } from "../../lib/api";
import { useApp } from "../../contexts/AppContext";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "../ui/sheet";
import { ScrollArea } from "../ui/scroll-area";

function buildNotificationPath(item, user) {
  const data = item?.data || {};
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const canManageOperations = permissions.includes("all") || permissions.includes("operations_read");
  const type = String(item?.type || "").toUpperCase();

  if (type.startsWith("LEAVE")) {
    if (canManageOperations) {
      return data?.leaveId ? `/operations/leaves?request=${data.leaveId}` : "/operations/leaves";
    }
    return "/employee/time";
  }
  if (type.includes("TIMESHEET")) {
    return canManageOperations ? "/operations/time" : "/employee/time";
  }
  if (type.includes("HR_REQUEST")) {
    return canManageOperations ? "/requests/hr" : "/employee/requests";
  }
  if (type.includes("ONBOARDING") || type.includes("OFFBOARDING")) {
    const workflowType = data?.workflowType || (type.includes("OFFBOARDING") ? "Offboarding" : "Onboarding");
    const workflowId = data?.workflowId;
    if (workflowId) {
      return `/people/documents?workflowType=${encodeURIComponent(workflowType)}&workflowId=${encodeURIComponent(workflowId)}`;
    }
    return "/people/documents";
  }
  return null;
}

function isUnread(item) {
  const status = String(item?.status || "").toUpperCase();
  return !item?.readAt && ["PENDING", "SENT", "DELIVERED"].includes(status);
}

export default function NotificationsPanel({ user }) {
  const { formatDate } = useApp();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = async (withSpinner = false) => {
    if (!isAuthenticated) return;
    if (withSpinner) setLoading(true);
    try {
      const [itemsRes, unreadRes] = await Promise.all([
        get("/notifications/mine", { params: { limit: 20 } }),
        get("/notifications/mine/unread-count"),
      ]);
      setItems(Array.isArray(itemsRes?.items) ? itemsRes.items : []);
      setUnreadCount(Number(unreadRes?.unreadCount || 0));
    } catch {
      setItems([]);
      setUnreadCount(0);
    } finally {
      if (withSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    load(false);
    const interval = setInterval(() => load(false), 60000);
    const onVisible = () => {
      if (!document.hidden) load(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) load(true);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const orderedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        if (isUnread(a) !== isUnread(b)) return isUnread(a) ? -1 : 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      }),
    [items]
  );

  const markAsRead = async (id) => {
    if (!id) return;
    setBusyId(id);
    try {
      await post(`/notifications/mine/${id}/read`);
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status: "READ", readAt: new Date().toISOString() } : item
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } finally {
      setBusyId(null);
    }
  };

  const markAllRead = async () => {
    setLoading(true);
    try {
      await post("/notifications/mine/read-all");
      setItems((prev) =>
        prev.map((item) => ({ ...item, status: "READ", readAt: item.readAt || new Date().toISOString() }))
      );
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  const openNotification = async (item) => {
    if (isUnread(item)) await markAsRead(item.id);
    const path = buildNotificationPath(item, user);
    if (path) {
      setOpen(false);
      navigate(path);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="relative border-gray-200">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-[420px]">
        <SheetHeader>
          <div className="flex items-center justify-between gap-3">
            <SheetTitle>Notifications</SheetTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => load(true)} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <Button variant="outline" size="sm" onClick={markAllRead} disabled={!unreadCount || loading}>
                <CheckCheck className="mr-2 h-4 w-4" />
                Tout lire
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-4">
          <div className="mb-3 flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <span>Alertes et validations récentes</span>
            <Badge className="border-emerald-200 bg-white text-emerald-700">{unreadCount} non lue(s)</Badge>
          </div>

          <ScrollArea className="h-[calc(100vh-11rem)] pr-3">
            <div className="space-y-3">
              {!orderedItems.length ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                  Aucune notification pour le moment.
                </div>
              ) : null}

              {orderedItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openNotification(item)}
                  className={`w-full rounded-2xl border p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50/40 ${
                    isUnread(item) ? "border-emerald-200 bg-emerald-50/70" : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                        {isUnread(item) ? (
                          <Badge className="border-emerald-200 bg-white text-emerald-700">Nouveau</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{item.body}</p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">
                      {busyId === item.id ? "..." : formatDate(item.createdAt)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span>{String(item.type || "INFO").replaceAll("_", " ")}</span>
                    <span>{isUnread(item) ? "Cliquer pour ouvrir" : "Déjà lue"}</span>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}

NotificationsPanel.propTypes = {
  user: PropTypes.shape({
    permissions: PropTypes.arrayOf(PropTypes.string),
  }),
};

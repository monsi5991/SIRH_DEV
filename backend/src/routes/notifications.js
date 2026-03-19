import express from "express";
import { prisma } from "../prisma.js";
import { requirePermissions } from "../rbac.js";
import { markAllNotificationsRead, markNotificationRead, sendUserNotification } from "../lib/notifications.js";
import { subscribeUserStream } from "../lib/realtimeHub.js";

const router = express.Router();

const ALLOWED_CHANNELS = new Set(["IN_APP", "EMAIL", "SMS", "WHATSAPP", "PUSH"]);
const ALLOWED_STATUS = new Set(["PENDING", "SENT", "DELIVERED", "FAILED", "READ"]);

function getTenantId(req) {
  return req.auth?.tid || req.user?.tenantId || null;
}

function isSchemaNotReadyError(error) {
  const code = String(error?.code || "").toUpperCase();
  if (code === "P2021" || code === "P2022") return true;
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("unknown field") ||
    message.includes("unknown arg") ||
    message.includes("no such table") ||
    message.includes("relation") ||
    message.includes("column") ||
    message.includes("enum")
  );
}

router.use(requirePermissions(["self_read", "all", "admin_read"], "anyOf"));

router.get("/stream", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.auth?.sub;
    if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });

    const unsubscribe = subscribeUserStream({ tenantId, userId, res });
    req.on("close", unsubscribe);
    req.on("aborted", unsubscribe);
  } catch (e) {
    console.error("[notifications/stream] error:", e);
    if (!res.headersSent) {
      return res.status(500).json({ error: "notifications_stream_failed" });
    }
    res.end();
  }
});

router.get("/mine", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.auth?.sub;
    if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });

    const status = String(req.query.status || "").toUpperCase();
    const channel = String(req.query.channel || "IN_APP").toUpperCase();
    if (status && !ALLOWED_STATUS.has(status)) {
      return res.status(400).json({ error: "status invalide" });
    }
    if (channel && channel !== "ALL" && !ALLOWED_CHANNELS.has(channel)) {
      return res.status(400).json({ error: "channel invalide" });
    }
    const where = {
      tenantId,
      userId,
      ...(channel && channel !== "ALL" ? { channel } : {}),
      ...(status ? { status } : {}),
    };

    const items = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(300, Math.max(1, Number(req.query.limit || 100))),
    });

    return res.json({ items });
  } catch (e) {
    if (isSchemaNotReadyError(e)) {
      console.warn("[notifications/mine] schema not ready:", e?.code || "", e?.message || e);
      return res.json({ items: [], warning: "notifications_schema_not_ready" });
    }
    console.error("[notifications/mine] error:", e);
    return res.status(500).json({ error: "notifications_mine_failed" });
  }
});

router.get("/mine/unread-count", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.auth?.sub;
    if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });

    const count = await prisma.notification.count({
      where: {
        tenantId,
        userId,
        channel: "IN_APP",
        status: { in: ["PENDING", "SENT", "DELIVERED"] },
        readAt: null,
      },
    });

    return res.json({ unreadCount: count });
  } catch (e) {
    if (isSchemaNotReadyError(e)) {
      console.warn("[notifications/unread] schema not ready:", e?.code || "", e?.message || e);
      return res.json({ unreadCount: 0, warning: "notifications_schema_not_ready" });
    }
    console.error("[notifications/unread] error:", e);
    return res.status(500).json({ error: "notifications_unread_failed" });
  }
});

router.post("/mine/:id/read", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.auth?.sub;
    if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });

    const result = await markNotificationRead({
      tenantId,
      userId,
      notificationId: req.params.id,
    });

    if (!result?.count) return res.status(404).json({ error: "notification_not_found" });
    return res.json({ ok: true });
  } catch (e) {
    if (isSchemaNotReadyError(e)) {
      console.warn("[notifications/read] schema not ready:", e?.code || "", e?.message || e);
      return res.json({ ok: true, warning: "notifications_schema_not_ready" });
    }
    console.error("[notifications/read] error:", e);
    return res.status(500).json({ error: "notification_read_failed" });
  }
});

router.post("/mine/read-all", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.auth?.sub;
    if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });

    const updated = await markAllNotificationsRead({ tenantId, userId });

    return res.json({ ok: true, count: updated.count || 0 });
  } catch (e) {
    if (isSchemaNotReadyError(e)) {
      console.warn("[notifications/read-all] schema not ready:", e?.code || "", e?.message || e);
      return res.json({ ok: true, count: 0, warning: "notifications_schema_not_ready" });
    }
    console.error("[notifications/read-all] error:", e);
    return res.status(500).json({ error: "notifications_read_all_failed" });
  }
});

router.post(
  "/send",
  requirePermissions(["all", "admin_read"], "anyOf"),
  async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const actorId = req.auth?.sub || null;
      if (!tenantId) return res.status(401).json({ error: "Unauthorized" });

      const userIds = Array.isArray(req.body?.userIds)
        ? req.body.userIds.map((v) => String(v)).filter(Boolean)
        : [];

      const type = String(req.body?.type || "GENERIC").trim().toUpperCase();
      const title = String(req.body?.title || "").trim();
      const body = String(req.body?.body || "").trim();
      const channel = String(req.body?.channel || "IN_APP").toUpperCase();

      if (!userIds.length || !title || !body) {
        return res.status(400).json({ error: "userIds/title/body requis" });
      }
      if (!ALLOWED_CHANNELS.has(channel)) {
        return res.status(400).json({ error: "channel invalide" });
      }

      const sent = [];
      for (const userId of userIds) {
        const notifications = await sendUserNotification({
          tenantId,
          userId,
          actorId,
          type,
          title,
          body,
          data: req.body?.data || {},
          channels: [channel],
        });
        for (const notification of notifications) {
          if (notification?.id) sent.push(notification.id);
        }
      }

      return res.status(201).json({ ok: true, count: sent.length, ids: sent });
    } catch (e) {
      console.error("[notifications/send] error:", e);
      return res.status(500).json({ error: "notifications_send_failed" });
    }
  }
);

export default router;

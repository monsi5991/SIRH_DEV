import { prisma } from "../prisma.js";
import { publishUserEvent } from "./realtimeHub.js";

const SUPPORTED_CHANNELS = new Set(["IN_APP", "EMAIL", "SMS", "WHATSAPP", "PUSH"]);

function normalizeChannel(channel) {
  const value = String(channel || "IN_APP").trim().toUpperCase();
  return SUPPORTED_CHANNELS.has(value) ? value : "IN_APP";
}

function emitUserNotificationEvent({ tenantId, userId, event, data = {} }) {
  if (!tenantId || !userId) return;
  publishUserEvent({
    tenantId,
    userId,
    event,
    data: {
      ...data,
      emittedAt: new Date().toISOString(),
    },
  });
}

export async function createNotification({
  tenantId,
  userId,
  type,
  title,
  body,
  data = {},
  actorId = null,
  channel = "IN_APP",
  status = "PENDING",
  sentAt = null,
}) {
  if (!tenantId || !userId || !type || !title || !body) return null;
  const normalizedChannel = normalizeChannel(channel);

  try {
    const created = await prisma.notification.create({
      data: {
        tenantId,
        userId,
        actorId,
        type,
        title,
        body,
        data,
        channel: normalizedChannel,
        status,
        sentAt,
      },
    });

    if (created && normalizedChannel === "IN_APP") {
      emitUserNotificationEvent({
        tenantId,
        userId,
        event: "notification.created",
        data: {
          notification: created,
        },
      });
    }

    return created;
  } catch (e) {
    console.warn("[notifications] create failed:", e?.message || e);
    return null;
  }
}

export async function createInAppNotification(input) {
  return createNotification({
    ...input,
    channel: "IN_APP",
  });
}

async function loadNotificationRecipient({ tenantId, userId }) {
  if (!tenantId || !userId) return null;
  return prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      employee: {
        select: {
          phone: true,
          phoneWhatsApp: true,
        },
      },
    },
  });
}

function resolveRecipientAddress(channel, recipient) {
  const normalized = normalizeChannel(channel);
  if (normalized === "EMAIL") return recipient?.email || null;
  if (normalized === "WHATSAPP") return recipient?.employee?.phoneWhatsApp || recipient?.employee?.phone || null;
  return null;
}

async function updateNotificationDelivery(notificationId, status, extraData = {}, sent = false) {
  if (!notificationId) return null;
  const { previousData = {}, ...rest } = extraData || {};
  try {
    return await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status,
        sentAt: sent ? new Date() : undefined,
        data: Object.keys(rest || {}).length
          ? {
              ...previousData,
              ...rest,
            }
          : undefined,
      },
    });
  } catch (e) {
    console.warn("[notifications] update failed:", e?.message || e);
    return null;
  }
}

async function deliverWebhook(channel, notification, recipientAddress) {
  const normalized = normalizeChannel(channel);
  const mode = String(process.env.NOTIFICATIONS_DELIVERY_MODE || "log").trim().toLowerCase();
  const url =
    normalized === "EMAIL"
      ? process.env.NOTIFICATIONS_EMAIL_WEBHOOK_URL
      : normalized === "WHATSAPP"
        ? process.env.NOTIFICATIONS_WHATSAPP_WEBHOOK_URL
        : null;

  const payload = {
    channel: normalized,
    recipient: recipientAddress,
    title: notification.title,
    body: notification.body,
    type: notification.type,
    data: notification.data || {},
  };

  if (mode === "disabled") {
    return { status: "FAILED", meta: { deliveryMode: "disabled", deliveryError: "delivery_disabled" } };
  }

  if (mode === "log" || !url) {
    console.log(`[notify:${normalized}]`, JSON.stringify(payload));
    return {
      status: "SENT",
      meta: {
        deliveryMode: url ? "log" : "log_no_webhook",
      },
    };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.NOTIFICATIONS_WEBHOOK_TOKEN
          ? { Authorization: `Bearer ${process.env.NOTIFICATIONS_WEBHOOK_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return {
        status: "FAILED",
        meta: {
          deliveryMode: "webhook",
          deliveryError: `http_${response.status}`,
        },
      };
    }

    return {
      status: "DELIVERED",
      meta: { deliveryMode: "webhook" },
    };
  } catch (error) {
    return {
      status: "FAILED",
      meta: {
        deliveryMode: "webhook",
        deliveryError: String(error?.message || error),
      },
    };
  }
}

export async function sendUserNotification({
  tenantId,
  userId,
  type,
  title,
  body,
  data = {},
  actorId = null,
  channels = ["IN_APP"],
}) {
  if (!tenantId || !userId || !type || !title || !body) return [];

  const normalizedChannels = Array.from(
    new Set((Array.isArray(channels) ? channels : [channels]).map((value) => normalizeChannel(value)).filter(Boolean))
  );

  const recipient = normalizedChannels.some((channel) => channel !== "IN_APP")
    ? await loadNotificationRecipient({ tenantId, userId })
    : null;

  const delivered = [];
  for (const channel of normalizedChannels) {
    if (channel === "IN_APP") {
      const created = await createNotification({
        tenantId,
        userId,
        actorId,
        type,
        title,
        body,
        data,
        channel,
        status: "SENT",
        sentAt: new Date(),
      });
      if (created) delivered.push(created);
      continue;
    }

    const recipientAddress = resolveRecipientAddress(channel, recipient);
    const created = await createNotification({
      tenantId,
      userId,
      actorId,
      type,
      title,
      body,
      data,
      channel,
      status: recipientAddress ? "PENDING" : "FAILED",
    });
    if (!created) continue;

    if (!recipientAddress) {
      await updateNotificationDelivery(created.id, "FAILED", {
        previousData: created.data || {},
        deliveryChannel: channel,
        deliveryError: "recipient_missing",
      });
      continue;
    }

    const delivery = await deliverWebhook(channel, created, recipientAddress);
    const updated = await updateNotificationDelivery(created.id, delivery.status, {
      previousData: created.data || {},
      deliveryChannel: channel,
      recipient: recipientAddress,
      ...(delivery.meta || {}),
    }, delivery.status === "SENT" || delivery.status === "DELIVERED");
    delivered.push(updated || created);
  }

  return delivered;
}

export async function markNotificationRead({ tenantId, userId, notificationId }) {
  if (!tenantId || !userId || !notificationId) return null;

  const result = await prisma.notification.updateMany({
    where: {
      id: notificationId,
      tenantId,
      userId,
    },
    data: {
      status: "READ",
      readAt: new Date(),
    },
  });

  if (result?.count) {
    emitUserNotificationEvent({
      tenantId,
      userId,
      event: "notification.read",
      data: {
        notificationId,
        count: result.count,
      },
    });
  }

  return result;
}

export async function markAllNotificationsRead({ tenantId, userId }) {
  if (!tenantId || !userId) return null;

  const result = await prisma.notification.updateMany({
    where: {
      tenantId,
      userId,
      channel: "IN_APP",
      readAt: null,
    },
    data: {
      status: "READ",
      readAt: new Date(),
    },
  });

  if (result?.count) {
    emitUserNotificationEvent({
      tenantId,
      userId,
      event: "notifications.read_all",
      data: {
        count: result.count,
      },
    });
  }

  return result;
}

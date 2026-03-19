import express from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { prisma } from "../prisma.js";
import { requirePermissions } from "../rbac.js";
import {
  applyWorkflowAction,
  createWorkflowInstanceForResource,
} from "../lib/workflowEngine.js";
import { createInAppNotification } from "../lib/notifications.js";

const router = express.Router();
const uploadsDir = path.resolve("uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_SIZE_MB || 10);
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const actorId = String(req.auth?.sub || "employee").replace(/[^a-zA-Z0-9_-]/g, "");
    const extension = path.extname(file.originalname || "").slice(0, 12);
    cb(null, `${actorId}_${randomUUID()}${extension}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_UPLOAD_MIME_TYPES.has(file.mimetype)) return cb(null, true);
    return cb(new Error("unsupported_file_type"));
  },
});

const ALLOWED_TYPES = new Set([
  "ATTESTATION",
  "DATA_CHANGE",
  "REMOTE_WORK",
  "IT_ACCESS",
  "PAYROLL_SUPPORT",
  "OTHER",
]);

const ALLOWED_PRIORITIES = new Set(["LOW", "NORMAL", "HIGH", "URGENT"]);
const ALLOWED_STATUSES = new Set([
  "DRAFT",
  "SUBMITTED",
  "PENDING_MANAGER",
  "PENDING_HR",
  "APPROVED",
  "REJECTED",
  "CANCELED",
  "CLOSED",
]);

function getTenantId(req) {
  return req.auth?.tid || req.user?.tenantId || null;
}

async function resolveViewerEmployee(tenantId, userId) {
  if (!tenantId || !userId) return null;
  return prisma.employee.findFirst({
    where: { tenantId, userId },
    include: {
      manager: {
        select: { id: true, userId: true, firstName: true, lastName: true },
      },
    },
  });
}

async function getPermissionSet(req) {
  if (req.__hrRequestPerms) return req.__hrRequestPerms;

  const tenantId = getTenantId(req);
  const userId = req.auth?.sub;
  if (!tenantId || !userId) {
    req.__hrRequestPerms = new Set();
    return req.__hrRequestPerms;
  }

  const rows = await prisma.userRole.findMany({
    where: {
      userId,
      role: { tenantId },
    },
    select: {
      role: {
        select: {
          rolePermissions: {
            select: { permission: { select: { name: true } } },
          },
        },
      },
    },
  });

  const set = new Set();
  for (const r of rows) {
    for (const rp of r.role?.rolePermissions || []) {
      if (rp?.permission?.name) set.add(rp.permission.name);
    }
  }

  req.__hrRequestPerms = set;
  return set;
}

function hasAny(set, names = []) {
  if (!set) return false;
  if (set.has("all")) return true;
  return names.some((n) => set.has(n));
}

function isSchemaNotReadyError(error) {
  const code = String(error?.code || "").toUpperCase();
  if (code === "P2021" || code === "P2022") return true;
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("does not exist") || msg.includes("unknown field");
}

function displayName(person) {
  const value = `${person?.firstName || ""} ${person?.lastName || ""}`.trim();
  return value || person?.email || "Utilisateur";
}

function requestConversationActionLabel(action) {
  const normalized = String(action || "").toUpperCase();
  if (normalized === "APPROVE") return "Validation";
  if (normalized === "REJECT") return "Rejet";
  if (normalized === "CANCEL") return "Annulation";
  if (normalized === "REASSIGN") return "Réaffectation";
  if (normalized === "ESCALATE") return "Escalade";
  if (normalized === "SUBMIT") return "Soumission";
  return "Commentaire";
}

function requestConversationRole(actorId, item) {
  if (!actorId) return "SYSTEM";
  if (actorId === item?.requesterUserId || actorId === item?.employee?.userId) return "EMPLOYEE";
  if (actorId === item?.employee?.manager?.userId) return "MANAGER";
  return "HR";
}

function requestConversationRoleLabel(role) {
  if (role === "EMPLOYEE") return "Employé";
  if (role === "MANAGER") return "Manager";
  if (role === "HR") return "RH";
  return "Système";
}

async function buildHrRequestInteractions(tenantId, item) {
  if (!tenantId || !item) {
    return {
      conversation: [],
      workflowActions: Array.isArray(item?.workflowInstance?.actions) ? item.workflowInstance.actions : [],
    };
  }

  const rawWorkflowActions = Array.isArray(item?.workflowInstance?.actions)
    ? item.workflowInstance.actions
    : [];
  const payloadComments = Array.isArray(item?.payload?.comments) ? item.payload.comments : [];

  const actorIds = Array.from(
    new Set(
      [
        item?.requesterUserId,
        item?.employee?.userId,
        item?.employee?.manager?.userId,
        ...rawWorkflowActions.map((action) => action?.actorId),
        ...payloadComments.map((comment) => comment?.authorId),
      ].filter(Boolean)
    )
  );

  const users = actorIds.length
    ? await prisma.user.findMany({
        where: { tenantId, id: { in: actorIds } },
        select: { id: true, firstName: true, lastName: true, email: true },
      })
    : [];
  const userMap = new Map(users.map((user) => [user.id, user]));

  const hydrateActor = (actorId) => {
    const role = requestConversationRole(actorId, item);
    return {
      role,
      roleLabel: requestConversationRoleLabel(role),
      name: actorId ? displayName(userMap.get(actorId)) : "Système",
      isOwnMessage: Boolean(actorId && (actorId === item?.requesterUserId || actorId === item?.employee?.userId)),
    };
  };

  const workflowActions = rawWorkflowActions.map((action) => {
    const actor = hydrateActor(action?.actorId || null);
    return {
      ...action,
      actorName: actor.name,
      actorRole: actor.role,
      actorRoleLabel: actor.roleLabel,
      displayActionLabel: requestConversationActionLabel(action?.action),
    };
  });

  const workflowConversation = rawWorkflowActions
    .filter((action) => String(action?.comment || "").trim())
    .map((action) => {
      const actor = hydrateActor(action?.actorId || null);
      return {
        id: action.id,
        message: String(action.comment || "").trim(),
        createdAt: action.createdAt,
        authorId: action.actorId || null,
        authorName: actor.name,
        authorRole: actor.role,
        authorRoleLabel: actor.roleLabel,
        isOwnMessage: actor.isOwnMessage,
        action: action.action,
        actionLabel: requestConversationActionLabel(action.action),
        source: "workflow",
      };
    });

  const payloadConversation = payloadComments
    .filter((comment) => String(comment?.message || "").trim())
    .map((comment) => {
      const actor = hydrateActor(comment?.authorId || null);
      return {
        id:
          comment.id ||
          `payload_${comment.createdAt || "unknown"}_${comment.authorId || "system"}_${String(comment.message || "")
            .slice(0, 24)
            .replace(/[^a-zA-Z0-9_-]/g, "")}`,
        message: String(comment.message || "").trim(),
        createdAt: comment.createdAt || item.updatedAt || item.createdAt,
        authorId: comment.authorId || null,
        authorName: actor.name,
        authorRole: actor.role,
        authorRoleLabel: actor.roleLabel,
        isOwnMessage: actor.isOwnMessage,
        action: comment.action || "COMMENT",
        actionLabel: requestConversationActionLabel(comment.action || "COMMENT"),
        source: "payload",
      };
    });

  const conversation = [...workflowConversation, ...payloadConversation].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  );

  return { conversation, workflowActions };
}

function canAccessHrRequestItem({ item, userId, viewerEmployee, canCompany, canTeam }) {
  const isSelf =
    item?.requesterUserId === userId ||
    (viewerEmployee?.id && item?.employeeId && item.employeeId === viewerEmployee.id);
  const isTeam = viewerEmployee?.id && item?.employee?.managerId === viewerEmployee.id;
  return canCompany || isSelf || (canTeam && isTeam);
}

router.use(requirePermissions(["self_read", "operations_read", "directory_read", "all"], "anyOf"));

router.post(
  "/attachments",
  requirePermissions(["self_write", "operations_write", "all"], "anyOf"),
  upload.single("file"),
  async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = req.auth?.sub;
      if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });

      const viewerEmployee = await resolveViewerEmployee(tenantId, userId);
      if (!viewerEmployee) return res.status(404).json({ error: "employee_not_found" });
      if (!req.file) return res.status(400).json({ error: "file_missing" });

      return res.status(201).json({
        id: path.basename(req.file.filename),
        name: req.file.originalname || "Pièce jointe",
        url: `/uploads/${path.basename(req.file.filename)}`,
        mimeType: req.file.mimetype || "application/octet-stream",
        size: Number(req.file.size || 0),
        uploadedAt: new Date().toISOString(),
        uploadedByEmployeeId: viewerEmployee.id,
      });
    } catch (e) {
      if (e instanceof multer.MulterError && e.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          error: "file_too_large",
          message: `Fichier trop volumineux. Taille max: ${MAX_UPLOAD_MB} Mo.`,
        });
      }
      if (e?.message === "unsupported_file_type") {
        return res.status(400).json({
          error: "unsupported_file_type",
          message: "Type de fichier non autorisé. Utilisez PDF, JPG, PNG, WEBP, DOC ou DOCX.",
        });
      }
      console.error("[hr-requests/upload] error:", e);
      return res.status(400).json({ error: "hr_request_attachment_upload_failed" });
    }
  }
);

router.delete(
  "/attachments/:fileId",
  requirePermissions(["self_write", "operations_write", "all"], "anyOf"),
  async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = req.auth?.sub;
      if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });

      const viewerEmployee = await resolveViewerEmployee(tenantId, userId);
      if (!viewerEmployee) return res.status(404).json({ error: "employee_not_found" });

      const fileId = path.basename(String(req.params.fileId || ""));
      if (!fileId || fileId.includes("..")) return res.status(400).json({ error: "invalid_attachment_id" });
      if (!fileId.startsWith(`${String(userId).replace(/[^a-zA-Z0-9_-]/g, "")}_`)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const uploadUrl = `/uploads/${fileId}`;
      const linkedRequests = await prisma.hrRequest.findMany({
        where: {
          tenantId,
          OR: [
            { requesterUserId: userId },
            { employeeId: viewerEmployee.id },
          ],
        },
        select: {
          id: true,
          payload: true,
        },
      });

      const stillLinked = linkedRequests.some((request) =>
        Array.isArray(request?.payload?.attachments) &&
        request.payload.attachments.some((attachment) => attachment?.url === uploadUrl)
      );
      if (stillLinked) {
        return res.status(409).json({ error: "attachment_already_linked" });
      }

      const absolutePath = path.resolve(uploadsDir, fileId);
      if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
        fs.unlinkSync(absolutePath);
      }

      return res.json({ ok: true, fileId });
    } catch (e) {
      console.error("[hr-requests/delete-attachment] error:", e);
      return res.status(500).json({ error: "hr_request_attachment_delete_failed" });
    }
  }
);

router.get("/", async (req, res) => {
  let scope = "self";
  try {
    const tenantId = getTenantId(req);
    const userId = req.auth?.sub;
    if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });

    const perms = await getPermissionSet(req);
    const canCompany = hasAny(perms, ["all", "admin_read"]);
    const canTeam = hasAny(perms, ["team_read", "team_write", "approvals_read", "approvals_write"]);

    const viewerEmployee = await resolveViewerEmployee(tenantId, userId);

    const requestedScope = String(req.query.scope || "").toLowerCase();
    scope =
      requestedScope === "company" && canCompany
        ? "company"
        : requestedScope === "team" && canTeam
        ? "team"
        : "self";

    const where = { tenantId };

    if (scope === "self") {
      where.OR = [
        { requesterUserId: userId },
        ...(viewerEmployee?.id ? [{ employeeId: viewerEmployee.id }] : []),
      ];
    } else if (scope === "team") {
      if (!viewerEmployee?.id) return res.json({ items: [], scope });
      const team = await prisma.employee.findMany({
        where: { tenantId, managerId: viewerEmployee.id },
        select: { id: true },
      });
      const ids = team.map((e) => e.id);
      where.employeeId = { in: ids.length ? ids : ["__none__"] };
    }

    if (req.query.status) {
      const status = String(req.query.status).toUpperCase();
      if (!ALLOWED_STATUSES.has(status)) {
        return res.status(400).json({ error: "status invalide" });
      }
      where.status = status;
    }
    if (req.query.type) {
      const t = String(req.query.type).toUpperCase();
      if (ALLOWED_TYPES.has(t)) where.type = t;
    }

    const items = await prisma.hrRequest.findMany({
      where,
      include: {
        requesterUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            managerId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(200, Math.max(1, Number(req.query.limit || 50))),
    });

    return res.json({ items, scope });
  } catch (e) {
    if (isSchemaNotReadyError(e)) {
      console.warn("[hr-requests/list] schema not ready:", e?.code || "", e?.message || e);
      return res.json({
        items: [],
        scope,
        warning: "hr_requests_schema_not_ready",
      });
    }
    console.error("[hr-requests/list] error:", e);
    return res.status(500).json({ error: "hr_requests_list_failed" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.auth?.sub;
    if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });

    const perms = await getPermissionSet(req);
    const canCompany = hasAny(perms, ["all", "admin_read"]);
    const canTeam = hasAny(perms, ["team_read", "team_write", "approvals_read", "approvals_write"]);
    const viewerEmployee = await resolveViewerEmployee(tenantId, userId);

    const item = await prisma.hrRequest.findFirst({
      where: { id: req.params.id, tenantId },
      include: {
        requesterUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        employee: {
          select: {
            id: true,
            userId: true,
            firstName: true,
            lastName: true,
            email: true,
            managerId: true,
            manager: {
              select: { id: true, userId: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        workflowInstance: {
          include: {
            actions: { orderBy: { createdAt: "desc" }, take: 200 },
            definition: { include: { steps: { orderBy: { level: "asc" } } } },
          },
        },
      },
    });

    if (!item) return res.status(404).json({ error: "hr_request_not_found" });
    if (!canAccessHrRequestItem({ item, userId, viewerEmployee, canCompany, canTeam })) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const interactions = await buildHrRequestInteractions(tenantId, item);

    return res.json({
      ...item,
      conversation: interactions.conversation,
      workflowInstance: item.workflowInstance
        ? {
            ...item.workflowInstance,
            actions: interactions.workflowActions,
          }
        : null,
    });
  } catch (e) {
    console.error("[hr-requests/get] error:", e);
    return res.status(500).json({ error: "hr_request_get_failed" });
  }
});

router.get("/:id/comments", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.auth?.sub;
    if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });

    const perms = await getPermissionSet(req);
    const canCompany = hasAny(perms, ["all", "admin_read"]);
    const canTeam = hasAny(perms, ["team_read", "team_write", "approvals_read", "approvals_write"]);
    const viewerEmployee = await resolveViewerEmployee(tenantId, userId);

    const item = await prisma.hrRequest.findFirst({
      where: { id: req.params.id, tenantId },
      include: {
        employee: {
          select: {
            id: true,
            userId: true,
            managerId: true,
            manager: {
              select: { id: true, userId: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        workflowInstance: {
          include: {
            actions: { orderBy: { createdAt: "desc" }, take: 200 },
          },
        },
      },
    });
    if (!item) return res.status(404).json({ error: "hr_request_not_found" });
    if (!canAccessHrRequestItem({ item, userId, viewerEmployee, canCompany, canTeam })) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const interactions = await buildHrRequestInteractions(tenantId, item);
    return res.json({ comments: interactions.conversation });
  } catch (e) {
    console.error("[hr-requests/comments] error:", e);
    return res.status(500).json({ error: "hr_request_comments_failed" });
  }
});

router.post(
  "/:id/comments",
  requirePermissions(["self_write", "operations_write", "team_write", "approvals_write", "all"], "anyOf"),
  async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = req.auth?.sub;
      if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });

      const message = String(req.body?.message || req.body?.comment || "").trim();
      if (!message) return res.status(400).json({ error: "comment_required", message: "Le commentaire est requis." });
      if (message.length > 4000) {
        return res.status(400).json({
          error: "comment_too_long",
          message: "Le commentaire dépasse la longueur autorisée.",
        });
      }

      const perms = await getPermissionSet(req);
      const canCompany = hasAny(perms, ["all", "admin_read"]);
      const canTeam = hasAny(perms, ["team_read", "team_write", "approvals_read", "approvals_write"]);
      const viewerEmployee = await resolveViewerEmployee(tenantId, userId);

      const item = await prisma.hrRequest.findFirst({
        where: { id: req.params.id, tenantId },
        include: {
          requesterUser: { select: { id: true } },
          employee: {
            select: {
              id: true,
              userId: true,
              firstName: true,
              lastName: true,
              managerId: true,
              manager: {
                select: { id: true, userId: true, firstName: true, lastName: true, email: true },
              },
            },
          },
          workflowInstance: {
            include: {
              actions: { orderBy: { createdAt: "desc" }, take: 200 },
              definition: { include: { steps: { orderBy: { level: "asc" } } } },
            },
          },
        },
      });
      if (!item) return res.status(404).json({ error: "hr_request_not_found" });
      if (!canAccessHrRequestItem({ item, userId, viewerEmployee, canCompany, canTeam })) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const updated = await prisma.$transaction(async (tx) => {
        if (item.workflowInstance?.id) {
          await applyWorkflowAction({
            tx,
            tenantId,
            instanceId: item.workflowInstance.id,
            actorId: userId,
            action: "COMMENT",
            comment: message,
            payload: { channel: "EMPLOYEE_SELF_SERVICE" },
          });
        } else {
          const payloadObject =
            item.payload && typeof item.payload === "object" && !Array.isArray(item.payload)
              ? item.payload
              : {};
          const nextComments = [
            ...(Array.isArray(payloadObject.comments) ? payloadObject.comments : []),
            {
              id: `payload_comment_${randomUUID()}`,
              authorId: userId,
              message,
              action: "COMMENT",
              createdAt: new Date().toISOString(),
            },
          ];
          await tx.hrRequest.update({
            where: { id: item.id },
            data: {
              payload: {
                ...payloadObject,
                comments: nextComments,
              },
            },
          });
        }

        return tx.hrRequest.findFirst({
          where: { id: item.id, tenantId },
          include: {
            requesterUser: { select: { id: true, firstName: true, lastName: true, email: true } },
            employee: {
              select: {
                id: true,
                userId: true,
                firstName: true,
                lastName: true,
                email: true,
                managerId: true,
                manager: {
                  select: { id: true, userId: true, firstName: true, lastName: true, email: true },
                },
              },
            },
            workflowInstance: {
              include: {
                actions: { orderBy: { createdAt: "desc" }, take: 200 },
                definition: { include: { steps: { orderBy: { level: "asc" } } } },
              },
            },
          },
        });
      });

      const recipientIds = new Set();
      const isRequesterActor = userId === item.requesterUserId || userId === item.employee?.userId;
      if (isRequesterActor) {
        if (updated?.currentApproverId && updated.currentApproverId !== userId) {
          recipientIds.add(updated.currentApproverId);
        }
      } else {
        if (updated?.requesterUserId && updated.requesterUserId !== userId) {
          recipientIds.add(updated.requesterUserId);
        }
        if (updated?.employee?.userId && updated.employee.userId !== userId) {
          recipientIds.add(updated.employee.userId);
        }
      }

      await Promise.allSettled(
        Array.from(recipientIds).map((recipientUserId) =>
          createInAppNotification({
            tenantId,
            userId: recipientUserId,
            actorId: userId,
            type: "HR_REQUEST_COMMENTED",
            title: "Nouveau commentaire sur une demande RH",
            body: `${updated?.title || "Une demande RH"} a reçu un nouveau commentaire.`,
            data: { requestId: updated?.id || item.id },
          })
        )
      );

      const interactions = await buildHrRequestInteractions(tenantId, updated);
      const latestComment = interactions.conversation[interactions.conversation.length - 1] || null;

      return res.status(201).json({
        comment: latestComment,
        request: {
          ...updated,
          conversation: interactions.conversation,
          workflowInstance: updated?.workflowInstance
            ? {
                ...updated.workflowInstance,
                actions: interactions.workflowActions,
              }
            : null,
        },
      });
    } catch (e) {
      console.error("[hr-requests/add-comment] error:", e);
      return res.status(500).json({ error: "hr_request_comment_failed" });
    }
  }
);

router.post(
  "/",
  requirePermissions(["self_write", "operations_write", "all"], "anyOf"),
  async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = req.auth?.sub;
      if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });

      const perms = await getPermissionSet(req);
      const canCompany = hasAny(perms, ["all", "admin_read"]);
      const canTeam = hasAny(perms, ["team_read", "team_write", "approvals_read", "approvals_write"]);
      const viewerEmployee = await resolveViewerEmployee(tenantId, userId);

      const type = String(req.body?.type || "").toUpperCase();
      const title = String(req.body?.title || "").trim();
      if (!ALLOWED_TYPES.has(type) || !title) {
        return res.status(400).json({ error: "type/title invalides" });
      }

      const priority = String(req.body?.priority || "NORMAL").toUpperCase();
      const employeeId = req.body?.employeeId || viewerEmployee?.id || null;

      if (!employeeId) return res.status(400).json({ error: "employeeId introuvable" });

      const employee = await prisma.employee.findFirst({
        where: { id: employeeId, tenantId },
        select: {
          id: true,
          managerId: true,
          userId: true,
          firstName: true,
          lastName: true,
          manager: {
            select: { id: true, userId: true, firstName: true, lastName: true },
          },
        },
      });
      if (!employee) return res.status(404).json({ error: "employee_not_found" });

      const isSelf = viewerEmployee?.id && employee.id === viewerEmployee.id;
      const isTeam = viewerEmployee?.id && employee.managerId === viewerEmployee.id;
      if (!canCompany && !isSelf && !(canTeam && isTeam)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const created = await prisma.$transaction(async (tx) => {
        const request = await tx.hrRequest.create({
          data: {
            tenantId,
            requesterUserId: userId,
            employeeId: employee.id,
            type,
            title,
            description: req.body?.description || null,
            payload: req.body?.payload || {},
            status: employee.managerId ? "PENDING_MANAGER" : "PENDING_HR",
            priority: ALLOWED_PRIORITIES.has(priority) ? priority : "NORMAL",
            currentApproverId: null,
            slaDueAt: req.body?.slaDueAt ? new Date(req.body.slaDueAt) : null,
          },
        });

        const workflow = await createWorkflowInstanceForResource({
          tx,
          tenantId,
          module: "HR_REQUEST",
          resourceType: "HrRequest",
          resourceId: request.id,
          requestedById: userId,
          preferredDefinitionCode: req.body?.workflowCode || null,
          payload: {
            type,
            priority,
          },
        });

        return tx.hrRequest.update({
          where: { id: request.id },
          data: {
            workflowInstanceId: workflow.id,
            currentApproverId: workflow.assignedToId || null,
          },
          include: {
            requesterUser: { select: { id: true, firstName: true, lastName: true, email: true } },
            employee: { select: { id: true, firstName: true, lastName: true, email: true, managerId: true, userId: true } },
            workflowInstance: true,
          },
        });
      });

      if (created.employee?.userId) {
        await createInAppNotification({
          tenantId,
          userId: created.employee.userId,
          actorId: userId,
          type: "HR_REQUEST_SUBMITTED",
          title: "Demande RH enregistrée",
          body: `${created.title} a été soumise.`,
          data: { requestId: created.id, status: created.status },
        });
      }

      const approverUserId = created.workflowInstance?.assignedToId || employee.manager?.userId || null;
      if (approverUserId && approverUserId !== created.employee?.userId) {
        await createInAppNotification({
          tenantId,
          userId: approverUserId,
          actorId: userId,
          type: "HR_REQUEST_PENDING_APPROVAL",
          title: "Demande RH à traiter",
          body: `${employee.firstName} ${employee.lastName}: ${created.title}`,
          data: { requestId: created.id, type: created.type },
        });
      }

      return res.status(201).json(created);
    } catch (e) {
      console.error("[hr-requests/create] error:", e);
      return res.status(500).json({ error: "hr_request_create_failed" });
    }
  }
);

router.post(
  "/:id/approve",
  requirePermissions(["approvals_write", "team_write", "all"], "anyOf"),
  async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = req.auth?.sub;
      if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });

      const perms = await getPermissionSet(req);
      const canCompany = hasAny(perms, ["all", "admin_read"]);
      const viewerEmployee = await resolveViewerEmployee(tenantId, userId);

      const item = await prisma.hrRequest.findFirst({
        where: { id: req.params.id, tenantId },
        include: {
          employee: { select: { id: true, managerId: true, userId: true } },
          workflowInstance: true,
          requesterUser: { select: { id: true } },
        },
      });

      if (!item) return res.status(404).json({ error: "hr_request_not_found" });

      const inMyTeam = viewerEmployee?.id && item.employee?.managerId === viewerEmployee.id;
      if (!canCompany && !inMyTeam) return res.status(403).json({ error: "Forbidden" });

      const updated = await prisma.$transaction(async (tx) => {
        let workflow = item.workflowInstance;
        if (workflow) {
          workflow = await applyWorkflowAction({
            tx,
            tenantId,
            instanceId: workflow.id,
            actorId: userId,
            action: "APPROVE",
            comment: req.body?.comment || null,
            payload: req.body?.payload || {},
          });
        }

        const nextStatus = workflow?.status === "APPROVED" ? "APPROVED" : "PENDING_HR";
        return tx.hrRequest.update({
          where: { id: item.id },
          data: {
            status: nextStatus,
            currentApproverId: workflow?.assignedToId || null,
            resolvedAt: nextStatus === "APPROVED" ? new Date() : null,
          },
        });
      });

      if (item.requesterUser?.id) {
        await createInAppNotification({
          tenantId,
          userId: item.requesterUser.id,
          actorId: userId,
          type: "HR_REQUEST_APPROVED",
          title: "Demande RH approuvée",
          body: `Votre demande \"${item.title}\" a avancé dans le workflow.`,
          data: { requestId: item.id, status: updated.status },
        });
      }

      if (updated.currentApproverId && updated.currentApproverId !== userId && updated.status !== "APPROVED") {
        await createInAppNotification({
          tenantId,
          userId: updated.currentApproverId,
          actorId: userId,
          type: "HR_REQUEST_PENDING_APPROVAL",
          title: "Demande RH à traiter",
          body: `Une demande RH (${item.title}) attend votre validation.`,
          data: { requestId: item.id, status: updated.status, type: item.type },
        });
      }

      return res.json(updated);
    } catch (e) {
      console.error("[hr-requests/approve] error:", e);
      return res.status(500).json({ error: "hr_request_approve_failed" });
    }
  }
);

router.post(
  "/:id/reject",
  requirePermissions(["approvals_write", "team_write", "all"], "anyOf"),
  async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = req.auth?.sub;
      if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });

      const perms = await getPermissionSet(req);
      const canCompany = hasAny(perms, ["all", "admin_read"]);
      const viewerEmployee = await resolveViewerEmployee(tenantId, userId);

      const item = await prisma.hrRequest.findFirst({
        where: { id: req.params.id, tenantId },
        include: {
          employee: { select: { id: true, managerId: true } },
          workflowInstance: true,
          requesterUser: { select: { id: true } },
        },
      });

      if (!item) return res.status(404).json({ error: "hr_request_not_found" });

      const inMyTeam = viewerEmployee?.id && item.employee?.managerId === viewerEmployee.id;
      if (!canCompany && !inMyTeam) return res.status(403).json({ error: "Forbidden" });

      const updated = await prisma.$transaction(async (tx) => {
        if (item.workflowInstance) {
          await applyWorkflowAction({
            tx,
            tenantId,
            instanceId: item.workflowInstance.id,
            actorId: userId,
            action: "REJECT",
            comment: req.body?.comment || null,
            payload: req.body?.payload || {},
          });
        }

        return tx.hrRequest.update({
          where: { id: item.id },
          data: {
            status: "REJECTED",
            currentApproverId: null,
            resolvedAt: new Date(),
          },
        });
      });

      if (item.requesterUser?.id) {
        await createInAppNotification({
          tenantId,
          userId: item.requesterUser.id,
          actorId: userId,
          type: "HR_REQUEST_REJECTED",
          title: "Demande RH rejetée",
          body: `Votre demande \"${item.title}\" a été rejetée.`,
          data: { requestId: item.id, status: updated.status },
        });
      }

      return res.json(updated);
    } catch (e) {
      console.error("[hr-requests/reject] error:", e);
      return res.status(500).json({ error: "hr_request_reject_failed" });
    }
  }
);

router.post(
  "/:id/cancel",
  requirePermissions(["self_write", "operations_write", "all"], "anyOf"),
  async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = req.auth?.sub;
      if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });

      const viewerEmployee = await resolveViewerEmployee(tenantId, userId);

      const item = await prisma.hrRequest.findFirst({
        where: { id: req.params.id, tenantId },
        include: { workflowInstance: true },
      });
      if (!item) return res.status(404).json({ error: "hr_request_not_found" });

      const isSelf =
        item.requesterUserId === userId ||
        (viewerEmployee?.id && item.employeeId && item.employeeId === viewerEmployee.id);
      if (!isSelf) return res.status(403).json({ error: "Forbidden" });

      const updated = await prisma.$transaction(async (tx) => {
        if (item.workflowInstance) {
          await applyWorkflowAction({
            tx,
            tenantId,
            instanceId: item.workflowInstance.id,
            actorId: userId,
            action: "CANCEL",
            comment: req.body?.comment || null,
            payload: req.body?.payload || {},
          });
        }

        return tx.hrRequest.update({
          where: { id: item.id },
          data: {
            status: "CANCELED",
            currentApproverId: null,
            resolvedAt: new Date(),
          },
        });
      });

      return res.json(updated);
    } catch (e) {
      console.error("[hr-requests/cancel] error:", e);
      return res.status(500).json({ error: "hr_request_cancel_failed" });
    }
  }
);

export default router;

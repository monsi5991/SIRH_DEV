import express from "express";
import { prisma } from "../prisma.js";
import { requirePermissions } from "../rbac.js";
import {
  applyWorkflowAction,
  createWorkflowInstanceForResource,
} from "../lib/workflowEngine.js";
import {
  getPermissionSet,
  hasAnyPermission,
} from "../lib/accessScope.js";

const router = express.Router();

const ALLOWED_MODULES = new Set([
  "LEAVE",
  "EXPENSE",
  "HR_REQUEST",
  "TRAINING",
  "DOCUMENT",
  "OTHER",
]);

const ALLOWED_APPROVER_TYPES = new Set(["MANAGER", "HR", "ROLE", "USER"]);
const ALLOWED_INSTANCE_STATUS = new Set(["PENDING", "APPROVED", "REJECTED", "CANCELED"]);
const COMPANY_WORKFLOW_PERMS = ["all", "admin_read"];

function getTenantId(req) {
  return req.auth?.tid || req.user?.tenantId || null;
}

router.use(requirePermissions(["operations_read", "directory_read", "all"], "anyOf"));

router.get("/definitions", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });

    const module = String(req.query.module || "").toUpperCase();
    const where = {
      tenantId,
      ...(module && ALLOWED_MODULES.has(module) ? { module } : {}),
    };

    const items = await prisma.workflowDefinition.findMany({
      where,
      include: {
        steps: { orderBy: { level: "asc" } },
      },
      orderBy: [{ module: "asc" }, { name: "asc" }],
    });

    return res.json({ items });
  } catch (e) {
    console.error("[workflows/definitions] error:", e);
    return res.status(500).json({ error: "workflows_definitions_failed" });
  }
});

router.post(
  "/definitions",
  requirePermissions(["admin_read", "all"], "anyOf"),
  async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ error: "Unauthorized" });

      const code = String(req.body?.code || "").trim().toUpperCase();
      const name = String(req.body?.name || "").trim();
      const module = String(req.body?.module || "").trim().toUpperCase();
      const maxLevel = Number(req.body?.maxLevel || 1);

      if (!code || !name || !ALLOWED_MODULES.has(module)) {
        return res.status(400).json({ error: "code, name, module requis" });
      }

      const created = await prisma.workflowDefinition.create({
        data: {
          tenantId,
          code,
          name,
          module,
          isActive: req.body?.isActive !== false,
          maxLevel: Number.isFinite(maxLevel) && maxLevel > 0 ? Math.floor(maxLevel) : 1,
        },
      });

      return res.status(201).json(created);
    } catch (e) {
      if (e?.code === "P2002") return res.status(409).json({ error: "workflow_code_already_exists" });
      console.error("[workflows/create-definition] error:", e);
      return res.status(500).json({ error: "workflow_definition_create_failed" });
    }
  }
);

router.post(
  "/definitions/:id/steps",
  requirePermissions(["admin_read", "all"], "anyOf"),
  async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ error: "Unauthorized" });

      const { id } = req.params;
      const level = Number(req.body?.level);
      const approverType = String(req.body?.approverType || "").toUpperCase();

      if (!Number.isFinite(level) || level <= 0 || !ALLOWED_APPROVER_TYPES.has(approverType)) {
        return res.status(400).json({ error: "level/approverType invalides" });
      }
      if (approverType === "ROLE" && !String(req.body?.approverRole || "").trim()) {
        return res.status(400).json({ error: "approverRole requis pour approverType=ROLE" });
      }
      if (approverType === "USER" && !String(req.body?.approverUserId || "").trim()) {
        return res.status(400).json({ error: "approverUserId requis pour approverType=USER" });
      }

      const definition = await prisma.workflowDefinition.findFirst({
        where: { id, tenantId },
        select: { id: true },
      });
      if (!definition) return res.status(404).json({ error: "workflow_definition_not_found" });

      const step = await prisma.workflowStep.create({
        data: {
          workflowDefinitionId: id,
          level: Math.floor(level),
          approverType,
          approverRole: req.body?.approverRole || null,
          approverUserId: req.body?.approverUserId || null,
          slaHours: req.body?.slaHours != null ? Number(req.body.slaHours) : null,
          isRequired: req.body?.isRequired !== false,
        },
      });

      await prisma.workflowDefinition.update({
        where: { id },
        data: { maxLevel: Math.max(Math.floor(level), 1) },
      });

      return res.status(201).json(step);
    } catch (e) {
      if (e?.code === "P2002") return res.status(409).json({ error: "workflow_step_level_exists" });
      console.error("[workflows/create-step] error:", e);
      return res.status(500).json({ error: "workflow_step_create_failed" });
    }
  }
);

router.get("/instances", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.auth?.sub;
    if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });
    const permissions = await getPermissionSet(req);
    const canCompany = hasAnyPermission(permissions, COMPANY_WORKFLOW_PERMS);

    const status = String(req.query.status || "").toUpperCase();
    const module = String(req.query.module || "").toUpperCase();
    const assignedToMe = req.query.assignedToMe === "1" || req.query.assignedToMe === "true";
    if (status && !ALLOWED_INSTANCE_STATUS.has(status)) {
      return res.status(400).json({ error: "status invalide" });
    }

    const where = {
      tenantId,
      ...(status ? { status } : {}),
      ...(ALLOWED_MODULES.has(module) ? { module } : {}),
      ...(assignedToMe ? { assignedToId: userId } : {}),
      ...(!canCompany && !assignedToMe
        ? {
            OR: [{ assignedToId: userId }, { requestedById: userId }],
          }
        : {}),
    };

    const items = await prisma.workflowInstance.findMany({
      where,
      include: {
        definition: { select: { id: true, code: true, name: true, module: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return res.json({ items });
  } catch (e) {
    console.error("[workflows/instances] error:", e);
    return res.status(500).json({ error: "workflow_instances_failed" });
  }
});

router.get("/instances/:id", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.auth?.sub;
    if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });
    const permissions = await getPermissionSet(req);
    const canCompany = hasAnyPermission(permissions, COMPANY_WORKFLOW_PERMS);

    const { id } = req.params;

    const instance = await prisma.workflowInstance.findFirst({
      where: { id, tenantId },
      include: {
        definition: { include: { steps: { orderBy: { level: "asc" } } } },
        actions: { orderBy: { createdAt: "desc" }, take: 200 },
      },
    });

    if (!instance) return res.status(404).json({ error: "workflow_instance_not_found" });
    if (!canCompany && instance.assignedToId !== userId && instance.requestedById !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return res.json(instance);
  } catch (e) {
    console.error("[workflows/instance] error:", e);
    return res.status(500).json({ error: "workflow_instance_failed" });
  }
});

router.post(
  "/instances",
  requirePermissions(["operations_write", "all"], "anyOf"),
  async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const actorId = req.auth?.sub || null;
      if (!tenantId) return res.status(401).json({ error: "Unauthorized" });

      const module = String(req.body?.module || "").toUpperCase();
      const resourceType = String(req.body?.resourceType || "").trim();
      const resourceId = String(req.body?.resourceId || "").trim();

      if (!ALLOWED_MODULES.has(module) || !resourceType || !resourceId) {
        return res.status(400).json({ error: "module/resourceType/resourceId requis" });
      }

      const instance = await createWorkflowInstanceForResource({
        tenantId,
        module,
        resourceType,
        resourceId,
        requestedById: actorId,
        preferredDefinitionCode: req.body?.definitionCode || null,
        payload: req.body?.payload || {},
      });

      return res.status(201).json(instance);
    } catch (e) {
      console.error("[workflows/create-instance] error:", e);
      return res.status(500).json({ error: "workflow_instance_create_failed" });
    }
  }
);

router.post(
  "/instances/:id/actions",
  requirePermissions(["approvals_write", "team_write", "all"], "anyOf"),
  async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const actorId = req.auth?.sub || null;
      if (!tenantId || !actorId) return res.status(401).json({ error: "Unauthorized" });
      const permissions = await getPermissionSet(req);
      const canCompany = hasAnyPermission(permissions, COMPANY_WORKFLOW_PERMS);

      const { id } = req.params;
      const action = String(req.body?.action || "").toUpperCase();
      const instance = await prisma.workflowInstance.findFirst({
        where: { id, tenantId },
        select: { id: true, assignedToId: true, requestedById: true },
      });
      if (!instance) return res.status(404).json({ error: "workflow_instance_not_found" });

      if (!canCompany) {
        const isAssigned = instance.assignedToId === actorId;
        const isRequester = instance.requestedById === actorId;
        const approverOnlyActions = new Set(["APPROVE", "REJECT", "REASSIGN", "ESCALATE"]);

        if (approverOnlyActions.has(action) && !isAssigned) {
          return res.status(403).json({ error: "Forbidden" });
        }
        if (action === "CANCEL" && !isRequester && !isAssigned) {
          return res.status(403).json({ error: "Forbidden" });
        }
        if (!approverOnlyActions.has(action) && action !== "CANCEL" && !isRequester && !isAssigned) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        return applyWorkflowAction({
          tx,
          tenantId,
          instanceId: id,
          actorId,
          action,
          comment: req.body?.comment || null,
          payload: req.body?.payload || {},
        });
      });

      return res.json(updated);
    } catch (e) {
      if (String(e?.message || "").includes("not_found")) {
        return res.status(404).json({ error: "workflow_instance_not_found" });
      }
      if (String(e?.message || "").includes("invalid")) {
        return res.status(400).json({ error: "workflow_action_invalid" });
      }
      console.error("[workflows/action] error:", e);
      return res.status(500).json({ error: "workflow_action_failed" });
    }
  }
);

export default router;

import express from "express";
import { prisma } from "../prisma.js";
import { requirePermissions } from "../rbac.js";
import { createInAppNotification } from "../lib/notifications.js";
import {
  canAccessEmployeeId,
  resolveAccessContext,
} from "../lib/accessScope.js";

const router = express.Router();

const ALLOWED_TYPES = new Set([
  "ANNUAL",
  "PROBATION",
  "MID_YEAR",
  "ONE_ON_ONE",
  "EXIT",
  "OTHER",
]);

const ALLOWED_STATUS = new Set(["PLANNED", "IN_PROGRESS", "DONE", "CANCELED"]);

function getTenantId(req) {
  return req.auth?.tid || req.user?.tenantId || null;
}

async function getPermissionSet(req) {
  if (req.__interviewPerms) return req.__interviewPerms;

  const tenantId = getTenantId(req);
  const userId = req.auth?.sub;
  if (!tenantId || !userId) {
    req.__interviewPerms = new Set();
    return req.__interviewPerms;
  }

  const rows = await prisma.userRole.findMany({
    where: { userId, role: { tenantId } },
    select: {
      role: {
        select: {
          rolePermissions: { select: { permission: { select: { name: true } } } },
        },
      },
    },
  });

  const set = new Set();
  for (const row of rows) {
    for (const rp of row.role?.rolePermissions || []) {
      if (rp?.permission?.name) set.add(rp.permission.name);
    }
  }

  req.__interviewPerms = set;
  return set;
}

function hasAny(set, names = []) {
  if (!set) return false;
  if (set.has("all")) return true;
  return names.some((n) => set.has(n));
}

async function resolveViewerEmployee(tenantId, userId) {
  if (!tenantId || !userId) return null;
  return prisma.employee.findFirst({
    where: { tenantId, userId },
    select: { id: true },
  });
}

router.use(requirePermissions(["self_read", "team_read", "directory_read", "all"], "anyOf"));

router.get("/campaigns", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });

    const items = await prisma.interviewCampaign.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return res.json({ items });
  } catch (e) {
    console.error("[interviews/campaigns] error:", e);
    return res.status(500).json({ error: "interview_campaigns_failed" });
  }
});

router.post(
  "/campaigns",
  requirePermissions(["all", "admin_read"], "anyOf"),
  async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ error: "Unauthorized" });

      const name = String(req.body?.name || "").trim();
      const type = String(req.body?.type || "ANNUAL").toUpperCase();

      if (!name || !ALLOWED_TYPES.has(type)) {
        return res.status(400).json({ error: "name/type invalides" });
      }

      const created = await prisma.interviewCampaign.create({
        data: {
          tenantId,
          name,
          period: req.body?.period || null,
          type,
          status: req.body?.status || "open",
          startDate: req.body?.startDate ? new Date(req.body.startDate) : null,
          endDate: req.body?.endDate ? new Date(req.body.endDate) : null,
        },
      });

      return res.status(201).json(created);
    } catch (e) {
      console.error("[interviews/campaigns/create] error:", e);
      return res.status(500).json({ error: "interview_campaign_create_failed" });
    }
  }
);

router.get("/", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.auth?.sub;
    if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });

    const perms = await getPermissionSet(req);
    const canCompany = hasAny(perms, ["all", "admin_read"]);
    const canTeam = hasAny(perms, ["team_read", "team_write", "approvals_read", "approvals_write"]);

    const viewerEmployee = await resolveViewerEmployee(tenantId, userId);
    const requestedScope = String(req.query.scope || "").toLowerCase();
    const scope =
      requestedScope === "company" && canCompany
        ? "company"
        : requestedScope === "team" && canTeam
        ? "team"
        : "self";

    const where = { tenantId };

    if (scope === "self") {
      where.OR = [
        ...(viewerEmployee?.id ? [{ employeeId: viewerEmployee.id }] : []),
        { managerUserId: userId },
      ];
    } else if (scope === "team") {
      if (!viewerEmployee?.id) return res.json({ items: [], scope });
      where.OR = [
        { managerEmployeeId: viewerEmployee.id },
        {
          employee: {
            managerId: viewerEmployee.id,
          },
        },
      ];
    }

    if (req.query.status) {
      const st = String(req.query.status).toUpperCase();
      if (ALLOWED_STATUS.has(st)) where.status = st;
    }

    const items = await prisma.interview.findMany({
      where,
      include: {
        campaign: true,
        employee: { select: { id: true, firstName: true, lastName: true, email: true } },
        managerEmployee: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
      take: Math.min(300, Math.max(1, Number(req.query.limit || 100))),
    });

    return res.json({ items, scope });
  } catch (e) {
    console.error("[interviews/list] error:", e);
    return res.status(500).json({ error: "interviews_list_failed" });
  }
});

router.post(
  "/",
  requirePermissions(["team_write", "all", "directory_read"], "anyOf"),
  async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = req.auth?.sub;
      if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });

      const viewerEmployee = await resolveViewerEmployee(tenantId, userId);

      const employeeId = String(req.body?.employeeId || "").trim();
      const type = String(req.body?.type || "ANNUAL").toUpperCase();
      if (!employeeId || !ALLOWED_TYPES.has(type)) {
        return res.status(400).json({ error: "employeeId/type invalides" });
      }

      const employee = await prisma.employee.findFirst({
        where: { id: employeeId, tenantId },
        select: { id: true, firstName: true, lastName: true, userId: true, managerId: true },
      });
      if (!employee) return res.status(404).json({ error: "employee_not_found" });
      const accessContext = await resolveAccessContext(req);
      if (!canAccessEmployeeId(accessContext, employee.id)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const requestedManagerEmployeeId = req.body?.managerEmployeeId
        ? String(req.body.managerEmployeeId)
        : null;
      const managerEmployeeId =
        accessContext.scope === "COMPANY"
          ? requestedManagerEmployeeId || viewerEmployee?.id || employee.managerId || null
          : viewerEmployee?.id || employee.managerId || null;

      const created = await prisma.interview.create({
        data: {
          tenantId,
          campaignId: req.body?.campaignId || null,
          employeeId: employee.id,
          managerEmployeeId,
          managerUserId: userId,
          type,
          status: "PLANNED",
          scheduledAt: req.body?.scheduledAt ? new Date(req.body.scheduledAt) : null,
          summary: req.body?.summary || null,
        },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, userId: true } },
          managerEmployee: { select: { id: true, firstName: true, lastName: true } },
          campaign: true,
        },
      });

      if (created.employee?.userId) {
        await createInAppNotification({
          tenantId,
          userId: created.employee.userId,
          actorId: userId,
          type: "INTERVIEW_SCHEDULED",
          title: "Entretien planifié",
          body: `${type} - ${created.scheduledAt ? new Date(created.scheduledAt).toLocaleDateString("fr-FR") : "date à définir"}`,
          data: { interviewId: created.id, type },
        });
      }

      return res.status(201).json(created);
    } catch (e) {
      console.error("[interviews/create] error:", e);
      return res.status(500).json({ error: "interview_create_failed" });
    }
  }
);

router.patch(
  "/:id",
  requirePermissions(["team_write", "all", "directory_read"], "anyOf"),
  async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = req.auth?.sub;
      if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });

      const viewerEmployee = await resolveViewerEmployee(tenantId, userId);
      const perms = await getPermissionSet(req);
      const canCompany = hasAny(perms, ["all", "admin_read"]);

      const item = await prisma.interview.findFirst({
        where: { id: req.params.id, tenantId },
        include: { employee: { select: { managerId: true } } },
      });
      if (!item) return res.status(404).json({ error: "interview_not_found" });

      const canTeamEdit = viewerEmployee?.id && item.employee?.managerId === viewerEmployee.id;
      if (!canCompany && !canTeamEdit) return res.status(403).json({ error: "Forbidden" });

      const status = req.body?.status ? String(req.body.status).toUpperCase() : undefined;
      if (status && !ALLOWED_STATUS.has(status)) {
        return res.status(400).json({ error: "status invalide" });
      }

      const updated = await prisma.interview.update({
        where: { id: item.id },
        data: {
          ...(status ? { status } : {}),
          ...(req.body?.scheduledAt !== undefined
            ? { scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : null }
            : {}),
          ...(req.body?.summary !== undefined ? { summary: req.body.summary || null } : {}),
          ...(req.body?.score !== undefined ? { score: req.body.score == null ? null : Number(req.body.score) } : {}),
          ...(status === "IN_PROGRESS" ? { startedAt: new Date() } : {}),
          ...(status === "DONE" ? { completedAt: new Date() } : {}),
        },
      });

      return res.json(updated);
    } catch (e) {
      console.error("[interviews/update] error:", e);
      return res.status(500).json({ error: "interview_update_failed" });
    }
  }
);

router.post(
  "/:id/complete",
  requirePermissions(["team_write", "all", "directory_read"], "anyOf"),
  async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = req.auth?.sub;
      if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });

      const viewerEmployee = await resolveViewerEmployee(tenantId, userId);
      const perms = await getPermissionSet(req);
      const canCompany = hasAny(perms, ["all", "admin_read"]);

      const item = await prisma.interview.findFirst({
        where: { id: req.params.id, tenantId },
        include: {
          employee: { select: { id: true, managerId: true, userId: true } },
        },
      });
      if (!item) return res.status(404).json({ error: "interview_not_found" });

      const canTeamEdit = viewerEmployee?.id && item.employee?.managerId === viewerEmployee.id;
      if (!canCompany && !canTeamEdit) return res.status(403).json({ error: "Forbidden" });

      const updated = await prisma.interview.update({
        where: { id: item.id },
        data: {
          status: "DONE",
          completedAt: new Date(),
          summary: req.body?.summary || item.summary || null,
          score: req.body?.score != null ? Number(req.body.score) : item.score,
        },
      });

      if (item.employee?.userId) {
        await createInAppNotification({
          tenantId,
          userId: item.employee.userId,
          actorId: userId,
          type: "INTERVIEW_COMPLETED",
          title: "Entretien finalisé",
          body: `Votre entretien ${item.type.toLowerCase()} est clôturé.`,
          data: { interviewId: item.id },
        });
      }

      return res.json(updated);
    } catch (e) {
      console.error("[interviews/complete] error:", e);
      return res.status(500).json({ error: "interview_complete_failed" });
    }
  }
);

export default router;

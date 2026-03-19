import express from "express";
import { prisma } from "../prisma.js";
import { requirePermissions } from "../rbac.js";

const router = express.Router();

const getTenantId = (req) =>
  req.auth?.tid || req.user?.tenantId || req.headers["x-tenant-id"] || null;

router.use(requirePermissions(["admin_read", "all"], "anyOf"));

router.get("/organization", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });

    const employees = await prisma.employee.findMany({
      where: { tenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        status: true,
        department: true,
        site: true,
        managerId: true,
      },
    });

    const depMap = new Map();
    const siteMap = new Map();
    const reportCountByManagerId = new Map();

    for (const e of employees) {
      const dep = e.department || "Non défini";
      const site = e.site || "Non défini";
      depMap.set(dep, (depMap.get(dep) || 0) + 1);
      siteMap.set(site, (siteMap.get(site) || 0) + 1);

      if (e.managerId) {
        reportCountByManagerId.set(
          e.managerId,
          (reportCountByManagerId.get(e.managerId) || 0) + 1
        );
      }
    }

    const departments = Array.from(depMap.entries())
      .map(([name, headcount]) => ({ name, headcount }))
      .sort((a, b) => b.headcount - a.headcount);

    const sites = Array.from(siteMap.entries())
      .map(([name, headcount]) => ({ name, headcount }))
      .sort((a, b) => b.headcount - a.headcount);

    const managers = employees
      .filter((e) => reportCountByManagerId.has(e.id))
      .map((e) => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`.trim(),
        reports: reportCountByManagerId.get(e.id) || 0,
      }))
      .sort((a, b) => b.reports - a.reports);

    const activeEmployees = employees.filter((e) => e.status === "ACTIVE").length;
    const inactiveEmployees = employees.length - activeEmployees;

    res.json({
      summary: {
        totalEmployees: employees.length,
        activeEmployees,
        inactiveEmployees,
        departments: departments.length,
        sites: sites.length,
        managers: managers.length,
      },
      departments,
      sites,
      managers,
    });
  } catch (e) {
    console.error("[admin/organization] error:", e);
    res.status(500).json({ error: "organization_failed" });
  }
});

router.get("/roles-permissions", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });

    const roles = await prisma.role.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      include: {
        users: { select: { userId: true } },
        rolePermissions: {
          include: {
            permission: {
              select: { name: true },
            },
          },
        },
      },
    });

    const items = roles.map((r) => ({
      id: r.id,
      role: r.name,
      userCount: r.users.length,
      permissions: r.rolePermissions
        .map((rp) => rp.permission?.name)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    }));

    res.json({ items });
  } catch (e) {
    console.error("[admin/roles-permissions] error:", e);
    res.status(500).json({ error: "roles_permissions_failed" });
  }
});

router.get("/workflows", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });

    const [
      onboardingOpen,
      offboardingOpen,
      complianceOpen,
      approvalsPending,
      onboardingRecent,
      offboardingRecent,
      complianceRecent,
    ] = await Promise.all([
      prisma.onboardingCase.count({
        where: { tenantId, status: { not: "closed" } },
      }),
      prisma.offboardingCase.count({
        where: { tenantId, status: { not: "closed" } },
      }),
      prisma.complianceTask.count({
        where: { tenantId, status: { in: ["TODO", "DOING"] } },
      }),
      prisma.leave.count({
        where: { tenantId, status: "Pending" },
      }),
      prisma.onboardingCase.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          employeeName: true,
          status: true,
          currentStep: true,
          createdAt: true,
        },
      }),
      prisma.offboardingCase.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          employeeName: true,
          status: true,
          currentStep: true,
          createdAt: true,
        },
      }),
      prisma.complianceTask.findMany({
        where: { tenantId },
        orderBy: [{ status: "asc" }, { dueAt: "asc" }],
        take: 8,
        select: {
          id: true,
          label: true,
          category: true,
          status: true,
          dueAt: true,
          createdAt: true,
        },
      }),
    ]);

    res.json({
      kpis: {
        onboardingOpen,
        offboardingOpen,
        complianceOpen,
        approvalsPending,
      },
      items: {
        onboarding: onboardingRecent,
        offboarding: offboardingRecent,
        compliance: complianceRecent,
      },
    });
  } catch (e) {
    console.error("[admin/workflows] error:", e);
    res.status(500).json({ error: "workflows_failed" });
  }
});

router.get("/audit-log", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });

    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 20)));
    const typeFilter = String(req.query.type || "").trim().toLowerCase();
    const query = String(req.query.q || "").trim().toLowerCase();

    const [events, leaveLogs] = await Promise.all([
      prisma.auditEvent.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 300,
      }),
      prisma.leaveActionLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 300,
      }),
    ]);

    const normalized = [
      ...events.map((e) => ({
        id: `audit-${e.id}`,
        source: "audit_event",
        actorId: e.actorId,
        type: e.type,
        entity: e.entity,
        entityId: e.entityId,
        payload: e.payload,
        createdAt: e.createdAt,
      })),
      ...leaveLogs.map((l) => ({
        id: `leave-${l.id}`,
        source: "leave_action_log",
        actorId: l.actorId,
        type: `LEAVE_${l.action}`,
        entity: "leave",
        entityId: l.leaveId,
        payload: {
          fromStatus: l.fromStatus,
          toStatus: l.toStatus,
          reason: l.reason,
          meta: l.meta,
        },
        createdAt: l.createdAt,
      })),
    ]
      .filter((item) => {
        if (!typeFilter) return true;
        return item.type.toLowerCase().includes(typeFilter);
      })
      .filter((item) => {
        if (!query) return true;
        const haystack = [
          item.type,
          item.entity,
          item.entityId,
          item.actorId || "",
          JSON.stringify(item.payload || {}),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = normalized.length;
    const start = (page - 1) * pageSize;
    const items = normalized.slice(start, start + pageSize);

    res.json({ items, total, page, pageSize });
  } catch (e) {
    console.error("[admin/audit-log] error:", e);
    res.status(500).json({ error: "audit_log_failed" });
  }
});

export default router;

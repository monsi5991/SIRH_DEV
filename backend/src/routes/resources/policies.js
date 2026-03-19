// backend/src/routes/resources/policies.js
import express from "express";
import { prisma } from "../../prisma.js";
import { requirePermissions } from "../../rbac.js";

const router = express.Router();
const getTenantId = (req) =>
  req.auth?.tid || req.user?.tenantId || req.headers["x-tenant-id"];

router.use(requirePermissions(["directory_read", "self_read"], "anyOf"));

async function hasAllPermission(req) {
  if (typeof req.__hasAllPermission === "boolean") return req.__hasAllPermission;
  const tenantId = getTenantId(req);
  const userId = req.auth?.sub;
  if (!tenantId || !userId) {
    req.__hasAllPermission = false;
    return false;
  }
  const row = await prisma.userRole.findFirst({
    where: {
      userId,
      role: {
        tenantId,
        rolePermissions: { some: { permission: { name: "all" } } },
      },
    },
    select: { userId: true },
  });
  req.__hasAllPermission = !!row;
  return req.__hasAllPermission;
}

async function resolveViewerEmployee(req) {
  if (req.__viewerEmployee !== undefined) return req.__viewerEmployee;
  const tenantId = getTenantId(req);
  const userId = req.auth?.sub;
  if (!tenantId || !userId) {
    req.__viewerEmployee = null;
    return null;
  }
  const employee = await prisma.employee.findFirst({
    where: { tenantId, userId },
    select: { id: true, userId: true, email: true },
  });
  req.__viewerEmployee = employee || null;
  return req.__viewerEmployee;
}

async function logAudit(req, type, entityId, payload) {
  const tenantId = getTenantId(req);
  try {
    await prisma.auditEvent.create({
      data: {
        tenantId,
        actorId: req.auth?.sub || null,
        type,
        entity: "policy",
        entityId,
        payload,
        ip: req.ip,
        ua: req.get("user-agent"),
      },
    });
  } catch {}
}

/* =========================
 *           LIST + KPIs
 * ========================= */
router.get("/", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });
    const {
      q = "", category = "", page = "1", pageSize = "20",
      sort = "createdAt", dir = "desc"
    } = req.query;

    const skip = (Number(page) - 1) * Number(pageSize);
    const orderBy = [{ [sort]: dir.toLowerCase() === "asc" ? "asc" : "desc" }];

    const where = {
      tenantId,
      AND: [
        category ? { category } : {},
        q ? { title: { contains: q, mode: "insensitive" } } : {},
      ],
    };

    const viewerEmployee = await resolveViewerEmployee(req);
    const [items, total, employeesCount] = await Promise.all([
      prisma.policy.findMany({
        where,
        orderBy,
        skip,
        take: Number(pageSize),
        include: { versions: { orderBy: { createdAt: "desc" }, take: 1 } },
      }),
      prisma.policy.count({ where }),
      prisma.employee.count({ where: { tenantId } }),
    ]);

    const policyIds = items.map((item) => item.id);
    const [ackRows, viewerAcks] = await Promise.all([
      policyIds.length
        ? prisma.policyAck.groupBy({
            by: ["policyId"],
            where: {
              tenantId,
              policyId: { in: policyIds },
              acknowledgedAt: { not: null },
            },
            _count: { policyId: true },
          })
        : [],
      viewerEmployee?.id && policyIds.length
        ? prisma.policyAck.findMany({
            where: {
              tenantId,
              employeeId: viewerEmployee.id,
              policyId: { in: policyIds },
            },
            select: {
              policyId: true,
              acknowledgedAt: true,
              method: true,
            },
          })
        : [],
    ]);

    const ackCountByPolicyId = new Map(
      ackRows.map((row) => [row.policyId, Number(row._count?.policyId || 0)])
    );
    const viewerAckByPolicyId = new Map(
      viewerAcks.map((row) => [row.policyId, row])
    );

    const rows = items.map((p) => {
      const ackCount = ackCountByPolicyId.get(p.id) || 0;
      const ackRate = employeesCount ? Math.round((ackCount / employeesCount) * 100) : 0;
      const viewerAck = viewerAckByPolicyId.get(p.id) || null;
      return {
        ...p,
        ackCount,
        employeesCount,
        ackRate,
        currentEmployeeAcknowledgedAt: viewerAck?.acknowledgedAt || null,
        currentEmployeeAckMethod: viewerAck?.method || null,
        currentEmployeePendingAck: !viewerAck?.acknowledgedAt,
      };
    });

    res.json({
      items: rows,
      page: Number(page),
      pageSize: Number(pageSize),
      total,
      totalPages: Math.ceil(total / Number(pageSize)),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch policies" });
  }
});

router.get("/counters", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });
    const total = await prisma.policy.count({ where: { tenantId } });
    // Pas d'assignments dans ce schéma → pendingAcks non calculable précisément
    res.json({ total, pendingAcks: 0 });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch counters" });
  }
});

/* =========================
 *          READ item
 * ========================= */
router.get("/:id", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });
    const item = await prisma.policy.findFirst({
      where: { id: req.params.id, tenantId },
      include: { versions: { orderBy: { createdAt: "desc" } } },
    });
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch policy" });
  }
});

router.get("/:id/acks", requirePermissions(["all"], "anyOf"), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    const acks = await prisma.policyAck.findMany({
      where: { tenantId, policyId: id },
      include: { employee: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { acknowledgedAt: "desc" },
    });
    res.json({ items: acks });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch acknowledgements" });
  }
});

/* Couverture (employés qui n'ont pas encore ack) */
router.get("/:id/coverage", requirePermissions(["all"], "anyOf"), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    const employees = await prisma.employee.findMany({
      where: { tenantId, status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    const acks = await prisma.policyAck.findMany({ where: { tenantId, policyId: id } });
    const ackedIds = new Set(acks.map((a) => a.employeeId));
    const pending = employees.filter((e) => !ackedIds.has(e.id));
    res.json({ totalEmployees: employees.length, acked: acks.length, pendingCount: pending.length, pending });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "coverage_failed" });
  }
});

/* =========================
 *          WRITE
 * ========================= */
/**
 * Crée une policy + 1 version
 * body: { title, category?, version?=1, language?="FR", content?, fileUrl?, effectiveAt? }
 */
router.post("/", requirePermissions(["all"], "anyOf"), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });
    const { title, category = null, version = 1, language = "FR", content = null, fileUrl = null, effectiveAt = null } = req.body || {};
    if (!title) return res.status(400).json({ error: "title required" });
    if (!content && !fileUrl) return res.status(400).json({ error: "content or fileUrl required" });

    const policy = await prisma.policy.create({
      data: { tenantId, title, category, isActive: true },
    });

    const pv = await prisma.policyVersion.create({
      data: {
        tenantId,
        policyId: policy.id,
        version: Number(version) || 1,
        language,
        content,
        fileUrl,
        effectiveAt: effectiveAt ? new Date(effectiveAt) : new Date(),
      },
    });

    await logAudit(req, "POLICY_CREATE", policy.id, { title, category, version: pv.version });

    res.status(201).json({ policy, version: pv });
  } catch (e) {
    if (e.code === "P2002") return res.status(409).json({ error: "Policy title already exists" });
    console.error(e);
    res.status(400).json({ error: "Failed to create policy" });
  }
});

router.post("/:id/publish", requirePermissions(["all"], "anyOf"), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;

    const existing = await prisma.policy.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });

    const policy = await prisma.policy.update({
      where: { id },
      data: { isActive: true },
    });

    const last = await prisma.policyVersion.findFirst({
      where: { tenantId, policyId: id },
      orderBy: { createdAt: "desc" },
    });
    if (last && !last.effectiveAt) {
      await prisma.policyVersion.update({ where: { id: last.id }, data: { effectiveAt: new Date() } });
    }

    await logAudit(req, "POLICY_PUBLISH", id, { lastVersionId: last?.id });
    res.json(policy);
  } catch (e) {
    if (e.code === "P2025") return res.status(404).json({ error: "Not found" });
    console.error(e);
    res.status(400).json({ error: "Failed to publish policy" });
  }
});

/* Ack / Acknowledge */
async function upsertAck(req, res) {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ error: "Unauthorized" });
  const { id } = req.params;
  const { employeeId, method = "check" } = req.body || {};
  if (!employeeId) return res.status(400).json({ error: "employeeId required" });

  const policy = await prisma.policy.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!policy) return res.status(404).json({ error: "policy_not_found" });

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, tenantId },
    select: { id: true, userId: true, email: true },
  });
  if (!employee) return res.status(404).json({ error: "employee_not_found" });

  const isAll = await hasAllPermission(req);
  const isSelf =
    employee.userId === req.auth?.sub ||
    (employee.email && employee.email === req.user?.email);
  if (!isAll && !isSelf) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const ack = await prisma.policyAck.upsert({
    where: { policyId_employeeId: { policyId: id, employeeId } },
    update: { method, acknowledgedAt: new Date() },
    create: { tenantId, policyId: id, employeeId, method, acknowledgedAt: new Date() },
  });

  await logAudit(req, "POLICY_ACK", id, { employeeId, method });
  res.json(ack);
}
router.post("/:id/acknowledge", upsertAck);
router.post("/:id/ack", upsertAck);

export default router;

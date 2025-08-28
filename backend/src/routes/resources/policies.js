// backend/src/routes/resources/policies.js
import express from "express";
import { prisma } from "../../prisma.js";

const router = express.Router();
const getTenantId = (req) =>
  req.auth?.tid || req.user?.tenantId || req.headers["x-tenant-id"];

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

    const rows = await Promise.all(
      items.map(async (p) => {
        const ackCount = await prisma.policyAck.count({
          where: { tenantId, policyId: p.id, acknowledgedAt: { not: null } },
        });
        const ackRate = employeesCount ? Math.round((ackCount / employeesCount) * 100) : 0;
        return { ...p, ackCount, employeesCount, ackRate };
      })
    );

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

router.get("/:id/acks", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
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
router.get("/:id/coverage", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
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
router.post("/", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
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

router.post("/:id/publish", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;

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
  const { id } = req.params;
  const { employeeId, method = "check" } = req.body || {};
  if (!employeeId) return res.status(400).json({ error: "employeeId required" });

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

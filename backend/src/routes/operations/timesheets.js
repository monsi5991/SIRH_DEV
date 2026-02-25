import express from "express";
import { prisma } from "../../prisma.js";
import { requirePermissions } from "../../rbac.js";

const router = express.Router();

// ✅ index.js a déjà fait verifyKeycloak + attachDbAuthFromKeycloak
router.use(requirePermissions(["operations_read"], "anyOf"));

/** Résout le tenant (req.auth est censé être présent via attachDbAuthFromKeycloak) */
async function resolveTenantId(req) {
  return req.auth?.tid || req.user?.tenantId || null;
}

/* =========================================
 *               READ
 * ========================================= */
router.get("/", async (req, res) => {
  try {
    const tid = await resolveTenantId(req);
    if (!tid) return res.status(401).json({ error: "Unauthorized" });

    const { employee, from, to, status } = req.query;

    const where = { tenantId: tid };
    if (employee) where.employee = { contains: String(employee) };
    if (status) where.status = String(status);
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(String(from));
      if (to) where.date.lte = new Date(String(to));
    }

    const timesheets = await prisma.timesheet.findMany({
      where,
      orderBy: [{ date: "desc" }],
      take: 500,
      select: {
        id: true,
        employee: true,
        employeeId: true,
        date: true,
        hours: true,
        project: true,
        note: true,
        status: true,
        type: true,
        premium: true,
      },
    });

    res.json({ timesheets });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =========================================
 *               CREATE / UPSERT
 * ========================================= */
router.post("/", requirePermissions(["operations_write"], "anyOf"), async (req, res) => {
  try {
    const tid = await resolveTenantId(req);
    if (!tid) return res.status(401).json({ error: "Unauthorized" });

    const { employee, employeeId, date, hours, project, note, status, type, premium } = req.body || {};

    if ((!employee && !employeeId) || !date || hours == null) {
      return res.status(400).json({ error: "employee/employeeId, date et hours sont requis" });
    }

    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return res.status(400).json({ error: "date invalide" });

    // ✅ upsert par clés uniques (selon ton schema Prisma)
    const whereKey = employeeId
      ? { uniq_timesheet_empid: { tenantId: tid, employeeId, date: d } }
      : { uniq_timesheet_per_day: { tenantId: tid, employee, date: d } };

    const row = await prisma.timesheet.upsert({
      where: whereKey,
      update: {
        hours: Number(hours),
        project: project ?? null,
        note: note ?? null,
        status: status || "Submitted",
        type: String(type || "REG").toUpperCase(),
        premium: premium != null ? Number(premium) : null,
        employee: employee || undefined,
        employeeId: employeeId || undefined,
      },
      create: {
        tenantId: tid,
        employee: employee || null,
        employeeId: employeeId || null,
        date: d,
        hours: Number(hours),
        project: project ?? null,
        note: note ?? null,
        status: status || "Submitted",
        type: String(type || "REG").toUpperCase(),
        premium: premium != null ? Number(premium) : null,
      },
    });

    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =========================================
 *               UPDATE
 * ========================================= */
router.put("/:id", requirePermissions(["operations_write"], "anyOf"), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, type, premium } = req.body || {};

    const tid = await resolveTenantId(req);
    if (!tid) return res.status(401).json({ error: "Unauthorized" });

    const found = await prisma.timesheet.findFirst({
      where: { id, tenantId: tid },
      select: { id: true },
    });
    if (!found) return res.status(404).json({ error: "Feuille de temps introuvable" });

    const row = await prisma.timesheet.update({
      where: { id },
      data: {
        ...("status" in (req.body || {}) ? { status: status == null ? null : String(status) } : {}),
        ...("type" in (req.body || {}) ? { type: type == null ? null : String(type).toUpperCase() } : {}),
        ...(premium != null ? { premium: Number(premium) } : {}),
      },
    });

    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =========================================
 *               DELETE
 * ========================================= */
router.delete("/:id", requirePermissions(["operations_write"], "anyOf"), async (req, res) => {
  try {
    const { id } = req.params;
    const tid = await resolveTenantId(req);
    if (!tid) return res.status(401).json({ error: "Unauthorized" });

    const found = await prisma.timesheet.findFirst({
      where: { id, tenantId: tid },
      select: { id: true },
    });
    if (!found) return res.status(404).json({ error: "Feuille de temps introuvable" });

    await prisma.timesheet.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

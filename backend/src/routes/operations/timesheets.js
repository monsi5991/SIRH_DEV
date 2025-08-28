import express from "express";
import { prisma } from "../../prisma.js";
import { verifyAccess } from "../../auth.js";
import { requirePermissions } from "../../rbac.js";

const router = express.Router();

async function resolveTenantId(req) {
  return req.auth?.tid || req.user?.tenantId || (await prisma.tenant.findFirst({ select: { id: true } }))?.id || null;
}

// GET
router.get("/", verifyAccess, requirePermissions(["operations_read"], "anyOf"), async (req, res) => {
  try {
    const tid = await resolveTenantId(req);
    const { status } = req.query;
    const where = { tenantId: tid };
    if (status) where.status = status;

    const timesheets = await prisma.timesheet.findMany({
      where,
      orderBy: { date: "desc" },
      take: 200,
    });
    res.json({ timesheets });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST
router.post("/", verifyAccess, requirePermissions(["operations_write"], "anyOf"), async (req, res) => {
  try {
    const tid = await resolveTenantId(req);
    const { employee, employeeId, date, hours, project, note, status, type, premium } = req.body;
    if ((!employee && !employeeId) || !date || hours == null) {
      return res.status(400).json({ error: "employee/employeeId, date, hours requis" });
    }
    const d = new Date(date);

    // upsert par (tenantId, employeeId?, employee, date)
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
        type: (type || "REG").toUpperCase(),
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
        type: (type || "REG").toUpperCase(),
        premium: premium != null ? Number(premium) : null,
      },
    });

    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT status/type/premium
router.put("/:id", verifyAccess, requirePermissions(["operations_write"], "anyOf"), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, type, premium } = req.body;
    const tid = await resolveTenantId(req);

    const found = await prisma.timesheet.findFirst({ where: { id, tenantId: tid }, select: { id: true } });
    if (!found) return res.status(404).json({ error: "Feuille de temps introuvable" });

    const row = await prisma.timesheet.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(type ? { type: String(type).toUpperCase() } : {}),
        ...(premium != null ? { premium: Number(premium) } : {}),
      }
    });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE
router.delete("/:id", verifyAccess, requirePermissions(["operations_write"], "anyOf"), async (req, res) => {
  try {
    const { id } = req.params;
    const tid = await resolveTenantId(req);
    const found = await prisma.timesheet.findFirst({ where: { id, tenantId: tid }, select: { id: true } });
    if (!found) return res.status(404).json({ error: "Feuille de temps introuvable" });

    await prisma.timesheet.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

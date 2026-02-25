import express from "express";
import { prisma } from "../../prisma.js";
import { requirePermissions } from "../../rbac.js";

const router = express.Router();
router.use(requirePermissions(["operations_read"], "anyOf"));

async function resolveTenantId(req) { return req.auth?.tid || req.user?.tenantId || req.headers["x-tenant-id"]; }

router.get("/", async (req, res) => {
  try {
    const tid = await resolveTenantId(req); if (!tid) return res.status(401).json({ error: "Unauthorized" });
    const { status } = req.query;
    const where = { tenantId: tid, ...(status ? { status: String(status) } : {}) };
    const timesheets = await prisma.timesheet.findMany({ where, orderBy: { date: "desc" }, take: 500 });
    res.json({ timesheets });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/", requirePermissions(["operations_write"], "anyOf"), async (req, res) => {
  try {
    const tid = await resolveTenantId(req); if (!tid) return res.status(401).json({ error: "Unauthorized" });
    const { employee, employeeId, date, hours, project, note, status, type, premium } = req.body || {};
    if ((!employee && !employeeId) || !date || hours == null) return res.status(400).json({ error: "employee/employeeId, date, hours requis" });
    const row = await prisma.timesheet.create({ data: { tenantId: tid, employee: employee ? String(employee) : null, employeeId: employeeId || null, date: new Date(date), hours: Number(hours), project: project || null, note: note || null, status: status || "Submitted", type: String(type || "REG").toUpperCase(), premium: premium != null ? Number(premium) : null } });
    res.status(201).json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

async function updateTimesheet(req, res) {
  try {
    const { id } = req.params; const { status, type, premium } = req.body || {};
    const tid = await resolveTenantId(req); if (!tid) return res.status(401).json({ error: "Unauthorized" });
    const found = await prisma.timesheet.findFirst({ where: { id, tenantId: tid }, select: { id: true } });
    if (!found) return res.status(404).json({ error: "Feuille de temps introuvable" });
    const row = await prisma.timesheet.update({ where: { id }, data: { ...("status" in (req.body || {}) ? { status: status == null ? null : String(status) } : {}), ...("type" in (req.body || {}) ? { type: type == null ? null : String(type).toUpperCase() } : {}), ...(premium != null ? { premium: Number(premium) } : {}) } });
    return res.json(row);
  } catch (e) { return res.status(500).json({ error: e.message }); }
}

router.put("/:id", requirePermissions(["operations_write"], "anyOf"), updateTimesheet);
router.put("/:id/status", requirePermissions(["operations_write"], "anyOf"), updateTimesheet);

router.delete("/:id", requirePermissions(["operations_write"], "anyOf"), async (req, res) => {
  try {
    const { id } = req.params; const tid = await resolveTenantId(req); if (!tid) return res.status(401).json({ error: "Unauthorized" });
    const found = await prisma.timesheet.findFirst({ where: { id, tenantId: tid }, select: { id: true } });
    if (!found) return res.status(404).json({ error: "Feuille de temps introuvable" });
    await prisma.timesheet.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;

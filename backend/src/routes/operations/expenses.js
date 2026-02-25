import express from "express";
import { prisma } from "../../prisma.js";
import { requirePermissions } from "../../rbac.js";

const router = express.Router();
router.use(requirePermissions(["operations_read"], "anyOf"));

const ALLOWED_TAX_TREATMENTS = new Set(["REIMBURSEMENT", "TAXABLE", "MIXED"]);
const DEFAULT_CURRENCY = "XOF";
const DEFAULT_STATUS = "Submitted";

function toDateSafe(v) { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; }
function normalizeCurrency(c) { const code = String(c || DEFAULT_CURRENCY).toUpperCase(); return /^[A-Z]{3}$/.test(code) ? code : DEFAULT_CURRENCY; }
function normalizeTax(t) { if (t == null) return "REIMBURSEMENT"; const up = String(t).toUpperCase(); return ALLOWED_TAX_TREATMENTS.has(up) ? up : "REIMBURSEMENT"; }

router.get("/", async (req, res) => {
  try {
    const tid = req.auth?.tid; if (!tid) return res.status(401).json({ error: "Unauthorized" });
    const { status } = req.query;
    const where = { tenantId: tid }; if (status) where.status = String(status);
    const expenses = await prisma.expense.findMany({ where, orderBy: { date: "desc" }, take: 100, select: { id: true, tenantId: true, employee: true, employeeId: true, date: true, category: true, amount: true, currency: true, status: true, taxTreatment: true, createdAt: true, updatedAt: true } });
    res.json({ expenses });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/", requirePermissions(["operations_write"], "anyOf"), async (req, res) => {
  try {
    const tid = req.auth?.tid; if (!tid) return res.status(401).json({ error: "Unauthorized" });
    const { employee, employeeId, date, category, amount, currency, status, taxTreatment } = req.body || {};
    if ((!employee && !employeeId) || !date || !category || amount == null) return res.status(400).json({ error: "employee/employeeId, date, category, amount requis" });
    const d = toDateSafe(date); if (!d) return res.status(400).json({ error: "date invalide" });
    const numAmount = Number(amount); if (!Number.isFinite(numAmount)) return res.status(400).json({ error: "amount invalide" });
    const row = await prisma.expense.create({ data: { tenantId: tid, employee: employee ? String(employee) : null, employeeId: employeeId || null, date: d, category: String(category), amount: numAmount, currency: normalizeCurrency(currency), status: status || DEFAULT_STATUS, taxTreatment: normalizeTax(taxTreatment) } });
    res.status(201).json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

async function updateExpense(req, res) {
  try {
    const tid = req.auth?.tid; if (!tid) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params; const { status, taxTreatment } = req.body || {};
    const found = await prisma.expense.findFirst({ where: { id, tenantId: tid }, select: { id: true } });
    if (!found) return res.status(404).json({ error: "Note de frais introuvable" });
    const data = {};
    if ("status" in (req.body || {})) data.status = status == null ? null : String(status);
    if ("taxTreatment" in (req.body || {})) data.taxTreatment = normalizeTax(taxTreatment);
    const row = await prisma.expense.update({ where: { id }, data });
    return res.json(row);
  } catch (e) { return res.status(500).json({ error: e.message }); }
}

router.put("/:id", requirePermissions(["operations_write"], "anyOf"), updateExpense);
router.put("/:id/status", requirePermissions(["operations_write"], "anyOf"), updateExpense);

router.delete("/:id", requirePermissions(["operations_write"], "anyOf"), async (req, res) => {
  try {
    const tid = req.auth?.tid; if (!tid) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    const found = await prisma.expense.findFirst({ where: { id, tenantId: tid }, select: { id: true } });
    if (!found) return res.status(404).json({ error: "Note de frais introuvable" });
    await prisma.expense.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;

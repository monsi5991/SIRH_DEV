import express from "express";
import { prisma } from "../../prisma.js";
import { requirePermissions } from "../../rbac.js";
import { logAuditEvent } from "../../lib/audit.js";
import {
  buildEmployeeScopeWhere,
  canAccessEmployeeId,
  resolveAccessContext,
} from "../../lib/accessScope.js";

const router = express.Router();
router.use(requirePermissions(["operations_read"], "anyOf"));

const ALLOWED_TAX_TREATMENTS = new Set(["REIMBURSEMENT", "TAXABLE", "MIXED"]);
const TAX_TREATMENT_ALIASES = new Map([
  ["REMBOURSEMENT", "REIMBURSEMENT"],
  ["REMBURSEMENT", "REIMBURSEMENT"],
]);
const DEFAULT_CURRENCY = "XOF";
const DEFAULT_STATUS = "Submitted";

function toDateSafe(v) { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; }
function normalizeCurrency(c) { const code = String(c || DEFAULT_CURRENCY).toUpperCase(); return /^[A-Z]{3}$/.test(code) ? code : DEFAULT_CURRENCY; }
function normalizeTax(t) {
  if (t == null) return "REIMBURSEMENT";
  const up = String(t).toUpperCase();
  const canonical = TAX_TREATMENT_ALIASES.get(up) || up;
  return ALLOWED_TAX_TREATMENTS.has(canonical) ? canonical : "REIMBURSEMENT";
}

router.get("/", async (req, res) => {
  try {
    const tid = req.auth?.tid; if (!tid) return res.status(401).json({ error: "Unauthorized" });
    const accessContext = await resolveAccessContext(req);
    const { status } = req.query;
    const where = { tenantId: tid, ...buildEmployeeScopeWhere(accessContext, { field: "employeeId" }) };
    if (status) where.status = String(status);
    const expenses = await prisma.expense.findMany({ where, orderBy: { date: "desc" }, take: 100, select: { id: true, tenantId: true, employee: true, employeeId: true, date: true, category: true, amount: true, currency: true, status: true, taxTreatment: true, createdAt: true, updatedAt: true } });
    res.json({ expenses });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/", requirePermissions(["operations_write"], "anyOf"), async (req, res) => {
  try {
    const tid = req.auth?.tid; if (!tid) return res.status(401).json({ error: "Unauthorized" });
    const accessContext = await resolveAccessContext(req);
    const actorId = req.auth?.sub || null;
    const { employee, employeeId, date, category, amount, currency, status, taxTreatment } = req.body || {};
    let targetEmployeeId = employeeId ? String(employeeId) : null;
    if (!targetEmployeeId && accessContext.scope === "SELF" && accessContext.viewerEmployee?.id) {
      targetEmployeeId = accessContext.viewerEmployee.id;
    }
    if ((!employee && !targetEmployeeId) || !date || !category || amount == null) return res.status(400).json({ error: "employee/employeeId, date, category, amount requis" });
    if (accessContext.scope !== "COMPANY") {
      if (!targetEmployeeId) return res.status(400).json({ error: "employeeId requis pour votre scope" });
      if (!canAccessEmployeeId(accessContext, targetEmployeeId)) return res.status(403).json({ error: "Forbidden" });
    }
    const d = toDateSafe(date); if (!d) return res.status(400).json({ error: "date invalide" });
    const numAmount = Number(amount); if (!Number.isFinite(numAmount)) return res.status(400).json({ error: "amount invalide" });
    const row = await prisma.expense.create({ data: { tenantId: tid, employee: employee ? String(employee) : null, employeeId: targetEmployeeId || null, date: d, category: String(category), amount: numAmount, currency: normalizeCurrency(currency), status: status || DEFAULT_STATUS, taxTreatment: normalizeTax(taxTreatment) } });

    await logAuditEvent({
      tenantId: tid,
      actorId,
      type: "EXPENSE_CREATE",
      entity: "expense",
      entityId: row.id,
      payload: {
        employeeId: row.employeeId,
        status: row.status,
        amount: row.amount,
        currency: row.currency,
      },
      ip: req.ip,
      ua: req.get("user-agent"),
    });

    res.status(201).json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

async function updateExpense(req, res) {
  try {
    const tid = req.auth?.tid; if (!tid) return res.status(401).json({ error: "Unauthorized" });
    const accessContext = await resolveAccessContext(req);
    const actorId = req.auth?.sub || null;
    const { id } = req.params; const { status, taxTreatment } = req.body || {};
    const found = await prisma.expense.findFirst({
      where: { id, tenantId: tid },
      select: { id: true, status: true, employeeId: true, taxTreatment: true },
    });
    if (!found) return res.status(404).json({ error: "Note de frais introuvable" });
    if (accessContext.scope !== "COMPANY") {
      if (!found.employeeId || !canAccessEmployeeId(accessContext, found.employeeId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }
    const data = {};
    if ("status" in (req.body || {})) data.status = status == null ? null : String(status);
    if ("taxTreatment" in (req.body || {})) data.taxTreatment = normalizeTax(taxTreatment);
    const row = await prisma.expense.update({ where: { id }, data });

    await logAuditEvent({
      tenantId: tid,
      actorId,
      type: data.status !== undefined ? "EXPENSE_STATUS_CHANGE" : "EXPENSE_UPDATE",
      entity: "expense",
      entityId: row.id,
      payload: {
        fromStatus: found.status,
        toStatus: row.status,
        fromTaxTreatment: found.taxTreatment,
        toTaxTreatment: row.taxTreatment,
        employeeId: row.employeeId || found.employeeId || null,
      },
      ip: req.ip,
      ua: req.get("user-agent"),
    });

    return res.json(row);
  } catch (e) { return res.status(500).json({ error: e.message }); }
}

router.put("/:id", requirePermissions(["operations_write"], "anyOf"), updateExpense);
router.put("/:id/status", requirePermissions(["operations_write"], "anyOf"), updateExpense);

router.delete("/:id", requirePermissions(["operations_write"], "anyOf"), async (req, res) => {
  try {
    const tid = req.auth?.tid; if (!tid) return res.status(401).json({ error: "Unauthorized" });
    const accessContext = await resolveAccessContext(req);
    const actorId = req.auth?.sub || null;
    const { id } = req.params;
    const found = await prisma.expense.findFirst({
      where: { id, tenantId: tid },
      select: { id: true, status: true, employeeId: true, amount: true, currency: true },
    });
    if (!found) return res.status(404).json({ error: "Note de frais introuvable" });
    if (accessContext.scope !== "COMPANY") {
      if (!found.employeeId || !canAccessEmployeeId(accessContext, found.employeeId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }
    await prisma.expense.delete({ where: { id } });

    await logAuditEvent({
      tenantId: tid,
      actorId,
      type: "EXPENSE_DELETE",
      entity: "expense",
      entityId: found.id,
      payload: {
        employeeId: found.employeeId,
        status: found.status,
        amount: found.amount,
        currency: found.currency,
      },
      ip: req.ip,
      ua: req.get("user-agent"),
    });

    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;

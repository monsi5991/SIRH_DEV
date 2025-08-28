import express from "express";
import { prisma } from "../../prisma.js";
import { verifyAccess } from "../../auth.js";
import { requirePermissions } from "../../rbac.js";

const router = express.Router();
router.use(verifyAccess, requirePermissions(["operations_read"], "anyOf"));

// GET
router.get("/", async (req, res) => {
  try {
    const tid = req.auth?.tid;
    const { status } = req.query;
    const where = { tenantId: tid };
    if (status) where.status = status;

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { date: "desc" },
      take: 100,
    });
    res.json({ expenses });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST
router.post("/", requirePermissions(["operations_write"], "anyOf"), async (req, res) => {
  try {
    const tid = req.auth?.tid;
    const { employee, employeeId, date, category, amount, currency, taxTreatment, status } = req.body;
    if ((!employee && !employeeId) || !date || !category || amount == null) {
      return res.status(400).json({ error: "employee/employeeId, date, category, amount requis" });
    }
    const row = await prisma.expense.create({
      data: {
        tenantId: tid,
        employee: employee || null,
        employeeId: employeeId || null,
        date: new Date(date),
        category,
        amount: Number(amount),
        currency: (currency || "XOF").toUpperCase(),
        taxTreatment: (taxTreatment || "REIMBURSEMENT").toUpperCase(),
        status: status || "Submitted",
      },
    });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT
router.put("/:id", requirePermissions(["operations_write"], "anyOf"), async (req, res) => {
  try {
    const tid = req.auth?.tid;
    const { id } = req.params;
    const { status, taxTreatment } = req.body;

    const found = await prisma.expense.findFirst({ where: { id, tenantId: tid }, select: { id: true } });
    if (!found) return res.status(404).json({ error: "Note de frais introuvable" });

    const row = await prisma.expense.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(taxTreatment ? { taxTreatment: String(taxTreatment).toUpperCase() } : {})
      }
    });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE
router.delete("/:id", requirePermissions(["operations_write"], "anyOf"), async (req, res) => {
  try {
    const tid = req.auth?.tid;
    const { id } = req.params;

    const found = await prisma.expense.findFirst({ where: { id, tenantId: tid }, select: { id: true } });
    if (!found) return res.status(404).json({ error: "Note de frais introuvable" });

    await prisma.expense.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

import express from "express";
import { prisma } from "../../prisma.js";
import { verifyAccess } from "../../auth.js";
import { requirePermissions } from "../../rbac.js";

const router = express.Router();
router.use(verifyAccess);

// GET
router.get("/", requirePermissions(["operations_read"], "anyOf"), async (req, res) => {
  try {
    const tid = req.auth?.tid;
    const { status } = req.query;
    const where = { tenantId: tid };
    if (status) where.status = status;

    const leaves = await prisma.leave.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json({ leaves });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST
router.post("/", requirePermissions(["operations_write"], "anyOf"), async (req, res) => {
  try {
    const tid = req.auth?.tid;
    const { employee, employeeId, start, end, type, paid, halfDay, status } = req.body;
    if ((!employee && !employeeId) || !start || !end) {
      return res.status(400).json({ error: "employee/employeeId, start, end requis" });
    }
    const leave = await prisma.leave.create({
      data: {
        tenantId: tid,
        employee: employee || null,
        employeeId: employeeId || null,
        start: new Date(start),
        end: new Date(end),
        type: type || "CP",
        paid: paid !== false,
        halfDay: halfDay || null,
        status: status || "Pending",
      },
    });
    res.json({ leave });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT
router.put("/:id", requirePermissions(["operations_write"], "anyOf"), async (req, res) => {
  try {
    const tid = req.auth?.tid;
    const { id } = req.params;
    const { status, paid, type, halfDay } = req.body;

    const found = await prisma.leave.findFirst({ where: { id, tenantId: tid }, select: { id: true } });
    if (!found) return res.status(404).json({ error: "Demande introuvable" });

    const leave = await prisma.leave.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(paid != null ? { paid: !!paid } : {}),
        ...(type ? { type } : {}),
        ...(halfDay ? { halfDay } : {}),
      }
    });
    res.json({ leave });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE
router.delete("/:id", requirePermissions(["operations_write"], "anyOf"), async (req, res) => {
  try {
    const tid = req.auth?.tid;
    const { id } = req.params;

    const found = await prisma.leave.findFirst({ where: { id, tenantId: tid }, select: { id: true } });
    if (!found) return res.status(404).json({ error: "Demande introuvable" });

    await prisma.leave.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

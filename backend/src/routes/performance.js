// backend/src/routes/performance.js
import express from "express";
import { prisma } from "../prisma.js";
import { z } from "zod";

const router = express.Router();

// Permet d'accepter auth middleware, user hydraté ou entête x-tenant-id (dev)
const getTenantId = (req) =>
  req.auth?.tid || req.user?.tenantId || req.headers["x-tenant-id"];

/* --------------------------------- Schemas --------------------------------- */

const CycleCreate = z.object({
  name: z.string().min(1),
  period: z.string().min(1), // ex: "2025-H1"
  startDate: z.string(),
  endDate: z.string(),
});

const GoalCreate = z.object({
  employeeId: z.string().min(1),
  cycleId: z.string().optional(),
  title: z.string().min(1),
  status: z.enum(["on_track", "at_risk", "off_track"]).optional(),
  // coerce: accepte "50" (string) ou 50 (number)
  progress: z.coerce.number().min(0).max(100).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

/* --------------------------------- Cycles ---------------------------------- */

router.get("/cycles", async (req, res) => {
  const tenantId = getTenantId(req);
  const cycles = await prisma.reviewCycle.findMany({
    where: { tenantId },
    orderBy: { startDate: "desc" },
  });
  res.json(cycles);
});

router.post("/cycles", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const p = CycleCreate.parse(req.body);
    const c = await prisma.reviewCycle.create({
      data: {
        ...p,
        tenantId,
        startDate: new Date(p.startDate),
        endDate: new Date(p.endDate),
      },
    });
    res.status(201).json(c);
  } catch (e) {
    res.status(400).json({ message: e?.message || "Invalid data" });
  }
});

/* ---------------------------------- Goals ---------------------------------- */

// Liste des objectifs (avec un minimum de données liées pour l'UI/CSV)
router.get("/goals", async (req, res) => {
  const tenantId = getTenantId(req);
  const { employeeId } = req.query;

  const where = { tenantId, ...(employeeId ? { employeeId } : {}) };

  const goals = await prisma.goal.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true },
      },
      cycle: {
        select: { id: true, name: true, period: true },
      },
    },
  });

  res.json(goals);
});

// Détail d'un objectif
router.get("/goals/:id", async (req, res) => {
  const tenantId = getTenantId(req);
  const { id } = req.params;

  const goal = await prisma.goal.findFirst({
    where: { id, tenantId },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, department: true, site: true },
      },
      cycle: { select: { id: true, name: true, period: true } },
    },
  });

  if (!goal) return res.status(404).json({ message: "Goal not found" });
  res.json(goal);
});

// Création
router.post("/goals", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const p = GoalCreate.parse(req.body);

    const g = await prisma.goal.create({
      data: {
        tenantId,
        employeeId: p.employeeId,
        cycleId: p.cycleId || null,
        title: p.title,
        status: p.status || "on_track",
        progress: p.progress ?? 0,
        startDate: p.startDate ? new Date(p.startDate) : null,
        endDate: p.endDate ? new Date(p.endDate) : null,
      },
    });

    res.status(201).json(g);
  } catch (e) {
    res.status(400).json({ message: e?.message || "Invalid data" });
  }
});

// Mise à jour (vérifie tenant)
router.put("/goals/:id", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const p = GoalCreate.partial().parse(req.body);

    // Vérifier que l'objectif appartient bien au tenant
    const exists = await prisma.goal.findFirst({ where: { id, tenantId } });
    if (!exists) return res.status(404).json({ message: "Goal not found" });

    const g = await prisma.goal.update({
      where: { id },
      data: {
        ...p,
        startDate: p.startDate ? new Date(p.startDate) : undefined,
        endDate: p.endDate ? new Date(p.endDate) : undefined,
      },
    });

    res.json(g);
  } catch (e) {
    res.status(400).json({ message: e?.message || "Invalid data" });
  }
});

// Suppression (vérifie tenant)
router.delete("/goals/:id", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    const exists = await prisma.goal.findFirst({ where: { id, tenantId } });
    if (!exists) return res.status(404).json({ message: "Goal not found" });

    await prisma.goal.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ message: e?.message || "Delete failed" });
  }
});

export default router;

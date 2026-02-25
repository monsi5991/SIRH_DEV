// backend/src/routes/peopleCounters.js
import express from "express";
import dayjs from "dayjs";
import { prisma } from "../prisma.js";

const router = express.Router();

async function resolveTenantId(req) {
  const headerTid = req.headers["x-tenant-id"];
  if (headerTid) return headerTid;

  const email = req.kc?.email; // ✅ keycloak payload
  if (!email) return null;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { tenantId: true },
  });

  return user?.tenantId || null;
}

// ✅ Directory badge (ex: nb employés actifs)
router.get("/directory", async (req, res) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "Missing tenant context" });

    const activeEmployees = await prisma.employee.count({
      where: { tenantId, status: "ACTIVE" },
    });

    return res.json({ badge: activeEmployees, total: activeEmployees });
  } catch (e) {
    console.error("peopleCounters/directory error:", e);
    return res.status(500).json({ error: "Failed to load directory counter" });
  }
});

// ✅ Performance badge (ex: évaluations en attente)
router.get("/performance", async (req, res) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "Missing tenant context" });

    // adapte selon ton schema Prisma si besoin
    // Ici on compte les reviews "PENDING"
    const pending = await prisma.performanceReview?.count
      ? await prisma.performanceReview.count({ where: { tenantId, status: "PENDING" } })
      : 0;

    return res.json({ badge: pending, total: pending });
  } catch (e) {
    console.error("peopleCounters/performance error:", e);
    return res.status(500).json({ error: "Failed to load performance counter" });
  }
});

// ✅ Training badge (tes règles)
router.get("/training", async (req, res) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "Missing tenant context" });

    const now = dayjs().startOf("day");
    const in14 = now.add(14, "day").endOf("day");
    const in30 = now.add(30, "day").endOf("day");

    const sessionsSoon = await prisma.session.count({
      where: {
        tenantId,
        startDate: { gte: now.toDate(), lte: in14.toDate() },
      },
    });

    const certsExpiring = await prisma.certification.count({
      where: {
        tenantId,
        expiresAt: { lte: in30.toDate() },
      },
    });

    return res.json({
      sessionsSoon,
      certsExpiring,
      badge: sessionsSoon,
      total: sessionsSoon,
    });
  } catch (e) {
    console.error("peopleCounters/training error:", e);
    return res.status(500).json({ error: "Failed to load training counter" });
  }
});

export default router;

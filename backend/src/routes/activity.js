// backend/src/routes/activity.js
import express from "express";
import { prisma } from "../prisma.js";
import { verifyAccess } from "../auth.js";

const router = express.Router();

router.use(verifyAccess);

// GET /activity/recent
router.get("/recent", async (req, res) => {
  try {
    const tid = req.auth.tid;
    const since = new Date(Date.now() - 2 * 24 * 3600 * 1000);

    const recentLeaves = await prisma.leave.findMany({
      where: { tenantId: tid, updatedAt: { gte: since } },
      orderBy: { updatedAt: "desc" },
      take: 10
    });

    const activities = recentLeaves.map(l => ({
      id: l.id,
      type: l.status === "Pending" ? "leave_request" : "leave_update",
      message: `${l.employee} • ${l.status}`,
      time: l.updatedAt,
      status: l.status === "Pending" ? "pending" : "completed"
    }));

    res.json({ activities });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

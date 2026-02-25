// backend/src/routes/activity.js
import express from "express";
import { prisma } from "../prisma.js";
import { requirePermissions } from "../rbac.js";

const router = express.Router();

// Ici on suppose que index.js met déjà: verifyKeycloak + attachDbAuthFromKeycloak
router.get(
  "/recent",
  requirePermissions(["operations_read"], "anyOf"),
  async (req, res) => {
    try {
      const tid = req.auth?.tid;
      if (!tid) return res.status(401).json({ error: "Unauthorized" });

      const since = new Date(Date.now() - 2 * 24 * 3600 * 1000);

      const recentLeaves = await prisma.leave.findMany({
        where: { tenantId: tid, updatedAt: { gte: since } },
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: {
          id: true,
          employee: true,
          status: true,
          updatedAt: true,
        },
      });

      const activities = recentLeaves.map((l) => ({
        id: l.id,
        type: l.status === "Pending" ? "leave_request" : "leave_update",
        message: `${l.employee} • ${l.status}`,
        time: l.updatedAt,
        status: l.status === "Pending" ? "pending" : "completed",
      }));

      res.json({ activities });
    } catch (e) {
      console.error("[activity] error:", e);
      res.status(500).json({ error: "Activity failed" });
    }
  }
);

export default router;

// backend/src/routes/peopleCounters.js
import express from "express";
import dayjs from "dayjs";
import { prisma } from "../prisma.js";

const router = express.Router();
const getTenantId = (req) =>
  req.auth?.tid || req.user?.tenantId || req.headers["x-tenant-id"];

/**
 * 👉 Formation : le badge parent de la sidebar doit refléter UNIQUEMENT
 * le nombre de sessions qui démarrent dans les 14 prochains jours.
 * On renvoie aussi certsExpiring pour afficher une alerte visuelle (triangle).
 */
router.get("/training", async (req, res) => {
  const tenantId = getTenantId(req);

  // Fenêtres de temps
  const now = dayjs().startOf("day");
  const in14 = now.add(14, "day").endOf("day");
  const in30 = now.add(30, "day").endOf("day");

  // Sessions à venir (<14j)
  const sessionsSoon = await prisma.session.count({
    where: {
      tenantId,
      startDate: { gte: now.toDate(), lte: in14.toDate() },
    },
  });

  // Certifs qui expirent (<30j) : pour l’alerte
  const certsExpiring = await prisma.certification.count({
    where: {
      tenantId,
      expiresAt: { lte: in30.toDate() },
    },
  });

  // badge = ce que la sidebar doit afficher comme nombre
  res.json({
    sessionsSoon,
    certsExpiring,
    badge: sessionsSoon,
    total: sessionsSoon, // conservé pour compat
  });
});

export default router;

// backend/src/routes/events.js
import express from "express";
import { prisma } from "../../prisma.js"; 
import { verifyAccess } from "../../auth.js";
import { requirePermissions } from "../../rbac.js";


const router = express.Router();

// Toutes les routes ici exigent l'accès + la permission lecture "operations_read"
router.use(verifyAccess, requirePermissions(["operations_read"], "anyOf"));

/**
 * GET /operations/events
 * Query:
 *   - type: "meeting" | "training" | "deadline" | "other" (optionnel)
 *   - from, to: YYYY-MM-DD (optionnels)
 * Réponse: { events: Event[] }
 */
router.get("/", async (req, res) => {
  try {
    const { type, from, to } = req.query;
    const tid = req.auth.tid;

    const where = { tenantId: tid };
    if (type) where.type = String(type);

    // plage de dates optionnelle
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to)   where.date.lte = new Date(to);
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: [{ date: "asc" }, { time: "asc" }],
      take: 100,
    });

    res.json({ events });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /operations/events
 * Body: { title, date (YYYY-MM-DD), time?, type?, description?, location?, attendees? }
 */
router.post(
  "/",
  requirePermissions(["operations_write"], "anyOf"),
  async (req, res) => {
    try {
      const { title, date, time, type, description, location, attendees } = req.body;
      if (!title || !date) {
        return res.status(400).json({ error: "title et date sont requis" });
      }

      const ev = await prisma.event.create({
        data: {
          title: String(title),
          date: new Date(date),
          time: time || null,
          type: ["meeting", "training", "deadline", "other"].includes(type) ? type : "meeting",
          description: description ?? null,
          location: location ?? null,
          // Si ton schéma n'a PAS 'attendees', supprime la ligne ci-dessous
          attendees: attendees ?? null,
          tenantId: req.auth.tid,
        },
      });

      res.json(ev);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

/**
 * DELETE /operations/events/:id
 */
router.delete(
  "/:id",
  requirePermissions(["operations_write"], "anyOf"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const tid = req.auth.tid;

      // sécurité tenant
      const exists = await prisma.event.findFirst({
        where: { id, tenantId: tid },
        select: { id: true },
      });
      if (!exists) return res.status(404).json({ error: "Événement introuvable" });

      await prisma.event.delete({ where: { id } });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

export default router;

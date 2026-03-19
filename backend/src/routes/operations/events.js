import express from "express";
import { prisma } from "../../prisma.js";
import { requirePermissions } from "../../rbac.js";
import { resolveAccessContext } from "../../lib/accessScope.js";

const router = express.Router();

// ✅ Ici, index.js a déjà fait:
// verifyKeycloak + attachDbAuthFromKeycloak
router.use(requirePermissions(["operations_read"], "anyOf"));

router.get("/", async (req, res) => {
  try {
    const { type, from, to } = req.query;
    const tid = req.auth.tid;
    const accessContext = await resolveAccessContext(req);
    if (accessContext.scope === "SELF") return res.json({ events: [] });

    const where = { tenantId: tid };
    if (type) where.type = String(type);

    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
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

router.post("/", requirePermissions(["operations_write"], "anyOf"), async (req, res) => {
  try {
    const accessContext = await resolveAccessContext(req);
    if (accessContext.scope === "SELF") return res.status(403).json({ error: "Forbidden" });
    const { title, date, time, type, description, location, attendees } = req.body;
    if (!title || !date) return res.status(400).json({ error: "title et date sont requis" });

    const ev = await prisma.event.create({
      data: {
        title: String(title),
        date: new Date(date),
        time: time || null,
        type: ["meeting", "training", "deadline", "other"].includes(type) ? type : "meeting",
        description: description ?? null,
        location: location ?? null,
        attendees: attendees ?? null,
        tenantId: req.auth.tid,
      },
    });

    res.json(ev);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/:id", requirePermissions(["operations_write"], "anyOf"), async (req, res) => {
  try {
    const { id } = req.params;
    const tid = req.auth.tid;
    const accessContext = await resolveAccessContext(req);
    if (accessContext.scope === "SELF") return res.status(403).json({ error: "Forbidden" });

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
});

export default router;

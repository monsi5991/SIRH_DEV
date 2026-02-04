// backend/src/routes/operations/timesheets.js
import express from "express";
import { prisma } from "../../prisma.js";
import { verifyAccess } from "../../auth.js";
import { requirePermissions } from "../../rbac.js";

const router = express.Router();

/** Résout le tenant (auth -> user -> premier tenant existant) */
async function resolveTenantId(req) {
  return (
    req.auth?.tid ||
    req.user?.tenantId ||
    (await prisma.tenant.findFirst({ select: { id: true } }))?.id ||
    null
  );
}

/* =========================================
 *               READ
 * ========================================= */
/**
 * GET /operations/timesheets
 * Query:
 *  - employee: string (contains)
 *  - from: YYYY-MM-DD
 *  - to:   YYYY-MM-DD
 *  - status: "Submitted" | "Approved" | "Rejected"
 */
router.get(
  "/",
  verifyAccess,
  requirePermissions(["operations_read"], "anyOf"),
  async (req, res) => {
    try {
      const tid = await resolveTenantId(req);
      if (!tid) return res.status(401).json({ error: "Unauthorized" });

      const { employee, from, to, status } = req.query;

      const where = { tenantId: tid };
      if (employee) where.employee = { contains: String(employee) };
      if (status) where.status = String(status);
      if (from || to) {
        where.date = {};
        if (from) where.date.gte = new Date(String(from));
        if (to) where.date.lte = new Date(String(to));
      }

      const timesheets = await prisma.timesheet.findMany({
        where,
        // ⚠️ le schéma actuel n'a pas createdAt → on ordonne uniquement par date
        orderBy: [{ date: "desc" }],
        take: 500,
        select: {
          id: true,
          employee: true,
          employeeId: true,
          date: true,
          hours: true,
          project: true,
          note: true,
          status: true,
          // ✅ champs paie
          type: true,     // "REG" | "OT_DAY" | "OT_NIGHT" | "OT_SUN" | "OT_HOL" ...
          premium: true,  // ex 0.15 (15%)
          // createdAt / updatedAt retirés
        },
      });

      res.json({ timesheets });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

/* =========================================
 *               CREATE / UPSERT
 * ========================================= */
router.post(
  "/",
  verifyAccess,
  requirePermissions(["operations_write"], "anyOf"),
  async (req, res) => {
    try {
      const tid = await resolveTenantId(req);
      if (!tid) return res.status(401).json({ error: "Unauthorized" });

      const {
        employee, employeeId, date, hours, project, note, status, type, premium,
      } = req.body || {};

      if ((!employee && !employeeId) || !date || hours == null) {
        return res
          .status(400)
          .json({ error: "employee/employeeId, date et hours sont requis" });
      }

      const d = new Date(date);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ error: "date invalide" });
      }

      // 🔁 upsert par (tenantId, employeeId?, employee, date)
      const whereKey = employeeId
        ? { uniq_timesheet_empid: { tenantId: tid, employeeId, date: d } }
        : { uniq_timesheet_per_day: { tenantId: tid, employee, date: d } };

      const row = await prisma.timesheet.upsert({
        where: whereKey,
        update: {
          hours: Number(hours),
          project: project ?? null,
          note: note ?? null,
          status: status || "Submitted",
          type: String(type || "REG").toUpperCase(),
          premium: premium != null ? Number(premium) : null,
          // possibilité de corriger l'identifiant
          employee: employee || undefined,
          employeeId: employeeId || undefined,
        },
        create: {
          tenantId: tid,
          employee: employee || null,
          employeeId: employeeId || null,
          date: d,
          hours: Number(hours),
          project: project ?? null,
          note: note ?? null,
          status: status || "Submitted",
          type: String(type || "REG").toUpperCase(),
          premium: premium != null ? Number(premium) : null,
        },
      });

      res.status(201).json(row);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

/* =========================================
 *               UPDATE
 * ========================================= */
router.put(
  "/:id",
  verifyAccess,
  requirePermissions(["operations_write"], "anyOf"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status, type, premium } = req.body || {};
      const tid = await resolveTenantId(req);
      if (!tid) return res.status(401).json({ error: "Unauthorized" });

      const found = await prisma.timesheet.findFirst({
        where: { id, tenantId: tid },
        select: { id: true },
      });
      if (!found) return res.status(404).json({ error: "Feuille de temps introuvable" });

      const row = await prisma.timesheet.update({
        where: { id },
        data: {
          ...(status ? { status } : {}),
          ...(type ? { type: String(type).toUpperCase() } : {}),
          ...(premium != null ? { premium: Number(premium) } : {}),
        },
      });
      res.json(row);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

/* =========================================
 *               DELETE
 * ========================================= */
router.delete(
  "/:id",
  verifyAccess,
  requirePermissions(["operations_write"], "anyOf"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const tid = await resolveTenantId(req);
      if (!tid) return res.status(401).json({ error: "Unauthorized" });

      const found = await prisma.timesheet.findFirst({
        where: { id, tenantId: tid },
        select: { id: true },
      });
      if (!found) return res.status(404).json({ error: "Feuille de temps introuvable" });

      await prisma.timesheet.delete({ where: { id } });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

export default router;

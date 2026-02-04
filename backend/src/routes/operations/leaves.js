// backend/src/routes/operations/leaves.js
import express from "express";
import { prisma } from "../../prisma.js";
import { verifyAccess } from "../../auth.js";
import { requirePermissions } from "../../rbac.js";
import { notify } from "../../lib/notify.js";

const router = express.Router();
router.use(verifyAccess);

const ALLOWED_STATUS = new Set(["Pending", "Approved", "Rejected"]);
const ALLOWED_HALF_DAY = new Set(["AM", "PM", null]);

function toDateSafe(v) {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function writeActionLog({ tenantId, leaveId, actorId, action, fromStatus, toStatus, reason, meta }) {
  try {
    await prisma.leaveActionLog.create({
      data: { tenantId, leaveId, actorId, action, fromStatus, toStatus, reason: reason ?? null, meta: meta ?? {} }
    });
  } catch (e) {
    // silencieux (ne bloque pas la requête principale)
    console.warn("leaveActionLog error:", e?.message);
  }
}

function quote(s) {
  if (s == null) return "";
  const str = String(s);
  if (str.includes(",") || str.includes('"')) return `"${str.replaceAll('"','""')}"`;
  return str;
}

/**
 * GET /operations/leaves
 * Query params: status, q, type, employeeId, from, to, sort, page, pageSize
 * Tri: "createdAt:desc|start:asc|end:asc" (par défaut createdAt:desc)
 */
router.get(
  "/",
  requirePermissions(["operations_read"], "anyOf"),
  async (req, res) => {
    try {
      const tid = req.auth?.tid;
      const {
        status,
        q,
        type,
        employeeId,
        from,
        to,
        sort = "createdAt:desc",
        page = "1",
        pageSize = "25",
      } = req.query;

      const where = { tenantId: tid };

      if (status) {
        const s = String(status);
        if (!ALLOWED_STATUS.has(s)) return res.status(400).json({ error: "Statut invalide" });
        where.status = s;
      }
      if (type) where.type = String(type);
      if (employeeId) where.employeeId = String(employeeId);
      if (q) {
        where.OR = [
          { employee: { contains: String(q), mode: "insensitive" } },
          { type: { contains: String(q), mode: "insensitive" } },
          { status: { contains: String(q), mode: "insensitive" } },
        ];
      }
      if (from || to) {
        where.AND = where.AND || [];
        const startFilter = {};
        if (from) startFilter.gte = new Date(from);
        if (to) {
          const d = new Date(to);
          d.setHours(23, 59, 59, 999);
          startFilter.lte = d;
        }
        where.AND.push({ start: startFilter });
      }

      const [sortFieldRaw, sortDirRaw] = String(sort).split(":");
      const sortField = ["createdAt", "start", "end"].includes(sortFieldRaw) ? sortFieldRaw : "createdAt";
      const sortDir = sortDirRaw === "asc" ? "asc" : "desc";
      const orderBy = [{ [sortField]: sortDir }];

      const p = Math.max(1, parseInt(page, 10) || 1);
      const ps = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 25));
      const skip = (p - 1) * ps;
      const take = ps;

      const [total, rows] = await Promise.all([
        prisma.leave.count({ where }),
        prisma.leave.findMany({
          where,
          orderBy,
          skip,
          take,
          select: {
            id: true, tenantId: true, employee: true, employeeId: true,
            start: true, end: true, createdAt: true, status: true,
            type: true, paid: true, halfDay: true,
          },
        }),
      ]);

      res.json({ total, page: p, pageSize: ps, leaves: rows });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

/**
 * Détails + logs (supporte ?minimal=1|true pour ne renvoyer que {leave, logs: []})
 * GET /operations/leaves/:id
 */
router.get(
  "/:id",
  requirePermissions(["operations_read"], "anyOf"),
  async (req, res) => {
    try {
      const tid = req.auth?.tid;
      const { id } = req.params;
      const minimal =
        req.query.minimal === "1" ||
        req.query.minimal === "true" ||
        req.query.min === "1" ||
        req.query.min === "true";

      const leave = await prisma.leave.findFirst({
        where: { id, tenantId: tid },
      });
      if (!leave) return res.status(404).json({ error: "Demande introuvable" });

      if (minimal) {
        // format simple accepté par le client
        return res.json({ leave, logs: [] });
      }

      const logs = await prisma.leaveActionLog.findMany({
        where: { tenantId: tid, leaveId: id },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      res.json({ leave, logs });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

/**
 * Commentaires (thread simple)
 * GET /operations/leaves/:id/comments
 * POST /operations/leaves/:id/comments
 */
router.get(
  "/:id/comments",
  requirePermissions(["operations_read"], "anyOf"),
  async (req, res) => {
    try {
      const tid = req.auth?.tid;
      const { id } = req.params;
      const comments = await prisma.leaveComment.findMany({
        where: { tenantId: tid, leaveId: id },
        orderBy: { createdAt: "asc" },
        take: 200,
      });
      res.json({ comments });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

router.post(
  "/:id/comments",
  requirePermissions(["operations_write"], "anyOf"),
  async (req, res) => {
    try {
      const tid = req.auth?.tid;
      const uid = req.auth?.sub;
      const { id } = req.params;
      const { message } = req.body || {};
      if (!message || !String(message).trim()) return res.status(400).json({ error: "Message requis" });

      const leave = await prisma.leave.findFirst({ where: { id, tenantId: tid }, select: { id: true } });
      if (!leave) return res.status(404).json({ error: "Demande introuvable" });

      const created = await prisma.leaveComment.create({
        data: { tenantId: tid, leaveId: id, authorId: uid, message: String(message).trim() },
      });
      res.status(201).json({ comment: created });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

/**
 * POST /operations/leaves
 */
router.post(
  "/",
  requirePermissions(["operations_write"], "anyOf"),
  async (req, res) => {
    try {
      const tid = req.auth?.tid;
      const uid = req.auth?.sub;
      const {
        employee, employeeId, start, end, type, paid, halfDay, status,
      } = req.body || {};

      if ((!employee && !employeeId) || !start || !end) {
        return res.status(400).json({ error: "employee/employeeId, start, end requis" });
      }

      const startDate = toDateSafe(start);
      const endDate = toDateSafe(end);
      if (!startDate || !endDate) return res.status(400).json({ error: "Dates invalides" });
      if (endDate < startDate) return res.status(400).json({ error: "end doit être après (ou égal à) start" });

      const normalizedStatus = status && ALLOWED_STATUS.has(status) ? status : "Pending";
      const normalizedHalfDay = halfDay == null ? null : String(halfDay);
      if (!ALLOWED_HALF_DAY.has(normalizedHalfDay)) {
        return res.status(400).json({ error: "halfDay invalide (AM | PM | null)" });
      }

      const leave = await prisma.$transaction(async (tx) => {
        const created = await tx.leave.create({
          data: {
            tenantId: tid,
            employee: employee ? String(employee) : null,
            employeeId: employeeId || null,
            start: startDate,
            end: endDate,
            type: type || "CP",
            paid: typeof paid === "boolean" ? paid : true,
            halfDay: normalizedHalfDay,
            status: normalizedStatus,
          },
        });
        await tx.leaveActionLog.create({
          data: {
            tenantId: tid, leaveId: created.id, actorId: uid,
            action: "CREATE", fromStatus: null, toStatus: created.status, reason: null, meta: {},
          },
        });
        return created;
      });

      // Notification (hook)
      notify("leave.created", { id: leave.id, tenantId: tid, status: leave.status });

      res.status(201).json({ leave });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

/**
 * PUT /operations/leaves/:id
 * body: { status?, paid?, type?, halfDay? }
 */
router.put(
  "/:id",
  requirePermissions(["operations_write"], "anyOf"),
  async (req, res) => {
    try {
      const tid = req.auth?.tid;
      const uid = req.auth?.sub;
      const { id } = req.params;
      const { status, paid, type, halfDay } = req.body || {};

      const found = await prisma.leave.findFirst({ where: { id, tenantId: tid } });
      if (!found) return res.status(404).json({ error: "Demande introuvable" });

      const data = {};
      if (status !== undefined) {
        if (!ALLOWED_STATUS.has(String(status))) return res.status(400).json({ error: "Statut invalide" });
        data.status = String(status);
      }
      if (paid !== undefined) data.paid = !!paid;
      if (type !== undefined) data.type = type ? String(type) : null;

      if ("halfDay" in req.body) {
        const normalizedHalfDay = halfDay == null ? null : String(halfDay);
        if (!ALLOWED_HALF_DAY.has(normalizedHalfDay)) {
          return res.status(400).json({ error: "halfDay invalide (AM | PM | null)" });
        }
        data.halfDay = normalizedHalfDay;
      }

      const updated = await prisma.$transaction(async (tx) => {
        const up = await tx.leave.update({ where: { id }, data });
        if (status !== undefined) {
          await tx.leaveActionLog.create({
            data: {
              tenantId: tid, leaveId: id, actorId: uid,
              action: "UPDATE", fromStatus: found.status, toStatus: up.status, reason: null, meta: { fields: Object.keys(data) }
            }
          });
        }
        return up;
      });

      res.json({ leave: updated });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

/**
 * PUT /operations/leaves/:id/status
 * body: { status: "Approved"|"Rejected"|"Pending", reason?: string }
 */
router.put(
  "/:id/status",
  requirePermissions(["operations_write"], "anyOf"),
  async (req, res) => {
    try {
      const tid = req.auth?.tid;
      const uid = req.auth?.sub;
      const { id } = req.params;
      const { status, reason } = req.body || {};
      if (!ALLOWED_STATUS.has(status)) return res.status(400).json({ error: "Statut invalide" });

      const found = await prisma.leave.findFirst({ where: { id, tenantId: tid } });
      if (!found) return res.status(404).json({ error: "Demande introuvable" });

      const updated = await prisma.$transaction(async (tx) => {
        const up = await tx.leave.update({ where: { id }, data: { status } });
        await tx.leaveActionLog.create({
          data: {
            tenantId: tid, leaveId: id, actorId: uid,
            action: status.toUpperCase(), fromStatus: found.status, toStatus: status, reason: reason ?? null, meta: {}
          }
        });
        return up;
      });

      // Notification (hook)
      notify("leave.status_changed", { id: updated.id, tenantId: tid, status, reason: reason ?? null });

      res.json({ leave: updated });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

/**
 * PUT /operations/leaves/bulk-status
 * body: { ids: string[], status: "Approved"|"Rejected", reason: string }
 */
router.put(
  "/bulk-status",
  requirePermissions(["operations_bulk_update", "operations_write"], "anyOf"),
  async (req, res) => {
    try {
      const tid = req.auth?.tid;
      const uid = req.auth?.sub;
      const { ids, status, reason } = req.body || {};
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "ids requis" });
      if (!ALLOWED_STATUS.has(status) || status === "Pending") return res.status(400).json({ error: "Statut invalide" });
      if (!reason || !String(reason).trim()) return res.status(400).json({ error: "Motif requis" });

      const rows = await prisma.leave.findMany({ where: { tenantId: tid, id: { in: ids } }, select: { id: true, status: true } });
      if (rows.length === 0) return res.status(404).json({ error: "Aucune demande trouvée" });

      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.leave.updateMany({
          where: { tenantId: tid, id: { in: ids } },
          data: { status },
        });
        // logs individuels
        for (const r of rows) {
          await tx.leaveActionLog.create({
            data: {
              tenantId: tid, leaveId: r.id, actorId: uid,
              action: status.toUpperCase(), fromStatus: r.status, toStatus: status, reason, meta: { bulk: true }
            }
          });
        }
        return updated;
      });

      // Notification (hook)
      notify("leave.bulk_status_changed", { ids, tenantId: tid, status, reason });

      res.json({ ok: true, count: result.count });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

/**
 * Export CSV
 * GET /operations/leaves/export.csv?status=&from=&to=
 */
router.get(
  "/export.csv",
  requirePermissions(["operations_read"], "anyOf"),
  async (req, res) => {
    try {
      const tid = req.auth?.tid;
      const { status, from, to } = req.query;
      const where = { tenantId: tid };
      if (status && ALLOWED_STATUS.has(String(status))) where.status = String(status);
      if (from || to) {
        const range = {};
        if (from) range.gte = new Date(from);
        if (to)  { const d = new Date(to); d.setHours(23,59,59,999); range.lte = d; }
        where.start = range;
      }

      const rows = await prisma.leave.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });

      const header = ["id","employee","employeeId","start","end","type","paid","halfDay","status","createdAt"];
      const lines = [header.join(",")];
      for (const r of rows) {
        lines.push([
          r.id, quote(r.employee), r.employeeId ?? "",
          r.start.toISOString(), r.end.toISOString(),
          r.type ?? "", r.paid ? "1":"0", r.halfDay ?? "", r.status ?? "", r.createdAt.toISOString()
        ].map(s=>String(s).replaceAll("\n"," ")).join(","));
      }
      const csv = lines.join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="leaves_export_${Date.now()}.csv"`);
      res.send(csv);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

/**
 * Stats agrégées
 * GET /operations/leaves/stats?groupBy=month|type|employee&from=&to=
 */
router.get(
  "/stats",
  requirePermissions(["operations_read"], "anyOf"),
  async (req, res) => {
    try {
      const tid = req.auth?.tid;
      const { groupBy = "month", from, to } = req.query; // "month"|"type"|"employee"
      const where = { tenantId: tid };
      if (from || to) {
        const rng = {};
        if (from) rng.gte = new Date(from);
        if (to) { const d=new Date(to); d.setHours(23,59,59,999); rng.lte = d; }
        where.start = rng;
      }

      const rows = await prisma.leave.findMany({
        where,
        select:{ id:true, start:true, type:true, employee:true, status:true },
      });

      const stats = {};
      for (const r of rows) {
        if (r.status !== "Approved") continue; // stats sur approuvés
        const key =
          groupBy === "type" ? (r.type || "Autre") :
          groupBy === "employee" ? (r.employee || "Inconnu") :
          `${r.start.getFullYear()}-${String(r.start.getMonth()+1).padStart(2,"0")}`;
        stats[key] = (stats[key] || 0) + 1;
      }

      res.json({ groupBy, stats });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

/**
 * Validation métier simplifiée
 * POST /operations/leaves/validate
 * body: { employeeId, start, end }
 */
router.post(
  "/validate",
  requirePermissions(["operations_write"], "anyOf"),
  async (req, res) => {
    try {
      const tid = req.auth?.tid;
      const { employeeId, start, end } = req.body || {};
      const startDate = toDateSafe(start), endDate = toDateSafe(end);
      if (!startDate || !endDate) return res.status(400).json({ error: "Dates invalides" });

      const blocking = [];
      const warnings = [];

      // chevauchements approuvés existants
      const overlaps = await prisma.leave.findFirst({
        where: {
          tenantId: tid,
          employeeId: employeeId ?? undefined,
          status: "Approved",
          AND: [
            { start: { lte: endDate } },
            { end: {   gte: startDate } },
          ],
        },
        select: { id: true, start: true, end: true },
      });
      if (overlaps) blocking.push("Chevauchement avec un congé approuvé existant.");

      // jours fériés (placeholder: si start ou end tombe un dimanche)
      if (startDate.getDay() === 0 || endDate.getDay() === 0) {
        warnings.push("La période inclut un dimanche (vérifier jours fériés locaux).");
      }

      // solde (placeholder: non vérifié)
      // warnings.push("Solde non vérifié (intégrer LeaveBalance).");

      res.json({ ok: blocking.length === 0, warnings, blocking });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

/**
 * DELETE /operations/leaves/:id
 */
router.delete(
  "/:id",
  requirePermissions(["operations_write"], "anyOf"),
  async (req, res) => {
    try {
      const tid = req.auth?.tid;
      const uid = req.auth?.sub;
      const { id } = req.params;

      const found = await prisma.leave.findFirst({ where: { id, tenantId: tid }, select: { id: true, status: true } });
      if (!found) return res.status(404).json({ error: "Demande introuvable" });

      await prisma.$transaction(async (tx) => {
        await tx.leave.delete({ where: { id } });
        await tx.leaveActionLog.create({
          data: {
            tenantId: tid, leaveId: id, actorId: uid,
            action: "DELETE", fromStatus: found.status, toStatus: null, reason: null, meta: {}
          }
        });
      });

      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

export default router;

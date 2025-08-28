// backend/src/routes/dashboard.js
import express from "express";
import { prisma } from "../prisma.js";

const router = express.Router();

/* ------------------------------------------------------------------ *
 * Helpers robustes
 * ------------------------------------------------------------------ */
const safeCount = async (fn) => { try { return await fn(); } catch { return 0; } };
const safeFindMany = async (fn) => { try { return await fn(); } catch { return []; } };
const safeAggregate = async (fn, fallback = 0) => {
  try { const r = await fn(); return r?._sum?.amount ?? fallback; }
  catch { return fallback; }
};

// 🔎 résout un tenantId “démo” si on n’a pas d’auth (route publique)
async function resolveTenantId(req) {
  // si le backend a posé req.auth en amont, on l’utilise
  const tid = req.auth?.tid;
  if (tid) return tid;
  // sinon on prend le 1er tenant existant (démo/dev)
  const any = await prisma.tenant.findFirst({ select: { id: true } });
  return any?.id || null;
}

/** ========================= SUMMARY GLOBAL =========================
 * GET /dashboard/summary  (⚠️ public en démo)
 * ================================================================== */
router.get("/summary", async (req, res) => {
  try {
    const tid = await resolveTenantId(req);
    if (!tid) {
      // environnement vide → renvoyer un payload neutre
      return res.json({
        totalEmployees: 0,
        activeEmployees: 0,
        onLeave: 0,
        newHires: 0,
        leaves: { Pending: 0, Approved: 0, Rejected: 0 },
        nextLeaves: [],
        recentExpenses: [],
        upcomingEvents: [],
        pendingValidations: { leaves: 0, timesheets: 0, expenses: 0, events: 0, total: 0 },
      });
    }

    const now = new Date();
    const startOfToday = new Date(now.toDateString());
    const next7 = new Date(startOfToday); next7.setDate(next7.getDate() + 7);
    const last30 = new Date(); last30.setDate(last30.getDate() - 30);

    // --- Employés
    const totalEmployees = await prisma.user.count({ where: { tenantId: tid } });

    const onLeaveNow = await safeCount(() =>
      prisma.leave.count({
        where: { tenantId: tid, status: "Approved", start: { lte: now }, end: { gte: now } },
      })
    );
    const activeEmployees = Math.max(totalEmployees - onLeaveNow, 0);

    const newHires = await prisma.user.count({
      where: { tenantId: tid, createdAt: { gte: last30 } },
    });

    // --- “À valider”
    const leavesPending = await safeCount(() =>
      prisma.leave.count({ where: { tenantId: tid, status: "Pending" } })
    );
    const timesSubmitted = await safeCount(() =>
      prisma.timesheet.count({ where: { tenantId: tid, status: "Submitted" } })
    );
    const expSubmitted = await safeCount(() =>
      prisma.expense.count({ where: { tenantId: tid, status: "Submitted" } })
    );
    const eventsNext7 = await safeCount(() =>
      prisma.event.count({ where: { tenantId: tid, date: { gte: startOfToday, lt: next7 } } })
    );

    // --- Détails congés
    const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
      safeCount(() => prisma.leave.count({ where: { tenantId: tid, status: "Pending" } })),
      safeCount(() => prisma.leave.count({ where: { tenantId: tid, status: "Approved" } })),
      safeCount(() => prisma.leave.count({ where: { tenantId: tid, status: "Rejected" } })),
    ]);

    // --- Listes widgets
    const nextLeaves = await safeFindMany(() =>
      prisma.leave.findMany({
        where: { tenantId: tid, start: { gte: now } },
        orderBy: { start: "asc" }, take: 5,
      })
    );

    const recentExpenses = await safeFindMany(() =>
      prisma.expense.findMany({
        where: { tenantId: tid },
        orderBy: { date: "desc" }, take: 5,
      })
    );

    const upcomingEvents = await safeFindMany(() =>
      prisma.event.findMany({
        where: { tenantId: tid, date: { gte: startOfToday } },
        orderBy: { date: "asc" }, take: 5,
      })
    );

    return res.json({
      totalEmployees,
      activeEmployees,
      onLeave: onLeaveNow,
      newHires,
      leaves: { Pending: pendingCount, Approved: approvedCount, Rejected: rejectedCount },
      nextLeaves,
      recentExpenses,
      upcomingEvents,
      pendingValidations: {
        leaves: leavesPending,
        timesheets: timesSubmitted,
        expenses: expSubmitted,
        events: eventsNext7,
        total: leavesPending + timesSubmitted + expSubmitted + eventsNext7,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

/** ========================= RESUME DU MOIS =========================
 * GET /dashboard/month-summary  (⚠️ public en démo)
 * ================================================================== */
router.get("/month-summary", async (req, res) => {
  try {
    const tid = await resolveTenantId(req);
    if (!tid) {
      return res.json({
        attendanceRate: null,
        approvedLeaves: 0,
        totalExpensesXof: 0,
        pendingValidationsMonth: { leaves: 0, timesheets: 0, expenses: 0, total: 0 },
        range: null,
      });
    }

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const approvedLeaves = await safeCount(() =>
      prisma.leave.count({
        where: { tenantId: tid, status: "Approved", start: { lt: monthEnd }, end: { gte: monthStart } },
      })
    );

    let totalExpensesXof = await safeAggregate(
      () => prisma.expense.aggregate({
        _sum: { amount: true },
        where: {
          tenantId: tid, currency: "XOF",
          date: { gte: monthStart, lt: monthEnd },
          status: { in: ["Submitted", "Approved"] },
        },
      }), 0
    );
    if (!totalExpensesXof) {
      totalExpensesXof = await safeAggregate(
        () => prisma.expense.aggregate({
          _sum: { amount: true },
          where: { tenantId: tid, currency: "XOF", date: { gte: monthStart, lt: monthEnd } },
        }), 0
      );
    }

    const totalEmployees = await prisma.user.count({ where: { tenantId: tid } });

    const endForPresence = now < monthEnd ? now : new Date(monthEnd.getTime() - 1);
    const businessDaysSoFar = (() => {
      let d = new Date(monthStart), count = 0;
      const endD = new Date(Date.UTC(endForPresence.getUTCFullYear(), endForPresence.getUTCMonth(), endForPresence.getUTCDate()));
      while (d <= endD) {
        const wd = d.getUTCDay(); if (wd >= 1 && wd <= 5) count++;
        d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
      }
      return count;
    })();

    const times = await safeFindMany(() =>
      prisma.timesheet.findMany({
        where: { tenantId: tid, date: { gte: monthStart, lt: monthEnd }, hours: { gt: 0 } },
        select: { employee: true, date: true },
      })
    );
    const presentSet = new Set();
    for (const t of times) {
      const d = new Date(t.date);
      const keyDay = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
      presentSet.add(`${t.employee}|${keyDay}`);
    }
    const employeeDaysPresent = presentSet.size;
    const denominator = totalEmployees * businessDaysSoFar;
    const attendanceRate = denominator > 0 ? Math.max(0, Math.min(1, employeeDaysPresent / denominator)) : null;

    const [leavesPendingMonth, timesSubmittedMonth, expSubmittedMonth] = await Promise.all([
      safeCount(() => prisma.leave.count({ where: { tenantId: tid, status: "Pending", createdAt: { gte: monthStart, lt: monthEnd } } })),
      safeCount(() => prisma.timesheet.count({ where: { tenantId: tid, status: "Submitted", date: { gte: monthStart, lt: monthEnd } } })),
      safeCount(() => prisma.expense.count({ where: { tenantId: tid, status: "Submitted", date: { gte: monthStart, lt: monthEnd } } })),
    ]);

    return res.json({
      attendanceRate,
      approvedLeaves,
      totalExpensesXof,
      pendingValidationsMonth: {
        leaves: leavesPendingMonth,
        timesheets: timesSubmittedMonth,
        expenses: expSubmittedMonth,
        total: leavesPendingMonth + timesSubmittedMonth + expSubmittedMonth,
      },
      range: { from: monthStart, to: monthEnd },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

export default router;

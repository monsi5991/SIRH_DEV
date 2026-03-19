// backend/src/routes/dashboard.js
import express from "express";
import { prisma } from "../prisma.js";
import { requirePermissions } from "../rbac.js";
import { buildLeaveWorkflowMap, getDefaultLeaveApprovalStage } from "../lib/leaveWorkflow.js";
import {
  buildEmployeeScopeWhere,
  resolveAccessContext,
} from "../lib/accessScope.js";

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

function startOfDay(input = new Date()) {
  const d = new Date(input);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(input = new Date()) {
  const d = new Date(input);
  d.setHours(23, 59, 59, 999);
  return d;
}

function addDays(input, days) {
  const d = new Date(input);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfWeekMonday(input = new Date()) {
  const d = startOfDay(input);
  const day = d.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  return addDays(d, delta);
}

function startOfMonth(input = new Date()) {
  return new Date(input.getFullYear(), input.getMonth(), 1);
}

function dateKey(input) {
  const d = new Date(input);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function businessDaysBetween(from, to) {
  const start = startOfDay(from);
  const end = startOfDay(to);
  let count = 0;
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    const wd = d.getDay();
    if (wd >= 1 && wd <= 5) count += 1;
  }
  return count;
}

function daysBetweenInclusive(from, to) {
  const start = startOfDay(from);
  const end = startOfDay(to);
  const ms = end - start;
  return Math.max(0, Math.floor(ms / 86400000) + 1);
}

function durationDays(leave) {
  if (!leave?.start || !leave?.end) return 0;
  if (leave.halfDay === "AM" || leave.halfDay === "PM") return 0.5;
  return daysBetweenInclusive(leave.start, leave.end);
}

function fullName(e) {
  return `${e?.firstName || ""} ${e?.lastName || ""}`.trim() || e?.email || "—";
}

function priorityFromAge(ageInDays = 0) {
  if (ageInDays >= 7) return "HIGH";
  if (ageInDays >= 3) return "NORMAL";
  return "LOW";
}

function mapApprovalStatus(status) {
  const s = String(status || "").toLowerCase();
  if (s === "pending" || s === "submitted") return "PENDING_MANAGER";
  if (s === "approved" || s === "paid" || s === "done" || s === "completed") return "APPROVED";
  if (s === "rejected") return "REJECTED";
  return "PENDING_HR";
}

const OPEN_HR_REQUEST_STATUSES = new Set([
  "DRAFT",
  "SUBMITTED",
  "PENDING_MANAGER",
  "PENDING_HR",
]);

function isOpenHrRequest(status) {
  return OPEN_HR_REQUEST_STATUSES.has(String(status || "").toUpperCase());
}

function mapHrRequestStatus(status) {
  const s = String(status || "").toUpperCase();
  if (!s) return "SUBMITTED";
  return s;
}

async function resolveViewerEmployee(tenantId, userId) {
  if (!tenantId || !userId) return null;
  return prisma.employee.findFirst({
    where: { tenantId, userId },
    include: { manager: { select: { id: true, firstName: true, lastName: true } } },
  });
}

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function sumOvertime(rows = []) {
  return rows.reduce((acc, r) => {
    if (r?.premium != null) return acc + toNumber(r.premium, 0);
    const h = toNumber(r?.hours, 0);
    return acc + Math.max(0, h - 8);
  }, 0);
}

/** ========================= SUMMARY GLOBAL =========================
 * GET /dashboard/summary  (⚠️ public en démo)
 * ================================================================== */
router.get("/summary", requirePermissions(["team_read", "all"], "anyOf"), async (req, res) => {
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
    const accessContext = await resolveAccessContext(req);
    const employeeScope = buildEmployeeScopeWhere(accessContext, { field: "id" });
    const activityEmployeeScope = buildEmployeeScopeWhere(accessContext, { field: "employeeId" });

    const now = new Date();
    const startOfToday = new Date(now.toDateString());
    const next7 = new Date(startOfToday); next7.setDate(next7.getDate() + 7);
    const last30 = new Date(); last30.setDate(last30.getDate() - 30);

    // --- Employés
    const totalEmployees = await prisma.employee.count({
      where: { tenantId: tid, ...employeeScope },
    });

    const onLeaveNow = await safeCount(() =>
      prisma.leave.count({
        where: {
          tenantId: tid,
          ...activityEmployeeScope,
          status: "Approved",
          start: { lte: now },
          end: { gte: now },
        },
      })
    );
    const activeEmployees = Math.max(totalEmployees - onLeaveNow, 0);

    const newHires = await prisma.employee.count({
      where: { tenantId: tid, ...employeeScope, joinDate: { gte: last30 } },
    });

    // --- “À valider”
    const leavesPending = await safeCount(() =>
      prisma.leave.count({ where: { tenantId: tid, ...activityEmployeeScope, status: "Pending" } })
    );
    const timesSubmitted = await safeCount(() =>
      prisma.timesheet.count({ where: { tenantId: tid, ...activityEmployeeScope, status: "Submitted" } })
    );
    const expSubmitted = await safeCount(() =>
      prisma.expense.count({ where: { tenantId: tid, ...activityEmployeeScope, status: "Submitted" } })
    );
    const eventsNext7 =
      accessContext.scope === "COMPANY"
        ? await safeCount(() =>
            prisma.event.count({ where: { tenantId: tid, date: { gte: startOfToday, lt: next7 } } })
          )
        : 0;

    // --- Détails congés
    const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
      safeCount(() =>
        prisma.leave.count({ where: { tenantId: tid, ...activityEmployeeScope, status: "Pending" } })
      ),
      safeCount(() =>
        prisma.leave.count({ where: { tenantId: tid, ...activityEmployeeScope, status: "Approved" } })
      ),
      safeCount(() =>
        prisma.leave.count({ where: { tenantId: tid, ...activityEmployeeScope, status: "Rejected" } })
      ),
    ]);

    // --- Listes widgets
    const nextLeaves = await safeFindMany(() =>
      prisma.leave.findMany({
        where: { tenantId: tid, ...activityEmployeeScope, start: { gte: now } },
        orderBy: { start: "asc" }, take: 5,
      })
    );

    const recentExpenses = await safeFindMany(() =>
      prisma.expense.findMany({
        where: { tenantId: tid, ...activityEmployeeScope },
        orderBy: { date: "desc" }, take: 5,
      })
    );

    const upcomingEvents =
      accessContext.scope === "COMPANY"
        ? await safeFindMany(() =>
            prisma.event.findMany({
              where: { tenantId: tid, date: { gte: startOfToday } },
              orderBy: { date: "asc" }, take: 5,
            })
          )
        : [];

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
router.get("/month-summary", requirePermissions(["team_read", "all"], "anyOf"), async (req, res) => {
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
    const accessContext = await resolveAccessContext(req);
    const employeeScope = buildEmployeeScopeWhere(accessContext, { field: "id" });
    const activityEmployeeScope = buildEmployeeScopeWhere(accessContext, { field: "employeeId" });

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const approvedLeaves = await safeCount(() =>
      prisma.leave.count({
        where: {
          tenantId: tid,
          ...activityEmployeeScope,
          status: "Approved",
          start: { lt: monthEnd },
          end: { gte: monthStart },
        },
      })
    );

    let totalExpensesXof = await safeAggregate(
      () => prisma.expense.aggregate({
        _sum: { amount: true },
        where: {
          tenantId: tid,
          ...activityEmployeeScope,
          currency: "XOF",
          date: { gte: monthStart, lt: monthEnd },
          status: { in: ["Submitted", "Approved"] },
        },
      }), 0
    );
    if (!totalExpensesXof) {
      totalExpensesXof = await safeAggregate(
        () => prisma.expense.aggregate({
          _sum: { amount: true },
          where: {
            tenantId: tid,
            ...activityEmployeeScope,
            currency: "XOF",
            date: { gte: monthStart, lt: monthEnd },
          },
        }), 0
      );
    }

    const totalEmployees = await prisma.employee.count({
      where: { tenantId: tid, ...employeeScope },
    });

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
        where: {
          tenantId: tid,
          ...activityEmployeeScope,
          date: { gte: monthStart, lt: monthEnd },
          hours: { gt: 0 },
        },
        select: { employee: true, employeeId: true, date: true },
      })
    );
    const presentSet = new Set();
    for (const t of times) {
      const d = new Date(t.date);
      const keyDay = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
      const eid = t.employeeId || t.employee;
      if (eid) presentSet.add(`${eid}|${keyDay}`);
    }
    const employeeDaysPresent = presentSet.size;
    const denominator = totalEmployees * businessDaysSoFar;
    const attendanceRate = denominator > 0 ? Math.max(0, Math.min(1, employeeDaysPresent / denominator)) : null;

    const [leavesPendingMonth, timesSubmittedMonth, expSubmittedMonth] = await Promise.all([
      safeCount(() =>
        prisma.leave.count({
          where: {
            tenantId: tid,
            ...activityEmployeeScope,
            status: "Pending",
            createdAt: { gte: monthStart, lt: monthEnd },
          },
        })
      ),
      safeCount(() =>
        prisma.timesheet.count({
          where: {
            tenantId: tid,
            ...activityEmployeeScope,
            status: "Submitted",
            date: { gte: monthStart, lt: monthEnd },
          },
        })
      ),
      safeCount(() =>
        prisma.expense.count({
          where: {
            tenantId: tid,
            ...activityEmployeeScope,
            status: "Submitted",
            date: { gte: monthStart, lt: monthEnd },
          },
        })
      ),
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

/* ========================= DASHBOARD EMPLOYEE ========================= */
router.get(
  "/employee",
  requirePermissions(["self_read", "all"], "anyOf"),
  async (req, res) => {
    try {
      const tenantId = await resolveTenantId(req);
      const userId = req.auth?.sub;
      if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });

      const now = new Date();
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);
      const monthStart = startOfMonth(now);

      const employee = await resolveViewerEmployee(tenantId, userId);
      if (!employee) return res.status(404).json({ error: "employee_not_found" });

      const [
        leaves,
        expenses,
        timesheets,
        todayClockEvents,
        hrRequests,
        interviews,
        goals,
        documents,
        policies,
        policyAcks,
        enrollmentsDone,
        enrollmentsNext,
      ] = await Promise.all([
        safeFindMany(() =>
          prisma.leave.findMany({
            where: { tenantId, employeeId: employee.id },
            orderBy: { createdAt: "desc" },
            take: 30,
          })
        ),
        safeFindMany(() =>
          prisma.expense.findMany({
            where: { tenantId, employeeId: employee.id },
            orderBy: { date: "desc" },
            take: 20,
          })
        ),
        safeFindMany(() =>
          prisma.timesheet.findMany({
            where: { tenantId, employeeId: employee.id, date: { gte: monthStart } },
            orderBy: { date: "desc" },
            take: 90,
          })
        ),
        safeFindMany(() =>
          prisma.auditEvent.findMany({
            where: {
              tenantId,
              actorId: userId,
              type: { in: ["CLOCK_IN", "CLOCK_OUT"] },
              createdAt: { gte: todayStart, lte: todayEnd },
            },
            orderBy: { createdAt: "asc" },
            take: 20,
          })
        ),
        safeFindMany(() =>
          prisma.hrRequest.findMany({
            where: {
              tenantId,
              OR: [{ employeeId: employee.id }, { requesterUserId: userId }],
            },
            select: {
              id: true,
              type: true,
              title: true,
              createdAt: true,
              submittedAt: true,
              status: true,
              currentApproverId: true,
            },
            orderBy: { createdAt: "desc" },
            take: 30,
          })
        ),
        safeFindMany(() =>
          prisma.interview.findMany({
            where: {
              tenantId,
              employeeId: employee.id,
              status: { in: ["PLANNED", "IN_PROGRESS"] },
            },
            select: {
              id: true,
              type: true,
              status: true,
              scheduledAt: true,
            },
            orderBy: { scheduledAt: "asc" },
            take: 10,
          })
        ),
        safeFindMany(() =>
          prisma.goal.findMany({
            where: { tenantId, employeeId: employee.id },
            orderBy: { updatedAt: "desc" },
            take: 20,
          })
        ),
        safeFindMany(() =>
          prisma.document.findMany({
            where: { tenantId, employeeId: employee.id },
            orderBy: { createdAt: "desc" },
            take: 12,
          })
        ),
        safeFindMany(() =>
          prisma.policy.findMany({
            where: { tenantId, isActive: true },
            orderBy: { createdAt: "desc" },
            include: { versions: { take: 1, orderBy: { createdAt: "desc" } } },
            take: 10,
          })
        ),
        safeFindMany(() =>
          prisma.policyAck.findMany({
            where: { tenantId, employeeId: employee.id },
            select: { policyId: true, acknowledgedAt: true },
          })
        ),
        safeFindMany(() =>
          prisma.enrollment.findMany({
            where: { tenantId, employeeId: employee.id, status: { in: ["completed", "present"] } },
            orderBy: { createdAt: "desc" },
            include: { session: { include: { course: true } } },
            take: 1,
          })
        ),
        safeFindMany(() =>
          prisma.enrollment.findMany({
            where: { tenantId, employeeId: employee.id, session: { startDate: { gte: now } } },
            orderBy: { session: { startDate: "asc" } },
            include: { session: { include: { course: true } } },
            take: 1,
          })
        ),
      ]);

      const byType = {
        LEAVE: leaves.filter((l) => l.status === "Pending").length,
        EXPENSE: expenses.filter((e) => String(e.status || "").toLowerCase() === "submitted").length,
        HR_REQUEST: hrRequests.filter((r) => isOpenHrRequest(r.status)).length,
        TRAINING: enrollmentsNext.length,
      };

      const leaveCounters = (() => {
        const base = {
          ANNUAL: { label: "Congés annuels", allocated: 24, approved: 0, pending: 0 },
          SICK: { label: "Maladie", allocated: 10, approved: 0, pending: 0 },
          OTHER: { label: "Autres", allocated: 6, approved: 0, pending: 0 },
        };
        for (const l of leaves) {
          const code = String(l.type || "").toUpperCase();
          const key =
            code.includes("MAL") || code.includes("SICK")
              ? "SICK"
              : code.includes("CP") || code.includes("ANNUAL")
              ? "ANNUAL"
              : "OTHER";
          const days = durationDays(l);
          if (l.status === "Approved") base[key].approved += days;
          if (l.status === "Pending") base[key].pending += days;
        }
        return Object.entries(base).map(([code, v]) => ({
          leaveTypeCode: code,
          leaveTypeLabel: v.label,
          balanceDays: Math.max(0, Number((v.allocated - v.approved).toFixed(1))),
          pendingRequestsDays: Number(v.pending.toFixed(1)),
        }));
      })();

      const approverIds = Array.from(
        new Set(
          hrRequests.map((r) => r.currentApproverId).filter(Boolean)
        )
      );
      const approvers = approverIds.length
        ? await safeFindMany(() =>
            prisma.user.findMany({
              where: { tenantId, id: { in: approverIds } },
              select: { id: true, firstName: true, lastName: true },
            })
          )
        : [];
      const approverNameById = new Map(
        approvers.map((u) => [u.id, `${u.firstName || ""} ${u.lastName || ""}`.trim() || "Approver"])
      );

      const recentRequests = [
        ...leaves.map((l) => ({
          id: l.id,
          type: "LEAVE",
          label: l.type || "Congé",
          createdAt: l.createdAt,
          currentApproverName:
            employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}`.trim() : "Manager",
          status: mapApprovalStatus(l.status),
        })),
        ...expenses.map((e) => ({
          id: e.id,
          type: "EXPENSE",
          label: e.category || "Note de frais",
          createdAt: e.createdAt,
          currentApproverName:
            employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}`.trim() : "Manager",
          status: mapApprovalStatus(e.status),
        })),
        ...hrRequests.map((r) => ({
          id: r.id,
          type: "HR_REQUEST",
          label: r.title || r.type,
          createdAt: r.createdAt || r.submittedAt,
          currentApproverName:
            approverNameById.get(r.currentApproverId) ||
            (employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}`.trim() : "RH"),
          status: mapHrRequestStatus(r.status),
        })),
      ]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);

      const timesheetDateSet = new Set(timesheets.map((t) => dateKey(t.date)));
      const missingDays = [];
      for (let d = new Date(monthStart); d <= todayStart; d = addDays(d, 1)) {
        const wd = d.getDay();
        if (wd === 0 || wd === 6) continue;
        const key = dateKey(d);
        if (!timesheetDateSet.has(key)) missingDays.push(key);
      }

      const todaySheets = timesheets.filter((t) => t.date >= todayStart && t.date <= todayEnd);
      const todayHours = Number(todaySheets.reduce((acc, t) => acc + toNumber(t.hours, 0), 0).toFixed(2));
      const inEvents = (todayClockEvents || []).filter((e) => e.type === "CLOCK_IN");
      const outEvents = (todayClockEvents || []).filter((e) => e.type === "CLOCK_OUT");
      const firstClockIn = inEvents[0];
      const lastClockIn = inEvents[inEvents.length - 1];
      const lastClockOut = outEvents[outEvents.length - 1];
      const firstClockInTime =
        (firstClockIn?.payload?.clockInAt ? new Date(firstClockIn.payload.clockInAt) : null) ||
        (firstClockIn?.createdAt ? new Date(firstClockIn.createdAt) : null);
      const lastClockInTime =
        (lastClockIn?.payload?.clockInAt ? new Date(lastClockIn.payload.clockInAt) : null) ||
        (lastClockIn?.createdAt ? new Date(lastClockIn.createdAt) : null);
      const lastClockOutTime =
        (lastClockOut?.payload?.clockOutAt ? new Date(lastClockOut.payload.clockOutAt) : null) ||
        (lastClockOut?.createdAt ? new Date(lastClockOut.createdAt) : null);
      const hasOpenClockSession =
        !!lastClockInTime &&
        (!lastClockOutTime || lastClockInTime.getTime() > lastClockOutTime.getTime());
      const isLateClockIn =
        !!firstClockInTime &&
        firstClockInTime.getHours() * 60 + firstClockInTime.getMinutes() > 9 * 60 + 15;

      const doneTraining = enrollmentsDone[0];
      const nextTraining = enrollmentsNext[0];

      const ackedPolicyIds = new Set(
        policyAcks.filter((a) => a.acknowledgedAt).map((a) => a.policyId)
      );

      const pendingDocuments = policies
        .filter((p) => !ackedPolicyIds.has(p.id))
        .slice(0, 5)
        .map((p) => ({
          id: p.id,
          title: p.title,
          type: "POLICY",
          dueDate: p.versions?.[0]?.effectiveAt || p.createdAt,
          status: "TO_SIGN",
        }));

      const myObjectivesSummary = {
        total: goals.length,
        onTrack: goals.filter((g) => g.status === "on_track").length,
        late: goals.filter((g) => g.status === "off_track").length,
        notStarted: goals.filter((g) => toNumber(g.progress, 0) === 0).length,
      };

      const upcomingInterviews = interviews.map((i) => ({
        id: i.id,
        type: i.type,
        scheduledAt: i.scheduledAt,
        managerName:
          employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}`.trim() : "Manager",
        status: i.status,
      }));

      return res.json({
        pendingDocuments,
        pendingForms: [],
        upcomingInterviews,
        myRequestsSummary: {
          totalOpen: byType.LEAVE + byType.EXPENSE + byType.HR_REQUEST + byType.TRAINING,
          byType,
        },
        recentRequests,
        leaveBalances: leaveCounters,
        upcomingLeaves: leaves
          .filter((l) => l.start >= todayStart)
          .slice(0, 5)
          .map((l) => ({
            id: l.id,
            leaveTypeLabel: l.type || "Congé",
            startDate: l.start,
            endDate: l.end,
            status: mapApprovalStatus(l.status),
          })),
        timeToFill: {
          missingDays,
          currentPeriod: { start: monthStart, end: now },
        },
        todayAttendance: {
          clockInTime: firstClockInTime,
          clockOutTime: lastClockOutTime,
          totalHours: todayHours,
          status: hasOpenClockSession
            ? "IN_PROGRESS"
            : firstClockInTime && lastClockOutTime
            ? isLateClockIn
              ? "LATE"
              : "ON_TIME"
            : todayHours > 0
            ? "ON_TIME"
            : "ABSENT",
        },
        myObjectivesSummary,
        myObjectivesShort: goals.slice(0, 5).map((g) => ({
          id: g.id,
          title: g.title,
          dueDate: g.endDate,
          progressPercent: toNumber(g.progress, 0),
          status: g.status,
        })),
        myUpcomingInterviews: upcomingInterviews,
        learningStatus: {
          lastCompletedTraining: doneTraining
            ? {
                id: doneTraining.id,
                title: doneTraining.session?.course?.title || "Formation",
                completedAt: doneTraining.createdAt,
              }
            : null,
          nextPlannedTraining: nextTraining
            ? {
                id: nextTraining.id,
                title: nextTraining.session?.course?.title || "Formation",
                sessionDate: nextTraining.session?.startDate || null,
              }
            : null,
        },
        myDocumentsShortcuts: documents.slice(0, 8).map((d) => ({
          id: d.id,
          type: String(d.type || "OTHER").toUpperCase(),
          title: d.label,
          period: d.createdAt ? dateKey(d.createdAt).slice(0, 7) : null,
          downloadUrl: d.url,
        })),
        policiesLinks: policies.slice(0, 8).map((p) => ({
          id: p.id,
          title: p.title,
          category: (p.category || "GENERAL").toUpperCase(),
          language: p.versions?.[0]?.language || "FR",
          url: p.versions?.[0]?.fileUrl || null,
        })),
      });
    } catch (e) {
      console.error("[dashboard/employee] error:", e);
      return res.status(500).json({ error: "employee_dashboard_failed" });
    }
  }
);

/* ========================= DASHBOARD MANAGER ========================= */
router.get(
  "/manager",
  requirePermissions(["team_read", "all"], "anyOf"),
  async (req, res) => {
    try {
      const tenantId = await resolveTenantId(req);
      const userId = req.auth?.sub;
      if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });

      const now = new Date();
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);
      const weekStart = startOfWeekMonday(now);
      const weekEnd = addDays(weekStart, 6);
      const next30 = addDays(todayEnd, 30);
      const next60 = addDays(todayEnd, 60);
      const last30 = addDays(todayStart, -30);
      const last12Months = addDays(todayStart, -365);

      const manager = await resolveViewerEmployee(tenantId, userId);
      if (!manager) return res.status(404).json({ error: "employee_not_found" });

      const team = await safeFindMany(() =>
        prisma.employee.findMany({
          where: { tenantId, managerId: manager.id },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            status: true,
            joinDate: true,
            endDate: true,
            contractType: true,
          },
        })
      );
      const teamIds = team.map((e) => e.id);
      if (!teamIds.length) {
        return res.json({
          approvalsSummary: {
            leavePendingCount: 0,
            expensePendingCount: 0,
            hrRequestPendingCount: 0,
            trainingPendingCount: 0,
            timesheetPendingCount: 0,
          },
          pendingApprovals: [],
          teamAttendanceToday: {
            totalTeamMembers: 0,
            presentCount: 0,
            onLeaveCount: 0,
            remoteCount: 0,
            unjustifiedAbsenceCount: 0,
          },
          teamAbsentees: [],
          teamPlanningWeek: { weekStart, weekEnd, days: [] },
          performanceCampaignsSummary: [],
          interviewsToDo: [],
          probationEndingSoon: [],
          contractsEndingSoon: [],
          longAbsences: [],
          teamKpis: {
            period: { start: last30, end: todayEnd },
            absenceRatePercent: 0,
            overtimeHours: 0,
            overtimeHoursPerEmployee: [],
            teamTurnoverLast12Months: 0,
          },
        });
      }

      const [leaves, expenses, timesheets, hrRequests, interviews, goals, cycles] = await Promise.all([
        safeFindMany(() =>
          prisma.leave.findMany({
            where: { tenantId, employeeId: { in: teamIds } },
            orderBy: { createdAt: "desc" },
            take: 200,
          })
        ),
        safeFindMany(() =>
          prisma.expense.findMany({
            where: { tenantId, employeeId: { in: teamIds } },
            orderBy: { createdAt: "desc" },
            take: 200,
          })
        ),
        safeFindMany(() =>
          prisma.timesheet.findMany({
            where: { tenantId, employeeId: { in: teamIds } },
            orderBy: { date: "desc" },
            take: 400,
          })
        ),
        safeFindMany(() =>
          prisma.hrRequest.findMany({
            where: {
              tenantId,
              employeeId: { in: teamIds },
            },
            select: {
              id: true,
              employeeId: true,
              type: true,
              title: true,
              createdAt: true,
              submittedAt: true,
              status: true,
            },
            orderBy: { createdAt: "desc" },
            take: 300,
          })
        ),
        safeFindMany(() =>
          prisma.interview.findMany({
            where: {
              tenantId,
              employeeId: { in: teamIds },
              status: { in: ["PLANNED", "IN_PROGRESS"] },
            },
            select: {
              id: true,
              employeeId: true,
              campaignId: true,
              status: true,
              scheduledAt: true,
            },
            orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
            take: 200,
          })
        ),
        safeFindMany(() =>
          prisma.goal.findMany({
            where: { tenantId, employeeId: { in: teamIds } },
            orderBy: { updatedAt: "desc" },
            take: 400,
          })
        ),
        safeFindMany(() =>
          prisma.reviewCycle.findMany({
            where: { tenantId },
            orderBy: { startDate: "desc" },
            take: 5,
          })
        ),
      ]);

      const byId = new Map(team.map((e) => [e.id, e]));
      const employeeName = (id, fallback = "—") => fullName(byId.get(id)) || fallback;

      const pendingLeaves = leaves.filter((l) => l.status === "Pending");
      const leaveWorkflowMap = await buildLeaveWorkflowMap(prisma, tenantId, pendingLeaves);
      const leavePending = pendingLeaves.filter((leave) => {
        const workflow = leaveWorkflowMap.get(leave.id);
        const defaultStage = getDefaultLeaveApprovalStage(Boolean(byId.get(leave.employeeId)?.managerId));
        return (workflow?.approvalStage || defaultStage) === "PENDING_MANAGER";
      });
      const expensePending = expenses.filter((e) => String(e.status || "").toLowerCase() === "submitted");
      const timesheetPending = timesheets.filter((t) => String(t.status || "").toLowerCase() === "submitted");
      const hrRequestsPending = hrRequests.filter((r) =>
        ["PENDING_MANAGER", "SUBMITTED"].includes(String(r.status || "").toUpperCase())
      );

      const pendingApprovals = [
        ...leavePending.map((l) => ({
          id: l.id,
          type: "LEAVE",
          employeeName: employeeName(l.employeeId, l.employee),
          title: `${l.type || "Congé"} · En attente manager`,
          submittedAt: l.createdAt,
          ageInDays: Math.max(0, daysBetweenInclusive(l.createdAt, now) - 1),
        })),
        ...expensePending.map((e) => ({
          id: e.id,
          type: "EXPENSE",
          employeeName: employeeName(e.employeeId, e.employee),
          title: e.category || "Note de frais",
          submittedAt: e.createdAt,
          ageInDays: Math.max(0, daysBetweenInclusive(e.createdAt, now) - 1),
        })),
        ...timesheetPending.map((t) => ({
          id: t.id,
          type: "TIMESHEET",
          employeeName: employeeName(t.employeeId, t.employee),
          title: "Feuille de temps",
          submittedAt: t.createdAt || t.date,
          ageInDays: Math.max(0, daysBetweenInclusive(t.createdAt || t.date, now) - 1),
        })),
        ...hrRequestsPending.map((r) => ({
          id: r.id,
          type: "HR_REQUEST",
          employeeName: employeeName(r.employeeId),
          title: r.title || r.type,
          submittedAt: r.submittedAt || r.createdAt,
          ageInDays: Math.max(0, daysBetweenInclusive(r.submittedAt || r.createdAt, now) - 1),
        })),
      ]
        .map((r) => ({ ...r, priority: priorityFromAge(r.ageInDays) }))
        .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt))
        .slice(0, 5);

      const leavesToday = leaves.filter(
        (l) => l.status === "Approved" && l.start <= todayEnd && l.end >= todayStart
      );
      const onLeaveSet = new Set(leavesToday.map((l) => l.employeeId).filter(Boolean));

      const todayTimes = timesheets.filter((t) => t.date >= todayStart && t.date <= todayEnd && toNumber(t.hours, 0) > 0);
      const presentSet = new Set(todayTimes.map((t) => t.employeeId).filter(Boolean));
      const presentCount = Array.from(presentSet).filter((id) => !onLeaveSet.has(id)).length;

      const unjustifiedEmployeeIds = teamIds.filter((id) => !onLeaveSet.has(id) && !presentSet.has(id));

      const teamAbsentees = [
        ...Array.from(onLeaveSet).map((empId) => {
          const leave = leavesToday.find((l) => l.employeeId === empId);
          return {
            employeeId: empId,
            employeeName: employeeName(empId),
            status: "ON_LEAVE",
            leaveTypeLabel: leave?.type || "Congé",
            startDate: leave?.start || null,
            endDate: leave?.end || null,
          };
        }),
        ...unjustifiedEmployeeIds.map((empId) => ({
          employeeId: empId,
          employeeName: employeeName(empId),
          status: "UNJUSTIFIED",
          leaveTypeLabel: null,
          startDate: todayStart,
          endDate: todayEnd,
        })),
      ].slice(0, 20);

      const days = [];
      for (let d = new Date(weekStart); d <= weekEnd; d = addDays(d, 1)) {
        const absent = leaves.filter(
          (l) => l.status === "Approved" && l.start <= endOfDay(d) && l.end >= startOfDay(d)
        ).length;
        const planned = Math.max(0, team.length - absent);
        days.push({
          date: new Date(d),
          plannedHeadcount: planned,
          requiredHeadcount: team.length,
          underStaffed: planned < Math.ceil(team.length * 0.7),
          overStaffed: planned > team.length,
        });
      }

      const performanceCampaignsSummary = cycles.map((c) => {
        const cycleGoals = goals.filter((g) => g.cycleId === c.id);
        const participants = new Set(cycleGoals.map((g) => g.employeeId).filter(Boolean));
        const completedCount = cycleGoals.filter((g) => toNumber(g.progress, 0) >= 100).length;
        const inProgressCount = cycleGoals.filter((g) => toNumber(g.progress, 0) > 0 && toNumber(g.progress, 0) < 100).length;
        const notStartedCount = Math.max(0, team.length - participants.size);
        return {
          campaignId: c.id,
          campaignName: c.name,
          period: c.period,
          teamTotalParticipants: team.length,
          completedCount,
          inProgressCount,
          notStartedCount,
        };
      });

      const probationEndingSoon = team
        .filter((e) => e.joinDate)
        .map((e) => {
          const probationEndDate = addDays(e.joinDate, 90);
          return { employee: e, probationEndDate };
        })
        .filter((x) => x.probationEndDate >= todayStart && x.probationEndDate <= next30)
        .map((x) => ({
          employeeId: x.employee.id,
          employeeName: fullName(x.employee),
          probationEndDate: x.probationEndDate,
          decisionStatus: "PENDING",
        }))
        .sort((a, b) => new Date(a.probationEndDate) - new Date(b.probationEndDate))
        .slice(0, 10);

      const contractsEndingSoon = team
        .filter((e) => e.endDate && e.endDate >= todayStart && e.endDate <= next60)
        .map((e) => ({
          employeeId: e.id,
          employeeName: fullName(e),
          contractType: e.contractType || "N/A",
          endDate: e.endDate,
        }))
        .sort((a, b) => new Date(a.endDate) - new Date(b.endDate))
        .slice(0, 10);

      const longAbsences = leaves
        .filter((l) => l.status === "Approved")
        .filter((l) => durationDays(l) >= 10)
        .filter((l) => l.end >= todayStart)
        .map((l) => ({
          employeeId: l.employeeId,
          employeeName: employeeName(l.employeeId, l.employee),
          absenceType: l.type || "Congé",
          startDate: l.start,
          expectedReturnDate: l.end,
        }))
        .slice(0, 10);

      const absenceDays30 = leaves
        .filter((l) => l.status === "Approved" && l.start <= todayEnd && l.end >= last30)
        .reduce((acc, l) => acc + durationDays(l), 0);

      const overtimeRows = timesheets.filter((t) => t.date >= last30 && t.date <= todayEnd);
      const overtimeHours = Number(sumOvertime(overtimeRows).toFixed(2));
      const overtimeByEmployee = team.map((e) => ({
        employeeId: e.id,
        employeeName: fullName(e),
        hours: Number(sumOvertime(overtimeRows.filter((r) => r.employeeId === e.id)).toFixed(2)),
      }));

      const denominator = Math.max(1, team.length * businessDaysBetween(last30, todayEnd));
      const absenceRatePercent = Number(((absenceDays30 / denominator) * 100).toFixed(2));

      const leaversCount = team.filter(
        (e) => e.endDate && e.endDate >= last12Months && e.endDate <= todayEnd
      ).length;

      const interviewsToDo = interviews
        .map((i) => ({
          id: i.id,
          employeeId: i.employeeId,
          employeeName: employeeName(i.employeeId),
          campaignName: "Campagne entretiens",
          scheduledAt: i.scheduledAt,
          status: i.status,
        }))
        .slice(0, 20);

      return res.json({
        approvalsSummary: {
          leavePendingCount: leavePending.length,
          expensePendingCount: expensePending.length,
          hrRequestPendingCount: hrRequestsPending.length,
          trainingPendingCount: 0,
          timesheetPendingCount: timesheetPending.length,
        },
        pendingApprovals,
        teamAttendanceToday: {
          totalTeamMembers: team.length,
          presentCount,
          onLeaveCount: onLeaveSet.size,
          remoteCount: 0,
          unjustifiedAbsenceCount: Math.max(0, unjustifiedEmployeeIds.length),
        },
        teamAbsentees,
        teamPlanningWeek: { weekStart, weekEnd, days },
        performanceCampaignsSummary,
        interviewsToDo,
        probationEndingSoon,
        contractsEndingSoon,
        longAbsences,
        teamKpis: {
          period: { start: last30, end: todayEnd },
          absenceRatePercent,
          overtimeHours,
          overtimeHoursPerEmployee: overtimeByEmployee,
          teamTurnoverLast12Months: leaversCount,
        },
      });
    } catch (e) {
      console.error("[dashboard/manager] error:", e);
      return res.status(500).json({ error: "manager_dashboard_failed" });
    }
  }
);

/* ========================= DASHBOARD HR ========================= */
router.get(
  "/hr",
  requirePermissions(["directory_read", "admin_read", "all"], "anyOf"),
  async (req, res) => {
    try {
      const tenantId = await resolveTenantId(req);
      if (!tenantId) return res.status(401).json({ error: "Unauthorized" });

      const now = new Date();
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);
      const last30 = addDays(todayStart, -30);
      const next30 = addDays(todayEnd, 30);
      const next60 = addDays(todayEnd, 60);
      const monthStart = startOfMonth(now);
      const monthEnd = addDays(startOfMonth(addDays(now, 32)), 0);

      const [
        employees,
        leaves,
        timesheets,
        expenses,
        hrRequests,
        interviews,
        cycles,
        goals,
        sessionsUpcoming,
        enrollmentsUpcoming,
        complianceMedical,
        documents,
        leaveActionLogs,
        roles,
        auditEvents,
      ] = await Promise.all([
        safeFindMany(() =>
          prisma.employee.findMany({
            where: { tenantId },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              country: true,
              site: true,
              status: true,
              contractType: true,
              joinDate: true,
              endDate: true,
              department: true,
              position: true,
              cnss: true,
              ipres: true,
              phone: true,
            },
          })
        ),
        safeFindMany(() =>
          prisma.leave.findMany({
            where: { tenantId },
            select: { id: true, employeeId: true, start: true, end: true, status: true, type: true, createdAt: true },
            take: 800,
          })
        ),
        safeFindMany(() =>
          prisma.timesheet.findMany({
            where: { tenantId },
            select: { id: true, employeeId: true, date: true, hours: true, status: true, premium: true, tenantId: true },
            take: 2000,
          })
        ),
        safeFindMany(() =>
          prisma.expense.findMany({
            where: { tenantId },
            select: { id: true, employeeId: true, status: true, createdAt: true, amount: true, date: true, currency: true },
            take: 800,
          })
        ),
        safeFindMany(() =>
          prisma.hrRequest.findMany({
            where: { tenantId },
            select: {
              id: true,
              type: true,
              status: true,
              createdAt: true,
              submittedAt: true,
              resolvedAt: true,
            },
            take: 2500,
          })
        ),
        safeFindMany(() =>
          prisma.interview.findMany({
            where: { tenantId },
            select: { id: true, campaignId: true, status: true, createdAt: true, updatedAt: true },
            take: 2500,
          })
        ),
        safeFindMany(() =>
          prisma.reviewCycle.findMany({
            where: { tenantId },
            orderBy: { startDate: "desc" },
            take: 8,
          })
        ),
        safeFindMany(() =>
          prisma.goal.findMany({
            where: { tenantId },
            select: { id: true, cycleId: true, progress: true, status: true },
            take: 2000,
          })
        ),
        safeFindMany(() =>
          prisma.session.findMany({
            where: { tenantId, startDate: { gte: todayStart } },
            orderBy: { startDate: "asc" },
            take: 50,
          })
        ),
        safeFindMany(() =>
          prisma.enrollment.findMany({
            where: { tenantId, session: { startDate: { gte: todayStart } } },
            select: { id: true },
            take: 5000,
          })
        ),
        safeFindMany(() =>
          prisma.complianceTask.findMany({
            where: { tenantId, category: { contains: "medical", mode: "insensitive" } },
            include: { employee: { select: { id: true, firstName: true, lastName: true, country: true } } },
            take: 50,
          })
        ),
        safeFindMany(() =>
          prisma.document.findMany({
            where: { tenantId },
            select: { id: true, employeeId: true, type: true },
            take: 5000,
          })
        ),
        safeFindMany(() =>
          prisma.leaveActionLog.findMany({
            where: { tenantId, action: { in: ["APPROVE", "REJECT", "APPROVED", "REJECTED"] } },
            select: { leaveId: true, createdAt: true },
            take: 5000,
          })
        ),
        safeFindMany(() =>
          prisma.role.findMany({
            where: { tenantId },
            include: { users: { select: { userId: true } } },
          })
        ),
        safeFindMany(() =>
          prisma.auditEvent.findMany({
            where: { tenantId },
            orderBy: { createdAt: "desc" },
            take: 10,
          })
        ),
      ]);

      const employeeById = new Map(employees.map((e) => [e.id, e]));
      const activeEmployees = employees.filter((e) => e.status === "ACTIVE");

      const headcountByContractType = Object.entries(
        employees.reduce((acc, e) => {
          const key = e.contractType || "UNKNOWN";
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {})
      ).map(([type, count]) => ({ type, count }));

      const hiresThisMonth = employees.filter(
        (e) => e.joinDate && e.joinDate >= monthStart && e.joinDate < monthEnd
      ).length;
      const leaversThisMonth = employees.filter(
        (e) => e.endDate && e.endDate >= monthStart && e.endDate < monthEnd
      ).length;

      const approvedLeaves30 = leaves.filter(
        (l) => l.status === "Approved" && l.start <= todayEnd && l.end >= last30
      );
      const absenceDays30 = approvedLeaves30.reduce((acc, l) => acc + durationDays(l), 0);
      const overtimeHours30 = Number(
        sumOvertime(timesheets.filter((t) => t.date >= last30 && t.date <= todayEnd)).toFixed(2)
      );
      const absenceRatePercent = Number(
        (
          (absenceDays30 /
            Math.max(1, activeEmployees.length * businessDaysBetween(last30, todayEnd))) *
          100
        ).toFixed(2)
      );

      const openHrRequests = hrRequests.filter((r) => isOpenHrRequest(r.status));
      const openByTypeMap = openHrRequests.reduce((acc, r) => {
        const key = String(r.type || "OTHER").toUpperCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      const openHrRequestsSummary = {
        totalOpen: openHrRequests.length,
        byType: Object.entries(openByTypeMap).map(([type, count]) => ({ type, count })),
      };

      const incompleteEmployeeFiles = employees
        .map((e) => {
          const missingFields = [];
          if (!e.phone) missingFields.push("PHONE");
          if (!e.department) missingFields.push("DEPARTMENT");
          if (!e.position) missingFields.push("POSITION");
          if (!e.cnss) missingFields.push("CNSS");
          if (!e.ipres) missingFields.push("IPRES");
          return { employeeId: e.id, employeeName: fullName(e), missingFields };
        })
        .filter((x) => x.missingFields.length)
        .slice(0, 30);

      const performanceCampaignsGlobal = cycles.map((c) => {
        const cycleGoals = goals.filter((g) => g.cycleId === c.id);
        const completed = cycleGoals.filter((g) => toNumber(g.progress, 0) >= 100).length;
        const completion = cycleGoals.length
          ? Number(((completed / cycleGoals.length) * 100).toFixed(2))
          : 0;
        return {
          campaignId: c.id,
          campaignName: c.name,
          overallCompletionPercent: completion,
        };
      });

      const interviewKpis = {
        planned: interviews.filter((i) => i.status === "PLANNED").length,
        inProgress: interviews.filter((i) => i.status === "IN_PROGRESS").length,
        done: interviews.filter((i) => i.status === "DONE").length,
      };

      const sites = Array.from(new Set(employees.map((e) => e.site || "N/A")));
      const todayTimeSet = new Set(
        timesheets
          .filter((t) => t.date >= todayStart && t.date <= todayEnd && toNumber(t.hours, 0) > 0)
          .map((t) => t.employeeId)
          .filter(Boolean)
      );
      const siteSummaries = sites.map((site) => {
        const siteEmployees = employees.filter((e) => (e.site || "N/A") === site);
        const missingClockingsCount = siteEmployees.filter((e) => !todayTimeSet.has(e.id)).length;
        const overtimeHours = Number(
          sumOvertime(
            timesheets.filter((t) => {
              const emp = employeeById.get(t.employeeId);
              return (emp?.site || "N/A") === site && t.date >= last30 && t.date <= todayEnd;
            })
          ).toFixed(2)
        );
        return {
          siteId: site,
          siteName: site,
          missingClockingsCount,
          overtimeHours,
          negativeLeaveBalanceEmployees: 0,
        };
      });

      const contractsEndingSoonGlobal = employees
        .filter((e) => e.endDate && e.endDate >= todayStart && e.endDate <= next60)
        .map((e) => ({
          employeeId: e.id,
          employeeName: fullName(e),
          country: e.country,
          site: e.site,
          contractType: e.contractType || "N/A",
          endDate: e.endDate,
        }))
        .sort((a, b) => new Date(a.endDate) - new Date(b.endDate))
        .slice(0, 30);

      const docsByEmployee = documents.reduce((acc, d) => {
        if (!d.employeeId) return acc;
        if (!acc[d.employeeId]) acc[d.employeeId] = [];
        acc[d.employeeId].push(String(d.type || "").toUpperCase());
        return acc;
      }, {});

      const missingMandatoryDocuments = employees
        .filter((e) => {
          const docTypes = docsByEmployee[e.id] || [];
          const hasIdDoc = docTypes.some((t) => t.includes("ID"));
          const hasContract = docTypes.some((t) => t.includes("CONTRACT"));
          return !hasIdDoc || !hasContract;
        })
        .slice(0, 30)
        .map((e) => ({
          employeeId: e.id,
          employeeName: fullName(e),
          documentType: !(docsByEmployee[e.id] || []).some((t) => t.includes("ID"))
            ? "ID_CARD"
            : "CONTRACT_SIGNED",
          country: e.country,
        }));

      const auditLogHighlights = {
        lastEvents: auditEvents.map((ev) => ({
          id: ev.id,
          performedAt: ev.createdAt,
          actorName: ev.actorId || "system",
          action: ev.type,
          targetType: ev.entity,
          severity: "INFO",
        })),
      };

      const leaveCreatedAtMap = new Map(leaves.map((l) => [l.id, l.createdAt]));
      const avgResolutionLeaves = leaveActionLogs.length
        ? Number(
            (
              leaveActionLogs.reduce((acc, log) => {
                const createdAt = leaveCreatedAtMap.get(log.leaveId);
                if (!createdAt) return acc;
                const diffHours = (new Date(log.createdAt).getTime() - new Date(createdAt).getTime()) / 3600000;
                return acc + Math.max(0, diffHours);
              }, 0) / leaveActionLogs.length
            ).toFixed(2)
          )
        : 0;
      const leavesResolved = leaves.filter((l) => ["Approved", "Rejected"].includes(l.status));

      const resolvedHrRequests = hrRequests.filter(
        (r) =>
          ["APPROVED", "REJECTED", "CANCELED", "CLOSED"].includes(String(r.status || "").toUpperCase()) &&
          r.resolvedAt &&
          r.submittedAt
      );
      const avgResolutionHr = resolvedHrRequests.length
        ? Number(
            (
              resolvedHrRequests.reduce((acc, r) => {
                const diffHours =
                  (new Date(r.resolvedAt).getTime() - new Date(r.submittedAt).getTime()) / 3600000;
                return acc + Math.max(0, diffHours);
              }, 0) / resolvedHrRequests.length
            ).toFixed(2)
          )
        : 0;
      const ticketByType = resolvedHrRequests.reduce((acc, r) => {
        const key = String(r.type || "OTHER").toUpperCase();
        if (!acc[key]) acc[key] = [];
        acc[key].push(r);
        return acc;
      }, {});
      const ticketByCategory =
        Object.keys(ticketByType).length > 0
          ? Object.entries(ticketByType).map(([category, rows]) => ({
              category,
              closedCount: rows.length,
              avgResolutionTimeHours: Number(
                (
                  rows.reduce((acc, r) => {
                    const diffHours =
                      (new Date(r.resolvedAt).getTime() - new Date(r.submittedAt).getTime()) / 3600000;
                    return acc + Math.max(0, diffHours);
                  }, 0) / rows.length
                ).toFixed(2)
              ),
            }))
          : [
              { category: "RH", closedCount: leavesResolved.length, avgResolutionTimeHours: avgResolutionLeaves },
              { category: "PAYROLL", closedCount: 0, avgResolutionTimeHours: 0 },
              { category: "IT", closedCount: 0, avgResolutionTimeHours: 0 },
              { category: "FACILITY", closedCount: 0, avgResolutionTimeHours: 0 },
            ];

      return res.json({
        globalKpis: {
          totalHeadcount: employees.length,
          headcountByContractType,
          hiresThisMonth,
          leaversThisMonth,
          absenceRatePercent,
          overtimeHours: overtimeHours30,
        },
        openHrRequestsSummary,
        incompleteEmployeeFilesCount: incompleteEmployeeFiles.length,
        incompleteEmployeeFiles,
        performanceCampaignsGlobal,
        timeControlSummary: {
          period: { start: last30, end: todayEnd },
          sites: siteSummaries,
        },
        payrollExportStatus: {
          period: { start: monthStart, end: monthEnd },
          siteSummaries: siteSummaries.map((s) => ({
            siteId: s.siteId,
            siteName: s.siteName,
            exportPrepared: false,
            lastExportAt: null,
          })),
        },
        talentSummary: {
          activeCampaignsCount: cycles.length,
          campaigns: performanceCampaignsGlobal.map((c) => ({
            campaignId: c.campaignId,
            campaignName: c.campaignName,
            globalCompletionPercent: c.overallCompletionPercent,
          })),
          interviews: interviewKpis,
        },
        trainingSummary: {
          upcomingSessionsCount: sessionsUpcoming.length,
          participantsRegistered: enrollmentsUpcoming.length,
          trainingBudgetPlanned: 0,
          trainingBudgetUsed: 0,
        },
        contractsEndingSoonGlobal,
        medicalChecksToPlan: complianceMedical.slice(0, 20).map((t) => ({
          employeeId: t.employee?.id || null,
          employeeName: fullName(t.employee),
          country: t.employee?.country || "N/A",
          lastCheckDate: null,
          nextDueDate: t.dueAt || null,
        })),
        missingMandatoryDocuments,
        ticketStats: {
          period: { start: last30, end: todayEnd },
          totalClosed: resolvedHrRequests.length || leavesResolved.length,
          averageResolutionTimeHours: resolvedHrRequests.length ? avgResolutionHr : avgResolutionLeaves,
          byCategory: ticketByCategory,
        },
        satisfactionScore: {
          period: { start: last30, end: todayEnd },
          averageScore: null,
          responsesCount: 0,
        },
        rbacSummary: {
          rolesCount: roles.length,
          usersPerRole: roles.map((r) => ({ role: r.name, count: r.users.length })),
        },
        auditLogHighlights,
        contractsEndingSoonGlobalCount: contractsEndingSoonGlobal.length,
      });
    } catch (e) {
      console.error("[dashboard/hr] error:", e);
      return res.status(500).json({ error: "hr_dashboard_failed" });
    }
  }
);

export default router;

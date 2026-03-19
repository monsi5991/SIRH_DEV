import express from "express";
import { prisma } from "../../prisma.js";
import { requirePermissions } from "../../rbac.js";
import { logAuditEvent } from "../../lib/audit.js";
import { createInAppNotification } from "../../lib/notifications.js";
import {
  buildEmployeeScopeWhere,
  canAccessEmployeeId,
  hasAnyPermission,
  resolveAccessContext,
} from "../../lib/accessScope.js";

const router = express.Router();

router.use(requirePermissions(["operations_read", "self_read"], "anyOf"));

const HOLIDAY_EVENT_TYPES = new Set(["holiday", "public_holiday", "ferie", "ferie_national", "bank_holiday"]);
const MS_DAY = 86400000;

async function resolveTenantId(req) {
  return req.auth?.tid || req.user?.tenantId || req.headers["x-tenant-id"];
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

function dateKey(input) {
  const d = new Date(input);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function asDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function roundHours(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Number(n.toFixed(2)));
}

function dayDiff(from, to) {
  const a = startOfDay(from).getTime();
  const b = startOfDay(to).getTime();
  return Math.max(0, Math.floor((b - a) / MS_DAY));
}

function isBusinessDay(input) {
  const d = new Date(input).getDay();
  return d >= 1 && d <= 5;
}

function severityWeight(severity) {
  const s = String(severity || "").toUpperCase();
  if (s === "HIGH") return 3;
  if (s === "MEDIUM") return 2;
  return 1;
}

function employeeDisplayName(employee) {
  return `${employee?.firstName || ""} ${employee?.lastName || ""}`.trim() || employee?.email || "Employé";
}

async function resolveTargetEmployee({ tenantId, employeeId }) {
  if (!tenantId || !employeeId) return null;
  return prisma.employee.findFirst({
    where: { tenantId, id: employeeId },
    select: {
      id: true,
      userId: true,
      firstName: true,
      lastName: true,
      email: true,
      joinDate: true,
      endDate: true,
      managerId: true,
      manager: {
        select: {
          id: true,
          userId: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });
}

async function findTodayTimesheet({ tenantId, employeeId, dayStart, dayEnd }) {
  const rows = await prisma.timesheet.findMany({
    where: {
      tenantId,
      employeeId,
      date: { gte: dayStart, lte: dayEnd },
    },
    orderBy: [{ createdAt: "desc" }, { date: "desc" }],
    take: 1,
  });
  return rows[0] || null;
}

async function findClockEventsForUser({ tenantId, userId, dayStart, dayEnd }) {
  if (!tenantId || !userId) return [];
  return prisma.auditEvent.findMany({
    where: {
      tenantId,
      actorId: userId,
      type: { in: ["CLOCK_IN", "CLOCK_OUT"] },
      createdAt: { gte: dayStart, lte: dayEnd },
    },
    orderBy: { createdAt: "asc" },
    take: 40,
  });
}

function extractAttendanceState({ row, events, now = new Date() }) {
  const inEvents = (events || []).filter((e) => e.type === "CLOCK_IN");
  const outEvents = (events || []).filter((e) => e.type === "CLOCK_OUT");
  const firstIn = inEvents[0] || null;
  const lastIn = inEvents[inEvents.length - 1] || null;
  const lastOut = outEvents[outEvents.length - 1] || null;

  const firstInTime = asDate(firstIn?.payload?.clockInAt) || asDate(firstIn?.createdAt);
  const lastInTime = asDate(lastIn?.payload?.clockInAt) || asDate(lastIn?.createdAt);
  const lastOutTime = asDate(lastOut?.payload?.clockOutAt) || asDate(lastOut?.createdAt);

  const hasOpenSession = !!lastInTime && (!lastOutTime || lastInTime > lastOutTime);
  const openClockInTime = hasOpenSession ? lastInTime : null;
  const computedFromEvents =
    firstInTime && lastOutTime && lastOutTime > firstInTime
      ? roundHours((lastOutTime.getTime() - firstInTime.getTime()) / 3600000)
      : 0;
  const totalHours = roundHours(row?.hours ?? computedFromEvents);
  const isLate = !!firstInTime && firstInTime.getHours() * 60 + firstInTime.getMinutes() > 9 * 60 + 15;

  let status = "ABSENT";
  if (hasOpenSession) status = "IN_PROGRESS";
  else if (firstInTime && lastOutTime) status = isLate ? "LATE" : "ON_TIME";
  else if (totalHours > 0) status = "ON_TIME";

  return {
    clockInTime: firstInTime,
    openClockInTime,
    clockOutTime: lastOutTime,
    totalHours,
    status,
    canClockIn: !hasOpenSession && !firstInTime,
    canClockOut: hasOpenSession,
  };
}

async function resolveAttendanceSnapshot({ tenantId, employee, dayStart, dayEnd, now = new Date() }) {
  const [row, events] = await Promise.all([
    findTodayTimesheet({
      tenantId,
      employeeId: employee.id,
      dayStart,
      dayEnd,
    }),
    findClockEventsForUser({
      tenantId,
      userId: employee.userId,
      dayStart,
      dayEnd,
    }),
  ]);
  return { row, events, attendance: extractAttendanceState({ row, events, now }) };
}

async function listHrUserIds(tenantId) {
  if (!tenantId) return [];
  const rows = await prisma.userRole.findMany({
    where: { role: { tenantId, name: { in: ["RH", "HR"] } } },
    select: { userId: true },
  });
  return Array.from(new Set(rows.map((r) => r.userId).filter(Boolean)));
}

async function notifyUsers({
  tenantId,
  actorId = null,
  userIds = [],
  type,
  title,
  body,
  data = {},
}) {
  const ids = Array.from(new Set((userIds || []).filter(Boolean)));
  if (!tenantId || !ids.length) return 0;
  const results = await Promise.allSettled(
    ids.map((userId) =>
      createInAppNotification({
        tenantId,
        userId,
        actorId,
        type,
        title,
        body,
        data,
      })
    )
  );
  return results.filter((r) => r.status === "fulfilled" && r.value).length;
}

function normalizeHolidayEvents(events = []) {
  const daySet = new Set();
  for (const ev of events) {
    const type = String(ev?.type || "").toLowerCase();
    if (!HOLIDAY_EVENT_TYPES.has(type)) continue;
    daySet.add(dateKey(ev.date));
  }
  return daySet;
}

function normalizeTimesheetRows(rows = []) {
  const byDay = new Map();
  for (const row of rows) {
    const key = dateKey(row.date);
    const prev = byDay.get(key);
    if (!prev) {
      byDay.set(key, row);
      continue;
    }
    const prevTs = new Date(prev.createdAt || prev.date).getTime();
    const nextTs = new Date(row.createdAt || row.date).getTime();
    if (nextTs >= prevTs) byDay.set(key, row);
  }
  return byDay;
}

function enumerateLeaveDays({ from, to, leaveStart, leaveEnd }) {
  const days = [];
  const start = startOfDay(leaveStart);
  const end = startOfDay(leaveEnd);
  const min = startOfDay(from);
  const max = startOfDay(to);
  const begin = start > min ? start : min;
  const finish = end < max ? end : max;
  for (let d = new Date(begin); d <= finish; d = addDays(d, 1)) {
    days.push(dateKey(d));
  }
  return days;
}

async function computeTimesheetAnomalies({
  tenantId,
  employee,
  from,
  to,
}) {
  const fromDate = startOfDay(from);
  const toDate = endOfDay(to);
  const today = startOfDay(new Date());
  const employeeName = employeeDisplayName(employee);

  const [timesheetRows, leaveRows, holidayEvents] = await Promise.all([
    prisma.timesheet.findMany({
      where: {
        tenantId,
        employeeId: employee.id,
        date: { gte: fromDate, lte: toDate },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      take: 1000,
    }),
    prisma.leave.findMany({
      where: {
        tenantId,
        employeeId: employee.id,
        AND: [{ start: { lte: toDate } }, { end: { gte: fromDate } }],
      },
      select: {
        id: true,
        start: true,
        end: true,
        status: true,
        type: true,
      },
      take: 400,
    }),
    prisma.event.findMany({
      where: {
        tenantId,
        date: { gte: fromDate, lte: toDate },
      },
      select: { id: true, date: true, type: true, title: true },
      take: 500,
    }),
  ]);

  const byDay = normalizeTimesheetRows(timesheetRows);
  const holidayDaySet = normalizeHolidayEvents(holidayEvents);
  const approvedLeaveDays = new Set();
  const pendingLeaveDays = new Set();

  for (const leave of leaveRows) {
    const dayKeys = enumerateLeaveDays({
      from: fromDate,
      to: toDate,
      leaveStart: leave.start,
      leaveEnd: leave.end,
    });
    for (const key of dayKeys) {
      const normalized = String(leave.status || "").toUpperCase();
      if (normalized === "APPROVED") approvedLeaveDays.add(key);
      else if (normalized === "PENDING") pendingLeaveDays.add(key);
    }
  }

  const items = [];
  const summary = {
    expectedDays: 0,
    enteredDays: 0,
    approvedDays: 0,
    missingDays: 0,
    anomaliesCount: 0,
    blockingCount: 0,
    bySeverity: { LOW: 0, MEDIUM: 0, HIGH: 0 },
    byCode: {},
  };

  const addAnomaly = ({
    day,
    code,
    severity = "LOW",
    title,
    detail,
    timesheetId = null,
    status = null,
    suggestedAction = null,
  }) => {
    const normalizedSeverity = ["LOW", "MEDIUM", "HIGH"].includes(String(severity || "").toUpperCase())
      ? String(severity).toUpperCase()
      : "LOW";
    const date = dateKey(day);
    const id = `${date}_${code}`;
    const ageDays = dayDiff(day, today);
    const anomaly = {
      id,
      date,
      code,
      severity: normalizedSeverity,
      ageDays,
      title,
      detail,
      timesheetId,
      status,
      suggestedAction: suggestedAction || "Corriger le pointage",
      escalationEligible: normalizedSeverity === "HIGH" && ageDays >= 2,
    };
    items.push(anomaly);
    summary.bySeverity[normalizedSeverity] = (summary.bySeverity[normalizedSeverity] || 0) + 1;
    summary.byCode[code] = (summary.byCode[code] || 0) + 1;
    if (normalizedSeverity === "HIGH") summary.blockingCount += 1;
  };

  const joinDate = employee.joinDate ? startOfDay(employee.joinDate) : null;
  const endDate = employee.endDate ? startOfDay(employee.endDate) : null;

  for (let day = new Date(fromDate); day <= toDate; day = addDays(day, 1)) {
    const key = dateKey(day);
    if (!isBusinessDay(day)) continue;
    if (joinDate && day < joinDate) continue;
    if (endDate && day > endDate) continue;
    if (holidayDaySet.has(key)) continue;
    if (approvedLeaveDays.has(key)) continue;

    summary.expectedDays += 1;
    const row = byDay.get(key);

    if (!row) {
      summary.missingDays += 1;
      const ageDays = dayDiff(day, today);
      addAnomaly({
        day,
        code: "MISSING_TIMESHEET",
        severity: ageDays >= 2 ? "HIGH" : "MEDIUM",
        title: "Journée non renseignée",
        detail: "Aucune feuille de temps n'a été soumise pour cette date ouvrée.",
        suggestedAction: "Soumettre votre pointage de la journée",
      });
      continue;
    }

    const status = String(row.status || "").toUpperCase();
    const hours = roundHours(row.hours);
    if (status === "SUBMITTED" || status === "APPROVED" || status === "IN_PROGRESS") {
      summary.enteredDays += 1;
    }
    if (status === "APPROVED") summary.approvedDays += 1;

    if (status === "REJECTED") {
      addAnomaly({
        day,
        code: "REJECTED_TIMESHEET",
        severity: "HIGH",
        title: "Feuille de temps rejetée",
        detail: "Cette journée a été rejetée et nécessite une correction.",
        timesheetId: row.id,
        status,
        suggestedAction: "Corriger puis renvoyer la feuille de temps",
      });
    } else if (status === "SUBMITTED" && dayDiff(day, today) >= 1) {
      addAnomaly({
        day,
        code: "PENDING_MANAGER_APPROVAL",
        severity: "MEDIUM",
        title: "En attente de validation manager",
        detail: "La feuille est soumise mais pas encore validée.",
        timesheetId: row.id,
        status,
        suggestedAction: "Relancer le manager si besoin",
      });
    }

    if (status === "IN_PROGRESS" && day < today) {
      addAnomaly({
        day,
        code: "INCOMPLETE_CLOCKING",
        severity: "HIGH",
        title: "Pointage incomplet",
        detail: "Entrée pointée mais sortie non finalisée sur une journée passée.",
        timesheetId: row.id,
        status,
        suggestedAction: "Finaliser la sortie ou corriger la journée",
      });
    }

    if (hours <= 0 && day < today && status !== "APPROVED") {
      addAnomaly({
        day,
        code: "ZERO_HOURS",
        severity: "MEDIUM",
        title: "Heures nulles",
        detail: "La journée est enregistrée avec 0 heure.",
        timesheetId: row.id,
        status,
        suggestedAction: "Mettre à jour les heures réellement travaillées",
      });
    }

    if (hours > 12) {
      addAnomaly({
        day,
        code: "EXCESSIVE_HOURS",
        severity: "MEDIUM",
        title: "Heures élevées",
        detail: "Le volume d'heures dépasse le seuil recommandé (12h).",
        timesheetId: row.id,
        status,
        suggestedAction: "Vérifier la saisie et demander régularisation si nécessaire",
      });
    }

    if (!row && pendingLeaveDays.has(key)) {
      addAnomaly({
        day,
        code: "PENDING_LEAVE_NO_TIMESHEET",
        severity: "LOW",
        title: "Congé en attente",
        detail: "Demande de congé non validée: surveiller la validation manager/RH.",
        suggestedAction: "Suivre le statut de la demande d'absence",
      });
    }
  }

  items.sort((a, b) => {
    const aTime = new Date(a.date).getTime();
    const bTime = new Date(b.date).getTime();
    if (aTime !== bTime) return aTime - bTime;
    return severityWeight(b.severity) - severityWeight(a.severity);
  });

  summary.anomaliesCount = items.length;

  const recommendations = [];
  if (summary.missingDays > 0) {
    recommendations.push("Compléter prioritairement les journées manquantes les plus anciennes.");
  }
  if (summary.byCode.PENDING_MANAGER_APPROVAL > 0) {
    recommendations.push("Relancer le manager pour éviter un blocage du cycle paie.");
  }
  if (summary.blockingCount > 0) {
    recommendations.push("Escalader vers RH les anomalies bloquantes si le manager est indisponible.");
  }

  return {
    employee: {
      id: employee.id,
      name: employeeName,
      managerId: employee.managerId || null,
      managerName: employee.manager ? employeeDisplayName(employee.manager) : null,
    },
    period: { from: fromDate, to: toDate },
    summary,
    items,
    recommendations,
  };
}

function resolveRangeFromQuery(query = {}) {
  const windowDaysRaw = Number(query.windowDays || query.days || 30);
  const windowDays = Number.isFinite(windowDaysRaw)
    ? Math.max(7, Math.min(120, Math.floor(windowDaysRaw)))
    : 30;
  const now = new Date();
  const to = endOfDay(query.to ? new Date(query.to) : now);
  const from = startOfDay(query.from ? new Date(query.from) : addDays(to, -(windowDays - 1)));
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return null;
  }
  return { from, to, windowDays };
}

router.get("/", async (req, res) => {
  try {
    const tid = await resolveTenantId(req);
    if (!tid) return res.status(401).json({ error: "Unauthorized" });
    const accessContext = await resolveAccessContext(req);
    const { status } = req.query;
    const where = {
      tenantId: tid,
      ...buildEmployeeScopeWhere(accessContext, { field: "employeeId" }),
      ...(status ? { status: String(status) } : {}),
    };
    const timesheets = await prisma.timesheet.findMany({ where, orderBy: { date: "desc" }, take: 500 });
    res.json({ timesheets });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/", requirePermissions(["operations_write", "self_write"], "anyOf"), async (req, res) => {
  try {
    const tid = await resolveTenantId(req);
    if (!tid) return res.status(401).json({ error: "Unauthorized" });
    const accessContext = await resolveAccessContext(req);
    const actorId = req.auth?.sub || null;
    const { employee, employeeId, date, hours, project, note, status, type, premium } = req.body || {};
    let targetEmployeeId = employeeId ? String(employeeId) : null;
    if (!targetEmployeeId && accessContext.scope === "SELF" && accessContext.viewerEmployee?.id) {
      targetEmployeeId = accessContext.viewerEmployee.id;
    }
    if ((!employee && !targetEmployeeId) || !date || hours == null) {
      return res.status(400).json({ error: "employee/employeeId, date, hours requis" });
    }
    if (accessContext.scope !== "COMPANY") {
      if (!targetEmployeeId) return res.status(400).json({ error: "employeeId requis pour votre scope" });
      if (!canAccessEmployeeId(accessContext, targetEmployeeId)) return res.status(403).json({ error: "Forbidden" });
    }
    const row = await prisma.timesheet.create({
      data: {
        tenantId: tid,
        employee: employee ? String(employee) : null,
        employeeId: targetEmployeeId || null,
        date: new Date(date),
        hours: Number(hours),
        project: project || null,
        note: note || null,
        status: status || "Submitted",
        type: String(type || "REG").toUpperCase(),
        premium: premium != null ? Number(premium) : null,
      },
    });

    await logAuditEvent({
      tenantId: tid,
      actorId,
      type: "TIMESHEET_CREATE",
      entity: "timesheet",
      entityId: row.id,
      payload: {
        employeeId: row.employeeId,
        status: row.status,
        date: row.date,
        hours: row.hours,
      },
      ip: req.ip,
      ua: req.get("user-agent"),
    });

    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Pointage employé
 * GET /operations/timesheets/clock/today
 */
router.get("/clock/today", async (req, res) => {
  try {
    const tid = await resolveTenantId(req);
    if (!tid) return res.status(401).json({ error: "Unauthorized" });
    const accessContext = await resolveAccessContext(req);

    const askedEmployeeId = req.query.employeeId ? String(req.query.employeeId) : null;
    const targetEmployeeId = askedEmployeeId || accessContext.viewerEmployee?.id || null;
    if (!targetEmployeeId) return res.status(404).json({ error: "employee_not_found" });
    if (!canAccessEmployeeId(accessContext, targetEmployeeId)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const employee = await resolveTargetEmployee({ tenantId: tid, employeeId: targetEmployeeId });
    if (!employee) return res.status(404).json({ error: "employee_not_found" });

    const now = new Date();
    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);
    const { attendance, row } = await resolveAttendanceSnapshot({
      tenantId: tid,
      employee,
      dayStart,
      dayEnd,
      now,
    });

    return res.json({
      date: dayStart,
      attendance,
      timesheetId: row?.id || null,
      employee: {
        id: employee.id,
        name: employeeDisplayName(employee),
      },
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.post(
  "/clock/in",
  requirePermissions(["self_write", "operations_write"], "anyOf"),
  async (req, res) => {
    try {
      const tid = await resolveTenantId(req);
      const actorId = req.auth?.sub || null;
      if (!tid || !actorId) return res.status(401).json({ error: "Unauthorized" });
      const accessContext = await resolveAccessContext(req);

      const askedEmployeeId = req.body?.employeeId ? String(req.body.employeeId) : null;
      const targetEmployeeId = askedEmployeeId || accessContext.viewerEmployee?.id || null;
      if (!targetEmployeeId) return res.status(404).json({ error: "employee_not_found" });
      if (!canAccessEmployeeId(accessContext, targetEmployeeId)) return res.status(403).json({ error: "Forbidden" });

      const employee = await resolveTargetEmployee({ tenantId: tid, employeeId: targetEmployeeId });
      if (!employee) return res.status(404).json({ error: "employee_not_found" });
      if (!employee.userId) return res.status(400).json({ error: "employee_user_not_linked" });

      const now = new Date();
      const dayStart = startOfDay(now);
      const dayEnd = endOfDay(now);
      const { attendance, row } = await resolveAttendanceSnapshot({
        tenantId: tid,
        employee,
        dayStart,
        dayEnd,
        now,
      });

      if (attendance.canClockIn === false) {
        return res.status(409).json({ error: "already_clocked_in_or_completed_today" });
      }

      const updated = row
        ? await prisma.timesheet.update({
            where: { id: row.id },
            data: {
              status: "IN_PROGRESS",
              type: row.type || "REG",
              project: row.project || "POINTAGE",
              employee: row.employee || employeeDisplayName(employee),
            },
          })
        : await prisma.timesheet.create({
            data: {
              tenantId: tid,
              employeeId: employee.id,
              employee: employeeDisplayName(employee),
              date: dayStart,
              hours: 0,
              project: "POINTAGE",
              status: "IN_PROGRESS",
              type: "REG",
            },
          });

      await logAuditEvent({
        tenantId: tid,
        actorId: employee.userId,
        type: "CLOCK_IN",
        entity: "attendance",
        entityId: employee.id,
        payload: {
          requestedByUserId: actorId,
          employeeId: employee.id,
          timesheetId: updated.id,
          clockInAt: now.toISOString(),
          source: String(req.body?.source || "WEB_APP"),
          geo: req.body?.geo || null,
        },
        ip: req.ip,
        ua: req.get("user-agent"),
      });

      const refreshed = await resolveAttendanceSnapshot({
        tenantId: tid,
        employee,
        dayStart,
        dayEnd,
        now,
      });

      return res.status(201).json({
        ok: true,
        attendance: refreshed.attendance,
        timesheetId: updated.id,
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
);

router.post(
  "/clock/out",
  requirePermissions(["self_write", "operations_write"], "anyOf"),
  async (req, res) => {
    try {
      const tid = await resolveTenantId(req);
      const actorId = req.auth?.sub || null;
      if (!tid || !actorId) return res.status(401).json({ error: "Unauthorized" });
      const accessContext = await resolveAccessContext(req);

      const askedEmployeeId = req.body?.employeeId ? String(req.body.employeeId) : null;
      const targetEmployeeId = askedEmployeeId || accessContext.viewerEmployee?.id || null;
      if (!targetEmployeeId) return res.status(404).json({ error: "employee_not_found" });
      if (!canAccessEmployeeId(accessContext, targetEmployeeId)) return res.status(403).json({ error: "Forbidden" });

      const employee = await resolveTargetEmployee({ tenantId: tid, employeeId: targetEmployeeId });
      if (!employee) return res.status(404).json({ error: "employee_not_found" });
      if (!employee.userId) return res.status(400).json({ error: "employee_user_not_linked" });

      const now = new Date();
      const dayStart = startOfDay(now);
      const dayEnd = endOfDay(now);
      const { attendance, row } = await resolveAttendanceSnapshot({
        tenantId: tid,
        employee,
        dayStart,
        dayEnd,
        now,
      });

      if (!attendance.canClockOut || !attendance.openClockInTime) {
        return res.status(400).json({ error: "clock_in_required_before_clock_out" });
      }

      const workedHours = roundHours(
        (now.getTime() - attendance.openClockInTime.getTime()) / 3600000
      );

      const updated = row
        ? await prisma.timesheet.update({
            where: { id: row.id },
            data: {
              hours: workedHours,
              status: "Submitted",
              project: row.project || "POINTAGE",
              employee: row.employee || employeeDisplayName(employee),
            },
          })
        : await prisma.timesheet.create({
            data: {
              tenantId: tid,
              employeeId: employee.id,
              employee: employeeDisplayName(employee),
              date: dayStart,
              hours: workedHours,
              project: "POINTAGE",
              status: "Submitted",
              type: "REG",
            },
          });

      await logAuditEvent({
        tenantId: tid,
        actorId: employee.userId,
        type: "CLOCK_OUT",
        entity: "attendance",
        entityId: employee.id,
        payload: {
          requestedByUserId: actorId,
          employeeId: employee.id,
          timesheetId: updated.id,
          clockInAt: attendance.openClockInTime.toISOString(),
          clockOutAt: now.toISOString(),
          totalHours: workedHours,
          source: String(req.body?.source || "WEB_APP"),
          geo: req.body?.geo || null,
        },
        ip: req.ip,
        ua: req.get("user-agent"),
      });

      const refreshed = await resolveAttendanceSnapshot({
        tenantId: tid,
        employee,
        dayStart,
        dayEnd,
        now,
      });

      return res.json({
        ok: true,
        attendance: refreshed.attendance,
        timesheetId: updated.id,
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
);

/**
 * Anomalies RH du temps de travail
 * GET /operations/timesheets/anomalies/self
 */
router.get("/anomalies/self", async (req, res) => {
  try {
    const tid = await resolveTenantId(req);
    if (!tid) return res.status(401).json({ error: "Unauthorized" });
    const accessContext = await resolveAccessContext(req);
    if (!accessContext.viewerEmployee?.id) return res.status(404).json({ error: "employee_not_found" });

    const range = resolveRangeFromQuery(req.query);
    if (!range) return res.status(400).json({ error: "invalid_period" });

    const employee = await resolveTargetEmployee({
      tenantId: tid,
      employeeId: accessContext.viewerEmployee.id,
    });
    if (!employee) return res.status(404).json({ error: "employee_not_found" });

    const payload = await computeTimesheetAnomalies({
      tenantId: tid,
      employee,
      from: range.from,
      to: range.to,
    });
    return res.json(payload);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

/**
 * GET /operations/timesheets/anomalies
 * scope-aware (self/team/company)
 */
router.get("/anomalies", async (req, res) => {
  try {
    const tid = await resolveTenantId(req);
    if (!tid) return res.status(401).json({ error: "Unauthorized" });
    const accessContext = await resolveAccessContext(req);
    const range = resolveRangeFromQuery(req.query);
    if (!range) return res.status(400).json({ error: "invalid_period" });

    const askedEmployeeId = req.query.employeeId ? String(req.query.employeeId) : null;
    const targetEmployeeId = askedEmployeeId || accessContext.viewerEmployee?.id || null;
    if (!targetEmployeeId) return res.status(400).json({ error: "employeeId requis" });
    if (!canAccessEmployeeId(accessContext, targetEmployeeId)) return res.status(403).json({ error: "Forbidden" });

    const employee = await resolveTargetEmployee({ tenantId: tid, employeeId: targetEmployeeId });
    if (!employee) return res.status(404).json({ error: "employee_not_found" });

    const payload = await computeTimesheetAnomalies({
      tenantId: tid,
      employee,
      from: range.from,
      to: range.to,
    });
    return res.json(payload);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

/**
 * Relance workflow
 * POST /operations/timesheets/anomalies/remind
 * body: { employeeId?, audience?: EMPLOYEE|MANAGER|RH|ALL, copyHr?: boolean, reason?: string, windowDays?: number }
 */
router.post(
  "/anomalies/remind",
  requirePermissions(["self_write", "team_write", "approvals_write", "admin_read", "operations_write"], "anyOf"),
  async (req, res) => {
    try {
      const tid = await resolveTenantId(req);
      const actorId = req.auth?.sub || null;
      if (!tid || !actorId) return res.status(401).json({ error: "Unauthorized" });
      const accessContext = await resolveAccessContext(req);

      const range = resolveRangeFromQuery({
        windowDays: req.body?.windowDays || req.query?.windowDays || 30,
      });
      if (!range) return res.status(400).json({ error: "invalid_period" });

      const askedEmployeeId = req.body?.employeeId ? String(req.body.employeeId) : null;
      const targetEmployeeId = askedEmployeeId || accessContext.viewerEmployee?.id || null;
      if (!targetEmployeeId) return res.status(400).json({ error: "employeeId requis" });
      if (!canAccessEmployeeId(accessContext, targetEmployeeId)) return res.status(403).json({ error: "Forbidden" });

      const employee = await resolveTargetEmployee({ tenantId: tid, employeeId: targetEmployeeId });
      if (!employee) return res.status(404).json({ error: "employee_not_found" });

      const anomalies = await computeTimesheetAnomalies({
        tenantId: tid,
        employee,
        from: range.from,
        to: range.to,
      });

      const audienceRaw = String(req.body?.audience || "").toUpperCase();
      const audience =
        ["EMPLOYEE", "MANAGER", "RH", "ALL"].includes(audienceRaw)
          ? audienceRaw
          : accessContext.scope === "SELF"
          ? "MANAGER"
          : "EMPLOYEE";

      const employeeUserId = employee.userId || null;
      const managerUserId = employee.manager?.userId || null;
      const hrUserIds = await listHrUserIds(tid);

      let userIds = [];
      if (audience === "EMPLOYEE") userIds = employeeUserId ? [employeeUserId] : [];
      if (audience === "MANAGER") userIds = managerUserId ? [managerUserId] : [];
      if (audience === "RH") userIds = hrUserIds;
      if (audience === "ALL") {
        userIds = [
          ...(employeeUserId ? [employeeUserId] : []),
          ...(managerUserId ? [managerUserId] : []),
          ...hrUserIds,
        ];
      }
      if (req.body?.copyHr === true) userIds = [...userIds, ...hrUserIds];
      userIds = Array.from(new Set(userIds.filter((id) => id && id !== actorId)));

      if (!userIds.length) return res.status(400).json({ error: "Aucun destinataire éligible." });

      const reminderReason = String(req.body?.reason || "").trim() || "Relance cycle temps";
      const notified = await notifyUsers({
        tenantId: tid,
        actorId,
        userIds,
        type: "TIMESHEET_ANOMALY_REMINDER",
        title: "Relance temps & présence",
        body: `${employeeDisplayName(employee)}: ${anomalies.summary.anomaliesCount} anomalie(s), ${anomalies.summary.blockingCount} bloquante(s).`,
        data: {
          employeeId: employee.id,
          audience,
          reason: reminderReason,
          summary: anomalies.summary,
        },
      });

      await logAuditEvent({
        tenantId: tid,
        actorId,
        type: "TIMESHEET_ANOMALY_REMINDER",
        entity: "timesheet",
        entityId: employee.id,
        payload: {
          audience,
          reason: reminderReason,
          summary: anomalies.summary,
          notified,
        },
        ip: req.ip,
        ua: req.get("user-agent"),
      });

      return res.json({ ok: true, audience, notified, summary: anomalies.summary });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
);

/**
 * Escalade RH
 * POST /operations/timesheets/anomalies/escalate-to-hr
 * body: { employeeId?, reason?, windowDays? }
 */
router.post(
  "/anomalies/escalate-to-hr",
  requirePermissions(["self_write", "team_write", "approvals_write", "admin_read", "operations_write"], "anyOf"),
  async (req, res) => {
    try {
      const tid = await resolveTenantId(req);
      const actorId = req.auth?.sub || null;
      if (!tid || !actorId) return res.status(401).json({ error: "Unauthorized" });
      const accessContext = await resolveAccessContext(req);

      const range = resolveRangeFromQuery({
        windowDays: req.body?.windowDays || req.query?.windowDays || 30,
      });
      if (!range) return res.status(400).json({ error: "invalid_period" });

      const askedEmployeeId = req.body?.employeeId ? String(req.body.employeeId) : null;
      const targetEmployeeId = askedEmployeeId || accessContext.viewerEmployee?.id || null;
      if (!targetEmployeeId) return res.status(400).json({ error: "employeeId requis" });
      if (!canAccessEmployeeId(accessContext, targetEmployeeId)) return res.status(403).json({ error: "Forbidden" });

      const employee = await resolveTargetEmployee({ tenantId: tid, employeeId: targetEmployeeId });
      if (!employee) return res.status(404).json({ error: "employee_not_found" });

      const anomalies = await computeTimesheetAnomalies({
        tenantId: tid,
        employee,
        from: range.from,
        to: range.to,
      });

      const reason = String(req.body?.reason || "").trim() || "Manager indisponible / risque paie";
      const hrUserIds = await listHrUserIds(tid);
      const notified = await notifyUsers({
        tenantId: tid,
        actorId,
        userIds: hrUserIds.filter((id) => id !== actorId),
        type: "TIMESHEET_ANOMALY_ESCALATED",
        title: "Escalade RH - temps & présence",
        body: `${employeeDisplayName(employee)}: intervention RH demandée (${anomalies.summary.blockingCount} bloquante(s)).`,
        data: {
          employeeId: employee.id,
          reason,
          summary: anomalies.summary,
        },
      });

      await logAuditEvent({
        tenantId: tid,
        actorId,
        type: "TIMESHEET_ANOMALY_ESCALATE_HR",
        entity: "timesheet",
        entityId: employee.id,
        payload: { reason, notified, summary: anomalies.summary },
        ip: req.ip,
        ua: req.get("user-agent"),
      });

      return res.json({ ok: true, notified, summary: anomalies.summary });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
);

async function updateTimesheet(req, res) {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const { status, type, premium } = body;
    const tid = await resolveTenantId(req);
    if (!tid) return res.status(401).json({ error: "Unauthorized" });
    const accessContext = await resolveAccessContext(req);
    const actorId = req.auth?.sub || null;
    const canManageWorkflowFields = hasAnyPermission(accessContext.permissions, ["operations_write", "all"]);
    const contentFieldRequested = ["date", "hours", "project", "note"].some((field) =>
      Object.prototype.hasOwnProperty.call(body, field)
    );
    const workflowFieldRequested = ["status", "type", "premium"].some((field) =>
      Object.prototype.hasOwnProperty.call(body, field)
    );
    if (!contentFieldRequested && !workflowFieldRequested) {
      return res.status(400).json({ error: "Aucun champ modifiable transmis" });
    }
    if (workflowFieldRequested && !canManageWorkflowFields) {
      return res.status(403).json({ error: "Modification du statut réservée aux opérations RH" });
    }
    const found = await prisma.timesheet.findFirst({
      where: { id, tenantId: tid },
      select: {
        id: true,
        status: true,
        type: true,
        premium: true,
        employeeId: true,
        date: true,
        hours: true,
        project: true,
        note: true,
      },
    });
    if (!found) return res.status(404).json({ error: "Feuille de temps introuvable" });
    if (accessContext.scope !== "COMPANY") {
      if (!found.employeeId || !canAccessEmployeeId(accessContext, found.employeeId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const normalizedCurrentStatus = String(found.status || "").toUpperCase();
    if (!canManageWorkflowFields && contentFieldRequested && normalizedCurrentStatus === "APPROVED") {
      return res.status(409).json({
        error: "approved_timesheet_locked",
        message: "Cette feuille a déjà été validée et ne peut plus être modifiée depuis l'espace employé.",
      });
    }

    const updateData = {};
    if (Object.prototype.hasOwnProperty.call(body, "date")) {
      const parsedDate = asDate(body.date);
      if (!parsedDate) return res.status(400).json({ error: "Date invalide" });
      updateData.date = startOfDay(parsedDate);
    }
    if (Object.prototype.hasOwnProperty.call(body, "hours")) {
      const parsedHours = Number(body.hours);
      if (!Number.isFinite(parsedHours) || parsedHours < 0) {
        return res.status(400).json({ error: "Le nombre d'heures est invalide" });
      }
      updateData.hours = roundHours(parsedHours);
    }
    if (Object.prototype.hasOwnProperty.call(body, "project")) {
      updateData.project = String(body.project || "").trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(body, "note")) {
      updateData.note = String(body.note || "").trim() || null;
    }

    if (canManageWorkflowFields) {
      if (Object.prototype.hasOwnProperty.call(body, "status")) {
        updateData.status = status == null ? null : String(status);
      }
      if (Object.prototype.hasOwnProperty.call(body, "type")) {
        updateData.type = type == null ? null : String(type).toUpperCase();
      }
      if (Object.prototype.hasOwnProperty.call(body, "premium")) {
        updateData.premium = premium == null ? null : Number(premium);
      }
    } else if (contentFieldRequested && ["REJECTED", "IN_PROGRESS"].includes(normalizedCurrentStatus)) {
      updateData.status = "Submitted";
    }

    if (!Object.keys(updateData).length) {
      return res.status(400).json({ error: "Aucune mise à jour applicable" });
    }

    const row = await prisma.timesheet.update({
      where: { id },
      data: updateData,
    });

    await logAuditEvent({
      tenantId: tid,
      actorId,
      type:
        workflowFieldRequested && !contentFieldRequested
          ? "TIMESHEET_STATUS_CHANGE"
          : "TIMESHEET_UPDATE",
      entity: "timesheet",
      entityId: row.id,
      payload: {
        employeeId: row.employeeId || found.employeeId || null,
        fromStatus: found.status,
        toStatus: row.status,
        fromType: found.type,
        toType: row.type,
        fromPremium: found.premium,
        toPremium: row.premium,
        fromDate: found.date,
        toDate: row.date,
        fromHours: found.hours,
        toHours: row.hours,
        fromProject: found.project,
        toProject: row.project,
        fromNote: found.note,
        toNote: row.note,
      },
      ip: req.ip,
      ua: req.get("user-agent"),
    });

    return res.json(row);
  } catch (e) {
    if (e?.code === "P2002") {
      return res.status(409).json({
        error: "timesheet_duplicate_for_day",
        message: "Une autre feuille de temps existe déjà pour cette date.",
      });
    }
    return res.status(500).json({ error: e.message });
  }
}

router.put(
  "/:id",
  requirePermissions(["operations_write", "self_write", "team_write", "approvals_write", "all"], "anyOf"),
  updateTimesheet
);
router.put("/:id/status", requirePermissions(["operations_write"], "anyOf"), updateTimesheet);

router.delete("/:id", requirePermissions(["operations_write"], "anyOf"), async (req, res) => {
  try {
    const { id } = req.params;
    const tid = await resolveTenantId(req);
    if (!tid) return res.status(401).json({ error: "Unauthorized" });
    const accessContext = await resolveAccessContext(req);
    const actorId = req.auth?.sub || null;
    const found = await prisma.timesheet.findFirst({
      where: { id, tenantId: tid },
      select: { id: true, status: true, employeeId: true, date: true, hours: true },
    });
    if (!found) return res.status(404).json({ error: "Feuille de temps introuvable" });
    if (accessContext.scope !== "COMPANY") {
      if (!found.employeeId || !canAccessEmployeeId(accessContext, found.employeeId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }
    await prisma.timesheet.delete({ where: { id } });

    await logAuditEvent({
      tenantId: tid,
      actorId,
      type: "TIMESHEET_DELETE",
      entity: "timesheet",
      entityId: found.id,
      payload: {
        employeeId: found.employeeId,
        status: found.status,
        date: found.date,
        hours: found.hours,
      },
      ip: req.ip,
      ua: req.get("user-agent"),
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

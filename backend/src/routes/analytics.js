import express from "express";
import { prisma } from "../prisma.js";
import { requirePermissions } from "../rbac.js";

const router = express.Router();

const ANALYTICS_PERMS = ["analytics_read", "team_read", "admin_read", "all"];
const HR_REQUEST_CLOSED = new Set(["APPROVED", "REJECTED", "CANCELED", "CLOSED"]);
const HR_REQUEST_OPEN = new Set(["DRAFT", "SUBMITTED", "PENDING_MANAGER", "PENDING_HR"]);
const ENROLLMENT_COMPLETED = new Set(["completed", "present"]);
const GOAL_RISK_STATUSES = new Set(["off_track", "at_risk", "late"]);

const safeFindMany = async (fn) => {
  try {
    return await fn();
  } catch {
    return [];
  }
};

const safeCount = async (fn) => {
  try {
    return await fn();
  } catch {
    return 0;
  }
};

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
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

function startOfMonth(input = new Date()) {
  return new Date(input.getFullYear(), input.getMonth(), 1);
}

function monthKey(input) {
  const d = new Date(input);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function dateKey(input) {
  const d = new Date(input);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function businessDaysBetweenInclusive(from, to) {
  const start = startOfDay(from);
  const end = startOfDay(to);
  if (end < start) return 0;
  let count = 0;
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    const wd = d.getDay();
    if (wd >= 1 && wd <= 5) count += 1;
  }
  return count;
}

function overlapBusinessDays(from, to, rangeStart, rangeEnd) {
  if (!from || !to) return 0;
  const start = startOfDay(from);
  const end = startOfDay(to);
  const rs = startOfDay(rangeStart);
  const re = startOfDay(rangeEnd);
  if (end < rs || start > re) return 0;
  const overlapStart = start > rs ? start : rs;
  const overlapEnd = end < re ? end : re;
  return businessDaysBetweenInclusive(overlapStart, overlapEnd);
}

function safePct(numerator, denominator) {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function safeAvg(sum, count) {
  if (!count) return 0;
  return Number((sum / count).toFixed(2));
}

function parseMonths(input) {
  const n = Number(input);
  if (!Number.isFinite(n)) return 6;
  return Math.min(24, Math.max(3, Math.round(n)));
}

function buildMonths(referenceDate, monthsCount) {
  const now = new Date(referenceDate);
  const buckets = [];
  for (let i = monthsCount - 1; i >= 0; i -= 1) {
    const start = startOfMonth(new Date(now.getFullYear(), now.getMonth() - i, 1));
    const endExclusive = startOfMonth(new Date(start.getFullYear(), start.getMonth() + 1, 1));
    const endInclusive = addDays(endExclusive, -1);
    buckets.push({
      key: monthKey(start),
      label: monthKey(start),
      start,
      endExclusive,
      endInclusive,
      businessDays: businessDaysBetweenInclusive(start, endInclusive),
    });
  }
  return buckets;
}

function isEmployeeActiveOn(employee, date) {
  const d = startOfDay(date);
  const status = String(employee?.status || "ACTIVE").toUpperCase();
  const statusOk = status !== "INACTIVE";
  const joinOk = !employee?.joinDate || startOfDay(employee.joinDate) <= d;
  const endOk = !employee?.endDate || startOfDay(employee.endDate) >= d;
  return statusOk && joinOk && endOk;
}

function isGoalAtRisk(goal, now) {
  const status = String(goal?.status || "").toLowerCase();
  if (GOAL_RISK_STATUSES.has(status)) return true;
  const progress = toNumber(goal?.progress, 0);
  if (progress >= 100) return false;
  if (goal?.endDate && new Date(goal.endDate) < now && progress < 100) return true;
  return progress < 40;
}

function resolveTenantId(req) {
  return req.auth?.tid || null;
}

router.get(
  "/hr/overview",
  requirePermissions(ANALYTICS_PERMS, "anyOf"),
  async (req, res) => {
    try {
      const tenantId = resolveTenantId(req);
      if (!tenantId) return res.status(401).json({ error: "Unauthorized" });

      const monthsCount = parseMonths(req.query.months);
      const now = new Date();
      const todayStart = startOfDay(now);
      const last30Start = addDays(todayStart, -30);
      const last90Start = addDays(todayStart, -90);
      const months = buildMonths(now, monthsCount);
      const firstMonthStart = months[0]?.start || startOfMonth(now);

      const [
        employees,
        leaves,
        timesheets,
        hrRequests,
        goals,
        interviews,
        enrollments,
        documents,
        leaveActionLogs,
        pendingLeaves,
        pendingExpenses,
      ] = await Promise.all([
        safeFindMany(() =>
          prisma.employee.findMany({
            where: { tenantId },
            select: {
              id: true,
              status: true,
              contractType: true,
              joinDate: true,
              endDate: true,
              phone: true,
              department: true,
              position: true,
              cnss: true,
              ipres: true,
            },
          })
        ),
        safeFindMany(() =>
          prisma.leave.findMany({
            where: {
              tenantId,
              OR: [{ start: { gte: firstMonthStart } }, { end: { gte: firstMonthStart } }],
            },
            select: {
              id: true,
              employeeId: true,
              type: true,
              status: true,
              createdAt: true,
              start: true,
              end: true,
            },
          })
        ),
        safeFindMany(() =>
          prisma.timesheet.findMany({
            where: { tenantId, date: { gte: firstMonthStart } },
            select: {
              id: true,
              employee: true,
              employeeId: true,
              date: true,
              hours: true,
              premium: true,
              status: true,
            },
          })
        ),
        safeFindMany(() =>
          prisma.hrRequest.findMany({
            where: { tenantId, createdAt: { gte: firstMonthStart } },
            select: {
              id: true,
              type: true,
              status: true,
              createdAt: true,
              submittedAt: true,
              resolvedAt: true,
              slaDueAt: true,
            },
          })
        ),
        safeFindMany(() =>
          prisma.goal.findMany({
            where: { tenantId },
            select: {
              id: true,
              status: true,
              progress: true,
              endDate: true,
              updatedAt: true,
            },
          })
        ),
        safeFindMany(() =>
          prisma.interview.findMany({
            where: { tenantId },
            select: {
              id: true,
              status: true,
              scheduledAt: true,
              completedAt: true,
              createdAt: true,
            },
          })
        ),
        safeFindMany(() =>
          prisma.enrollment.findMany({
            where: { tenantId, createdAt: { gte: firstMonthStart } },
            select: {
              id: true,
              employeeId: true,
              status: true,
              createdAt: true,
            },
          })
        ),
        safeFindMany(() =>
          prisma.document.findMany({
            where: { tenantId },
            select: {
              id: true,
              employeeId: true,
              type: true,
            },
          })
        ),
        safeFindMany(() =>
          prisma.leaveActionLog.findMany({
            where: {
              tenantId,
              action: { in: ["APPROVE", "REJECT", "APPROVED", "REJECTED"] },
              createdAt: { gte: firstMonthStart },
            },
            select: { leaveId: true, createdAt: true },
          })
        ),
        safeCount(() => prisma.leave.count({ where: { tenantId, status: "Pending" } })),
        safeCount(() =>
          prisma.expense.count({
            where: { tenantId, status: { in: ["Submitted", "Pending"] } },
          })
        ),
      ]);

      const employeeById = new Map(employees.map((e) => [e.id, e]));
      const totalEmployees = employees.length;

      const docsByEmployee = documents.reduce((acc, d) => {
        if (!d.employeeId) return acc;
        if (!acc[d.employeeId]) acc[d.employeeId] = [];
        acc[d.employeeId].push(String(d.type || "").toUpperCase());
        return acc;
      }, {});

      const completeProfileCount = employees.filter(
        (e) => e.phone && e.department && e.position && e.cnss && e.ipres
      ).length;
      const profileCompletenessPercent = safePct(completeProfileCount, totalEmployees || 1);

      const mandatoryDocCoverageCount = employees.filter((e) => {
        const types = docsByEmployee[e.id] || [];
        const hasId = types.some((t) => t.includes("ID"));
        const hasContract = types.some((t) => t.includes("CONTRACT"));
        return hasId && hasContract;
      }).length;
      const mandatoryDocumentCoveragePercent = safePct(
        mandatoryDocCoverageCount,
        totalEmployees || 1
      );

      const goalAtRiskCount = goals.filter((g) => isGoalAtRisk(g, now)).length;
      const goalsAtRiskPercent = safePct(goalAtRiskCount, goals.length || 1);

      const enrollments90d = enrollments.filter(
        (e) =>
          new Date(e.createdAt) >= last90Start &&
          ENROLLMENT_COMPLETED.has(String(e.status || "").toLowerCase())
      );
      const trainedEmployees90Set = new Set(
        enrollments90d.map((e) => e.employeeId).filter(Boolean)
      );

      const activeEmployeesNow = employees.filter((e) => isEmployeeActiveOn(e, todayStart));
      const activeHeadcount = activeEmployeesNow.length;

      const trainingParticipation90dPercent = safePct(
        trainedEmployees90Set.size,
        activeHeadcount || 1
      );

      const interviews90 = interviews.filter(
        (i) => i.scheduledAt && new Date(i.scheduledAt) >= last90Start
      );
      const interviewsDone90 = interviews.filter(
        (i) =>
          String(i.status || "").toUpperCase() === "DONE" &&
          ((i.completedAt && new Date(i.completedAt) >= last90Start) ||
            (i.scheduledAt && new Date(i.scheduledAt) >= last90Start))
      );
      const interviewCompletion90dPercent = safePct(
        interviewsDone90.length,
        interviews90.length || 1
      );

      const leaveByIdCreatedAt = new Map(leaves.map((l) => [l.id, l.createdAt]));
      const leaveDecisionLast30 = leaveActionLogs.filter(
        (log) => new Date(log.createdAt) >= last30Start
      );
      const leaveValidationHours30 = leaveDecisionLast30.reduce((acc, log) => {
        const createdAt = leaveByIdCreatedAt.get(log.leaveId);
        if (!createdAt) return acc;
        const diffHours =
          (new Date(log.createdAt).getTime() - new Date(createdAt).getTime()) / 3600000;
        return acc + Math.max(0, diffHours);
      }, 0);
      const avgLeaveValidationHours30d = safeAvg(
        leaveValidationHours30,
        leaveDecisionLast30.length
      );

      const closedHr30 = hrRequests.filter((r) => {
        if (!r.resolvedAt) return false;
        const resolvedAt = new Date(r.resolvedAt);
        if (resolvedAt < last30Start) return false;
        return HR_REQUEST_CLOSED.has(String(r.status || "").toUpperCase());
      });
      const hrResolutionHours30 = closedHr30.reduce((acc, r) => {
        const fromDate = r.submittedAt || r.createdAt;
        const diffHours =
          (new Date(r.resolvedAt).getTime() - new Date(fromDate).getTime()) / 3600000;
        return acc + Math.max(0, diffHours);
      }, 0);
      const avgHrRequestResolutionHours30d = safeAvg(
        hrResolutionHours30,
        closedHr30.length
      );
      const closedWithSla = closedHr30.filter((r) => r.slaDueAt);
      const withinSla = closedWithSla.filter(
        (r) => new Date(r.resolvedAt).getTime() <= new Date(r.slaDueAt).getTime()
      );
      const hrRequestSla30dPercent = safePct(
        withinSla.length,
        closedWithSla.length || closedHr30.length || 1
      );

      const approvedLeaves30 = leaves.filter((l) => {
        const status = String(l.status || "");
        if (status !== "Approved") return false;
        return new Date(l.end) >= last30Start && new Date(l.start) <= todayStart;
      });
      const absenceDays30 = approvedLeaves30.reduce((acc, l) => {
        return acc + overlapBusinessDays(l.start, l.end, last30Start, todayStart);
      }, 0);
      const denomAbsence30 = activeHeadcount * businessDaysBetweenInclusive(last30Start, todayStart);
      const absenceRate30dPercent = safePct(absenceDays30, denomAbsence30 || 1);

      const timesheet30 = timesheets.filter((t) => new Date(t.date) >= last30Start);
      const timesheetDays30Set = new Set(
        timesheet30
          .filter((t) => toNumber(t.hours, 0) > 0)
          .map((t) => `${t.employeeId || t.employee || "unk"}|${dateKey(t.date)}`)
      );
      const expectedDays30 = activeEmployeesNow.reduce((acc, e) => {
        const empStart = e.joinDate ? startOfDay(e.joinDate) : last30Start;
        const empEnd = e.endDate ? startOfDay(e.endDate) : todayStart;
        return acc + overlapBusinessDays(empStart, empEnd, last30Start, todayStart);
      }, 0);
      const timesheetCompliance30dPercent = safePct(
        timesheetDays30Set.size,
        expectedDays30 || 1
      );

      const overtimeHours30 = Number(
        timesheet30.reduce((acc, row) => {
          if (row.premium != null) return acc + toNumber(row.premium, 0);
          return acc + Math.max(0, toNumber(row.hours, 0) - 8);
        }, 0).toFixed(2)
      );

      const last12Start = addDays(todayStart, -365);
      const leavers12m = employees.filter(
        (e) => e.endDate && new Date(e.endDate) >= last12Start && new Date(e.endDate) <= todayStart
      ).length;
      const months12 = buildMonths(now, 12);
      const avgHeadcount12m = safeAvg(
        months12.reduce((acc, m) => {
          const monthEndHeadcount = employees.filter((e) =>
            isEmployeeActiveOn(e, m.endInclusive)
          ).length;
          return acc + monthEndHeadcount;
        }, 0),
        months12.length
      );
      const turnover12mPercent = safePct(leavers12m, avgHeadcount12m || 1);

      const pendingHrRequests = hrRequests.filter((r) =>
        HR_REQUEST_OPEN.has(String(r.status || "").toUpperCase())
      ).length;

      const requestsByTypeMap = hrRequests.reduce((acc, r) => {
        const key = String(r.type || "OTHER").toUpperCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      const leaveByTypeMap = leaves.reduce((acc, l) => {
        const key = String(l.type || "OTHER").toUpperCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      const contractTypeMap = employees.reduce((acc, e) => {
        const key = String(e.contractType || "UNKNOWN").toUpperCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      const series = {
        headcount: [],
        hires: [],
        leavers: [],
        absenceRate: [],
        timesheetCompliance: [],
        overtimeHours: [],
        requestsSubmitted: [],
        requestsSla: [],
        trainingParticipation: [],
        interviewCompletion: [],
        goalsAtRisk: [],
      };

      for (const m of months) {
        const monthLeaves = leaves.filter(
          (l) => new Date(l.end) >= m.start && new Date(l.start) <= m.endInclusive
        );
        const approvedMonthLeaves = monthLeaves.filter((l) => String(l.status) === "Approved");
        const monthAbsenceDays = approvedMonthLeaves.reduce(
          (acc, l) => acc + overlapBusinessDays(l.start, l.end, m.start, m.endInclusive),
          0
        );

        const activeAtMonthEnd = employees.filter((e) => isEmployeeActiveOn(e, m.endInclusive));
        const activeAtMonthStart = employees.filter((e) => isEmployeeActiveOn(e, m.start));
        const avgMonthHeadcount =
          (activeAtMonthEnd.length + activeAtMonthStart.length) / 2 || 1;

        const monthHires = employees.filter(
          (e) => e.joinDate && new Date(e.joinDate) >= m.start && new Date(e.joinDate) < m.endExclusive
        ).length;
        const monthLeavers = employees.filter(
          (e) => e.endDate && new Date(e.endDate) >= m.start && new Date(e.endDate) < m.endExclusive
        ).length;

        const monthTimes = timesheets.filter(
          (t) => new Date(t.date) >= m.start && new Date(t.date) < m.endExclusive
        );
        const monthWorkedDaysSet = new Set(
          monthTimes
            .filter((t) => toNumber(t.hours, 0) > 0)
            .map((t) => `${t.employeeId || t.employee || "unk"}|${dateKey(t.date)}`)
        );
        const expectedMonthDays = activeAtMonthEnd.reduce((acc, e) => {
          const empStart = e.joinDate ? startOfDay(e.joinDate) : m.start;
          const empEnd = e.endDate ? startOfDay(e.endDate) : m.endInclusive;
          return acc + overlapBusinessDays(empStart, empEnd, m.start, m.endInclusive);
        }, 0);
        const monthOvertime = Number(
          monthTimes.reduce((acc, t) => {
            if (t.premium != null) return acc + toNumber(t.premium, 0);
            return acc + Math.max(0, toNumber(t.hours, 0) - 8);
          }, 0).toFixed(2)
        );

        const monthRequests = hrRequests.filter(
          (r) => new Date(r.createdAt) >= m.start && new Date(r.createdAt) < m.endExclusive
        );
        const monthClosed = hrRequests.filter(
          (r) =>
            r.resolvedAt &&
            new Date(r.resolvedAt) >= m.start &&
            new Date(r.resolvedAt) < m.endExclusive &&
            HR_REQUEST_CLOSED.has(String(r.status || "").toUpperCase())
        );
        const monthClosedWithSla = monthClosed.filter((r) => r.slaDueAt);
        const monthWithinSla = monthClosedWithSla.filter(
          (r) => new Date(r.resolvedAt).getTime() <= new Date(r.slaDueAt).getTime()
        );

        const monthEnrollmentsDone = enrollments.filter(
          (e) =>
            new Date(e.createdAt) >= m.start &&
            new Date(e.createdAt) < m.endExclusive &&
            ENROLLMENT_COMPLETED.has(String(e.status || "").toLowerCase())
        );
        const monthTrainedEmployees = new Set(
          monthEnrollmentsDone.map((e) => e.employeeId).filter(Boolean)
        );

        const monthInterviewsPlanned = interviews.filter(
          (i) => i.scheduledAt && new Date(i.scheduledAt) >= m.start && new Date(i.scheduledAt) < m.endExclusive
        );
        const monthInterviewsDone = interviews.filter(
          (i) =>
            String(i.status || "").toUpperCase() === "DONE" &&
            i.completedAt &&
            new Date(i.completedAt) >= m.start &&
            new Date(i.completedAt) < m.endExclusive
        );

        const monthGoalRisk = goals.filter((g) => {
          if (!g.updatedAt) return false;
          const updatedAt = new Date(g.updatedAt);
          if (updatedAt < m.start || updatedAt >= m.endExclusive) return false;
          return isGoalAtRisk(g, now);
        }).length;

        series.headcount.push({ label: m.label, value: activeAtMonthEnd.length });
        series.hires.push({ label: m.label, value: monthHires });
        series.leavers.push({ label: m.label, value: monthLeavers });
        series.absenceRate.push({
          label: m.label,
          value: safePct(monthAbsenceDays, (activeAtMonthEnd.length || 1) * m.businessDays),
        });
        series.timesheetCompliance.push({
          label: m.label,
          value: safePct(monthWorkedDaysSet.size, expectedMonthDays || 1),
        });
        series.overtimeHours.push({ label: m.label, value: monthOvertime });
        series.requestsSubmitted.push({ label: m.label, value: monthRequests.length });
        series.requestsSla.push({
          label: m.label,
          value: safePct(
            monthWithinSla.length,
            monthClosedWithSla.length || monthClosed.length || 1
          ),
        });
        series.trainingParticipation.push({
          label: m.label,
          value: safePct(monthTrainedEmployees.size, activeAtMonthEnd.length || 1),
        });
        series.interviewCompletion.push({
          label: m.label,
          value: safePct(monthInterviewsDone.length, monthInterviewsPlanned.length || 1),
        });
        series.goalsAtRisk.push({ label: m.label, value: monthGoalRisk });

        void avgMonthHeadcount;
      }

      const contractsEndingIn60d = employees.filter(
        (e) => e.endDate && new Date(e.endDate) >= todayStart && new Date(e.endDate) <= addDays(todayStart, 60)
      ).length;
      const profilesIncomplete = totalEmployees - completeProfileCount;
      const missingMandatoryDocs = totalEmployees - mandatoryDocCoverageCount;

      const cards = [
        {
          id: "active_headcount",
          label: "Effectif actif",
          value: activeHeadcount,
          unit: "collaborateurs",
          hint: "Collaborateurs actifs à date",
        },
        {
          id: "turnover_12m",
          label: "Turnover 12 mois",
          value: turnover12mPercent,
          unit: "%",
          hint: "Départs / effectif moyen",
        },
        {
          id: "absence_30d",
          label: "Absentéisme 30j",
          value: absenceRate30dPercent,
          unit: "%",
          hint: "Jours d'absence approuvés / jours théoriques",
        },
        {
          id: "timesheet_compliance_30d",
          label: "Conformité pointage 30j",
          value: timesheetCompliance30dPercent,
          unit: "%",
          hint: "Jours pointés / jours attendus",
        },
        {
          id: "sla_hr_requests_30d",
          label: "Respect SLA demandes RH",
          value: hrRequestSla30dPercent,
          unit: "%",
          hint: "Demandes closes dans le SLA",
        },
        {
          id: "profile_completeness",
          label: "Complétude dossiers",
          value: profileCompletenessPercent,
          unit: "%",
          hint: "Dossiers employés complets",
        },
        {
          id: "training_participation_90d",
          label: "Participation formation 90j",
          value: trainingParticipation90dPercent,
          unit: "%",
          hint: "Salariés formés / effectif actif",
        },
        {
          id: "goals_at_risk",
          label: "Objectifs à risque",
          value: goalsAtRiskPercent,
          unit: "%",
          hint: "Objectifs en retard ou off-track",
        },
      ];

      return res.json({
        generatedAt: new Date().toISOString(),
        period: {
          months: monthsCount,
          from: months[0]?.start || null,
          to: months[months.length - 1]?.endInclusive || null,
        },
        highlights: {
          activeHeadcount,
          turnover12mPercent,
          absenceRate30dPercent,
          timesheetCompliance30dPercent,
          overtimeHours30,
          hrRequestSla30dPercent,
          avgHrRequestResolutionHours30d,
          avgLeaveValidationHours30d,
          profileCompletenessPercent,
          mandatoryDocumentCoveragePercent,
          trainingParticipation90dPercent,
          interviewCompletion90dPercent,
          goalsAtRiskPercent,
        },
        cards,
        series,
        breakdowns: {
          contractTypes: Object.entries(contractTypeMap)
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value),
          requestsByType: Object.entries(requestsByTypeMap)
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value),
          leaveByType: Object.entries(leaveByTypeMap)
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value),
        },
        alerts: {
          contractsEndingIn60d,
          pendingHrRequests,
          pendingLeaves,
          pendingExpenses,
          profilesIncomplete,
          missingMandatoryDocs,
        },
      });
    } catch (e) {
      console.error("[analytics/hr/overview] error:", e);
      return res.status(500).json({ error: "analytics_hr_overview_failed" });
    }
  }
);

export default router;

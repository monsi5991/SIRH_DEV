import express from "express";
import { prisma } from "../../prisma.js";
import { requirePermissions } from "../../rbac.js";
import { notify } from "../../lib/notify.js";
import { createInAppNotification } from "../../lib/notifications.js";
import { logAuditEvent } from "../../lib/audit.js";
import {
  buildLeaveWorkflowMap,
  getDefaultLeaveApprovalStage,
  getLeaveApprovalStageLabel,
} from "../../lib/leaveWorkflow.js";
import {
  buildEmployeeScopeWhere,
  canAccessEmployeeId,
  resolveAccessContext,
} from "../../lib/accessScope.js";

const router = express.Router();

// ✅ Ici, index.js a déjà fait verifyKeycloak + attachDbAuthFromKeycloak
// On met un garde "read" par défaut (et on sur-spécifie write sur les endpoints mutateurs)
router.use(requirePermissions(["operations_read", "self_read"], "anyOf"));

const ALLOWED_STATUS = new Set(["Pending", "Approved", "Rejected"]);
const ALLOWED_HALF_DAY = new Set(["AM", "PM", null]);
const LEAVE_ID_PARAM = ":id([A-Za-z0-9]{20,})";

function toDateSafe(v) {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function writeActionLog({ tenantId, leaveId, actorId, action, fromStatus, toStatus, reason, meta }) {
  try {
    await prisma.leaveActionLog.create({
      data: {
        tenantId,
        leaveId,
        actorId,
        action,
        fromStatus,
        toStatus,
        reason: reason ?? null,
        meta: meta ?? {},
      },
    });
  } catch (e) {
    console.warn("leaveActionLog error:", e?.message);
  }
}

function quote(s) {
  if (s == null) return "";
  const str = String(s);
  if (str.includes(",") || str.includes('"')) return `"${str.replaceAll('"', '""')}"`;
  return str;
}

function canAccessLeave(context, leave) {
  if (context.scope === "COMPANY") return true;
  return !!leave?.employeeId && canAccessEmployeeId(context, leave.employeeId);
}

function fullName(employee) {
  return `${employee?.firstName || ""} ${employee?.lastName || ""}`.trim() || null;
}

function approvalStageLabel(stage, fallbackStatus = null) {
  return getLeaveApprovalStageLabel(stage, { finalStatus: fallbackStatus });
}

function isPendingLeaveStatus(status) {
  return String(status || "").toLowerCase() === "pending";
}

async function resolveLeaveEmployee(tenantId, employeeId) {
  if (!tenantId || !employeeId) return null;
  return prisma.employee.findFirst({
    where: { tenantId, id: employeeId },
    select: {
      id: true,
      userId: true,
      firstName: true,
      lastName: true,
      managerId: true,
      manager: {
        select: {
          id: true,
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
}

async function listHrUserIds(tenantId) {
  if (!tenantId) return [];
  const rows = await prisma.userRole.findMany({
    where: {
      role: {
        tenantId,
        name: { in: ["RH", "HR"] },
      },
    },
    select: { userId: true },
  });
  return Array.from(new Set(rows.map((r) => r.userId).filter(Boolean)));
}

async function notifyMany({
  tenantId,
  userIds = [],
  actorId = null,
  type,
  title,
  body,
  data = {},
}) {
  const uniqueUserIds = Array.from(new Set((userIds || []).filter(Boolean)));
  if (!tenantId || !uniqueUserIds.length) return 0;
  const results = await Promise.allSettled(
    uniqueUserIds.map((userId) =>
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

function canCompanyHandleApproval(accessContext) {
  if (accessContext.scope !== "COMPANY") return false;
  if (accessContext.permissions?.has?.("all")) return true;
  if (accessContext.permissions?.has?.("admin_read")) return true;
  if (accessContext.permissions?.has?.("approvals_write")) return true;
  return accessContext.permissions?.has?.("operations_write") || false;
}

function buildLeaveCapabilities({ leave, workflow, accessContext, targetEmployee }) {
  const isManagerApprover =
    !!accessContext.viewerEmployee?.id &&
    !!targetEmployee?.managerId &&
    accessContext.viewerEmployee.id === targetEmployee.managerId;
  const isCompanyApprover = canCompanyHandleApproval(accessContext);
  const stage = workflow?.approvalStage || getDefaultLeaveApprovalStage(Boolean(targetEmployee?.managerId));
  const pending = isPendingLeaveStatus(leave?.status);

  let canApprove = false;
  let canReject = false;
  if (pending && stage === "PENDING_MANAGER") {
    canApprove = isManagerApprover;
    canReject = isManagerApprover;
  }
  if (pending && stage === "PENDING_HR") {
    canApprove = isCompanyApprover;
    canReject = isCompanyApprover;
  }

  return {
    approvalStage: stage,
    approvalStageLabel: workflow?.approvalStageLabel || approvalStageLabel(stage, leave?.status),
    escalatedToHr: Boolean(workflow?.escalatedToHr),
    canApprove,
    canReject,
    canEscalateToHr: pending && stage === "PENDING_MANAGER" && (isManagerApprover || isCompanyApprover),
    approveActionLabel: stage === "PENDING_MANAGER" ? "Valider N+1" : "Valider RH",
  };
}

async function enrichLeavesForResponse({ tenantId, accessContext, leaves }) {
  const rows = Array.isArray(leaves) ? leaves : [];
  if (!tenantId || !rows.length) return rows;

  const employeeIds = Array.from(new Set(rows.map((row) => row?.employeeId).filter(Boolean)));
  const [workflowMap, employees] = await Promise.all([
    buildLeaveWorkflowMap(prisma, tenantId, rows),
    employeeIds.length
      ? prisma.employee.findMany({
          where: { tenantId, id: { in: employeeIds } },
          select: {
            id: true,
            managerId: true,
            manager: {
              select: {
                id: true,
                userId: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const employeesById = new Map(employees.map((employee) => [employee.id, employee]));
  return rows.map((leave) => {
    const targetEmployee = leave?.employeeId ? employeesById.get(leave.employeeId) || null : null;
    const workflow = workflowMap.get(leave.id) || {
      approvalStage: getDefaultLeaveApprovalStage(Boolean(targetEmployee?.managerId)),
      approvalStageLabel: approvalStageLabel(
        getDefaultLeaveApprovalStage(Boolean(targetEmployee?.managerId)),
        leave?.status
      ),
      escalatedToHr: false,
    };
    return {
      ...leave,
      workflow,
      ...buildLeaveCapabilities({ leave, workflow, accessContext, targetEmployee }),
      managerName: fullName(targetEmployee?.manager),
    };
  });
}

const DEFAULT_LEAVE_TYPES = [
  { code: "CP", label: "Congés payés", category: "VACATION", unit: "DAY", defaultAnnualAllowance: 24, requiresDocument: false },
  { code: "RTT", label: "RTT", category: "RTT", unit: "DAY", defaultAnnualAllowance: 10, requiresDocument: false },
  { code: "SICK", label: "Maladie", category: "SICK", unit: "DAY", defaultAnnualAllowance: 10, requiresDocument: true },
  { code: "PARENTAL", label: "Congé parental", category: "PARENTAL", unit: "DAY", defaultAnnualAllowance: 90, requiresDocument: true },
  { code: "EXCEPTIONAL", label: "Congé exceptionnel", category: "EXCEPTIONAL", unit: "DAY", defaultAnnualAllowance: 5, requiresDocument: true },
  { code: "UNPAID", label: "Congé sans solde", category: "UNPAID", unit: "DAY", defaultAnnualAllowance: 0, requiresDocument: false },
];

function hasLeaveBalanceEngine() {
  return Boolean(prisma.leaveType && prisma.employeeLeaveBalance && prisma.leaveBalanceLedgerEntry);
}

function mapLeaveTypeCode(raw) {
  const code = String(raw || "").toUpperCase();
  if (code === "CP" || code === "ANNUAL" || code === "VACATION") return "CP";
  if (code.includes("RTT")) return "RTT";
  if (code.includes("SICK") || code.includes("MAL")) return "SICK";
  if (code.includes("PARENT")) return "PARENTAL";
  if (code.includes("EXCEPTION")) return "EXCEPTIONAL";
  if (code.includes("SANS") || code.includes("UNPAID")) return "UNPAID";
  return "CP";
}

function startOfYear(year) {
  return new Date(year, 0, 1);
}

function endOfYear(year) {
  return new Date(year, 11, 31, 23, 59, 59, 999);
}

async function computeFallbackBalances({ tenantId, employeeId, year }) {
  const from = startOfYear(year);
  const to = endOfYear(year);
  const leaves = await prisma.leave.findMany({
    where: {
      tenantId,
      employeeId,
      AND: [{ start: { lte: to } }, { end: { gte: from } }],
    },
    select: { id: true, start: true, end: true, type: true, status: true, halfDay: true },
    take: 500,
  });

  const map = new Map(
    DEFAULT_LEAVE_TYPES.map((it) => [
      it.code,
      {
        leaveTypeCode: it.code,
        leaveTypeLabel: it.label,
        category: it.category,
        unit: it.unit,
        periodYear: year,
        openingBalance: Number(it.defaultAnnualAllowance || 0),
        accrued: 0,
        consumed: 0,
        pending: 0,
        adjustments: 0,
        available: Number(it.defaultAnnualAllowance || 0),
      },
    ])
  );

  for (const leave of leaves) {
    const code = mapLeaveTypeCode(leave.type);
    const item = map.get(code);
    if (!item) continue;
    const days =
      leave.halfDay === "AM" || leave.halfDay === "PM"
        ? 0.5
        : Math.max(0, Math.floor((new Date(leave.end) - new Date(leave.start)) / 86400000) + 1);
    const normalizedStatus = String(leave.status || "").toUpperCase();
    if (normalizedStatus === "APPROVED") item.consumed += days;
    if (normalizedStatus === "PENDING") item.pending += days;
  }

  const result = Array.from(map.values()).map((item) => ({
    ...item,
    consumed: Number(item.consumed.toFixed(1)),
    pending: Number(item.pending.toFixed(1)),
    available: Number((item.openingBalance + item.accrued + item.adjustments - item.consumed).toFixed(1)),
  }));
  return result.sort((a, b) => a.leaveTypeLabel.localeCompare(b.leaveTypeLabel));
}

function roundLeaveNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(1));
}

function splitLeaveDaysByYear(leave) {
  const map = new Map();
  if (!leave?.start || !leave?.end) return map;
  if (leave.halfDay === "AM" || leave.halfDay === "PM") {
    map.set(new Date(leave.start).getFullYear(), 0.5);
    return map;
  }
  const start = new Date(leave.start);
  const end = new Date(leave.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return map;

  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const cap = new Date(end);
  cap.setHours(0, 0, 0, 0);

  for (let d = new Date(cursor); d <= cap; d.setDate(d.getDate() + 1)) {
    const year = d.getFullYear();
    map.set(year, roundLeaveNumber((map.get(year) || 0) + 1));
  }
  return map;
}

function statusImpact(status, quantity) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "PENDING") return { pending: quantity, consumed: 0 };
  if (normalized === "APPROVED") return { pending: 0, consumed: quantity };
  return { pending: 0, consumed: 0 };
}

function getDefaultLeaveTypeDefinition(code) {
  return (
    DEFAULT_LEAVE_TYPES.find((item) => item.code === code) ||
    DEFAULT_LEAVE_TYPES.find((item) => item.code === "CP")
  );
}

async function ensureLeaveTypeTx(tx, { tenantId, code }) {
  const normalizedCode = mapLeaveTypeCode(code);
  const existing = await tx.leaveType.findFirst({
    where: { tenantId, code: normalizedCode },
  });
  if (existing) return existing;

  const defaults = getDefaultLeaveTypeDefinition(normalizedCode);
  return tx.leaveType.create({
    data: {
      tenantId,
      code: normalizedCode,
      label: defaults?.label || normalizedCode,
      category: defaults?.category || "OTHER",
      unit: defaults?.unit || "DAY",
      defaultAnnualAllowance: Number(defaults?.defaultAnnualAllowance || 0),
      requiresDocument: Boolean(defaults?.requiresDocument),
      isActive: true,
    },
  });
}

async function ensureLeaveBalanceTx(tx, { tenantId, employeeId, leaveType, year }) {
  const uniqueWhere = {
    tenant_employee_leave_type_period: {
      tenantId,
      employeeId,
      leaveTypeId: leaveType.id,
      periodYear: year,
    },
  };
  const existing = await tx.employeeLeaveBalance.findUnique({ where: uniqueWhere });
  if (existing) return existing;

  const openingBalance = Number(leaveType.defaultAnnualAllowance || 0);
  const created = await tx.employeeLeaveBalance.create({
    data: {
      tenantId,
      employeeId,
      leaveTypeId: leaveType.id,
      periodYear: year,
      openingBalance,
      accrued: 0,
      consumed: 0,
      pending: 0,
      adjustments: 0,
      available: openingBalance,
    },
  });

  if (openingBalance > 0) {
    await tx.leaveBalanceLedgerEntry.create({
      data: {
        tenantId,
        employeeId,
        leaveTypeId: leaveType.id,
        balanceId: created.id,
        leaveId: null,
        periodYear: year,
        direction: "CREDIT",
        reason: "OPENING",
        quantity: openingBalance,
        note: "Solde initial",
        meta: {},
        occurredAt: new Date(year, 0, 1),
      },
    });
  }

  return created;
}

async function applyImpactTx(tx, {
  tenantId,
  employeeId,
  leave,
  year,
  quantity,
  sign,
  sourceStatus,
  reasonLabel,
  actorId,
}) {
  if (!employeeId || !tenantId || !quantity || !sign) return;
  const leaveType = await ensureLeaveTypeTx(tx, {
    tenantId,
    code: mapLeaveTypeCode(leave?.type),
  });
  const balance = await ensureLeaveBalanceTx(tx, {
    tenantId,
    employeeId,
    leaveType,
    year,
  });

  const impact = statusImpact(sourceStatus, quantity * sign);
  if (!impact.pending && !impact.consumed) return;

  const pending = Math.max(0, roundLeaveNumber(Number(balance.pending || 0) + impact.pending));
  const consumed = Math.max(0, roundLeaveNumber(Number(balance.consumed || 0) + impact.consumed));
  const available = roundLeaveNumber(
    Number(balance.openingBalance || 0) +
    Number(balance.accrued || 0) +
    Number(balance.adjustments || 0) -
    consumed
  );

  const updated = await tx.employeeLeaveBalance.update({
    where: { id: balance.id },
    data: { pending, consumed, available },
  });

  if (impact.pending !== 0) {
    await tx.leaveBalanceLedgerEntry.create({
      data: {
        tenantId,
        employeeId,
        leaveTypeId: leaveType.id,
        balanceId: updated.id,
        leaveId: leave?.id || null,
        periodYear: year,
        direction: impact.pending > 0 ? "DEBIT" : "CREDIT",
        reason: impact.pending > 0 ? "PENDING_RESERVE" : "PENDING_RELEASE",
        quantity: roundLeaveNumber(Math.abs(impact.pending)),
        note: reasonLabel,
        meta: { status: sourceStatus },
        createdBy: actorId || null,
      },
    });
  }

  if (impact.consumed !== 0) {
    await tx.leaveBalanceLedgerEntry.create({
      data: {
        tenantId,
        employeeId,
        leaveTypeId: leaveType.id,
        balanceId: updated.id,
        leaveId: leave?.id || null,
        periodYear: year,
        direction: impact.consumed > 0 ? "DEBIT" : "CREDIT",
        reason: "CONSUMPTION",
        quantity: roundLeaveNumber(Math.abs(impact.consumed)),
        note: reasonLabel,
        meta: { status: sourceStatus },
        createdBy: actorId || null,
      },
    });
  }
}

async function syncLeaveBalanceImpactTx(tx, {
  tenantId,
  employeeId,
  previousLeave,
  nextLeave,
  actorId,
  reasonLabel,
}) {
  if (!hasLeaveBalanceEngine()) return;
  if (!tenantId || !employeeId) return;

  const operations = [];
  if (previousLeave) {
    const byYear = splitLeaveDaysByYear(previousLeave);
    for (const [year, quantity] of byYear.entries()) {
      operations.push({
        leave: previousLeave,
        year,
        quantity,
        sign: -1,
        sourceStatus: previousLeave.status,
      });
    }
  }
  if (nextLeave) {
    const byYear = splitLeaveDaysByYear(nextLeave);
    for (const [year, quantity] of byYear.entries()) {
      operations.push({
        leave: nextLeave,
        year,
        quantity,
        sign: 1,
        sourceStatus: nextLeave.status,
      });
    }
  }

  for (const op of operations) {
    await applyImpactTx(tx, {
      tenantId,
      employeeId,
      leave: op.leave,
      year: op.year,
      quantity: op.quantity,
      sign: op.sign,
      sourceStatus: op.sourceStatus,
      reasonLabel,
      actorId,
    });
  }
}

function isSchemaNotReadyError(error) {
  const code = String(error?.code || "").toUpperCase();
  return code === "P2021" || code === "P2022";
}

async function trySyncLeaveBalanceImpactTx(tx, params) {
  try {
    await syncLeaveBalanceImpactTx(tx, params);
  } catch (e) {
    if (isSchemaNotReadyError(e)) return;
    throw e;
  }
}

/**
 * Catalogue des types d'absence
 * GET /operations/leaves/types
 */
router.get("/types", async (req, res) => {
  try {
    const tid = req.auth?.tid;
    if (!tid) return res.status(401).json({ error: "Unauthorized" });

    if (!hasLeaveBalanceEngine()) {
      return res.json({ items: DEFAULT_LEAVE_TYPES, source: "fallback" });
    }

    try {
      const items = await prisma.leaveType.findMany({
        where: { tenantId: tid, isActive: true },
        orderBy: [{ category: "asc" }, { label: "asc" }],
      });
      if (!items.length) return res.json({ items: DEFAULT_LEAVE_TYPES, source: "fallback" });
      return res.json({ items, source: "engine" });
    } catch (e) {
      const code = String(e?.code || "").toUpperCase();
      if (code === "P2021" || code === "P2022") {
        return res.json({ items: DEFAULT_LEAVE_TYPES, source: "fallback" });
      }
      throw e;
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

/**
 * Soldes d'absence (self/team/company selon scope)
 * GET /operations/leaves/balances?employeeId=&year=
 */
router.get("/balances", async (req, res) => {
  try {
    const tid = req.auth?.tid;
    if (!tid) return res.status(401).json({ error: "Unauthorized" });
    const accessContext = await resolveAccessContext(req);
    const yearRaw = Number(req.query.year);
    const year = Number.isFinite(yearRaw) ? Math.max(2020, Math.min(2100, Math.floor(yearRaw))) : new Date().getFullYear();

    const askedEmployeeId = req.query.employeeId ? String(req.query.employeeId) : null;
    const targetEmployeeId = askedEmployeeId || accessContext.viewerEmployee?.id || null;
    if (!targetEmployeeId) return res.status(400).json({ error: "employeeId requis" });
    if (!canAccessEmployeeId(accessContext, targetEmployeeId)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!hasLeaveBalanceEngine()) {
      const fallback = await computeFallbackBalances({
        tenantId: tid,
        employeeId: targetEmployeeId,
        year,
      });
      return res.json({ items: fallback, source: "fallback", periodYear: year });
    }

    try {
      const rows = await prisma.employeeLeaveBalance.findMany({
        where: {
          tenantId: tid,
          employeeId: targetEmployeeId,
          periodYear: year,
        },
        include: {
          leaveType: {
            select: {
              id: true,
              code: true,
              label: true,
              category: true,
              unit: true,
              requiresDocument: true,
              isActive: true,
            },
          },
        },
        orderBy: [{ leaveType: { category: "asc" } }, { leaveType: { label: "asc" } }],
      });

      if (!rows.length) {
        const fallback = await computeFallbackBalances({
          tenantId: tid,
          employeeId: targetEmployeeId,
          year,
        });
        return res.json({ items: fallback, source: "fallback", periodYear: year });
      }

      const items = rows.map((row) => ({
        leaveTypeId: row.leaveTypeId,
        leaveTypeCode: row.leaveType?.code || null,
        leaveTypeLabel: row.leaveType?.label || row.leaveTypeId,
        category: row.leaveType?.category || "OTHER",
        unit: row.leaveType?.unit || "DAY",
        periodYear: row.periodYear,
        openingBalance: Number(row.openingBalance || 0),
        accrued: Number(row.accrued || 0),
        consumed: Number(row.consumed || 0),
        pending: Number(row.pending || 0),
        adjustments: Number(row.adjustments || 0),
        available: Number(row.available || 0),
        requiresDocument: Boolean(row.leaveType?.requiresDocument),
      }));

      return res.json({ items, source: "engine", periodYear: year });
    } catch (e) {
      const code = String(e?.code || "").toUpperCase();
      if (code === "P2021" || code === "P2022") {
        const fallback = await computeFallbackBalances({
          tenantId: tid,
          employeeId: targetEmployeeId,
          year,
        });
        return res.json({ items: fallback, source: "fallback", periodYear: year });
      }
      throw e;
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

/**
 * GET /operations/leaves
 * Query params: status, q, type, employeeId, from, to, sort, page, pageSize
 * Tri: "createdAt:desc|start:asc|end:asc" (par défaut createdAt:desc)
 */
router.get("/", async (req, res) => {
  try {
    const tid = req.auth?.tid;
    if (!tid) return res.status(401).json({ error: "Unauthorized" });
    const accessContext = await resolveAccessContext(req);

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

    const where = {
      tenantId: tid,
      ...buildEmployeeScopeWhere(accessContext, { field: "employeeId" }),
    };

    if (status) {
      const s = String(status);
      if (!ALLOWED_STATUS.has(s)) return res.status(400).json({ error: "Statut invalide" });
      where.status = s;
    }
    if (type) where.type = String(type);
    if (employeeId) {
      const askedEmployeeId = String(employeeId);
      if (!canAccessEmployeeId(accessContext, askedEmployeeId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      where.employeeId = askedEmployeeId;
    }

    if (q) {
      const qs = String(q);
      where.OR = [
        { employee: { contains: qs, mode: "insensitive" } },
        { type: { contains: qs, mode: "insensitive" } },
        { status: { contains: qs, mode: "insensitive" } },
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
          id: true,
          tenantId: true,
          employee: true,
          employeeId: true,
          start: true,
          end: true,
          createdAt: true,
          status: true,
          type: true,
          paid: true,
          halfDay: true,
        },
      }),
    ]);

    const enrichedLeaves = await enrichLeavesForResponse({
      tenantId: tid,
      accessContext,
      leaves: rows,
    });

    res.json({ total, page: p, pageSize: ps, leaves: enrichedLeaves });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Détails + logs
 * GET /operations/leaves/:id
 */
router.get(`/${LEAVE_ID_PARAM}`, async (req, res) => {
  try {
    const tid = req.auth?.tid;
    if (!tid) return res.status(401).json({ error: "Unauthorized" });
    const accessContext = await resolveAccessContext(req);

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
    if (!canAccessLeave(accessContext, leave)) return res.status(403).json({ error: "Forbidden" });

    const [enrichedLeave] = await enrichLeavesForResponse({
      tenantId: tid,
      accessContext,
      leaves: [leave],
    });

    if (minimal) return res.json({ leave: enrichedLeave, logs: [] });

    const logs = await prisma.leaveActionLog.findMany({
      where: { tenantId: tid, leaveId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    res.json({ leave: enrichedLeave, logs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Commentaires
 * GET /operations/leaves/:id/comments
 */
router.get(`/${LEAVE_ID_PARAM}/comments`, async (req, res) => {
  try {
    const tid = req.auth?.tid;
    if (!tid) return res.status(401).json({ error: "Unauthorized" });
    const accessContext = await resolveAccessContext(req);

    const { id } = req.params;
    const leave = await prisma.leave.findFirst({
      where: { id, tenantId: tid },
      select: { id: true, employeeId: true },
    });
    if (!leave) return res.status(404).json({ error: "Demande introuvable" });
    if (!canAccessLeave(accessContext, leave)) return res.status(403).json({ error: "Forbidden" });

    const comments = await prisma.leaveComment.findMany({
      where: { tenantId: tid, leaveId: id },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    res.json({ comments });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /operations/leaves/:id/comments
 */
router.post(`/${LEAVE_ID_PARAM}/comments`, requirePermissions(["operations_write", "self_write"], "anyOf"), async (req, res) => {
  try {
    const tid = req.auth?.tid;
    const uid = req.auth?.sub;
    if (!tid || !uid) return res.status(401).json({ error: "Unauthorized" });
    const accessContext = await resolveAccessContext(req);

    const { id } = req.params;
    const { message } = req.body || {};
    if (!message || !String(message).trim()) return res.status(400).json({ error: "Message requis" });

    const leave = await prisma.leave.findFirst({
      where: { id, tenantId: tid },
      select: { id: true, employeeId: true },
    });
    if (!leave) return res.status(404).json({ error: "Demande introuvable" });
    if (!canAccessLeave(accessContext, leave)) return res.status(403).json({ error: "Forbidden" });

    const created = await prisma.leaveComment.create({
      data: { tenantId: tid, leaveId: id, authorId: uid, message: String(message).trim() },
    });

    res.status(201).json({ comment: created });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /operations/leaves
 */
router.post("/", requirePermissions(["operations_write", "self_write"], "anyOf"), async (req, res) => {
  try {
    const tid = req.auth?.tid;
    const uid = req.auth?.sub;
    if (!tid || !uid) return res.status(401).json({ error: "Unauthorized" });
    const accessContext = await resolveAccessContext(req);

    const { employee, employeeId, start, end, type, paid, halfDay, status, reason } = req.body || {};
    let targetEmployeeId = employeeId ? String(employeeId) : null;
    if (!targetEmployeeId && accessContext.scope === "SELF" && accessContext.viewerEmployee?.id) {
      targetEmployeeId = accessContext.viewerEmployee.id;
    }

    if ((!employee && !targetEmployeeId) || !start || !end) {
      return res.status(400).json({ error: "employee/employeeId, start, end requis" });
    }
    if (accessContext.scope !== "COMPANY") {
      if (!targetEmployeeId) {
        return res.status(400).json({ error: "employeeId requis pour votre scope" });
      }
      if (!canAccessEmployeeId(accessContext, targetEmployeeId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const startDate = toDateSafe(start);
    const endDate = toDateSafe(end);
    if (!startDate || !endDate) return res.status(400).json({ error: "Dates invalides" });
    if (endDate < startDate) return res.status(400).json({ error: "end doit être après (ou égal à) start" });

    const normalizedStatus = status && ALLOWED_STATUS.has(String(status)) ? String(status) : "Pending";
    if (accessContext.scope !== "COMPANY" && normalizedStatus !== "Pending") {
      return res.status(403).json({ error: "Le statut initial doit être Pending pour ce scope." });
    }

    const normalizedHalfDay = halfDay == null ? null : String(halfDay);
    if (!ALLOWED_HALF_DAY.has(normalizedHalfDay)) {
      return res.status(400).json({ error: "halfDay invalide (AM | PM | null)" });
    }

    const employeeProfile = targetEmployeeId
      ? await resolveLeaveEmployee(tid, targetEmployeeId)
      : null;
    if (targetEmployeeId && !employeeProfile) {
      return res.status(404).json({ error: "employee_not_found" });
    }

    const managerUserId = employeeProfile?.manager?.userId || null;
    const managerName = fullName(employeeProfile?.manager) || "Manager";
    const employeeDisplayName =
      String(employee || "").trim() ||
      fullName(employeeProfile) ||
      "Employé";
    const approvalStage = managerUserId ? "PENDING_MANAGER" : "PENDING_HR";

    const leave = await prisma.$transaction(async (tx) => {
      const created = await tx.leave.create({
        data: {
          tenantId: tid,
          employee: employeeDisplayName,
          employeeId: targetEmployeeId || null,
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
          tenantId: tid,
          leaveId: created.id,
          actorId: uid,
          action: "CREATE",
          fromStatus: null,
          toStatus: created.status,
          reason: reason ? String(reason).trim() : null,
          meta: {
            approvalStage,
            managerUserId,
            managerName,
          },
        },
      });

      await trySyncLeaveBalanceImpactTx(tx, {
        tenantId: tid,
        employeeId: created.employeeId,
        previousLeave: null,
        nextLeave: created,
        actorId: uid,
        reasonLabel: "Création demande d'absence",
      });

      return created;
    });

    const hrUserIds = await listHrUserIds(tid);

    if (employeeProfile?.userId) {
      await notifyMany({
        tenantId: tid,
        userIds: [employeeProfile.userId],
        actorId: uid,
        type: "LEAVE_SUBMITTED",
        title: "Demande d'absence envoyée",
        body: managerUserId
          ? `Votre demande a été envoyée à votre manager (${managerName}).`
          : "Votre demande a été envoyée directement aux RH.",
        data: {
          leaveId: leave.id,
          status: leave.status,
          approvalStage,
        },
      });
    }

    if (managerUserId) {
      await notifyMany({
        tenantId: tid,
        userIds: [managerUserId].filter((id) => id && id !== uid),
        actorId: uid,
        type: "LEAVE_PENDING_MANAGER_APPROVAL",
        title: "Demande d'absence à valider",
        body: `${employeeDisplayName} a soumis une demande d'absence (${leave.type || "CP"}).`,
        data: {
          leaveId: leave.id,
          employeeId: leave.employeeId,
          approvalStage,
        },
      });
    }

    await notifyMany({
      tenantId: tid,
      userIds: hrUserIds.filter((id) => id && id !== uid),
      actorId: uid,
      type: managerUserId ? "LEAVE_SUBMITTED_INFO" : "LEAVE_PENDING_HR_APPROVAL",
      title: managerUserId ? "Nouvelle demande d'absence (info RH)" : "Demande d'absence à valider (RH)",
      body: managerUserId
        ? `${employeeDisplayName} a soumis une demande d'absence (${leave.type || "CP"}), en attente de validation manager.`
        : `${employeeDisplayName} a soumis une demande d'absence (${leave.type || "CP"}), à traiter par les RH.`,
      data: {
        leaveId: leave.id,
        employeeId: leave.employeeId,
        approvalStage,
      },
    });

    await logAuditEvent({
      tenantId: tid,
      actorId: uid,
      type: "LEAVE_SUBMIT",
      entity: "leave",
      entityId: leave.id,
      payload: {
        employeeId: leave.employeeId,
        approvalStage,
        managerUserId,
      },
      ip: req.ip,
      ua: req.get("user-agent"),
    });

    notify("leave.created", { id: leave.id, tenantId: tid, status: leave.status });

    const [enrichedLeave] = await enrichLeavesForResponse({
      tenantId: tid,
      accessContext,
      leaves: [leave],
    });

    res.status(201).json({
      leave: enrichedLeave,
      actionResult: "SUBMITTED",
      message: managerUserId
        ? "Demande envoyée au manager. Les RH ont été informées."
        : "Demande envoyée directement aux RH.",
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * PUT /operations/leaves/:id
 * body: { status?, paid?, type?, halfDay? }
 */
router.put(`/${LEAVE_ID_PARAM}`, requirePermissions(["operations_write"], "anyOf"), async (req, res) => {
  try {
    const tid = req.auth?.tid;
    const uid = req.auth?.sub;
    if (!tid || !uid) return res.status(401).json({ error: "Unauthorized" });
    const accessContext = await resolveAccessContext(req);

    const { id } = req.params;
    const { status, paid, type, halfDay } = req.body || {};

    const found = await prisma.leave.findFirst({ where: { id, tenantId: tid } });
    if (!found) return res.status(404).json({ error: "Demande introuvable" });
    if (!canAccessLeave(accessContext, found)) return res.status(403).json({ error: "Forbidden" });

    const data = {};

    if (status !== undefined) {
      const s = String(status);
      if (!ALLOWED_STATUS.has(s)) return res.status(400).json({ error: "Statut invalide" });
      data.status = s;
    }

    if (paid !== undefined) data.paid = !!paid;
    if (type !== undefined) data.type = type ? String(type) : null;

    if ("halfDay" in (req.body || {})) {
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
            tenantId: tid,
            leaveId: id,
            actorId: uid,
            action: "UPDATE",
            fromStatus: found.status,
            toStatus: up.status,
            reason: null,
            meta: { fields: Object.keys(data) },
          },
        });
      }

      await trySyncLeaveBalanceImpactTx(tx, {
        tenantId: tid,
        employeeId: up.employeeId || found.employeeId,
        previousLeave: found,
        nextLeave: up,
        actorId: uid,
        reasonLabel: "Mise à jour demande d'absence",
      });

      return up;
    });

    res.json({ leave: updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * PUT /operations/leaves/:id/status
 */
router.put(`/${LEAVE_ID_PARAM}/status`, requirePermissions(["operations_write", "approvals_write", "team_write", "admin_read"], "anyOf"), async (req, res) => {
  try {
    const tid = req.auth?.tid;
    const uid = req.auth?.sub;
    if (!tid || !uid) return res.status(401).json({ error: "Unauthorized" });
    const accessContext = await resolveAccessContext(req);

    const { id } = req.params;
    const { status, reason } = req.body || {};
    const s = String(status);

    if (!ALLOWED_STATUS.has(s)) return res.status(400).json({ error: "Statut invalide" });

    const found = await prisma.leave.findFirst({ where: { id, tenantId: tid } });
    if (!found) return res.status(404).json({ error: "Demande introuvable" });
    if (!canAccessLeave(accessContext, found)) return res.status(403).json({ error: "Forbidden" });

    const targetEmployee = await resolveLeaveEmployee(tid, found.employeeId);
    const workflowMap = await buildLeaveWorkflowMap(prisma, tid, [found]);
    const currentWorkflow =
      workflowMap.get(found.id) || {
        approvalStage: getDefaultLeaveApprovalStage(Boolean(targetEmployee?.managerId)),
        approvalStageLabel: approvalStageLabel(
          getDefaultLeaveApprovalStage(Boolean(targetEmployee?.managerId)),
          found.status
        ),
        escalatedToHr: false,
      };
    const currentApprovalStage = currentWorkflow.approvalStage;
    const isManagerApprover =
      !!accessContext.viewerEmployee?.id &&
      !!targetEmployee?.managerId &&
      accessContext.viewerEmployee.id === targetEmployee.managerId;
    const isCompanyApprover = canCompanyHandleApproval(accessContext);
    const isApprovalDecision = s === "Approved" || s === "Rejected";
    const isFallbackHrApproval =
      isApprovalDecision &&
      isCompanyApprover &&
      !isManagerApprover &&
      currentApprovalStage === "PENDING_HR";

    if (isApprovalDecision && !isManagerApprover && !isCompanyApprover) {
      return res.status(403).json({ error: "Seul le manager ou les RH peuvent valider/rejeter cette demande." });
    }

    if (isApprovalDecision && !isPendingLeaveStatus(found.status)) {
      return res.status(400).json({ error: "Seules les demandes en attente peuvent être validées/rejetées." });
    }

    if (isApprovalDecision && currentApprovalStage === "PENDING_MANAGER" && isCompanyApprover && !isManagerApprover) {
      return res.status(409).json({
        error: "Cette demande attend encore la validation manager. Utilisez l'escalade RH si le manager est indisponible.",
      });
    }

    if (isApprovalDecision && currentApprovalStage === "PENDING_HR" && isManagerApprover && !isCompanyApprover) {
      return res.status(409).json({
        error: "Cette demande a déjà été transmise aux RH. Le manager ne peut plus la valider directement.",
      });
    }

    if (s === found.status && !(s === "Approved" && currentApprovalStage === "PENDING_MANAGER" && isManagerApprover)) {
      const [sameLeave] = await enrichLeavesForResponse({
        tenantId: tid,
        accessContext,
        leaves: [found],
      });
      return res.json({ leave: sameLeave, actionResult: "NOOP" });
    }

    const managerForwardToHr = s === "Approved" && currentApprovalStage === "PENDING_MANAGER" && isManagerApprover;

    const updated = await prisma.$transaction(async (tx) => {
      const nextStatus = managerForwardToHr ? found.status : s;
      const up = await tx.leave.update({ where: { id }, data: { status: nextStatus } });

      await tx.leaveActionLog.create({
        data: {
          tenantId: tid,
          leaveId: id,
          actorId: uid,
          action: managerForwardToHr ? "MANAGER_APPROVE" : s.toUpperCase(),
          fromStatus: found.status,
          toStatus: nextStatus,
          reason: reason ?? null,
          meta: {
            approverType: isManagerApprover ? "MANAGER" : isCompanyApprover ? "HR" : "UNKNOWN",
            fallbackHrApproval: isFallbackHrApproval,
            managerUserId: targetEmployee?.manager?.userId || null,
            approvalStage: managerForwardToHr ? "PENDING_HR" : currentApprovalStage,
            previousApprovalStage: currentApprovalStage,
          },
        },
      });

      await trySyncLeaveBalanceImpactTx(tx, {
        tenantId: tid,
        employeeId: up.employeeId || found.employeeId,
        previousLeave: found,
        nextLeave: up,
        actorId: uid,
        reasonLabel: "Changement de statut absence",
      });

      return up;
    });

    const employeeUserId = targetEmployee?.userId || null;
    const hrUserIds = await listHrUserIds(tid);

    if (managerForwardToHr) {
      if (employeeUserId) {
        await notifyMany({
          tenantId: tid,
          userIds: [employeeUserId],
          actorId: uid,
          type: "LEAVE_MANAGER_APPROVED",
          title: "Demande validée par le manager",
          body: "Votre demande a été validée par le manager et transmise aux RH.",
          data: {
            leaveId: updated.id,
            status: updated.status,
            approvalStage: "PENDING_HR",
          },
        });
      }

      await notifyMany({
        tenantId: tid,
        userIds: hrUserIds.filter((userId) => userId && userId !== uid),
        actorId: uid,
        type: "LEAVE_PENDING_HR_APPROVAL",
        title: "Demande d'absence à valider (RH)",
        body: `${updated.employee || fullName(targetEmployee) || "Employé"} a été validé par le manager et attend la validation RH.`,
        data: {
          leaveId: updated.id,
          employeeId: updated.employeeId,
          approvalStage: "PENDING_HR",
        },
      });

      await logAuditEvent({
        tenantId: tid,
        actorId: uid,
        type: "LEAVE_MANAGER_FORWARD_HR",
        entity: "leave",
        entityId: updated.id,
        payload: {
          employeeId: updated.employeeId,
          fromStatus: found.status,
          toStatus: updated.status,
          fromApprovalStage: currentApprovalStage,
          toApprovalStage: "PENDING_HR",
        },
        ip: req.ip,
        ua: req.get("user-agent"),
      });

      const [enrichedLeave] = await enrichLeavesForResponse({
        tenantId: tid,
        accessContext,
        leaves: [updated],
      });

      return res.json({
        leave: enrichedLeave,
        actionResult: "FORWARDED_TO_HR",
        message: "Validation manager enregistrée. La demande est maintenant en attente RH.",
      });
    }

    if (employeeUserId) {
      await notifyMany({
        tenantId: tid,
        userIds: [employeeUserId],
        actorId: uid,
        type: s === "Approved" ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
        title: s === "Approved" ? "Demande d'absence approuvée" : "Demande d'absence rejetée",
        body:
          s === "Approved"
            ? isFallbackHrApproval
              ? "Votre demande a été approuvée par les RH (absence/indisponibilité manager)."
              : "Votre demande a été approuvée."
            : "Votre demande a été rejetée.",
        data: {
          leaveId: updated.id,
          status: s,
          fallbackHrApproval: isFallbackHrApproval,
        },
      });
    }

    await logAuditEvent({
      tenantId: tid,
      actorId: uid,
      type: s === "Approved" ? "LEAVE_APPROVE" : "LEAVE_REJECT",
      entity: "leave",
      entityId: updated.id,
      payload: {
        employeeId: updated.employeeId,
        fromStatus: found.status,
        toStatus: s,
        approverType: isManagerApprover ? "MANAGER" : isCompanyApprover ? "HR" : "UNKNOWN",
        fallbackHrApproval: isFallbackHrApproval,
      },
      ip: req.ip,
      ua: req.get("user-agent"),
    });

    notify("leave.status_changed", { id: updated.id, tenantId: tid, status: s, reason: reason ?? null });

    const [enrichedLeave] = await enrichLeavesForResponse({
      tenantId: tid,
      accessContext,
      leaves: [updated],
    });

    res.json({
      leave: enrichedLeave,
      actionResult: s === "Approved" ? "APPROVED" : "REJECTED",
      message: s === "Approved" ? "Demande approuvée." : "Demande rejetée.",
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Escalade vers RH (fallback si manager indisponible)
 * POST /operations/leaves/:id/escalate-to-hr
 */
router.post(
  `/${LEAVE_ID_PARAM}/escalate-to-hr`,
  requirePermissions(["operations_write", "approvals_write", "team_write", "admin_read"], "anyOf"),
  async (req, res) => {
    try {
      const tid = req.auth?.tid;
      const uid = req.auth?.sub;
      if (!tid || !uid) return res.status(401).json({ error: "Unauthorized" });
      const accessContext = await resolveAccessContext(req);
      const reason = String(req.body?.reason || "").trim() || "Manager indisponible";

      const leave = await prisma.leave.findFirst({
        where: { id: req.params.id, tenantId: tid },
        select: { id: true, employeeId: true, employee: true, type: true, status: true },
      });
      if (!leave) return res.status(404).json({ error: "Demande introuvable" });
      if (!canAccessLeave(accessContext, leave)) return res.status(403).json({ error: "Forbidden" });
      if (!isPendingLeaveStatus(leave.status)) {
        return res.status(400).json({ error: "Seules les demandes en attente peuvent être escaladées." });
      }

      const targetEmployee = await resolveLeaveEmployee(tid, leave.employeeId);
      const workflowMap = await buildLeaveWorkflowMap(prisma, tid, [leave]);
      const currentWorkflow =
        workflowMap.get(leave.id) || {
          approvalStage: getDefaultLeaveApprovalStage(Boolean(targetEmployee?.managerId)),
        };
      const isManagerApprover =
        !!accessContext.viewerEmployee?.id &&
        !!targetEmployee?.managerId &&
        accessContext.viewerEmployee.id === targetEmployee.managerId;
      const isCompanyApprover = canCompanyHandleApproval(accessContext);
      if (!isManagerApprover && !isCompanyApprover) {
        return res.status(403).json({ error: "Seul le manager concerné ou les RH peuvent escalader." });
      }
      if (currentWorkflow.approvalStage === "PENDING_HR") {
        return res.status(400).json({ error: "La demande est déjà en attente RH." });
      }

      await writeActionLog({
        tenantId: tid,
        leaveId: leave.id,
        actorId: uid,
        action: "ESCALATE",
        fromStatus: leave.status,
        toStatus: leave.status,
        reason,
        meta: {
          to: "HR",
          managerUserId: targetEmployee?.manager?.userId || null,
          approvalStage: "PENDING_HR",
          previousApprovalStage: currentWorkflow.approvalStage,
        },
      });

      const hrUserIds = await listHrUserIds(tid);
      const notified = await notifyMany({
        tenantId: tid,
        userIds: hrUserIds.filter((id) => id !== uid),
        actorId: uid,
        type: "LEAVE_ESCALATED_TO_HR",
        title: "Escalade absence vers RH",
        body: `${leave.employee || fullName(targetEmployee) || "Employé"}: demande à traiter en fallback RH.`,
        data: {
          leaveId: leave.id,
          employeeId: leave.employeeId,
          reason,
        },
      });

      if (targetEmployee?.userId) {
        await notifyMany({
          tenantId: tid,
          userIds: [targetEmployee.userId],
          actorId: uid,
          type: "LEAVE_ESCALATED_TO_HR",
          title: "Demande transmise aux RH",
          body: "Votre demande est désormais traitée en relais RH.",
          data: {
            leaveId: leave.id,
            employeeId: leave.employeeId,
            reason,
            approvalStage: "PENDING_HR",
          },
        });
      }

      await logAuditEvent({
        tenantId: tid,
        actorId: uid,
        type: "LEAVE_ESCALATE_HR",
        entity: "leave",
        entityId: leave.id,
        payload: {
          employeeId: leave.employeeId,
          reason,
          notified,
        },
        ip: req.ip,
        ua: req.get("user-agent"),
      });

      const [enrichedLeave] = await enrichLeavesForResponse({
        tenantId: tid,
        accessContext,
        leaves: [leave],
      });

      return res.json({
        ok: true,
        notified,
        leave: enrichedLeave,
        message: "La demande est maintenant en attente RH.",
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
);

/**
 * PUT /operations/leaves/bulk-status
 */
router.put("/bulk-status", requirePermissions(["operations_bulk_update", "operations_write"], "anyOf"), async (req, res) => {
  try {
    const tid = req.auth?.tid;
    const uid = req.auth?.sub;
    if (!tid || !uid) return res.status(401).json({ error: "Unauthorized" });
    const accessContext = await resolveAccessContext(req);

    const { ids, status, reason } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "ids requis" });

    const s = String(status);
    if (!ALLOWED_STATUS.has(s) || s === "Pending") return res.status(400).json({ error: "Statut invalide" });
    if (!reason || !String(reason).trim()) return res.status(400).json({ error: "Motif requis" });

    const rows = await prisma.leave.findMany({
      where: {
        tenantId: tid,
        id: { in: ids },
        ...buildEmployeeScopeWhere(accessContext, { field: "employeeId" }),
      },
      select: {
        id: true,
        status: true,
        employeeId: true,
        start: true,
        end: true,
        type: true,
        halfDay: true,
      },
    });
    if (rows.length === 0) return res.status(404).json({ error: "Aucune demande trouvée" });

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.leave.updateMany({
        where: {
          tenantId: tid,
          id: { in: rows.map((row) => row.id) },
        },
        data: { status: s },
      });

      for (const r of rows) {
        await tx.leaveActionLog.create({
          data: {
            tenantId: tid,
            leaveId: r.id,
            actorId: uid,
            action: s.toUpperCase(),
            fromStatus: r.status,
            toStatus: s,
            reason: String(reason).trim(),
            meta: { bulk: true },
          },
        });

        await trySyncLeaveBalanceImpactTx(tx, {
          tenantId: tid,
          employeeId: r.employeeId,
          previousLeave: r,
          nextLeave: {
            ...r,
            status: s,
          },
          actorId: uid,
          reasonLabel: "Mise à jour en masse statut absence",
        });
      }

      return updated;
    });

    notify("leave.bulk_status_changed", { ids, tenantId: tid, status: s, reason: String(reason).trim() });

    res.json({ ok: true, count: result.count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Export CSV
 * GET /operations/leaves/export.csv
 *
 * IMPORTANT: doit être déclaré AVANT "/:id" sinon Express match "/export.csv" comme :id
 * (ici on l’a mis après :id dans ton fichier initial -> bug potentiel)
 */
router.get("/export.csv", async (req, res) => {
  try {
    const tid = req.auth?.tid;
    if (!tid) return res.status(401).json({ error: "Unauthorized" });
    const accessContext = await resolveAccessContext(req);

    const { status, from, to } = req.query;
    const where = {
      tenantId: tid,
      ...buildEmployeeScopeWhere(accessContext, { field: "employeeId" }),
    };

    if (status && ALLOWED_STATUS.has(String(status))) where.status = String(status);

    if (from || to) {
      const range = {};
      if (from) range.gte = new Date(from);
      if (to) {
        const d = new Date(to);
        d.setHours(23, 59, 59, 999);
        range.lte = d;
      }
      where.start = range;
    }

    const rows = await prisma.leave.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const header = ["id", "employee", "employeeId", "start", "end", "type", "paid", "halfDay", "status", "createdAt"];
    const lines = [header.join(",")];

    for (const r of rows) {
      lines.push(
        [
          r.id,
          quote(r.employee),
          r.employeeId ?? "",
          r.start.toISOString(),
          r.end.toISOString(),
          r.type ?? "",
          r.paid ? "1" : "0",
          r.halfDay ?? "",
          r.status ?? "",
          r.createdAt.toISOString(),
        ]
          .map((s) => String(s).replaceAll("\n", " "))
          .join(",")
      );
    }

    const csv = lines.join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="leaves_export_${Date.now()}.csv"`);
    res.send(csv);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Stats agrégées
 * GET /operations/leaves/stats
 *
 * IMPORTANT: doit être déclaré AVANT "/:id" sinon Express match "/stats" comme :id
 */
router.get("/stats", async (req, res) => {
  try {
    const tid = req.auth?.tid;
    if (!tid) return res.status(401).json({ error: "Unauthorized" });
    const accessContext = await resolveAccessContext(req);

    const { groupBy = "month", from, to } = req.query;
    const where = {
      tenantId: tid,
      ...buildEmployeeScopeWhere(accessContext, { field: "employeeId" }),
    };

    if (from || to) {
      const rng = {};
      if (from) rng.gte = new Date(from);
      if (to) {
        const d = new Date(to);
        d.setHours(23, 59, 59, 999);
        rng.lte = d;
      }
      where.start = rng;
    }

    const rows = await prisma.leave.findMany({
      where,
      select: { id: true, start: true, type: true, employee: true, status: true },
    });

    const stats = {};
    for (const r of rows) {
      if (r.status !== "Approved") continue;
      const key =
        groupBy === "type"
          ? r.type || "Autre"
          : groupBy === "employee"
          ? r.employee || "Inconnu"
          : `${r.start.getFullYear()}-${String(r.start.getMonth() + 1).padStart(2, "0")}`;
      stats[key] = (stats[key] || 0) + 1;
    }

    res.json({ groupBy, stats });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * Validation métier simplifiée
 * POST /operations/leaves/validate
 *
 * IMPORTANT: doit être déclaré AVANT "/:id" sinon Express match "/validate" comme :id
 */
router.post("/validate", requirePermissions(["operations_write"], "anyOf"), async (req, res) => {
  try {
    const tid = req.auth?.tid;
    if (!tid) return res.status(401).json({ error: "Unauthorized" });
    const accessContext = await resolveAccessContext(req);

    const { employeeId, start, end } = req.body || {};
    if (accessContext.scope !== "COMPANY") {
      if (!employeeId) return res.status(400).json({ error: "employeeId requis" });
      if (!canAccessEmployeeId(accessContext, String(employeeId))) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }
    const startDate = toDateSafe(start);
    const endDate = toDateSafe(end);
    if (!startDate || !endDate) return res.status(400).json({ error: "Dates invalides" });

    const blocking = [];
    const warnings = [];

    const overlaps = await prisma.leave.findFirst({
      where: {
        tenantId: tid,
        employeeId: employeeId ?? undefined,
        status: "Approved",
        AND: [{ start: { lte: endDate } }, { end: { gte: startDate } }],
      },
      select: { id: true, start: true, end: true },
    });
    if (overlaps) blocking.push("Chevauchement avec un congé approuvé existant.");

    if (startDate.getDay() === 0 || endDate.getDay() === 0) {
      warnings.push("La période inclut un dimanche (vérifier jours fériés locaux).");
    }

    res.json({ ok: blocking.length === 0, warnings, blocking });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * DELETE /operations/leaves/:id
 */
router.delete(`/${LEAVE_ID_PARAM}`, requirePermissions(["operations_write"], "anyOf"), async (req, res) => {
  try {
    const tid = req.auth?.tid;
    const uid = req.auth?.sub;
    if (!tid || !uid) return res.status(401).json({ error: "Unauthorized" });
    const accessContext = await resolveAccessContext(req);

    const { id } = req.params;

    const found = await prisma.leave.findFirst({
      where: { id, tenantId: tid },
      select: {
        id: true,
        status: true,
        employeeId: true,
        start: true,
        end: true,
        type: true,
        halfDay: true,
      },
    });
    if (!found) return res.status(404).json({ error: "Demande introuvable" });
    if (!canAccessLeave(accessContext, found)) return res.status(403).json({ error: "Forbidden" });

    await prisma.$transaction(async (tx) => {
      await trySyncLeaveBalanceImpactTx(tx, {
        tenantId: tid,
        employeeId: found.employeeId,
        previousLeave: found,
        nextLeave: null,
        actorId: uid,
        reasonLabel: "Suppression demande d'absence",
      });

      await tx.leaveComment.deleteMany({
        where: { tenantId: tid, leaveId: id },
      });
      await tx.leaveActionLog.deleteMany({
        where: { tenantId: tid, leaveId: id },
      });
      await tx.leave.delete({ where: { id } });
    });

    await logAuditEvent({
      tenantId: tid,
      actorId: uid,
      type: "LEAVE_DELETE",
      entity: "leave",
      entityId: id,
      payload: {
        employeeId: found.employeeId,
        fromStatus: found.status,
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

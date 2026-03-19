const PENDING_MANAGER = "PENDING_MANAGER";
const PENDING_HR = "PENDING_HR";

export function normalizeLeaveApprovalStage(value, fallback = null) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === PENDING_MANAGER || normalized === PENDING_HR) return normalized;
  return fallback;
}

export function getDefaultLeaveApprovalStage(hasManager) {
  return hasManager ? PENDING_MANAGER : PENDING_HR;
}

export function getLeaveApprovalStageLabel(stage, options = {}) {
  const { finalStatus = null } = options;
  const normalizedStatus = String(finalStatus || "").trim().toUpperCase();
  if (normalizedStatus === "APPROVED") return "Approuvée";
  if (normalizedStatus === "REJECTED") return "Rejetée";
  if (stage === PENDING_HR) return "En attente RH";
  return "En attente manager";
}

export function resolveLeaveWorkflowFromLogs({ leave, logs = [], hasManager = false }) {
  const normalizedStatus = String(leave?.status || "").trim().toUpperCase();
  if (normalizedStatus === "APPROVED" || normalizedStatus === "REJECTED") {
    return {
      approvalStage: normalizedStatus,
      approvalStageLabel: getLeaveApprovalStageLabel(null, { finalStatus: normalizedStatus }),
      pending: false,
      escalatedToHr: false,
    };
  }

  let approvalStage = getDefaultLeaveApprovalStage(hasManager);
  let escalatedToHr = !hasManager;

  for (const log of logs) {
    const fromMeta = normalizeLeaveApprovalStage(log?.meta?.approvalStage);
    if (fromMeta) {
      approvalStage = fromMeta;
      escalatedToHr = approvalStage === PENDING_HR || escalatedToHr;
      break;
    }
    if (String(log?.action || "").toUpperCase() === "ESCALATE") {
      approvalStage = PENDING_HR;
      escalatedToHr = true;
      break;
    }
  }

  return {
    approvalStage,
    approvalStageLabel: getLeaveApprovalStageLabel(approvalStage),
    pending: true,
    escalatedToHr,
  };
}

export async function buildLeaveWorkflowMap(prisma, tenantId, leaves = [], options = {}) {
  const { logOrder = "desc" } = options;
  const leaveIds = Array.from(new Set((leaves || []).map((leave) => leave?.id).filter(Boolean)));
  if (!tenantId || !leaveIds.length) return new Map();

  const employeeIds = Array.from(new Set((leaves || []).map((leave) => leave?.employeeId).filter(Boolean)));
  const [logRows, employeeRows] = await Promise.all([
    prisma.leaveActionLog.findMany({
      where: { tenantId, leaveId: { in: leaveIds } },
      orderBy: [{ createdAt: logOrder }, { id: logOrder }],
      select: {
        leaveId: true,
        action: true,
        meta: true,
      },
    }),
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

  const logsByLeaveId = new Map();
  for (const log of logRows) {
    const bucket = logsByLeaveId.get(log.leaveId) || [];
    bucket.push(log);
    logsByLeaveId.set(log.leaveId, bucket);
  }

  const employeesById = new Map(employeeRows.map((row) => [row.id, row]));
  const workflowByLeaveId = new Map();
  for (const leave of leaves) {
    const employee = leave?.employeeId ? employeesById.get(leave.employeeId) || null : null;
    workflowByLeaveId.set(
      leave.id,
      resolveLeaveWorkflowFromLogs({
        leave,
        logs: logsByLeaveId.get(leave.id) || [],
        hasManager: Boolean(employee?.managerId),
      })
    );
  }

  return workflowByLeaveId;
}

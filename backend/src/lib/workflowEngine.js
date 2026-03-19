import { prisma } from "../prisma.js";

const ACTIONS = new Set([
  "SUBMIT",
  "APPROVE",
  "REJECT",
  "REASSIGN",
  "COMMENT",
  "CANCEL",
  "ESCALATE",
]);

async function findApproverByRole(tx, tenantId, roleNames = []) {
  const names = Array.isArray(roleNames)
    ? roleNames.map((n) => String(n || "").trim()).filter(Boolean)
    : [];
  if (!tenantId || !names.length) return null;

  const row = await tx.userRole.findFirst({
    where: {
      role: {
        tenantId,
        name: { in: names },
      },
    },
    select: { userId: true },
    orderBy: { userId: "asc" },
  });

  return row?.userId || null;
}

async function findManagerUserIdFromEmployeeId(tx, tenantId, employeeId) {
  if (!tenantId || !employeeId) return null;

  const row = await tx.employee.findFirst({
    where: { tenantId, id: employeeId },
    select: {
      manager: {
        select: {
          userId: true,
        },
      },
    },
  });

  return row?.manager?.userId || null;
}

async function resolveAssigneeFromStep({
  tx,
  tenantId,
  step,
  resourceType,
  resourceId,
  payload = {},
}) {
  if (!step) return null;

  if (step.approverType === "USER") {
    return step.approverUserId || null;
  }

  if (step.approverType === "ROLE") {
    return findApproverByRole(tx, tenantId, [step.approverRole]);
  }

  if (step.approverType === "HR") {
    return findApproverByRole(tx, tenantId, ["RH", "HR"]);
  }

  if (step.approverType === "MANAGER") {
    // Prefer request context for HR requests.
    if (resourceType === "HrRequest" && resourceId) {
      const row = await tx.hrRequest.findFirst({
        where: { id: resourceId, tenantId },
        select: { employeeId: true },
      });
      const fromRequest = await findManagerUserIdFromEmployeeId(tx, tenantId, row?.employeeId);
      if (fromRequest) return fromRequest;
    }

    // Fallback payload-based resolution.
    const fallbackEmployeeId =
      payload?.employeeId ||
      payload?.targetEmployeeId ||
      payload?.requestEmployeeId ||
      null;

    return findManagerUserIdFromEmployeeId(tx, tenantId, fallbackEmployeeId);
  }

  return null;
}

export async function createWorkflowInstanceForResource({
  tx = prisma,
  tenantId,
  module,
  resourceType,
  resourceId,
  requestedById = null,
  preferredDefinitionCode = null,
  payload = {},
}) {
  if (!tenantId || !module || !resourceType || !resourceId) {
    throw new Error("missing_workflow_resource_context");
  }

  const existing = await tx.workflowInstance.findFirst({
    where: { tenantId, module, resourceType, resourceId },
  });
  if (existing) return existing;

  const definition = await tx.workflowDefinition.findFirst({
    where: {
      tenantId,
      module,
      isActive: true,
      ...(preferredDefinitionCode ? { code: preferredDefinitionCode } : {}),
    },
    include: {
      steps: {
        orderBy: { level: "asc" },
      },
    },
  });

  const firstStep = definition?.steps?.[0] || null;
  const firstAssigneeId = await resolveAssigneeFromStep({
    tx,
    tenantId,
    step: firstStep,
    resourceType,
    resourceId,
    payload,
  });

  const instance = await tx.workflowInstance.create({
    data: {
      tenantId,
      definitionId: definition?.id || null,
      module,
      resourceType,
      resourceId,
      status: "PENDING",
      currentLevel: firstStep?.level || 1,
      requestedById,
      assignedToId: firstAssigneeId,
      submittedAt: new Date(),
    },
  });

  await tx.workflowAction.create({
    data: {
      tenantId,
      instanceId: instance.id,
      actorId: requestedById,
      action: "SUBMIT",
      level: instance.currentLevel,
      payload,
    },
  });

  return instance;
}

export async function applyWorkflowAction({
  tx = prisma,
  tenantId,
  instanceId,
  actorId = null,
  action,
  comment = null,
  payload = {},
}) {
  if (!tenantId || !instanceId) throw new Error("missing_workflow_action_context");

  const normalized = String(action || "").toUpperCase();
  if (!ACTIONS.has(normalized)) throw new Error("invalid_workflow_action");

  const instance = await tx.workflowInstance.findFirst({
    where: { id: instanceId, tenantId },
    include: {
      definition: {
        include: {
          steps: { orderBy: { level: "asc" } },
        },
      },
    },
  });

  if (!instance) throw new Error("workflow_instance_not_found");

  let updateData = {};

  if (normalized === "APPROVE") {
    const nextLevel = (instance.currentLevel || 1) + 1;
    const nextStep = instance.definition?.steps?.find((s) => s.level === nextLevel) || null;
    if (nextStep) {
      const nextAssigneeId = await resolveAssigneeFromStep({
        tx,
        tenantId,
        step: nextStep,
        resourceType: instance.resourceType,
        resourceId: instance.resourceId,
        payload,
      });
      updateData = {
        currentLevel: nextLevel,
        assignedToId: nextAssigneeId,
        status: "PENDING",
      };
    } else {
      updateData = {
        status: "APPROVED",
        decidedAt: new Date(),
        assignedToId: null,
      };
    }
  } else if (normalized === "REJECT") {
    updateData = {
      status: "REJECTED",
      decidedAt: new Date(),
      assignedToId: null,
    };
  } else if (normalized === "CANCEL") {
    updateData = {
      status: "CANCELED",
      decidedAt: new Date(),
      assignedToId: null,
    };
  } else if (normalized === "REASSIGN") {
    updateData = {
      assignedToId:
        payload && typeof payload.assignedToId === "string"
          ? payload.assignedToId
          : instance.assignedToId,
    };
  }

  const updated =
    Object.keys(updateData).length > 0
      ? await tx.workflowInstance.update({ where: { id: instance.id }, data: updateData })
      : instance;

  await tx.workflowAction.create({
    data: {
      tenantId,
      instanceId: instance.id,
      actorId,
      action: normalized,
      level: instance.currentLevel,
      comment,
      payload,
    },
  });

  return updated;
}

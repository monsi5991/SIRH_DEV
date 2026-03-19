import express from "express";
import { prisma } from "../prisma.js";
import { getScopedEmployeeIds, resolveAccessContext } from "../lib/accessScope.js";

const router = express.Router();

const DEFAULT_ENTITY_TYPES = [
  "employees",
  "leaves",
  "timesheets",
  "expenses",
  "requests",
  "documents",
  "goals",
  "notifications",
  "onboarding",
  "offboarding",
];

function parseSince(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return new Date("1970-01-01T00:00:00.000Z");
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function normalizeEntityTypes(rawValue) {
  const input = String(rawValue || "").trim();
  if (!input) return DEFAULT_ENTITY_TYPES;
  return Array.from(
    new Set(
      input
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
        .filter((value) => DEFAULT_ENTITY_TYPES.includes(value))
    )
  );
}

function buildEmployeeScopedWhere(accessContext, field = "employeeId") {
  const ids = getScopedEmployeeIds(accessContext, { includeSelfInTeam: true });
  if (ids === null) return {};
  if (!ids.length) return { [field]: { in: ["__none__"] } };
  return { [field]: { in: ids } };
}

function buildSinceWhere(field, since) {
  return { [field]: { gt: since } };
}

router.get("/changes", async (req, res) => {
  try {
    const tenantId = req.auth?.tid;
    const userId = req.auth?.sub;
    if (!tenantId || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const since = parseSince(req.query.since);
    if (!since) {
      return res.status(400).json({ error: "since_invalide" });
    }

    const entityTypes = normalizeEntityTypes(req.query.entity_types);
    const accessContext = await resolveAccessContext(req);
    const employeeScope = buildEmployeeScopedWhere(accessContext);
    const employeeIds = getScopedEmployeeIds(accessContext, { includeSelfInTeam: true });
    const employeeIdFilter =
      employeeIds === null ? {} : employeeIds.length ? { employeeId: { in: employeeIds } } : { employeeId: { in: ["__none__"] } };

    const loaders = {
      employees: () =>
        prisma.employee.findMany({
          where: {
            tenantId,
            ...buildEmployeeScopedWhere(accessContext, "id"),
            ...buildSinceWhere("updatedAt", since),
          },
          orderBy: { updatedAt: "asc" },
        }),
      leaves: () =>
        prisma.leave.findMany({
          where: {
            tenantId,
            ...employeeScope,
            ...buildSinceWhere("updatedAt", since),
          },
          orderBy: { updatedAt: "asc" },
        }),
      timesheets: () =>
        prisma.timesheet.findMany({
          where: {
            tenantId,
            ...employeeScope,
            OR: [
              buildSinceWhere("createdAt", since),
              buildSinceWhere("approvedAt", since),
            ],
          },
          orderBy: { createdAt: "asc" },
        }),
      expenses: () =>
        prisma.expense.findMany({
          where: {
            tenantId,
            ...employeeScope,
            ...buildSinceWhere("updatedAt", since),
          },
          orderBy: { updatedAt: "asc" },
        }),
      requests: () =>
        prisma.hrRequest.findMany({
          where: {
            tenantId,
            OR: [
              { ...employeeIdFilter, updatedAt: { gt: since } },
              { requesterUserId: userId, updatedAt: { gt: since } },
            ],
          },
          orderBy: { updatedAt: "asc" },
        }),
      documents: () =>
        prisma.document.findMany({
          where: {
            tenantId,
            ...employeeScope,
            ...buildSinceWhere("createdAt", since),
          },
          orderBy: { createdAt: "asc" },
        }),
      goals: () =>
        prisma.goal.findMany({
          where: {
            tenantId,
            ...employeeScope,
            ...buildSinceWhere("updatedAt", since),
          },
          orderBy: { updatedAt: "asc" },
        }),
      notifications: () =>
        prisma.notification.findMany({
          where: {
            tenantId,
            userId,
            OR: [
              buildSinceWhere("createdAt", since),
              buildSinceWhere("readAt", since),
              buildSinceWhere("sentAt", since),
            ],
          },
          orderBy: { createdAt: "asc" },
        }),
      onboarding: () =>
        prisma.onboardingCase.findMany({
          where: {
            tenantId,
            ...employeeScope,
            ...buildSinceWhere("updatedAt", since),
          },
          orderBy: { updatedAt: "asc" },
        }),
      offboarding: () =>
        prisma.offboardingCase.findMany({
          where: {
            tenantId,
            ...employeeScope,
            ...buildSinceWhere("updatedAt", since),
          },
          orderBy: { updatedAt: "asc" },
        }),
    };

    const changes = {};
    for (const entityType of entityTypes) {
      const load = loaders[entityType];
      if (!load) continue;
      changes[entityType] = await load();
    }

    return res.json({
      sync_timestamp: new Date().toISOString(),
      since: since.toISOString(),
      entity_types: entityTypes,
      changes,
      has_more: false,
    });
  } catch (error) {
    console.error("[sync/changes] error:", error);
    return res.status(500).json({ error: "sync_changes_failed" });
  }
});

export default router;

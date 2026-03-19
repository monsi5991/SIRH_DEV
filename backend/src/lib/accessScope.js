import { prisma } from "../prisma.js";

const TEAM_PERMISSIONS = [
  "team_read",
  "team_write",
  "approvals_read",
  "approvals_write",
];

const COMPANY_PERMISSIONS = ["all", "admin_read"];

function normalizeStringList(values) {
  if (!values) return [];
  return Array.isArray(values) ? values : [values];
}

export function getTenantId(req) {
  return req.auth?.tid || req.auth?.tenantId || req.user?.tenantId || null;
}

export function getUserId(req) {
  return req.auth?.sub || req.user?.id || null;
}

export async function getPermissionSet(req) {
  if (req.__accessScopePermissions instanceof Set) return req.__accessScopePermissions;

  const tenantId = getTenantId(req);
  const userId = getUserId(req);
  if (!tenantId || !userId) {
    req.__accessScopePermissions = new Set();
    return req.__accessScopePermissions;
  }

  const rows = await prisma.userRole.findMany({
    where: {
      userId,
      role: { tenantId },
    },
    select: {
      role: {
        select: {
          rolePermissions: {
            select: { permission: { select: { name: true } } },
          },
        },
      },
    },
  });

  const permissions = new Set();
  for (const row of rows) {
    for (const rolePermission of row.role?.rolePermissions || []) {
      if (rolePermission?.permission?.name) {
        permissions.add(rolePermission.permission.name);
      }
    }
  }

  req.__accessScopePermissions = permissions;
  return permissions;
}

export function hasAnyPermission(permissionsSet, names = []) {
  if (!permissionsSet) return false;
  if (permissionsSet.has("all")) return true;
  const wanted = normalizeStringList(names);
  return wanted.some((name) => permissionsSet.has(name));
}

export async function resolveViewerEmployee(req) {
  if (Object.prototype.hasOwnProperty.call(req, "__accessScopeViewerEmployee")) {
    return req.__accessScopeViewerEmployee;
  }

  const tenantId = getTenantId(req);
  const userId = getUserId(req);
  if (!tenantId || !userId) {
    req.__accessScopeViewerEmployee = null;
    return null;
  }

  const employee = await prisma.employee.findFirst({
    where: { tenantId, userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      managerId: true,
      userId: true,
    },
  });

  req.__accessScopeViewerEmployee = employee || null;
  return req.__accessScopeViewerEmployee;
}

async function resolveTeamEmployeeIds(req, viewerEmployeeId) {
  if (!viewerEmployeeId) return [];

  const cacheKey = `__accessScopeTeam_${viewerEmployeeId}`;
  if (Array.isArray(req[cacheKey])) return req[cacheKey];

  const tenantId = getTenantId(req);
  if (!tenantId) {
    req[cacheKey] = [];
    return req[cacheKey];
  }

  const rows = await prisma.employee.findMany({
    where: { tenantId, managerId: viewerEmployeeId },
    select: { id: true },
  });

  req[cacheKey] = rows.map((row) => row.id);
  return req[cacheKey];
}

export async function resolveAccessContext(req, options = {}) {
  const { includeTeam = true } = options;
  const tenantId = getTenantId(req);
  const userId = getUserId(req);
  if (!tenantId || !userId) {
    return {
      tenantId: null,
      userId: null,
      permissions: new Set(),
      viewerEmployee: null,
      scope: "SELF",
      teamEmployeeIds: [],
    };
  }

  const permissions = await getPermissionSet(req);
  const viewerEmployee = await resolveViewerEmployee(req);

  const canCompany = hasAnyPermission(permissions, COMPANY_PERMISSIONS);
  const canTeam = hasAnyPermission(permissions, TEAM_PERMISSIONS);

  let scope = "SELF";
  if (canCompany) scope = "COMPANY";
  else if (canTeam) scope = "TEAM";

  const teamEmployeeIds =
    scope === "TEAM" && includeTeam && viewerEmployee?.id
      ? await resolveTeamEmployeeIds(req, viewerEmployee.id)
      : [];

  return {
    tenantId,
    userId,
    permissions,
    viewerEmployee,
    scope,
    teamEmployeeIds,
  };
}

export function getScopedEmployeeIds(context, options = {}) {
  const { includeSelfInTeam = true } = options;
  if (!context) return [];
  if (context.scope === "COMPANY") return null;

  const ids = new Set();
  if (context.scope === "SELF") {
    if (context.viewerEmployee?.id) ids.add(context.viewerEmployee.id);
  } else if (context.scope === "TEAM") {
    for (const id of context.teamEmployeeIds || []) ids.add(id);
    if (includeSelfInTeam && context.viewerEmployee?.id) ids.add(context.viewerEmployee.id);
  }

  return Array.from(ids);
}

export function buildEmployeeScopeWhere(context, options = {}) {
  const {
    field = "employeeId",
    includeSelfInTeam = true,
    noneToken = "__none__",
  } = options;

  const ids = getScopedEmployeeIds(context, { includeSelfInTeam });
  if (ids === null) return {};
  if (!ids.length) return { [field]: { in: [noneToken] } };
  return { [field]: { in: ids } };
}

export function canAccessEmployeeId(context, employeeId, options = {}) {
  const { includeSelfInTeam = true } = options;
  if (!employeeId) return false;
  if (context?.scope === "COMPANY") return true;
  const ids = getScopedEmployeeIds(context, { includeSelfInTeam }) || [];
  return ids.includes(employeeId);
}

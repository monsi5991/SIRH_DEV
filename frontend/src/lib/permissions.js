const ROLE_ALIASES = {
  ADMIN: "ADMIN",
  Admin: "ADMIN",
  HR: "HR",
  Rh: "HR",
  RH: "HR",
  Manager: "MANAGER",
  MANAGER: "MANAGER",
  Employee: "EMPLOYEE",
  EMPLOYEE: "EMPLOYEE",
  Finance: "FINANCE",
  FINANCE: "FINANCE",
  IT: "IT",
};

export const ROLES = {
  ADMIN: "ADMIN",
  HR: "HR",
  MANAGER: "MANAGER",
  EMPLOYEE: "EMPLOYEE",
  FINANCE: "FINANCE",
  IT: "IT",
};

export const SCOPES = {
  SELF: "SELF",
  TEAM: "TEAM",
  COMPANY: "COMPANY",
};

export const PERMISSIONS = {
  EMPLOYEE_SELF_READ: "employee.self.read",
  EMPLOYEE_SELF_WRITE: "employee.self.write",
  EMPLOYEE_TEAM_READ: "employee.team.read",
  EMPLOYEE_COMPANY_READ: "employee.company.read",
  EMPLOYEE_COMPANY_WRITE: "employee.company.write",

  TIMEOFF_REQUEST_CREATE: "timeoff.request.create",
  TIMEOFF_REQUEST_READ_SELF: "timeoff.request.read.self",
  TIMEOFF_APPROVE_TEAM: "timeoff.approve.team",
  TIMEOFF_MANAGE_COMPANY: "timeoff.manage.company",

  ATTENDANCE_READ_SELF: "attendance.read.self",
  ATTENDANCE_READ_TEAM: "attendance.read.team",
  ATTENDANCE_MANAGE_COMPANY: "attendance.manage.company",

  TIMESHEET_SUBMIT_SELF: "timesheet.submit.self",
  TIMESHEET_APPROVE_TEAM: "timesheet.approve.team",
  TIMESHEET_MANAGE_COMPANY: "timesheet.manage.company",

  EXPENSE_SUBMIT_SELF: "expense.submit.self",
  EXPENSE_APPROVE_TEAM: "expense.approve.team",
  EXPENSE_MANAGE_COMPANY: "expense.manage.company",

  PERFORMANCE_SELF_READ: "performance.self.read",
  PERFORMANCE_TEAM_MANAGE: "performance.team.manage",

  TRAINING_SELF_READ: "training.self.read",
  TRAINING_MANAGE_COMPANY: "training.manage.company",

  REPORTS_VIEW_TEAM: "reports.view.team",
  REPORTS_VIEW_COMPANY: "reports.view.company",

  ADMIN_MANAGE_COMPANY: "admin.manage.company",
  SECURITY_AUDIT_READ_COMPANY: "security.audit.read.company",
};

const PERMISSION_ALIASES = {
  [PERMISSIONS.EMPLOYEE_SELF_READ]: ["self_read", "directory_read"],
  [PERMISSIONS.EMPLOYEE_SELF_WRITE]: ["self_write", "directory_write", "operations_write"],
  [PERMISSIONS.EMPLOYEE_TEAM_READ]: ["team_read"],
  [PERMISSIONS.EMPLOYEE_COMPANY_READ]: ["directory_read", "admin_read"],
  [PERMISSIONS.EMPLOYEE_COMPANY_WRITE]: ["directory_write", "all"],

  [PERMISSIONS.TIMEOFF_REQUEST_CREATE]: ["operations_write"],
  [PERMISSIONS.TIMEOFF_REQUEST_READ_SELF]: ["operations_read", "self_read"],
  [PERMISSIONS.TIMEOFF_APPROVE_TEAM]: ["approvals_write", "operations_write"],
  [PERMISSIONS.TIMEOFF_MANAGE_COMPANY]: ["operations_write", "all"],

  [PERMISSIONS.ATTENDANCE_READ_SELF]: ["operations_read", "self_read"],
  [PERMISSIONS.ATTENDANCE_READ_TEAM]: ["operations_read", "team_read"],
  [PERMISSIONS.ATTENDANCE_MANAGE_COMPANY]: ["operations_write", "all"],

  [PERMISSIONS.TIMESHEET_SUBMIT_SELF]: ["operations_write"],
  [PERMISSIONS.TIMESHEET_APPROVE_TEAM]: ["approvals_write", "operations_write"],
  [PERMISSIONS.TIMESHEET_MANAGE_COMPANY]: ["operations_write", "all"],

  [PERMISSIONS.EXPENSE_SUBMIT_SELF]: ["operations_write"],
  [PERMISSIONS.EXPENSE_APPROVE_TEAM]: ["approvals_write", "operations_write"],
  [PERMISSIONS.EXPENSE_MANAGE_COMPANY]: ["operations_write", "all"],

  [PERMISSIONS.PERFORMANCE_SELF_READ]: ["self_read", "directory_read"],
  [PERMISSIONS.PERFORMANCE_TEAM_MANAGE]: ["team_write", "approvals_write"],

  [PERMISSIONS.TRAINING_SELF_READ]: ["self_read", "directory_read"],
  [PERMISSIONS.TRAINING_MANAGE_COMPANY]: ["all", "admin_read"],

  [PERMISSIONS.REPORTS_VIEW_TEAM]: ["analytics_read", "team_read"],
  [PERMISSIONS.REPORTS_VIEW_COMPANY]: ["analytics_read", "all"],

  [PERMISSIONS.ADMIN_MANAGE_COMPANY]: ["admin_read", "all"],
  [PERMISSIONS.SECURITY_AUDIT_READ_COMPANY]: ["admin_read", "all"],
};

const asArray = (value) => {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
};

const normalizePermission = (value) => {
  if (value == null) return "";
  return String(value).trim().toLowerCase();
};

const unique = (items) => Array.from(new Set(items.filter(Boolean)));

const expandPermissionCandidates = (permission) => {
  const normalized = normalizePermission(permission);
  if (!normalized) return [];

  const aliases = asArray(PERMISSION_ALIASES[normalized]).map(normalizePermission);
  return unique([normalized, ...aliases, "all"]);
};

export function normalizeRole(role) {
  if (!role) return null;
  const raw = typeof role === "string" ? role.trim() : String(role).trim();
  if (!raw) return null;
  return ROLE_ALIASES[raw] || ROLE_ALIASES[raw.toUpperCase()] || raw.toUpperCase();
}

export function normalizeRoles(roles = []) {
  return asArray(roles)
    .map((r) => normalizeRole(typeof r === "string" ? r : r?.name))
    .filter(Boolean);
}

export function getUserRoles(user) {
  return normalizeRoles(user?.roles || user?.role || []);
}

export function getUserPermissions(user) {
  return unique(
    asArray(user?.permissions)
      .map((p) => normalizePermission(p))
      .filter(Boolean)
  );
}

export function hasRole(user, requiredRoles) {
  const needed = normalizeRoles(requiredRoles);
  if (!needed.length) return true;

  const userRoles = new Set(getUserRoles(user));
  return needed.some((r) => userRoles.has(r));
}

export function hasPermissions(user, requiredPermissions, mode = "allOf") {
  const needed = asArray(requiredPermissions).map(normalizePermission).filter(Boolean);
  if (!needed.length) return true;

  const userPerms = new Set(getUserPermissions(user));
  if (userPerms.has("all")) return true;

  const checkOne = (permission) => {
    const candidates = expandPermissionCandidates(permission);
    return candidates.some((candidate) => userPerms.has(candidate));
  };

  return mode === "anyOf" ? needed.some(checkOne) : needed.every(checkOne);
}

function hasCompanyAccess(user) {
  const roles = new Set(getUserRoles(user));
  const perms = new Set(getUserPermissions(user));
  return (
    roles.has(ROLES.ADMIN) ||
    roles.has(ROLES.HR) ||
    perms.has("all") ||
    perms.has("admin_read")
  );
}

function hasTeamAccess(user) {
  const roles = new Set(getUserRoles(user));
  const perms = new Set(getUserPermissions(user));
  return (
    roles.has(ROLES.MANAGER) ||
    perms.has("team_read") ||
    perms.has("team_write") ||
    perms.has("approvals_read") ||
    perms.has("approvals_write")
  );
}

export function resolveUserEmployeeId(user) {
  return user?.employeeId || user?.employee?.id || null;
}

export function resolveTeamEmployeeIds(employees = [], managerEmployeeId) {
  if (!managerEmployeeId) return [];
  return employees
    .filter((e) => e?.managerId && e.managerId === managerEmployeeId)
    .map((e) => e.id)
    .filter(Boolean);
}

export function hasScopeAccess({
  user,
  requiredScope = SCOPES.COMPANY,
  targetEmployeeId,
  targetManagerId,
  teamEmployeeIds = [],
}) {
  const scope = String(requiredScope || SCOPES.COMPANY).toUpperCase();
  if (scope === SCOPES.COMPANY) return true;

  const userEmployeeId = resolveUserEmployeeId(user);

  if (scope === SCOPES.SELF) {
    if (!targetEmployeeId) return true;
    return !!userEmployeeId && targetEmployeeId === userEmployeeId;
  }

  if (scope === SCOPES.TEAM) {
    if (hasCompanyAccess(user)) return true;

    if (!targetEmployeeId && !targetManagerId) {
      return hasTeamAccess(user);
    }

    if (targetManagerId && userEmployeeId && targetManagerId === userEmployeeId) {
      return true;
    }

    if (targetEmployeeId && userEmployeeId && targetEmployeeId === userEmployeeId) {
      return true;
    }

    if (targetEmployeeId && Array.isArray(teamEmployeeIds)) {
      return teamEmployeeIds.includes(targetEmployeeId);
    }

    return false;
  }

  return false;
}

function normalizeCheckPermissionInput(inputOrUser, permission, options = {}) {
  const isConfigObject =
    inputOrUser &&
    typeof inputOrUser === "object" &&
    Object.prototype.hasOwnProperty.call(inputOrUser, "user") &&
    permission === undefined;

  if (isConfigObject) {
    const cfg = inputOrUser;
    return {
      user: cfg.user,
      requiredRoles: cfg.requiredRoles || cfg.roles || [],
      requiredPermissions: cfg.requiredPermissions || cfg.permissions || cfg.permission || [],
      mode: cfg.mode || "allOf",
      requiredScope: cfg.requiredScope || cfg.scope || SCOPES.COMPANY,
      targetEmployeeId:
        cfg.targetEmployeeId || cfg.resourceOwnerId || cfg.employeeId || null,
      targetManagerId: cfg.targetManagerId || null,
      teamEmployeeIds: cfg.teamEmployeeIds || [],
    };
  }

  return {
    user: inputOrUser,
    requiredRoles: options.requiredRoles || options.roles || [],
    requiredPermissions: permission || options.requiredPermissions || options.permissions || [],
    mode: options.mode || "allOf",
    requiredScope: options.requiredScope || options.scope || SCOPES.COMPANY,
    targetEmployeeId:
      options.targetEmployeeId || options.resourceOwnerId || options.employeeId || null,
    targetManagerId: options.targetManagerId || null,
    teamEmployeeIds: options.teamEmployeeIds || [],
  };
}

export function checkPermission(inputOrUser, permission, options = {}) {
  const {
    user,
    requiredRoles,
    requiredPermissions,
    mode,
    requiredScope,
    targetEmployeeId,
    targetManagerId,
    teamEmployeeIds,
  } = normalizeCheckPermissionInput(inputOrUser, permission, options);

  if (!user) return false;

  const roleOk = hasRole(user, requiredRoles);
  if (!roleOk) return false;

  const permissionOk = hasPermissions(user, requiredPermissions, mode);
  if (!permissionOk) return false;

  return hasScopeAccess({
    user,
    requiredScope,
    targetEmployeeId,
    targetManagerId,
    teamEmployeeIds,
  });
}

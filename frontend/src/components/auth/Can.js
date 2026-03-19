import React from "react";
import PropTypes from "prop-types";
import { useAuth } from "../../contexts/AuthContext";
import { checkPermission, SCOPES } from "../../lib/permissions";

export default function Can({
  permission,
  permissions,
  requiredRoles,
  requiredPermissions,
  mode,
  scope,
  requiredScope,
  resourceOwnerId,
  targetEmployeeId,
  targetManagerId,
  teamEmployeeIds,
  fallback = null,
  children,
}) {
  const { user } = useAuth();

  const wantedPermissions =
    requiredPermissions && requiredPermissions.length
      ? requiredPermissions
      : permissions || permission || [];

  const allowed = checkPermission({
    user,
    requiredRoles,
    requiredPermissions: wantedPermissions,
    mode,
    requiredScope: scope || requiredScope,
    targetEmployeeId: targetEmployeeId || resourceOwnerId || null,
    targetManagerId,
    teamEmployeeIds,
  });

  return allowed ? <>{children}</> : <>{fallback}</>;
}

Can.propTypes = {
  permission: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
  permissions: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
  requiredRoles: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
  requiredPermissions: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
  mode: PropTypes.oneOf(["allOf", "anyOf"]),
  scope: PropTypes.oneOf([SCOPES.SELF, SCOPES.TEAM, SCOPES.COMPANY]),
  requiredScope: PropTypes.oneOf([SCOPES.SELF, SCOPES.TEAM, SCOPES.COMPANY]),
  resourceOwnerId: PropTypes.string,
  targetEmployeeId: PropTypes.string,
  targetManagerId: PropTypes.string,
  teamEmployeeIds: PropTypes.arrayOf(PropTypes.string),
  fallback: PropTypes.node,
  children: PropTypes.node,
};

Can.defaultProps = {
  permission: [],
  permissions: [],
  requiredRoles: [],
  requiredPermissions: [],
  mode: "allOf",
  scope: SCOPES.COMPANY,
  requiredScope: SCOPES.COMPANY,
  resourceOwnerId: null,
  targetEmployeeId: null,
  targetManagerId: null,
  teamEmployeeIds: [],
  fallback: null,
  children: null,
};

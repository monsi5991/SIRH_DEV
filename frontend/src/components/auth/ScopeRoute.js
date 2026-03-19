import React from "react";
import PropTypes from "prop-types";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { checkPermission, SCOPES } from "../../lib/permissions";
import { Button } from "../ui/button";

export default function ScopeRoute({
  requiredRoles,
  permission,
  permissions,
  requiredPermissions,
  mode,
  scope,
  requiredScope,
  resourceOwnerId,
  targetEmployeeId,
  targetManagerId,
  teamEmployeeIds,
  redirectTo,
  deniedTo,
  loadingFallback,
  deniedFallback,
  children,
}) {
  const { loading, kcReady, kcAuthenticated, isAuthenticated, user, error, refresh, logout } = useAuth();
  const location = useLocation();

  const wantedPermissions =
    requiredPermissions && requiredPermissions.length
      ? requiredPermissions
      : permissions || permission || [];

  if (loading || !kcReady) return loadingFallback;

  if (error && !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <h2 className="text-xl font-semibold text-amber-900">Connexion incomplète</h2>
          <p className="mt-2 text-sm text-amber-800">{error}</p>
          <p className="mt-2 text-sm text-amber-700">
            {kcAuthenticated
              ? "Votre session Keycloak est ouverte, mais le profil SIRH n'a pas pu être chargé."
              : "La connexion n'a pas pu être finalisée correctement."}
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <Button variant="outline" onClick={() => refresh().catch(() => {})}>Réessayer</Button>
            {kcAuthenticated ? <Button onClick={logout}>Se déconnecter</Button> : null}
          </div>
        </div>
      </div>
    );
  }

  if (!kcAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  if (!isAuthenticated || !user) {
    return loadingFallback;
  }

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

  if (!allowed) {
    return deniedFallback ?? <Navigate to={deniedTo} state={{ from: location }} replace />;
  }

  return typeof children === "function" ? children({ user }) : children;
}

ScopeRoute.propTypes = {
  requiredRoles: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
  permission: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
  permissions: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
  requiredPermissions: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
  mode: PropTypes.oneOf(["allOf", "anyOf"]),
  scope: PropTypes.oneOf([SCOPES.SELF, SCOPES.TEAM, SCOPES.COMPANY]),
  requiredScope: PropTypes.oneOf([SCOPES.SELF, SCOPES.TEAM, SCOPES.COMPANY]),
  resourceOwnerId: PropTypes.string,
  targetEmployeeId: PropTypes.string,
  targetManagerId: PropTypes.string,
  teamEmployeeIds: PropTypes.arrayOf(PropTypes.string),
  redirectTo: PropTypes.string,
  deniedTo: PropTypes.string,
  loadingFallback: PropTypes.node,
  deniedFallback: PropTypes.node,
  children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
};

ScopeRoute.defaultProps = {
  requiredRoles: [],
  permission: [],
  permissions: [],
  requiredPermissions: [],
  mode: "allOf",
  scope: SCOPES.COMPANY,
  requiredScope: SCOPES.COMPANY,
  resourceOwnerId: null,
  targetEmployeeId: null,
  targetManagerId: null,
  teamEmployeeIds: [],
  redirectTo: "/login",
  deniedTo: "/403",
  loadingFallback: <div className="p-6 text-center">Chargement…</div>,
  deniedFallback: null,
  children: null,
};

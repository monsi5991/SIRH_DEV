import React from "react";
import PropTypes from "prop-types";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export default function ProtectedRoute({
  requiredRole,
  requiredPermissions = [],
  mode = "allOf",
  enforce = "both",
  redirectTo = "/login",
  loadingFallback = <div className="p-6 text-center">Chargement…</div>,
  deniedFallback,
  children,
}) {
  const { loading, kcReady, kcAuthenticated, isAuthenticated, user, hasRole, hasPermissions } = useAuth();
  const location = useLocation();

  // ✅ tant que Keycloak + /me pas stabilisés
  if (loading || !kcReady) return loadingFallback;

  // ✅ pas de session Keycloak => login
  if (!kcAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // ✅ session KC ok mais user DB pas encore chargé (ou /me a fail) => fallback
  if (!isAuthenticated || !user) {
    return loadingFallback;
  }

  const roleOk =
    enforce === "perm"
      ? true
      : requiredRole
      ? hasRole(requiredRole)
      : true;

  const permOk =
    enforce === "role"
      ? true
      : requiredPermissions.length
      ? hasPermissions(requiredPermissions, mode)
      : true;

  if (!roleOk || !permOk) {
    return deniedFallback ?? <Navigate to="/403" state={{ from: location }} replace />;
  }

  return typeof children === "function" ? children({ user }) : children;
}

ProtectedRoute.propTypes = {
  requiredRole: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
  requiredPermissions: PropTypes.arrayOf(PropTypes.string),
  mode: PropTypes.oneOf(["allOf", "anyOf"]),
  enforce: PropTypes.oneOf(["role", "perm", "both"]),
  redirectTo: PropTypes.string,
  loadingFallback: PropTypes.node,
  deniedFallback: PropTypes.node,
  children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
};

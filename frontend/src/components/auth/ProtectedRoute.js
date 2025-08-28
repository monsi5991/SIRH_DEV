// frontend/src/components/auth/ProtectedRoute.js
import React from "react";
import PropTypes from "prop-types";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export default function ProtectedRoute({
  requiredRole,                 // string | string[]
  requiredPermissions = [],     // string[]
  mode = "allOf",               // 'allOf' | 'anyOf'
  enforce = "both",             // 'role' | 'perm' | 'both'
  redirectTo = "/login",
  loadingFallback = <div className="p-6 text-center">Chargement…</div>,
  deniedFallback,
  children,
}) {
  const { loading, authLoading, isAuthenticated, user, hasRole, hasPermissions } = useAuth();
  const location = useLocation();

  if (loading || authLoading) return loadingFallback;
  if (!isAuthenticated) return <Navigate to={redirectTo} state={{ from: location }} replace />;

  const roleOk = enforce === "perm" ? true : requiredRole ? hasRole(requiredRole) : true;
  const permOk = enforce === "role" ? true : requiredPermissions.length ? hasPermissions(requiredPermissions, mode) : true;

  if (!roleOk || !permOk) return deniedFallback ?? <Navigate to="/403" state={{ from: location }} replace />;

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

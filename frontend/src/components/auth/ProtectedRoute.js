import React from "react";
import PropTypes from "prop-types";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../ui/button";

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
  const { loading, kcReady, kcAuthenticated, isAuthenticated, user, error, refresh, logout, hasRole, hasPermissions } = useAuth();
  const location = useLocation();

  // ✅ tant que Keycloak + /me pas stabilisés
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

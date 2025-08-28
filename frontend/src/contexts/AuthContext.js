import React, {
  createContext, useContext, useEffect, useMemo, useState, useCallback
} from "react";
import PropTypes from "prop-types";
import * as api from "../lib/api";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);        // boot
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await api.get("/me");
        const normalized = normalizeUser(me.user);
        setUser(normalized);
        localStorage.setItem("sirh_user", JSON.stringify(normalized));
      } catch (e) {
        // non connecté => état propre
        setUser(null);
        localStorage.removeItem("sirh_user");
        localStorage.removeItem("sirh_access");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "sirh_user") {
        const v = e.newValue ? normalizeUser(JSON.parse(e.newValue)) : null;
        setUser(v);
      }
      // si un autre onglet remplace le token: noop (api lit le localStorage)
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const saveAccess = (token) => {
    if (!token) localStorage.removeItem("sirh_access");
    else localStorage.setItem("sirh_access", token);
  };

  const login = useCallback(async (email, password) => {
    setAuthLoading(true); setAuthError(null);
    try {
      const data = await api.post("/auth/login", { email, password }, { credentials: "include" });
      const normalized = normalizeUser(data.user);
      setUser(normalized);
      localStorage.setItem("sirh_user", JSON.stringify(normalized));
      if (data?.accessToken) saveAccess(data.accessToken);
      return { success: true, user: normalized };
    } catch (e) {
      setAuthError(e.message || "Erreur de connexion");
      return { success: false, error: e.message || "Erreur de connexion" };
    } finally { setAuthLoading(false); }
  }, []);

  const register = useCallback(async (form) => {
    setAuthLoading(true); setAuthError(null);
    try {
      const data = await api.post("/auth/register", form, { credentials: "include" });
      const normalized = normalizeUser(data.user);
      setUser(normalized);
      localStorage.setItem("sirh_user", JSON.stringify(normalized));
      if (data?.accessToken) saveAccess(data.accessToken);
      return { success: true, user: normalized };
    } catch (e) {
      setAuthError(e.message || "Erreur d’inscription");
      return { success: false, error: e.message || "Erreur d’inscription" };
    } finally { setAuthLoading(false); }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout", {}, { credentials: "include" });
    } catch (e) {
      // on s’assure tout de même d’invalider localement
      console.warn("Logout: appel backend en erreur (continuation locale).", e);
    }
    localStorage.removeItem("sirh_user");
    localStorage.removeItem("sirh_access");
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await api.get("/me");
      const normalized = normalizeUser(me.user);
      setUser(normalized);
      localStorage.setItem("sirh_user", JSON.stringify(normalized));
    } catch (e) {
      console.warn("Refresh user failed, cleanup.", e);
      setUser(null);
      localStorage.removeItem("sirh_user");
      localStorage.removeItem("sirh_access");
    }
  }, []);

  const hasRole = useCallback((required) => {
    if (!user) return false;
    const roles = Array.isArray(user.roles) ? user.roles : (user?.role ? [user.role] : []);
    const req = Array.isArray(required) ? required : [required];
    return req.some((r) => roles.includes(r));
  }, [user]);

  const hasPermission = useCallback((permission) => {
    const perms = Array.isArray(user?.permissions) ? user.permissions : [];
    return perms.includes("all") || perms.includes(permission);
  }, [user]);

  const hasPermissions = useCallback((required, mode = "allOf") => {
    const req = Array.isArray(required) ? required : [required];
    const perms = Array.isArray(user?.permissions) ? user.permissions : [];
    if (perms.includes("all")) return true;
    return mode === "allOf" ? req.every((p) => perms.includes(p)) : req.some((p) => perms.includes(p));
  }, [user]);

  const canAccessModule = useCallback((module) => {
    const modules = user?.dashboardConfig?.modules || [];
    return modules.includes(module);
  }, [user]);

  const value = useMemo(() => ({
    user,
    loading,
    authLoading,
    authError,
    isAuthenticated: !!user,
    login,
    logout,
    register,
    refresh,
    hasRole,
    hasPermission,
    hasPermissions,
    canAccessModule,
    updateUser: (patch) => setUser((prev) => {
      const next = normalizeUser({ ...(prev || {}), ...(patch || {}) });
      localStorage.setItem("sirh_user", JSON.stringify(next));
      return next;
    }),
  }), [user, loading, authLoading, authError, login, logout, register, refresh, hasRole, hasPermission, hasPermissions, canAccessModule]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = {
  children: PropTypes.node,
};

function normalizeUser(u) {
  if (!u) return null;
  return {
    ...u,
    roles: Array.isArray(u.roles) ? u.roles : (u.role ? [u.role] : []),
    permissions: Array.isArray(u.permissions) ? u.permissions : [],
    dashboardConfig: u.dashboardConfig || { modules: [] },
  };
}

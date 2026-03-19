import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import PropTypes from "prop-types";
import * as api from "../lib/api";
import { keycloak, initKeycloakOnce } from "../lib/keycloak";

const AuthContext = createContext(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error("useAuth must be used within <AuthProvider />");
  return ctx;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  // ✅ état d’init Keycloak + chargement /me
  const [kcReady, setKcReady] = useState(false);
  const [kcAuthenticated, setKcAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const normalizeUser = useCallback((u) => {
    if (!u) return null;
    return {
      ...u,
      roles: Array.isArray(u.roles) ? u.roles : [],
      permissions: Array.isArray(u.permissions) ? u.permissions : [],
      dashboardConfig: u.dashboardConfig || { modules: [] },
    };
  }, []);

  const loadMe = useCallback(async () => {
    const me = await api.get("/me");
    setUser(normalizeUser(me.user));
    setError("");
  }, [normalizeUser]);

  // ✅ BOOT: init Keycloak, puis /me si authentifié
  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      try {
        const authenticated = await initKeycloakOnce();
        if (!mounted) return;

        setKcReady(true);
        setKcAuthenticated(!!authenticated);

        if (authenticated) {
          await loadMe();
        } else {
          setUser(null);
          setError("");
        }
      } catch (e) {
        console.warn("Auth boot failed:", e);
        if (mounted) {
          setKcReady(true);
          setKcAuthenticated(!!keycloak.authenticated);
          setUser(null);
          setError(e?.message || "Impossible de charger votre profil SIRH.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [loadMe]);

  // ✅ Refresh token périodique
  useEffect(() => {
    const t = setInterval(() => {
      if (!keycloak.authenticated) return;
      keycloak.updateToken(30).catch(() => {});
    }, 10_000);
    return () => clearInterval(t);
  }, []);

  const login = useCallback(async () => {
    setError("");
    await initKeycloakOnce();
    await keycloak.login({ redirectUri: window.location.origin + "/" });
  }, []);

  const logout = useCallback(async () => {
    try {
      await keycloak.logout({ redirectUri: window.location.origin + "/" });
    } finally {
      setUser(null);
      setError("");
      setKcAuthenticated(false);
    }
  }, []);

  const refreshUserFromApi = useCallback(async () => {
    if (!keycloak.authenticated) return;
    setLoading(true);
    try {
      await loadMe();
      setKcAuthenticated(true);
    } catch (e) {
      setUser(null);
      setError(e?.message || "Impossible de charger votre profil SIRH.");
      throw e;
    } finally {
      setLoading(false);
    }
  }, [loadMe]);

  const hasRole = useCallback(
    (required) => {
      if (!user) return false;
      const roles = Array.isArray(user.roles) ? user.roles : [];
      const req = Array.isArray(required) ? required : [required];
      return req.some((r) => roles.includes(r));
    },
    [user]
  );

  const hasPermission = useCallback(
    (permission) => {
      const perms = Array.isArray(user?.permissions) ? user.permissions : [];
      return perms.includes("all") || perms.includes(permission);
    },
    [user]
  );

  const hasPermissions = useCallback(
    (required, mode = "allOf") => {
      const req = Array.isArray(required) ? required : [required];
      const perms = Array.isArray(user?.permissions) ? user.permissions : [];
      if (perms.includes("all")) return true;
      return mode === "allOf"
        ? req.every((p) => perms.includes(p))
        : req.some((p) => perms.includes(p));
    },
    [user]
  );

  // ✅ Auth “réel” = Keycloak authentifié + user DB chargé
  const isAuthenticated = !!kcAuthenticated && !!user;

  const value = useMemo(
    () => ({
      user,
      loading,
      kcReady,
      kcAuthenticated,
      isAuthenticated,
      error,
      token: keycloak.token,

      login,
      logout,
      refresh: refreshUserFromApi,

      hasRole,
      hasPermission,
      hasPermissions,
    }),
    [
      user,
      loading,
      kcReady,
      kcAuthenticated,
      isAuthenticated,
      error,
      refreshUserFromApi,
      login,
      logout,
      hasRole,
      hasPermission,
      hasPermissions,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = { children: PropTypes.node };

// frontend/src/contexts/AppContext.js
import React, { createContext, useContext, useMemo, useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import frTranslations from "../i18n/fr.json";
import { get } from "../lib/api";
import { useAuth } from "./AuthContext";

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  // ✅ évite le crash si jamais useAuth est appelé hors provider
  const auth = useAuth();
  const isAuthenticated = !!auth?.isAuthenticated;

  // --- i18n (FR uniquement)
  const t = (key, params = {}) => {
    const keys = key.split(".");
    let value = frTranslations;
    for (const k of keys) value = value?.[k];
    if (typeof value === "string" && params) {
      return value.replace(/\{(\w+)\}/g, (_, p) => params[p] ?? _);
    }
    return value ?? key;
  };

  const formatCurrency = (amount, currency = "XOF") =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      minimumFractionDigits: currency === "XOF" ? 0 : 2,
      maximumFractionDigits: currency === "XOF" ? 0 : 2,
    }).format(amount);

  const formatDate = (date) => {
    if (!date) return "—";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // --- Features / plan
  const [currentPlan] = useState("standard");
  const paidFeatures = new Set(["payroll", "advancedAnalytics"]);
  const availableFeatures = new Set([
    "leaves",
    "timeTracking",
    "expenses",
    "directory",
    "events",
    "payroll",
    "advancedAnalytics",
  ]);

  const hasFeature = (feature) => {
    if (!feature) return true;
    if (!availableFeatures.has(feature)) return false;
    if (paidFeatures.has(feature)) return currentPlan === "panafrica";
    return true;
  };

  const isFeatureLocked = (feature) => {
    if (!feature) return false;
    if (!availableFeatures.has(feature)) return true;
    if (paidFeatures.has(feature)) return currentPlan !== "panafrica";
    return false;
  };

  const currentTenant = { plan: currentPlan };

  // --- Badges (sidebar)
  const [validationCounts, setValidationCounts] = useState({
    leaves: 0,
    timesheets: 0,
    expenses: 0,
    eventsToday: 0,
  });

  const abortRef = useRef(null);

  const refreshValidationCounts = React.useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const s = await get("/dashboard/summary", { signal: controller.signal });
      const p = s?.pendingValidations || {};
      const leaves = p.leaves || 0;
      const timesheets = p.timesheets || 0;
      const expenses = p.expenses || 0;

      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      const todayKey = `${yyyy}-${mm}-${dd}`;

      let eventsToday = 0;
      if (Array.isArray(s?.upcomingEvents)) {
        eventsToday = s.upcomingEvents.filter((e) => {
          const d = new Date(e.date);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
            d.getDate()
          ).padStart(2, "0")}`;
          return key === todayKey;
        }).length;
      }

      setValidationCounts({ leaves, timesheets, expenses, eventsToday });
    } catch (e) {
      if (e?.name === "AbortError") return;
      console.debug("refreshValidationCounts error:", e);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, []);

  useEffect(() => {
    refreshValidationCounts();
    const h = () => refreshValidationCounts();
    window.addEventListener("app:counters:refresh", h);
    return () => {
      window.removeEventListener("app:counters:refresh", h);
      abortRef.current?.abort();
    };
  }, [refreshValidationCounts]);

  const value = useMemo(
    () => ({
      t,
      formatCurrency,
      formatDate,
      currentPlan,
      currentTenant,
      hasFeature,
      isFeatureLocked,
      validationCounts,
      refreshValidationCounts,
      isAuthenticated,
    }),
    [currentPlan, validationCounts, isAuthenticated]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

AppProvider.propTypes = {
  children: PropTypes.node,
};

import { useCallback, useEffect, useMemo, useState } from "react";
import { listEmployeeDocuments, listEmployeePolicies } from "../lib/employeeSelfApi";
import useEmployeeDashboardData from "./useEmployeeDashboardData";

function normalizePolicies(response) {
  return Array.isArray(response?.items) ? response.items : [];
}

export default function useEmployeeDocuments({ auto = true } = {}) {
  const dashboard = useEmployeeDashboardData({ auto });
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(auto);
  const [documentsError, setDocumentsError] = useState("");
  const [policies, setPolicies] = useState([]);
  const [policiesLoading, setPoliciesLoading] = useState(auto);
  const [policiesError, setPoliciesError] = useState("");

  const reloadDocuments = useCallback(async (params = {}) => {
    setDocumentsLoading(true);
    setDocumentsError("");
    try {
      const response = await listEmployeeDocuments({ pageSize: 50, ...params });
      setDocuments(Array.isArray(response?.items) ? response.items : []);
    } catch (e) {
      setDocuments([]);
      setDocumentsError(e?.message || "Impossible de charger les documents RH.");
    } finally {
      setDocumentsLoading(false);
    }
  }, []);

  const reloadPolicies = useCallback(async () => {
    setPoliciesLoading(true);
    setPoliciesError("");
    try {
      const response = await listEmployeePolicies({ pageSize: 12 });
      setPolicies(normalizePolicies(response));
    } catch (e) {
      setPolicies([]);
      setPoliciesError(e?.message || "Impossible de charger les politiques RH.");
    } finally {
      setPoliciesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!auto) return;
    reloadDocuments();
  }, [auto, reloadDocuments]);

  useEffect(() => {
    if (!auto) return;
    reloadPolicies();
  }, [auto, reloadPolicies]);

  return useMemo(
    () => ({
      dashboardData: dashboard.data,
      dashboardLoading: dashboard.loading,
      dashboardError: dashboard.error,
      reloadDashboard: dashboard.reload,
      documents,
      documentsLoading,
      documentsError,
      reloadDocuments,
      policies,
      policiesLoading,
      policiesError,
      reloadPolicies,
      reloadAll: async () => {
        await Promise.allSettled([dashboard.reload(), reloadDocuments(), reloadPolicies()]);
      },
    }),
    [
      dashboard.data,
      dashboard.loading,
      dashboard.error,
      dashboard.reload,
      documents,
      documentsLoading,
      documentsError,
      reloadDocuments,
      policies,
      policiesLoading,
      policiesError,
      reloadPolicies,
    ]
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { listEmployeePolicies } from "../lib/employeeSelfApi";

export default function useEmployeeHelpResources({ auto = true } = {}) {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(auto);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await listEmployeePolicies({ pageSize: 20 });
      setPolicies(Array.isArray(response?.items) ? response.items : []);
    } catch (e) {
      setPolicies([]);
      setError(e?.message || "Impossible de charger les ressources RH.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!auto) return;
    reload();
  }, [auto, reload]);

  return useMemo(
    () => ({
      policies,
      loading,
      error,
      reload,
    }),
    [policies, loading, error, reload]
  );
}

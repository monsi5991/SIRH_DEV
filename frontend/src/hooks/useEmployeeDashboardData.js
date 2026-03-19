import { useCallback, useEffect, useState } from "react";
import { get } from "../lib/api";

export default function useEmployeeDashboardData({ auto = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(auto);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await get("/dashboard/employee");
      setData(response || null);
    } catch (e) {
      setData(null);
      setError(e?.message || "Impossible de charger les données employé.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!auto) return;
    reload();
  }, [auto, reload]);

  return { data, loading, error, reload };
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { getEmployeePayslipPreview, listEmployeePayslips } from "../lib/employeeSelfApi";

export default function useEmployeePayslips({ period, auto = true } = {}) {
  const [items, setItems] = useState([]);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(auto);
  const [error, setError] = useState("");
  const [noEmployee, setNoEmployee] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    setNoEmployee(false);
    try {
      const [slips, previewResponse] = await Promise.allSettled([
        listEmployeePayslips(period),
        getEmployeePayslipPreview(period),
      ]);

      if (slips.status === "fulfilled") {
        setItems(Array.isArray(slips.value?.items) ? slips.value.items : []);
      } else {
        const code = slips.reason?.payload?.error || slips.reason?.message;
        if (code === "employee_not_found") setNoEmployee(true);
        setItems([]);
      }

      if (previewResponse.status === "fulfilled") {
        setPreview(previewResponse.value || null);
      } else {
        const code = previewResponse.reason?.payload?.error || previewResponse.reason?.message;
        if (code === "employee_not_found") setNoEmployee(true);
        setPreview(null);
      }
    } catch (e) {
      setItems([]);
      setPreview(null);
      setError(e?.message || "Impossible de charger les bulletins de paie.");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    if (!auto) return;
    reload();
  }, [auto, reload]);

  return useMemo(
    () => ({
      items,
      preview,
      loading,
      error,
      noEmployee,
      reload,
    }),
    [items, preview, loading, error, noEmployee, reload]
  );
}

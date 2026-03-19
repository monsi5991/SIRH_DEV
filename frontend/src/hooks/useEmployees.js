// src/hooks/useEmployees.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { get, post, patch as httpPatch } from "../lib/api";

/** Petit util debounce contrôlé */
export function useDebouncedValue(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

// Normalisation réponses API
function normalizeList(res) {
  if (!res) return { items: [], total: 0 };
  if (Array.isArray(res)) return { items: res, total: res.length };
  if (Array.isArray(res.employees)) return { items: res.employees, total: Number(res.total ?? res.employees.length) };
  if (Array.isArray(res.items)) return { items: res.items, total: Number(res.total ?? res.items.length) };
  if (Array.isArray(res.data)) return { items: res.data, total: Number(res.total ?? res.data.length) };
  return { items: [], total: 0 };
}

/**
 * Liste paginée d’employés
 * params: { q, search, country, department, site, status, page, pageSize }
 * -> essaie /people/employees puis fallback /employees
 */
export function useEmployees(params) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const abortRef = useRef(null);

  // ⚠️ MEMO: stabilise l’objet dépendance pour éviter les boucles
  const stableParams = useMemo(() => {
    const {
      search = "",
      q, // compat
      country = "",
      department = "",
      site = "",
      status = "",
      page = 1,
      pageSize = 12,
    } = params || {};
    const query = (q ?? search ?? "").trim();
    return { q: query, search: query, country, department, site, status, page, pageSize };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    params?.search,
    params?.q,
    params?.country,
    params?.department,
    params?.site,
    params?.status,
    params?.page,
    params?.pageSize,
  ]);

  const refetch = useCallback(async () => {
    // Annule la requête précédente si elle est en cours
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError("");

    try {
      const qs = new URLSearchParams({
        // on envoie à la fois search et q pour couvrir les 2 versions backend
        search: stableParams.search || "",
        q: stableParams.q || "",
        country: stableParams.country || "",
        department: stableParams.department || "",
        site: stableParams.site || "",
        status: stableParams.status || "",
        page: String(stableParams.page || 1),
        pageSize: String(stableParams.pageSize || 12),
      }).toString();

      // ✅ nouvelle route
      let res = await get(`/people/employees?${qs}`, { signal: controller.signal }).catch(async () => {
        // ⬇️ fallback ancienne route
        return await get(`/employees?${qs}`, { signal: controller.signal });
      });

      const { items: list, total } = normalizeList(res);
      setItems(list);
      setTotal(total);
    } catch (e) {
      if (controller.signal.aborted) return;
      setItems([]);
      setTotal(0);
      setError(e?.message || "Échec du chargement des employés");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [stableParams]);

  useEffect(() => {
    refetch();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [refetch]);

  return { items, total, loading, error, refetch, setItems };
}

/**
 * Détail employé
 * -> essaie /people/employees/:id puis fallback /employees/:id
 */
export function useEmployeeDetail(employeeId) {
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(!!employeeId);
  const [error, setError] = useState("");
  const abortRef = useRef(null);

  const refetch = useCallback(async () => {
    if (!employeeId) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError("");

    try {
      // ✅ nouvelle route
      let res = await get(`/people/employees/${employeeId}`, { signal: controller.signal }).catch(async () => {
        // ⬇️ fallback ancienne route
        return await get(`/employees/${employeeId}`, { signal: controller.signal });
      });

      setEmployee(res?.employee || res?.item || res || null);
    } catch (e) {
      if (controller.signal.aborted) return;
      setEmployee(null);
      setError(e?.message || "Échec du chargement de l’employé");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    refetch();
    return () => abortRef.current?.abort();
  }, [refetch]);

  return { employee, loading, error, refetch, setEmployee };
}

/* =========================================================
 * Pass-through utilitaires (création / update / upload)
 * -> ciblent d’abord /people/* puis fallback
 * ========================================================= */

export async function createEmployee(body) {
  try {
    return await post("/people/employees", body);
  } catch (_) {
    // fallback legacy
    return await post("/employees", body);
  }
}

export async function updateEmployee(id, body) {
  try {
    return await httpPatch(`/people/employees/${id}`, body);
  } catch (_) {
    // fallback legacy
    return await httpPatch(`/employees/${id}`, body);
  }
}

export async function uploadEmployeeDocument(employeeId, payload) {
  const { file, label, type = "autre", expiresAt } = payload || {};
  const fd = new FormData();
  if (file) fd.append("file", file);
  if (label) fd.append("label", label);
  if (type) fd.append("type", type);
  if (expiresAt) fd.append("expiresAt", expiresAt);

  try {
    return await post(`/people/employees/${employeeId}/documents`, fd);
  } catch (_) {
    return await post(`/employees/${employeeId}/documents`, fd);
  }
}

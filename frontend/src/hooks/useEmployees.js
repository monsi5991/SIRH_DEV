// src/hooks/useEmployees.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchEmployees as apiFetchEmployees,
  fetchEmployee as apiFetchEmployee,
  createEmployee as apiCreateEmployee,
  updateEmployee as apiUpdateEmployee,
  uploadEmployeeDocument as apiUploadEmployeeDocument,
} from "../lib/peopleApi";

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
  if (Array.isArray(res.items)) return { items: res.items, total: Number(res.total ?? res.items.length) };
  if (Array.isArray(res.data)) return { items: res.data, total: Number(res.total ?? res.data.length) };
  return { items: [], total: 0 };
}

/**
 * Liste paginée d’employés
 * params: { q, country, department, site, status, page, pageSize }
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
    return { q: query, country, department, site, status, page, pageSize };
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
      const res = await apiFetchEmployees(stableParams, { signal: controller.signal });
      const { items, total } = normalizeList(res);
      setItems(items);
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
      const res = await apiFetchEmployee(employeeId, { signal: controller.signal });
      setEmployee(res || null);
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

// Pass-through utilitaires (pour réutiliser dans tes pages)
export const createEmployee = (body) => apiCreateEmployee(body);
export const updateEmployee = (id, body) => apiUpdateEmployee(id, body);
export const uploadEmployeeDocument = (employeeId, payload) =>
  apiUploadEmployeeDocument(employeeId, payload);

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addEmployeeRequestComment,
  cancelEmployeeRequest,
  createEmployeeRequest,
  getEmployeeRequest,
  listEmployeeRequests,
} from "../lib/employeeSelfApi";

function normalizeItems(response) {
  return Array.isArray(response?.items) ? response.items : [];
}

export default function useEmployeeRequests({ initialFilters = {}, auto = true } = {}) {
  const [filters, setFilters] = useState({
    status: initialFilters.status || "",
    scope: initialFilters.scope || "self",
    type: initialFilters.type || "",
  });
  const [items, setItems] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [loading, setLoading] = useState(auto);
  const [detailLoading, setDetailLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await listEmployeeRequests(filters);
      setItems(normalizeItems(response));
    } catch (e) {
      setItems([]);
      setError(e?.message || "Impossible de charger les demandes RH.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (!auto) return;
    reload();
  }, [auto, reload]);

  const loadDetail = useCallback(async (id) => {
    if (!id) return null;
    setDetailLoading(true);
    try {
      const response = await getEmployeeRequest(id);
      setSelectedRequest(response || null);
      return response;
    } catch (_e) {
      setSelectedRequest(null);
      return null;
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const create = useCallback(async (payload) => {
    setCreating(true);
    setError("");
    try {
      const created = await createEmployeeRequest(payload);
      await reload();
      if (created?.id) await loadDetail(created.id);
      return created;
    } catch (e) {
      setError(e?.message || "Impossible de créer la demande.");
      throw e;
    } finally {
      setCreating(false);
    }
  }, [loadDetail, reload]);

  const cancel = useCallback(async (id) => {
    await cancelEmployeeRequest(id);
    await reload();
    if (selectedRequest?.id === id) {
      await loadDetail(id).catch(() => {});
    }
  }, [loadDetail, reload, selectedRequest?.id]);

  const addComment = useCallback(async (id, message) => {
    if (!id) return null;
    setCommenting(true);
    setError("");
    try {
      const response = await addEmployeeRequestComment(id, { message });
      if (response?.request) setSelectedRequest(response.request);
      else await loadDetail(id);
      return response?.comment || null;
    } catch (e) {
      setError(e?.message || "Impossible d'ajouter un commentaire.");
      throw e;
    } finally {
      setCommenting(false);
    }
  }, [loadDetail]);

  return useMemo(
    () => ({
      filters,
      setFilters,
      items,
      loading,
      detailLoading,
      creating,
      commenting,
      error,
      selectedRequest,
      reload,
      loadDetail,
      create,
      cancel,
      addComment,
    }),
    [filters, items, loading, detailLoading, creating, commenting, error, selectedRequest, reload, loadDetail, create, cancel, addComment]
  );
}

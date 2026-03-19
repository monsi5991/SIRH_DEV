import { useCallback, useEffect, useMemo, useState } from "react";
import { getEmployeeProfile, updateEmployeeProfileSection } from "../lib/employeeSelfApi";
import { useAuth } from "../contexts/AuthContext";

function normalizeProfile(response) {
  return {
    profile: response?.profile || null,
    meta: response?.meta || {},
  };
}

export default function useEmployeeProfile({ auto = true } = {}) {
  const { refresh } = useAuth();
  const [data, setData] = useState({ profile: null, meta: {} });
  const [loading, setLoading] = useState(auto);
  const [savingSection, setSavingSection] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getEmployeeProfile();
      setData(normalizeProfile(response));
    } catch (e) {
      setData({ profile: null, meta: {} });
      setError(e?.message || "Impossible de charger le profil employé.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!auto) return;
    reload();
  }, [auto, reload]);

  const saveSection = useCallback(
    async (section, values) => {
      setSavingSection(section);
      setError("");
      setSuccess("");
      try {
        const response = await updateEmployeeProfileSection(section, values);
        setData(normalizeProfile(response));
        setSuccess("Vos informations ont été mises à jour.");
        await refresh().catch(() => {});
        return response;
      } catch (e) {
        setError(e?.message || "Impossible de sauvegarder cette section.");
        throw e;
      } finally {
        setSavingSection("");
      }
    },
    [refresh]
  );

  return useMemo(
    () => ({
      data,
      profile: data.profile,
      meta: data.meta,
      loading,
      savingSection,
      error,
      success,
      reload,
      saveSection,
      clearMessages: () => {
        setError("");
        setSuccess("");
      },
    }),
    [data, loading, savingSection, error, success, reload, saveSection]
  );
}

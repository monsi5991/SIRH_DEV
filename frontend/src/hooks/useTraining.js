// src/hooks/useTraining.js
import { useCallback, useEffect, useState } from "react";
import {
  fetchExpiringCerts,
  fetchCourses,
  fetchSessions,
} from "../lib/peopleApi";

// Normalise les différentes formes de réponses API ({items:[]}, [] ou {data:[]})
function normalize(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.items)) return res.items;
  if (res && Array.isArray(res.data)) return res.data;
  return [];
}

/**
 * Certifs qui expirent sous X jours
 */
export function useExpiringCerts(days = 30) {
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refetch = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchExpiringCerts(days);
      setCerts(normalize(res));
    } catch (e) {
      setCerts([]);
      setError(e?.message || "Erreur chargement des certifications");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { certs, loading, error, refetch, setCerts };
}

/**
 * Catalogue de cours
 */
export function useCourses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refetch = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchCourses();
      setCourses(normalize(res));
    } catch (e) {
      setCourses([]);
      setError(e?.message || "Erreur chargement des cours");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { courses, loading, error, refetch, setCourses };
}

/**
 * Sessions planifiées
 */
export function useSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refetch = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchSessions();
      setSessions(normalize(res));
    } catch (e) {
      setSessions([]);
      setError(e?.message || "Erreur chargement des sessions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { sessions, loading, error, refetch, setSessions };
}

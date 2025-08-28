// src/hooks/usePerformance.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchCycles, fetchGoals } from "../lib/peopleApi";

/** Cycles d’évaluation */
export function useCycles() {
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetchCycles(); // GET /performance/cycles
        if (cancelled) return;
        setCycles(Array.isArray(res) ? res : (res?.items || []));
      } catch (e) {
        if (cancelled) return;
        setError(e?.message || "Erreur chargement cycles");
        setCycles([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const refetch = useCallback(async () => {
    let cancelled = false;
    setLoading(true);
    setError("");
    try {
      const res = await fetchCycles();
      if (!cancelled) setCycles(Array.isArray(res) ? res : (res?.items || []));
    } catch (e) {
      if (!cancelled) {
        setError(e?.message || "Erreur chargement cycles");
        setCycles([]);
      }
    } finally {
      if (!cancelled) setLoading(false);
    }
    return () => { cancelled = true; };
  }, []);

  return { cycles, loading, error, refetch };
}

/** Liste d’objectifs – params stabilisés pour éviter les re-fetch en boucle */
export function useGoals(params) {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Clé stable pour les dépendances (évite que {} déclenche à chaque rendu)
  const paramsKey = useMemo(() => JSON.stringify(params || {}), [params]);
  // Référence des params courants pour l’appel réseau
  const latestParamsRef = useRef(params || {});
  latestParamsRef.current = params || {};

  const load = useCallback(async () => {
    let cancelled = false;
    setLoading(true);
    setError("");
    try {
      const res = await fetchGoals(latestParamsRef.current); // GET /performance/goals
      if (!cancelled) {
        setGoals(Array.isArray(res) ? res : (res?.items || []));
      }
    } catch (e) {
      if (!cancelled) {
        setError(e?.message || "Erreur chargement objectifs");
        setGoals([]);
      }
    } finally {
      if (!cancelled) setLoading(false);
    }
    return () => { cancelled = true; };
  }, [paramsKey]); // ⇐ dépend d’une clé string stable, pas de l’objet

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetchGoals(latestParamsRef.current);
        if (cancelled) return;
        setGoals(Array.isArray(res) ? res : (res?.items || []));
      } catch (e) {
        if (cancelled) return;
        setError(e?.message || "Erreur chargement objectifs");
        setGoals([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [paramsKey]);

  return { goals, setGoals, loading, error, refetch: load };
}

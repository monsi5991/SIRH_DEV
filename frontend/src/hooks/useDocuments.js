import { useCallback, useEffect, useState } from 'react';
import {
  listOnboarding, createOnboarding, updateOnboardingStatus, getOnboarding,
  listOffboarding, createOffboarding, updateOffboardingStatus, getOffboarding, uploadDoc
} from '../lib/documentsApi';

const normalize = (res) => Array.isArray(res) ? res : (res?.items || []);

export function useOnboardingCases(params = {}) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refetch = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await listOnboarding(params);
      setItems(normalize(res));
      setTotal(res?.total ?? normalize(res).length);
    } catch (e) {
      setError(e?.message || 'Erreur chargement onboarding');
      setItems([]); setTotal(0);
    } finally { setLoading(false); }
  }, [JSON.stringify(params)]);

  useEffect(() => { refetch(); }, [refetch]);

  return { items, total, loading, error, refetch, setItems,
    create: createOnboarding, setStatus: updateOnboardingStatus, get: getOnboarding, uploadDoc };
}

export function useOffboardingCases(params = {}) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refetch = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await listOffboarding(params);
      setItems(normalize(res));
      setTotal(res?.total ?? normalize(res).length);
    } catch (e) {
      setError(e?.message || 'Erreur chargement offboarding');
      setItems([]); setTotal(0);
    } finally { setLoading(false); }
  }, [JSON.stringify(params)]);

  useEffect(() => { refetch(); }, [refetch]);

  return { items, total, loading, error, refetch, setItems,
    create: createOffboarding, setStatus: updateOffboardingStatus, get: getOffboarding, uploadDoc };
}

import { get, post, patch, del } from './api';

// --- ONBOARDING ---
export const listOnboarding = (params = {}) =>
  get('/documents/onboarding/cases', params);

export const createOnboarding = (data) =>
  post('/documents/onboarding/cases', data);

export const updateOnboardingStatus = (id, status) =>
  patch(`/documents/onboarding/cases/${id}/status`, { status });

export const getOnboarding = (id) => get(`/documents/onboarding/cases/${id}`);

export const uploadDoc = (formData) =>
  post('/documents/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

// --- OFFBOARDING ---
export const listOffboarding = (params = {}) =>
  get('/documents/offboarding/cases', params);

export const createOffboarding = (data) =>
  post('/documents/offboarding/cases', data);

export const updateOffboardingStatus = (id, status) =>
  patch(`/documents/offboarding/cases/${id}/status`, { status });

export const getOffboarding = (id) => get(`/documents/offboarding/cases/${id}`);

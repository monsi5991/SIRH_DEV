// frontend/src/lib/documentsApi.js
import { get, post, put } from "./api";

// ------------------------
// Templates
// ------------------------
export const listTemplates = async (category) => {
  // category: "onboarding" | "offboarding"
  const res = await get("/documents/templates", { params: category ? { category } : undefined });
  if (Array.isArray(res?.templates)) return res.templates;
  if (category === "onboarding") return res?.onboarding || [];
  if (category === "offboarding") return res?.offboarding || [];
  return [];
};

// ------------------------
// Onboarding
// ------------------------
export const listOnboarding = (params = {}) =>
  get("/documents/onboarding/cases", { params });

export const startOnboarding = (data) =>
  post("/documents/onboarding/start", data);

export const createOnboarding = startOnboarding;

export const updateOnboardingStatus = (id, data) =>
  put(`/documents/onboarding/cases/${id}`, data);

export const getOnboarding = async (id) => {
  const res = await get(`/documents/onboarding/cases/${id}`);
  return res?.item || null;
};

export const updateOnboardingTask = (caseId, taskId, data) =>
  put(`/documents/onboarding/cases/${caseId}/tasks/${taskId}`, data);

// ------------------------
// Offboarding
// ------------------------
export const listOffboarding = (params = {}) =>
  get("/documents/offboarding/cases", { params });

export const startOffboarding = (data) =>
  post("/documents/offboarding/start", data);

export const createOffboarding = startOffboarding;

export const updateOffboardingStatus = (id, data) =>
  put(`/documents/offboarding/cases/${id}`, data);

export const getOffboarding = async (id) => {
  const res = await get(`/documents/offboarding/cases/${id}`);
  return res?.item || null;
};

export const updateOffboardingTask = (caseId, taskId, data) =>
  put(`/documents/offboarding/cases/${caseId}/tasks/${taskId}`, data);

// ------------------------
// Upload
// ------------------------
export const uploadDoc = (formData) =>
  post("/documents/upload", formData);

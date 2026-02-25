// frontend/src/lib/documentsApi.js
import { get, post } from "./api";

// ------------------------
// Templates
// ------------------------
export const listTemplates = async (category) => {
  // category: "onboarding" | "offboarding"
  const res = await get("/documents/templates", { category });
  // Ton backend renvoie { onboarding: [...], offboarding: [...] }
  // On normalise pour renvoyer juste la liste demandée
  if (category === "onboarding") return res?.onboarding || [];
  if (category === "offboarding") return res?.offboarding || [];
  return [];
};

// ------------------------
// Onboarding
// ------------------------
export const listOnboarding = (params = {}) =>
  get("/documents/onboarding/cases", params);

export const startOnboarding = (data) =>
  post("/documents/onboarding/start", data);

// ------------------------
// Offboarding
// ------------------------
export const listOffboarding = (params = {}) =>
  get("/documents/offboarding/cases", params);

export const startOffboarding = (data) =>
  post("/documents/offboarding/start", data);

// ------------------------
// Upload
// ------------------------
export const uploadDoc = (formData) =>
  post("/documents/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

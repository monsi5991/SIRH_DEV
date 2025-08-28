import { get, post, put, del } from "./api";

/**
 * Détermination robuste de l’URL API, compatible CRA/Webpack/Vite,
 * sans utiliser `import.meta` (qui posait souci avec Babel).
 */
function resolveApiBase() {
  // 1) surcharge à la volée éventuelle
  if (typeof window !== "undefined" && window.__API_URL__) return window.__API_URL__;
  // 2) variables d'env (CRA / Webpack / Vite)
  if (typeof process !== "undefined" && process.env) {
    if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
    if (process.env.API_URL) return process.env.API_URL;
    if (process.env.VITE_API_URL) return process.env.VITE_API_URL;
  }
  // 3) fallback dev
  return "http://localhost:4000";
}

const API_BASE = resolveApiBase();

/* -------------------------------- Employees -------------------------------- */
export const fetchEmployees = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return get(`/people/employees?${q}`);
};

export const fetchEmployee   = (id)      => get(`/people/employees/${id}`);
export const createEmployee  = (body)    => post(`/people/employees`, body);
export const updateEmployee  = (id, body)=> put(`/people/employees/${id}`, body);
export const deleteEmployee  = (id)      => del(`/people/employees/${id}`);

/* -------------------------------- Documents -------------------------------- */
export const uploadEmployeeDocument = async (
  employeeId,
  { file, label, type, expiresAt }
) => {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("label", label);
  if (type) fd.append("type", type);
  if (expiresAt) fd.append("expiresAt", expiresAt);

  const res = await fetch(`${API_BASE}/people/employees/${employeeId}/documents`, {
    method: "POST",
    body: fd,
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Upload failed");
  return data;
};

export const deleteDocument = (docId) => del(`/people/documents/${docId}`);

/* ------------------------------- Performance -------------------------------- */
export const fetchCycles = () => get(`/performance/cycles`);
export const createCycle = (body) => post(`/performance/cycles`, body);

export const fetchGoals = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return get(`/performance/goals?${q}`);
};
export const createGoal  = (body)    => post(`/performance/goals`, body);
export const updateGoal  = (id, body)=> put(`/performance/goals/${id}`, body);
export const deleteGoal  = (id)      => del(`/performance/goals/${id}`);

// ✅ Détail d’un objectif
export const getGoal = (id) => get(`/performance/goals/${id}`);

/* ------------------------- Training (Formations / Certifs) ------------------ */
// Certifications qui expirent sous X jours
export const fetchExpiringCerts = (days = 30) =>
  get(`/training/certifications/expiring?days=${days}`);

// Cours
export const fetchCourses = () => get(`/training/courses`);
export const createCourse = (body) => post(`/training/courses`, body);

// Sessions (liste + détail + CRUD + actions)
export const fetchSessions     = ()            => get(`/training/sessions`);
export const getSession        = (id)          => get(`/training/sessions/${id}`);
export const createSession     = (body)        => post(`/training/sessions`, body);
export const updateSession     = (id, body)    => put(`/training/sessions/${id}`, body);
export const enrollToSession   = (sessionId, employeeIds) =>
  post(`/training/sessions/${sessionId}/enroll`, { employeeIds });
export const unenrollFromSession = (sessionId, employeeId) =>
  del(`/training/sessions/${sessionId}/enroll/${employeeId}`);
export const duplicateSession  = (id, body = {}) =>
  post(`/training/sessions/${id}/duplicate`, body);
export const cancelSession     = (id)          =>
  post(`/training/sessions/${id}/cancel`, {});
export const markAttendance    = (id, payload = {}) =>
  post(`/training/sessions/${id}/attendance`, payload);

export { API_BASE }; // utile si tu veux réutiliser la valeur ailleurs

// frontend/src/lib/api.js

// ---- Base URL ----
const BASE_URL =
  (typeof process !== "undefined" && process.env && process.env.REACT_APP_API_URL) ||
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL) ||
  "http://localhost:4000";

// ---- Token helpers ----
const ACCESS_KEY = "sirh_access";

function getAccess() {
  try { return localStorage.getItem(ACCESS_KEY) || ""; } catch { return ""; }
}
function setAccess(token) {
  try {
    if (token) localStorage.setItem(ACCESS_KEY, token);
    else localStorage.removeItem(ACCESS_KEY);
  } catch { /* ignore */ }
}

function buildAuthHeaders(headers = {}) {
  const t = getAccess();
  return t ? { ...headers, Authorization: `Bearer ${t}` } : headers;
}

// ---- Low-level fetch (sans logique 401) ----
async function rawRequest(
  path,
  { method = "GET", body, headers = {}, credentials = "omit", signal } = {}
) {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const finalHeaders = isFormData
    ? { Accept: "application/json", ...headers }
    : { "Content-Type": "application/json", Accept: "application/json", ...headers };

  let res;
  try {
    res = await fetch(BASE_URL + path, {
      method,
      headers: finalHeaders,
      body: isFormData ? body : body != null ? JSON.stringify(body) : undefined,
      credentials, // "include" pour /auth/refresh, login/register si cookie
      signal,
    });
  } catch (e) {
    // ⚠️ Ne pas transformer un AbortError en "Network error"
    if (e && e.name === "AbortError") {
      const err = new Error("AbortError");
      err.name = "AbortError";
      err.status = 0;
      err.cause = e;
      throw err;
    }
    const err = new Error("Network error");
    err.status = 0;
    err.cause = e;
    throw err;
  }

  const contentType = res.headers.get("content-type") || "";
  let data;
  if (res.status === 204) {
    data = {};
  } else if (contentType.includes("application/json")) {
    try { data = await res.json(); } catch { data = {}; }
  } else {
    const text = await res.text();
    try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
  }

  return { res, data };
}

// ---- Refresh (mutualisé) ----
let refreshingPromise = null;
async function refreshAccessToken() {
  if (!refreshingPromise) {
    refreshingPromise = (async () => {
      const { res, data } = await rawRequest("/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(data?.error || "Refresh failed");
      if (data?.accessToken) setAccess(data.accessToken);
      return true;
    })().finally(() => { refreshingPromise = null; });
  }
  return refreshingPromise;
}

// ---- API publique (auto-refresh 401) ----
export async function request(path, options = {}) {
  let { res, data } = await rawRequest(path, {
    ...options,
    headers: buildAuthHeaders(options.headers),
    credentials: options.credentials ?? "omit",
  });

  if (res.status === 401) {
    try {
      await refreshAccessToken();
      ({ res, data } = await rawRequest(path, {
        ...options,
        headers: buildAuthHeaders(options.headers),
        credentials: options.credentials ?? "omit",
      }));
    } catch {
      setAccess("");
      const err = new Error("Unauthorized");
      err.status = 401;
      throw err;
    }
  }

  if (!res.ok) {
    const msg =
      data?.error ||
      data?.message ||
      (typeof data === "string" ? data : `HTTP ${res.status}`);
    const err = new Error(msg);
    err.status = res.status;
    err.payload = data;
    throw err;
  }

  return data;
}

// ---- Helpers HTTP ----
export const get   = (p, opt)       => request(p, { ...opt, method: "GET" });
export const post  = (p, body, opt) => request(p, { ...opt, method: "POST", body });
export const put   = (p, body, opt) => request(p, { ...opt, method: "PUT", body });
export const patch = (p, body, opt) => request(p, { ...opt, method: "PATCH", body });
export const del   = (p, opt)       => request(p, { ...opt, method: "DELETE" });

// ---- Exports utilitaires ----
export const withAuthHeaders = buildAuthHeaders;
export const _setAccess = setAccess;
export const _getAccess = getAccess;
export const API_BASE_URL = BASE_URL;

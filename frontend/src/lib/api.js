// frontend/src/lib/api.js
import { keycloak, initKeycloakOnce } from "./keycloak";

export const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:4000";

async function readJson(res) {
  const text = await res.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function safeReadError(res) {
  try { return await readJson(res); } catch { return { error: `HTTP ${res.status}` }; }
}

async function ensureToken() {
  await initKeycloakOnce();

  if (!keycloak.authenticated) return null;

  try {
    await keycloak.updateToken(30);
  } catch (e) {
    console.warn("[api] updateToken failed:", e);
  }

  return keycloak.token || null;
}

async function rawRequest(path, { method = "GET", headers = {}, body, signal } = {}) {
  const url = `${API_BASE_URL}${path}`;
  const h = { ...headers };

  if (!h["Content-Type"] && !(body instanceof FormData)) {
    h["Content-Type"] = "application/json";
  }

  const token = await ensureToken();
  if (token && !h.Authorization) {
    h.Authorization = `Bearer ${token}`;
  }

  return fetch(url, {
    method,
    headers: h,
    body:
      body == null ? undefined
      : body instanceof FormData ? body
      : JSON.stringify(body),
    signal,
  });
}

export async function request(path, options = {}) {
  let res = await rawRequest(path, options);

  // ✅ Retry 1 fois si 401 (token expiré / refresh nécessaire)
  if (res.status === 401) {
    try {
      await initKeycloakOnce();
      if (keycloak.authenticated) {
        await keycloak.updateToken(0);
      }
    } catch {}
    res = await rawRequest(path, options);
  }

  if (res.ok) return readJson(res);

  const err = await safeReadError(res);
  throw new Error(err?.error || err?.message || `HTTP ${res.status}`);
}

export const get   = (p, opts = {})        => request(p, { method: "GET", ...opts });
export const post  = (p, b, opts = {})     => request(p, { method: "POST", body: b, ...opts });
export const put   = (p, b, opts = {})     => request(p, { method: "PUT", body: b, ...opts });
export const del   = (p, opts = {})        => request(p, { method: "DELETE", ...opts });
export const patch = (p, b, opts = {})     => request(p, { method: "PATCH", body: b, ...opts });

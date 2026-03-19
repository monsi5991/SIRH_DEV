// frontend/src/lib/api.js
import { API_BASE_URL } from "./env";
import { keycloak, initKeycloakOnce } from "./keycloak";

export { API_BASE_URL };

const DEFAULT_STATUS_MESSAGES = {
  401: "Session expirée ou accès non autorisé.",
  403: "Vous n'avez pas les droits nécessaires pour cette action.",
  404: "La ressource demandée est introuvable.",
  429: "Trop de requêtes. Réessayez dans un instant.",
  500: "Une erreur est survenue côté serveur.",
};

function normalizeErrorMessage(err, status) {
  const rawMessage = String(err?.message || "").trim();
  if (rawMessage) return rawMessage;

  const rawError = String(err?.error || "").trim();
  if (!rawError) return DEFAULT_STATUS_MESSAGES[status] || `HTTP ${status}`;

  const normalized = rawError.toLowerCase();

  if (normalized === "unauthorized") return DEFAULT_STATUS_MESSAGES[401];
  if (normalized === "forbidden") return DEFAULT_STATUS_MESSAGES[403];
  if (normalized === "not found" || normalized.endsWith("_not_found")) {
    return DEFAULT_STATUS_MESSAGES[404];
  }
  if (normalized.includes("cors")) {
    return "Cette application n'est pas autorisée à contacter l'API depuis cet environnement.";
  }
  if (normalized.endsWith("_failed")) {
    return DEFAULT_STATUS_MESSAGES[status] || "Une opération n'a pas pu aboutir.";
  }
  if (normalized === "upload failed") {
    return "Le fichier n'a pas pu être envoyé.";
  }

  return rawError;
}

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

function withQuery(path, params) {
  if (!params || typeof params !== "object") return path;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === "") continue;
    if (Array.isArray(v)) {
      v.forEach((item) => {
        if (item != null && item !== "") qs.append(k, String(item));
      });
      continue;
    }
    qs.append(k, String(v));
  }
  const query = qs.toString();
  if (!query) return path;
  return path.includes("?") ? `${path}&${query}` : `${path}?${query}`;
}

async function rawRequest(path, { method = "GET", headers = {}, body, signal, params } = {}) {
  const url = `${API_BASE_URL}${withQuery(path, params)}`;
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
    } catch (e) {
      // no-op: on retente quand même la requête avec l'état actuel du token
      void e;
    }
    res = await rawRequest(path, options);
  }

  if (res.ok) return readJson(res);

  const err = await safeReadError(res);
  const error = new Error(normalizeErrorMessage(err, res.status));
  error.status = res.status;
  error.payload = err;
  throw error;
}

export const get   = (p, opts = {})        => request(p, { method: "GET", ...opts });
export const post  = (p, b, opts = {})     => request(p, { method: "POST", body: b, ...opts });
export const put   = (p, b, opts = {})     => request(p, { method: "PUT", body: b, ...opts });
export const del   = (p, opts = {})        => request(p, { method: "DELETE", ...opts });
export const patch = (p, b, opts = {})     => request(p, { method: "PATCH", body: b, ...opts });

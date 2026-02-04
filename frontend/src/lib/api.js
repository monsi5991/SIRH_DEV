// frontend/src/lib/api.js
// Client HTTP minimal avec gestion d'auth (Bearer) + refresh automatique

export const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:4000";

// --- utils
async function readJson(res) {
  const text = await res.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch {
    return { raw: text };
  }
}

async function safeReadError(res) {
  try { return await readJson(res); } catch {
    return { error: `HTTP ${res.status}` };
  }
}

// --- accès au token local
export function _getAccess() {
  try {
    return localStorage.getItem("sirh_access") || null;
  } catch (err) {
    console.warn("[api] _getAccess localStorage error:", err);
    return null;
  }
}
export function _setAccess(token) {
  try {
    if (!token) localStorage.removeItem("sirh_access");
    else localStorage.setItem("sirh_access", token);
  } catch (err) {
    console.warn("[api] _setAccess localStorage error:", err);
  }
}
export function _clearAccess() {
  try {
    localStorage.removeItem("sirh_access");
  } catch (err) {
    console.warn("[api] _clearAccess localStorage error:", err);
  }
}

// --- requêtes brutes
async function rawRequest(path, { method = "GET", headers = {}, body, credentials } = {}) {
  const url = `${API_BASE_URL}${path}`;

  const h = { "Content-Type": "application/json", ...headers };

  // ajoute le Bearer si dispo et pas déjà fourni
  const token = _getAccess();
  if (token && !h.Authorization) h.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
    // NB: on met credentials uniquement si demandé (login/refresh, etc.)
    credentials,
  });

  return res;
}

// --- API conviviale avec retry sur 401 (refresh)
export async function request(path, options = {}) {
  let res = await rawRequest(path, options);

  if (res.ok) return readJson(res);

  // En cas de 401 → tente un refresh via cookie puis rejoue une fois
  if (res.status === 401) {
    const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // indispensable pour envoyer le cookie refresh
    });

    if (refreshRes.ok) {
      const data = await readJson(refreshRes);
      if (data?.accessToken) {
        _setAccess(data.accessToken); // 🔑 on sauve le nouveau token !
      }
      // rejouer la requête initiale
      res = await rawRequest(path, options);
      if (res.ok) return readJson(res);
    }

    // si le refresh échoue → nettoyage et erreur claire
    try {
      _clearAccess();
      localStorage.removeItem("sirh_user");
    } catch (err) {
      console.warn("[api] cleanup after 401 failed:", err);
    }
    const err = await safeReadError(res);
    throw new Error(err?.error || "Unauthorized");
  }

  // autres erreurs
  const err = await safeReadError(res);
  throw new Error(err?.error || `HTTP ${res.status}`);
}

// --- raccourcis
export const get   = (p, opts = {})        => request(p, { method: "GET",    ...opts });
export const post  = (p, b, opts = {})     => request(p, { method: "POST", body: b, ...opts });
export const put   = (p, b, opts = {})     => request(p, { method: "PUT",  body: b, ...opts });
export const del   = (p, opts = {})        => request(p, { method: "DELETE",   ...opts });
// 👇 ajouté pour vos imports existants (useEmployees, EmployeeEditPage, etc.)
export const patch = (p, b, opts = {})     => request(p, { method: "PATCH", body: b, ...opts });

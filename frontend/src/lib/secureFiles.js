import { API_BASE_URL } from "./api";
import { initKeycloakOnce, keycloak } from "./keycloak";

function toAbsoluteApiUrl(url = "") {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const normalized = raw.startsWith("/") ? raw : `/${raw}`;
  return `${API_BASE_URL}${normalized}`;
}

export function isProtectedUploadUrl(url = "") {
  return String(url || "").startsWith("/uploads/");
}

export async function openSecureFileUrl(url, target = "_blank") {
  if (!url) return;
  const absolute = toAbsoluteApiUrl(url);

  if (!isProtectedUploadUrl(url)) {
    window.open(absolute, target, "noopener,noreferrer");
    return;
  }

  await initKeycloakOnce();
  if (!keycloak.authenticated) return;
  await keycloak.updateToken(30).catch(() => {});
  const token = keycloak.token;
  if (!token) return;

  const sep = absolute.includes("?") ? "&" : "?";
  const signed = `${absolute}${sep}access_token=${encodeURIComponent(token)}`;
  window.open(signed, target, "noopener,noreferrer");
}

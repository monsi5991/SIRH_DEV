// frontend/src/lib/keycloak.js
import Keycloak from "keycloak-js";
import { KEYCLOAK_CLIENT_ID, KEYCLOAK_REALM, KEYCLOAK_URL } from "./env";

export const keycloak = new Keycloak({
  url: KEYCLOAK_URL,
  realm: KEYCLOAK_REALM,
  clientId: KEYCLOAK_CLIENT_ID,
});

export function initKeycloakOnce() {
  if (window.__kcInitPromise) return window.__kcInitPromise;

  window.__kcInitPromise = keycloak.init({
    onLoad: "login-required", // ✅ FORCE login
    pkceMethod: "S256",
    checkLoginIframe: false,
  });

  return window.__kcInitPromise;
}

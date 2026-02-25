// frontend/src/lib/keycloak.js
import Keycloak from "keycloak-js";

const url = process.env.REACT_APP_KEYCLOAK_URL || "http://localhost:8080";
const realm = process.env.REACT_APP_KEYCLOAK_REALM || "SIRH";
const clientId = process.env.REACT_APP_KEYCLOAK_CLIENT_ID || "sirh-frontend";

export const keycloak = new Keycloak({
  url,
  realm,
  clientId,
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

const BROWSER_ENV = import.meta.env || {};
const NODE_ENV = typeof process !== "undefined" && process.env ? process.env : {};

function readEnv(...keys) {
  for (const key of keys) {
    const browserValue = BROWSER_ENV[key];
    if (typeof browserValue === "string" && browserValue.trim()) {
      return browserValue.trim();
    }

    const nodeValue = NODE_ENV[key];
    if (typeof nodeValue === "string" && nodeValue.trim()) {
      return nodeValue.trim();
    }
  }

  return "";
}

export const API_BASE_URL = readEnv("VITE_API_URL", "REACT_APP_API_URL", "API_URL") || "http://localhost:4000";
export const KEYCLOAK_URL = readEnv("VITE_KEYCLOAK_URL", "REACT_APP_KEYCLOAK_URL") || "http://localhost:8080";
export const KEYCLOAK_REALM = readEnv("VITE_KEYCLOAK_REALM", "REACT_APP_KEYCLOAK_REALM") || "SIRH";
export const KEYCLOAK_CLIENT_ID =
  readEnv("VITE_KEYCLOAK_CLIENT_ID", "REACT_APP_KEYCLOAK_CLIENT_ID") || "sirh-frontend";

export const APP_MODE =
  readEnv("MODE", "APP_ENV", "NODE_ENV") || (BROWSER_ENV.PROD ? "production" : "development");

export const IS_DEVELOPMENT =
  typeof BROWSER_ENV.DEV === "boolean" ? BROWSER_ENV.DEV : APP_MODE.toLowerCase() !== "production";

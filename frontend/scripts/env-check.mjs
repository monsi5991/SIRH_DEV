#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = { env: null, file: null, fallback: null };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--env=")) args.env = token.split("=")[1] || null;
    else if (token === "--env" && argv[i + 1]) args.env = argv[++i];
    else if (token.startsWith("--file=")) args.file = token.split("=")[1] || null;
    else if (token === "--file" && argv[i + 1]) args.file = argv[++i];
    else if (token.startsWith("--fallback=")) args.fallback = token.split("=")[1] || null;
    else if (token === "--fallback" && argv[i + 1]) args.fallback = argv[++i];
  }
  return args;
}

function loadEnvFile(filePath) {
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) throw new Error(`Env file not found: ${resolved}`);
  const raw = fs.readFileSync(resolved, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^"(.*)"$/, "$1");
    if (!process.env[key]) process.env[key] = value;
  }
}

function requireVars(errors, vars) {
  for (const key of vars) {
    if (!String(process.env[key] || "").trim()) {
      errors.push(`Missing required env: ${key}`);
    }
  }
}

function isLikelyLocalhost(value = "") {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(String(value).toLowerCase());
}

function isUrl(value = "") {
  try {
    new URL(String(value));
    return true;
  } catch {
    return false;
  }
}

function resolveEnvValue(...keys) {
  for (const key of keys) {
    const value = String(process.env[key] || "").trim();
    if (value) return value;
  }
  return "";
}

function main() {
  const { env, file, fallback } = parseArgs(process.argv);
  if (file) {
    const resolved = path.resolve(process.cwd(), file);
    if (fs.existsSync(resolved)) {
      loadEnvFile(file);
    } else if (fallback) {
      const resolvedFallback = path.resolve(process.cwd(), fallback);
      if (!fs.existsSync(resolvedFallback)) {
        throw new Error(`Env file not found: ${resolved} (fallback missing: ${resolvedFallback})`);
      }
      console.warn(`⚠️ Env file missing (${file}), loading fallback template (${fallback}).`);
      loadEnvFile(fallback);
    } else {
      throw new Error(`Env file not found: ${resolved}`);
    }
  }

  const profile = String(env || process.env.APP_ENV || process.env.NODE_ENV || "dev").toLowerCase();
  const errors = [];
  const warnings = [];
  const requiredVars = [
    { preferred: "VITE_API_URL", legacy: "REACT_APP_API_URL" },
    { preferred: "VITE_KEYCLOAK_URL", legacy: "REACT_APP_KEYCLOAK_URL" },
    { preferred: "VITE_KEYCLOAK_REALM", legacy: "REACT_APP_KEYCLOAK_REALM" },
    { preferred: "VITE_KEYCLOAK_CLIENT_ID", legacy: "REACT_APP_KEYCLOAK_CLIENT_ID" },
  ];

  requireVars(
    errors,
    requiredVars
      .filter(({ preferred, legacy }) => !resolveEnvValue(preferred, legacy))
      .map(({ preferred, legacy }) => `${preferred} (legacy ${legacy} accepted)`)
  );

  for (const { preferred, legacy } of requiredVars) {
    if (!process.env[preferred] && process.env[legacy]) {
      warnings.push(`Using legacy ${legacy}. Prefer ${preferred} for Vite builds.`);
    }
  }

  for (const value of [
    resolveEnvValue("VITE_API_URL", "REACT_APP_API_URL"),
    resolveEnvValue("VITE_KEYCLOAK_URL", "REACT_APP_KEYCLOAK_URL"),
  ]) {
    if (value && !isUrl(value)) {
      errors.push(`Invalid URL: "${value}"`);
    }
  }

  const apiUrl = resolveEnvValue("VITE_API_URL", "REACT_APP_API_URL");
  const keycloakUrl = resolveEnvValue("VITE_KEYCLOAK_URL", "REACT_APP_KEYCLOAK_URL");

  if (profile === "preprod" || profile === "production" || profile === "prod") {
    if (isLikelyLocalhost(apiUrl)) {
      errors.push("API URL points to localhost for non-dev profile.");
    }
    if (isLikelyLocalhost(keycloakUrl)) {
      errors.push("Keycloak URL points to localhost for non-dev profile.");
    }
  }

  if (profile === "dev") {
    if (!isLikelyLocalhost(apiUrl) && apiUrl) {
      warnings.push("Dev API URL is not localhost. Ensure VPN/network access is stable.");
    }
  }

  if (errors.length) {
    console.error("❌ Frontend env check failed:");
    for (const err of errors) console.error(`- ${err}`);
    if (warnings.length) {
      console.error("Warnings:");
      for (const warn of warnings) console.error(`- ${warn}`);
    }
    process.exit(1);
  }

  console.log(`✅ Frontend env check passed (profile=${profile}).`);
  if (warnings.length) {
    console.log("Warnings:");
    for (const warn of warnings) console.log(`- ${warn}`);
  }
}

try {
  main();
} catch (error) {
  console.error(`❌ Frontend env check crashed: ${error.message || error}`);
  process.exit(1);
}

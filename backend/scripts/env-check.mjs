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
  if (!fs.existsSync(resolved)) {
    throw new Error(`Env file not found: ${resolved}`);
  }
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

function isLikelyLocalhost(value = "") {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(String(value).toLowerCase());
}

function requireVars(errors, vars) {
  for (const key of vars) {
    if (!String(process.env[key] || "").trim()) {
      errors.push(`Missing required env: ${key}`);
    }
  }
}

function validateBoolean(errors, key) {
  const value = process.env[key];
  if (value == null || value === "") return;
  if (!["true", "false"].includes(String(value).toLowerCase())) {
    errors.push(`Invalid boolean env ${key}: expected true|false, got "${value}"`);
  }
}

function validateUrl(errors, key) {
  const value = String(process.env[key] || "").trim();
  if (!value) return;
  try {
    new URL(value);
  } catch {
    errors.push(`Invalid URL in ${key}: "${value}"`);
  }
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

  requireVars(errors, [
    "DATABASE_URL",
    "KEYCLOAK_ISSUER",
    "KEYCLOAK_CLIENT_ID",
    "CORS_ALLOWED_ORIGINS",
  ]);

  validateBoolean(errors, "UPLOADS_PUBLIC");
  validateBoolean(errors, "KEYCLOAK_ALLOW_ACCOUNT_AUD");
  validateUrl(errors, "KEYCLOAK_ISSUER");
  validateUrl(errors, "NOTIFICATIONS_EMAIL_WEBHOOK_URL");
  validateUrl(errors, "NOTIFICATIONS_WHATSAPP_WEBHOOK_URL");

  const databaseUrl = String(process.env.DATABASE_URL || "");
  const issuer = String(process.env.KEYCLOAK_ISSUER || "");
  const uploadsPublic = String(process.env.UPLOADS_PUBLIC || "").toLowerCase();
  const allowDestructiveSeed = String(process.env.ALLOW_DESTRUCTIVE_SEED || "").toLowerCase();

  if (profile === "preprod" || profile === "production" || profile === "prod") {
    if (uploadsPublic === "true") {
      errors.push("UPLOADS_PUBLIC must be false outside dev.");
    }
    if (allowDestructiveSeed === "true") {
      errors.push("ALLOW_DESTRUCTIVE_SEED must be false outside dev.");
    }
    if (isLikelyLocalhost(databaseUrl)) {
      errors.push("DATABASE_URL points to localhost for non-dev profile.");
    }
    if (isLikelyLocalhost(issuer)) {
      errors.push("KEYCLOAK_ISSUER points to localhost for non-dev profile.");
    }
    if (String(process.env.KEYCLOAK_ALLOW_ACCOUNT_AUD || "").toLowerCase() === "true") {
      warnings.push("KEYCLOAK_ALLOW_ACCOUNT_AUD=true is not recommended in preprod/prod.");
    }
  }

  if (profile === "dev") {
    if (uploadsPublic !== "true") {
      warnings.push("Dev currently works with UPLOADS_PUBLIC=true for easier local file preview.");
    }
  }

  const corsOrigins = String(process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (!corsOrigins.length) {
    errors.push("CORS_ALLOWED_ORIGINS must contain at least one origin.");
  }

  if (errors.length) {
    console.error("❌ Backend env check failed:");
    for (const err of errors) console.error(`- ${err}`);
    if (warnings.length) {
      console.error("Warnings:");
      for (const warn of warnings) console.error(`- ${warn}`);
    }
    process.exit(1);
  }

  console.log(`✅ Backend env check passed (profile=${profile}).`);
  if (warnings.length) {
    console.log("Warnings:");
    for (const warn of warnings) console.log(`- ${warn}`);
  }
}

try {
  main();
} catch (error) {
  console.error(`❌ Backend env check crashed: ${error.message || error}`);
  process.exit(1);
}

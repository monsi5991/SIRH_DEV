// backend/src/auth.js
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "./prisma.js";

const ACCESS_SECRET  = process.env.ACCESS_SECRET  || "dev_access_secret";
const ACCESS_TTL     = process.env.ACCESS_TTL     || "15m";
const REFRESH_TTL_S  = Number(process.env.REFRESH_TTL_S || 60 * 60 * 24 * 30); // 30 jours

export const REFRESH_COOKIE = "refresh_token";

export async function verifyPassword(plain, hash) {
  const bcrypt = (await import("bcryptjs")).default;
  return bcrypt.compare(plain, hash);
}

export function signAccess(user) {
  const payload = { sub: user.id, tid: user.tenantId };
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}

export async function verifyAccess(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing access token" });

    // ---- Vérif Keycloak JWT (JWKS) ----
    const { createRemoteJWKSet, jwtVerify } = await import("jose");

    const ISSUER = process.env.KEYCLOAK_ISSUER;
    const AUDIENCE = process.env.KEYCLOAK_AUDIENCE;

    if (!ISSUER || !AUDIENCE) {
      return res.status(500).json({ error: "Missing KEYCLOAK_ISSUER or KEYCLOAK_AUDIENCE" });
    }

    const jwks = createRemoteJWKSet(new URL(`${ISSUER}/protocol/openid-connect/certs`));

    const { payload } = await jwtVerify(token, jwks, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    // ---- Mapper Keycloak -> ton user Prisma ----
    // On s’appuie sur l’email (plus simple dans ton projet)
    const email = payload.email;
    if (!email) return res.status(401).json({ error: "Token has no email" });

    const { prisma } = await import("./prisma.js");
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Pour rester simple: on exige que l’utilisateur existe en DB
      // (tu le crées via /auth/register, puis tu crées le même email dans Keycloak)
      return res.status(401).json({ error: "User not found in DB for this email" });
    }

    // On reconstitue req.auth comme avant
    req.auth = { sub: user.id, tid: user.tenantId };

    // Bonus : on garde les rôles keycloak si tu veux t’en servir
    req.kc = {
      sub: payload.sub,
      email: payload.email,
      roles: payload?.realm_access?.roles ?? [],
      raw: payload,
    };

    return next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid access token", detail: String(e?.message || e) });
  }
}

function sha256Hex(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

/** Crée un refresh (hashé en DB) et renvoie la valeur brute à poser en cookie */
export async function issueRefresh(userId) {
  const raw = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256Hex(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_S * 1000);
  await prisma.refreshToken.create({ data: { tokenHash, userId, expiresAt } });
  return { raw, expiresAt, userId };
}

/** Lit le cookie, vérifie/rotate, supprime l’ancien, et MINTE un nouvel access token */
export async function rotateRefreshAndMintAccess(rawCookieValue) {
  if (!rawCookieValue) return null;

  const tokenHash = sha256Hex(rawCookieValue);
  const found = await prisma.refreshToken.findFirst({ where: { tokenHash } });
  if (!found) return null;

  // expiré → purge + KO
  if (found.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { id: found.id } });
    return null;
  }

  // supprime l’ancien, retrouve l’utilisateur, signe un access, émet un nouveau refresh
  await prisma.refreshToken.delete({ where: { id: found.id } });

  const user = await prisma.user.findUnique({ where: { id: found.userId } });
  if (!user) return null;

  const accessToken = signAccess(user);
  const nextRefresh = await issueRefresh(user.id);

  return { accessToken, refresh: nextRefresh };
}

export function setRefreshCookie(res, refresh) {
  res.cookie(REFRESH_COOKIE, refresh.raw, {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // ➜ true en prod HTTPS
    maxAge: REFRESH_TTL_S * 1000,
    path: "/",
  });
}

export function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, { path: "/" });
}

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

export function verifyAccess(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing access token" });
    const decoded = jwt.verify(token, ACCESS_SECRET);
    req.auth = decoded; // { sub, tid, iat, exp }
    next();
  } catch {
    return res.status(401).json({ error: "Invalid access token" });
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

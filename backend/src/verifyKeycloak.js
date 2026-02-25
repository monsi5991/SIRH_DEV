// backend/src/verifyKeycloak.js
import "dotenv/config";
import { jwtVerify, createRemoteJWKSet } from "jose";

const ISSUER = process.env.KEYCLOAK_ISSUER; // ex: http://localhost:8080/realms/SIRH
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || "sirh-frontend";

if (!ISSUER) {
  console.warn("[verifyKeycloak] KEYCLOAK_ISSUER is missing in .env");
}

const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/protocol/openid-connect/certs`));

function getBearer(req) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) return null;
  return h.slice(7).trim();
}

function normalizeAud(aud) {
  if (!aud) return [];
  return Array.isArray(aud) ? aud : [aud];
}

export async function verifyKeycloak(req, res, next) {
  try {
    const token = getBearer(req);
    if (!token) return res.status(401).json({ error: "Missing Bearer token" });

    // Vérifie signature + issuer (audience on gère après)
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: ISSUER,
      // ⚠️ On ne met pas audience ici car Keycloak met parfois "account"
      // et l’audience du client est dans "azp".
    });

    // ✅ Check audience/authorized party
    const audList = normalizeAud(payload.aud);
    const azp = payload.azp;

    const audOk =
      audList.includes(CLIENT_ID) ||
      audList.includes("account") ||      // très fréquent
      azp === CLIENT_ID;                  // authorized party

    if (!audOk) {
      return res.status(401).json({
        error: "Invalid token audience",
        details: { aud: payload.aud, azp: payload.azp, expected: CLIENT_ID }
      });
    }

    // ✅ Extraire rôles si besoin
    const realmRoles = payload.realm_access?.roles || [];
    const clientRoles = payload.resource_access?.[CLIENT_ID]?.roles || [];

    req.kc = {
      sub: payload.sub,
      email: payload.email,
      username: payload.preferred_username,
      roles: [...new Set([...realmRoles, ...clientRoles])],
      raw: payload,
    };

    return next();
  } catch (e) {
    console.error("[verifyKeycloak] reject:", e?.message || e);
    return res.status(401).json({ error: "Invalid token" });
  }
}

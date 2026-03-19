// backend/src/middlewares/attachDbAuthFromKeycloak.js
import { prisma } from "../prisma.js";

let identityColumnsAvailable = null;

export async function attachDbAuthFromKeycloak(req, res, next) {
  try {
    const email = String(req.kc?.email || "").trim().toLowerCase();
    const keycloakSub = String(req.kc?.sub || "").trim();
    const keycloakIssuer = String(req.kc?.raw?.iss || process.env.KEYCLOAK_ISSUER || "").trim();

    if (!keycloakSub) {
      return res.status(401).json({ error: "Token has no sub claim" });
    }
    if (!email) {
      return res.status(401).json({ error: "Token has no email claim" });
    }

    const selectUser = {
      select: {
        id: true,
        email: true,
        tenantId: true,
        firstName: true,
        lastName: true,
        entityId: true,
        keycloakSub: true,
        keycloakIssuer: true,
      },
    };
    const selectLegacyUser = {
      select: {
        id: true,
        email: true,
        tenantId: true,
        firstName: true,
        lastName: true,
        entityId: true,
      },
    };
    if (identityColumnsAvailable === null) {
      try {
        await prisma.user.findFirst({ ...selectUser });
        identityColumnsAvailable = true;
      } catch (error) {
        const code = String(error?.code || "").toUpperCase();
        if (code === "P2022") {
          identityColumnsAvailable = false;
        } else {
          throw error;
        }
      }
    }
    const identityColumnsReady = identityColumnsAvailable === true;

    let user = null;
    if (identityColumnsReady) {
      user = await prisma.user.findFirst({
        where: { keycloakSub, ...(keycloakIssuer ? { keycloakIssuer } : {}) },
        ...selectUser,
      });
    }

    if (!user) {
      user = await prisma.user.findUnique({
        where: { email },
        ...(identityColumnsReady ? selectUser : selectLegacyUser),
      });
    }

    if (!user) {
      return res.status(401).json({
        error: "User not found in DB for this email",
      });
    }

    if (identityColumnsReady) {
      if (user.keycloakSub && user.keycloakSub !== keycloakSub) {
        return res.status(401).json({
          error: "Identity mismatch for this account",
        });
      }
      if (user.keycloakIssuer && keycloakIssuer && user.keycloakIssuer !== keycloakIssuer) {
        return res.status(401).json({
          error: "Identity issuer mismatch for this account",
        });
      }

      if (!user.keycloakSub || !user.keycloakIssuer) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            keycloakSub,
            keycloakIssuer: keycloakIssuer || null,
          },
          ...selectUser,
        });
      }
    }

    if (!user.tenantId) {
      return res.status(401).json({
        error: "User has no tenantId in DB",
      });
    }

    // ✅ utile partout
    req.user = user;

    // ✅ ce que RBAC attend (req.auth.sub + req.auth.tid)
    req.auth = {
      sub: user.id,
      tid: user.tenantId,
      email: user.email,
    };

    return next();
  } catch (e) {
    console.error("[attachDbAuthFromKeycloak] error:", e?.message || e);
    return res.status(401).json({
      error: "Unauthorized",
      detail: String(e?.message || e),
    });
  }
}

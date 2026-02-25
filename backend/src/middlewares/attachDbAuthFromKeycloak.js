// backend/src/middlewares/attachDbAuthFromKeycloak.js
import { prisma } from "../prisma.js";

export async function attachDbAuthFromKeycloak(req, res, next) {
  try {
    const email = req.kc?.email;
    if (!email) {
      return res.status(401).json({ error: "Token has no email claim" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        tenantId: true,
        firstName: true,
        lastName: true,
        entityId: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        error: "User not found in DB for this email",
      });
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

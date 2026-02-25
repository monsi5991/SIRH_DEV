// backend/src/middlewares/attachDbUser.js
import { prisma } from "../prisma.js";

export async function attachDbUser(req, res, next) {
  try {
    const email = req.kc?.email;
    if (!email) return res.status(401).json({ error: "Token has no email claim" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "User not found in DB for this email" });

    // ✅ ce que RBAC attend
    req.auth = { sub: user.id, tid: user.tenantId };
    req.user = user;

    next();
  } catch (e) {
    console.error("[attachDbUser] error:", e);
    return res.status(500).json({ error: "Failed to attach DB user" });
  }
}

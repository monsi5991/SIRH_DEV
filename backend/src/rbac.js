// backend/src/rbac.js
import { prisma } from "./prisma.js";

/**
 * Charge user + tenant + roles + permissions (utilisé par /me)
 */
export async function enrichUser(userId) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      tenant: true,
      roles: {
        include: {
          role: {
            include: {
              rolePermissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  });

  if (!u) return null;

  const roles = u.roles.map((r) => r.role.name);
  const permissions = new Set();
  u.roles.forEach((r) =>
    r.role.rolePermissions.forEach((rp) => permissions.add(rp.permission.name))
  );

  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    tenantId: u.tenantId,
    tenant: { id: u.tenant.id, name: u.tenant.name },
    roles,
    permissions: Array.from(permissions),
  };
}

/**
 * Cache permission/roles sur la requête pour éviter N requêtes Prisma
 * req.rbac = { roles: string[], perms: Set<string> }
 */
async function loadRbacForRequest(req) {
  if (req.rbac) return req.rbac;

  const userId = req.auth?.sub;
  const tenantId = req.auth?.tid;
  if (!userId || !tenantId) {
    req.rbac = { roles: [], perms: new Set() };
    return req.rbac;
  }

  // 1 requête DB qui ramène rôles + permissions
  const rows = await prisma.userRole.findMany({
    where: {
      userId,
      role: { tenantId }, // ✅ tenant-safe (role appartient au tenant)
    },
    select: {
      role: {
        select: {
          name: true,
          rolePermissions: {
            select: {
              permission: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const roles = [];
  const perms = new Set();

  for (const r of rows) {
    const role = r.role;
    if (!role) continue;

    if (role.name) roles.push(role.name);

    const rps = role.rolePermissions || [];
    for (const rp of rps) {
      const p = rp?.permission?.name;
      if (p) perms.add(p);
    }
  }

  req.rbac = { roles, perms };
  return req.rbac;
}

function normalizeList(x) {
  if (!x) return [];
  return Array.isArray(x) ? x.filter(Boolean) : [x].filter(Boolean);
}

/**
 * Middleware: requirePermissions(["operations_read"], "anyOf")
 */
export function requirePermissions(names = [], mode = "allOf") {
  const needed = normalizeList(names);

  return async (req, res, next) => {
    try {
      // si rien demandé => ok
      if (needed.length === 0) return next();

      const { perms } = await loadRbacForRequest(req);

      // "all" bypass
      if (perms.has("all")) return next();

      const ok =
        mode === "anyOf"
          ? needed.some((n) => perms.has(n))
          : needed.every((n) => perms.has(n));

      if (!ok) return res.status(403).json({ error: "Forbidden" });
      return next();
    } catch (e) {
      console.error("[requirePermissions] error:", e?.message || e);
      return res.status(403).json({ error: "Forbidden" });
    }
  };
}

/**
 * (Optionnel) si tu veux aussi un guard rôles basé sur le même cache
 * requireRoles(["Admin","RH"], "anyOf")
 */
export function requireRoles(names = [], mode = "anyOf") {
  const needed = normalizeList(names);

  return async (req, res, next) => {
    try {
      if (needed.length === 0) return next();

      const { roles } = await loadRbacForRequest(req);
      const set = new Set(roles);

      const ok =
        mode === "allOf"
          ? needed.every((n) => set.has(n))
          : needed.some((n) => set.has(n));

      if (!ok) return res.status(403).json({ error: "Forbidden" });
      return next();
    } catch (e) {
      console.error("[requireRoles] error:", e?.message || e);
      return res.status(403).json({ error: "Forbidden" });
    }
  };
}

export async function upsertPermission(prismaClient, name, tenantId) {
  return prismaClient.permission.upsert({
    where: { name_tenantId: { name, tenantId } },
    update: {},
    create: { name, tenantId },
  });
}

export async function upsertRole(prismaClient, name, tenantId) {
  return prismaClient.role.upsert({
    where: { name_tenantId: { name, tenantId } },
    update: {},
    create: { name, tenantId },
  });
}

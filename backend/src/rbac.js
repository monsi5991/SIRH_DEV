// backend/src/rbac.js
import { prisma } from "./prisma.js"; // ou "../../prisma.js" selon la profondeur

export async function enrichUser(userId) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      tenant: true,
      roles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } }
    }
  });
  if (!u) return null;

  const roles = u.roles.map(r => r.role.name);
  const permissions = new Set();
  u.roles.forEach(r => r.role.rolePermissions.forEach(rp => permissions.add(rp.permission.name)));

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

export function requirePermissions(names = [], mode = "allOf") {
  return (req, res, next) => {
    const perms = (req.auth && req.auth.sub) ? req.auth.perms : null; // not used; we fetch DB per-route if needed
    // simple guard: we re-check permissions by user id from DB
    checkUserPermissions(req.auth?.sub, req.auth?.tid, names, mode)
      .then(ok => ok ? next() : res.status(403).json({ error: "Forbidden" }))
      .catch(() => res.status(403).json({ error: "Forbidden" }));
  };
}

async function checkUserPermissions(userId, tenantId, names, mode) {
  if (!userId || !tenantId) return false;
  const rows = await prisma.userRole.findMany({
    where: { userId },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } }
  });
  const set = new Set();
  rows.forEach(r => r.role.rolePermissions.forEach(rp => set.add(rp.permission.name)));
  if (set.has("all")) return true;
  const needed = names || [];
  if (mode === "anyOf") return needed.some(n => set.has(n));
  return needed.every(n => set.has(n));
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

import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TENANT_NAME = "ACME";
const ENTITY_NAME = "Siege";
const DEMO_PASSWORD = "Demo2025!";

const ROLE_PERMISSION_MATRIX = {
  RH: ["all"],
  Manager: [
    "operations_read",
    "operations_write",
    "directory_read",
    "team_read",
    "team_write",
    "approvals_read",
    "approvals_write",
    "self_read",
  ],
  Employee: ["directory_read", "self_read", "self_write"],
  IT: ["directory_read", "team_read", "team_write", "self_read"],
};

const DEMO_USERS = [
  { email: "marie@acme.sn", firstName: "Marie", lastName: "Ndiaye", role: "RH" },
  { email: "amadou@acme.sn", firstName: "Amadou", lastName: "Ba", role: "Manager" },
  { email: "fatou@acme.sn", firstName: "Fatou", lastName: "Diop", role: "Employee" },
  { email: "ibrahima.sarr@acme.sn", firstName: "Ibrahima", lastName: "Sarr", role: "IT" },
];

const EMPLOYEE_PROFILE_BY_ROLE = {
  RH: { department: "RH", position: "HR Manager", site: "Dakar", country: "SN", phone: "+221770001100" },
  Manager: { department: "Operations", position: "Manager", site: "Dakar", country: "SN", phone: "+221770001101" },
  Employee: { department: "Finance", position: "Analyste", site: "Dakar", country: "SN", phone: "+221770001102" },
  IT: { department: "IT", position: "Administrateur IT", site: "Dakar", country: "SN", phone: "+221770001122" },
};

async function ensureTenantAndEntity() {
  let tenant = await prisma.tenant.findFirst({ where: { name: TENANT_NAME } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: TENANT_NAME,
        country: "SN",
        city: "Dakar",
        industry: "Services",
        size: "50-100",
      },
    });
  }

  let entity = await prisma.entity.findFirst({ where: { tenantId: tenant.id } });
  if (!entity) {
    entity = await prisma.entity.create({
      data: { tenantId: tenant.id, name: ENTITY_NAME },
    });
  }

  return { tenant, entity };
}

async function ensurePermissions(tenantId) {
  const names = Array.from(
    new Set(Object.values(ROLE_PERMISSION_MATRIX).flat())
  );

  const map = new Map();
  for (const name of names) {
    const permission = await prisma.permission.upsert({
      where: { name_tenantId: { name, tenantId } },
      update: {},
      create: { name, tenantId },
    });
    map.set(name, permission);
  }
  return map;
}

async function ensureRoles(tenantId) {
  const map = new Map();
  for (const name of Object.keys(ROLE_PERMISSION_MATRIX)) {
    const role = await prisma.role.upsert({
      where: { name_tenantId: { name, tenantId } },
      update: {},
      create: { name, tenantId },
    });
    map.set(name, role);
  }
  return map;
}

async function syncRolePermissions(rolesByName, permissionsByName) {
  for (const [roleName, permissionNames] of Object.entries(ROLE_PERMISSION_MATRIX)) {
    const role = rolesByName.get(roleName);
    if (!role) continue;

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });

    await prisma.rolePermission.createMany({
      data: permissionNames.map((name) => ({
        roleId: role.id,
        permissionId: permissionsByName.get(name).id,
      })),
      skipDuplicates: true,
    });
  }
}

async function upsertDemoUsers(tenantId, entityId, rolesByName) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const results = [];

  for (const demo of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { email: demo.email },
      update: {
        firstName: demo.firstName,
        lastName: demo.lastName,
        tenantId,
        entityId,
        passwordHash,
      },
      create: {
        email: demo.email,
        firstName: demo.firstName,
        lastName: demo.lastName,
        tenantId,
        entityId,
        passwordHash,
      },
    });

    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: rolesByName.get(demo.role).id },
    });

    results.push({ email: user.email, role: demo.role });
  }

  return results;
}

async function ensureEmployeeProfiles(tenantId, demoUsers) {
  for (const demo of demoUsers) {
    const user = await prisma.user.findUnique({ where: { email: demo.email } });
    if (!user) continue;

    const profile = EMPLOYEE_PROFILE_BY_ROLE[demo.role] || EMPLOYEE_PROFILE_BY_ROLE.Employee;
    const existing = await prisma.employee.findUnique({ where: { email: demo.email } });

    if (!existing) {
      await prisma.employee.create({
        data: {
          tenantId,
          userId: user.id,
          firstName: demo.firstName,
          lastName: demo.lastName,
          email: demo.email,
          status: "ACTIVE",
          contractType: "CDI",
          country: profile.country,
          site: profile.site,
          department: profile.department,
          position: profile.position,
          phone: profile.phone,
          phoneWhatsApp: profile.phone,
          joinDate: new Date(),
          baseSalary: demo.role === "IT" ? 500000 : demo.role === "RH" ? 650000 : demo.role === "Manager" ? 550000 : 400000,
          cadre: false,
          atRate: 0.03,
          transportTaxable: true,
          benefits: { housing: 0, car: 0 },
        },
      });
      continue;
    }

    await prisma.employee.update({
      where: { id: existing.id },
      data: {
        userId: existing.userId || user.id,
        department: existing.department || profile.department,
        position: existing.position || profile.position,
        site: existing.site || profile.site,
        country: existing.country || profile.country,
        phone: existing.phone || profile.phone,
        phoneWhatsApp: existing.phoneWhatsApp || profile.phone,
      },
    });
  }
}

async function main() {
  const { tenant, entity } = await ensureTenantAndEntity();
  const permissionsByName = await ensurePermissions(tenant.id);
  const rolesByName = await ensureRoles(tenant.id);
  await syncRolePermissions(rolesByName, permissionsByName);
  const syncedUsers = await upsertDemoUsers(tenant.id, entity.id, rolesByName);
  await ensureEmployeeProfiles(tenant.id, DEMO_USERS);

  const managerRole = rolesByName.get("Manager");
  const managerPerms = await prisma.rolePermission.findMany({
    where: { roleId: managerRole.id },
    include: { permission: { select: { name: true } } },
  });

  console.log(
    JSON.stringify(
      {
        tenant: tenant.name,
        entity: entity.name,
        users: syncedUsers,
        managerPermissions: managerPerms.map((x) => x.permission.name).sort(),
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error("sync-demo-rbac failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

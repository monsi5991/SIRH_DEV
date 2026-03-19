import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_PERMISSIONS = [
  "all",
  "directory_read",
  "operations_read",
  "operations_write",
  "self_read",
  "self_write",
  "team_read",
  "team_write",
  "approvals_read",
  "approvals_write",
  "analytics_read",
  "admin_read",
];

const DEFAULT_ROLES = ["RH", "Manager", "Employee", "IT"];

const DEFAULT_LEAVE_TYPES = [
  { code: "CP", label: "Congés payés", category: "VACATION", unit: "DAY", defaultAnnualAllowance: 24, requiresDocument: false },
  { code: "RTT", label: "RTT", category: "RTT", unit: "DAY", defaultAnnualAllowance: 10, requiresDocument: false },
  { code: "SICK", label: "Maladie", category: "SICK", unit: "DAY", defaultAnnualAllowance: 10, requiresDocument: true },
  { code: "PARENTAL", label: "Congé parental", category: "PARENTAL", unit: "DAY", defaultAnnualAllowance: 90, requiresDocument: true },
  { code: "EXCEPTIONAL", label: "Congé exceptionnel", category: "EXCEPTIONAL", unit: "DAY", defaultAnnualAllowance: 5, requiresDocument: true },
  { code: "UNPAID", label: "Congé sans solde", category: "UNPAID", unit: "DAY", defaultAnnualAllowance: 0, requiresDocument: false },
];

async function ensureTenant() {
  const existing = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  return prisma.tenant.create({
    data: { name: "SIRH", country: "SN", city: "Dakar", industry: "Services", size: "SME" },
  });
}

async function main() {
  if (process.env.ALLOW_DESTRUCTIVE_SEED === "true") {
    throw new Error("seed.reference.js est non destructif. Utilisez seed.js pour le mode demo.");
  }

  const tenant = await ensureTenant();

  for (const name of DEFAULT_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name_tenantId: { name, tenantId: tenant.id } },
      update: {},
      create: { name, tenantId: tenant.id },
    });
  }

  for (const roleName of DEFAULT_ROLES) {
    await prisma.role.upsert({
      where: { name_tenantId: { name: roleName, tenantId: tenant.id } },
      update: {},
      create: { name: roleName, tenantId: tenant.id },
    });
  }

  for (const leaveType of DEFAULT_LEAVE_TYPES) {
    await prisma.leaveType.upsert({
      where: { tenantId_code_leave_type: { tenantId: tenant.id, code: leaveType.code } },
      update: {
        label: leaveType.label,
        category: leaveType.category,
        unit: leaveType.unit,
        defaultAnnualAllowance: leaveType.defaultAnnualAllowance,
        requiresDocument: leaveType.requiresDocument,
        isActive: true,
      },
      create: {
        tenantId: tenant.id,
        code: leaveType.code,
        label: leaveType.label,
        category: leaveType.category,
        unit: leaveType.unit,
        defaultAnnualAllowance: leaveType.defaultAnnualAllowance,
        requiresDocument: leaveType.requiresDocument,
        isActive: true,
      },
    });
  }

  console.log("✅ Seed référence appliqué (non destructif).");
}

try {
  await main();
} catch (error) {
  console.error("❌ Seed référence échoué:", error);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}

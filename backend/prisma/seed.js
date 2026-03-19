// prisma/seed.js
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
const daysFromNow = (n) => new Date(Date.now() + n * 86400000);

async function upsertPermission(name, tenantId) {
  return prisma.permission.upsert({
    where: { name_tenantId: { name, tenantId } },
    update: {},
    create: { name, tenantId },
  });
}
async function upsertRole(name, tenantId) {
  return prisma.role.upsert({
    where: { name_tenantId: { name, tenantId } },
    update: {},
    create: { name, tenantId },
  });
}
async function upsertUser(email, data) {
  return prisma.user.upsert({ where: { email }, update: {}, create: data });
}

function currentPeriodYM() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth(); // 0-11
  const from = new Date(y, m, 1);
  const to   = new Date(y, m + 1, 1);
  return { y, m, from, to };
}

const DEFAULT_LEAVE_TYPES = [
  {
    code: "CP",
    label: "Congés payés",
    category: "VACATION",
    unit: "DAY",
    defaultAnnualAllowance: 24,
    requiresDocument: false,
  },
  {
    code: "RTT",
    label: "RTT",
    category: "RTT",
    unit: "DAY",
    defaultAnnualAllowance: 10,
    requiresDocument: false,
  },
  {
    code: "SICK",
    label: "Maladie",
    category: "SICK",
    unit: "DAY",
    defaultAnnualAllowance: 10,
    requiresDocument: true,
  },
  {
    code: "PARENTAL",
    label: "Congé parental",
    category: "PARENTAL",
    unit: "DAY",
    defaultAnnualAllowance: 90,
    requiresDocument: true,
  },
  {
    code: "EXCEPTIONAL",
    label: "Congé exceptionnel",
    category: "EXCEPTIONAL",
    unit: "DAY",
    defaultAnnualAllowance: 5,
    requiresDocument: true,
  },
  {
    code: "UNPAID",
    label: "Congé sans solde",
    category: "UNPAID",
    unit: "DAY",
    defaultAnnualAllowance: 0,
    requiresDocument: false,
  },
];

function round1(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(1));
}

function normalizeLeaveTypeCode(raw) {
  const code = String(raw || "").toUpperCase();
  if (code === "CP" || code === "ANNUAL" || code === "VACATION") return "CP";
  if (code.includes("RTT")) return "RTT";
  if (code.includes("SICK") || code.includes("MAL")) return "SICK";
  if (code.includes("PARENT")) return "PARENTAL";
  if (code.includes("EXCEPTION")) return "EXCEPTIONAL";
  if (code.includes("SANS") || code.includes("UNPAID")) return "UNPAID";
  return "CP";
}

function startOfDay(input = new Date()) {
  const d = new Date(input);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(input, days) {
  const d = new Date(input);
  d.setDate(d.getDate() + days);
  return d;
}

function splitLeaveDaysByYear(leave) {
  const map = new Map();
  if (!leave?.start || !leave?.end) return map;
  if (leave.halfDay === "AM" || leave.halfDay === "PM") {
    const y = new Date(leave.start).getFullYear();
    map.set(y, 0.5);
    return map;
  }

  const start = startOfDay(leave.start);
  const end = startOfDay(leave.end);
  if (end < start) return map;

  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    const y = d.getFullYear();
    map.set(y, round1((map.get(y) || 0) + 1));
  }
  return map;
}

async function ensureDefaultLeaveTypes(tenantId) {
  const map = new Map();
  for (const item of DEFAULT_LEAVE_TYPES) {
    const upserted = await prisma.leaveType.upsert({
      where: { tenantId_code_leave_type: { tenantId, code: item.code } },
      update: {
        label: item.label,
        category: item.category,
        unit: item.unit,
        defaultAnnualAllowance: item.defaultAnnualAllowance,
        requiresDocument: item.requiresDocument,
        isActive: true,
      },
      create: {
        tenantId,
        code: item.code,
        label: item.label,
        category: item.category,
        unit: item.unit,
        defaultAnnualAllowance: item.defaultAnnualAllowance,
        requiresDocument: item.requiresDocument,
        isActive: true,
      },
    });
    map.set(item.code, upserted);
  }
  return map;
}

async function rebuildLeaveBalancesForEmployee({ tenantId, employeeId, year, leaveTypeMap }) {
  const periodStart = new Date(year, 0, 1);
  const periodEnd = new Date(year, 11, 31, 23, 59, 59, 999);

  await prisma.leaveBalanceLedgerEntry.deleteMany({
    where: { tenantId, employeeId, periodYear: year },
  });
  await prisma.employeeLeaveBalance.deleteMany({
    where: { tenantId, employeeId, periodYear: year },
  });

  const byCode = new Map();
  for (const [code, leaveType] of leaveTypeMap.entries()) {
    const openingBalance = Number(leaveType.defaultAnnualAllowance || 0);
    const balance = await prisma.employeeLeaveBalance.create({
      data: {
        tenantId,
        employeeId,
        leaveTypeId: leaveType.id,
        periodYear: year,
        openingBalance,
        accrued: 0,
        consumed: 0,
        pending: 0,
        adjustments: 0,
        available: openingBalance,
      },
    });
    byCode.set(code, balance);

    if (openingBalance > 0) {
      await prisma.leaveBalanceLedgerEntry.create({
        data: {
          tenantId,
          employeeId,
          leaveTypeId: leaveType.id,
          balanceId: balance.id,
          periodYear: year,
          direction: "CREDIT",
          reason: "OPENING",
          quantity: openingBalance,
          note: "Solde initial annuel (seed)",
          occurredAt: periodStart,
          createdBy: "seed",
        },
      });
    }
  }

  const leaves = await prisma.leave.findMany({
    where: {
      tenantId,
      employeeId,
      AND: [{ start: { lte: periodEnd } }, { end: { gte: periodStart } }],
    },
    select: {
      id: true,
      start: true,
      end: true,
      type: true,
      status: true,
      halfDay: true,
    },
    take: 1000,
  });

  const aggregates = new Map();
  for (const leave of leaves) {
    const yearly = splitLeaveDaysByYear(leave);
    const qty = Number(yearly.get(year) || 0);
    if (qty <= 0) continue;
    const code = normalizeLeaveTypeCode(leave.type);
    const bucket = aggregates.get(code) || { consumed: 0, pending: 0 };
    const normalizedStatus = String(leave.status || "").toUpperCase();
    if (normalizedStatus === "APPROVED") bucket.consumed += qty;
    if (normalizedStatus === "PENDING") bucket.pending += qty;
    aggregates.set(code, bucket);
  }

  for (const [code, values] of aggregates.entries()) {
    const targetBalance = byCode.get(code) || byCode.get("CP");
    const targetLeaveType = leaveTypeMap.get(code) || leaveTypeMap.get("CP");
    if (!targetBalance || !targetLeaveType) continue;

    const consumed = round1(values.consumed);
    const pending = round1(values.pending);
    const available = round1(
      Number(targetBalance.openingBalance || 0) +
      Number(targetBalance.accrued || 0) +
      Number(targetBalance.adjustments || 0) -
      consumed
    );

    await prisma.employeeLeaveBalance.update({
      where: { id: targetBalance.id },
      data: {
        consumed,
        pending,
        available,
      },
    });

    if (consumed > 0) {
      await prisma.leaveBalanceLedgerEntry.create({
        data: {
          tenantId,
          employeeId,
          leaveTypeId: targetLeaveType.id,
          balanceId: targetBalance.id,
          periodYear: year,
          direction: "DEBIT",
          reason: "CONSUMPTION",
          quantity: consumed,
          note: "Consommation calculée (seed)",
          occurredAt: new Date(),
          createdBy: "seed",
        },
      });
    }

    if (pending > 0) {
      await prisma.leaveBalanceLedgerEntry.create({
        data: {
          tenantId,
          employeeId,
          leaveTypeId: targetLeaveType.id,
          balanceId: targetBalance.id,
          periodYear: year,
          direction: "DEBIT",
          reason: "PENDING_RESERVE",
          quantity: pending,
          note: "Réservation en attente (seed)",
          occurredAt: new Date(),
          createdBy: "seed",
        },
      });
    }
  }
}

async function main() {
  const allowDestructiveSeed =
    process.env.ALLOW_DESTRUCTIVE_SEED === "true" ||
    process.env.NODE_ENV === "development" ||
    process.env.NODE_ENV === "test";

  // ---------- Tenant & Entity ----------
  let tenant = await prisma.tenant.findFirst({ where: { name: "ACME" } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { name: "ACME", country: "SN", city: "Dakar", industry: "Services", size: "50-100" },
    });
  }

  let entity = await prisma.entity.findUnique({
    where: { tenantId_name: { tenantId: tenant.id, name: "Siège" } },
  });
  if (!entity) {
    entity = await prisma.entity.create({ data: { name: "Siège", tenantId: tenant.id } });
  }

  // ---------- Permissions / Roles ----------
  const permNames = [
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
  const perms = {};
  for (const p of permNames) perms[p] = await upsertPermission(p, tenant.id);

  const roleRH       = await upsertRole("RH", tenant.id);
  const roleManager  = await upsertRole("Manager", tenant.id);
  const roleEmployee = await upsertRole("Employee", tenant.id);
  const roleIT       = await upsertRole("IT", tenant.id);

  await prisma.rolePermission.deleteMany({
    where: { roleId: { in: [roleRH.id, roleManager.id, roleEmployee.id, roleIT.id] } },
  });

  await prisma.rolePermission.createMany({
    data: [{ roleId: roleRH.id, permissionId: perms["all"].id }],
    skipDuplicates: true,
  });
  await prisma.rolePermission.createMany({
    data: [
      { roleId: roleManager.id,  permissionId: perms["operations_read"].id },
      { roleId: roleManager.id,  permissionId: perms["operations_write"].id },
      { roleId: roleManager.id,  permissionId: perms["directory_read"].id },
      { roleId: roleManager.id,  permissionId: perms["team_read"].id },
      { roleId: roleManager.id,  permissionId: perms["team_write"].id },
      { roleId: roleManager.id,  permissionId: perms["approvals_read"].id },
      { roleId: roleManager.id,  permissionId: perms["approvals_write"].id },
      { roleId: roleManager.id,  permissionId: perms["self_read"].id },
    ],
    skipDuplicates: true,
  });
  await prisma.rolePermission.createMany({
    data: [
      { roleId: roleEmployee.id, permissionId: perms["directory_read"].id },
      { roleId: roleEmployee.id, permissionId: perms["self_read"].id },
      { roleId: roleEmployee.id, permissionId: perms["self_write"].id },
    ],
    skipDuplicates: true,
  });
  await prisma.rolePermission.createMany({
    data: [
      { roleId: roleIT.id, permissionId: perms["directory_read"].id },
      { roleId: roleIT.id, permissionId: perms["team_read"].id },
      { roleId: roleIT.id, permissionId: perms["team_write"].id },
      { roleId: roleIT.id, permissionId: perms["self_read"].id },
    ],
    skipDuplicates: true,
  });

  // ---------- Users ----------
  const passwordHash = await bcrypt.hash("Demo2025!", 10);
  const fixed = [
    { firstName: "Marie",  lastName: "Ndiaye", email: "marie@acme.sn",   role: roleRH },
    { firstName: "Amadou", lastName: "Ba",     email: "amadou@acme.sn",  role: roleManager },
    { firstName: "Fatou",  lastName: "Diop",   email: "fatou@acme.sn",   role: roleEmployee },
    { firstName: "Ibrahima",  lastName: "Sarr",   email: "ibrahima.sarr@acme.sn", role: roleIT },
  ];
  for (const f of fixed) {
    const u = await upsertUser(f.email, {
      firstName: f.firstName, lastName: f.lastName, email: f.email,
      passwordHash, tenantId: tenant.id, entityId: entity.id,
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: u.id, roleId: f.role.id } },
      update: {},
      create: { userId: u.id, roleId: f.role.id },
    });
  }

  const firstNames = ["Awa","Cheikh","Ibrahima","Khadija","Mamadou","Binta","Ousmane","Mame","Saliou","Mbayang","Aminata","Pape","Rama","Alioune","Seynabou","Moustapha","Astou","Nafi","Serigne","Aly"];
  const lastNames  = ["Sow","Faye","Gueye","Fall","Sarr","Ba","Diouf","Kane","Cissé","Ndiaye","Sy","Niane","Touré","Camara","Ndao","Lo"];

  for (let i = 0; i < 17; i++) {
    const fn = pick(firstNames);
    const ln = pick(lastNames);
    const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@acme.sn`;
    const role = i === 0 ? roleRH : i <= 2 ? roleManager : roleEmployee;

    const u = await upsertUser(email, {
      firstName: fn,
      lastName:  ln,
      email,
      passwordHash,
      tenantId: tenant.id,
      entityId: entity.id,
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: u.id, roleId: role.id } },
      update: {},
      create: { userId: u.id, roleId: role.id },
    });
  }

  // ---------- Reset demo data ----------
  if (allowDestructiveSeed) {
    await prisma.leave.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.timesheet.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.expense.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.event.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.notification.deleteMany({ where: { tenantId: tenant.id } });
    try {
      await prisma.leaveBalanceLedgerEntry.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.employeeLeaveBalance.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.leaveType.deleteMany({ where: { tenantId: tenant.id } });
    } catch (e) {
      const code = String(e?.code || "").toUpperCase();
      if (code !== "P2021" && code !== "P2022") throw e;
    }

    await prisma.interview.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.interviewCampaign.deleteMany({ where: { tenantId: tenant.id } });

    await prisma.hrRequest.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.workflowAction.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.workflowInstance.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.workflowDefinition.deleteMany({ where: { tenantId: tenant.id } });

    await prisma.policyAck.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.policyVersion.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.policy.deleteMany({ where: { tenantId: tenant.id } });

    await prisma.complianceTask.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.onboardingCase.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.offboardingCase.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.activity.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.document.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.goal.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.reviewCycle.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.certification.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.enrollment.deleteMany({ where: { tenantId: tenant.id } });

    await prisma.employee.deleteMany({ where: { tenantId: tenant.id } });
  } else {
    console.warn("[seed] Mode non destructif activé: aucun deleteMany exécuté.");
  }

  // =======================
  //   >>> PEOPLE (profil paie inclus)
  // =======================
  await prisma.employee.createMany({
    data: [
      {
        tenantId: tenant.id,
        firstName: "Awa",
        lastName: "Diop",
        email: "awa.diop@acme.sn",
        phone: "+221771234567",
        country: "SN",
        department: "RH",
        site: "Dakar",
        position: "HRBP",
        status: "ACTIVE",
        contractType: "CDI",
        cnss: "SN-12345",
        ipres: "IP-98765",
        joinDate: new Date(),
        baseSalary: 650000,
        cadre: false,
        atRate: 0.03,
        familyParts: 0,
        transportTaxable: true,
        benefits: { housing: 0, car: 0 },
      },
      {
        tenantId: tenant.id,
        firstName: "Mamadou",
        lastName: "Ndoye",
        email: "mamadou.ndoye@acme.sn",
        phone: "+221781112233",
        country: "SN",
        department: "Operations",
        site: "Thiès",
        position: "Chef de site",
        status: "ACTIVE",
        contractType: "CDD",
        joinDate: new Date(),
        baseSalary: 550000,
        cadre: false,
        atRate: 0.03,
        transportTaxable: true,
        benefits: { housing: 0, car: 0 },
      },
    ],
    skipDuplicates: true,
  });

  // Lier/Créer Marie/Amadou/Fatou avec baseSalary + profil paie
  const demoUsers = await prisma.user.findMany({
    where: { email: { in: ["marie@acme.sn", "amadou@acme.sn", "fatou@acme.sn", "ibrahima.sarr@acme.sn"] }, tenantId: tenant.id }
  });

  for (const u of demoUsers) {
    const existsEmp = await prisma.employee.findUnique({ where: { email: u.email } });
    const salary = u.email === "marie@acme.sn"  ? 650000
                 : u.email === "amadou@acme.sn" ? 550000
                 : u.email === "fatou@acme.sn"   ? 400000
                 : u.email === "ibrahima.sarr@acme.sn" ? 500000
                 : 350000;

    if (!existsEmp) {
      let department = "Operations";
      let position   = "Employé";
      if (u.email === "marie@acme.sn")  { department = "RH";         position = "HR Manager"; }
      if (u.email === "amadou@acme.sn") { department = "Operations"; position = "Manager"; }
      if (u.email === "fatou@acme.sn")  { department = "Finance";    position = "Analyste"; }
      if (u.email === "ibrahima.sarr@acme.sn") { department = "IT"; position = "Administrateur IT"; }

      await prisma.employee.create({
        data: {
          tenantId: tenant.id,
          firstName: u.firstName,
          lastName:  u.lastName,
          email:     u.email,
          status:    "ACTIVE",
          contractType: "CDI",
          country:   "SN",
          site:      "Dakar",
          department,
          position,
          phone: u.email === "ibrahima.sarr@acme.sn" ? "+221770001122" : null,
          phoneWhatsApp: u.email === "ibrahima.sarr@acme.sn" ? "+221770001122" : null,
          joinDate:  new Date(),
          userId:    u.id,
          baseSalary: salary,
          cadre: false,
          atRate: 0.03,
          transportTaxable: true,
          benefits: { housing: 0, car: 0 },
        }
      });
    } else {
      await prisma.employee.update({
        where: { email: u.email },
        data: {
          userId: existsEmp.userId ?? u.id,
          baseSalary: existsEmp.baseSalary ?? salary,
          department: existsEmp.department || (u.email === "ibrahima.sarr@acme.sn" ? "IT" : existsEmp.department),
          position: existsEmp.position || (u.email === "ibrahima.sarr@acme.sn" ? "Administrateur IT" : existsEmp.position),
          phone: existsEmp.phone || (u.email === "ibrahima.sarr@acme.sn" ? "+221770001122" : existsEmp.phone),
          phoneWhatsApp: existsEmp.phoneWhatsApp || (u.email === "ibrahima.sarr@acme.sn" ? "+221770001122" : existsEmp.phoneWhatsApp),
          cadre: existsEmp.cadre ?? false,
          atRate: existsEmp.atRate ?? 0.03,
          transportTaxable: existsEmp.transportTaxable ?? true,
          benefits: existsEmp.benefits ?? { housing: 0, car: 0 },
        }
      });
    }
  }

  const awa = await prisma.employee.findUnique({ where: { email: "awa.diop@acme.sn" } });
  const mamadou = await prisma.employee.findUnique({ where: { email: "mamadou.ndoye@acme.sn" } });
  const fatou = await prisma.employee.findUnique({ where: { email: "fatou@acme.sn" } });
  const marie = await prisma.employee.findUnique({ where: { email: "marie@acme.sn" } });
  const amadouManager = await prisma.employee.findUnique({ where: { email: "amadou@acme.sn" } });

  const demoUserByEmail = new Map(demoUsers.map((u) => [u.email, u]));
  const marieUser = demoUserByEmail.get("marie@acme.sn") || null;
  const amadouUser = demoUserByEmail.get("amadou@acme.sn") || null;
  const fatouUser = demoUserByEmail.get("fatou@acme.sn") || null;

  let leaveBalanceEngineReady = true;
  let leaveTypeMap = new Map();
  try {
    leaveTypeMap = await ensureDefaultLeaveTypes(tenant.id);
  } catch (e) {
    const code = String(e?.code || "").toUpperCase();
    if (code === "P2021" || code === "P2022") {
      leaveBalanceEngineReady = false;
      console.warn("[seed] Leave balance engine tables non disponibles, fallback activé.");
    } else {
      throw e;
    }
  }

  // Managerial links to make manager dashboards meaningful in demo mode.
  if (amadouManager?.id) {
    if (fatou && fatou.managerId !== amadouManager.id) {
      await prisma.employee.update({
        where: { id: fatou.id },
        data: { managerId: amadouManager.id },
      });
    }
    if (mamadou && mamadou.managerId !== amadouManager.id) {
      await prisma.employee.update({
        where: { id: mamadou.id },
        data: { managerId: amadouManager.id },
      });
    }
  }
  if (marie?.id && awa && awa.managerId !== marie.id) {
    await prisma.employee.update({
      where: { id: awa.id },
      data: { managerId: marie.id },
    });
  }

  // ---- Documents d'exemple
  if (awa) {
    await prisma.document.createMany({
      data: [
        { tenantId: tenant.id, employeeId: awa.id, label: "Contrat CDI", type: "contrat", url: "/uploads/sample_contrat.pdf" },
        { tenantId: tenant.id, employeeId: awa.id, label: "Attestation IPRES", type: "ipres", url: "/uploads/sample_ipres.pdf" },
      ]
    });
  }

  // ---- Certification qui expire dans 20 jours
  if (awa) {
    await prisma.certification.create({
      data: {
        tenantId: tenant.id,
        employeeId: awa.id,
        name: "HSE Niveau 1",
        issuedAt: new Date(),
        expiresAt: daysFromNow(20),
      }
    });
  }

  // ---- Cycle de performance + objectif
  const cycle = await prisma.reviewCycle.create({
    data: {
      tenantId: tenant.id,
      name: "Cycle Annuel 2025",
      period: "2025",
      startDate: new Date(new Date().getFullYear(), 0, 1),
      endDate: new Date(new Date().getFullYear(), 11, 31),
    }
  });

  if (awa) {
    await prisma.goal.create({
      data: {
        tenantId: tenant.id,
        employeeId: awa.id,
        cycleId: cycle.id,
        title: "Accompagner 5 onboardings réussis",
        status: "on_track",
        progress: 40,
      }
    });
  }

  // =======================
  //   >>> POLITIQUES (upsert)
  // =======================
  const policyRI = await prisma.policy.upsert({
    where: { tenantId_title: { tenantId: tenant.id, title: "Règlement intérieur" } },
    create: { tenantId: tenant.id, title: "Règlement intérieur", category: "discipline", isActive: true },
    update: {},
  });
  const policyIT = await prisma.policy.upsert({
    where: { tenantId_title: { tenantId: tenant.id, title: "Charte IT & Données" } },
    create: { tenantId: tenant.id, title: "Charte IT & Données", category: "it", isActive: true },
    update: {},
  });

  const now = new Date();
  await prisma.policyVersion.upsert({
    where: { tenantId_policyId_version: { tenantId: tenant.id, policyId: policyRI.id, version: 1 } },
    create: {
      tenantId: tenant.id, policyId: policyRI.id, version: 1, language: "FR",
      content: "Version 1 du règlement intérieur – ACME.", effectiveAt: now
    },
    update: {},
  });
  await prisma.policyVersion.upsert({
    where: { tenantId_policyId_version: { tenantId: tenant.id, policyId: policyIT.id, version: 1 } },
    create: {
      tenantId: tenant.id, policyId: policyIT.id, version: 1, language: "FR",
      content: "Charte IT – Bonnes pratiques emails/WhatsApp/confidentialité.", effectiveAt: now
    },
    update: {},
  });

  if (awa) {
    await prisma.policyAck.upsert({
      where: { policyId_employeeId: { policyId: policyIT.id, employeeId: awa.id } },
      create: { tenantId: tenant.id, policyId: policyIT.id, employeeId: awa.id, method: "read", acknowledgedAt: now },
      update: { acknowledgedAt: now },
    });
  }
  if (mamadou) {
    await prisma.policyAck.upsert({
      where: { policyId_employeeId: { policyId: policyRI.id, employeeId: mamadou.id } },
      create: { tenantId: tenant.id, policyId: policyRI.id, employeeId: mamadou.id, method: "otp", acknowledgedAt: now },
      update: { acknowledgedAt: now },
    });
  }

  // =======================
  //   >>> DÉMO OPÉRATIONS
  // =======================
  const { from, to } = currentPeriodYM();

  // Nettoyage du mois courant par personne (sécurité)
  for (const e of [awa, mamadou, fatou].filter(Boolean)) {
    const empName = `${e.firstName} ${e.lastName}`;
    await prisma.timesheet.deleteMany({
      where: { tenantId: tenant.id, date: { gte: from, lt: to }, OR: [{ employee: { contains: empName } }, { employeeId: e.id }] }
    });
    await prisma.expense.deleteMany({
      where: { tenantId: tenant.id, date: { gte: from, lt: to }, OR: [{ employee: { contains: empName } }, { employeeId: e.id }] }
    });
    await prisma.leave.deleteMany({
      where: {
        tenantId: tenant.id,
        AND: [
          { OR: [{ employee: { contains: empName } }, { employeeId: e.id }] },
          {
            OR: [
              { start: { gte: from, lt: to } },
              { end:   { gt: from,  lte: to } },
              { AND: [{ start: { lt: to } }, { end: { gt: from } }] } // chevauchement
            ]
          }
        ]
      }
    });
  }

  // 1) Awa : jours + HS + 1 sans solde + 1 remboursement
  if (awa) {
    const awaName = `${awa.firstName} ${awa.lastName}`;
    const workDays = [1,2,3,4,5,8,9,10,11,12,15,16];
    for (const [idx, d] of workDays.entries()) {
      const status = idx % 3 === 0 ? "Approved" : "Submitted";
      await prisma.timesheet.create({
        data: {
          tenantId: tenant.id,
          employee: awaName,
          employeeId: awa.id,
          date: new Date(from.getFullYear(), from.getMonth(), d),
          hours: 9,
          project: "Run RH",
          note: idx % 4 === 0 ? "Support RH" : null,
          status,
          type: idx % 2 === 0 ? "OT_DAY" : "REG",
          premium: idx % 2 === 0 ? 0.15 : null,
        }
      });
    }
    await prisma.expense.create({
      data: {
        tenantId: tenant.id,
        employee: awaName,
        employeeId: awa.id,
        date: new Date(from.getFullYear(), from.getMonth(), 7),
        category: "Transport",
        amount: 15000,
        currency: "XOF",
        status: "Approved",
        taxTreatment: "REIMBURSEMENT",
      }
    });
    await prisma.leave.create({
      data: {
        tenantId: tenant.id,
        employee: awaName,
        employeeId: awa.id,
        start: new Date(from.getFullYear(), from.getMonth(), 13),
        end:   new Date(from.getFullYear(), from.getMonth(), 13),
        status: "Approved",
        paid: false,
        type: "SansSolde",
      }
    });
  }

  // 2) Mamadou : 7 jours + CP en attente
  if (mamadou) {
    const mName = `${mamadou.firstName} ${mamadou.lastName}`;
    const workDays = [1,2,3,4,5,8,9];
    for (const d of workDays) {
      await prisma.timesheet.create({
        data: {
          tenantId: tenant.id,
          employee: mName,
          employeeId: mamadou.id,
          date: new Date(from.getFullYear(), from.getMonth(), d),
          hours: 8,
          project: "Site Ouest",
          status: "Submitted",
          type: "REG",
        }
      });
    }
    await prisma.leave.create({
      data: {
        tenantId: tenant.id,
        employee: mName,
        employeeId: mamadou.id,
        start: new Date(from.getFullYear(), from.getMonth(), 20),
        end:   new Date(from.getFullYear(), from.getMonth(), 22),
        status: "Pending",
        paid: true,
        type: "CP",
      }
    });
  }

  // 3) Fatou : 1 remboursement + CP rejeté
  if (fatou) {
    const fatName = `${fatou.firstName} ${fatou.lastName}`;
    await prisma.expense.create({
      data: {
        tenantId: tenant.id,
        employee: fatName,
        employeeId: fatou.id,
        date: new Date(from.getFullYear(), from.getMonth(), 10),
        category: "Repas",
        amount: 7000,
        currency: "XOF",
        status: "Approved",
        taxTreatment: "REIMBURSEMENT",
      }
    });
    await prisma.leave.create({
      data: {
        tenantId: tenant.id,
        employee: fatName,
        employeeId: fatou.id,
        start: new Date(from.getFullYear(), from.getMonth(), 5),
        end:   new Date(from.getFullYear(), from.getMonth(), 6),
        status: "Rejected",
        paid: true,
        type: "CP",
      }
    });
  }

  if (leaveBalanceEngineReady && leaveTypeMap.size > 0) {
    const currentYear = new Date().getFullYear();
    const employeesForBalance = await prisma.employee.findMany({
      where: { tenantId: tenant.id },
      select: { id: true },
    });
    for (const emp of employeesForBalance) {
      await rebuildLeaveBalancesForEmployee({
        tenantId: tenant.id,
        employeeId: emp.id,
        year: currentYear,
        leaveTypeMap,
      });
    }
  }

  // =======================
  //   >>> WORKFLOWS / HR REQUESTS / INTERVIEWS / NOTIFICATIONS
  // =======================
  const hrWorkflow = await prisma.workflowDefinition.create({
    data: {
      tenantId: tenant.id,
      code: "HR_REQUEST_STANDARD",
      name: "Demande RH standard",
      module: "HR_REQUEST",
      isActive: true,
      maxLevel: 2,
    },
  });
  await prisma.workflowStep.create({
    data: {
      workflowDefinitionId: hrWorkflow.id,
      level: 1,
      approverType: "MANAGER",
      slaHours: 24,
      isRequired: true,
    },
  });
  await prisma.workflowStep.create({
    data: {
      workflowDefinitionId: hrWorkflow.id,
      level: 2,
      approverType: "ROLE",
      approverRole: "RH",
      slaHours: 48,
      isRequired: true,
    },
  });

  let pendingRequest = null;
  if (fatou && fatouUser) {
    const submittedAt = addDays(now, -1);
    pendingRequest = await prisma.hrRequest.create({
      data: {
        tenantId: tenant.id,
        requesterUserId: fatouUser.id,
        employeeId: fatou.id,
        type: "ATTESTATION",
        title: "Attestation de travail",
        description: "Besoin d'une attestation pour dossier bancaire.",
        payload: { channel: "download" },
        status: "PENDING_MANAGER",
        priority: "NORMAL",
        submittedAt,
        slaDueAt: addDays(now, 2),
      },
    });

    const pendingInstance = await prisma.workflowInstance.create({
      data: {
        tenantId: tenant.id,
        definitionId: hrWorkflow.id,
        module: "HR_REQUEST",
        resourceType: "HrRequest",
        resourceId: pendingRequest.id,
        status: "PENDING",
        currentLevel: 1,
        requestedById: fatouUser.id,
        assignedToId: amadouUser?.id || null,
        submittedAt,
      },
    });

    await prisma.workflowAction.create({
      data: {
        tenantId: tenant.id,
        instanceId: pendingInstance.id,
        actorId: fatouUser.id,
        action: "SUBMIT",
        level: 1,
        payload: { source: "seed" },
      },
    });

    pendingRequest = await prisma.hrRequest.update({
      where: { id: pendingRequest.id },
      data: {
        workflowInstanceId: pendingInstance.id,
        currentApproverId: amadouUser?.id || null,
      },
    });
  }

  if (awa && marieUser) {
    const submittedAt = addDays(now, -6);
    const resolvedAt = addDays(now, -4);
    const approvedRequest = await prisma.hrRequest.create({
      data: {
        tenantId: tenant.id,
        requesterUserId: marieUser.id,
        employeeId: awa.id,
        type: "DATA_CHANGE",
        title: "Mise à jour adresse domicile",
        description: "Changement d'adresse Dakar Plateau.",
        payload: { field: "address" },
        status: "APPROVED",
        priority: "LOW",
        submittedAt,
        resolvedAt,
      },
    });

    const approvedInstance = await prisma.workflowInstance.create({
      data: {
        tenantId: tenant.id,
        definitionId: hrWorkflow.id,
        module: "HR_REQUEST",
        resourceType: "HrRequest",
        resourceId: approvedRequest.id,
        status: "APPROVED",
        currentLevel: 2,
        requestedById: marieUser.id,
        assignedToId: null,
        submittedAt,
        decidedAt: resolvedAt,
      },
    });

    await prisma.workflowAction.createMany({
      data: [
        {
          tenantId: tenant.id,
          instanceId: approvedInstance.id,
          actorId: marieUser.id,
          action: "SUBMIT",
          level: 1,
        },
        {
          tenantId: tenant.id,
          instanceId: approvedInstance.id,
          actorId: marieUser.id,
          action: "APPROVE",
          level: 1,
        },
        {
          tenantId: tenant.id,
          instanceId: approvedInstance.id,
          actorId: marieUser.id,
          action: "APPROVE",
          level: 2,
        },
      ],
    });

    await prisma.hrRequest.update({
      where: { id: approvedRequest.id },
      data: { workflowInstanceId: approvedInstance.id, currentApproverId: null },
    });
  }

  const interviewCampaign = await prisma.interviewCampaign.create({
    data: {
      tenantId: tenant.id,
      name: "Campagne entretiens annuels",
      period: String(now.getFullYear()),
      type: "ANNUAL",
      status: "open",
      startDate: new Date(now.getFullYear(), 0, 1),
      endDate: new Date(now.getFullYear(), 11, 31),
    },
  });

  if (fatou) {
    await prisma.interview.create({
      data: {
        tenantId: tenant.id,
        campaignId: interviewCampaign.id,
        employeeId: fatou.id,
        managerEmployeeId: amadouManager?.id || null,
        managerUserId: amadouUser?.id || null,
        type: "ANNUAL",
        status: "PLANNED",
        scheduledAt: addDays(now, 5),
      },
    });
  }

  if (mamadou) {
    await prisma.interview.create({
      data: {
        tenantId: tenant.id,
        campaignId: interviewCampaign.id,
        employeeId: mamadou.id,
        managerEmployeeId: amadouManager?.id || null,
        managerUserId: amadouUser?.id || null,
        type: "PROBATION",
        status: "DONE",
        scheduledAt: addDays(now, -3),
        startedAt: addDays(now, -3),
        completedAt: addDays(now, -2),
        summary: "Validation période d'essai positive.",
        score: 4,
      },
    });
  }

  if (fatouUser) {
    await prisma.notification.create({
      data: {
        tenantId: tenant.id,
        userId: fatouUser.id,
        actorId: amadouUser?.id || null,
        channel: "IN_APP",
        type: "INTERVIEW_SCHEDULED",
        title: "Entretien planifié",
        body: "Votre entretien annuel est planifié.",
        data: { campaign: interviewCampaign.name },
        status: "SENT",
        sentAt: now,
      },
    });
  }
  if (pendingRequest && amadouUser) {
    await prisma.notification.create({
      data: {
        tenantId: tenant.id,
        userId: amadouUser.id,
        actorId: fatouUser?.id || null,
        channel: "IN_APP",
        type: "HR_REQUEST_PENDING_APPROVAL",
        title: "Demande RH à valider",
        body: "Une demande d'attestation attend votre validation.",
        data: { requestId: pendingRequest.id },
        status: "SENT",
        sentAt: now,
      },
    });
  }

  // ---- Event d'exemple
  await prisma.event.create({
    data: {
      tenantId: tenant.id,
      title: "Réunion d'équipe",
      date: new Date(),
      time: "09:30",
      type: "meeting",
      location: "Salle 1",
    }
  });

  // Backfill : lier userId s'il manque
  const usersAll = await prisma.user.findMany({ where: { tenantId: tenant.id } });
  for (const u of usersAll) {
    const emp = await prisma.employee.findFirst({ where: { tenantId: u.tenantId, email: u.email } });
    if (emp && !emp.userId) {
      await prisma.employee.update({ where: { id: emp.id }, data: { userId: u.id } });
    }
  }

  console.log("✅ Seed terminé.");
}

try {
  await main();
} catch (e) {
  console.error("❌ Seed échoué:", e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}

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

async function main() {
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
  const permNames = ["all", "directory_read", "operations_read", "operations_write"];
  const perms = {};
  for (const p of permNames) perms[p] = await upsertPermission(p, tenant.id);

  const roleRH       = await upsertRole("RH", tenant.id);
  const roleManager  = await upsertRole("Manager", tenant.id);
  const roleEmployee = await upsertRole("Employee", tenant.id);

  await prisma.rolePermission.deleteMany({
    where: { roleId: { in: [roleRH.id, roleManager.id, roleEmployee.id] } },
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
    ],
    skipDuplicates: true,
  });
  await prisma.rolePermission.createMany({
    data: [{ roleId: roleEmployee.id, permissionId: perms["directory_read"].id }],
    skipDuplicates: true,
  });

  // ---------- Users ----------
  const passwordHash = await bcrypt.hash("Demo2025!", 10);
  const fixed = [
    { firstName: "Marie",  lastName: "Ndiaye", email: "marie@acme.sn",   role: roleRH },
    { firstName: "Amadou", lastName: "Ba",     email: "amadou@acme.sn",  role: roleManager },
    { firstName: "Fatou",  lastName: "Diop",   email: "fatou@acme.sn",   role: roleEmployee },
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
  await prisma.leave.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.timesheet.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.expense.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.event.deleteMany({ where: { tenantId: tenant.id } });

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
    where: { email: { in: ["marie@acme.sn", "amadou@acme.sn", "fatou@acme.sn"] }, tenantId: tenant.id }
  });

  for (const u of demoUsers) {
    const existsEmp = await prisma.employee.findUnique({ where: { email: u.email } });
    const salary = u.email === "marie@acme.sn"  ? 650000
                 : u.email === "amadou@acme.sn" ? 550000
                 : u.email === "fatou@acme.sn"   ? 400000
                 : 350000;

    if (!existsEmp) {
      let department = "Operations";
      let position   = "Employé";
      if (u.email === "marie@acme.sn")  { department = "RH";         position = "HR Manager"; }
      if (u.email === "amadou@acme.sn") { department = "Operations"; position = "Manager"; }
      if (u.email === "fatou@acme.sn")  { department = "Finance";    position = "Analyste"; }

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
  //   >>> DÉMO OPÉRATIONS (Timesheets / Expenses / Leaves) – compatibles paie
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
        OR: [{ employee: { contains: empName } }, { employeeId: e.id }],
        OR: [
          { start: { gte: from, lt: to } },
          { end:   { gt: from,  lte: to } },
          { AND: [{ start: { lt: to } }, { end: { gt: from } }] }
        ]
      }
    });
  }

  // 1) Awa : 12 jours, HS typées, 1 jour sans solde, 1 dépense approuvée
  if (awa) {
    const awaName = `${awa.firstName} ${awa.lastName}`;
    const workDays = [1,2,3,4,5,8,9,10,11,12,15,16]; // 12 jours
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

  // 2) Mamadou : 7 jours Submitted + CP en attente
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

  // 3) Fatou : 1 dépense approuvée, CP rejeté
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

  // Backfill : lier userId s'il manque encore
  const usersAll = await prisma.user.findMany({ where: { tenantId: tenant.id } });
  for (const u of usersAll) {
    const emp = await prisma.employee.findFirst({ where: { tenantId: u.tenantId, email: u.email } });
    if (emp && !emp.userId) {
      await prisma.employee.update({ where: { id: emp.id }, data: { userId: u.id } });
    }
  }

  console.log("✅ Seed terminé (profil paie + ops compatibles paie SN).");
}

try {
  await main();
} catch (e) {
  console.error("❌ Seed échoué:", e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}

import express from "express";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { prisma } from "../prisma.js";
import { computePayrollSN } from "../payroll/engine.js";

const router = express.Router();
const uploadDir = path.resolve("uploads/payslips");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const ENSURE_PERIOD = (p) => (p && /^\d{4}-\d{2}$/.test(p)) ? p : new Date().toISOString().slice(0,7);
const periodRange = (period) => {
  const [y, m] = period.split("-").map(Number);
  return { from: new Date(y, m-1, 1), to: new Date(y, m, 1) };
};
const getTenantId = (req) => req.auth?.tid || req.user?.tenantId;

function loadRules() {
  const p = path.resolve("backend/src/payroll/rules/senegal_2025.json");
  const txt = fs.readFileSync(p, "utf8");
  return JSON.parse(txt);
}

// HS typées
async function getOvertimeForEmployee(tenantId, employee, employeeId, period, hourlyBase, rules) {
  const { from, to } = periodRange(period);
  const where = {
    tenantId,
    date: { gte: from, lt: to },
    status: "Approved"
  };
  if (employeeId) where["OR"] = [{ employeeId }, { employee: { contains: employee } }];
  else where["employee"] = { contains: employee };

  const tss = await prisma.timesheet.findMany({
    where,
    select: { hours: true, type: true, premium: true }
  });

  const cfg = rules.overtime || { types: { REG: { premium: 0 } } };
  const agg = { REG: 0, OT_DAY: 0, OT_NIGHT: 0, OT_SUN: 0, OT_HOL: 0 };
  tss.forEach(t => {
    const typ = (t.type || "REG").toUpperCase();
    agg[typ] = (agg[typ] || 0) + (t.hours || 0);
  });

  const rows = Object.entries(agg)
    .filter(([,h]) => h > 0)
    .map(([k, h]) => ({
      label: k,
      hours: h,
      hourly: hourlyBase / 173,
      premium: cfg.types?.[k]?.premium ?? (k.startsWith("OT") ? 0.15 : 0.0)
    }));

  const amount = rows.reduce((s, r) => s + r.hours * r.hourly * (1 + r.premium), 0);
  return { overtimeXof: Math.round(amount), details: rows };
}

// Remboursements post-net
async function getReimbursements(tenantId, employee, employeeId, period) {
  const { from, to } = periodRange(period);
  const where = {
    tenantId,
    date: { gte: from, lt: to },
    status: "Approved"
  };
  if (employeeId) where["OR"] = [{ employeeId }, { employee: { contains: employee } }];
  else where["employee"] = { contains: employee };

  const rows = await prisma.expense.findMany({
    where,
    select: { amount: true, currency: true, taxTreatment: true }
  });

  const totalXof = rows
    .filter(r => (r.currency || "XOF").toUpperCase() === "XOF")
    .filter(r => (r.taxTreatment || "REIMBURSEMENT").toUpperCase() === "REIMBURSEMENT")
    .reduce((s, r) => s + (r.amount || 0), 0);

  return {
    reimbursementsXof: totalXof,
    reimbursements: totalXof ? [{ label: "Frais remboursés", amount: totalXof }] : []
  };
}

// Jours sans solde approuvés
async function getUnpaidLeaveDays(tenantId, employee, employeeId, period) {
  const { from, to } = periodRange(period);
  const where = {
    tenantId,
    status: "Approved",
    OR: [
      { start: { gte: from, lt: to } },
      { end:   { gt: from,  lte: to } },
      { AND: [{ start: { lt: to } }, { end: { gt: from } }] }
    ]
  };
  if (employeeId) where["OR"].push({ employeeId });
  if (employee)   where["OR"].push({ employee: { contains: employee } });

  const leaves = await prisma.leave.findMany({
    where,
    select: { start: true, end: true, paid: true }
  });

  const day = 86400000;
  let days = 0;
  for (const l of leaves) {
    if (l.paid) continue;
    const s = new Date(Math.max(new Date(l.start).getTime(), from.getTime()));
    const e = new Date(Math.min(new Date(l.end).getTime(),   to.getTime() - 1));
    if (e >= s) days += Math.max(0, Math.round((e - s) / day) + 1);
  }
  return Math.min(days, 26);
}

// PDF simple
async function renderPayslipPDF(fullPath, meta, calc) {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const stream = fs.createWriteStream(fullPath);
  doc.pipe(stream);

  const fmt = (n) => new Intl.NumberFormat("fr-FR").format(n) + " XOF";

  doc.fontSize(16).text("ACME – Bulletin de paie", { align: "center" });
  doc.moveDown(0.2);
  doc.fontSize(10).text(`Période : ${meta.period} — ${meta.employee.fullName}`, { align: "center" });
  doc.moveDown(0.8);

  doc.font("Helvetica-Bold").text("Détail des éléments");
  doc.moveDown(0.3);
  doc.font("Helvetica-Bold");
  doc.text("Nature", { continued: true, width: 220 });
  doc.text("Montant", { align: "right" });
  doc.font("Helvetica");

  calc.lines.forEach(l => {
    doc.text(l.label, { continued: true, width: 220 });
    doc.text(fmt(Math.abs(l.amount)), { align: "right" });
  });

  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").text("Récapitulatif");
  doc.font("Helvetica");
  doc.text("Brut", { continued: true, width: 220 }); doc.text(fmt(calc.brut), { align: "right" });
  doc.text("IR (ou TRIMF)", { continued: true, width: 220 }); doc.text(fmt(Math.max(calc.ir, calc.trimf)), { align: "right" });
  doc.text("Net à payer", { continued: true, width: 220 }); doc.text(fmt(calc.net), { align: "right" });
  doc.text("Coût employeur", { continued: true, width: 220 }); doc.text(fmt(calc.coutEmployeur), { align: "right" });

  doc.end();
  await new Promise((ok) => stream.on("finish", ok));
}

/* =========================
 *           ROUTES
 * ========================= */

// Aperçu “Préparation paie”
router.get("/preview", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const period = ENSURE_PERIOD(req.query.period);
    const rules = loadRules();

    const employees = await prisma.employee.findMany({
      where: { tenantId, status: "ACTIVE" },
      select: {
        id: true, firstName: true, lastName: true, email: true, position: true, baseSalary: true,
        cadre: true, atRate: true, transportTaxable: true, benefits: true
      },
    });

    const rows = [];
    let totalBrut = 0, totalNet = 0, totalEmpCost = 0;

    for (const e of employees) {
      const fullName = `${e.firstName} ${e.lastName}`.trim();
      const base = e.baseSalary || 350000;

      const { details: hsRows } =
        await getOvertimeForEmployee(tenantId, fullName, e.id, period, base, rules);
      const { reimbursementsXof, reimbursements } =
        await getReimbursements(tenantId, fullName, e.id, period);
      const leaveDaysUnpaid = await getUnpaidLeaveDays(tenantId, fullName, e.id, period);

      const primesTaxables = [];
      const primesNonTax = [];

      const allowanceHousing = Math.round(base * 0.15);
      primesTaxables.push({ label: "Prime de logement", amount: allowanceHousing });

      const transportAmount = 25000;
      if (e.transportTaxable !== false) primesTaxables.push({ label: "Prime transport", amount: transportAmount });
      else primesNonTax.push({ label: "Indemnité transport (non imposable)", amount: transportAmount });

      const avantages = [];
      if (e.benefits?.housing) avantages.push({ label: "Avantage logement", amount: Number(e.benefits.housing) });
      if (e.benefits?.car)     avantages.push({ label: "Avantage véhicule", amount: Number(e.benefits.car) });

      const result = computePayrollSN({
        base,
        primesTaxables,
        primesNonTax,
        overtime: hsRows,
        avantages,
        absencesOuvres: leaveDaysUnpaid,
        joursOuvresMois: 26,
        retenues: [],
        remboursements: reimbursements,
        cadre: !!e.cadre,
        atRate: e.atRate ?? 0.03
      }, rules);

      rows.push({
        employeeId: e.id,
        employee: { id: e.id, firstName: e.firstName, lastName: e.lastName, email: e.email, position: e.position || "" },
        period,
        ...result
      });

      totalBrut += result.brut;
      totalNet  += result.net;
      totalEmpCost += result.coutEmployeur;
    }

    res.json({
      period,
      kpis: {
        employees: rows.length,
        totalGross: totalBrut,
        totalNet,
        totalEmployerCost: totalEmpCost
      },
      items: rows
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "preview_failed" });
  }
});

// Génération d’un bulletin PDF (unitaire)
router.post("/payslip/:employeeId/generate", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { employeeId } = req.params;
    const period = ENSURE_PERIOD(req.body?.period);
    const rules = loadRules();

    const e = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true, firstName: true, lastName: true, email: true, position: true, baseSalary: true,
        cadre: true, atRate: true, transportTaxable: true, benefits: true
      },
    });
    if (!e) return res.status(404).json({ error: "employee_not_found" });

    const fullName = `${e.firstName} ${e.lastName}`.trim();
    const base = e.baseSalary || 350000;

    const { details: hsRows } =
      await getOvertimeForEmployee(tenantId, fullName, e.id, period, base, rules);
    const { reimbursementsXof, reimbursements } =
      await getReimbursements(tenantId, fullName, e.id, period);
    const leaveDaysUnpaid = await getUnpaidLeaveDays(tenantId, fullName, e.id, period);

    const primesTaxables = [];
    const primesNonTax = [];
    const allowanceHousing = Math.round(base * 0.15);
    primesTaxables.push({ label: "Prime de logement", amount: allowanceHousing });

    const transportAmount = 25000;
    if (e.transportTaxable !== false) primesTaxables.push({ label: "Prime transport", amount: transportAmount });
    else primesNonTax.push({ label: "Indemnité transport (non imposable)", amount: transportAmount });

    const avantages = [];
    if (e.benefits?.housing) avantages.push({ label: "Avantage logement", amount: Number(e.benefits.housing) });
    if (e.benefits?.car)     avantages.push({ label: "Avantage véhicule", amount: Number(e.benefits.car) });

    const calc = computePayrollSN({
      base,
      primesTaxables,
      primesNonTax,
      overtime: hsRows,
      avantages,
      absencesOuvres: leaveDaysUnpaid,
      joursOuvresMois: 26,
      retenues: [],
      remboursements: reimbursements,
      cadre: !!e.cadre,
      atRate: e.atRate ?? 0.03
    }, rules);

    const fileName = `bulletin_${period}_${(e.lastName || "X").trim()}_${(e.firstName || "X").trim()}.pdf`.replace(/\s+/g, "_");
    const fullPath = path.join(uploadDir, fileName);

    await renderPayslipPDF(fullPath, { period, employee: { fullName } }, calc);
    return res.json({ ok: true, fileUrl: `/uploads/payslips/${fileName}`, calc });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "generation_failed" });
  }
});

// Génération batch
router.post("/generate-all", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const period = ENSURE_PERIOD(req.body?.period);
    const rules = loadRules();

    const employees = await prisma.employee.findMany({
      where: { tenantId, status: "ACTIVE" },
      select: {
        id: true, firstName: true, lastName: true, email: true, position: true, baseSalary: true,
        cadre: true, atRate: true, transportTaxable: true, benefits: true
      },
    });

    const generated = [];

    for (const e of employees) {
      const fullName = `${e.firstName} ${e.lastName}`.trim();
      const base = e.baseSalary || 350000;

      const { details: hsRows } =
        await getOvertimeForEmployee(tenantId, fullName, e.id, period, base, rules);
      const { reimbursementsXof, reimbursements } =
        await getReimbursements(tenantId, fullName, e.id, period);
      const leaveDaysUnpaid = await getUnpaidLeaveDays(tenantId, fullName, e.id, period);

      const primesTaxables = [];
      const primesNonTax = [];
      const allowanceHousing = Math.round(base * 0.15);
      primesTaxables.push({ label: "Prime de logement", amount: allowanceHousing });
      const transportAmount = 25000;
      if (e.transportTaxable !== false) primesTaxables.push({ label: "Prime transport", amount: transportAmount });
      else primesNonTax.push({ label: "Indemnité transport (non imposable)", amount: transportAmount });

      const avantages = [];
      if (e.benefits?.housing) avantages.push({ label: "Avantage logement", amount: Number(e.benefits.housing) });
      if (e.benefits?.car)     avantages.push({ label: "Avantage véhicule", amount: Number(e.benefits.car) });

      const calc = computePayrollSN({
        base,
        primesTaxables,
        primesNonTax,
        overtime: hsRows,
        avantages,
        absencesOuvres: leaveDaysUnpaid,
        joursOuvresMois: 26,
        retenues: [],
        remboursements: reimbursements,
        cadre: !!e.cadre,
        atRate: e.atRate ?? 0.03
      }, rules);

      const fileName = `bulletin_${period}_${(e.lastName || "X").trim()}_${(e.firstName || "X").trim()}.pdf`.replace(/\s+/g, "_");
      const fullPath = path.join(uploadDir, fileName);

      if (!fs.existsSync(fullPath)) {
        await renderPayslipPDF(fullPath, { period, employee: { fullName } }, calc);
      }

      generated.push({ employeeId: e.id, employeeName: fullName, url: `/uploads/payslips/${fileName}` });
    }

    res.json({ ok: true, period, count: generated.length, items: generated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "generate_all_failed" });
  }
});

// Listing fichiers générés
router.get("/payslips", async (req, res) => {
  try {
    const period = ENSURE_PERIOD(req.query.period);
    const files = fs.readdirSync(uploadDir)
      .filter(f => f.startsWith(`bulletin_${period}_`) && f.endsWith(".pdf"))
      .sort();

    const items = files.map(f => {
      const full = path.join(uploadDir, f);
      const stat = fs.statSync(full);
      return { file: f, url: `/uploads/payslips/${f}`, period, createdAt: stat.mtime };
    });

    res.json({ items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "list_failed" });
  }
});

// Espace employé : aperçu & fichiers
router.get("/my/preview", async (req, res) => {
  try {
    const period = ENSURE_PERIOD(req.query.period);
    const me = await prisma.employee.findFirst({ where: { userId: req.auth?.sub } });
    if (!me) return res.status(404).json({ error: "employee_not_found" });

    const rules = loadRules();
    const base = me.baseSalary || 350000;
    const fullName = `${me.firstName} ${me.lastName}`.trim();

    const { details: hsRows } =
      await getOvertimeForEmployee(me.tenantId, fullName, me.id, period, base, rules);
    const { reimbursementsXof, reimbursements } =
      await getReimbursements(me.tenantId, fullName, me.id, period);
    const leaveDaysUnpaid = await getUnpaidLeaveDays(me.tenantId, fullName, me.id, period);

    const primesTaxables = [{ label: "Prime de logement", amount: Math.round(base * 0.15) }];
    const primesNonTax = [];
    const avantages = [];
    const retenues = [];
    const remboursementsArr = reimbursementsXof ? [...reimbursements] : [];

    const result = computePayrollSN({
      base,
      primesTaxables,
      primesNonTax,
      overtime: hsRows,
      avantages,
      absencesOuvres: leaveDaysUnpaid,
      joursOuvresMois: 26,
      retenues,
      remboursements: remboursementsArr,
      cadre: !!me.cadre,
      atRate: me.atRate ?? 0.03
    }, rules);

    res.json({ period, result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "my_preview_failed" });
  }
});

router.get("/my/slips", async (req, res) => {
  try {
    const period = ENSURE_PERIOD(req.query.period);
    const me = await prisma.employee.findFirst({ where: { userId: req.auth?.sub } });
    if (!me) return res.status(404).json({ error: "employee_not_found" });

    const pattern = `bulletin_${period}_${(me.lastName || "X").trim()}_${(me.firstName || "X").trim()}`.replace(/\s+/g, "_");
    const items = fs.readdirSync(uploadDir)
      .filter(f => f.startsWith(pattern) && f.endsWith(".pdf"))
      .map(f => {
        const full = path.join(uploadDir, f);
        const stat = fs.statSync(full);
        return { url: `/uploads/payslips/${f}`, period, createdAt: stat.mtime };
      });

    res.json({ items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "my_slips_failed" });
  }
});

export default router;

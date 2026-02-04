// backend/src/routes/people.js
import express from "express";
import { prisma } from "../prisma.js";
import { z } from "zod";
import multer from "multer";
import fs from "fs";
import path from "path";

const router = express.Router();

/* ============================================
 * Tenant helper : req.auth.tenantId | req.auth.tid | req.user.tenantId | X-Tenant-Id
 * ============================================ */
const getTenantId = (req) =>
  req.auth?.tenantId ||
  req.auth?.tid ||
  req.user?.tenantId ||
  req.headers["x-tenant-id"] ||
  null;

/* ============================================
 * Stockage fichiers (documents RH)
 * ============================================ */
const uploadDir = path.resolve("uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const ts = Date.now();
    const safe = (file.originalname || "file").replace(/\s+/g, "_");
    cb(null, `${ts}_${safe}`);
  },
});
const upload = multer({ storage });

/* ============================================
 * Validations
 * ============================================ */
const EmployeeCreate = z.object({
  // Core
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  phoneWhatsApp: z.string().optional(),
  country: z.string().default("SN"),
  department: z.string().optional(),
  site: z.string().optional(),
  position: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  joinDate: z.string().optional(),
  endDate: z.string().optional(),
  contractType: z
    .enum(["CDI", "CDD", "STAGE", "INTERIM", "APPRENTISSAGE"])
    .optional(),

  // Conformité
  cnss: z.string().optional(),
  ipres: z.string().optional(),

  managerId: z.string().optional(),

  // --- Champs Paie (optionnels) ---
  internalMatricule: z.string().optional(),
  baseSalary: z.union([z.number(), z.string()]).optional(), // Number or numeric string
  isCadre: z.union([z.boolean(), z.string()]).optional(),
  atRate: z.union([z.number(), z.string()]).optional(), // ex 0.02
  familyParts: z.union([z.number(), z.string()]).optional(),
  transportTaxable: z.union([z.boolean(), z.string()]).optional(),
  bankName: z.string().optional(),
  bankIban: z.string().optional(),
  bankAccount: z.string().optional(),
});

const DocCreate = z.object({
  label: z.string().min(1),
  type: z.string().optional(),
  expiresAt: z.string().optional(),
});

/* ============================================
 * Utils de conversion pour PATCH/POST
 * ============================================ */
const toNullableNumber = (v) => {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
};

const toNullableDate = (v) => {
  if (v === undefined) return undefined;
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const toBoolean = (v) => {
  if (v === undefined) return undefined;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(s)) return true;
    if (["false", "0", "no", "off"].includes(s)) return false;
  }
  return Boolean(v);
};

/* =========================================================
 *      LIST employees
 * ========================================================= */
router.get("/employees", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ message: "Unauthorized" });

    const {
      q = "",
      country = "",
      department = "",
      site = "",
      status = "",
      page = "1",
      pageSize = "12",
    } = req.query;

    const p = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.min(50, Math.max(1, parseInt(pageSize, 10) || 12));

    const where = {
      tenantId,
      AND: [
        country ? { country } : {},
        department ? { department } : {},
        site ? { site } : {},
        status ? { status } : {},
        q
          ? {
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { position: { contains: q, mode: "insensitive" } },
                { department: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    };

    const [total, items] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.findMany({
        where,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        skip: (p - 1) * ps,
        take: ps,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          country: true,
          department: true,
          site: true,
          position: true,
          status: true,
          joinDate: true,
          cnss: true,
          ipres: true,
          // --- Champs Paie visibles dans la liste
          internalMatricule: true,
          baseSalary: true,
          isCadre: true,
          atRate: true,
          familyParts: true,
          transportTaxable: true,
          bankName: true,
          bankIban: true,
          bankAccount: true,
        },
      }),
    ]);

    res.json({ total, items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* =========================================================
 *      DETAIL employee
 * ========================================================= */
router.get("/employees/:id", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ message: "Unauthorized" });

    const emp = await prisma.employee.findFirst({
      where: { id: req.params.id, tenantId },
      include: {
        manager: { select: { id: true, firstName: true, lastName: true } },
        documents: { orderBy: { createdAt: "desc" } },
        activities: { orderBy: { when: "desc" }, take: 10 },
        goals: { orderBy: { updatedAt: "desc" }, take: 5 },
        certifications: { orderBy: { expiresAt: "asc" } },
      },
      // On pourrait aussi utiliser select, mais include conserve la compat rétro.
    });
    if (!emp) return res.status(404).json({ message: "Introuvable" });
    res.json(emp);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* =========================================================
 *      CREATE employee
 * ========================================================= */
router.post("/employees", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ message: "Unauthorized" });

    const payload = EmployeeCreate.parse(req.body);

    const created = await prisma.employee.create({
      data: {
        // Core
        tenantId,
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        phone: payload.phone || null,
        phoneWhatsApp: payload.phoneWhatsApp || null,
        country: payload.country || "SN",
        department: payload.department || null,
        site: payload.site || null,
        position: payload.position || null,
        status: payload.status || "ACTIVE",
        joinDate: toNullableDate(payload.joinDate),
        endDate: toNullableDate(payload.endDate),
        contractType: payload.contractType || null,

        // Conformité
        cnss: payload.cnss || null,
        ipres: payload.ipres || null,

        // Manager
        managerId: payload.managerId || null,

        // Paie
        internalMatricule: payload.internalMatricule || null,
        baseSalary: toNullableNumber(payload.baseSalary),
        isCadre:
          payload.isCadre === undefined ? null : toBoolean(payload.isCadre),
        atRate: toNullableNumber(payload.atRate),
        familyParts: toNullableNumber(payload.familyParts),
        transportTaxable:
          payload.transportTaxable === undefined
            ? null
            : toBoolean(payload.transportTaxable),
        bankName: payload.bankName || null,
        bankIban: payload.bankIban || null,
        bankAccount: payload.bankAccount || null,
      },
    });
    res.status(201).json(created);
  } catch (e) {
    if (e.name === "ZodError")
      return res
        .status(400)
        .json({ message: "Données invalides", issues: e.issues });
    console.error(e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* =========================================================
 *      UPDATE employee (PUT = full, mais on accepte du partiel)
 *      + expose les champs paie
 * ========================================================= */
router.put("/employees/:id", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ message: "Unauthorized" });

    const payload = EmployeeCreate.partial().parse(req.body);

    const data = {
      // Core RH
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phone: payload.phone === undefined ? undefined : payload.phone || null,
      phoneWhatsApp:
        payload.phoneWhatsApp === undefined
          ? undefined
          : payload.phoneWhatsApp || null,
      country: payload.country,
      department:
        payload.department === undefined ? undefined : payload.department || null,
      site: payload.site === undefined ? undefined : payload.site || null,
      position: payload.position === undefined ? undefined : payload.position || null,
      status: payload.status,
      joinDate: toNullableDate(payload.joinDate),
      endDate: toNullableDate(payload.endDate),
      contractType:
        payload.contractType === undefined ? undefined : payload.contractType || null,

      // Conformité
      cnss: payload.cnss === undefined ? undefined : payload.cnss || null,
      ipres: payload.ipres === undefined ? undefined : payload.ipres || null,

      // Manager
      managerId:
        payload.managerId === undefined ? undefined : payload.managerId || null,

      // Paie
      internalMatricule:
        payload.internalMatricule === undefined
          ? undefined
          : payload.internalMatricule || null,
      baseSalary: toNullableNumber(payload.baseSalary),
      isCadre:
        payload.isCadre === undefined ? undefined : toBoolean(payload.isCadre),
      atRate: toNullableNumber(payload.atRate),
      familyParts: toNullableNumber(payload.familyParts),
      transportTaxable:
        payload.transportTaxable === undefined
          ? undefined
          : toBoolean(payload.transportTaxable),
      bankName: payload.bankName === undefined ? undefined : payload.bankName || null,
      bankIban: payload.bankIban === undefined ? undefined : payload.bankIban || null,
      bankAccount:
        payload.bankAccount === undefined ? undefined : payload.bankAccount || null,
    };

    const updated = await prisma.employee.update({
      where: { id: req.params.id },
      data,
    });
    res.json(updated);
  } catch (e) {
    if (e.code === "P2025")
      return res.status(404).json({ message: "Introuvable" });
    if (e.name === "ZodError")
      return res
        .status(400)
        .json({ message: "Données invalides", issues: e.issues });
    console.error(e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* =========================================================
 *      DELETE employee
 * ========================================================= */
router.delete("/employees/:id", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ message: "Unauthorized" });

    await prisma.employee.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === "P2025")
      return res.status(404).json({ message: "Introuvable" });
    console.error(e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* =========================================================
 *      UPLOAD employee doc
 * ========================================================= */
router.post(
  "/employees/:id/documents",
  upload.single("file"),
  async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ message: "Unauthorized" });
      if (!req.file) return res.status(400).json({ message: "Fichier manquant" });

      const meta = DocCreate.parse(req.body);
      const url = `/uploads/${req.file.filename}`;

      const doc = await prisma.document.create({
        data: {
          tenantId,
          employeeId: req.params.id,
          label: meta.label,
          type: meta.type || null,
          url,
          expiresAt: meta.expiresAt ? new Date(meta.expiresAt) : null,
        },
      });
      res.status(201).json(doc);
    } catch (e) {
      if (e.name === "ZodError")
        return res
          .status(400)
          .json({ message: "Données invalides", issues: e.issues });
      console.error(e);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/* =========================================================
 *      DELETE employee doc
 * ========================================================= */
router.delete("/documents/:docId", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ message: "Unauthorized" });

    const doc = await prisma.document.delete({ where: { id: req.params.docId } });
    const filePath = path.join(uploadDir, path.basename(doc.url || ""));
    if (doc.url && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.json({ ok: true });
  } catch (e) {
    if (e.code === "P2025")
      return res.status(404).json({ message: "Introuvable" });
    console.error(e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* =========================================================
 *      COMPTEURS pour Sidebar
 * ========================================================= */

// GET /people/counters/directory
router.get("/counters/directory", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ message: "Unauthorized" });

    const profilesIncomplete = await prisma.employee.count({
      where: {
        tenantId,
        OR: [{ phone: null }, { department: null }, { position: null }],
      },
    });

    const soon = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    const docsExpiring = await prisma.certification.count({
      where: {
        tenantId,
        expiresAt: { lte: soon, gte: new Date() },
      },
    });

    res.json({
      profilesIncomplete,
      docsExpiring,
      total: (profilesIncomplete || 0) + (docsExpiring || 0),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// GET /people/counters/performance
router.get("/counters/performance", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ message: "Unauthorized" });

    const goalsPending = await prisma.goal.count({
      where: {
        tenantId,
        NOT: { status: "completed" },
      },
    });

    const reviewsDue = await prisma.reviewCycle.count({
      where: {
        tenantId,
        goals: { some: { NOT: { status: "completed" } } },
      },
    });

    res.json({
      goalsPending,
      reviewsDue,
      total: (goalsPending || 0) + (reviewsDue || 0),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// GET /people/counters/training
router.get("/counters/training", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ message: "Unauthorized" });

    const soon = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    const certsExpiring = await prisma.certification.count({
      where: {
        tenantId,
        expiresAt: { lte: soon, gte: new Date() },
      },
    });

    const twoWeeks = new Date(Date.now() + 14 * 24 * 3600 * 1000);
    const sessionsSoon = await prisma.session.count({
      where: {
        tenantId,
        startDate: { gte: new Date(), lte: twoWeeks },
      },
    });

    res.json({
      certsExpiring,
      sessionsSoon,
      total: (certsExpiring || 0) + (sessionsSoon || 0),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

export default router;

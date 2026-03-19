// backend/src/routes/people.js
import express from "express";
import { prisma } from "../prisma.js";
import { z } from "zod";
import multer from "multer";
import fs from "fs";
import path from "path";
import { requirePermissions } from "../rbac.js";
import { logAuditEvent } from "../lib/audit.js";
import { createEmployeeDocument } from "../lib/employeeDocuments.js";
import {
  buildEmployeeScopeWhere,
  canAccessEmployeeId,
  resolveAccessContext,
} from "../lib/accessScope.js";

const router = express.Router();

// Lecture annuaire requise par défaut
router.use(requirePermissions(["directory_read"], "anyOf"));

/* ============================================
 * Tenant helper : req.auth.tenantId | req.auth.tid | req.user.tenantId | X-Tenant-Id
 * ============================================ */
const getTenantId = (req) =>
  req.auth?.tenantId ||
  req.auth?.tid ||
  req.user?.tenantId ||
  req.headers["x-tenant-id"] ||
  null;

async function hasAllPermission(req) {
  if (typeof req.__hasAllPermission === "boolean") {
    return req.__hasAllPermission;
  }

  const tenantId = getTenantId(req);
  const userId = req.auth?.sub;
  if (!tenantId || !userId) {
    req.__hasAllPermission = false;
    return false;
  }

  const row = await prisma.userRole.findFirst({
    where: {
      userId,
      role: {
        tenantId,
        rolePermissions: {
          some: { permission: { name: "all" } },
        },
      },
    },
    select: { userId: true },
  });

  req.__hasAllPermission = !!row;
  return req.__hasAllPermission;
}

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
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_SIZE_MB || 10);
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_UPLOAD_MIME_TYPES.has(file.mimetype)) return cb(null, true);
    return cb(new Error("unsupported_file_type"));
  },
});

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

const valueEquals = (a, b) => {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof Date && typeof b === "string") return a.getTime() === new Date(b).getTime();
  if (b instanceof Date && typeof a === "string") return b.getTime() === new Date(a).getTime();
  return a === b;
};

/* =========================================================
 *      LIST employees
 * ========================================================= */
router.get("/employees", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ message: "Unauthorized" });
    const accessContext = await resolveAccessContext(req);
    const canSeePayroll = await hasAllPermission(req);

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
      ...buildEmployeeScopeWhere(accessContext, { field: "id" }),
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

    const select = {
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
      endDate: true,
      contractType: true,
      managerId: true,
      manager: { select: { id: true, firstName: true, lastName: true } },
      cnss: true,
      ipres: true,
    };
    if (canSeePayroll) {
      Object.assign(select, {
        internalMatricule: true,
        baseSalary: true,
        isCadre: true,
        atRate: true,
        familyParts: true,
        transportTaxable: true,
        bankName: true,
        bankIban: true,
        bankAccount: true,
      });
    }

    const [total, items] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.findMany({
        where,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        skip: (p - 1) * ps,
        take: ps,
        select,
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
    const accessContext = await resolveAccessContext(req);
    const canSeePayroll = await hasAllPermission(req);
    if (!canAccessEmployeeId(accessContext, req.params.id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const select = {
      id: true,
      tenantId: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      phoneWhatsApp: true,
      country: true,
      department: true,
      site: true,
      position: true,
      status: true,
      joinDate: true,
      endDate: true,
      contractType: true,
      cnss: true,
      ipres: true,
      managerId: true,
      manager: { select: { id: true, firstName: true, lastName: true } },
      documents: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          label: true,
          type: true,
          url: true,
          expiresAt: true,
          createdAt: true,
        },
      },
      activities: {
        orderBy: { when: "desc" },
        take: 10,
        select: {
          id: true,
          title: true,
          when: true,
        },
      },
      goals: {
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          progress: true,
          updatedAt: true,
        },
      },
      certifications: {
        orderBy: { expiresAt: "asc" },
        select: {
          id: true,
          name: true,
          issuedAt: true,
          expiresAt: true,
        },
      },
    };
    if (canSeePayroll) {
      Object.assign(select, {
        internalMatricule: true,
        baseSalary: true,
        isCadre: true,
        atRate: true,
        familyParts: true,
        transportTaxable: true,
        bankName: true,
        bankIban: true,
        bankAccount: true,
      });
    }

    const emp = await prisma.employee.findFirst({
      where: { id: req.params.id, tenantId },
      select,
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
router.post("/employees", requirePermissions(["all"], "anyOf"), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ message: "Unauthorized" });

    const payload = EmployeeCreate.parse(req.body);
    if (payload.managerId) {
      const manager = await prisma.employee.findFirst({
        where: { id: payload.managerId, tenantId },
        select: { id: true },
      });
      if (!manager) {
        return res.status(400).json({ message: "managerId invalide pour ce tenant" });
      }
    }

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

    await logAuditEvent({
      tenantId,
      actorId: req.auth?.sub || null,
      type: "EMPLOYEE_CREATE",
      entity: "employee",
      entityId: created.id,
      payload: {
        email: created.email,
        department: created.department,
        site: created.site,
        status: created.status,
      },
      ip: req.ip,
      ua: req.get("user-agent"),
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
 *      UPDATE employee (PUT/PATCH = partiel accepté)
 *      + expose les champs paie
 * ========================================================= */
async function updateEmployeeHandler(req, res) {
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

    const exists = await prisma.employee.findFirst({
      where: { id: req.params.id, tenantId },
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
        endDate: true,
        contractType: true,
        managerId: true,
      },
    });
    if (!exists) return res.status(404).json({ message: "Introuvable" });

    if (payload.managerId) {
      const manager = await prisma.employee.findFirst({
        where: { id: payload.managerId, tenantId },
        select: { id: true },
      });
      if (!manager) {
        return res.status(400).json({ message: "managerId invalide pour ce tenant" });
      }
    }

    const updated = await prisma.employee.update({
      where: { id: req.params.id },
      data,
    });

    const changedFields = Object.entries(data)
      .filter(([, value]) => value !== undefined)
      .filter(([key, value]) => !valueEquals(exists[key], value))
      .map(([key]) => key);

    await logAuditEvent({
      tenantId,
      actorId: req.auth?.sub || null,
      type: "EMPLOYEE_UPDATE",
      entity: "employee",
      entityId: updated.id,
      payload: { changedFields },
      ip: req.ip,
      ua: req.get("user-agent"),
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
}

router.put("/employees/:id", requirePermissions(["all"], "anyOf"), updateEmployeeHandler);
router.patch("/employees/:id", requirePermissions(["all"], "anyOf"), updateEmployeeHandler);

/* =========================================================
 *      DELETE employee
 * ========================================================= */
router.delete("/employees/:id", requirePermissions(["all"], "anyOf"), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ message: "Unauthorized" });

    const exists = await prisma.employee.findFirst({
      where: { id: req.params.id, tenantId },
      select: { id: true, email: true, department: true, status: true },
    });
    if (!exists) return res.status(404).json({ message: "Introuvable" });

    await prisma.employee.delete({ where: { id: req.params.id } });

    await logAuditEvent({
      tenantId,
      actorId: req.auth?.sub || null,
      type: "EMPLOYEE_DELETE",
      entity: "employee",
      entityId: exists.id,
      payload: {
        email: exists.email,
        department: exists.department,
        status: exists.status,
      },
      ip: req.ip,
      ua: req.get("user-agent"),
    });

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
  requirePermissions(["all"], "anyOf"),
  upload.single("file"),
  async (req, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ message: "Unauthorized" });
      const meta = DocCreate.parse(req.body);

      const doc = await createEmployeeDocument({
        tenantId,
        employeeId: req.params.id,
        file: req.file,
        label: meta.label,
        type: meta.type || null,
        expiresAt: meta.expiresAt || null,
      });

      await logAuditEvent({
        tenantId,
        actorId: req.auth?.sub || null,
        type: "DOCUMENT_UPLOAD",
        entity: "document",
        entityId: doc.id,
        payload: {
          employeeId: doc.employeeId,
          label: doc.label,
          type: doc.type,
        },
        ip: req.ip,
        ua: req.get("user-agent"),
      });

      res.status(201).json(doc);
    } catch (e) {
      if (e.name === "ZodError")
        return res
          .status(400)
          .json({ message: "Données invalides", issues: e.issues });
      if (e instanceof multer.MulterError && e.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: `Fichier trop volumineux. Taille max: ${MAX_UPLOAD_MB} Mo.`,
          error: "file_too_large",
        });
      }
      if (e?.message === "unsupported_file_type") {
        return res.status(400).json({
          message: "Type de fichier non autorisé. Utilisez PDF, JPG, PNG, WEBP, DOC ou DOCX.",
          error: "unsupported_file_type",
        });
      }
      if (e?.status)
        return res.status(e.status).json({ message: e.message, error: e.code || null });
      console.error(e);
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

/* =========================================================
 *      DELETE employee doc
 * ========================================================= */
router.delete("/documents/:docId", requirePermissions(["all"], "anyOf"), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ message: "Unauthorized" });

    const existing = await prisma.document.findFirst({
      where: { id: req.params.docId, tenantId },
      select: { id: true, url: true, employeeId: true, label: true, type: true },
    });
    if (!existing) return res.status(404).json({ message: "Introuvable" });

    const doc = await prisma.document.delete({ where: { id: req.params.docId } });
    const filePath = path.join(uploadDir, path.basename(doc.url || ""));
    if (doc.url && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await logAuditEvent({
      tenantId,
      actorId: req.auth?.sub || null,
      type: "DOCUMENT_DELETE",
      entity: "document",
      entityId: existing.id,
      payload: {
        employeeId: existing.employeeId,
        label: existing.label,
        type: existing.type,
      },
      ip: req.ip,
      ua: req.get("user-agent"),
    });

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
    const accessContext = await resolveAccessContext(req);

    const profilesIncomplete = await prisma.employee.count({
      where: {
        tenantId,
        ...buildEmployeeScopeWhere(accessContext, { field: "id" }),
        OR: [{ phone: null }, { department: null }, { position: null }],
      },
    });

    const soon = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    const docsExpiring = await prisma.certification.count({
      where: {
        tenantId,
        ...buildEmployeeScopeWhere(accessContext, { field: "employeeId" }),
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
    const accessContext = await resolveAccessContext(req);

    const goalsPending = await prisma.goal.count({
      where: {
        tenantId,
        ...buildEmployeeScopeWhere(accessContext, { field: "employeeId" }),
        NOT: { status: "completed" },
      },
    });

    let reviewsDue = 0;
    if (accessContext.scope === "COMPANY") {
      reviewsDue = await prisma.reviewCycle.count({
        where: {
          tenantId,
          goals: { some: { NOT: { status: "completed" } } },
        },
      });
    } else {
      reviewsDue = goalsPending;
    }

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
    const accessContext = await resolveAccessContext(req);

    const soon = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    const certsExpiring = await prisma.certification.count({
      where: {
        tenantId,
        ...buildEmployeeScopeWhere(accessContext, { field: "employeeId" }),
        expiresAt: { lte: soon, gte: new Date() },
      },
    });

    const twoWeeks = new Date(Date.now() + 14 * 24 * 3600 * 1000);
    let sessionsSoon = 0;
    if (accessContext.scope === "COMPANY") {
      sessionsSoon = await prisma.session.count({
        where: {
          tenantId,
          startDate: { gte: new Date(), lte: twoWeeks },
        },
      });
    } else {
      sessionsSoon = await prisma.enrollment.count({
        where: {
          tenantId,
          ...buildEmployeeScopeWhere(accessContext, { field: "employeeId" }),
          session: { startDate: { gte: new Date(), lte: twoWeeks } },
        },
      });
    }

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

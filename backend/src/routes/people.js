// backend/src/routes/people.js
import express from "express";
import { prisma } from "../prisma.js";
import { z } from "zod";
import multer from "multer";
import fs from "fs";
import path from "path";

const router = express.Router();

// --- tenant helper: supporte req.auth.tenantId, req.auth.tid ou header X-Tenant-Id
const getTenantId = (req) =>
  req.auth?.tenantId ||
  req.auth?.tid ||
  req.user?.tenantId ||
  req.headers["x-tenant-id"] ||
  null;

// --- stockage fichiers (documents RH)
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

// --- validations
const EmployeeCreate = z.object({
  firstName: z.string().min(1),
  lastName:  z.string().min(1),
  email:     z.string().email(),
  phone:     z.string().optional(),
  phoneWhatsApp: z.string().optional(),
  country:   z.string().default("SN"),
  department:z.string().optional(),
  site:      z.string().optional(),
  position:  z.string().optional(),
  status:    z.enum(["ACTIVE","INACTIVE"]).default("ACTIVE"),
  joinDate:  z.string().optional(),
  endDate:   z.string().optional(),
  contractType: z.enum(["CDI","CDD","STAGE","INTERIM","APPRENTISSAGE"]).optional(),
  cnss:      z.string().optional(),
  ipres:     z.string().optional(),
  managerId: z.string().optional(),
});

const DocCreate = z.object({
  label: z.string().min(1),
  type:  z.string().optional(),
  expiresAt: z.string().optional(),
});

/* =========================
 *      LIST employees
 * ========================= */
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
                { lastName:  { contains: q, mode: "insensitive" } },
                { position:  { contains: q, mode: "insensitive" } },
                { department:{ contains: q, mode: "insensitive" } },
                { email:     { contains: q, mode: "insensitive" } },
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
        },
      }),
    ]);

    res.json({ total, items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* =========================
 *      DETAIL employee
 * ========================= */
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
    });
    if (!emp) return res.status(404).json({ message: "Introuvable" });
    res.json(emp);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* =========================
 *      CREATE employee
 * ========================= */
router.post("/employees", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ message: "Unauthorized" });

    const payload = EmployeeCreate.parse(req.body);
    const created = await prisma.employee.create({
      data: {
        ...payload,
        tenantId,
        joinDate: payload.joinDate ? new Date(payload.joinDate) : null,
        endDate:  payload.endDate  ? new Date(payload.endDate)  : null,
      },
    });
    res.status(201).json(created);
  } catch (e) {
    if (e.name === "ZodError")
      return res.status(400).json({ message: "Données invalides", issues: e.issues });
    console.error(e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* =========================
 *      UPDATE employee
 * ========================= */
router.put("/employees/:id", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ message: "Unauthorized" });

    const payload = EmployeeCreate.partial().parse(req.body);
    const updated = await prisma.employee.update({
      where: { id: req.params.id },
      data: {
        ...payload,
        joinDate: payload.joinDate ? new Date(payload.joinDate) : undefined,
        endDate:  payload.endDate  ? new Date(payload.endDate)  : undefined,
      },
    });
    res.json(updated);
  } catch (e) {
    if (e.code === "P2025") return res.status(404).json({ message: "Introuvable" });
    if (e.name === "ZodError")
      return res.status(400).json({ message: "Données invalides", issues: e.issues });
    console.error(e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* =========================
 *      DELETE employee
 * ========================= */
router.delete("/employees/:id", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ message: "Unauthorized" });

    await prisma.employee.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === "P2025") return res.status(404).json({ message: "Introuvable" });
    console.error(e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* =========================
 *     UPLOAD employee doc
 * ========================= */
router.post("/employees/:id/documents", upload.single("file"), async (req, res) => {
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
      return res.status(400).json({ message: "Données invalides", issues: e.issues });
    console.error(e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* =========================
 *     DELETE employee doc
 * ========================= */
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
    if (e.code === "P2025") return res.status(404).json({ message: "Introuvable" });
    console.error(e);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* =========================
 *   COMPTEURS pour Sidebar
 * ========================= */

// GET /people/counters/directory
router.get("/counters/directory", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ message: "Unauthorized" });

    const profilesIncomplete = await prisma.employee.count({
      where: {
        tenantId,
        OR: [
          { phone: null },
          { department: null },
          { position: null },
        ],
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

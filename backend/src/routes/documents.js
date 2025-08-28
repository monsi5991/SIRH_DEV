// backend/src/routes/documents.js  (ESM + export default)
import express from "express";
import path from "node:path";
import fs from "node:fs";
import multer from "multer";

import { prisma } from "../prisma.js";
import { verifyAccess } from "../auth.js";

const router = express.Router();

// Protéger toutes les routes "documents"
router.use(verifyAccess);

// --- storage uploads locaux (déjà servi par app.use("/uploads", ...))
const uploadsDir = path.resolve("uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const upload = multer({ dest: uploadsDir });

/* =========================
 *         TEMPLATES
 * ========================= */
// GET /documents/templates?category=onboarding|offboarding
router.get("/templates", async (_req, res) => {
  // Pour la démo, on renvoie une liste statique suffisante pour le UI
  res.json({
    onboarding: [
      { key: "offer_fr",     label: "Lettre d’offre (FR)" },
      { key: "contract_cdi", label: "Contrat CDI" },
      { key: "contract_cdd", label: "Contrat CDD" },
      { key: "nda",          label: "Confidentialité (NDA)" },
    ],
    offboarding: [
      { key: "resignation",     label: "Lettre de démission" },
      { key: "termination",     label: "Lettre de rupture" },
      { key: "work_certificate",label: "Certificat de travail" },
      { key: "employment_att",  label: "Attestation d’emploi" },
    ],
  });
});

/* =========================
 *        ONBOARDING
 * ========================= */
// GET /documents/onboarding/cases?status=open
router.get("/onboarding/cases", async (req, res) => {
  const tenantId = req.auth.tenantId;
  const { status } = req.query; // "open" | "closed" | undefined
  const where = { tenantId };
  if (status === "open") where.status = { not: "closed" };
  if (status === "closed") where.status = "closed";

  const items = await prisma.onboardingCase.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  // pour coller au front : employee est un objet affiché
  const shaped = items.map((c) => ({
    ...c,
    employee: {
      firstName: c.employeeFirstName || c.employeeName?.split(" ")[0] || "",
      lastName:  c.employeeLastName  || c.employeeName?.split(" ").slice(1).join(" ") || "",
      email:     c.employeeEmail || "",
      position:  c.employeePosition || "",
    },
  }));

  res.json({ items: shaped });
});

// POST /documents/onboarding/start
// body: { employee: {firstName,lastName,email,position?}, templates: [keys], checklist: [{key,done}] }
router.post("/onboarding/start", async (req, res) => {
  const tenantId = req.auth.tenantId;
  const { employee, templates = [], checklist = [] } = req.body || {};

  if (!employee?.firstName || !employee?.lastName || !employee?.email) {
    return res.status(400).json({ error: "Missing employee fields" });
  }
  if (!templates.length) {
    return res.status(400).json({ error: "Select at least one template" });
  }

  const created = await prisma.onboardingCase.create({
    data: {
      tenantId,
      employeeName:       `${employee.firstName} ${employee.lastName}`,
      employeeFirstName:  employee.firstName,
      employeeLastName:   employee.lastName,
      employeeEmail:      employee.email,
      employeePosition:   employee.position || null,
      templates,                 // Json
      checklist,                 // Json
      currentStep: "collect",
      status: "open",
    },
  });

  res.json({ ok: true, case: created });
});

/* =========================
 *        OFFBOARDING
 * ========================= */
// GET /documents/offboarding/cases?status=open
router.get("/offboarding/cases", async (req, res) => {
  const tenantId = req.auth.tenantId;
  const { status } = req.query;
  const where = { tenantId };
  if (status === "open") where.status = { not: "closed" };
  if (status === "closed") where.status = "closed";

  const items = await prisma.offboardingCase.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  const shaped = items.map((c) => ({
    ...c,
    employee: {
      firstName: c.employeeFirstName || c.employeeName?.split(" ")[0] || "",
      lastName:  c.employeeLastName  || c.employeeName?.split(" ").slice(1).join(" ") || "",
      email:     c.employeeEmail || "",
      reason:    c.reason || "",
    },
  }));

  res.json({ items: shaped });
});

// POST /documents/offboarding/start
// body: { employee: {firstName,lastName,email,reason?}, templates: [keys], checklist: [{key,done}] }
router.post("/offboarding/start", async (req, res) => {
  const tenantId = req.auth.tenantId;
  const { employee, templates = [], checklist = [] } = req.body || {};

  if (!employee?.firstName || !employee?.lastName || !employee?.email) {
    return res.status(400).json({ error: "Missing employee fields" });
  }
  if (!templates.length) {
    return res.status(400).json({ error: "Select at least one template" });
  }

  const created = await prisma.offboardingCase.create({
    data: {
      tenantId,
      employeeName:       `${employee.firstName} ${employee.lastName}`,
      employeeFirstName:  employee.firstName,
      employeeLastName:   employee.lastName,
      employeeEmail:      employee.email,
      reason:             employee.reason || null,
      templates,                 // Json
      checklist,                 // Json
      currentStep: "letter",
      status: "open",
    },
  });

  res.json({ ok: true, case: created });
});

/* =========================
 *          UPLOAD
 * ========================= */
// POST /documents/upload (form-data: file, employeeId?, label?)
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const tenantId = req.auth.tenantId;
    if (!req.file) return res.status(400).json({ error: "file missing" });

    // exemple : rattacher au premier employé si non fourni
    const employeeId = req.body?.employeeId || null;
    const label = req.body?.label || req.file.originalname;

    // Ici, on stocke au modèle Document (lié à Employee) déjà présent dans ton schema
    const doc = await prisma.document.create({
      data: {
        tenantId,
        employeeId,                 // peut être null si tu veux autoriser sans lien direct
        label,
        type: "autre",
        url: `/uploads/${req.file.filename}`,
      },
    });

    res.json(doc);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: "Upload failed" });
  }
});

export default router;

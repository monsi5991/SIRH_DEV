// backend/src/routes/documents.js
import express from "express";
import path from "node:path";
import fs from "node:fs";
import multer from "multer";

import { prisma } from "../prisma.js";
import { requirePermissions } from "../rbac.js";

const router = express.Router();

// index.js met déjà verifyKeycloak + attachDbAuthFromKeycloak

const uploadsDir = path.resolve("uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const upload = multer({ dest: uploadsDir });

const ONBOARDING_TEMPLATES = [
  { key: "offer_fr", label: "Lettre d’offre (FR)" },
  { key: "contract_cdi", label: "Contrat CDI" },
  { key: "contract_cdd", label: "Contrat CDD" },
  { key: "nda", label: "Confidentialité (NDA)" },
];

const OFFBOARDING_TEMPLATES = [
  { key: "resignation", label: "Lettre de démission" },
  { key: "termination", label: "Lettre de rupture" },
  { key: "work_certificate", label: "Certificat de travail" },
  { key: "employment_att", label: "Attestation d’emploi" },
];

// Helpers
const asString = (v) => (v == null ? "" : String(v));
const asArray = (v) => (Array.isArray(v) ? v : []);
const asChecklist = (v) => (Array.isArray(v) ? v : []);

function shapeOnboarding(c) {
  return {
    ...c,
    employee: {
      firstName: c.employeeFirstName || (c.employeeName || "").split(" ")[0] || "",
      lastName: c.employeeLastName || (c.employeeName || "").split(" ").slice(1).join(" ") || "",
      email: c.employeeEmail || "",
      position: c.employeePosition || "",
    },
  };
}

function shapeOffboarding(c) {
  return {
    ...c,
    employee: {
      firstName: c.employeeFirstName || (c.employeeName || "").split(" ")[0] || "",
      lastName: c.employeeLastName || (c.employeeName || "").split(" ").slice(1).join(" ") || "",
      email: c.employeeEmail || "",
      reason: c.reason || "",
    },
  };
}

/* =========================
 *         TEMPLATES
 * ========================= */
// GET /documents/templates?category=onboarding|offboarding
router.get(
  "/templates",
  requirePermissions(["directory_read"], "anyOf"),
  async (req, res) => {
    const category = String(req.query.category || "").toLowerCase();
    if (category === "onboarding") return res.json({ templates: ONBOARDING_TEMPLATES });
    if (category === "offboarding") return res.json({ templates: OFFBOARDING_TEMPLATES });
    return res.json({ onboarding: ONBOARDING_TEMPLATES, offboarding: OFFBOARDING_TEMPLATES });
  }
);

/* =========================
 *        ONBOARDING
 * ========================= */

// GET /documents/onboarding/cases?status=open|closed
router.get(
  "/onboarding/cases",
  requirePermissions(["directory_read"], "anyOf"),
  async (req, res) => {
    try {
      const tid = req.auth?.tid;
      if (!tid) return res.status(401).json({ error: "Unauthorized" });

      const status = String(req.query.status || "");
      const where = { tenantId: tid };
      if (status === "open") where.status = { not: "closed" };
      if (status === "closed") where.status = "closed";

      const items = await prisma.onboardingCase.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });

      res.json({ items: items.map(shapeOnboarding) });
    } catch (e) {
      console.error("[documents onboarding cases] error:", e);
      res.status(500).json({ error: "Failed to load onboarding cases" });
    }
  }
);

// POST /documents/onboarding/start
// body: { employee: {firstName,lastName,email,position?}, templates: [keys], checklist: [...] }
router.post(
  "/onboarding/start",
  requirePermissions(["directory_read"], "anyOf"),
  async (req, res) => {
    try {
      const tid = req.auth?.tid;
      if (!tid) return res.status(401).json({ error: "Unauthorized" });

      const { employee, templates = [], checklist = [] } = req.body || {};
      if (!employee?.firstName || !employee?.lastName || !employee?.email) {
        return res.status(400).json({ error: "Missing employee fields" });
      }
      if (!Array.isArray(templates) || templates.length === 0) {
        return res.status(400).json({ error: "Select at least one template" });
      }

      const created = await prisma.onboardingCase.create({
        data: {
          tenantId: tid,
          employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
          employeeFirstName: asString(employee.firstName) || null,
          employeeLastName: asString(employee.lastName) || null,
          employeeEmail: asString(employee.email) || null,
          employeePosition: asString(employee.position) || null,
          templates: asArray(templates),
          checklist: asChecklist(checklist),
          currentStep: "collect",
          status: "open",
        },
      });

      res.json({ ok: true, case: shapeOnboarding(created) });
    } catch (e) {
      console.error("[documents onboarding start] error:", e);
      res.status(500).json({ error: "Failed to start onboarding" });
    }
  }
);

// PUT /documents/onboarding/cases/:id
// body: { status?, currentStep?, templates?, checklist? }
router.put(
  "/onboarding/cases/:id",
  requirePermissions(["directory_read"], "anyOf"),
  async (req, res) => {
    try {
      const tid = req.auth?.tid;
      if (!tid) return res.status(401).json({ error: "Unauthorized" });

      const { id } = req.params;
      const data = {};
      if ("status" in req.body) data.status = req.body.status == null ? null : String(req.body.status);
      if ("currentStep" in req.body) data.currentStep = req.body.currentStep == null ? null : String(req.body.currentStep);
      if ("templates" in req.body) data.templates = asArray(req.body.templates);
      if ("checklist" in req.body) data.checklist = asChecklist(req.body.checklist);

      const found = await prisma.onboardingCase.findFirst({ where: { id, tenantId: tid }, select: { id: true } });
      if (!found) return res.status(404).json({ error: "Case not found" });

      const updated = await prisma.onboardingCase.update({ where: { id }, data });
      res.json({ ok: true, case: shapeOnboarding(updated) });
    } catch (e) {
      console.error("[documents onboarding update] error:", e);
      res.status(500).json({ error: "Failed to update onboarding case" });
    }
  }
);

/* =========================
 *        OFFBOARDING
 * ========================= */

// GET /documents/offboarding/cases?status=open|closed
router.get(
  "/offboarding/cases",
  requirePermissions(["directory_read"], "anyOf"),
  async (req, res) => {
    try {
      const tid = req.auth?.tid;
      if (!tid) return res.status(401).json({ error: "Unauthorized" });

      const status = String(req.query.status || "");
      const where = { tenantId: tid };
      if (status === "open") where.status = { not: "closed" };
      if (status === "closed") where.status = "closed";

      const items = await prisma.offboardingCase.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });

      res.json({ items: items.map(shapeOffboarding) });
    } catch (e) {
      console.error("[documents offboarding cases] error:", e);
      res.status(500).json({ error: "Failed to load offboarding cases" });
    }
  }
);

// POST /documents/offboarding/start
// body: { employee: {firstName,lastName,email,reason?}, templates: [keys], checklist: [...] }
router.post(
  "/offboarding/start",
  requirePermissions(["directory_read"], "anyOf"),
  async (req, res) => {
    try {
      const tid = req.auth?.tid;
      if (!tid) return res.status(401).json({ error: "Unauthorized" });

      const { employee, templates = [], checklist = [] } = req.body || {};
      if (!employee?.firstName || !employee?.lastName || !employee?.email) {
        return res.status(400).json({ error: "Missing employee fields" });
      }
      if (!Array.isArray(templates) || templates.length === 0) {
        return res.status(400).json({ error: "Select at least one template" });
      }

      const created = await prisma.offboardingCase.create({
        data: {
          tenantId: tid,
          employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
          employeeFirstName: asString(employee.firstName) || null,
          employeeLastName: asString(employee.lastName) || null,
          employeeEmail: asString(employee.email) || null,
          reason: asString(employee.reason) || null,
          templates: asArray(templates),
          checklist: asChecklist(checklist),
          currentStep: "letter",
          status: "open",
        },
      });

      res.json({ ok: true, case: shapeOffboarding(created) });
    } catch (e) {
      console.error("[documents offboarding start] error:", e);
      res.status(500).json({ error: "Failed to start offboarding" });
    }
  }
);

// PUT /documents/offboarding/cases/:id
router.put(
  "/offboarding/cases/:id",
  requirePermissions(["directory_read"], "anyOf"),
  async (req, res) => {
    try {
      const tid = req.auth?.tid;
      if (!tid) return res.status(401).json({ error: "Unauthorized" });

      const { id } = req.params;
      const data = {};
      if ("status" in req.body) data.status = req.body.status == null ? null : String(req.body.status);
      if ("currentStep" in req.body) data.currentStep = req.body.currentStep == null ? null : String(req.body.currentStep);
      if ("templates" in req.body) data.templates = asArray(req.body.templates);
      if ("checklist" in req.body) data.checklist = asChecklist(req.body.checklist);

      const found = await prisma.offboardingCase.findFirst({ where: { id, tenantId: tid }, select: { id: true } });
      if (!found) return res.status(404).json({ error: "Case not found" });

      const updated = await prisma.offboardingCase.update({ where: { id }, data });
      res.json({ ok: true, case: shapeOffboarding(updated) });
    } catch (e) {
      console.error("[documents offboarding update] error:", e);
      res.status(500).json({ error: "Failed to update offboarding case" });
    }
  }
);

/* =========================
 *          UPLOAD
 * ========================= */
// POST /documents/upload (form-data: file, employeeId, label?)
router.post(
  "/upload",
  requirePermissions(["directory_read"], "anyOf"),
  upload.single("file"),
  async (req, res) => {
    try {
      const tid = req.auth?.tid;
      if (!tid) return res.status(401).json({ error: "Unauthorized" });

      if (!req.file) return res.status(400).json({ error: "file missing" });

      const employeeId = req.body?.employeeId;
      if (!employeeId) return res.status(400).json({ error: "employeeId is required" });

      const label = req.body?.label || req.file.originalname;

      const doc = await prisma.document.create({
        data: {
          tenantId: tid,
          employeeId,
          label,
          type: "autre",
          url: `/uploads/${req.file.filename}`,
        },
      });

      res.json(doc);
    } catch (e) {
      console.error("[documents upload] error:", e);
      res.status(400).json({ error: "Upload failed" });
    }
  }
);

export default router;

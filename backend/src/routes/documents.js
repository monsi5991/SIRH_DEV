import express from "express";
import path from "node:path";
import fs from "node:fs";
import multer from "multer";
import { randomUUID } from "node:crypto";

import { prisma } from "../prisma.js";
import { requirePermissions } from "../rbac.js";
import { createEmployeeDocument } from "../lib/employeeDocuments.js";
import {
  ensureGeneratedWorkflowDocuments,
  notifyWorkflowCompleted,
  notifyWorkflowCreated,
  notifyWorkflowTaskUpdated,
  resolveWorkflowStakeholders,
} from "../lib/workflowAutomation.js";
import {
  buildEmployeeScopeWhere,
  canAccessEmployeeId,
  resolveAccessContext,
} from "../lib/accessScope.js";

const router = express.Router();

const uploadsDir = path.resolve("uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
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
  dest: uploadsDir,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_UPLOAD_MIME_TYPES.has(file.mimetype)) {
      return cb(null, true);
    }
    return cb(new Error("unsupported_file_type"));
  },
});

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

const DEFAULT_ONBOARDING_TASKS = [
  { key: "contract-signed", task: "Contrat signé", assignedTo: "RH" },
  { key: "identity-card", task: "Carte identité fournie", assignedTo: "Salarié" },
  { key: "diploma", task: "Diplôme fourni", assignedTo: "Salarié" },
  { key: "bank-account", task: "Compte bancaire fourni", assignedTo: "Salarié" },
  { key: "cnss", task: "Numéro CNSS", assignedTo: "RH" },
  { key: "ipres", task: "Numéro IPRES", assignedTo: "RH" },
  { key: "position-setup", task: "Poste configuré", assignedTo: "Manager" },
  { key: "it-access", task: "Accès IT", assignedTo: "IT" },
];

const DEFAULT_OFFBOARDING_TASKS = [
  { key: "work-certificate", task: "Certificat travail", assignedTo: "RH" },
  { key: "final-pay", task: "Solde tout compte", assignedTo: "Paie" },
  { key: "equipment-return", task: "Restitution matériel", assignedTo: "Manager" },
  { key: "it-removal", task: "Suppression accès IT", assignedTo: "IT" },
  { key: "archive-file", task: "Archivage dossier", assignedTo: "RH" },
];

const asString = (value) => (value == null ? "" : String(value).trim());
const asArray = (value) => (Array.isArray(value) ? value : []);

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeStatus(value, done = false) {
  const raw = String(value || "").trim().toUpperCase();
  if (done || raw === "DONE" || raw === "COMPLETED" || raw === "TERMINÉ") return "DONE";
  if (raw === "IN_PROGRESS" || raw === "DOING" || raw === "EN_COURS") return "IN_PROGRESS";
  return "PENDING";
}

function readTemplatesPayload(value) {
  if (Array.isArray(value)) {
    return { selected: value, info: {} };
  }
  if (value && typeof value === "object") {
    return {
      selected: Array.isArray(value.selected) ? value.selected : Array.isArray(value.templates) ? value.templates : [],
      info: value.info && typeof value.info === "object" ? value.info : {},
    };
  }
  return { selected: [], info: {} };
}

function mergeTemplatesPayload(currentValue, nextValue, workflowInfo = {}) {
  const current = readTemplatesPayload(currentValue);
  const incoming = readTemplatesPayload(nextValue);
  const mergedInfo = {
    ...current.info,
    ...incoming.info,
    ...Object.fromEntries(
      Object.entries(workflowInfo || {}).filter(([, value]) => value !== undefined)
    ),
  };
  const selected = incoming.selected.length ? incoming.selected : current.selected;
  return { selected, info: mergedInfo };
}

function defaultOnboardingTemplates(contractType) {
  const type = String(contractType || "").toUpperCase();
  if (type === "CDD") return ["offer_fr", "contract_cdd"];
  return ["offer_fr", "contract_cdi"];
}

function defaultOffboardingTemplates() {
  return ["work_certificate", "employment_att"];
}

function buildChecklist(defaults, rawChecklist, workflowId, dueDate) {
  const source = Array.isArray(rawChecklist) && rawChecklist.length ? rawChecklist : defaults;
  return source.map((item, index) => ({
    id: asString(item?.id) || asString(item?.key) || randomUUID(),
    workflowId,
    key: asString(item?.key) || defaults[index]?.key || `task-${index + 1}`,
    task: asString(item?.task || item?.label) || defaults[index]?.task || `Tâche ${index + 1}`,
    status: normalizeStatus(item?.status, Boolean(item?.done)),
    assignedTo: asString(item?.assignedTo || item?.assigned_to) || defaults[index]?.assignedTo || null,
    dueDate: normalizeDate(item?.dueDate || item?.due_date || dueDate),
    order: Number.isFinite(Number(item?.order)) ? Number(item.order) : index,
    hint: asString(item?.hint) || null,
  }));
}

function countDoneTasks(tasks) {
  return tasks.filter((task) => task.status === "DONE").length;
}

function deriveStoredStatus(tasks, requestedStatus) {
  const explicit = String(requestedStatus || "").toLowerCase();
  if (explicit === "closed" || explicit === "done" || explicit === "completed") return "closed";
  if (tasks.length > 0 && countDoneTasks(tasks) === tasks.length) return "closed";
  return "open";
}

function deriveDisplayStatus(storedStatus, tasks) {
  if (storedStatus === "closed") return { key: "DONE", label: "Terminé" };
  const done = countDoneTasks(tasks);
  if (done > 0) return { key: "IN_PROGRESS", label: "En cours" };
  return { key: "PENDING", label: "En attente" };
}

function deriveOnboardingStep(tasks, storedStatus) {
  if (storedStatus === "closed") return "archive";
  const done = countDoneTasks(tasks);
  if (done === 0) return "collect";
  if (done < 3) return "files";
  if (done < 6) return "register";
  return "archive";
}

function deriveOffboardingStep(tasks, storedStatus) {
  if (storedStatus === "closed") return "archive";
  const done = countDoneTasks(tasks);
  if (done === 0) return "letter";
  if (done < 2) return "approvals";
  if (done < 4) return "equipment";
  return "docs";
}

async function findEmployeeSnapshot(tenantId, employeeId) {
  if (!employeeId) return null;
  return prisma.employee.findFirst({
    where: { id: employeeId, tenantId },
    select: {
      id: true,
      userId: true,
      firstName: true,
      lastName: true,
      email: true,
      position: true,
      department: true,
      site: true,
      contractType: true,
      managerId: true,
      manager: { select: { id: true, userId: true, firstName: true, lastName: true } },
    },
  });
}

function buildOnboardingInfo(inputInfo = {}, employeeRecord = null, employeePayload = null) {
  const managerName =
    asString(inputInfo.managerName) ||
    (employeeRecord?.manager
      ? `${employeeRecord.manager.firstName || ""} ${employeeRecord.manager.lastName || ""}`.trim()
      : "");

  return {
    startDate: normalizeDate(inputInfo.startDate || inputInfo.dateStart || employeePayload?.joinDate || employeeRecord?.joinDate),
    managerId: asString(inputInfo.managerId) || employeeRecord?.managerId || null,
    managerName: managerName || null,
    department: asString(inputInfo.department) || employeeRecord?.department || employeePayload?.department || null,
    site: asString(inputInfo.site) || employeeRecord?.site || employeePayload?.site || null,
    contractType: asString(inputInfo.contractType) || employeeRecord?.contractType || employeePayload?.contractType || null,
    position: asString(inputInfo.position) || employeeRecord?.position || employeePayload?.position || null,
  };
}

function buildOffboardingInfo(inputInfo = {}, employeeRecord = null) {
  return {
    departureDate: normalizeDate(inputInfo.departureDate || inputInfo.dateDeparture),
    reason: asString(inputInfo.reason) || null,
    exitType: asString(inputInfo.exitType) || null,
    department: employeeRecord?.department || null,
    site: employeeRecord?.site || null,
    position: employeeRecord?.position || null,
  };
}

function shapeEmployee(row, fallback = {}) {
  if (row) {
    return {
      id: row.id,
      firstName: row.firstName || "",
      lastName: row.lastName || "",
      email: row.email || "",
      position: row.position || "",
      department: row.department || "",
      site: row.site || "",
      contractType: row.contractType || "",
      manager: row.manager || null,
    };
  }
  return {
    id: null,
    firstName: fallback.firstName || "",
    lastName: fallback.lastName || "",
    email: fallback.email || "",
    position: fallback.position || "",
    department: fallback.department || "",
    site: fallback.site || "",
    contractType: fallback.contractType || "",
    manager: null,
  };
}

function shapeOnboarding(caseRow) {
  const templates = readTemplatesPayload(caseRow.templates);
  const info = buildOnboardingInfo(templates.info, caseRow.employee, {
    position: caseRow.employeePosition,
  });
  const tasks = buildChecklist(DEFAULT_ONBOARDING_TASKS, caseRow.checklist, caseRow.id, info.startDate);
  const storedStatus = deriveStoredStatus(tasks, caseRow.status);
  const displayStatus = deriveDisplayStatus(storedStatus, tasks);
  const completed = countDoneTasks(tasks);

  return {
    ...caseRow,
    type: "Onboarding",
    status: storedStatus,
    statusKey: displayStatus.key,
    statusLabel: displayStatus.label,
    employee: shapeEmployee(caseRow.employee, {
      firstName: caseRow.employeeFirstName || (caseRow.employeeName || "").split(" ")[0],
      lastName: caseRow.employeeLastName || (caseRow.employeeName || "").split(" ").slice(1).join(" "),
      email: caseRow.employeeEmail,
      position: caseRow.employeePosition,
      department: info.department,
      site: info.site,
      contractType: info.contractType,
    }),
    employeeName: caseRow.employeeName,
    workflowInfo: info,
    templates: templates.selected,
    generatedDocuments: asArray(templates.info?.generatedDocuments),
    checklist: tasks,
    progress: {
      completed,
      total: tasks.length,
      percent: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
      label: `${completed}/${tasks.length} tâches`,
    },
    currentStep: deriveOnboardingStep(tasks, storedStatus),
  };
}

function shapeOffboarding(caseRow) {
  const templates = readTemplatesPayload(caseRow.templates);
  const info = buildOffboardingInfo(templates.info, caseRow.employee);
  const tasks = buildChecklist(DEFAULT_OFFBOARDING_TASKS, caseRow.checklist, caseRow.id, info.departureDate);
  const storedStatus = deriveStoredStatus(tasks, caseRow.status);
  const displayStatus = deriveDisplayStatus(storedStatus, tasks);
  const completed = countDoneTasks(tasks);

  return {
    ...caseRow,
    type: "Offboarding",
    status: storedStatus,
    statusKey: displayStatus.key,
    statusLabel: displayStatus.label,
    employee: shapeEmployee(caseRow.employee, {
      firstName: caseRow.employeeFirstName || (caseRow.employeeName || "").split(" ")[0],
      lastName: caseRow.employeeLastName || (caseRow.employeeName || "").split(" ").slice(1).join(" "),
      email: caseRow.employeeEmail,
      department: info.department,
      site: info.site,
      position: info.position,
    }),
    employeeName: caseRow.employeeName,
    workflowInfo: info,
    templates: templates.selected,
    generatedDocuments: asArray(templates.info?.generatedDocuments),
    checklist: tasks,
    progress: {
      completed,
      total: tasks.length,
      percent: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
      label: `${completed}/${tasks.length} tâches`,
    },
    currentStep: deriveOffboardingStep(tasks, storedStatus),
  };
}

async function loadOnboardingCase(tenantId, id) {
  const caseRow = await prisma.onboardingCase.findFirst({
    where: { id, tenantId },
    include: {
      employee: {
        select: {
          id: true,
          userId: true,
          firstName: true,
          lastName: true,
          email: true,
          position: true,
          department: true,
          site: true,
          contractType: true,
          manager: { select: { id: true, userId: true, firstName: true, lastName: true } },
        },
      },
    },
  });
  return caseRow ? shapeOnboarding(caseRow) : null;
}

async function loadOffboardingCase(tenantId, id) {
  const caseRow = await prisma.offboardingCase.findFirst({
    where: { id, tenantId },
    include: {
      employee: {
        select: {
          id: true,
          userId: true,
          firstName: true,
          lastName: true,
          email: true,
          position: true,
          department: true,
          site: true,
          contractType: true,
          manager: { select: { id: true, userId: true, firstName: true, lastName: true } },
        },
      },
    },
  });
  return caseRow ? shapeOffboarding(caseRow) : null;
}

function canReadWorkflowCase(accessContext, workflowCase) {
  if (!workflowCase) return false;
  if (accessContext?.scope === "COMPANY") return true;
  const employeeId = workflowCase.employeeId || workflowCase.employee?.id || null;
  if (!employeeId) return false;
  return canAccessEmployeeId(accessContext, employeeId);
}

router.get(
  "/templates",
  requirePermissions(["team_read", "all"], "anyOf"),
  async (req, res) => {
    const category = String(req.query.category || "").toLowerCase();
    if (category === "onboarding") return res.json({ templates: ONBOARDING_TEMPLATES });
    if (category === "offboarding") return res.json({ templates: OFFBOARDING_TEMPLATES });
    return res.json({ onboarding: ONBOARDING_TEMPLATES, offboarding: OFFBOARDING_TEMPLATES });
  }
);

router.get(
  "/onboarding/cases",
  requirePermissions(["team_read", "all"], "anyOf"),
  async (req, res) => {
    try {
      const tid = req.auth?.tid;
      if (!tid) return res.status(401).json({ error: "Unauthorized" });
      const accessContext = await resolveAccessContext(req);

      const status = String(req.query.status || "");
      const where = {
        tenantId: tid,
        ...buildEmployeeScopeWhere(accessContext, { field: "employeeId" }),
      };
      if (status === "open") where.status = { not: "closed" };
      if (status === "closed") where.status = "closed";
      if (req.query.employeeId) {
        const employeeId = String(req.query.employeeId);
        if (!canAccessEmployeeId(accessContext, employeeId)) {
          return res.status(403).json({ error: "Forbidden" });
        }
        where.employeeId = employeeId;
      }

      const items = await prisma.onboardingCase.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        include: {
          employee: {
            select: {
              id: true,
              userId: true,
              firstName: true,
              lastName: true,
              email: true,
              position: true,
              department: true,
              site: true,
              contractType: true,
              manager: { select: { id: true, userId: true, firstName: true, lastName: true } },
            },
          },
        },
      });

      res.json({ items: items.map(shapeOnboarding) });
    } catch (e) {
      console.error("[documents onboarding cases] error:", e);
      res.status(500).json({ error: "Failed to load onboarding cases" });
    }
  }
);

router.get(
  "/onboarding/cases/:id",
  requirePermissions(["team_read", "all"], "anyOf"),
  async (req, res) => {
    try {
      const tid = req.auth?.tid;
      if (!tid) return res.status(401).json({ error: "Unauthorized" });
      const accessContext = await resolveAccessContext(req);
      const item = await loadOnboardingCase(tid, req.params.id);
      if (!item) return res.status(404).json({ error: "Case not found" });
      if (!canReadWorkflowCase(accessContext, item)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      res.json({ item });
    } catch (e) {
      console.error("[documents onboarding case] error:", e);
      res.status(500).json({ error: "Failed to load onboarding case" });
    }
  }
);

router.post(
  "/onboarding/start",
  requirePermissions(["all"], "anyOf"),
  async (req, res) => {
    try {
      const tid = req.auth?.tid;
      const actorId = req.auth?.sub || null;
      if (!tid) return res.status(401).json({ error: "Unauthorized" });

      const { employeeId = null, employee = null, workflowInfo = {}, templates = [], checklist = [] } = req.body || {};
      const employeeRecord = await findEmployeeSnapshot(tid, employeeId);

      if (employeeId && !employeeRecord) {
        return res.status(400).json({ error: "Employee not found" });
      }
      if (!employeeRecord && (!employee?.firstName || !employee?.lastName || !employee?.email)) {
        return res.status(400).json({ error: "Missing employee fields" });
      }

      const info = buildOnboardingInfo(workflowInfo, employeeRecord, employee);
      const selectedTemplates = asArray(templates).length ? asArray(templates) : defaultOnboardingTemplates(info.contractType);
      const snapshot = employeeRecord || {
        firstName: asString(employee?.firstName),
        lastName: asString(employee?.lastName),
        email: asString(employee?.email),
        position: asString(employee?.position),
      };

      const initialChecklist = buildChecklist(DEFAULT_ONBOARDING_TASKS, checklist, null, info.startDate);
      const storedStatus = deriveStoredStatus(initialChecklist, req.body?.status);
      const created = await prisma.onboardingCase.create({
        data: {
          tenantId: tid,
          employeeId: employeeRecord?.id || null,
          employeeName: `${snapshot.firstName || ""} ${snapshot.lastName || ""}`.trim(),
          employeeFirstName: snapshot.firstName || null,
          employeeLastName: snapshot.lastName || null,
          employeeEmail: snapshot.email || null,
          employeePosition: info.position || snapshot.position || null,
          templates: { selected: selectedTemplates, info },
          checklist: initialChecklist.map((task) => ({ ...task, workflowId: null })),
          currentStep: deriveOnboardingStep(initialChecklist, storedStatus),
          status: storedStatus,
        },
      });

      const finalizedChecklist = initialChecklist.map((task) => ({ ...task, workflowId: created.id }));
      const generatedDocuments = await ensureGeneratedWorkflowDocuments({
        tenantId: tid,
        workflowType: "ONBOARDING",
        workflowId: created.id,
        employeeId: employeeRecord?.id || null,
        employeeName: `${snapshot.firstName || ""} ${snapshot.lastName || ""}`.trim() || "Employe",
        selectedTemplates,
        workflowInfo: info,
        existingGeneratedDocuments: [],
      });
      const updated = await prisma.onboardingCase.update({
        where: { id: created.id },
        data: {
          checklist: finalizedChecklist,
          templates: {
            selected: selectedTemplates,
            info: {
              ...info,
              generatedDocuments,
            },
          },
        },
        include: {
          employee: {
            select: {
              id: true,
              userId: true,
              firstName: true,
              lastName: true,
              email: true,
              position: true,
              department: true,
              site: true,
              contractType: true,
              manager: { select: { id: true, userId: true, firstName: true, lastName: true } },
            },
          },
        },
      });

      const stakeholders = await resolveWorkflowStakeholders({
        tenantId: tid,
        employeeRecord: updated.employee || employeeRecord,
      });
      await notifyWorkflowCreated({
        tenantId: tid,
        actorId,
        workflowType: "ONBOARDING",
        workflowId: updated.id,
        employeeId: updated.employeeId || null,
        employeeName: updated.employeeName,
        checklist: finalizedChecklist,
        stakeholders,
      });

      res.status(201).json({ ok: true, case: shapeOnboarding(updated) });
    } catch (e) {
      console.error("[documents onboarding start] error:", e);
      res.status(500).json({ error: "Failed to start onboarding" });
    }
  }
);

router.put(
  "/onboarding/cases/:id",
  requirePermissions(["all"], "anyOf"),
  async (req, res) => {
    try {
      const tid = req.auth?.tid;
      const actorId = req.auth?.sub || null;
      if (!tid) return res.status(401).json({ error: "Unauthorized" });

      const existing = await prisma.onboardingCase.findFirst({
        where: { id: req.params.id, tenantId: tid },
        include: {
          employee: {
            select: {
              id: true,
              userId: true,
              firstName: true,
              lastName: true,
              email: true,
              position: true,
              department: true,
              site: true,
              contractType: true,
              managerId: true,
              manager: { select: { id: true, userId: true, firstName: true, lastName: true } },
            },
          },
        },
      });
      if (!existing) return res.status(404).json({ error: "Case not found" });

      const templates = mergeTemplatesPayload(existing.templates, req.body?.templates, req.body?.workflowInfo);
      const info = buildOnboardingInfo(templates.info, existing.employee, { position: existing.employeePosition });
      const checklist = "checklist" in (req.body || {})
        ? buildChecklist(DEFAULT_ONBOARDING_TASKS, req.body.checklist, existing.id, info.startDate)
        : buildChecklist(DEFAULT_ONBOARDING_TASKS, existing.checklist, existing.id, info.startDate);
      const storedStatus = deriveStoredStatus(checklist, req.body?.status ?? existing.status);
      const currentStep = req.body?.currentStep
        ? String(req.body.currentStep)
        : deriveOnboardingStep(checklist, storedStatus);
      const generatedDocuments = await ensureGeneratedWorkflowDocuments({
        tenantId: tid,
        workflowType: "ONBOARDING",
        workflowId: existing.id,
        employeeId: existing.employeeId || null,
        employeeName: existing.employeeName,
        selectedTemplates: templates.selected,
        workflowInfo: info,
        existingGeneratedDocuments: templates.info?.generatedDocuments,
      });
      const nextTemplates = {
        selected: templates.selected,
        info: {
          ...templates.info,
          generatedDocuments,
        },
      };

      const updated = await prisma.onboardingCase.update({
        where: { id: existing.id },
        data: {
          status: storedStatus,
          currentStep,
          templates: nextTemplates,
          checklist,
          employeePosition: info.position || existing.employeePosition || null,
        },
        include: {
          employee: {
            select: {
              id: true,
              userId: true,
              firstName: true,
              lastName: true,
              email: true,
              position: true,
              department: true,
              site: true,
              contractType: true,
              manager: { select: { id: true, userId: true, firstName: true, lastName: true } },
            },
          },
        },
      });

      if (existing.status !== "closed" && updated.status === "closed") {
        const stakeholders = await resolveWorkflowStakeholders({
          tenantId: tid,
          employeeRecord: updated.employee || existing.employee,
        });
        await notifyWorkflowCompleted({
          tenantId: tid,
          actorId,
          workflowType: "ONBOARDING",
          workflowId: updated.id,
          employeeId: updated.employeeId || null,
          employeeName: updated.employeeName,
          stakeholders,
        });
      }

      res.json({ ok: true, case: shapeOnboarding(updated) });
    } catch (e) {
      console.error("[documents onboarding update] error:", e);
      res.status(500).json({ error: "Failed to update onboarding case" });
    }
  }
);

router.put(
  "/onboarding/cases/:id/tasks/:taskId",
  requirePermissions(["all", "team_write"], "anyOf"),
  async (req, res) => {
    try {
      const tid = req.auth?.tid;
      const actorId = req.auth?.sub || null;
      if (!tid) return res.status(401).json({ error: "Unauthorized" });
      const accessContext = await resolveAccessContext(req);

      const existing = await prisma.onboardingCase.findFirst({
        where: { id: req.params.id, tenantId: tid },
        include: { employee: { select: { id: true, userId: true, position: true, department: true, site: true, contractType: true, managerId: true, manager: { select: { id: true, userId: true, firstName: true, lastName: true } } } } },
      });
      if (!existing) return res.status(404).json({ error: "Case not found" });
      if (!canReadWorkflowCase(accessContext, existing)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const info = buildOnboardingInfo(readTemplatesPayload(existing.templates).info, existing.employee, { position: existing.employeePosition });
      const checklist = buildChecklist(DEFAULT_ONBOARDING_TASKS, existing.checklist, existing.id, info.startDate);
      const taskIndex = checklist.findIndex((task) => task.id === req.params.taskId);
      if (taskIndex < 0) return res.status(404).json({ error: "Task not found" });

      const previousTask = { ...checklist[taskIndex] };
      checklist[taskIndex] = {
        ...previousTask,
        status: normalizeStatus(req.body?.status, req.body?.done === true),
        assignedTo: req.body?.assignedTo === undefined ? previousTask.assignedTo : asString(req.body.assignedTo) || null,
        dueDate: req.body?.dueDate === undefined ? previousTask.dueDate : normalizeDate(req.body.dueDate),
      };

      const storedStatus = deriveStoredStatus(checklist, existing.status);
      const updated = await prisma.onboardingCase.update({
        where: { id: existing.id },
        data: {
          status: storedStatus,
          currentStep: deriveOnboardingStep(checklist, storedStatus),
          checklist,
        },
        include: {
          employee: {
            select: {
              id: true,
              userId: true,
              firstName: true,
              lastName: true,
              email: true,
              position: true,
              department: true,
              site: true,
              contractType: true,
              manager: { select: { id: true, userId: true, firstName: true, lastName: true } },
            },
          },
        },
      });

      const stakeholders = await resolveWorkflowStakeholders({
        tenantId: tid,
        employeeRecord: updated.employee || existing.employee,
      });
      await notifyWorkflowTaskUpdated({
        tenantId: tid,
        actorId,
        workflowType: "ONBOARDING",
        workflowId: updated.id,
        employeeId: updated.employeeId || null,
        employeeName: updated.employeeName,
        previousTask,
        nextTask: checklist[taskIndex],
        stakeholders,
      });

      if (existing.status !== "closed" && updated.status === "closed") {
        await notifyWorkflowCompleted({
          tenantId: tid,
          actorId,
          workflowType: "ONBOARDING",
          workflowId: updated.id,
          employeeId: updated.employeeId || null,
          employeeName: updated.employeeName,
          stakeholders,
        });
      }

      res.json({ ok: true, case: shapeOnboarding(updated) });
    } catch (e) {
      console.error("[documents onboarding task update] error:", e);
      res.status(500).json({ error: "Failed to update onboarding task" });
    }
  }
);

router.get(
  "/offboarding/cases",
  requirePermissions(["team_read", "all"], "anyOf"),
  async (req, res) => {
    try {
      const tid = req.auth?.tid;
      if (!tid) return res.status(401).json({ error: "Unauthorized" });
      const accessContext = await resolveAccessContext(req);

      const status = String(req.query.status || "");
      const where = {
        tenantId: tid,
        ...buildEmployeeScopeWhere(accessContext, { field: "employeeId" }),
      };
      if (status === "open") where.status = { not: "closed" };
      if (status === "closed") where.status = "closed";
      if (req.query.employeeId) {
        const employeeId = String(req.query.employeeId);
        if (!canAccessEmployeeId(accessContext, employeeId)) {
          return res.status(403).json({ error: "Forbidden" });
        }
        where.employeeId = employeeId;
      }

      const items = await prisma.offboardingCase.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        include: {
          employee: {
            select: {
              id: true,
              userId: true,
              firstName: true,
              lastName: true,
              email: true,
              position: true,
              department: true,
              site: true,
              contractType: true,
              manager: { select: { id: true, userId: true, firstName: true, lastName: true } },
            },
          },
        },
      });

      res.json({ items: items.map(shapeOffboarding) });
    } catch (e) {
      console.error("[documents offboarding cases] error:", e);
      res.status(500).json({ error: "Failed to load offboarding cases" });
    }
  }
);

router.get(
  "/offboarding/cases/:id",
  requirePermissions(["team_read", "all"], "anyOf"),
  async (req, res) => {
    try {
      const tid = req.auth?.tid;
      if (!tid) return res.status(401).json({ error: "Unauthorized" });
      const accessContext = await resolveAccessContext(req);
      const item = await loadOffboardingCase(tid, req.params.id);
      if (!item) return res.status(404).json({ error: "Case not found" });
      if (!canReadWorkflowCase(accessContext, item)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      res.json({ item });
    } catch (e) {
      console.error("[documents offboarding case] error:", e);
      res.status(500).json({ error: "Failed to load offboarding case" });
    }
  }
);

router.post(
  "/offboarding/start",
  requirePermissions(["all"], "anyOf"),
  async (req, res) => {
    try {
      const tid = req.auth?.tid;
      const actorId = req.auth?.sub || null;
      if (!tid) return res.status(401).json({ error: "Unauthorized" });

      const { employeeId = null, employee = null, workflowInfo = {}, templates = [], checklist = [] } = req.body || {};
      const employeeRecord = await findEmployeeSnapshot(tid, employeeId);

      if (employeeId && !employeeRecord) {
        return res.status(400).json({ error: "Employee not found" });
      }
      if (!employeeRecord && (!employee?.firstName || !employee?.lastName || !employee?.email)) {
        return res.status(400).json({ error: "Missing employee fields" });
      }

      const info = buildOffboardingInfo(workflowInfo, employeeRecord);
      const selectedTemplates = asArray(templates).length ? asArray(templates) : defaultOffboardingTemplates();
      const snapshot = employeeRecord || {
        firstName: asString(employee?.firstName),
        lastName: asString(employee?.lastName),
        email: asString(employee?.email),
      };

      const initialChecklist = buildChecklist(DEFAULT_OFFBOARDING_TASKS, checklist, null, info.departureDate);
      const storedStatus = deriveStoredStatus(initialChecklist, req.body?.status);
      const created = await prisma.offboardingCase.create({
        data: {
          tenantId: tid,
          employeeId: employeeRecord?.id || null,
          employeeName: `${snapshot.firstName || ""} ${snapshot.lastName || ""}`.trim(),
          employeeFirstName: snapshot.firstName || null,
          employeeLastName: snapshot.lastName || null,
          employeeEmail: snapshot.email || null,
          reason: info.reason || null,
          templates: { selected: selectedTemplates, info },
          checklist: initialChecklist.map((task) => ({ ...task, workflowId: null })),
          currentStep: deriveOffboardingStep(initialChecklist, storedStatus),
          status: storedStatus,
        },
      });

      const finalizedChecklist = initialChecklist.map((task) => ({ ...task, workflowId: created.id }));
      const generatedDocuments = await ensureGeneratedWorkflowDocuments({
        tenantId: tid,
        workflowType: "OFFBOARDING",
        workflowId: created.id,
        employeeId: employeeRecord?.id || null,
        employeeName: `${snapshot.firstName || ""} ${snapshot.lastName || ""}`.trim() || "Employe",
        selectedTemplates,
        workflowInfo: info,
        existingGeneratedDocuments: [],
      });
      const updated = await prisma.offboardingCase.update({
        where: { id: created.id },
        data: {
          checklist: finalizedChecklist,
          templates: {
            selected: selectedTemplates,
            info: {
              ...info,
              generatedDocuments,
            },
          },
        },
        include: {
          employee: {
            select: {
              id: true,
              userId: true,
              firstName: true,
              lastName: true,
              email: true,
              position: true,
              department: true,
              site: true,
              contractType: true,
              manager: { select: { id: true, userId: true, firstName: true, lastName: true } },
            },
          },
        },
      });

      const stakeholders = await resolveWorkflowStakeholders({
        tenantId: tid,
        employeeRecord: updated.employee || employeeRecord,
      });
      await notifyWorkflowCreated({
        tenantId: tid,
        actorId,
        workflowType: "OFFBOARDING",
        workflowId: updated.id,
        employeeId: updated.employeeId || null,
        employeeName: updated.employeeName,
        checklist: finalizedChecklist,
        stakeholders,
      });

      res.status(201).json({ ok: true, case: shapeOffboarding(updated) });
    } catch (e) {
      console.error("[documents offboarding start] error:", e);
      res.status(500).json({ error: "Failed to start offboarding" });
    }
  }
);

router.put(
  "/offboarding/cases/:id",
  requirePermissions(["all"], "anyOf"),
  async (req, res) => {
    try {
      const tid = req.auth?.tid;
      const actorId = req.auth?.sub || null;
      if (!tid) return res.status(401).json({ error: "Unauthorized" });

      const existing = await prisma.offboardingCase.findFirst({
        where: { id: req.params.id, tenantId: tid },
        include: {
          employee: {
            select: {
              id: true,
              userId: true,
              firstName: true,
              lastName: true,
              email: true,
              position: true,
              department: true,
              site: true,
              contractType: true,
              manager: { select: { id: true, userId: true, firstName: true, lastName: true } },
            },
          },
        },
      });
      if (!existing) return res.status(404).json({ error: "Case not found" });

      const templates = mergeTemplatesPayload(existing.templates, req.body?.templates, req.body?.workflowInfo);
      const info = buildOffboardingInfo(templates.info, existing.employee);
      const checklist = "checklist" in (req.body || {})
        ? buildChecklist(DEFAULT_OFFBOARDING_TASKS, req.body.checklist, existing.id, info.departureDate)
        : buildChecklist(DEFAULT_OFFBOARDING_TASKS, existing.checklist, existing.id, info.departureDate);
      const storedStatus = deriveStoredStatus(checklist, req.body?.status ?? existing.status);
      const currentStep = req.body?.currentStep
        ? String(req.body.currentStep)
        : deriveOffboardingStep(checklist, storedStatus);
      const generatedDocuments = await ensureGeneratedWorkflowDocuments({
        tenantId: tid,
        workflowType: "OFFBOARDING",
        workflowId: existing.id,
        employeeId: existing.employeeId || null,
        employeeName: existing.employeeName,
        selectedTemplates: templates.selected,
        workflowInfo: info,
        existingGeneratedDocuments: templates.info?.generatedDocuments,
      });
      const nextTemplates = {
        selected: templates.selected,
        info: {
          ...templates.info,
          generatedDocuments,
        },
      };

      const updated = await prisma.offboardingCase.update({
        where: { id: existing.id },
        data: {
          status: storedStatus,
          currentStep,
          templates: nextTemplates,
          checklist,
          reason: info.reason || existing.reason || null,
        },
        include: {
          employee: {
            select: {
              id: true,
              userId: true,
              firstName: true,
              lastName: true,
              email: true,
              position: true,
              department: true,
              site: true,
              contractType: true,
              manager: { select: { id: true, userId: true, firstName: true, lastName: true } },
            },
          },
        },
      });

      if (existing.status !== "closed" && updated.status === "closed") {
        const stakeholders = await resolveWorkflowStakeholders({
          tenantId: tid,
          employeeRecord: updated.employee || existing.employee,
        });
        await notifyWorkflowCompleted({
          tenantId: tid,
          actorId,
          workflowType: "OFFBOARDING",
          workflowId: updated.id,
          employeeId: updated.employeeId || null,
          employeeName: updated.employeeName,
          stakeholders,
        });
      }

      res.json({ ok: true, case: shapeOffboarding(updated) });
    } catch (e) {
      console.error("[documents offboarding update] error:", e);
      res.status(500).json({ error: "Failed to update offboarding case" });
    }
  }
);

router.put(
  "/offboarding/cases/:id/tasks/:taskId",
  requirePermissions(["all", "team_write"], "anyOf"),
  async (req, res) => {
    try {
      const tid = req.auth?.tid;
      const actorId = req.auth?.sub || null;
      if (!tid) return res.status(401).json({ error: "Unauthorized" });
      const accessContext = await resolveAccessContext(req);

      const existing = await prisma.offboardingCase.findFirst({
        where: { id: req.params.id, tenantId: tid },
        include: { employee: { select: { id: true, userId: true, position: true, department: true, site: true, contractType: true, managerId: true, manager: { select: { id: true, userId: true, firstName: true, lastName: true } } } } },
      });
      if (!existing) return res.status(404).json({ error: "Case not found" });
      if (!canReadWorkflowCase(accessContext, existing)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const info = buildOffboardingInfo(readTemplatesPayload(existing.templates).info, existing.employee);
      const checklist = buildChecklist(DEFAULT_OFFBOARDING_TASKS, existing.checklist, existing.id, info.departureDate);
      const taskIndex = checklist.findIndex((task) => task.id === req.params.taskId);
      if (taskIndex < 0) return res.status(404).json({ error: "Task not found" });

      const previousTask = { ...checklist[taskIndex] };
      checklist[taskIndex] = {
        ...previousTask,
        status: normalizeStatus(req.body?.status, req.body?.done === true),
        assignedTo: req.body?.assignedTo === undefined ? previousTask.assignedTo : asString(req.body.assignedTo) || null,
        dueDate: req.body?.dueDate === undefined ? previousTask.dueDate : normalizeDate(req.body.dueDate),
      };

      const storedStatus = deriveStoredStatus(checklist, existing.status);
      const updated = await prisma.offboardingCase.update({
        where: { id: existing.id },
        data: {
          status: storedStatus,
          currentStep: deriveOffboardingStep(checklist, storedStatus),
          checklist,
        },
        include: {
          employee: {
            select: {
              id: true,
              userId: true,
              firstName: true,
              lastName: true,
              email: true,
              position: true,
              department: true,
              site: true,
              contractType: true,
              manager: { select: { id: true, userId: true, firstName: true, lastName: true } },
            },
          },
        },
      });

      const stakeholders = await resolveWorkflowStakeholders({
        tenantId: tid,
        employeeRecord: updated.employee || existing.employee,
      });
      await notifyWorkflowTaskUpdated({
        tenantId: tid,
        actorId,
        workflowType: "OFFBOARDING",
        workflowId: updated.id,
        employeeId: updated.employeeId || null,
        employeeName: updated.employeeName,
        previousTask,
        nextTask: checklist[taskIndex],
        stakeholders,
      });

      if (existing.status !== "closed" && updated.status === "closed") {
        await notifyWorkflowCompleted({
          tenantId: tid,
          actorId,
          workflowType: "OFFBOARDING",
          workflowId: updated.id,
          employeeId: updated.employeeId || null,
          employeeName: updated.employeeName,
          stakeholders,
        });
      }

      res.json({ ok: true, case: shapeOffboarding(updated) });
    } catch (e) {
      console.error("[documents offboarding task update] error:", e);
      res.status(500).json({ error: "Failed to update offboarding task" });
    }
  }
);

router.post(
  "/upload",
  requirePermissions(["all"], "anyOf"),
  upload.single("file"),
  async (req, res) => {
    try {
      const tid = req.auth?.tid;
      if (!tid) return res.status(401).json({ error: "Unauthorized" });

      const doc = await createEmployeeDocument({
        tenantId: tid,
        employeeId: req.body?.employeeId,
        file: req.file,
        label: req.body?.label,
        type: req.body?.type || "autre",
        expiresAt: req.body?.expiresAt || null,
      });

      res.json(doc);
    } catch (e) {
      if (e instanceof multer.MulterError) {
        if (e.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            error: "file_too_large",
            message: `Fichier trop volumineux. Taille max: ${MAX_UPLOAD_MB} Mo.`,
          });
        }
      }
      if (e?.message === "unsupported_file_type") {
        return res.status(400).json({
          error: "unsupported_file_type",
          message: "Type de fichier non autorisé. Utilisez PDF, JPG, PNG, WEBP, DOC ou DOCX.",
        });
      }
      if (e?.status) {
        return res.status(e.status).json({ error: e.code || "upload_failed", message: e.message });
      }
      console.error("[documents upload] error:", e);
      res.status(400).json({ error: "Upload failed" });
    }
  }
);

export default router;

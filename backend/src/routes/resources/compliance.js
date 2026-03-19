// backend/src/routes/resources/compliance.js
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { prisma } from "../../prisma.js";
import { requirePermissions } from "../../rbac.js";

const router = express.Router();
router.use(requirePermissions(["directory_read"], "anyOf"));

const getTenantId = (req) =>
  req.auth?.tid || req.user?.tenantId || req.headers["x-tenant-id"];

// stockage local des preuves (dev/demo)
const uploadDir = path.resolve("uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) =>
    cb(null, `${Date.now()}_${file.originalname.replace(/\s+/g, "_")}`),
});
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_SIZE_MB || 10);
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_UPLOAD_MIME_TYPES.has(file.mimetype)) return cb(null, true);
    return cb(new Error("unsupported_file_type"));
  },
});
const ALLOWED_STATUS = new Set(["TODO", "DOING", "DONE", "EXPIRED"]);

/* =========================
 *          KPIs
 * ========================= */
router.get("/summary", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });
    const now = new Date();

    const tasks = await prisma.complianceTask.findMany({
      where: { tenantId },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    });

    const kpis = {
      total: tasks.length,
      done: tasks.filter((t) => t.status === "DONE").length,
      todo: tasks.filter((t) => t.status === "TODO").length,
      overdue: tasks.filter((t) => t.status !== "DONE" && t.dueAt && t.dueAt < now).length,
      byCategory: {},
    };

    for (const t of tasks) {
      const cat = t.category || "other";
      if (!kpis.byCategory[cat]) kpis.byCategory[cat] = { total: 0, done: 0 };
      kpis.byCategory[cat].total++;
      if (t.status === "DONE") kpis.byCategory[cat].done++;
    }

    const overdue = tasks
      .filter((t) => t.status !== "DONE" && t.dueAt && t.dueAt < now)
      .slice(0, 10)
      .map((t) => ({
        id: t.id,
        label: t.label,
        category: t.category,
        employee: t.employee ? `${t.employee.firstName} ${t.employee.lastName}` : "—",
        dueAt: t.dueAt,
      }));

    res.json({ kpis, overdue });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to compute summary" });
  }
});

router.get("/counters", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });
    const now = new Date();
    const soon = new Date(Date.now() + 7 * 86400000);

    const [total, overdue, dueSoon] = await Promise.all([
      prisma.complianceTask.count({ where: { tenantId, status: "TODO" } }),
      prisma.complianceTask.count({ where: { tenantId, status: "TODO", dueAt: { lt: now } } }),
      prisma.complianceTask.count({ where: { tenantId, status: "TODO", dueAt: { gte: now, lte: soon } } }),
    ]);

    res.json({ total, overdue, dueSoon });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to compute counters" });
  }
});

/* =========================
 *        READ (list)
 * ========================= */
router.get("/tasks", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });
    const { status = "", employeeId = "", q = "", page = "1", pageSize = "20", sort = "dueAt", dir = "asc" } = req.query;
    const skip = (Number(page) - 1) * Number(pageSize);
    const orderBy = [{ [sort]: dir.toLowerCase() === "desc" ? "desc" : "asc" }];

    const where = {
      tenantId,
      ...(employeeId ? { employeeId } : {}),
      ...(q ? { OR: [{ label: { contains: q, mode: "insensitive" } }, { category: { contains: q, mode: "insensitive" } }] } : {}),
    };

    let items = await prisma.complianceTask.findMany({
      where,
      include: { employee: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy,
      skip,
      take: Number(pageSize),
    });

    const now = new Date();
    if (status.toUpperCase() === "OVERDUE") {
      items = items.filter((t) => t.status !== "DONE" && t.dueAt && t.dueAt < now);
    } else if (["TODO", "DOING", "DONE", "EXPIRED"].includes(status.toUpperCase())) {
      items = items.filter((t) => t.status === status.toUpperCase());
    }

    let total;
    if (status.toUpperCase() === "OVERDUE") {
      total = await prisma.complianceTask.count({
        where: {
          ...where,
          status: { not: "DONE" },
          dueAt: { lt: now },
        },
      });
    } else if (["TODO", "DOING", "DONE", "EXPIRED"].includes(status.toUpperCase())) {
      total = await prisma.complianceTask.count({
        where: { ...where, status: status.toUpperCase() },
      });
    } else {
      total = await prisma.complianceTask.count({ where });
    }
    res.json({ items, page: Number(page), pageSize: Number(pageSize), total });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

/* =========================
 *         WRITE
 * ========================= */
router.post("/tasks", requirePermissions(["all"], "anyOf"), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });
    const { label, category, employeeId = null, dueAt = null, notes = "", obligationKey = "" } = req.body || {};
    if (!label || !category) return res.status(400).json({ error: "label & category required" });

    if (employeeId) {
      const employee = await prisma.employee.findFirst({
        where: { id: employeeId, tenantId },
        select: { id: true },
      });
      if (!employee) return res.status(404).json({ error: "employee_not_found" });
    }

    let obligationId = null;
    if (obligationKey) {
      const obl = await prisma.complianceObligation.findFirst({ where: { tenantId, key: obligationKey } });
      obligationId = obl?.id || null;
    }

    const created = await prisma.complianceTask.create({
      data: {
        tenantId,
        label,
        category,
        employeeId,
        dueAt: dueAt ? new Date(dueAt) : null,
        notes,
        obligationId,
      },
    });
    res.status(201).json(created);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: "Failed to create task" });
  }
});

router.patch("/tasks/:id", requirePermissions(["all"], "anyOf"), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    const { status, evidenceUrl, notes } = req.body || {};
    if (status && !ALLOWED_STATUS.has(String(status).toUpperCase())) {
      return res.status(400).json({ error: "invalid_status" });
    }
    const existing = await prisma.complianceTask.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });
    const data = {
      ...(status ? { status: status.toUpperCase() } : {}),
      ...(evidenceUrl ? { evidenceUrl } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(status && status.toUpperCase() === "DONE" ? { completedAt: new Date() } : {}),
    };

    const updated = await prisma.complianceTask.update({
      where: { id },
      data,
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    });

    // Audit (optionnel)
    try {
      await prisma.auditEvent.create({
        data: {
          tenantId: updated.tenantId,
          actorId: req.auth?.sub || null,
          type: "COMPLIANCE_UPDATE",
          entity: "complianceTask",
          entityId: updated.id,
          payload: data,
          ip: req.ip,
          ua: req.get("user-agent"),
        },
      });
    } catch {}

    res.json(updated);
  } catch (e) {
    if (e.code === "P2025") return res.status(404).json({ error: "Not found" });
    console.error(e);
    res.status(400).json({ error: "Failed to update task" });
  }
});

router.post("/tasks/:id/evidence", requirePermissions(["all"], "anyOf"), upload.single("file"), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: "file missing" });
    const existing = await prisma.complianceTask.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });
    const url = `/uploads/${req.file.filename}`;

    const updated = await prisma.complianceTask.update({
      where: { id },
      data: { evidenceUrl: url, updatedAt: new Date() },
    });
    res.json(updated);
  } catch (e) {
    if (e instanceof multer.MulterError && e.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: "file_too_large",
        message: `Fichier trop volumineux. Taille max: ${MAX_UPLOAD_MB} Mo.`,
      });
    }
    if (e?.message === "unsupported_file_type") {
      return res.status(400).json({
        error: "unsupported_file_type",
        message: "Type de fichier non autorisé. Utilisez PDF, JPG, PNG ou WEBP.",
      });
    }
    if (e.code === "P2025") return res.status(404).json({ error: "Not found" });
    console.error(e);
    res.status(400).json({ error: "Upload failed" });
  }
});

/* =========================
 *   Catalogue & Checklists
 * ========================= */
router.get("/obligations", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });
    const items = await prisma.complianceObligation.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ key: "asc" }],
    });
    res.json({ items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch obligations" });
  }
});

router.post("/generate/onboarding", requirePermissions(["all"], "anyOf"), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });
    const { checklistCode = "ONB-SN-DEFAULT", employeeId, joinDate = null } = req.body || {};
    if (!employeeId) return res.status(400).json({ error: "employeeId required" });

    const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!emp) return res.status(404).json({ error: "employee_not_found" });

    const cl = await prisma.complianceChecklist.findFirst({
      where: { tenantId, code: checklistCode, isActive: true },
      include: { items: { orderBy: { orderNo: "asc" } } },
    });
    if (!cl) return res.status(404).json({ error: "checklist_not_found" });

    const baseDate = joinDate ? new Date(joinDate) : (emp.joinDate || new Date());
    const tasks = await prisma.$transaction(
      cl.items.map((it) =>
        prisma.complianceTask.create({
          data: {
            tenantId,
            employeeId: emp.id,
            label: it.label,
            category: it.category,
            dueAt: it.daysOffset != null ? new Date(baseDate.getTime() + it.daysOffset * 86400000) : null,
            status: "TODO",
          },
        })
      )
    );

    res.status(201).json({ created: tasks.length, tasks });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: "generate_failed" });
  }
});

/* =========================
 *         Export CSV
 * ========================= */
router.get("/tasks/export/csv", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });
    const items = await prisma.complianceTask.findMany({
      where: { tenantId },
      include: { employee: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: [{ dueAt: "asc" }],
    });
    const header = "Label;Catégorie;Employé;Email;Échéance;Statut;Preuve\n";
    const rows = items
      .map((t) =>
        [
          t.label,
          t.category,
          t.employee ? `${t.employee.firstName} ${t.employee.lastName}` : "",
          t.employee?.email || "",
          t.dueAt ? new Date(t.dueAt).toISOString() : "",
          t.status,
          t.evidenceUrl || "",
        ]
          .map((s) => (s ?? "").toString().replace(/;/g, ","))
          .join(";")
      )
      .join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=compliance_tasks.csv");
    res.send("\uFEFF" + header + rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "csv_failed" });
  }
});

export default router;

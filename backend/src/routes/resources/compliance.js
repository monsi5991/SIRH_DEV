// backend/src/routes/resources/compliance.js
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { prisma } from "../../prisma.js";

const router = express.Router();

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
const upload = multer({ storage });

/* =========================
 *          KPIs
 * ========================= */
router.get("/summary", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
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

    const total = await prisma.complianceTask.count({ where });
    res.json({ items, page: Number(page), pageSize: Number(pageSize), total });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

/* =========================
 *         WRITE
 * ========================= */
router.post("/tasks", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { label, category, employeeId = null, dueAt = null, notes = "", obligationKey = "" } = req.body || {};
    if (!label || !category) return res.status(400).json({ error: "label & category required" });

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

router.patch("/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, evidenceUrl, notes } = req.body || {};
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

router.post("/tasks/:id/evidence", upload.single("file"), async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: "file missing" });
    const url = `/uploads/${req.file.filename}`;

    const updated = await prisma.complianceTask.update({
      where: { id },
      data: { evidenceUrl: url, updatedAt: new Date() },
    });
    res.json(updated);
  } catch (e) {
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

router.post("/generate/onboarding", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
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

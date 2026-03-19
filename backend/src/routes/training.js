import express from "express";
import { prisma } from "../prisma.js";
import dayjs from "dayjs";
import { z } from "zod";
import { requirePermissions } from "../rbac.js";
import {
  buildEmployeeScopeWhere,
  getScopedEmployeeIds,
  resolveAccessContext,
} from "../lib/accessScope.js";

const router = express.Router();
const getTenantId = (req) =>
  req.auth?.tid || req.user?.tenantId || req.headers["x-tenant-id"];

router.use(requirePermissions(["team_read", "all"], "anyOf"));

/* ---------- Certifications expirant sous X jours ---------- */
router.get("/certifications/expiring", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ message: "Unauthorized" });
  const accessContext = await resolveAccessContext(req);
  const days = Math.max(1, parseInt(req.query.days || "30", 10));
  const until = dayjs().add(days, "day").toDate();

  const certs = await prisma.certification.findMany({
    where: {
      tenantId,
      ...buildEmployeeScopeWhere(accessContext, { field: "employeeId" }),
      expiresAt: { lte: until },
    },
    orderBy: { expiresAt: "asc" },
    include: {
      employee: {
        select: {
          id: true, firstName: true, lastName: true, site: true, department: true
        }
      },
    },
  });
  res.json(certs);
});

/* ---------- Schemas ---------- */
const CourseSchema = z.object({
  title: z.string().min(2),
  mandatory: z.boolean().optional().default(false),
});

const SessionSchema = z.object({
  courseId: z.string().min(1),
  startDate: z.string().min(1), // ISO
  endDate: z.string().min(1),   // ISO
  location: z.string().optional(),
  capacity: z.number().nullable().optional(),
});

const SessionUpdateSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  location: z.string().nullable().optional(),
  capacity: z.number().nullable().optional(),
  courseId: z.string().optional(), // si tu souhaites autoriser le changement de cours
});

const EnrollSchema = z.object({
  employeeIds: z.array(z.string().min(1)).min(1),
});

const DuplicateSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  location: z.string().optional(),
  capacity: z.number().optional(),
});

const AttendanceSchema = z.object({
  employeeIds: z.array(z.string().min(1)).min(1).optional(), // si non fourni, on marque tous
  status: z.enum(["present", "absent", "completed"]).default("present"),
});

/* ---------- Courses ---------- */
router.get("/courses", async (req, res) => {
  const tenantId = getTenantId(req);
  const courses = await prisma.course.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });
  res.json(courses);
});

router.post("/courses", requirePermissions(["all"], "anyOf"), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const p = CourseSchema.parse(req.body);
    const c = await prisma.course.create({
      data: { tenantId, title: p.title, mandatory: !!p.mandatory }
    });
    res.status(201).json(c);
  } catch (e) {
    res.status(400).json({ message: e?.message || "Invalid data" });
  }
});

/* ---------- Sessions ---------- */
// Liste
router.get("/sessions", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ message: "Unauthorized" });
  const accessContext = await resolveAccessContext(req);
  const scopedEmployeeIds = getScopedEmployeeIds(accessContext);
  const scopedEnrollmentFilter =
    scopedEmployeeIds === null
      ? {}
      : { employeeId: { in: scopedEmployeeIds.length ? scopedEmployeeIds : ["__none__"] } };

  const sessions = await prisma.session.findMany({
    where: {
      tenantId,
      ...(scopedEmployeeIds === null
        ? {}
        : { enrollments: { some: scopedEnrollmentFilter } }),
    },
    orderBy: { startDate: "desc" },
    include: {
      course: true,
      enrollments: {
        ...(scopedEmployeeIds === null ? {} : { where: scopedEnrollmentFilter }),
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, department: true, site: true }
          }
        }
      }
    }
  });
  res.json(sessions);
});

// Détail
router.get("/sessions/:id", async (req, res) => {
  const tenantId = getTenantId(req);
  if (!tenantId) return res.status(401).json({ message: "Unauthorized" });
  const accessContext = await resolveAccessContext(req);
  const scopedEmployeeIds = getScopedEmployeeIds(accessContext);
  const scopedEnrollmentFilter =
    scopedEmployeeIds === null
      ? {}
      : { employeeId: { in: scopedEmployeeIds.length ? scopedEmployeeIds : ["__none__"] } };
  const { id } = req.params;
  const s = await prisma.session.findFirst({
    where: {
      id,
      tenantId,
      ...(scopedEmployeeIds === null
        ? {}
        : { enrollments: { some: scopedEnrollmentFilter } }),
    },
    include: {
      course: true,
      enrollments: {
        ...(scopedEmployeeIds === null ? {} : { where: scopedEnrollmentFilter }),
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, department: true, site: true }
          }
        }
      }
    }
  });
  if (!s) return res.status(404).json({ message: "Session not found" });
  res.json(s);
});

// Création
router.post("/sessions", requirePermissions(["all"], "anyOf"), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const p = SessionSchema.parse(req.body);
    const course = await prisma.course.findFirst({
      where: { id: p.courseId, tenantId },
      select: { id: true },
    });
    if (!course) return res.status(404).json({ message: "Course not found" });
    const s = await prisma.session.create({
      data: {
        tenantId,
        courseId: p.courseId,
        startDate: new Date(p.startDate),
        endDate: new Date(p.endDate),
        location: p.location || null,
        capacity: p.capacity ?? null,
      }
    });
    res.status(201).json(s);
  } catch (e) {
    res.status(400).json({ message: e?.message || "Invalid data" });
  }
});

// ✅ Mise à jour
router.put("/sessions/:id", requirePermissions(["all"], "anyOf"), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const p = SessionUpdateSchema.parse(req.body || {});
    const existing = await prisma.session.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ message: "Session not found" });

    if (p.courseId) {
      const course = await prisma.course.findFirst({
        where: { id: p.courseId, tenantId },
        select: { id: true },
      });
      if (!course) return res.status(404).json({ message: "Course not found" });
    }

    const payload = {
      ...(p.startDate ? { startDate: new Date(p.startDate) } : {}),
      ...(p.endDate ? { endDate: new Date(p.endDate) } : {}),
      ...(p.location !== undefined ? { location: p.location } : {}),
      ...(p.capacity !== undefined ? { capacity: p.capacity } : {}),
      ...(p.courseId ? { courseId: p.courseId } : {})
    };
    const s = await prisma.session.update({
      where: { id },
      data: payload,
      include: {
        course: true,
        enrollments: {
          include: { employee: { select: { id: true, firstName: true, lastName: true, department: true, site: true } } }
        }
      }
    });
    res.json(s);
  } catch (e) {
    res.status(400).json({ message: e?.message || "Update failed" });
  }
});

// Inscription
router.post("/sessions/:id/enroll", requirePermissions(["all"], "anyOf"), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const p = EnrollSchema.parse(req.body);
    const session = await prisma.session.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!session) return res.status(404).json({ message: "Session not found" });

    const existingEmployees = await prisma.employee.findMany({
      where: { tenantId, id: { in: p.employeeIds } },
      select: { id: true },
    });
    if (existingEmployees.length !== p.employeeIds.length) {
      return res.status(400).json({ message: "Some employeeIds are invalid for this tenant" });
    }

    const data = p.employeeIds.map(empId => ({
      tenantId, employeeId: empId, sessionId: id, status: "enrolled"
    }));
    await prisma.enrollment.createMany({ data, skipDuplicates: true });

    const enrollments = await prisma.enrollment.findMany({
      where: { tenantId, sessionId: id },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } }
    });
    res.json({ ok: true, enrollments });
  } catch (e) {
    res.status(400).json({ message: e?.message || "Invalid data" });
  }
});

// ✅ Désinscrire (par employeeId)
router.delete("/sessions/:id/enroll/:employeeId", requirePermissions(["all"], "anyOf"), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { id, employeeId } = req.params;

    await prisma.enrollment.deleteMany({
      where: { tenantId, sessionId: id, employeeId }
    });

    const enrollments = await prisma.enrollment.findMany({
      where: { tenantId, sessionId: id },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } }
    });

    res.json({ ok: true, enrollments });
  } catch (e) {
    res.status(400).json({ message: e?.message || "Unenroll failed" });
  }
});

// Dupliquer une session
router.post("/sessions/:id/duplicate", requirePermissions(["all"], "anyOf"), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const p = DuplicateSchema.parse(req.body || {});
    const orig = await prisma.session.findFirst({ where: { id, tenantId } });
    if (!orig) return res.status(404).json({ message: "Session not found" });

    const startDate = p.startDate ? new Date(p.startDate) : dayjs(orig.startDate).add(7, "day").toDate();
    const endDate = p.endDate ? new Date(p.endDate) : dayjs(orig.endDate).add(7, "day").toDate();

    const s = await prisma.session.create({
      data: {
        tenantId,
        courseId: orig.courseId,
        startDate,
        endDate,
        location: p.location ?? orig.location,
        capacity: p.capacity ?? orig.capacity,
      }
    });
    res.status(201).json(s);
  } catch (e) {
    res.status(400).json({ message: e?.message || "Invalid data" });
  }
});

// Annuler une session (supprime inscriptions + session)
router.post("/sessions/:id/cancel", requirePermissions(["all"], "anyOf"), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const exists = await prisma.session.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!exists) return res.status(404).json({ message: "Session not found" });

    await prisma.$transaction([
      prisma.enrollment.deleteMany({ where: { sessionId: id, tenantId } }),
      prisma.session.delete({ where: { id } }),
    ]);

    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ message: e?.message || "Cancel failed" });
  }
});

// Marquer la présence
router.post("/sessions/:id/attendance", requirePermissions(["all"], "anyOf"), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const p = AttendanceSchema.parse(req.body || {});
    const session = await prisma.session.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!session) return res.status(404).json({ message: "Session not found" });

    let employeeIds = p.employeeIds;
    if (!employeeIds) {
      const all = await prisma.enrollment.findMany({
        where: { tenantId, sessionId: id },
        select: { employeeId: true }
      });
      employeeIds = all.map(e => e.employeeId);
    }

    for (const empId of employeeIds) {
      await prisma.enrollment.updateMany({
        where: { tenantId, sessionId: id, employeeId: empId },
        data: { status: p.status },
      });
    }

    const enrollments = await prisma.enrollment.findMany({
      where: { tenantId, sessionId: id },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.json({ ok: true, enrollments });
  } catch (e) {
    res.status(400).json({ message: e?.message || "Attendance failed" });
  }
});

export default router;

// backend/src/routes/people/employees.js
import express from "express";
import { prisma } from "../../prisma.js";
import { requirePermissions } from "../../rbac.js";

const router = express.Router();

// Toutes ces routes nécessitent un accès + lecture annuaire (comme ton code de base)
router.use(requirePermissions(["directory_read", "all"], "anyOf"));

/**
 * GET /people/employees
 * ?q= (recherche) | ?status=ACTIVE/INACTIVE
 */
router.get("/", async (req, res) => {
  try {
    const tid = req.auth.tid;
    const { q, status } = req.query;

    const where = { tenantId: tid };
    if (status) where.status = String(status);

    if (q) {
      const query = String(q);
      where.OR = [
        { firstName:  { contains: query, mode: "insensitive" } },
        { lastName:   { contains: query, mode: "insensitive" } },
        { email:      { contains: query, mode: "insensitive" } },
        { department: { contains: query, mode: "insensitive" } },
      ];
    }

    const employees = await prisma.employee.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        position: true,
        department: true,
        site: true,
        status: true,
        baseSalary: true,
        userId: true,
        contractType: true,
        joinDate: true,
      },
      take: 500,
    });

    res.json({ employees });
  } catch (e) {
    res.status(500).json({ error: "employees_list_failed", detail: e.message });
  }
});

/**
 * GET /people/employees/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const tid = req.auth.tid;
    const { id } = req.params;

    const emp = await prisma.employee.findFirst({
      where: { id, tenantId: tid },
    });
    if (!emp) return res.status(404).json({ error: "employee_not_found" });

    res.json({ employee: emp });
  } catch (e) {
    res.status(500).json({ error: "employee_get_failed", detail: e.message });
  }
});

/**
 * PATCH /people/employees/:id
 * Body (facultatif): { baseSalary?: number, position?, department?, site?, status? }
 * Nécessite des droits d’écriture RH/admin
 */
router.patch(
  "/:id", // ✅ correction du chemin (au lieu de "//:id")
  requirePermissions(["all"], "anyOf"),
  async (req, res) => {
    try {
      const tid = req.auth.tid;
      const { id } = req.params;

      // Sécurise le périmètre tenant
      const exists = await prisma.employee.findFirst({
        where: { id, tenantId: tid },
        select: { id: true },
      });
      if (!exists) return res.status(404).json({ error: "employee_not_found" });

      const { baseSalary, position, department, site, status } = req.body || {};

      // On construit un patch minimal, sans jamais toucher aux champs sensibles (tenantId, userId, email, etc.)
      const data = {};

      if (baseSalary !== undefined && baseSalary !== null) {
        const n = Number(baseSalary);
        if (!Number.isFinite(n) || n < 0) {
          return res.status(400).json({ error: "invalid_baseSalary" });
        }
        // arrondi entier (cohérent avec ton code de base)
        data.baseSalary = Math.round(n);
      }
      if (position !== undefined)   data.position = position || null;
      if (department !== undefined) data.department = department || null;
      if (site !== undefined)       data.site = site || null;
      if (status !== undefined)     data.status = status;

      // Si aucune clé autorisée n'est présente, on renvoie le record sans modifier
      if (Object.keys(data).length === 0) {
        const current = await prisma.employee.findFirst({ where: { id, tenantId: tid } });
        return res.json({ employee: current });
      }

      const updated = await prisma.employee.update({
        where: { id },
        data,
      });

      res.json({ employee: updated });
    } catch (e) {
      res.status(500).json({ error: "employee_update_failed", detail: e.message });
    }
  }
);

export default router;

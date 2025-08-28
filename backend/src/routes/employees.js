// backend/src/routes/employees.js
import express from "express";
import { prisma } from "../prisma.js";

const router = express.Router();

// Liste des employés
router.get("/", async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      where: { tenantId: req.auth?.tid },
      orderBy: { lastName: "asc" },
    });
    res.json(employees);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "list_failed" });
  }
});

// Récupérer un employé par ID
router.get("/:id", async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!employee) return res.status(404).json({ error: "not_found" });
    res.json(employee);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "get_failed" });
  }
});

// Mise à jour d’un employé (inclut baseSalary)
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { baseSalary, ...rest } = req.body;

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        ...rest,
        baseSalary: baseSalary !== undefined ? Number(baseSalary) : undefined,
      },
    });

    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "update_failed" });
  }
});

export default router;

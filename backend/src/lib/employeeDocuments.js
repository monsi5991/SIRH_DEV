import path from "node:path";
import { prisma } from "../prisma.js";

function toDateOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function createHttpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code || null;
  return err;
}

async function ensureEmployeeExists(tenantId, employeeId) {
  if (!employeeId) throw createHttpError(400, "employeeId is required", "employee_id_required");

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, tenantId },
    select: { id: true },
  });
  if (!employee) throw createHttpError(404, "Employé introuvable", "employee_not_found");
  return employee;
}

export async function createEmployeeDocument({
  tenantId,
  employeeId,
  file,
  label,
  type,
  expiresAt,
}) {
  if (!tenantId) throw createHttpError(401, "Unauthorized", "unauthorized");
  if (!file) throw createHttpError(400, "Fichier manquant", "file_missing");
  await ensureEmployeeExists(tenantId, employeeId);

  return prisma.document.create({
    data: {
      tenantId,
      employeeId,
      label: label || file.originalname || "Document",
      type: type || null,
      url: `/uploads/${path.basename(file.filename || "")}`,
      expiresAt: toDateOrNull(expiresAt),
    },
  });
}

export async function createGeneratedEmployeeDocument({
  tenantId,
  employeeId,
  label,
  type,
  url,
  expiresAt,
}) {
  if (!tenantId) throw createHttpError(401, "Unauthorized", "unauthorized");
  if (!url) throw createHttpError(400, "URL document manquante", "document_url_required");
  await ensureEmployeeExists(tenantId, employeeId);

  return prisma.document.create({
    data: {
      tenantId,
      employeeId,
      label: label || "Document généré",
      type: type || null,
      url,
      expiresAt: toDateOrNull(expiresAt),
    },
  });
}

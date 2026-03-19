import express from "express";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { requirePermissions } from "../rbac.js";
import { logAuditEvent } from "../lib/audit.js";

const router = express.Router();

const PERSONAL_SCHEMA = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().max(40).optional().nullable(),
  country: z.string().trim().max(8).optional().nullable(),
  birthDate: z.string().trim().max(40).optional().nullable(),
  nationality: z.string().trim().max(80).optional().nullable(),
  familyStatus: z.string().trim().max(80).optional().nullable(),
  dependants: z.union([z.number().int().min(0).max(20), z.string().trim().max(4)]).optional().nullable(),
  addressPersonal: z.string().trim().max(240).optional().nullable(),
});

const PROFESSIONAL_SCHEMA = z.object({
  phoneWhatsApp: z.string().trim().max(40).optional().nullable(),
  addressWork: z.string().trim().max(240).optional().nullable(),
});

const PAYMENT_SCHEMA = z.object({
  bankName: z.string().trim().max(120).optional().nullable(),
  bankIban: z.string().trim().max(120).optional().nullable(),
  bankAccount: z.string().trim().max(120).optional().nullable(),
  mobileMoneyProvider: z.string().trim().max(80).optional().nullable(),
  mobileMoneyNumber: z.string().trim().max(40).optional().nullable(),
});

const EMERGENCY_SCHEMA = z.object({
  emergencyName: z.string().trim().max(120).optional().nullable(),
  emergencyPhone: z.string().trim().max(40).optional().nullable(),
  emergencyRelation: z.string().trim().max(80).optional().nullable(),
});

const PATCH_SCHEMA = z.object({
  section: z.enum(["personal", "professional", "payment", "emergency"]),
  values: z.record(z.any()).default({}),
});

function getTenantId(req) {
  return req.auth?.tid || req.user?.tenantId || null;
}

function toNullableString(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function toNullableCount(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const count = Number(value);
  return Number.isFinite(count) ? count : null;
}

function safeProfileExtras(employee) {
  const benefits =
    employee?.benefits && typeof employee.benefits === "object" && !Array.isArray(employee.benefits)
      ? employee.benefits
      : {};
  const profile =
    benefits.selfServiceProfile &&
    typeof benefits.selfServiceProfile === "object" &&
    !Array.isArray(benefits.selfServiceProfile)
      ? benefits.selfServiceProfile
      : {};
  return { benefits, profile };
}

function managerName(employee) {
  const name = `${employee?.manager?.firstName || ""} ${employee?.manager?.lastName || ""}`.trim();
  return name || null;
}

function buildCompletionMeta(employee, profile) {
  const checks = [
    { label: "Téléphone", value: employee.phone },
    { label: "Pays", value: employee.country },
    { label: "Date de naissance", value: profile.birthDate },
    { label: "Adresse personnelle", value: profile.addressPersonal },
    { label: "WhatsApp professionnel", value: employee.phoneWhatsApp },
    { label: "Banque", value: employee.bankName || employee.bankIban || employee.bankAccount },
    { label: "Contact d'urgence", value: profile.emergencyName && profile.emergencyPhone ? "ok" : null },
    { label: "CNSS", value: employee.cnss },
    { label: "IPRES", value: employee.ipres },
  ];

  const completed = checks.filter((item) => item.value).length;
  return {
    completionPercent: Math.round((completed / checks.length) * 100),
    missingFields: checks.filter((item) => !item.value).map((item) => item.label),
  };
}

function serializeProfile(employee) {
  const { profile } = safeProfileExtras(employee);
  const completion = buildCompletionMeta(employee, profile);

  return {
    profile: {
      personal: {
        firstName: employee.firstName || "",
        lastName: employee.lastName || "",
        email: employee.email || "",
        phone: employee.phone || "",
        country: employee.country || "",
        birthDate: profile.birthDate || "",
        nationality: profile.nationality || "",
        familyStatus: profile.familyStatus || "",
        dependants: profile.dependants ?? "",
        addressPersonal: profile.addressPersonal || "",
      },
      professional: {
        email: employee.email || "",
        phoneWhatsApp: employee.phoneWhatsApp || "",
        department: employee.department || "",
        site: employee.site || "",
        position: employee.position || "",
        managerName: managerName(employee) || "",
        addressWork: profile.addressWork || "",
      },
      employment: {
        status: employee.status || "",
        joinDate: employee.joinDate || null,
        endDate: employee.endDate || null,
        contractType: employee.contractType || "",
        internalMatricule: employee.internalMatricule || "",
      },
      payment: {
        bankName: employee.bankName || "",
        bankIban: employee.bankIban || "",
        bankAccount: employee.bankAccount || "",
        mobileMoneyProvider: profile.mobileMoneyProvider || "",
        mobileMoneyNumber: profile.mobileMoneyNumber || "",
      },
      emergency: {
        emergencyName: profile.emergencyName || "",
        emergencyPhone: profile.emergencyPhone || "",
        emergencyRelation: profile.emergencyRelation || "",
      },
      administrative: {
        cnss: employee.cnss || "",
        ipres: employee.ipres || "",
        documents: (employee.documents || []).map((document) => ({
          id: document.id,
          label: document.label,
          type: document.type || "DOCUMENT",
          url: document.url,
          expiresAt: document.expiresAt,
          createdAt: document.createdAt,
        })),
      },
    },
    meta: {
      employeeId: employee.id,
      lastUpdatedAt: employee.updatedAt,
      ...completion,
      editableSections: {
        personal: true,
        professional: true,
        employment: false,
        payment: true,
        emergency: true,
        administrative: false,
      },
    },
  };
}

async function resolveViewerEmployee(req) {
  const tenantId = getTenantId(req);
  const userId = req.auth?.sub;
  if (!tenantId || !userId) return null;

  return prisma.employee.findFirst({
    where: { tenantId, userId },
    include: {
      manager: {
        select: { id: true, firstName: true, lastName: true },
      },
      documents: {
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          label: true,
          type: true,
          url: true,
          expiresAt: true,
          createdAt: true,
        },
      },
    },
  });
}

router.get("/profile", requirePermissions(["self_read", "all"], "anyOf"), async (req, res) => {
  try {
    const employee = await resolveViewerEmployee(req);
    if (!employee) return res.status(404).json({ error: "employee_not_found" });
    return res.json(serializeProfile(employee));
  } catch (e) {
    console.error("[me/profile:get] error:", e);
    return res.status(500).json({ error: "me_profile_get_failed" });
  }
});

router.get("/documents", requirePermissions(["self_read", "all"], "anyOf"), async (req, res) => {
  try {
    const employee = await resolveViewerEmployee(req);
    if (!employee) return res.status(404).json({ error: "employee_not_found" });

    const tenantId = getTenantId(req);
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize || 24)));
    const skip = (page - 1) * pageSize;
    const type = String(req.query.type || "").trim();
    const year = Number(req.query.year);
    const q = String(req.query.q || "").trim();

    const where = {
      tenantId,
      employeeId: employee.id,
      ...(type ? { type } : {}),
      ...(q ? { label: { contains: q, mode: "insensitive" } } : {}),
      ...(Number.isFinite(year)
        ? {
            createdAt: {
              gte: new Date(Date.UTC(year, 0, 1)),
              lt: new Date(Date.UTC(year + 1, 0, 1)),
            },
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.document.count({ where }),
      prisma.document.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          label: true,
          type: true,
          url: true,
          expiresAt: true,
          createdAt: true,
        },
      }),
    ]);

    return res.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (e) {
    console.error("[me/documents:get] error:", e);
    return res.status(500).json({ error: "me_documents_get_failed" });
  }
});

router.patch("/profile", requirePermissions(["self_write", "self_update", "all"], "anyOf"), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const actorId = req.auth?.sub || null;
    const employee = await resolveViewerEmployee(req);
    if (!tenantId || !actorId || !employee) return res.status(404).json({ error: "employee_not_found" });

    const parsed = PATCH_SCHEMA.parse(req.body || {});
    const { section, values } = parsed;
    const { benefits, profile } = safeProfileExtras(employee);

    const employeeData = {};
    const userData = {};
    const nextProfile = { ...profile };

    if (section === "personal") {
      const payload = PERSONAL_SCHEMA.parse(values);
      if (payload.firstName !== undefined) {
        employeeData.firstName = payload.firstName;
        userData.firstName = payload.firstName;
      }
      if (payload.lastName !== undefined) {
        employeeData.lastName = payload.lastName;
        userData.lastName = payload.lastName;
      }
      if (payload.phone !== undefined) employeeData.phone = toNullableString(payload.phone);
      if (payload.country !== undefined) employeeData.country = toNullableString(payload.country) || "SN";
      if (payload.birthDate !== undefined) nextProfile.birthDate = toNullableString(payload.birthDate);
      if (payload.nationality !== undefined) nextProfile.nationality = toNullableString(payload.nationality);
      if (payload.familyStatus !== undefined) nextProfile.familyStatus = toNullableString(payload.familyStatus);
      if (payload.dependants !== undefined) nextProfile.dependants = toNullableCount(payload.dependants);
      if (payload.addressPersonal !== undefined) nextProfile.addressPersonal = toNullableString(payload.addressPersonal);
    }

    if (section === "professional") {
      const payload = PROFESSIONAL_SCHEMA.parse(values);
      if (payload.phoneWhatsApp !== undefined) employeeData.phoneWhatsApp = toNullableString(payload.phoneWhatsApp);
      if (payload.addressWork !== undefined) nextProfile.addressWork = toNullableString(payload.addressWork);
    }

    if (section === "payment") {
      const payload = PAYMENT_SCHEMA.parse(values);
      if (payload.bankName !== undefined) employeeData.bankName = toNullableString(payload.bankName);
      if (payload.bankIban !== undefined) employeeData.bankIban = toNullableString(payload.bankIban);
      if (payload.bankAccount !== undefined) employeeData.bankAccount = toNullableString(payload.bankAccount);
      if (payload.mobileMoneyProvider !== undefined) nextProfile.mobileMoneyProvider = toNullableString(payload.mobileMoneyProvider);
      if (payload.mobileMoneyNumber !== undefined) nextProfile.mobileMoneyNumber = toNullableString(payload.mobileMoneyNumber);
    }

    if (section === "emergency") {
      const payload = EMERGENCY_SCHEMA.parse(values);
      if (payload.emergencyName !== undefined) nextProfile.emergencyName = toNullableString(payload.emergencyName);
      if (payload.emergencyPhone !== undefined) nextProfile.emergencyPhone = toNullableString(payload.emergencyPhone);
      if (payload.emergencyRelation !== undefined) nextProfile.emergencyRelation = toNullableString(payload.emergencyRelation);
    }

    employeeData.benefits = {
      ...benefits,
      selfServiceProfile: nextProfile,
    };

    await prisma.$transaction(async (tx) => {
      if (Object.keys(userData).length && employee.userId) {
        await tx.user.update({
          where: { id: employee.userId },
          data: userData,
        });
      }

      await tx.employee.update({
        where: { id: employee.id },
        data: employeeData,
      });
    });

    await logAuditEvent({
      tenantId,
      actorId,
      type: "EMPLOYEE_SELF_PROFILE_UPDATE",
      entity: "employee",
      entityId: employee.id,
      payload: {
        section,
        changedFields: Object.keys(values || {}),
      },
      ip: req.ip,
      ua: req.get("user-agent"),
    });

    const refreshed = await resolveViewerEmployee(req);
    return res.json(serializeProfile(refreshed));
  } catch (e) {
    if (e?.name === "ZodError") {
      return res.status(400).json({
        error: "invalid_profile_payload",
        issues: e.issues,
      });
    }
    console.error("[me/profile:patch] error:", e);
    return res.status(500).json({ error: "me_profile_patch_failed" });
  }
});

export default router;

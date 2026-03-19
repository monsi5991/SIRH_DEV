import express from "express";
import fs from "node:fs";
import path from "node:path";

import { prisma } from "../prisma.js";
import {
  buildEmployeeScopeWhere,
  canAccessEmployeeId,
  resolveAccessContext,
} from "../lib/accessScope.js";

const router = express.Router();
const uploadsRoot = path.resolve("uploads");

function normalizeRequestedPath(raw = "") {
  const clean = String(raw || "").replace(/^\/+/, "");
  const normalized = path.normalize(clean);
  if (!normalized || normalized === "." || normalized.includes("..")) return null;
  return normalized;
}

function resolveAbsoluteFilePath(relativePath) {
  const absolutePath = path.resolve(uploadsRoot, relativePath);
  const rootWithSep = `${uploadsRoot}${path.sep}`;
  if (absolutePath !== uploadsRoot && !absolutePath.startsWith(rootWithSep)) {
    return null;
  }
  return absolutePath;
}

async function canReadUpload(req, relativePath) {
  const tenantId = req.auth?.tid;
  if (!tenantId) return false;

  const uploadUrl = `/uploads/${relativePath.replace(/\\/g, "/")}`;
  const accessContext = await resolveAccessContext(req);

  const linkedDocument = await prisma.document.findFirst({
    where: { tenantId, url: uploadUrl },
    select: { id: true, employeeId: true },
  });

  if (linkedDocument) {
    if (accessContext.scope === "COMPANY") return true;
    if (!linkedDocument.employeeId) return false;
    return canAccessEmployeeId(accessContext, linkedDocument.employeeId);
  }

  const linkedEvidence = await prisma.complianceTask.findFirst({
    where: { tenantId, evidenceUrl: uploadUrl },
    select: { id: true },
  });

  if (linkedEvidence) {
    return accessContext.scope === "COMPANY";
  }

  const hrRequestWhere = {
    tenantId,
    ...(accessContext.scope === "COMPANY"
      ? {}
      : accessContext.scope === "SELF"
      ? {
          OR: [
            { requesterUserId: req.auth?.sub || null },
            ...(accessContext.viewerEmployee?.id ? [{ employeeId: accessContext.viewerEmployee.id }] : []),
          ],
        }
      : {
          ...buildEmployeeScopeWhere(accessContext, { field: "employeeId" }),
        }),
  };

  const hrRequests = await prisma.hrRequest.findMany({
    where: hrRequestWhere,
    select: {
      employeeId: true,
      payload: true,
    },
  });

  const linkedHrRequest = hrRequests.find((request) =>
    Array.isArray(request?.payload?.attachments) &&
    request.payload.attachments.some((attachment) => attachment?.url === uploadUrl)
  );

  if (linkedHrRequest) {
    if (accessContext.scope === "COMPANY") return true;
    if (!linkedHrRequest.employeeId) return false;
    return canAccessEmployeeId(accessContext, linkedHrRequest.employeeId);
  }

  return false;
}

router.get("/*", async (req, res) => {
  try {
    const relativePath = normalizeRequestedPath(req.params[0]);
    if (!relativePath) return res.status(400).json({ error: "invalid_file_path" });

    const absolutePath = resolveAbsoluteFilePath(relativePath);
    if (!absolutePath) return res.status(400).json({ error: "invalid_file_path" });

    const allowed = await canReadUpload(req, relativePath);
    if (!allowed) return res.status(403).json({ error: "Forbidden" });

    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      return res.status(404).json({ error: "file_not_found" });
    }

    return res.sendFile(absolutePath, {
      headers: {
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("[secureUploads] error:", error);
    return res.status(500).json({ error: "failed_to_serve_upload" });
  }
});

export default router;

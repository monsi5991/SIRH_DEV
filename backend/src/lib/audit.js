import { prisma } from "../prisma.js";

export async function logAuditEvent({
  tenantId,
  actorId = null,
  type,
  entity,
  entityId,
  payload = null,
  ip = null,
  ua = null,
}) {
  if (!tenantId || !type || !entity || !entityId) return;

  try {
    await prisma.auditEvent.create({
      data: {
        tenantId,
        actorId,
        type,
        entity,
        entityId: String(entityId),
        payload: payload ?? {},
        ip: ip || null,
        ua: ua || null,
      },
    });
  } catch (e) {
    console.warn("[audit] failed:", e?.message || e);
  }
}

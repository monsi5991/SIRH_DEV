import fs from "node:fs";
import path from "node:path";

import { prisma } from "../prisma.js";
import { sendUserNotification } from "./notifications.js";
import { createGeneratedEmployeeDocument } from "./employeeDocuments.js";

const generatedDir = path.resolve("uploads/generated");
if (!fs.existsSync(generatedDir)) fs.mkdirSync(generatedDir, { recursive: true });

const CRITICAL_WORKFLOW_TASK_KEYS = new Set([
  "contract-signed",
  "cnss",
  "ipres",
  "position-setup",
  "it-access",
  "work-certificate",
  "final-pay",
  "equipment-return",
  "it-removal",
]);

function unique(items = []) {
  return Array.from(new Set((items || []).filter(Boolean)));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asString(value) {
  return value == null ? "" : String(value).trim();
}

function slugify(value) {
  return asString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function formatDate(value) {
  if (!value) return "Non renseignee";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Non renseignee";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function humanWorkflowLabel(workflowType) {
  return String(workflowType || "").toUpperCase() === "OFFBOARDING" ? "Depart" : "Onboarding";
}

function normalizeAssignee(value) {
  return asString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function taskStatusLabel(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "DONE") return "terminee";
  if (normalized === "IN_PROGRESS") return "en cours";
  return "en attente";
}

function assigneeAudienceLabel(value) {
  const normalized = normalizeAssignee(value);
  if (normalized.includes("manager")) return "manager";
  if (normalized.includes("it") || normalized.includes("dsi")) return "IT";
  if (normalized.includes("paie") || normalized.includes("payroll") || normalized.includes("finance")) return "paie";
  if (
    normalized.includes("salarie") ||
    normalized.includes("employe") ||
    normalized.includes("employee") ||
    normalized.includes("collaborateur")
  ) {
    return "salarie";
  }
  return "RH";
}

async function listRoleUserIds(tenantId, roleNames = []) {
  const names = unique(asArray(roleNames).map((value) => asString(value)).filter(Boolean));
  if (!tenantId || !names.length) return [];

  const rows = await prisma.userRole.findMany({
    where: {
      role: {
        tenantId,
        name: { in: names },
      },
    },
    select: { userId: true },
  });

  return unique(rows.map((row) => row.userId));
}

async function notifyUsers({
  tenantId,
  userIds = [],
  actorId = null,
  type,
  title,
  body,
  data = {},
  channels = ["IN_APP"],
}) {
  const recipients = unique(userIds);
  if (!tenantId || !recipients.length || !type || !title || !body) return 0;

  const results = await Promise.allSettled(
    recipients.map((userId) =>
      sendUserNotification({
        tenantId,
        userId,
        actorId,
        type,
        title,
        body,
        data,
        channels,
      })
    )
  );

  return results.filter((result) => result.status === "fulfilled" && Array.isArray(result.value) && result.value.length).length;
}

function isCriticalWorkflowTask(task) {
  return CRITICAL_WORKFLOW_TASK_KEYS.has(asString(task?.key || task?.id));
}

function channelsForTasks(tasks = []) {
  return tasks.some((task) => isCriticalWorkflowTask(task))
    ? ["IN_APP", "EMAIL", "WHATSAPP"]
    : ["IN_APP"];
}

export async function resolveWorkflowStakeholders({ tenantId, employeeRecord }) {
  const [hrUserIds, itUserIds, payrollUserIds] = await Promise.all([
    listRoleUserIds(tenantId, ["RH", "HR"]),
    listRoleUserIds(tenantId, ["IT", "DSI", "SUPPORT_IT", "IT_SUPPORT"]),
    listRoleUserIds(tenantId, ["PAIE", "PAYROLL", "FINANCE"]),
  ]);

  return {
    employeeUserId: employeeRecord?.userId || null,
    managerUserId: employeeRecord?.manager?.userId || null,
    hrUserIds,
    itUserIds,
    payrollUserIds,
  };
}

function resolveAssigneeUserIds(assignedTo, stakeholders) {
  const normalized = normalizeAssignee(assignedTo);

  if (normalized.includes("manager")) {
    return unique([stakeholders?.managerUserId, ...asArray(stakeholders?.hrUserIds)]);
  }
  if (normalized.includes("it") || normalized.includes("dsi")) {
    return unique([...(stakeholders?.itUserIds || []), ...(stakeholders?.hrUserIds || [])]);
  }
  if (normalized.includes("paie") || normalized.includes("payroll") || normalized.includes("finance")) {
    return unique([...(stakeholders?.payrollUserIds || []), ...(stakeholders?.hrUserIds || [])]);
  }
  if (
    normalized.includes("salarie") ||
    normalized.includes("employe") ||
    normalized.includes("employee") ||
    normalized.includes("collaborateur")
  ) {
    return unique([stakeholders?.employeeUserId, ...(stakeholders?.hrUserIds || [])]);
  }
  return unique(stakeholders?.hrUserIds || []);
}

export async function notifyWorkflowCreated({
  tenantId,
  actorId = null,
  workflowType,
  workflowId,
  employeeId = null,
  employeeName,
  checklist = [],
  stakeholders,
}) {
  const workflowLabel = humanWorkflowLabel(workflowType);
  const tasksByAudience = new Map();

  for (const task of asArray(checklist)) {
    const audience = assigneeAudienceLabel(task?.assignedTo);
    const bucket = tasksByAudience.get(audience) || [];
    bucket.push(task);
    tasksByAudience.set(audience, bucket);
  }

  const payloads = Array.from(tasksByAudience.entries()).map(([audience, tasks]) => ({
    audience,
    tasks,
    userIds: resolveAssigneeUserIds(tasks[0]?.assignedTo, stakeholders),
  }));

  let sent = 0;
  for (const payload of payloads) {
    if (!payload.userIds.length) continue;
    sent += await notifyUsers({
      tenantId,
      userIds: payload.userIds,
      actorId,
      type: `${String(workflowType || "WORKFLOW").toUpperCase()}_TASKS_ASSIGNED`,
      title: `${workflowLabel} lance · ${employeeName}`,
      body: `${payload.tasks.length} tache(s) ${payload.audience} sont a traiter pour ${employeeName}.`,
      data: {
        workflowType,
        workflowId,
        employeeId,
        audience: payload.audience,
      },
      channels: channelsForTasks(payload.tasks),
    });
  }

  return sent;
}

export async function notifyWorkflowTaskUpdated({
  tenantId,
  actorId = null,
  workflowType,
  workflowId,
  employeeId = null,
  employeeName,
  previousTask,
  nextTask,
  stakeholders,
}) {
  if (!nextTask) return 0;

  const statusChanged = previousTask?.status !== nextTask.status;
  const assigneeChanged = asString(previousTask?.assignedTo) !== asString(nextTask.assignedTo);
  const dueDateChanged = asString(previousTask?.dueDate) !== asString(nextTask.dueDate);
  if (!statusChanged && !assigneeChanged && !dueDateChanged) return 0;

  const workflowLabel = humanWorkflowLabel(workflowType);
  const recipients = resolveAssigneeUserIds(nextTask.assignedTo, stakeholders);
  if (!recipients.length) return 0;

  let body = `${nextTask.task} est maintenant ${taskStatusLabel(nextTask.status)}.`;
  if (assigneeChanged) {
    body = `${nextTask.task} a ete reaffectee a ${nextTask.assignedTo || "un responsable"}.`;
  } else if (dueDateChanged) {
    body = `${nextTask.task} a une nouvelle echeance au ${formatDate(nextTask.dueDate)}.`;
  }

  return notifyUsers({
    tenantId,
    userIds: recipients,
    actorId,
    type: `${String(workflowType || "WORKFLOW").toUpperCase()}_TASK_UPDATED`,
    title: `Tache ${workflowLabel.toLowerCase()} · ${employeeName}`,
    body,
    data: {
      workflowType,
      workflowId,
      employeeId,
      taskId: nextTask.id,
    },
    channels: channelsForTasks([nextTask]),
  });
}

export async function notifyWorkflowCompleted({
  tenantId,
  actorId = null,
  workflowType,
  workflowId,
  employeeId = null,
  employeeName,
  stakeholders,
}) {
  const workflowLabel = humanWorkflowLabel(workflowType);
  const recipients = unique([
    stakeholders?.managerUserId,
    ...(stakeholders?.hrUserIds || []),
    ...(stakeholders?.itUserIds || []),
    ...(stakeholders?.payrollUserIds || []),
  ]);

  return notifyUsers({
    tenantId,
    userIds: recipients,
    actorId,
    type: `${String(workflowType || "WORKFLOW").toUpperCase()}_COMPLETED`,
    title: `${workflowLabel} termine · ${employeeName}`,
    body: `Toutes les taches du workflow sont completees pour ${employeeName}.`,
    data: {
      workflowType,
      workflowId,
      employeeId,
    },
  });
}

function buildHtmlDocument({ title, subtitle, sections = [] }) {
  const sectionMarkup = sections
    .map(
      (section) => `
        <section style="margin-top:20px;padding:18px;border:1px solid #dbe3ea;border-radius:16px;background:#ffffff;">
          <h2 style="margin:0 0 10px 0;font-size:16px;color:#0f172a;">${section.title}</h2>
          <div style="font-size:14px;line-height:1.6;color:#334155;">${section.body}</div>
        </section>
      `
    )
    .join("");

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:32px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <main style="max-width:860px;margin:0 auto;background:#ffffff;border-radius:24px;padding:32px;border:1px solid #dbe3ea;">
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border-bottom:1px solid #e2e8f0;padding-bottom:18px;">
        <div>
          <div style="display:inline-flex;padding:6px 12px;border-radius:999px;background:#ecfdf5;color:#047857;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">SIRH</div>
          <h1 style="margin:14px 0 6px 0;font-size:28px;line-height:1.15;">${title}</h1>
          <p style="margin:0;font-size:14px;color:#475569;">${subtitle}</p>
        </div>
        <div style="font-size:12px;color:#64748b;text-align:right;">
          Genere le ${formatDate(new Date().toISOString())}
        </div>
      </div>
      ${sectionMarkup}
    </main>
  </body>
</html>`;
}

function onboardingTemplateDefinition(templateKey, employeeName, workflowInfo = {}) {
  const startDate = formatDate(workflowInfo.startDate);
  const department = asString(workflowInfo.department) || "A confirmer";
  const site = asString(workflowInfo.site) || "A confirmer";
  const position = asString(workflowInfo.position) || "Poste a confirmer";
  const contractType = asString(workflowInfo.contractType) || "Contrat a confirmer";

  const definitions = {
    offer_fr: {
      label: "Lettre d'offre - Brouillon",
      type: "ONBOARDING_OFFER_LETTER",
      title: "Lettre d'offre",
      subtitle: `Proposition d'integration pour ${employeeName}`,
      sections: [
        {
          title: "Informations principales",
          body: `<strong>Collaborateur:</strong> ${employeeName}<br/><strong>Poste:</strong> ${position}<br/><strong>Departement:</strong> ${department}<br/><strong>Site:</strong> ${site}<br/><strong>Date de prise de poste:</strong> ${startDate}`,
        },
        {
          title: "Conditions a confirmer",
          body: `Ce document est genere automatiquement depuis le workflow d'onboarding. Les clauses de remuneration, de periode d'essai et les mentions legals sont a finaliser par les RH avant envoi.`,
        },
      ],
    },
    contract_cdi: {
      label: "Contrat CDI - Brouillon",
      type: "ONBOARDING_CONTRACT_CDI",
      title: "Projet de contrat CDI",
      subtitle: `Brouillon contractuel pour ${employeeName}`,
      sections: [
        {
          title: "Elements contractuels",
          body: `<strong>Type de contrat:</strong> CDI<br/><strong>Poste:</strong> ${position}<br/><strong>Site:</strong> ${site}<br/><strong>Date de debut:</strong> ${startDate}`,
        },
        {
          title: "Clauses a completer",
          body: `Salaire brut, horaires de reference, convention collective, periode d'essai et avantages. Les champs definitifs sont a valider avant signature.`,
        },
      ],
    },
    contract_cdd: {
      label: "Contrat CDD - Brouillon",
      type: "ONBOARDING_CONTRACT_CDD",
      title: "Projet de contrat CDD",
      subtitle: `Brouillon contractuel pour ${employeeName}`,
      sections: [
        {
          title: "Elements contractuels",
          body: `<strong>Type de contrat:</strong> CDD<br/><strong>Poste:</strong> ${position}<br/><strong>Site:</strong> ${site}<br/><strong>Date de debut:</strong> ${startDate}`,
        },
        {
          title: "Mentions obligatoires",
          body: `Motif du CDD, date de fin, renouvellements prevus et rappel du risque CDI en cas de succession longue. Ce brouillon doit etre relu avant edition finale.`,
        },
      ],
    },
    nda: {
      label: "Confidentialite (NDA) - Brouillon",
      type: "ONBOARDING_NDA",
      title: "Engagement de confidentialite",
      subtitle: `Document d'integration pour ${employeeName}`,
      sections: [
        {
          title: "Objet",
          body: `Le collaborateur ${employeeName} s'engage a proteger les informations confidentielles de l'entreprise dans le cadre de ses fonctions de ${position}.`,
        },
        {
          title: "Points a verifier",
          body: `Perimetre des informations sensibles, duree de confidentialite, supports concernes et sanctions applicables.`,
        },
      ],
    },
  };

  return definitions[templateKey] || null;
}

function offboardingTemplateDefinition(templateKey, employeeName, workflowInfo = {}) {
  const departureDate = formatDate(workflowInfo.departureDate);
  const exitType = asString(workflowInfo.exitType) || "Sortie a confirmer";
  const position = asString(workflowInfo.position) || "Poste non renseigne";
  const department = asString(workflowInfo.department) || "Departement non renseigne";

  const definitions = {
    resignation: {
      label: "Lettre de demission - Brouillon",
      type: "OFFBOARDING_RESIGNATION",
      title: "Projet de lettre de demission",
      subtitle: `Preparation du dossier de sortie de ${employeeName}`,
      sections: [
        {
          title: "Informations de base",
          body: `<strong>Collaborateur:</strong> ${employeeName}<br/><strong>Poste:</strong> ${position}<br/><strong>Date de depart:</strong> ${departureDate}`,
        },
        {
          title: "Points a completer",
          body: `Date de remise de la lettre, preavis applicable et validation manager/RH.`,
        },
      ],
    },
    termination: {
      label: "Lettre de rupture - Brouillon",
      type: "OFFBOARDING_TERMINATION",
      title: "Projet de lettre de rupture",
      subtitle: `Preparation du dossier de sortie de ${employeeName}`,
      sections: [
        {
          title: "Informations de base",
          body: `<strong>Collaborateur:</strong> ${employeeName}<br/><strong>Poste:</strong> ${position}<br/><strong>Motif de sortie:</strong> ${exitType}`,
        },
        {
          title: "Points a completer",
          body: `Motif juridique, date d'effet, convocations et validations internes.`,
        },
      ],
    },
    work_certificate: {
      label: "Certificat de travail - Brouillon",
      type: "OFFBOARDING_WORK_CERTIFICATE",
      title: "Certificat de travail",
      subtitle: `Document prepare automatiquement pour ${employeeName}`,
      sections: [
        {
          title: "Attestation",
          body: `Nous attestons que ${employeeName} a occupe les fonctions de ${position} au sein du departement ${department}. Date de sortie previsionnelle: ${departureDate}.`,
        },
        {
          title: "Verification RH",
          body: `Verifier les dates definitives, la fonction exacte et le cachet employeur avant remise au salarie.`,
        },
      ],
    },
    employment_att: {
      label: "Attestation d'emploi - Brouillon",
      type: "OFFBOARDING_EMPLOYMENT_CERTIFICATE",
      title: "Attestation d'emploi",
      subtitle: `Attestation preparee pour ${employeeName}`,
      sections: [
        {
          title: "Situation employee",
          body: `${employeeName} est rattache au poste ${position}. Le dossier de depart est en cours de traitement avec une date de sortie cible au ${departureDate}.`,
        },
        {
          title: "Usage",
          body: `Document genere depuis le workflow. A finaliser avant transmission a l'interesse ou a un organisme externe.`,
        },
      ],
    },
  };

  return definitions[templateKey] || null;
}

function workflowTemplateDefinition(workflowType, templateKey, employeeName, workflowInfo) {
  if (String(workflowType || "").toUpperCase() === "OFFBOARDING") {
    return offboardingTemplateDefinition(templateKey, employeeName, workflowInfo);
  }
  return onboardingTemplateDefinition(templateKey, employeeName, workflowInfo);
}

export async function ensureGeneratedWorkflowDocuments({
  tenantId,
  workflowType,
  workflowId,
  employeeId,
  employeeName,
  selectedTemplates = [],
  workflowInfo = {},
  existingGeneratedDocuments = [],
}) {
  if (!tenantId || !workflowId || !employeeId) return asArray(existingGeneratedDocuments);

  const existing = asArray(existingGeneratedDocuments);
  const existingKeys = new Set(existing.map((item) => asString(item?.key)).filter(Boolean));
  const nextDocuments = [...existing];

  for (const templateKey of unique(selectedTemplates.map((item) => asString(item)).filter(Boolean))) {
    if (existingKeys.has(templateKey)) continue;

    const definition = workflowTemplateDefinition(workflowType, templateKey, employeeName, workflowInfo);
    if (!definition) continue;

    const fileName = `${String(workflowType || "workflow").toLowerCase()}-${slugify(employeeName) || employeeId}-${workflowId}-${templateKey}.html`;
    const absolutePath = path.join(generatedDir, fileName);
    const url = `/uploads/generated/${fileName}`;
    const html = buildHtmlDocument({
      title: definition.title,
      subtitle: definition.subtitle,
      sections: definition.sections,
    });

    fs.writeFileSync(absolutePath, html, "utf8");

    const document = await createGeneratedEmployeeDocument({
      tenantId,
      employeeId,
      label: definition.label,
      type: definition.type,
      url,
    });

    nextDocuments.push({
      id: document.id,
      key: templateKey,
      label: document.label,
      type: document.type,
      url: document.url,
      generatedAt: document.createdAt,
    });
    existingKeys.add(templateKey);
  }

  return nextDocuments;
}

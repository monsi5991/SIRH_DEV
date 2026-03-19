-- CreateEnum
CREATE TYPE "WorkflowModule" AS ENUM ('LEAVE', 'EXPENSE', 'HR_REQUEST', 'TRAINING', 'DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "WorkflowApproverType" AS ENUM ('MANAGER', 'HR', 'ROLE', 'USER');

-- CreateEnum
CREATE TYPE "WorkflowInstanceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "WorkflowActionType" AS ENUM ('SUBMIT', 'APPROVE', 'REJECT', 'REASSIGN', 'COMMENT', 'CANCEL', 'ESCALATE');

-- CreateEnum
CREATE TYPE "HrRequestType" AS ENUM ('ATTESTATION', 'DATA_CHANGE', 'REMOTE_WORK', 'IT_ACCESS', 'PAYROLL_SUPPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "HrRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_MANAGER', 'PENDING_HR', 'APPROVED', 'REJECTED', 'CANCELED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PriorityLevel" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "InterviewType" AS ENUM ('ANNUAL', 'PROBATION', 'MID_YEAR', 'ONE_ON_ONE', 'EXIT', 'OTHER');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'DONE', 'CANCELED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'WHATSAPP', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'READ');

-- CreateTable
CREATE TABLE "WorkflowDefinition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module" "WorkflowModule" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxLevel" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStep" (
    "id" TEXT NOT NULL,
    "workflowDefinitionId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "approverType" "WorkflowApproverType" NOT NULL,
    "approverRole" TEXT,
    "approverUserId" TEXT,
    "slaHours" INTEGER,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowInstance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "definitionId" TEXT,
    "module" "WorkflowModule" NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "status" "WorkflowInstanceStatus" NOT NULL DEFAULT 'PENDING',
    "currentLevel" INTEGER NOT NULL DEFAULT 1,
    "requestedById" TEXT,
    "assignedToId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowAction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "WorkflowActionType" NOT NULL,
    "level" INTEGER,
    "comment" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requesterUserId" TEXT,
    "employeeId" TEXT,
    "type" "HrRequestType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "payload" JSONB,
    "status" "HrRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "priority" "PriorityLevel" NOT NULL DEFAULT 'NORMAL',
    "currentApproverId" TEXT,
    "slaDueAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "workflowInstanceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewCampaign" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "period" TEXT,
    "type" "InterviewType" NOT NULL DEFAULT 'ANNUAL',
    "status" TEXT NOT NULL DEFAULT 'open',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "campaignId" TEXT,
    "employeeId" TEXT NOT NULL,
    "managerEmployeeId" TEXT,
    "managerUserId" TEXT,
    "type" "InterviewType" NOT NULL DEFAULT 'ANNUAL',
    "status" "InterviewStatus" NOT NULL DEFAULT 'PLANNED',
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "summary" TEXT,
    "score" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "actorId" TEXT,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "readAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowDefinition_tenantId_code_workflow_key" ON "WorkflowDefinition"("tenantId", "code");

-- CreateIndex
CREATE INDEX "WorkflowDefinition_tenantId_module_isActive_idx" ON "WorkflowDefinition"("tenantId", "module", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowStep_workflowDefinitionId_level_key" ON "WorkflowStep"("workflowDefinitionId", "level");

-- CreateIndex
CREATE INDEX "WorkflowStep_workflowDefinitionId_approverType_idx" ON "WorkflowStep"("workflowDefinitionId", "approverType");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowInstance_tenant_module_resource_unique_key" ON "WorkflowInstance"("tenantId", "module", "resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "WorkflowInstance_tenantId_status_module_idx" ON "WorkflowInstance"("tenantId", "status", "module");

-- CreateIndex
CREATE INDEX "WorkflowInstance_tenantId_assignedToId_status_idx" ON "WorkflowInstance"("tenantId", "assignedToId", "status");

-- CreateIndex
CREATE INDEX "WorkflowAction_tenantId_instanceId_createdAt_idx" ON "WorkflowAction"("tenantId", "instanceId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkflowAction_tenantId_actorId_createdAt_idx" ON "WorkflowAction"("tenantId", "actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HrRequest_workflowInstanceId_key" ON "HrRequest"("workflowInstanceId");

-- CreateIndex
CREATE INDEX "HrRequest_tenantId_status_type_idx" ON "HrRequest"("tenantId", "status", "type");

-- CreateIndex
CREATE INDEX "HrRequest_tenantId_employeeId_createdAt_idx" ON "HrRequest"("tenantId", "employeeId", "createdAt");

-- CreateIndex
CREATE INDEX "HrRequest_tenantId_requesterUserId_createdAt_idx" ON "HrRequest"("tenantId", "requesterUserId", "createdAt");

-- CreateIndex
CREATE INDEX "HrRequest_tenantId_currentApproverId_status_idx" ON "HrRequest"("tenantId", "currentApproverId", "status");

-- CreateIndex
CREATE INDEX "InterviewCampaign_tenantId_status_type_idx" ON "InterviewCampaign"("tenantId", "status", "type");

-- CreateIndex
CREATE INDEX "InterviewCampaign_tenantId_startDate_endDate_idx" ON "InterviewCampaign"("tenantId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Interview_tenantId_status_scheduledAt_idx" ON "Interview"("tenantId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Interview_tenantId_employeeId_status_idx" ON "Interview"("tenantId", "employeeId", "status");

-- CreateIndex
CREATE INDEX "Interview_tenantId_managerEmployeeId_status_idx" ON "Interview"("tenantId", "managerEmployeeId", "status");

-- CreateIndex
CREATE INDEX "Notification_tenantId_userId_status_createdAt_idx" ON "Notification"("tenantId", "userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_tenantId_actorId_createdAt_idx" ON "Notification"("tenantId", "actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "WorkflowDefinition" ADD CONSTRAINT "WorkflowDefinition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStep" ADD CONSTRAINT "WorkflowStep_workflowDefinitionId_fkey" FOREIGN KEY ("workflowDefinitionId") REFERENCES "WorkflowDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "WorkflowDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowAction" ADD CONSTRAINT "WorkflowAction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowAction" ADD CONSTRAINT "WorkflowAction_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrRequest" ADD CONSTRAINT "HrRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrRequest" ADD CONSTRAINT "HrRequest_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrRequest" ADD CONSTRAINT "HrRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrRequest" ADD CONSTRAINT "HrRequest_workflowInstanceId_fkey" FOREIGN KEY ("workflowInstanceId") REFERENCES "WorkflowInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewCampaign" ADD CONSTRAINT "InterviewCampaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "InterviewCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_managerEmployeeId_fkey" FOREIGN KEY ("managerEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

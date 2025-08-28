-- DropForeignKey
ALTER TABLE "PolicyAck" DROP CONSTRAINT "PolicyAck_employeeId_fkey";

-- DropIndex
DROP INDEX "Leave_tenantId_start_idx";

-- DropIndex
DROP INDEX "Leave_tenantId_status_idx";

-- AlterTable
ALTER TABLE "ComplianceTask" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "obligationId" TEXT;

-- CreateTable
CREATE TABLE "ComplianceObligation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "period" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceChecklist" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceChecklistItem" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "daysOffset" INTEGER,
    "orderNo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ComplianceChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB,
    "ip" TEXT,
    "ua" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComplianceObligation_tenantId_period_idx" ON "ComplianceObligation"("tenantId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceObligation_tenantId_key_key" ON "ComplianceObligation"("tenantId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceChecklist_tenantId_code_key" ON "ComplianceChecklist"("tenantId", "code");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_type_createdAt_idx" ON "AuditEvent"("tenantId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "Leave_tenantId_idx" ON "Leave"("tenantId");

-- AddForeignKey
ALTER TABLE "ComplianceTask" ADD CONSTRAINT "ComplianceTask_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "ComplianceObligation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceObligation" ADD CONSTRAINT "ComplianceObligation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceChecklist" ADD CONSTRAINT "ComplianceChecklist_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceChecklistItem" ADD CONSTRAINT "ComplianceChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "ComplianceChecklist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyAck" ADD CONSTRAINT "PolicyAck_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

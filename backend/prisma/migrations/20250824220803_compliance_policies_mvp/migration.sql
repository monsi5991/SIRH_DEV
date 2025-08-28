-- CreateEnum
CREATE TYPE "ComplianceTaskStatus" AS ENUM ('TODO', 'DOING', 'DONE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PolicyAckMethod" AS ENUM ('read', 'check', 'otp');

-- CreateTable
CREATE TABLE "ComplianceTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "status" "ComplianceTaskStatus" NOT NULL DEFAULT 'TODO',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'FR',
    "content" TEXT,
    "fileUrl" TEXT,
    "effectiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyAck" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "method" "PolicyAckMethod" NOT NULL,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyAck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComplianceTask_tenantId_status_idx" ON "ComplianceTask"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ComplianceTask_tenantId_category_idx" ON "ComplianceTask"("tenantId", "category");

-- CreateIndex
CREATE INDEX "ComplianceTask_tenantId_employeeId_idx" ON "ComplianceTask"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "Policy_tenantId_category_idx" ON "Policy"("tenantId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Policy_tenantId_title_key" ON "Policy"("tenantId", "title");

-- CreateIndex
CREATE INDEX "PolicyVersion_tenantId_policyId_idx" ON "PolicyVersion"("tenantId", "policyId");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyVersion_tenantId_policyId_version_key" ON "PolicyVersion"("tenantId", "policyId", "version");

-- CreateIndex
CREATE INDEX "PolicyAck_tenantId_policyId_idx" ON "PolicyAck"("tenantId", "policyId");

-- CreateIndex
CREATE INDEX "PolicyAck_tenantId_employeeId_idx" ON "PolicyAck"("tenantId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyAck_policyId_employeeId_key" ON "PolicyAck"("policyId", "employeeId");

-- AddForeignKey
ALTER TABLE "ComplianceTask" ADD CONSTRAINT "ComplianceTask_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceTask" ADD CONSTRAINT "ComplianceTask_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyVersion" ADD CONSTRAINT "PolicyVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyVersion" ADD CONSTRAINT "PolicyVersion_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyAck" ADD CONSTRAINT "PolicyAck_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyAck" ADD CONSTRAINT "PolicyAck_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyAck" ADD CONSTRAINT "PolicyAck_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

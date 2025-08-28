-- CreateTable
CREATE TABLE "OnboardingCase" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT,
    "employeeName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OffboardingCase" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT,
    "employeeName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OffboardingCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OnboardingCase_tenantId_status_idx" ON "OnboardingCase"("tenantId", "status");

-- CreateIndex
CREATE INDEX "OnboardingCase_tenantId_employeeId_idx" ON "OnboardingCase"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "OffboardingCase_tenantId_status_idx" ON "OffboardingCase"("tenantId", "status");

-- CreateIndex
CREATE INDEX "OffboardingCase_tenantId_employeeId_idx" ON "OffboardingCase"("tenantId", "employeeId");

-- AddForeignKey
ALTER TABLE "OnboardingCase" ADD CONSTRAINT "OnboardingCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingCase" ADD CONSTRAINT "OnboardingCase_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffboardingCase" ADD CONSTRAINT "OffboardingCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffboardingCase" ADD CONSTRAINT "OffboardingCase_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

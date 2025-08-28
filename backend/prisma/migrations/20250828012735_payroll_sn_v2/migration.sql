/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,employee,date]` on the table `Timesheet` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,employeeId,date]` on the table `Timesheet` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "atRate" DOUBLE PRECISION NOT NULL DEFAULT 0.03,
ADD COLUMN     "bankIban" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "benefits" JSONB,
ADD COLUMN     "cadre" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "familyParts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ipmRate" DOUBLE PRECISION,
ADD COLUMN     "transportTaxable" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "employeeId" TEXT,
ADD COLUMN     "taxTreatment" TEXT NOT NULL DEFAULT 'REIMBURSEMENT',
ALTER COLUMN "currency" SET DEFAULT 'XOF';

-- AlterTable
ALTER TABLE "Leave" ADD COLUMN     "employeeId" TEXT,
ADD COLUMN     "halfDay" TEXT,
ADD COLUMN     "paid" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'CP';

-- AlterTable
ALTER TABLE "Timesheet" ADD COLUMN     "employeeId" TEXT,
ADD COLUMN     "premium" DOUBLE PRECISION,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'REG';

-- CreateTable
CREATE TABLE "PayRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "payRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "lines" JSONB NOT NULL,
    "totals" JSONB NOT NULL,
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayRun_tenantId_period_key" ON "PayRun"("tenantId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_tenantId_period_employeeId_key" ON "Payslip"("tenantId", "period", "employeeId");

-- CreateIndex
CREATE INDEX "Expense_tenantId_employeeId_date_idx" ON "Expense"("tenantId", "employeeId", "date");

-- CreateIndex
CREATE INDEX "Leave_tenantId_employeeId_start_end_idx" ON "Leave"("tenantId", "employeeId", "start", "end");

-- CreateIndex
CREATE INDEX "Timesheet_tenantId_employeeId_date_idx" ON "Timesheet"("tenantId", "employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Timesheet_tenantId_employee_date_key" ON "Timesheet"("tenantId", "employee", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Timesheet_tenantId_employeeId_date_key" ON "Timesheet"("tenantId", "employeeId", "date");

-- AddForeignKey
ALTER TABLE "PayRun" ADD CONSTRAINT "PayRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_payRunId_fkey" FOREIGN KEY ("payRunId") REFERENCES "PayRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

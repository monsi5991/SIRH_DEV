/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,employee,date]` on the table `Timesheet` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,employeeId,date]` on the table `Timesheet` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "atRate" DOUBLE PRECISION NOT NULL DEFAULT 0.03,
ADD COLUMN     "atRateOpt" DOUBLE PRECISION,
ADD COLUMN     "bankAccount" TEXT,
ADD COLUMN     "bankIban" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "benefits" JSONB,
ADD COLUMN     "cadre" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "familyParts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "familyPartsOpt" INTEGER,
ADD COLUMN     "internalMatricule" TEXT,
ADD COLUMN     "ipmRate" DOUBLE PRECISION,
ADD COLUMN     "isCadre" BOOLEAN,
ADD COLUMN     "transportTaxable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "transportTaxableOpt" BOOLEAN;

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
ALTER TABLE "Tenant" ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "employerCssNumber" TEXT,
ADD COLUMN     "employerIpresNumber" TEXT,
ADD COLUMN     "employerNinea" TEXT,
ADD COLUMN     "postalCode" TEXT;

-- AlterTable
ALTER TABLE "Timesheet" ADD COLUMN     "employeeId" TEXT,
ADD COLUMN     "premium" DOUBLE PRECISION,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'REG';

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

-- Leave balance engine: types, yearly balances and ledger

CREATE TYPE "LeaveTypeCategory" AS ENUM (
  'VACATION',
  'RTT',
  'SICK',
  'PARENTAL',
  'EXCEPTIONAL',
  'UNPAID',
  'OTHER'
);

CREATE TYPE "LeaveTypeUnit" AS ENUM (
  'DAY',
  'HOUR'
);

CREATE TYPE "LeaveLedgerDirection" AS ENUM (
  'CREDIT',
  'DEBIT'
);

CREATE TYPE "LeaveLedgerReason" AS ENUM (
  'OPENING',
  'ACCRUAL',
  'CONSUMPTION',
  'PENDING_RESERVE',
  'PENDING_RELEASE',
  'ADJUSTMENT',
  'CARRYOVER',
  'MANUAL_CORRECTION'
);

CREATE TABLE "LeaveType" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "category" "LeaveTypeCategory" NOT NULL DEFAULT 'OTHER',
  "unit" "LeaveTypeUnit" NOT NULL DEFAULT 'DAY',
  "defaultAnnualAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "carryoverLimit" DOUBLE PRECISION,
  "requiresDocument" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "country" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeaveType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeLeaveBalance" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "leaveTypeId" TEXT NOT NULL,
  "periodYear" INTEGER NOT NULL,
  "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "accrued" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "consumed" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "pending" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "adjustments" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "available" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeLeaveBalance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeaveBalanceLedgerEntry" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "leaveTypeId" TEXT NOT NULL,
  "balanceId" TEXT,
  "leaveId" TEXT,
  "periodYear" INTEGER NOT NULL,
  "direction" "LeaveLedgerDirection" NOT NULL,
  "reason" "LeaveLedgerReason" NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "note" TEXT,
  "meta" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeaveBalanceLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenantId_code_leave_type" ON "LeaveType"("tenantId", "code");
CREATE INDEX "LeaveType_tenantId_isActive_category_idx" ON "LeaveType"("tenantId", "isActive", "category");

CREATE UNIQUE INDEX "tenant_employee_leave_type_period" ON "EmployeeLeaveBalance"("tenantId", "employeeId", "leaveTypeId", "periodYear");
CREATE INDEX "EmployeeLeaveBalance_tenantId_employeeId_periodYear_idx" ON "EmployeeLeaveBalance"("tenantId", "employeeId", "periodYear");

CREATE INDEX "LeaveBalanceLedgerEntry_tenantId_employeeId_periodYear_idx" ON "LeaveBalanceLedgerEntry"("tenantId", "employeeId", "periodYear");
CREATE INDEX "LeaveBalanceLedgerEntry_tenantId_leaveTypeId_periodYear_idx" ON "LeaveBalanceLedgerEntry"("tenantId", "leaveTypeId", "periodYear");
CREATE INDEX "LeaveBalanceLedgerEntry_tenantId_reason_occurredAt_idx" ON "LeaveBalanceLedgerEntry"("tenantId", "reason", "occurredAt");
CREATE INDEX "LeaveBalanceLedgerEntry_tenantId_leaveId_idx" ON "LeaveBalanceLedgerEntry"("tenantId", "leaveId");

ALTER TABLE "LeaveType"
  ADD CONSTRAINT "LeaveType_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmployeeLeaveBalance"
  ADD CONSTRAINT "EmployeeLeaveBalance_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmployeeLeaveBalance"
  ADD CONSTRAINT "EmployeeLeaveBalance_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeLeaveBalance"
  ADD CONSTRAINT "EmployeeLeaveBalance_leaveTypeId_fkey"
  FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeaveBalanceLedgerEntry"
  ADD CONSTRAINT "LeaveBalanceLedgerEntry_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LeaveBalanceLedgerEntry"
  ADD CONSTRAINT "LeaveBalanceLedgerEntry_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeaveBalanceLedgerEntry"
  ADD CONSTRAINT "LeaveBalanceLedgerEntry_leaveTypeId_fkey"
  FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeaveBalanceLedgerEntry"
  ADD CONSTRAINT "LeaveBalanceLedgerEntry_balanceId_fkey"
  FOREIGN KEY ("balanceId") REFERENCES "EmployeeLeaveBalance"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeaveBalanceLedgerEntry"
  ADD CONSTRAINT "LeaveBalanceLedgerEntry_leaveId_fkey"
  FOREIGN KEY ("leaveId") REFERENCES "Leave"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

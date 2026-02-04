-- CreateTable
CREATE TABLE "LeaveActionLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leaveId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "reason" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveComment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leaveId" TEXT NOT NULL,
    "authorId" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeaveActionLog_tenantId_leaveId_createdAt_idx" ON "LeaveActionLog"("tenantId", "leaveId", "createdAt");

-- CreateIndex
CREATE INDEX "LeaveActionLog_tenantId_action_createdAt_idx" ON "LeaveActionLog"("tenantId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "LeaveComment_tenantId_leaveId_createdAt_idx" ON "LeaveComment"("tenantId", "leaveId", "createdAt");

-- AddForeignKey
ALTER TABLE "LeaveActionLog" ADD CONSTRAINT "LeaveActionLog_leaveId_fkey" FOREIGN KEY ("leaveId") REFERENCES "Leave"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveActionLog" ADD CONSTRAINT "LeaveActionLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveComment" ADD CONSTRAINT "LeaveComment_leaveId_fkey" FOREIGN KEY ("leaveId") REFERENCES "Leave"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveComment" ADD CONSTRAINT "LeaveComment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

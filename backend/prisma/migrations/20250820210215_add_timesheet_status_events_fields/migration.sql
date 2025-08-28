-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "attendees" JSONB,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "location" TEXT;

-- AlterTable
ALTER TABLE "Timesheet" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'Submitted';

-- CreateIndex
CREATE INDEX "Event_type_idx" ON "Event"("type");

-- CreateIndex
CREATE INDEX "Timesheet_status_idx" ON "Timesheet"("status");

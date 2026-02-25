-- AlterTable
ALTER TABLE "OffboardingCase" ADD COLUMN     "checklist" JSONB,
ADD COLUMN     "currentStep" TEXT NOT NULL DEFAULT 'letter',
ADD COLUMN     "employeeEmail" TEXT,
ADD COLUMN     "employeeFirstName" TEXT,
ADD COLUMN     "employeeLastName" TEXT,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "templates" JSONB,
ALTER COLUMN "status" SET DEFAULT 'open';

-- AlterTable
ALTER TABLE "OnboardingCase" ADD COLUMN     "checklist" JSONB,
ADD COLUMN     "currentStep" TEXT NOT NULL DEFAULT 'collect',
ADD COLUMN     "employeeEmail" TEXT,
ADD COLUMN     "employeeFirstName" TEXT,
ADD COLUMN     "employeeLastName" TEXT,
ADD COLUMN     "employeePosition" TEXT,
ADD COLUMN     "templates" JSONB,
ALTER COLUMN "status" SET DEFAULT 'open';

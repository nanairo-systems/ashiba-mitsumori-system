-- CreateEnum
CREATE TYPE "ScheduleWorkType" AS ENUM ('ASSEMBLY', 'DISASSEMBLY', 'REWORK');

-- CreateTable
CREATE TABLE "construction_schedules" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "workType" "ScheduleWorkType" NOT NULL,
    "plannedStartDate" TIMESTAMP(3),
    "plannedEndDate" TIMESTAMP(3),
    "actualStartDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "workersCount" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "construction_schedules_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "construction_schedules" ADD CONSTRAINT "construction_schedules_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

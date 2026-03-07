-- CreateTable: schedule_work_type_masters
CREATE TABLE "schedule_work_type_masters" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "shortLabel" TEXT NOT NULL,
    "colorIndex" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_work_type_masters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "schedule_work_type_masters_code_key" ON "schedule_work_type_masters"("code");

-- Seed default work types
INSERT INTO "schedule_work_type_masters" ("id", "code", "label", "shortLabel", "colorIndex", "sortOrder", "isDefault", "updatedAt")
VALUES
  (gen_random_uuid(), 'ASSEMBLY',    '組立',   '組', 0, 0, true, NOW()),
  (gen_random_uuid(), 'DISASSEMBLY', '解体',   '解', 1, 1, true, NOW()),
  (gen_random_uuid(), 'REWORK',      'その他', '他', 2, 2, true, NOW());

-- Convert workType column from enum to text
ALTER TABLE "construction_schedules"
  ALTER COLUMN "workType" TYPE TEXT USING "workType"::TEXT;

-- Drop the ScheduleWorkType enum
DROP TYPE "ScheduleWorkType";

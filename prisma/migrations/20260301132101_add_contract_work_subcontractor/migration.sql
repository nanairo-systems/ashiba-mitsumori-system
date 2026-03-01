-- CreateEnum
CREATE TYPE "WorkType" AS ENUM ('INHOUSE', 'SUBCONTRACT');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('NOT_ORDERED', 'ORDERED', 'COMPLETED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ContractStatus" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "ContractStatus" ADD VALUE 'BILLED';
ALTER TYPE "ContractStatus" ADD VALUE 'PAID';

-- CreateTable
CREATE TABLE "contract_works" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "workType" "WorkType" NOT NULL DEFAULT 'INHOUSE',
    "workerCount" INTEGER,
    "workDays" INTEGER,
    "subcontractorId" TEXT,
    "orderAmount" DECIMAL(12,2),
    "orderTaxAmount" DECIMAL(12,2),
    "orderTotalAmount" DECIMAL(12,2),
    "orderStatus" "OrderStatus" NOT NULL DEFAULT 'NOT_ORDERED',
    "orderedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_works_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subcontractors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "furigana" TEXT,
    "representative" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "bankInfo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subcontractors_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "contract_works" ADD CONSTRAINT "contract_works_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_works" ADD CONSTRAINT "contract_works_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "subcontractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

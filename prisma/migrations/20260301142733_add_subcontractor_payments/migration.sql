-- CreateEnum
CREATE TYPE "SubcontractorPaymentStatus" AS ENUM ('PENDING', 'SCHEDULED', 'PAID');

-- CreateTable
CREATE TABLE "subcontractor_payments" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "subcontractorId" TEXT NOT NULL,
    "orderAmount" DECIMAL(12,2) NOT NULL,
    "taxAmount" DECIMAL(12,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "closingDate" TIMESTAMP(3),
    "paymentDueDate" TIMESTAMP(3),
    "paymentDate" TIMESTAMP(3),
    "paymentAmount" DECIMAL(12,2),
    "status" "SubcontractorPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subcontractor_payments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "subcontractor_payments" ADD CONSTRAINT "subcontractor_payments_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcontractor_payments" ADD CONSTRAINT "subcontractor_payments_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "subcontractors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('FULL', 'ASSEMBLY', 'DISASSEMBLY', 'PROGRESS');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'PARTIAL_PAID');

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "invoiceType" "InvoiceType" NOT NULL DEFAULT 'FULL',
    "amount" DECIMAL(12,2) NOT NULL,
    "taxAmount" DECIMAL(12,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "paidAmount" DECIMAL(12,2),
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

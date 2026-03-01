-- DropForeignKey
ALTER TABLE "send_logs" DROP CONSTRAINT "send_logs_contactId_fkey";

-- AlterTable
ALTER TABLE "send_logs" ALTER COLUMN "contactId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "send_logs" ADD CONSTRAINT "send_logs_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

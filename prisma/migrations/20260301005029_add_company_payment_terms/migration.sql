-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "paymentClosingDay" INTEGER,
ADD COLUMN     "paymentMonthOffset" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "paymentNetDays" INTEGER,
ADD COLUMN     "paymentPayDay" INTEGER;

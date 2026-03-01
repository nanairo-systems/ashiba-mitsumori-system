-- CreateEnum
CREATE TYPE "EstimateType" AS ENUM ('INITIAL', 'ADDITIONAL');

-- AlterTable
ALTER TABLE "estimates" ADD COLUMN     "estimateType" "EstimateType" NOT NULL DEFAULT 'INITIAL',
ADD COLUMN     "title" TEXT;

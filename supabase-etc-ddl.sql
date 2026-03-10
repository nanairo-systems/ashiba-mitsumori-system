-- ETC管理テーブル作成SQL
-- Supabase SQLエディターで実行してください

-- 1. 車両テーブル
CREATE TABLE IF NOT EXISTS "EtcVehicle" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "plateNumber" TEXT NOT NULL,
  "nickname" TEXT,
  "vehicleType" TEXT,
  "note" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EtcVehicle_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EtcVehicle_plateNumber_key" UNIQUE ("plateNumber")
);

-- 2. ドライバーテーブル
CREATE TABLE IF NOT EXISTS "EtcDriver" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "note" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EtcDriver_pkey" PRIMARY KEY ("id")
);

-- 3. ETCカードテーブル
CREATE TABLE IF NOT EXISTS "EtcCard" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "cardNumber" TEXT NOT NULL,
  "vehicleId" TEXT,
  "driverId" TEXT,
  "note" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EtcCard_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EtcCard_cardNumber_key" UNIQUE ("cardNumber"),
  CONSTRAINT "EtcCard_vehicleId_fkey" FOREIGN KEY ("vehicleId")
    REFERENCES "EtcVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "EtcCard_driverId_fkey" FOREIGN KEY ("driverId")
    REFERENCES "EtcDriver"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 4. ETC利用記録テーブル
CREATE TABLE IF NOT EXISTS "EtcRecord" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "cardId" TEXT,
  "cardNumber" TEXT NOT NULL,
  "usageDate" TIMESTAMP(3) NOT NULL,
  "dayOfWeek" TEXT,
  "usageType" TEXT,
  "destinationName" TEXT,
  "plateNumber" TEXT,
  "amount" DECIMAL(10,2) NOT NULL,
  "usageInfo" TEXT,
  "complianceInfo" TEXT,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "yearMonth" TEXT NOT NULL,
  CONSTRAINT "EtcRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EtcRecord_cardId_fkey" FOREIGN KEY ("cardId")
    REFERENCES "EtcCard"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- インデックス
CREATE INDEX IF NOT EXISTS "EtcRecord_yearMonth_idx" ON "EtcRecord"("yearMonth");
CREATE INDEX IF NOT EXISTS "EtcRecord_cardId_idx" ON "EtcRecord"("cardId");
CREATE INDEX IF NOT EXISTS "EtcRecord_cardNumber_idx" ON "EtcRecord"("cardNumber");

-- updatedAt自動更新関数（既存の場合はスキップ）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- トリガー
DROP TRIGGER IF EXISTS update_etc_vehicle_updated_at ON "EtcVehicle";
CREATE TRIGGER update_etc_vehicle_updated_at
  BEFORE UPDATE ON "EtcVehicle"
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_etc_driver_updated_at ON "EtcDriver";
CREATE TRIGGER update_etc_driver_updated_at
  BEFORE UPDATE ON "EtcDriver"
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_etc_card_updated_at ON "EtcCard";
CREATE TRIGGER update_etc_card_updated_at
  BEFORE UPDATE ON "EtcCard"
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ============================================
-- v2: EtcDriver に部門・店舗追加 + 配車履歴テーブル
-- ============================================

-- EtcDriver に departmentId, storeId カラム追加
ALTER TABLE "EtcDriver" ADD COLUMN IF NOT EXISTS "departmentId" TEXT;
ALTER TABLE "EtcDriver" ADD COLUMN IF NOT EXISTS "storeId" TEXT;

ALTER TABLE "EtcDriver" DROP CONSTRAINT IF EXISTS "EtcDriver_departmentId_fkey";
ALTER TABLE "EtcDriver" ADD CONSTRAINT "EtcDriver_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EtcDriver" DROP CONSTRAINT IF EXISTS "EtcDriver_storeId_fkey";
ALTER TABLE "EtcDriver" ADD CONSTRAINT "EtcDriver_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ドライバー配車履歴テーブル
CREATE TABLE IF NOT EXISTS "EtcDriverAssignment" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "driverId" TEXT NOT NULL,
  "cardId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EtcDriverAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EtcDriverAssignment_driverId_fkey" FOREIGN KEY ("driverId")
    REFERENCES "EtcDriver"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EtcDriverAssignment_cardId_fkey" FOREIGN KEY ("cardId")
    REFERENCES "EtcCard"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "EtcDriverAssignment_cardId_startDate_idx"
  ON "EtcDriverAssignment"("cardId", "startDate");
CREATE INDEX IF NOT EXISTS "EtcDriverAssignment_driverId_startDate_idx"
  ON "EtcDriverAssignment"("driverId", "startDate");

-- ============================================
-- v3: 社員マスター + EtcDriver.employeeId
-- ============================================

-- 社員マスターテーブル
CREATE TABLE IF NOT EXISTS "Employee" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "departmentId" TEXT,
  "storeId" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "position" TEXT,
  "note" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Employee_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId")
    REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Employee_storeId_fkey" FOREIGN KEY ("storeId")
    REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- updatedAtトリガー
DROP TRIGGER IF EXISTS update_employee_updated_at ON "Employee";
CREATE TRIGGER update_employee_updated_at
  BEFORE UPDATE ON "Employee"
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- EtcDriver に employeeId カラム追加
ALTER TABLE "EtcDriver" ADD COLUMN IF NOT EXISTS "employeeId" TEXT;
ALTER TABLE "EtcDriver" DROP CONSTRAINT IF EXISTS "EtcDriver_employeeId_fkey";
ALTER TABLE "EtcDriver" ADD CONSTRAINT "EtcDriver_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- v4: 高速道路ICマスター（アラート機能用）
-- ============================================

CREATE TABLE IF NOT EXISTS "HighwayIC" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL UNIQUE,
  "roadName" TEXT,
  "area" TEXT NOT NULL DEFAULT 'normal',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HighwayIC_pkey" PRIMARY KEY ("id")
);

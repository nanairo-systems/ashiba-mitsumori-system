-- Phase 4: ConstructionSchedule に projectId を追加し、contractId を nullable に変更
-- 実行先: Supabase SQL エディター

-- 1. projectId カラムを追加（一旦 nullable で）
ALTER TABLE construction_schedules ADD COLUMN IF NOT EXISTS "projectId" TEXT;

-- 2. 既存データを移行（Contract 経由で projectId を埋める）
UPDATE construction_schedules cs
SET "projectId" = c."projectId"
FROM contracts c
WHERE cs."contractId" = c.id
  AND cs."projectId" IS NULL;

-- 3. NOT NULL 制約を追加
ALTER TABLE construction_schedules ALTER COLUMN "projectId" SET NOT NULL;

-- 4. 外部キー追加
ALTER TABLE construction_schedules
ADD CONSTRAINT fk_construction_schedules_project
FOREIGN KEY ("projectId") REFERENCES projects(id);

-- 5. contractId を nullable に変更
ALTER TABLE construction_schedules ALTER COLUMN "contractId" DROP NOT NULL;

-- 6. onDelete を CASCADE から SET NULL に変更（既存の FK 制約を再作成）
-- 既存の FK 制約名を確認して削除・再作成
ALTER TABLE construction_schedules
DROP CONSTRAINT IF EXISTS "construction_schedules_contractId_fkey";

ALTER TABLE construction_schedules
ADD CONSTRAINT "construction_schedules_contractId_fkey"
FOREIGN KEY ("contractId") REFERENCES contracts(id) ON DELETE SET NULL;

-- 7. projectId にインデックス追加（パフォーマンス用）
CREATE INDEX IF NOT EXISTS idx_construction_schedules_project_id
ON construction_schedules ("projectId");

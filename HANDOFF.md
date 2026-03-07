# セッション引き継ぎ情報

## 作業環境
- ワークツリー: `.claude/worktrees/happy-shannon`
- ブランチ: `claude/happy-shannon`
- 開発サーバー: ポート3001（`npx next dev --port 3001`）
- launch.json: `.claude/launch.json` に `next-dev`（3001）と `prisma-studio`（5555）設定済み

## 今回完了した作業

### 1. 車両マスタ API・画面
- `src/app/api/vehicles/route.ts` - GET（isActiveフィルタ）/ POST
- `src/app/api/vehicles/[id]/route.ts` - GET / PUT / DELETE（論理削除）
- MasterManager.tsx に「車両管理」タブ追加（8番目のタブ）
  - テーブル: 車両名・ナンバープレート・車種・積載量・車検期限・状態・編集
  - 車検期限色分け: ≤30日=赤+警告アイコン、31〜60日=オレンジ
  - 追加/編集ダイアログ・有効/無効切替

### 2. 車検通知機能
- `src/app/api/vehicles/check-inspection/route.ts` - 車検期限30日以内+期限切れ車両を検出し全ユーザーに通知生成（重複防止あり）
- `vercel.json` にcron追加（毎日3時実行）

### 3. Prismaスキーマ変更（DB反映済み）
- `Notification.estimateId` を nullable に変更（String → String?）
- `Notification.vehicleId` フィールド追加（String?）
- `NotificationType` に `VEHICLE_INSPECTION` 追加
- `Vehicle` に `notifications Notification[]` リレーション追加
- ※ `prisma db push` はtel_*テーブル問題があるため、手動SQL + `prisma generate` で対応

### 4. 通知画面改修
- `NotificationList.tsx` - 車検通知対応（オレンジ色カード、Carアイコン、車両管理リンク）
- `notifications/page.tsx` - vehicle includeを追加
- `api/notifications/route.ts` - vehicle includeを追加

## 前回までに完了した作業
- Worker（職人）マスタ API・画面
- Subcontractor（外注先）従業員管理タブ
- Team（班）マスタ API・画面（個人班/会社班、色選択、並び順変更）

## テストデータ（DB登録済み）
- 2tトラック（品川 300 あ 1234 / いすゞ エルフ / 2t / 車検 2026/04/01）
- 4tユニック（横浜 500 い 5678 / 日野 レンジャー / 4t / 車検 2026/04/30）
- A班（個人班・緑）、西田班（会社班・オレンジ）

## 既知の問題（今回の変更とは無関係）
- `contracts/page.tsx` に既存TSエラー
- 会社タブのbutton nesting hydrationエラー（既存）
- `prisma db push` 時にtel_*テーブル削除警告（`--accept-data-loss`禁止）

## 注意事項
- tel_*テーブルは別PCで統合作業中のため触らない
- companies / contacts テーブルのカラム削除・リネーム禁止
- コミットはユーザーの指示があるまで行わない

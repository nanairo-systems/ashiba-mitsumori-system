# CLAUDE.md — プロジェクトコンテキストファイル

> このファイルは Claude Code が新しいセッションを開始するたびに自動的に読み込みます。
> **プロジェクトの進捗・変更内容・注意事項はここに追記してください。**

---

## プロジェクト概要

**足場工事業者向け 業務管理 Web アプリケーション**

- リポジトリ: `nanairo-systems/ashiba-mitsumori-system`
- 本番環境: Vercel（自動デプロイ: `main` ブランチ）
- DB: Supabase PostgreSQL（プロジェクトID: `pddhilnnedbmiutitcox` / 東京リージョン）
- 開発ブランチ: `feature-ui-edit`（現在の作業ブランチ）

---

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | Next.js 16.1.6（App Router + Turbopack） |
| UI | React 19.2.3 + shadcn/ui（Radix UI） |
| CSS | Tailwind CSS 4 |
| ORM | Prisma Client 7.4.2（PrismaPg アダプター使用） |
| DB | PostgreSQL（Supabase） |
| 認証 | Supabase Auth（@supabase/ssr） |
| バリデーション | Zod 4.3.6 |
| フォーム | React Hook Form 7.71.2 |
| アイコン | Lucide React |
| トースト | Sonner |
| DnD | @dnd-kit 6.3.1 |
| デプロイ | Vercel |

---

## DB 接続に関する重要事項（必読）

```
DATABASE_URL: postgresql://postgres.pddhilnnedbmiutitcox:[PWD]@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
```

- **直接接続（db.xxxx.supabase.co:5432）は使用不可**（IPv6のみ対応のため、ローカルのIPv4環境から接続不可）
- **Session Pooler（aws-1-ap-northeast-1.pooler.supabase.com:5432）を使用すること**
- `prisma db push` や `prisma migrate` で接続エラーが出た場合は Supabase の SQL エディターを直接使用する
- 新しいモデルを追加した場合は必ず `npx prisma generate` を実行してクライアントを再生成すること
- `.next` ディレクトリのキャッシュが古い場合はサーバー再起動前に削除する

---

## アプリケーション構成（ルートグループ）

```
src/app/
├── (app)/              ← メイン業務システム（足場見積・契約・人員配置）
│   ├── layout.tsx      ← Sidebar + 認証チェック + Prisma ユーザー取得
│   ├── dashboard/      ← ダッシュボード
│   ├── projects/       ← 案件（現場）管理
│   ├── estimates/      ← 見積管理
│   ├── contracts/      ← 契約・請求管理
│   ├── schedules/      ← 工程・人員配置
│   ├── notifications/  ← 通知
│   └── settings/       ← 設定・マスター管理
│
└── (accounting)/       ← 経理システム（フェーズ1: 2026-03 実装済み）
    ├── layout.tsx       ← AccountingSidebar + 認証チェック
    ├── accounting/      ← ダッシュボード
    ├── accounting/masters/         ← マスター管理（会社・部門・店舗）
    ├── accounting/vendors/         ← 取引先管理
    ├── accounting/vendors/[id]/    ← 取引先詳細
    └── accounting/subcontractor-invoices/ ← 外注費入力・管理
```

---

## 実装済み機能一覧

### メイン業務システム（(app)グループ）
- [x] 案件（現場）管理（CRUD・アーカイブ）
- [x] 見積管理（ドラッグ＆ドロップ編集・PDF出力・送付ログ）
- [x] 契約・請求管理（インボイス・支払管理）
- [x] 工程管理（ガントチャート）
- [x] 人員配置（D&D・チーム管理・職長カード・車両管理）
- [x] 通知機能（フォローアップ・車検通知）
- [x] テンプレート管理
- [x] マスター管理（取引先・作業種別・単位など）
- [x] DEVELOPERロール・サイドバーモード切替
- [x] モバイル対応

### 経理システム（(accounting)グループ）— フェーズ1
- [x] 経理専用サイドバー（AccountingSidebar）
- [x] マスター管理（会社・部門・店舗のCRUD + 初期データ登録）
  - 開発者限定の削除機能（名前確認ダイアログ付き）
  - 店舗一覧に会社・部門カラム表示
- [x] 取引先管理（Vendor）
  - 一覧・検索・フィルター（会社・部門別）
  - 新規登録（基本情報・銀行口座・保険・許可情報）
  - 詳細ページ（タブ形式: 基本情報・保険/許可・車両・従業員・書類）
  - 車両管理（VendorVehicle: 登録・削除）
  - 従業員管理（VendorEmployee: 登録・削除）
- [x] 外注費管理（SubcontractorInvoice）
  - 一覧・フィルター（会社・部門・ステータス・年月）
  - 新規登録（2段階確認UI: 入力→確認→登録）
  - ステータス管理（PENDING→PAID）
  - CSV出力（15日払い・月末払い別）
- [x] ETC管理（`/accounting/etc`）
  - 車両・ドライバー・ETCカードのCRUD管理
  - ETC利用明細CSVインポート
  - 月別集計サマリー（棒グラフ＋車両別明細）
  - 車両×月クロス集計テーブル（店舗・部門・ドライバー表示対応）
  - ドライバー配車履歴管理（日付ベースのカード⇔ドライバー割当）
  - サンプルデータシードAPI
  - ドライバー登録時に社員マスターから選択可能
  - 高速道路ICマスター（HighwayIC）+ 初期データシードAPI（東海地方約100IC）
  - ETCアラート機能（ダッシュボード内タブ + 専用ページ `/accounting/etc/alerts`）
    - 7種類: 未登録IC・高額利用・休日深夜利用・初行先・高頻度・月間急増・個人平均超過
    - 日本の祝日対応（2025-2027年）
    - 日付範囲絞込・種別/重要度フィルター・テキスト検索・CSV出力
- [x] 社員マスター（Employee）
  - マスター管理4タブ目（会社・部門・店舗・社員）
  - 会社別フィルター・部門/店舗紐付け・検索・CRUD
  - ETCドライバー登録時の選択元

---

## DB スキーマ（経理関連）

```
AccountingCompany（会社区分）
  ├─ Department（部門）
  │   ├─ Store（店舗）
  │   ├─ Employee（社員）
  │   └─ EtcDriver（ETCドライバー・部門紐付け）
  └─ Vendor（取引先）
      ├─ VendorDepartment（部門との関連・中間テーブル）
      ├─ VendorVehicle（保有車両）
      ├─ VendorEmployee（従業員）
      └─ SubcontractorInvoice（外注費請求）

Employee（社員マスター）
  ├─ Department（部門紐付け）
  ├─ Store（店舗紐付け）
  └─ EtcDriver（ETCドライバー紐付け）

EtcVehicle（ETC車両）
  └─ EtcCard（ETCカード）
      ├─ EtcDriver（現在のドライバー）
      ├─ EtcDriverAssignment（配車履歴）
      └─ EtcRecord（利用記録）

EtcDriver（ETCドライバー）
  ├─ Department（部門紐付け）
  ├─ Store（店舗紐付け）
  ├─ Employee（社員紐付け）
  ├─ EtcCard（現在担当カード）
  └─ EtcDriverAssignment（配車履歴）

HighwayIC（高速道路ICマスター）
```

**Enum**
- `ClosingType`: MONTH_END（月末締め）/ DAY_15（15日締め）
- `SubInvoiceStatus`: PENDING（未払）/ PAID（支払済）
- `AccountType`: ORDINARY（普通）/ CURRENT（当座）

---

## API エンドポイント（経理）

| メソッド | パス | 説明 |
|--------|------|------|
| GET/POST | `/api/accounting/companies` | 会社一覧取得・新規作成 |
| PATCH | `/api/accounting/companies/[id]` | 会社更新 |
| GET/POST | `/api/accounting/departments` | 部門一覧取得・新規作成 |
| PATCH | `/api/accounting/departments/[id]` | 部門更新 |
| GET/POST | `/api/accounting/stores` | 店舗一覧取得・新規作成 |
| PATCH | `/api/accounting/stores/[id]` | 店舗更新 |
| GET/POST | `/api/accounting/vendors` | 取引先一覧・新規作成 |
| GET/PATCH | `/api/accounting/vendors/[id]` | 取引先取得・更新 |
| GET/POST | `/api/accounting/subcontractor-invoices` | 外注費一覧・新規作成 |
| PATCH/DELETE | `/api/accounting/subcontractor-invoices/[id]` | 外注費更新・削除 |
| GET | `/api/accounting/subcontractor-invoices/export` | CSV出力（?yearMonth=&closingType=&companyId=） |
| DELETE | `/api/accounting/companies/[id]` | 会社削除（DEVELOPER限定） |
| DELETE | `/api/accounting/departments/[id]` | 部門削除（DEVELOPER限定） |
| DELETE | `/api/accounting/stores/[id]` | 店舗削除（DEVELOPER限定） |
| GET/POST | `/api/accounting/etc/drivers` | ETCドライバー一覧・新規作成 |
| PATCH/DELETE | `/api/accounting/etc/drivers/[id]` | ETCドライバー更新・無効化 |
| GET/POST | `/api/accounting/etc/assignments` | 配車履歴一覧・新規作成 |
| GET | `/api/accounting/etc/monthly-summary` | 月別集計サマリー |
| GET | `/api/accounting/etc/vehicle-monthly` | 車両×月クロス集計（?from=&to=） |
| POST | `/api/accounting/etc/seed` | サンプルデータ投入 |
| GET/POST | `/api/accounting/employees` | 社員一覧・新規作成 |
| PATCH/DELETE | `/api/accounting/employees/[id]` | 社員更新・削除 |
| GET/POST/PUT | `/api/accounting/etc/highway-ics` | ICマスター一覧・作成・シード |
| GET | `/api/accounting/etc/alerts` | ETCアラート取得（?from=&to=&threshold=） |

---

## ブランチ戦略

```
main          ← 本番（Vercel 自動デプロイ）
feature-ui-edit ← 現在の開発ブランチ（mainより2コミット先行）
```

- 作業は `feature-ui-edit` で行い、完成したら PR → `main` へマージ
- `claude/vibrant-goldberg` は削除済み（2026-03-09）

---

## 進捗・変更ログ

### 2026-03-10（セッション）

#### 実施内容
- **ETC管理拡張**
  - EtcDriverに部門（departmentId）・店舗（storeId）紐付け追加
  - EtcDriverAssignmentテーブル追加（日付ベースの配車履歴管理）
  - 車両×月クロス集計テーブル追加（店舗・部門・ドライバー表示、ドライバー変更時は別行表示）
  - 月別集計サマリー追加（棒グラフ＋車両別明細展開）
  - ドライバー管理画面の全面改修（部門・店舗選択、配車管理UI）
  - サンプルデータシードAPI追加（車両4台・ドライバー10名・カード4枚・6ヶ月分記録）
  - DDL v2をSupabase DBに直接適用（departmentId/storeIdカラム追加 + EtcDriverAssignmentテーブル作成）
- **マスター管理拡張**
  - 会社・部門・店舗に開発者限定の削除機能追加（名前入力確認ダイアログ）
  - 店舗一覧に「会社」「部門」カラム追加
- **DB変更**: `supabase-etc-ddl.sql` にv2 DDL追記・適用済み
- **社員マスター追加**
  - Employeeモデル追加（Prisma + DDL v3）
  - マスター管理に4タブ目「社員」追加（CRUD・会社フィルター・部門/店舗紐付け）
  - ETCドライバー登録時に「社員から選択」ボタン追加
  - EtcDriverにemployeeIdカラム追加
- **ETCアラートシステム追加**
  - HighwayICモデル追加（DDL v4）+ 東海地方約100IC初期データシードAPI
  - ETCアラートAPI（7種類検知: unknown_ic, high_amount, unusual_time, first_ic, high_frequency, monthly_spike, above_avg）
  - 日本の祝日対応（2025-2027年ハードコード）
  - ETCダッシュボード内「アラート」タブ
  - 専用アラートページ `/accounting/etc/alerts`（日付範囲絞込・種別/重要度フィルター・テキスト検索・CSV出力・詳細展開）

### 2026-03-09（セッション）

#### 実施内容
- `claude/vibrant-goldberg` ブランチとワークツリーを削除
- **経理システム フェーズ1 デバッグ・本番化対応**
  - 原因1: 経理DBテーブル未作成 → Supabase SQLエディターで直接DDL実行（AccountingCompany, Department, Store, Vendor, VendorDepartment, VendorVehicle, VendorEmployee, SubcontractorInvoice + 関連Enum）
  - 原因2: DB直接接続（IPv6）からSession Pooler（IPv4対応）へ `DATABASE_URL` を変更
  - 原因3: Prismaクライアント未再生成 → `npx prisma generate` 実行・`.next` キャッシュ削除・サーバー再起動
  - バグ修正: `SubcontractorInvoiceList.tsx` の `<SelectItem value="">` → `value="none"` に修正（Radix UI制約）

#### 残課題・今後のフェーズ
- [ ] 支払管理ページ（`/accounting/payment`）の実装（現在は未実装・サイドバーにリンクあり）
- [ ] 取引先詳細の「書類」タブ（PDFアップロード機能）の実装
- [ ] 外注費PDF保存機能の実装
- [ ] モバイル最適化（経理システム）
- [ ] 外注費集計・ダッシュボードウィジェット追加

---

## よく参照するファイルパス

```
# 経理システム
src/app/(accounting)/                          ← ページ一覧
src/components/accounting/                     ← コンポーネント
src/app/api/accounting/                        ← APIルート
src/components/accounting/layout/AccountingSidebar.tsx

# DBスキーマ（経理モデルは末尾735行目〜）
prisma/schema.prisma

# Prisma接続設定
src/lib/prisma.ts
prisma.config.ts

# 環境変数（コミット対象外）
.env.local

# 仕様書
SPECIFICATION.md                               ← メインシステム仕様書
SPECIFICATION_ACCOUNTING.md                    ← 経理システム仕様書（フェーズ1）
```

---

## 開発サーバー起動

```bash
# devサーバー起動（.claude/launch.json で管理）
npm run dev   # localhost:3000

# Prismaクライアント再生成
npx prisma generate

# DBスキーマ更新（接続不可の場合はSupabase SQLエディターを使用）
npm run db:push

# .nextキャッシュクリア（挙動がおかしい時）
rm -rf .next && npm run dev
```

---

## 注意事項

1. **Supabase の直接接続（ポート5432の `db.xxxx.supabase.co`）はローカル環境から接続不可**。Session Pooler を使うこと。
2. **新しい Prisma モデルを追加した場合、DBへの適用は Supabase SQLエディターで手動実行が必要**（`db:push` が使えないため）。適用後は必ず `npx prisma generate` を実行する。
3. **`<SelectItem value="">` は使用不可**（Radix UI の制約）。空選択を表したい場合は `value="none"` などの文字列を使い、`onValueChange` で変換する。
4. **`feature-ui-edit` ブランチで作業すること**。`main` への直接コミットは避ける。

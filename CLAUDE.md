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
- [x] 工程管理（ガントチャート・共有ScheduleMiniGanttモジュール・リスト/ガント切替）
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

### 2026-03-13（セッション）

#### 実施内容
- **SO-2 カスタムボタンシステム**
  - SiteOpsDialog SO-2 を4ボタン→5ボタンに拡張（Googleマップ・画像登録 固定 + 3カスタムスロット）
  - 7種のカスタムボタンオプション: 見積詳細・工程表・電話する・安全管理・作業日報・天気確認・メモ
  - localStorage永続化（`so_custom_btn_3/4/5`）
  - ホバーで歯車アイコン → Popoverで選択変更
  - 人員配置テーブル（WA）と同一のカスタムボタンオプションを共有
- **人員配置テーブル アクションボタン統一**
  - 右側4ボタンを SO-2 と同じパステルカラーに統一（bg-green-50, bg-amber-50 等）
  - 固定2（Googleマップ・画像登録）+ カスタム2（安全管理・見積詳細 デフォルト）
  - localStorage永続化（`wa_custom_btn_3/4`）
- **商談一覧 UI改善**
  - ヘッダーボタン「新規作成」→「新規見積作成」に変更、`/estimates/new` に遷移
  - 見積詳細（EstimateDetailV2）のデザインをSiteOpsDialog風に統一
- **NewEstimateForm 簡略化**
  - 3ステップ → 2ステップ（会社・現場を1画面に統合）
- **予定日付の廃止**
  - SO-1 / CD-1 ヘッダーから「予定」表示を削除（「実績」は残存）
  - 工程作成APIの`plannedStartDate/plannedEndDate`をオプショナルに変更
  - デフォルト日付自動設定（today〜+30日）を削除
- **SiteOpsDialog 拡張**
  - `estimateSlot` prop追加（SO-2とSO-3の間に見積詳細を挿入可能）
  - `mode` prop追加（`"dialog"` / `"inline"` 切替）
  - `projectId` のみでの起動に対応（工程0件の現場でも表示可能）
- **コード品質改善（全体リファクタリング）**
  - `src/lib/utils.ts` に `formatYen`・`formatDateRange` を追加
  - 10ファイルのローカル `formatDate` 重複定義を `@/lib/utils` からのimportに統一
  - 5ファイルのローカル `formatDateRange` 重複定義を統一（`OverflowIndicator` 経由のre-export維持）
  - 3ファイルのローカル `formatCurrency`/`formatYen` 重複定義を統一
  - 5ファイルの未使用import削除（12件: Button, SiteOpsEstimateSection, Users, useRef, Building2, Phone, User, ChevronLeft, formatRelativeDate, RotateCcw, CalendarPlus 等）
  - 22ファイル変更、75行の純削減

#### 変更ファイル
| ファイル | 変更内容 |
|---------|---------|
| `src/lib/utils.ts` | `formatYen`・`formatDateRange` 追加 |
| `src/components/site-operations/SiteOpsDialog.tsx` | SO-2 カスタムボタン5つ化 + 未使用import削除 |
| `src/components/worker-assignments/WorkerAssignmentTable.tsx` | カスタムボタン統一 + 重複関数削除 |
| `src/components/worker-assignments/AssignmentDetailPanel.tsx` | formatDateRange統一 |
| `src/components/worker-assignments/AddAssignmentDialog.tsx` | formatDateRange統一 |
| `src/components/worker-assignments/UnassignedSchedulesBar.tsx` | formatDateRange統一 |
| `src/components/worker-assignments/OverflowIndicator.tsx` | formatDateRange → re-export化 |
| `src/components/contracts/ContractDetail.tsx` | 未使用import削除 |
| `src/components/contracts/ContractSummary.tsx` | formatYen/formatDate統一 |
| `src/components/projects/ProjectList.tsx` | 未使用import削除 + ボタン変更 |
| `src/components/estimates/EstimateDetailV2.tsx` | 未使用import削除 |
| `src/components/estimates/NewEstimateForm.tsx` | 2ステップ化 |
| `src/components/site-operations/SiteOpsEstimateSection.tsx` | formatDate/formatCurrency統一 |
| `src/components/masters/MasterManager.tsx` | formatDate統一 |
| `src/components/accounting/etc/EtcRecordList.tsx` | formatDate統一 |
| `src/components/accounting/etc/EtcDriverManager.tsx` | formatDate統一 |
| `src/components/accounting/etc/EtcAlerts.tsx` | formatDate統一 |
| `src/components/accounting/etc/EtcAlertPage.tsx` | formatDateTime統一 |
| `src/components/accounting/fuel/FuelAlertPage.tsx` | formatDate統一 |
| `src/components/accounting/fuel/FuelRecordList.tsx` | formatDate統一 |
| `src/components/accounting/vendors/VendorDetail.tsx` | formatDate統一 |
| `src/components/accounting/subcontractor-invoices/SubcontractorInvoiceList.tsx` | formatCurrency→formatYen |
| `src/app/api/accounting/subcontractor-invoices/export/route.ts` | formatDate統一 |
| `src/app/api/schedules/route.ts` | plannedStartDate/EndDate をオプショナル化 |

#### 共有ユーティリティ関数（src/lib/utils.ts）
```
cn()                   ← Tailwind CSS クラス結合
formatDate(date, fmt?) ← 日付フォーマット（date-fns / 日本語ロケール）
formatRelativeDate()   ← 相対日付（今日/昨日/○日前）
formatCurrency()       ← 金額カンマ区切り（¥なし）
formatYen()            ← 金額カンマ区切り（¥付き）★新規
formatDateRange()      ← 日付範囲（M/d〜M/d）★新規
calcTax()              ← 消費税計算
addBusinessDays()      ← 営業日計算
calcFollowUpAt()       ← フォロー通知日時
formatEstimateNumber() ← 見積番号生成
generateShortProjectId() ← 現場短ID生成
formatCompanyPaymentTerms() ← 支払条件表示
```

---

### 2026-03-11（セッション）

#### 実施内容
- **ガントチャート共有モジュール化（ScheduleMiniGantt）**
  - 旧 `SiteOpsMiniGantt.tsx`（517行・自前実装）を削除
  - 新 `ScheduleMiniGantt.tsx`（310行）を共有モジュールとして作成
  - 既存の共有ビルディングブロックを活用: `GanttToolbar`, `GanttBar`, `GanttDateHeader`, `GanttBarAreaBackground`, `GanttDragPreview`
  - フック3種を統合: `useGanttDrag`（ドラッグ作成）, `useGanttMove`（長押し移動）, `useGanttResize`（端リサイズ）
  - SiteOpsDialog・ContractDetail 両方で同一モジュールを使用
- **ContractDetail ガントチャート改修**
  - インラインガントコード約530行を `ScheduleMiniGantt` に置換（約400行削減）
  - リスト/ガント切替トグル追加（`viewMode: "gantt" | "list"`）
  - リストビュー: グループ化されたコンパクトカード表示
- **SiteOpsDialog レイアウト改善**
  - ダイアログ幅 `sm:max-w-3xl` → `sm:max-w-4xl`（約1.2倍）
  - 2カラムグリッドレイアウト（左: 会社/契約情報+日付、右: 住所/連絡先/メモ）
  - 工程日程を作業内容タブ直下に移動
  - 冗長なヘッダー・アイコン削除、テキストサイズ縮小（text-xs）
- **工程日程カード（SiteOpsDateSection）コンパクト化**
  - 横並び2〜3枚表示（flex-wrap + basis-[calc(33.333%)]）
  - カード構造: 1行目=バッジ+ステータス、2行目=日付+日数
  - 削除ボタンをホバーオーバーレイに変更

#### 変更ファイル
| ファイル | 変更内容 |
|---------|---------|
| `src/components/schedules/ScheduleMiniGantt.tsx` | **新規** 共有ガントモジュール |
| `src/components/site-operations/SiteOpsMiniGantt.tsx` | **削除** 旧自前実装 |
| `src/components/contracts/ContractDetail.tsx` | ScheduleMiniGantt導入 + リスト/ガント切替 |
| `src/components/site-operations/SiteOpsDialog.tsx` | ScheduleMiniGantt導入 + 幅拡大 |
| `src/components/site-operations/SiteOpsInfoSection.tsx` | 2カラムグリッド + コンパクト化 |
| `src/components/site-operations/SiteOpsDateSection.tsx` | 横並びカード + コンパクト化 |

#### 共有ガントモジュール アーキテクチャ
```
ScheduleMiniGantt（共有モジュール）
├─ Props: schedules, displayDays, isLocked, workTypes, onCreateSchedule, onUpdateDates, ...
├─ 使用先1: ContractDetail（契約詳細パネル）
├─ 使用先2: SiteOpsDialog（現場運営ダイアログ）
└─ 依存コンポーネント:
    ├─ GanttToolbar (variant="mini")     ← モード切替・ナビゲーション
    ├─ GanttDateHeader (variant="mini")  ← 日付ヘッダー
    ├─ GanttBar                          ← バー描画（予定/実績・リサイズ・移動ゴースト）
    ├─ GanttBarAreaBackground            ← 今日線・週末背景
    ├─ GanttDragPreview                  ← ドラッグ作成プレビュー
    ├─ useGanttDrag                      ← ドラッグ作成フック
    ├─ useGanttMove                      ← 長押し移動フック
    └─ useGanttResize                    ← 端リサイズフック
```

---

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
# ガントチャート共有モジュール
src/components/schedules/ScheduleMiniGantt.tsx  ← 共有ガントモジュール（SiteOps/ContractDetail両方で使用）
src/components/schedules/GanttToolbar.tsx       ← ツールバー（モード切替・ナビ）
src/components/schedules/GanttBar.tsx           ← バー描画
src/components/schedules/GanttDateHeader.tsx    ← 日付ヘッダー
src/components/schedules/GanttBarArea.tsx       ← 背景・ドラッグプレビュー
src/components/schedules/schedule-types.ts      ← 型定義（ScheduleData, WorkTypeMaster等）
src/components/schedules/schedule-utils.ts      ← ユーティリティ
src/components/schedules/schedule-constants.ts  ← 定数・色設定
src/hooks/use-gantt-drag.ts                    ← ドラッグ作成フック
src/hooks/use-gantt-move.ts                    ← 長押し移動フック
src/hooks/use-gantt-resize.ts                  ← 端リサイズフック

# 現場運営ダイアログ
src/components/site-operations/SiteOpsDialog.tsx
src/components/site-operations/SiteOpsInfoSection.tsx
src/components/site-operations/SiteOpsDateSection.tsx

# 契約詳細
src/components/contracts/ContractDetail.tsx

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

---

## 作業スタイル

- **確認を都度取らず自律的に進めること**（コード編集・コミット・ブラウザ確認・リファクタリング等）
- **以下のみ確認を取る**: `main` ブランチへの操作（本番デプロイ直結）、ファイル/ブランチ削除等の不可逆操作
- コード変更 → ブラウザ確認 → 問題なければ次へ、という流れを止めずに進める

---

## UI変更時のブラウザ確認ルール（絶対必須）

> **⚠️ このルールはすべてのUI変更に適用される。例外なし。**
> **コードを書いただけでは「完了」ではない。ブラウザで実際に確認して初めて完了。**

### 確認フロー（毎回必ず実行）
1. コード変更後、以下のAppleScriptでブラウザをリロード:
   ```bash
   osascript -e 'tell application "Google Chrome" to reload active tab of window 1'
   ```
2. 5秒待機後、ページのテキストとエラーを取得して確認:
   ```bash
   osascript -e 'tell application "Google Chrome" to execute active tab of window 1 javascript "document.body.innerText.substring(0, 3000)"'
   ```
   ```bash
   osascript -e 'tell application "Google Chrome" to execute active tab of window 1 javascript "
   (function() {
     var errors = [];
     document.querySelectorAll(\"[role=alert], .error, .text-red-500, .text-destructive\").forEach(function(el) {
       if (el.textContent.trim()) errors.push(el.textContent.trim().substring(0, 200));
     });
     return errors.length > 0 ? \"エラー検出: \" + errors.join(\" | \") : \"エラーなし\";
   })()"'
   ```
3. **Chrome操作後、Terminalにフォーカスを戻す（画面切替防止）:**
   ```bash
   osascript -e 'tell application "Terminal" to activate'
   ```
4. 変更が正しく反映されているか確認
5. **問題があれば修正 → 再リロード → 再確認（問題が解消するまで繰り返す）**
6. 問題がなければ完了報告

### 絶対禁止事項
- **ブラウザで確認する前に「できました」「完了しました」「修正しました」と報告すること → 禁止**
- コードを書いただけで完了と判断すること → 禁止
- エラーが出ているのに無視して完了と報告すること → 禁止
- 1回の確認で問題を見つけたのに修正せずに報告すること → 禁止

### 確認が必要な変更の例
- コンポーネントの追加・変更・削除
- レイアウト・スタイルの変更
- ボタン・フォーム・ナビゲーションの変更
- テキスト・ラベルの変更
- 条件分岐によるUI表示の変更

### Chromeスキル（`/chrome` コマンド）
| コマンド | 説明 |
|---------|------|
| `/chrome` | ページ全体の状態を確認（URL・テキスト・エラー・構造） |
| `/chrome reload` | ページリロード + 5秒待機 + 自動確認 |
| `/chrome shot` | スクリーンショット撮影（画面収録権限が必要） |
| `/chrome dev` | localhost:3000を開く |
| `/chrome text` | ページの全テキスト取得 |
| `/chrome errors` | コンソールエラー確認 |
| `/chrome find CSSセレクタ` | 特定要素のテキスト確認 |
| `/chrome table` | テーブルデータ取得 |

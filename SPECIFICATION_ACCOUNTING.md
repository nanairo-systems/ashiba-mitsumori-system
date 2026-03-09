# 経理管理システム 仕様書（フェーズ1）

> 作成日: 2026-03-09
> ブランチ: `feature-ui-edit`
> フェーズ: Phase 1（基盤構築・取引先管理・外注費管理）

---

## 1. システム概要

足場工事業者向け業務管理システムに組み込まれた経理モジュール。
協力業者（外注先）の管理と月次外注費の入力・集計・CSV出力を中心とした機能を提供する。

### 対象ユーザー

- 経理担当者・管理者
- 現場担当者（外注費入力）

### アクセスパス

- エントリーポイント: `/accounting`
- 既存の足場システムとは別ルートグループ `(accounting)` で分離
- 既存の Supabase 認証を共有（ログイン共通）

---

## 2. 機能一覧

| 機能 | パス | 状態 |
|------|------|------|
| ダッシュボード | `/accounting` | ✅ 実装済み |
| マスター管理（会社） | `/accounting/masters` | ✅ 実装済み |
| マスター管理（部門） | `/accounting/masters` | ✅ 実装済み |
| マスター管理（店舗） | `/accounting/masters` | ✅ 実装済み |
| 取引先一覧 | `/accounting/vendors` | ✅ 実装済み |
| 取引先詳細 | `/accounting/vendors/[id]` | ✅ 実装済み |
| 外注費入力・一覧 | `/accounting/subcontractor-invoices` | ✅ 実装済み |
| 外注費CSV出力 | `/accounting/subcontractor-invoices`（ボタン） | ✅ 実装済み |
| 支払管理 | `/accounting/payment` | 🔲 フェーズ2 |
| 外注費PDF保存 | 外注費一覧内 | 🔲 フェーズ2 |
| 経理ダッシュボード集計 | `/accounting` | 🔲 フェーズ2 |

---

## 3. データモデル

### 3-1. 階層構造

```
AccountingCompany（会社区分）
  ├─ Department（部門）
  │   └─ Store（店舗）
  └─ Vendor（取引先・協力業者）
      ├─ VendorDepartment（部門との関連）
      ├─ VendorVehicle（保有車両）
      ├─ VendorEmployee（従業員）
      └─ SubcontractorInvoice（外注費請求）
```

### 3-2. モデル定義

#### AccountingCompany（会社区分）

| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | TEXT（UUID） | 主キー |
| name | TEXT | 会社名（例: 株式会社七色、南施工サービス） |
| colorCode | TEXT? | 表示カラーコード（例: `#3B82F6`） |
| sortOrder | INT | 表示順（デフォルト: 0） |
| isActive | BOOLEAN | 有効フラグ（デフォルト: true） |
| createdAt / updatedAt | TIMESTAMP | 自動設定 |

#### Department（部門）

| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | TEXT（UUID） | 主キー |
| companyId | TEXT | AccountingCompany への FK |
| name | TEXT | 部門名（例: 塗装、足場、リフォーム） |
| sortOrder | INT | 表示順 |
| isActive | BOOLEAN | 有効フラグ |
| createdAt / updatedAt | TIMESTAMP | 自動設定 |

#### Store（店舗）

| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | TEXT（UUID） | 主キー |
| departmentId | TEXT | Department への FK |
| name | TEXT | 店舗名（例: 本社、緑店、春日井店） |
| sortOrder | INT | 表示順 |
| isActive | BOOLEAN | 有効フラグ |
| createdAt / updatedAt | TIMESTAMP | 自動設定 |

#### Vendor（取引先・協力業者）

| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | TEXT（UUID） | 主キー |
| companyId | TEXT | AccountingCompany への FK |
| name | TEXT | 取引先名 |
| furigana | TEXT? | フリガナ |
| representativeName | TEXT? | 代表者名 |
| phone | TEXT? | 電話番号 |
| email | TEXT? | メールアドレス |
| address | TEXT? | 住所 |
| **銀行口座情報** | | |
| bankName | TEXT? | 銀行名 |
| branchName | TEXT? | 支店名 |
| accountType | AccountType? | 口座種別（ORDINARY/CURRENT） |
| accountNumber | TEXT? | 口座番号 |
| accountHolder | TEXT? | 口座名義 |
| **支払条件** | | |
| closingType | ClosingType | 締め日（MONTH_END/DAY_15） |
| hasInvoiceRegistration | BOOLEAN | インボイス登録有無 |
| invoiceNumber | TEXT? | インボイス登録番号 |
| **保険情報** | | |
| constructionInsuranceCompany | TEXT? | 建設保険会社名 |
| constructionInsuranceNumber | TEXT? | 建設保険証券番号 |
| constructionInsuranceExpiry | TIMESTAMP? | 建設保険有効期限 |
| vehicleInsuranceCompany | TEXT? | 自動車保険会社名 |
| vehicleInsuranceNumber | TEXT? | 自動車保険証券番号 |
| vehicleInsuranceExpiry | TIMESTAMP? | 自動車保険有効期限 |
| compulsoryInsuranceExpiry | TIMESTAMP? | 強制保険有効期限 |
| **建設業許可** | | |
| constructionLicenseNumber | TEXT? | 建設業許可番号 |
| constructionLicenseExpiry | TIMESTAMP? | 建設業許可有効期限 |
| **労働保険** | | |
| laborInsuranceNumber | TEXT? | 労災保険番号 |
| employmentInsuranceNumber | TEXT? | 雇用保険番号 |
| **外国人労働者** | | |
| hasForeignWorkers | BOOLEAN | 外国人労働者在籍有無 |
| foreignWorkerNote | TEXT? | 外国人労働者メモ |
| **管理情報** | | |
| startDate | TIMESTAMP? | 取引開始日 |
| rating | TEXT? | 評価 |
| antisocialCheckDone | BOOLEAN | 反社チェック実施済み |
| isSuspended | BOOLEAN | 取引停止フラグ |
| suspensionReason | TEXT? | 取引停止理由 |
| emergencyContact | TEXT? | 緊急連絡先 |
| note | TEXT? | 備考 |
| isActive | BOOLEAN | 有効フラグ |

#### VendorVehicle（協力業者 保有車両）

| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | TEXT（UUID） | 主キー |
| vendorId | TEXT | Vendor への FK |
| plateNumber | TEXT? | ナンバープレート |
| vehicleType | TEXT? | 車種 |
| compulsoryExpiry | TIMESTAMP? | 強制保険有効期限 |
| insuranceExpiry | TIMESTAMP? | 任意保険有効期限 |
| note | TEXT? | 備考 |
| createdAt / updatedAt | TIMESTAMP | 自動設定 |

#### VendorEmployee（協力業者 従業員）

| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | TEXT（UUID） | 主キー |
| vendorId | TEXT | Vendor への FK |
| name | TEXT | 氏名 |
| birthDate | TIMESTAMP? | 生年月日 |
| position | TEXT? | 役職・職位 |
| qualifications | TEXT? | 資格 |
| isForeignWorker | BOOLEAN | 外国人区分 |
| residenceStatus | TEXT? | 在留資格 |
| note | TEXT? | 備考 |
| isActive | BOOLEAN | 在籍フラグ |
| createdAt / updatedAt | TIMESTAMP | 自動設定 |

#### SubcontractorInvoice（外注費請求）

| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | TEXT（UUID） | 主キー |
| vendorId | TEXT | Vendor への FK |
| companyId | TEXT | AccountingCompany への FK |
| departmentId | TEXT | Department への FK |
| storeId | TEXT? | Store への FK（任意） |
| billingYearMonth | TIMESTAMP | 請求対象年月 |
| amount | DECIMAL(12,2) | 金額（税込） |
| closingType | ClosingType | 締め区分（MONTH_END/DAY_15） |
| paymentDueDate | TIMESTAMP? | 支払期限 |
| paymentDate | TIMESTAMP? | 実支払日 |
| status | SubInvoiceStatus | ステータス（PENDING/PAID） |
| pdfUrl | TEXT? | PDF保存URL |
| note | TEXT? | 備考 |
| createdAt / updatedAt | TIMESTAMP | 自動設定 |

### 3-3. Enum 定義

```
ClosingType:      MONTH_END（月末締め）/ DAY_15（15日締め）
SubInvoiceStatus: PENDING（未払い）/ PAID（支払済み）
AccountType:      ORDINARY（普通口座）/ CURRENT（当座口座）
```

---

## 4. 画面仕様

### 4-1. ダッシュボード（`/accounting`）

- 4つの機能カードを表示
  - 取引先管理（青系）: 取引先の登録・編集、保険・車両・従業員管理へのリンク
  - 外注費入力（緑系）: 月次外注費の入力・管理・PDF保存へのリンク
  - 支払管理（オレンジ系）: 未払い外注費の確認・支払処理へのリンク（フェーズ2）
  - マスター管理（グレー系）: 会社・部門・店舗の登録・編集へのリンク
- 将来的なウィジェット拡張用スペースあり

### 4-2. マスター管理（`/accounting/masters`）

#### タブ構成
- 会社タブ / 部門タブ / 店舗タブ

#### 会社管理（CompanyMasterList）
- テーブル表示: 会社名・カラー・表示順・状態
- 操作: 新規登録・編集（インライン）・無効化・有効化
- 初期データ一括登録ボタン（株式会社七色・南施工サービス）
- API: `POST /api/accounting/companies`, `PATCH /api/accounting/companies/[id]`

#### 部門管理（DepartmentMasterList）
- 会社選択後に該当部門を表示
- テーブル表示: 部門名・所属会社・表示順・状態
- 操作: 新規登録・編集・無効化・有効化
- 初期データ: 塗装・リフォーム・足場・足場買取販売・本部経費
- API: `POST /api/accounting/departments`, `PATCH /api/accounting/departments/[id]`

#### 店舗管理（StoreMasterList）
- 会社→部門の順に選択後、該当店舗を表示
- テーブル表示: 店舗名・所属部門・表示順・状態
- 操作: 新規登録・編集・無効化・有効化
- 初期データ: 本社・緑店・春日井店・横浜店
- API: `POST /api/accounting/stores`, `PATCH /api/accounting/stores/[id]`

### 4-3. 取引先管理（`/accounting/vendors`）

#### 一覧表示
- カラム: 取引先名・フリガナ・電話番号・支払区分・インボイス登録・ステータス
- 検索: 会社名・フリガナでのフリーテキスト検索
- フィルター: 会社区分・部門

#### 新規登録ダイアログ
- **基本情報**: 会社区分・取引先名・フリガナ・代表者名・電話・メール・住所
- **銀行口座**: 銀行名・支店名・口座種別・口座番号・口座名義
- **支払条件**: 締め区分・インボイス登録有無・インボイス番号
- **保険情報**: 建設保険・自動車保険・強制保険（各: 保険会社・証券番号・有効期限）
- **許可情報**: 建設業許可番号・有効期限
- **労働保険**: 労災保険番号・雇用保険番号
- **外国人労働者**: 在籍有無・メモ
- **管理情報**: 取引開始日・評価・反社チェック・取引停止・緊急連絡先・備考

### 4-4. 取引先詳細（`/accounting/vendors/[id]`）

タブ構成:

| タブ | 内容 |
|-----|------|
| 基本情報 | 会社区分・名前・フリガナ・代表者・連絡先・住所・銀行口座・支払条件・反社チェック |
| 保険/許可 | 建設保険・自動車保険・強制保険・建設業許可・労働保険 各詳細 |
| 車両 | 保有車両一覧（ナンバー・車種・保険期限）・追加・削除 |
| 従業員 | 従業員一覧（氏名・役職・資格・外国人区分）・追加・削除 |
| 書類 | PDF書類アップロード（フェーズ2） |

### 4-5. 外注費管理（`/accounting/subcontractor-invoices`）

#### 一覧表示
- カラム: 取引先・会社区分・部門・請求年月・金額・締め・ステータス
- フィルター: 会社区分・部門・ステータス（未払い/支払済み）・年月
- 合計金額表示（フィルター結果の合計）
- CSV出力ボタン（15日払い別・月末払い別）

#### 新規登録（2段階確認UI）
1. **入力画面**: 会社区分→取引先・部門・店舗（任意）・請求年月・金額・支払区分・備考を入力
2. **確認画面**: 入力内容の確認表示
3. **登録**: API呼び出し→一覧に追加・トースト通知

#### ステータス管理
- 一覧の「未払い」バッジをクリック → 「支払済み」に変更（確認ダイアログあり）

#### CSV出力仕様
- 対象: 年月・締め区分（15日/月末）・会社区分で絞り込み
- フォーマット（列）:
  1. 支払予定日
  2. 会社区分
  3. 取引先名
  4. 口座名義
  5. 銀行名
  6. 支店名
  7. 口座種別
  8. 口座番号
  9. 金額
  10. 支払区分
  11. 備考
- エンコーディング: UTF-8（BOM付き）
- ファイル名: `外注費_{年月}_{締め区分}.csv`

---

## 5. レイアウト・ナビゲーション

### AccountingSidebar（経理専用サイドバー）

- **デスクトップ**: 左側固定サイドバー（展開60px / 折畳14px）
- **モバイル**: ボトムナビゲーション + ドロワーメニュー
- ナビゲーション項目:
  - ダッシュボード（ホームアイコン）
  - 取引先管理（ユーザーアイコン）
  - 外注費入力（ドキュメントアイコン）
  - 支払管理（ウォレットアイコン）
  - マスター管理（設定アイコン）
- フッター: 足場システムへ戻るリンク・ログアウトボタン

---

## 6. API 仕様

### POST `/api/accounting/companies`
```json
Request: { "name": "string", "colorCode": "string?", "sortOrder": "number?" }
Response: AccountingCompany
```

### PATCH `/api/accounting/companies/[id]`
```json
Request: { "name"?, "colorCode"?, "sortOrder"?, "isActive"? }
Response: AccountingCompany
```

### POST `/api/accounting/departments`
```json
Request: { "companyId": "string", "name": "string", "sortOrder": "number?" }
Response: Department
```

### POST `/api/accounting/stores`
```json
Request: { "departmentId": "string", "name": "string", "sortOrder": "number?" }
Response: Store
```

### GET `/api/accounting/vendors`
```
Query: ?search=&companyId=&departmentId=
Response: Vendor[]（company・departments・vehiclesをinclude）
```

### POST `/api/accounting/vendors`
```json
Request: {
  "companyId": "string",
  "name": "string",
  "furigana"?, "representativeName"?, "phone"?, "email"?, "address"?,
  "bankName"?, "branchName"?, "accountType"?, "accountNumber"?, "accountHolder"?,
  "closingType"?: "MONTH_END" | "DAY_15",
  "hasInvoiceRegistration"?: boolean,
  "invoiceNumber"?,
  "constructionInsuranceCompany"?, ...（保険・許可情報）,
  "hasForeignWorkers"?, "foreignWorkerNote"?,
  "startDate"?, "rating"?, "antisocialCheckDone"?, "note"?
}
Response: Vendor
```

### GET `/api/accounting/subcontractor-invoices`
```
Query: ?companyId=&departmentId=&storeId=&status=PENDING|PAID&yearMonth=YYYY-MM
Response: SubcontractorInvoice[]（vendor・company・department・storeをinclude）
```

### POST `/api/accounting/subcontractor-invoices`
```json
Request: {
  "vendorId": "string",
  "companyId": "string",
  "departmentId": "string",
  "storeId"?: "string",
  "billingYearMonth": "YYYY-MM-DD（月の1日）",
  "amount": number,
  "closingType": "MONTH_END" | "DAY_15",
  "paymentDueDate"?: "date",
  "note"?: "string"
}
Response: SubcontractorInvoice
```

### PATCH `/api/accounting/subcontractor-invoices/[id]`
```json
Request: { "status"?: "PAID", "paymentDate"?: "date", ... }
Response: SubcontractorInvoice
```

### GET `/api/accounting/subcontractor-invoices/export`
```
Query: yearMonth=YYYY-MM（必須）&closingType=MONTH_END|DAY_15&companyId=
Response: CSV（Content-Disposition: attachment; filename=...）
```

---

## 7. フェーズ2 予定機能

| 機能 | 概要 | 優先度 |
|------|------|--------|
| 支払管理 | 未払い外注費一覧・一括支払処理・支払予定日管理 | 高 |
| 外注費PDF保存 | Supabase Storageへ請求PDFアップロード・URL保存 | 中 |
| 書類管理 | 取引先詳細の「書類」タブ: PDF書類アップロード・プレビュー | 中 |
| ダッシュボード集計 | 月次外注費合計・未払い件数・会社別集計ウィジェット | 低 |
| モバイル最適化 | 経理システム全体のモバイルUX改善 | 低 |
| 外注費編集・削除 | 登録済み外注費の編集・削除機能 | 中 |

---

## 8. 既知の不具合・制約

| 内容 | 対応状況 |
|------|---------|
| `<SelectItem value="">` エラー（Radix UI制約） | ✅ 修正済み（2026-03-09）: `value="none"` に変更 |
| DB直接接続（IPv4制約） | ✅ 修正済み（2026-03-09）: Session Pooler URL に変更 |
| 支払管理ページ未実装 | 🔲 フェーズ2 |

---

## 9. テストデータ（初期データ）

システム内に初期データ一括登録ボタンを実装済み。

### 会社区分（初期データ）
- 株式会社七色
- 南施工サービス

### 部門（初期データ）
- 塗装 / リフォーム / 足場 / 足場買取販売 / 本部経費

### 店舗（初期データ）
- 本社 / 緑店 / 春日井店 / 横浜店

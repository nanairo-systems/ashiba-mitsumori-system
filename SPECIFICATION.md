# 足場見積システム（ashiba-mitsumori-system）開発仕様書

> 更新日: 2026-03-07
> リポジトリ: https://github.com/nanairo-systems/ashiba-mitsumori-system

---

## 1. システム概要

足場工事業者向けの見積・契約・請求管理Webアプリケーション。
現場（Project）を中心に、見積→契約→工期管理→請求→入金の一連の業務フローをサポートする。

### 技術スタック

| カテゴリ | 技術 | バージョン |
|---------|------|-----------|
| フレームワーク | Next.js (App Router) + Turbopack | 16.1.6 |
| UI | React | 19.2.3 |
| CSS | Tailwind CSS | 4 |
| UIコンポーネント | shadcn/ui (Radix UI) | - |
| ORM | Prisma Client | 7.4.2 |
| DB | PostgreSQL (Supabase) | - |
| 認証 | Supabase Auth | @supabase/ssr 0.8.0 |
| バリデーション | Zod | 4.3.6 |
| フォーム | React Hook Form | 7.71.2 |
| アイコン | Lucide React | 0.575.0 |
| トースト | Sonner | 2.0.7 |
| チャート | Recharts | 3.7.0 |
| DnD | @dnd-kit | 6.3.1 |
| デプロイ | Vercel | - |

### 開発環境

- ローカルIP: 192.168.0.134 / ポート: 3000
- テストアカウント: staff@ashiba-sample.com / staffpass1234
- 編集用ブランチ: `feature-ui-edit`（ブランチを増やさない方針）

---

## 2. ディレクトリ構成

```
/
├── prisma/
│   ├── schema.prisma            # DBスキーマ定義
│   ├── migrations/              # マイグレーション履歴（15件）
│   ├── seed.ts                  # シードデータ
│   ├── seed-issiki-template.ts  # 一式テンプレートシード
│   └── seed-invoices.ts         # 請求書サンプルデータ
├── src/
│   ├── app/
│   │   ├── layout.tsx           # ルートレイアウト
│   │   ├── login/page.tsx       # ログインページ
│   │   ├── (app)/               # 認証済みルート群
│   │   │   ├── layout.tsx       # アプリレイアウト（Sidebar含む）
│   │   │   └── [feature]/page.tsx
│   │   ├── (print)/             # 印刷専用ルート群
│   │   └── api/                 # APIエンドポイント
│   ├── components/
│   │   ├── contracts/           # 契約関連（8ファイル）
│   │   ├── estimates/           # 見積関連（5ファイル）
│   │   ├── invoices/            # 請求関連（3ファイル）
│   │   ├── layout/Sidebar.tsx   # ナビゲーション
│   │   ├── masters/             # マスター管理（2ファイル）
│   │   ├── notifications/       # 通知（1ファイル）
│   │   ├── orders/              # 注文書（1ファイル）
│   │   ├── payments/            # 入金管理（1ファイル）
│   │   ├── projects/            # 現場関連（3ファイル）
│   │   ├── schedules/           # ガントチャート（9ファイル）
│   │   ├── settings/            # 設定（1ファイル）
│   │   ├── subcontractor-payments/ # 支払管理（1ファイル）
│   │   ├── templates/           # テンプレ管理（1ファイル）
│   │   └── ui/                  # shadcn/ui共通部品（23ファイル）
│   ├── hooks/
│   │   ├── use-estimate-create.ts  # 見積作成共通ロジック
│   │   ├── use-gantt-drag.ts       # ガントDnD
│   │   ├── use-gantt-move.ts       # ガント移動
│   │   ├── use-gantt-resize.ts     # ガントリサイズ
│   │   └── use-mobile.ts           # モバイル判定
│   ├── lib/
│   │   ├── prisma.ts            # Prismaクライアント（シングルトン）
│   │   ├── utils.ts             # ユーティリティ関数
│   │   └── supabase/
│   │       ├── admin.ts         # Supabase管理クライアント
│   │       ├── client.ts        # ブラウザ用クライアント
│   │       └── server.ts        # サーバー用クライアント
│   └── middleware.ts            # 認証ミドルウェア
```

---

## 3. ページ一覧

### 3.1 メインアプリケーション（認証必須）

| パス | ページ名 | 主要コンポーネント |
|------|---------|-----------------|
| `/` | 商談一覧（ダッシュボード） | `ProjectList.tsx` |
| `/projects/[id]` | 現場詳細 | `ProjectDetail.tsx` + `EstimateDetail.tsx` |
| `/projects/new` | 新規現場作成 | `NewProjectForm.tsx` |
| `/estimates/[id]` | 見積詳細・編集 | `EstimateEditor.tsx` |
| `/estimates/new` | 新規見積作成（3ステップ） | `NewEstimateForm.tsx` |
| `/contracts` | 契約一覧 | `ContractList.tsx` |
| `/contracts/[id]` | 契約詳細 | `ContractDetail.tsx` |
| `/contracts/summary` | 契約集計 | `ContractSummary.tsx` |
| `/schedules` | 工期管理（ガント） | `ScheduleGantt.tsx` |
| `/invoices` | 請求管理 | `InvoiceList.tsx` |
| `/payments` | 入金管理 | `PaymentList.tsx` |
| `/subcontractor-payments` | 支払管理 | `SubcontractorPaymentList.tsx` |
| `/templates` | テンプレ管理 | `TemplateList.tsx` |
| `/masters` | マスター管理 | `MasterManager.tsx` |
| `/notifications` | 通知 | `NotificationList.tsx` |
| `/settings` | 設定 | `SettingsForm.tsx` |

### 3.2 印刷専用ルート

`/estimates/[id]/print`, `/estimates/bulk`, `/invoices/[id]/print`, `/invoices/bulk`, `/orders/[id]/print`

### 3.3 ナビゲーション

- **デスクトップ**: 左サイドバー（折りたたみ可能）
- **モバイル**: ボトムナビ（商談/契約/見積作成/通知）+ ドロワー
- **管理者のみ**: 工期管理, 請求管理, 入金管理, 支払管理

サイドバーに項目追加する場合は `src/components/layout/Sidebar.tsx` の `navItems` 配列に追加：
```typescript
const navItems = [
  { href: "/", label: "商談一覧", shortLabel: "商談", icon: FolderOpen, adminOnly: false },
  { href: "/contracts", label: "契約一覧", shortLabel: "契約", icon: HandshakeIcon, adminOnly: false },
  // ... 追加する場合はここに
]
// ボトムナビ常時表示
const BOTTOM_NAV_HREFS = ["/", "/contracts", "/estimates/new", "/notifications"]
```

---

## 4. コードパターン（新規ページ作成テンプレート）

### 4.1 ページコンポーネント（Server Component）パターン

すべてのページは同じ構造: **Server Component でデータ取得 → Client Component に渡す**

```typescript
// src/app/(app)/[feature]/page.tsx
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { MyFeatureComponent } from "@/components/[feature]/MyFeatureComponent"

export default async function MyFeaturePage() {
  // 1. 認証チェック（全ページ共通）
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // 2. データ取得（Promise.allで並列化）
  const [dbUser, data] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    prisma.someModel.findMany({
      where: { isArchived: false },
      include: { relatedModel: true },
      orderBy: { createdAt: "desc" },
    }),
  ])
  if (!dbUser) redirect("/login")

  // 3. シリアライズ（Decimal→number, Date→string が必要な場合）
  const serialized = data.map((d) => ({
    ...d,
    amount: Number(d.amount),          // Decimal → number
    createdAt: d.createdAt,            // Date はそのままでOK
  }))

  // 4. Client Component に渡す
  return <MyFeatureComponent data={serialized} currentUser={dbUser} />
}
```

### 4.2 動的ルートページパターン

```typescript
// src/app/(app)/[feature]/[id]/page.tsx
export default async function DetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params  // Next.js 16: params は Promise
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const item = await prisma.someModel.findUnique({ where: { id } })
  if (!item) redirect("/")

  return <DetailComponent item={item} />
}
```

### 4.3 検索パラメータ付きページ

```typescript
// src/app/(app)/[feature]/page.tsx
export default async function PageWithSearch({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>
}) {
  const { projectId } = await searchParams  // Next.js 16: searchParams も Promise
  // projectId を使ったプリセット処理
}
```

### 4.4 Client Component パターン

```typescript
// src/components/[feature]/MyComponent.tsx
"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface Props {
  data: SomeType[]
  currentUser: { id: string; name: string }
}

export function MyComponent({ data, currentUser }: Props) {
  const router = useRouter()
  // ... Client Side Logic
  // データ更新後: router.refresh() でServer Componentを再実行
}
```

### 4.5 APIルートパターン（GET + POST）

```typescript
// src/app/api/[feature]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

// Zodスキーマ定義
const createSchema = z.object({
  name: z.string().min(1, "名前を入力してください"),
  amount: z.number().nonnegative(),
  status: z.enum(["DRAFT", "CONFIRMED"]).default("DRAFT"),
  note: z.string().optional(),
})

// POST: 作成
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const item = await prisma.someModel.create({ data: parsed.data })
  return NextResponse.json(item, { status: 201 })
}

// GET: 一覧取得
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search") ?? ""

  const items = await prisma.someModel.findMany({
    where: search ? { name: { contains: search, mode: "insensitive" } } : undefined,
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(items)
}
```

### 4.6 APIルートパターン（動的ID: GET + PATCH + DELETE）

```typescript
// src/app/api/[feature]/[id]/route.ts
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  // ... 認証チェック + prisma.findUnique
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  // ... 認証チェック + Zod検証 + prisma.update
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  // ... 認証チェック + prisma.delete
}
```

### 4.7 フォームコンポーネントパターン

```typescript
"use client"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

const schema = z.object({
  name: z.string().min(1, "名前を入力してください"),
  companyId: z.string().min(1, "会社を選択してください"),
})
type FormValues = z.infer<typeof schema>

export function MyForm({ companies }: Props) {
  const router = useRouter()
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(values: FormValues) {
    const res = await fetch("/api/something", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })
    if (!res.ok) { toast.error("失敗しました"); return }
    toast.success("作成しました")
    router.push("/somewhere")
  }

  return <form onSubmit={handleSubmit(onSubmit)}>...</form>
}
```

---

## 5. 主要コンポーネントのProps型定義

### 5.1 ProjectList（商談一覧 /）

```typescript
interface EstimateRow {
  id: string; title: string | null; estimateType: EstimateType
  status: EstimateStatus; confirmedAt: Date | null; createdAt: Date
  user: { id: string; name: string }; totalAmount: number
}
interface Project {
  id: string; shortId: string; name: string; address: string | null
  isArchived: boolean; createdAt: Date; updatedAt: Date
  branch: {
    name: string
    company: {
      id: string; name: string; taxRate: number
      paymentClosingDay: number | null; paymentMonthOffset: number
      paymentPayDay: number | null; paymentNetDays: number | null
    }
  }
  contact: { name: string } | null
  estimates: EstimateRow[]
}
interface Props {
  projects: Project[]; currentUser: { id: string; name: string }
  templates: EstimateTemplate[]
}
```

### 5.2 ContractList（契約一覧 /contracts）

```typescript
interface GateInfo {
  scheduleCount: number; hasActualStart: boolean; allActualEnd: boolean
  invoiceCount: number; allInvoicesPaid: boolean
}
interface Contract {
  id: string; contractNumber: string | null; name: string | null
  status: ContractStatus; contractAmount: number; taxAmount: number
  totalAmount: number; contractDate: Date; startDate: Date | null
  endDate: Date | null; paymentTerms: string | null; note: string | null
  createdAt: Date
  project: {
    id: string; name: string; address: string | null
    branch: { name: string; company: { id: string; name: string } }
    contact: { name: string } | null
  }
  estimate: { id: string; estimateNumber: string | null; title: string | null
    user: { id: string; name: string } }
  estimateCount: number; gate: GateInfo
}
```

### 5.3 EstimateEditor（見積編集）

```typescript
interface EditorItem {
  _key: string; id?: string; name: string; quantity: number
  unitId: string; unitPrice: number; sortOrder: number
}
interface EditorGroup {
  _key: string; id?: string; name: string; sortOrder: number
  items: EditorItem[]
}
interface EditorSection {
  _key: string; id?: string; name: string; sortOrder: number
  groups: EditorGroup[]
}
interface Props {
  estimateId: string; initialTitle: string | null
  initialNote: string | null; initialDiscount: number
  initialValidDays: number; initialSections: EditorSection[]
  units: { id: string; name: string }[]; taxRate: number
  onSaved: () => void; onCancel: () => void
}
```

### 5.4 NewEstimateForm（新規見積作成 /estimates/new）

```typescript
interface Company {
  id: string; name: string
  branches: { id: string; name: string }[]
  contacts: { id: string; name: string; phone: string; email: string }[]
}
interface Project {
  id: string; name: string
  branch: { name: string; company: { name: string } }
  contact: { name: string } | null
}
interface Template {
  id: string; name: string; description: string | null
  estimateType: "INITIAL" | "ADDITIONAL" | "BOTH"
  sections?: { id: string; name: string
    groups: { id: string; name: string
      items: { id: string; name: string; quantity: number
        unitPrice: number; unit: { name: string } | null }[]
    }[]
  }[]
}
interface Props {
  projects: Project[]; templates: Template[]
  companies: Company[]; currentUser: { id: string; name: string }
}
// presetProjectId パラメータ対応
```

### 5.5 NewProjectForm（新規現場作成 /projects/new）

```typescript
interface Company {
  id: string; name: string
  branches: { id: string; name: string }[]
  contacts: { id: string; name: string }[]
}
interface Props {
  companies: Company[]; currentUser: { id: string; name: string }
}
// Zodスキーマ:
const schema = z.object({
  companyId: z.string().min(1, "会社を選択してください"),
  branchId: z.string().optional(),
  contactId: z.string().optional(),
  name: z.string().min(1, "現場名を入力してください"),
})
```

---

## 6. APIエンドポイント一覧

### 6.1 現場（Projects）

| Method | パス | リクエストBody |
|--------|------|---------------|
| GET | `/api/projects?search=&archived=` | - |
| POST | `/api/projects` | `{ branchId, contactId?, name, address? }` |
| PUT | `/api/projects/[id]` | 部分更新 |
| DELETE | `/api/projects/[id]` | - |
| POST | `/api/projects/[id]/archive` | `{ archiveNote? }` |

### 6.2 見積（Estimates）

| Method | パス | リクエストBody |
|--------|------|---------------|
| POST | `/api/estimates` | `{ projectId, templateId?, title?, estimateType, note? }` |
| PUT | `/api/estimates/[id]` | 全データ（明細含む完全置換） |
| DELETE | `/api/estimates/[id]` | - |
| POST | `/api/estimates/[id]/confirm` | - |
| POST | `/api/estimates/[id]/send` | `{ contactId?, note? }` |
| POST | `/api/estimates/[id]/revise` | - |
| POST | `/api/estimates/[id]/archive` | - |

### 6.3 契約（Contracts）

| Method | パス |
|--------|------|
| GET/POST | `/api/contracts` |
| GET/PATCH/DELETE | `/api/contracts/[id]` |
| POST | `/api/contracts/bulk` |
| GET | `/api/contracts/summary` |
| GET/POST | `/api/contracts/[id]/works` |
| PUT/DELETE | `/api/contracts/[id]/works/[workId]` |
| GET/POST | `/api/contracts/[id]/schedules` |
| PUT/DELETE | `/api/contracts/[id]/schedules/[scheduleId]` |

### 6.4 請求・入金・支払

| Method | パス |
|--------|------|
| GET/POST | `/api/invoices` |
| GET/PUT/DELETE | `/api/invoices/[id]` |
| GET/POST | `/api/payments` |
| PUT/DELETE | `/api/payments/[id]` |
| GET | `/api/payments/export` |
| GET/POST | `/api/subcontractor-payments` |
| PUT/DELETE | `/api/subcontractor-payments/[id]` |

### 6.5 マスターデータ

| Method | パス |
|--------|------|
| GET/POST | `/api/companies`, `/api/contacts`, `/api/subcontractors`, `/api/users` |
| GET/PUT/DELETE | `/api/companies/[id]`, `/api/subcontractors/[id]`, `/api/users/[id]` |
| GET | `/api/branches`, `/api/units` |

### 6.6 テンプレート・スケジュール・その他

| Method | パス |
|--------|------|
| GET/POST | `/api/templates`, `/api/schedules`, `/api/schedule-work-types` |
| GET/PUT/DELETE | `/api/templates/[id]`, `/api/schedules/[id]`, `/api/schedule-work-types/[id]` |
| GET | `/api/notifications` |
| POST | `/api/cron/auto-archive` |

---

## 7. データベーススキーマ

### 7.1 Enum一覧

```
UserRole:           ADMIN | STAFF | DEVELOPER
EstimateStatus:     DRAFT | CONFIRMED | SENT | OLD
EstimateType:       INITIAL | ADDITIONAL
AddressType:        COMPANY_CONTACT | COMPANY_ONLY
TemplateEstimateType: INITIAL | ADDITIONAL | BOTH
ContractStatus:     CONTRACTED | SCHEDULE_CREATED | IN_PROGRESS | COMPLETED | BILLED | PAID | CANCELLED
PaymentType:        FULL | TWO_PHASE | PROGRESS
InvoiceType:        FULL | ASSEMBLY | DISASSEMBLY | PROGRESS
InvoiceStatus:      DRAFT | SENT | PAID | PARTIAL_PAID
WorkType:           INHOUSE | SUBCONTRACT
OrderStatus:        NOT_ORDERED | ORDERED | COMPLETED
SubcontractorPaymentStatus: PENDING | SCHEDULED | PAID
NotificationType:   FOLLOW_UP
```

### 7.2 モデル関連図

```
Company ─1:N→ Branch ─1:N→ Project ─1:N→ Estimate ─1:N→ Section ─1:N→ Group ─1:N→ Item → Unit
Company ─1:N→ Contact ─N:1→ Project
                              └─1:N→ Contract ─1:N→ ContractWork → Subcontractor
                                            ├─1:N→ ConstructionSchedule
                                            ├─1:N→ Invoice ─1:N→ Payment
                                            └─1:N→ SubcontractorPayment → Subcontractor
Template ─1:N→ TemplateSection ─1:N→ TemplateGroup ─1:N→ TemplateItem → Unit
User ─1:N→ Estimate, SendLog, Notification, AuditLog
```

### 7.3 全モデル詳細

#### User
| フィールド | 型 | 制約 | 説明 |
|-----------|---|------|------|
| id | UUID | PK | |
| authId | String | UNIQUE | Supabase Auth UUID |
| name | String | | 表示名 |
| email | String | UNIQUE | |
| role | UserRole | default: STAFF | |
| isActive | Boolean | default: true | |
| createdAt/updatedAt | DateTime | auto | |

#### Company
| フィールド | 型 | 制約 | 説明 |
|-----------|---|------|------|
| id | UUID | PK | |
| name | String | UNIQUE | |
| furigana | String? | | ふりがな |
| alias | String? | | 通称 |
| phone | String? | | PDF用代表電話 |
| taxRate | Decimal(4,2) | default: 0.10 | 消費税率 |
| paymentClosingDay | Int? | | 締日（null=末日） |
| paymentMonthOffset | Int | default: 1 | 支払月（1=翌月） |
| paymentPayDay | Int? | | 支払日（null=末日） |
| paymentNetDays | Int? | | ネット日数（45日等） |
| isActive | Boolean | default: true | |

#### Branch
| フィールド | 型 | 制約 |
|-----------|---|------|
| id | UUID | PK |
| companyId | String | FK→companies |
| name | String | @@unique([companyId, name]) |
| isActive | Boolean | default: true |

#### Contact
| フィールド | 型 | 制約 |
|-----------|---|------|
| id | UUID | PK |
| companyId | String | FK→companies |
| name, phone, email | String | |
| isActive | Boolean | default: true |

#### Project
| フィールド | 型 | 制約 | 説明 |
|-----------|---|------|------|
| id | UUID | PK | |
| shortId | String | UNIQUE | 例: P-2603-001 |
| branchId | String | FK→branches | |
| contactId | String? | FK→contacts | |
| name | String | | 現場名 |
| address | String? | | |
| startDate/endDate | DateTime? | | |
| isArchived | Boolean | default: false | 失注フラグ |
| archiveNote | String? | | アーカイブ理由 |
| archivedAt | DateTime? | | |

#### Estimate
| フィールド | 型 | 制約 | 説明 |
|-----------|---|------|------|
| id | UUID | PK | |
| projectId | String | FK→projects | |
| userId | String | FK→users | 作成者 |
| estimateNumber | String? | | 確定時発行: YYMM-NNN |
| revision | Int | default: 1 | 改訂番号 |
| title | String? | | 見積タイトル |
| estimateType | EstimateType | default: INITIAL | 通常/追加 |
| status | EstimateStatus | default: DRAFT | |
| addressType | AddressType | default: COMPANY_CONTACT | |
| validDays | Int | default: 30 | 有効日数 |
| note | String? | | 特記事項 |
| discountAmount | Decimal(12,2)? | | 値引き |
| pdfUrl | String? | | PDF保存先 |
| confirmedAt/sentAt/followUpAt | DateTime? | | |
| isArchived | Boolean | default: false | |

#### EstimateSection → EstimateGroup → EstimateItem（3階層 CASCADE削除）
```
Section: { estimateId, name, sortOrder }
Group:   { sectionId, name, sortOrder }
Item:    { groupId, name, quantity: Decimal(10,2), unitId: FK→units, unitPrice: Decimal(12,2), sortOrder }
```

#### Contract
| フィールド | 型 | 説明 |
|-----------|---|------|
| id | UUID | PK |
| contractNumber | String? UNIQUE | C-YYMM-NNN |
| name | String? | 一括契約用名称 |
| projectId | String FK | |
| estimateId | String? UNIQUE FK | 単一契約（null=一括） |
| contractAmount | Decimal(12,2) | 税抜 |
| taxAmount | Decimal(12,2) | 消費税 |
| totalAmount | Decimal(12,2) | 税込 |
| discountAmount | Decimal(12,2) default: 0 | |
| adjustedAmount/adjustedTotal | Decimal(12,2)? | 調整後金額 |
| paymentType | PaymentType default: FULL | |
| contractDate | DateTime | 契約日 |
| startDate/endDate | DateTime? | 着工/完工予定 |
| paymentTerms | String? | 支払条件テキスト |
| status | ContractStatus default: CONTRACTED | |

#### ContractEstimate（一括契約用中間テーブル）
```
{ contractId FK, estimateId FK } @@unique([contractId, estimateId])
```

#### ContractWork
```
{ contractId FK, workType: WorkType, workerCount?, workDays?, subcontractorId? FK,
  orderAmount?, orderTaxAmount?, orderTotalAmount? Decimal(12,2),
  orderStatus: OrderStatus default: NOT_ORDERED, orderedAt?, note? }
```

#### ConstructionSchedule
```
{ contractId FK, workType: String, name?, plannedStartDate?, plannedEndDate?,
  actualStartDate?, actualEndDate?, workersCount?, notes? }
```

#### Invoice
```
{ contractId FK, invoiceNumber? UNIQUE, invoiceType: InvoiceType default: FULL,
  amount/taxAmount/totalAmount: Decimal(12,2), invoiceDate, dueDate?,
  status: InvoiceStatus default: DRAFT, paidAmount?, paidAt?, notes? }
CASCADE on delete
```

#### Payment
```
{ invoiceId FK, paymentDate, paymentAmount: Decimal(12,2),
  transferFee: default 0, discountAmount: default 0, notes? }
CASCADE on delete
```

#### Subcontractor
```
{ name, furigana?, representative?, address?, phone?, email?, bankInfo?, isActive }
```

#### SubcontractorPayment
```
{ contractId FK, subcontractorId FK, orderAmount/taxAmount/totalAmount: Decimal(12,2),
  closingDate?, paymentDueDate?, paymentDate?, paymentAmount?,
  status: SubcontractorPaymentStatus default: PENDING, notes? }
CASCADE on delete
```

#### Template / TemplateSection / TemplateGroup / TemplateItem
見積と同じ3階層構造。Item.quantity は Optional（テンプレでは数量未定可）。
```
Template: { name, description?, estimateType: TemplateEstimateType default: BOTH, isArchived }
Section:  { templateId FK, name, sortOrder } CASCADE
Group:    { sectionId FK, name, sortOrder } CASCADE
Item:     { groupId FK, name, quantity? Decimal(10,2), unitId FK, unitPrice Decimal(12,2), sortOrder } CASCADE
```

#### Unit（単位マスタ）
```
{ name: String UNIQUE, sortOrder, isActive }
値例: m, m2, 本, 一式, 式, 箇所, 台, 回, etc.
```

#### ScheduleWorkTypeMaster（工種マスタ）
```
{ code: String UNIQUE, label, shortLabel, colorIndex, sortOrder, isDefault, isActive }
値例: ASSEMBLY(組立), DISASSEMBLY(解体), REWORK(手直し), etc.
```

#### その他: SendLog, Notification, AuditLog, Tag, TemplateTag
```
SendLog:      { estimateId FK, userId FK, contactId? FK, sentAt, note? }
Notification: { userId FK, estimateId FK, type: NotificationType, message, isRead, scheduledAt, sentAt? }
AuditLog:     { userId FK, action, targetId?, detail: Json? }
Tag:          { name: String UNIQUE, isArchived }
TemplateTag:  { templateId FK, tagId FK } @@id([templateId, tagId])
```

---

## 8. 業務フロー

### 8.1 見積フロー

```
現場作成 → 見積作成 → 見積編集 → 見積確定 → 見積送付 → (改訂)
```

**見積作成の3つの入口:**
1. 商談一覧 → 三点メニュー →「一式見積りで作成」（ワンクリック）
2. 現場詳細 →「⚡ 一式で作成」ボタン
3. 新規見積作成ページ（/estimates/new）→ 3ステップ

**見積種別の自動判定（useEstimateCreateフック）:**
- 既存見積数 = 0 → INITIAL（通常見積）
- 既存見積数 > 0 → ADDITIONAL（追加見積）

### 8.2 契約フロー

```
見積確定 → 契約作成 → 工期スケジュール → 施工（自社/外注）→ 請求 → 入金
```

### 8.3 金額計算ルール

```
小計 = Σ(item.quantity × item.unitPrice)
税   = floor(小計 × company.taxRate)
合計 = 小計 + 税
```

---

## 9. 共通モジュール

### 9.1 useEstimateCreate フック（src/hooks/use-estimate-create.ts）

見積作成の全ロジックを一元管理。3画面から共通利用。

```typescript
export const ISSIKI_TEMPLATE_NAME = "足場工事一式"

export function useEstimateCreate({ templates, onCreated }: {
  templates: EstimateTemplate[]
  onCreated?: (estimateId: string) => void
}) {
  return {
    creating: boolean,                           // 作成中フラグ
    issikiTemplate: EstimateTemplate | null,      // 一式テンプレ
    getEstimateType(existingCount: number),       // INITIAL or ADDITIONAL
    getFilteredTemplates(type),                   // 種別フィルタ
    createEstimate({ projectId, templateId?, title?, estimateType?, note? }), // API呼出
    quickCreate(projectId, existingCount),        // ワンクリック一式作成
  }
}
// 使用: ProjectDetail.tsx, ProjectList.tsx, NewEstimateForm.tsx
```

### 9.2 ユーティリティ関数（src/lib/utils.ts）

```typescript
cn(...inputs)                    // Tailwind CSSクラス結合（clsx + twMerge）
formatDate(date, fmt?)           // 日本語日付 → "2026年03月07日"
formatRelativeDate(date)         // → { label: "今日"|"3日前"|"2週間前", absolute: "2026/03/07" }
formatCurrency(amount)           // → "1,234,567"
calcTax(subtotal, rate)          // → floor(subtotal × rate)
addBusinessDays(date, n)         // 営業日計算（土日除外）
calcFollowUpAt(sentAt)           // 営業日3日後17:00
formatEstimateNumber(date, seq)  // → "2603-001"
generateShortProjectId(date, seq)// → "P-2603-001"
formatCompanyPaymentTerms(params)// → "末締め 翌月末払い"
```

### 9.3 ステータス表示設定

```typescript
// 見積ステータス
const statusConfig = {
  DRAFT:     { label: "下書き", className: "bg-orange-100 text-orange-700" },
  CONFIRMED: { label: "確定",   className: "bg-blue-100 text-blue-700" },
  SENT:      { label: "送付済", className: "bg-green-100 text-green-700" },
  OLD:       { label: "旧版",   className: "bg-slate-100 text-slate-500" },
}
```

---

## 10. UI/UXパターン

### 10.1 レスポンシブ

- デスクトップ: サイドバー + `max-w-7xl mx-auto px-6 py-2`
- モバイル: ボトムナビ + フルスクリーン
- `useIsMobile()` フックでデバイス判定（md breakpoint）

### 10.2 共通UIコンポーネント（shadcn/ui）

```
Button, Input, Textarea, Label, Select, Checkbox
Card (CardContent, CardHeader)
Dialog (DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter)
DropdownMenu (DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger)
Table, Badge, Tabs, Tooltip, ScrollArea, Popover, Separator
Form (react-hook-form統合), Command (cmdk統合)
```

### 10.3 カラー

ブランド: blue-600 / 成功: green / 警告: orange / エラー: red / 背景: slate-50, white

---

## 11. 制約事項

### テレアポ管理システム統合制約
- **変更禁止**: .env.local のSupabase接続情報
- **Prismaスキーマ**: テーブル削除・リネーム禁止。新規追加は要相談
- **companies / contacts テーブル**: カラム削除・リネーム禁止（追加はOK）
- **将来追加予定**: tel_customers, tel_call_history, tel_settings, business_types

---

## 12. 変更履歴

### 2026-03-07 見積フロー改善
1. 「当初見積」→「通常見積」ラベル変更（全UI統一）
2. 「足場工事一式」テンプレート追加（ワンクリック簡易見積り用）
3. 見積作成モジュール化（`useEstimateCreate` フック新規作成）
4. クイック作成ボタン追加（商談一覧・現場詳細・新規見積作成の3画面）
5. フロースムーズ化（テンプレート自動選択、クリック数削減）

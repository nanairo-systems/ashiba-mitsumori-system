/**
 * [COMPONENT] マスター管理 - MasterManager
 *
 * 会社・支店・担当者・単位・タグをタブで切り替えて管理する。
 * 会社カード内から：編集ボタン・担当者追加ボタン
 * ふりがな登録 → ひらがなで検索可能
 */
"use client"

import { useState, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Building2,
  Users,
  Ruler,
  Tag,
  Plus,
  Loader2,
  Pencil,
  Search,
  Phone,
  Mail,
  UserPlus,
  ChevronDown,
  ChevronRight,
  CalendarClock,
  Truck,
  Layers,
  GripVertical,
  Trash2,
  HardHat,
  AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"
import { formatCompanyPaymentTerms } from "@/lib/utils"
import { COLOR_PALETTE } from "@/components/schedules/schedule-constants"
import { WorkerScheduleDialog } from "@/components/workers/WorkerScheduleDialog"
import { ItemMasterTab } from "@/components/masters/ItemMasterTab"

// ─── 法人種別 ───────────────────────────────────────────

/** 法人種別リスト（前株・後株どちらにも対応） */
const COMPANY_TYPE_OPTIONS = [
  { label: "株式会社",             value: "株式会社",             furigana: "かぶしきかいしゃ" },
  { label: "有限会社",             value: "有限会社",             furigana: "ゆうげんかいしゃ" },
  { label: "合同会社",             value: "合同会社",             furigana: "ごうどうかいしゃ" },
  { label: "合資会社",             value: "合資会社",             furigana: "ごうしかいしゃ" },
  { label: "合名会社",             value: "合名会社",             furigana: "ごうめいかいしゃ" },
  { label: "一般社団法人",         value: "一般社団法人",         furigana: "いっぱんしゃだんほうじん" },
  { label: "一般財団法人",         value: "一般財団法人",         furigana: "いっぱんざいだんほうじん" },
  { label: "社会福祉法人",         value: "社会福祉法人",         furigana: "しゃかいふくしほうじん" },
  { label: "特定非営利活動法人",   value: "特定非営利活動法人",   furigana: "とくていひえいりかつどうほうじん" },
  { label: "医療法人",             value: "医療法人",             furigana: "いりょうほうじん" },
  { label: "学校法人",             value: "学校法人",             furigana: "がっこうほうじん" },
  { label: "農業協同組合",         value: "農業協同組合",         furigana: "のうぎょうきょうどうくみあい" },
  { label: "生活協同組合",         value: "生活協同組合",         furigana: "せいかつきょうどうくみあい" },
  { label: "個人・屋号",           value: "",                     furigana: "" },
] as const

type TypePosition = "前" | "後"  // 前株（株式会社○○）or 後株（○○株式会社）

/** 既存の会社名から法人種別と本名を検出 */
function detectCompanyType(fullName: string): { typeValue: string; nameOnly: string; position: TypePosition } {
  for (const t of COMPANY_TYPE_OPTIONS) {
    if (!t.value) continue
    if (fullName.startsWith(t.value)) {
      return { typeValue: t.value, nameOnly: fullName.slice(t.value.length), position: "前" }
    }
    if (fullName.endsWith(t.value)) {
      return { typeValue: t.value, nameOnly: fullName.slice(0, -t.value.length), position: "後" }
    }
  }
  return { typeValue: "", nameOnly: fullName, position: "前" }
}

// ─── 型定義 ────────────────────────────────────────────

interface Contact {
  id: string
  name: string
  phone: string
  email: string
}

interface Company {
  id: string
  name: string
  furigana: string | null
  alias: string | null
  phone: string | null
  taxRate: number
  paymentClosingDay: number | null
  paymentMonthOffset: number
  paymentPayDay: number | null
  paymentNetDays: number | null
  branches: { id: string; name: string }[]
  contacts: Contact[]
}

interface Unit {
  id: string
  name: string
  sortOrder: number
}

interface TagItem {
  id: string
  name: string
}

interface SubcontractorItem {
  id: string
  name: string
  furigana: string | null
  representative: string | null
  address: string | null
  phone: string | null
  email: string | null
}

interface ScheduleWorkTypeItem {
  id: string
  code: string
  label: string
  shortLabel: string
  colorIndex: number
  sortOrder: number
  isDefault: boolean
  isActive: boolean
}

interface WorkerItem {
  id: string
  name: string
  furigana: string | null
  phone: string | null
  email: string | null
  workerType: string
  defaultRole: string
  subcontractorId: string | null
  isActive: boolean
  subcontractors: { id: string; name: string } | null
}

interface TeamItem {
  id: string
  name: string
  teamType: string
  leaderId: string | null
  subcontractorId: string | null
  colorCode: string | null
  sortOrder: number
  isActive: boolean
  workers: { id: string; name: string } | null
  subcontractors: { id: string; name: string } | null
}

interface VehicleItem {
  id: string
  name: string
  licensePlate: string
  vehicleType: string | null
  capacity: string | null
  inspectionDate: string | null
  isActive: boolean
}

interface ItemCategoryData {
  id: string
  name: string
  sortOrder: number
  items: {
    id: string
    categoryId: string
    name: string
    unitId: string
    unitPrice: number
    sortOrder: number
    unit: { id: string; name: string }
  }[]
}

interface TemplateListItem {
  id: string
  name: string
  description: string | null
}

interface Props {
  companies: Company[]
  units: Unit[]
  tags: TagItem[]
  subcontractors: SubcontractorItem[]
  scheduleWorkTypes: ScheduleWorkTypeItem[]
  workers: WorkerItem[]
  teams: TeamItem[]
  vehicles: VehicleItem[]
  itemCategories: ItemCategoryData[]
  templates: TemplateListItem[]
}

// ─── メインコンポーネント ───────────────────────────────

export function MasterManager({ companies, units, tags, subcontractors, scheduleWorkTypes, workers, teams, vehicles, itemCategories, templates }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  // 検索
  const [companySearch, setCompanySearch] = useState("")

  // 展開状態（会社カードの担当者エリア）
  const [expandedContacts, setExpandedContacts] = useState<Set<string>>(new Set())

  // ダイアログ種別
  type DialogType =
    | "createCompany"
    | "editCompany"
    | "createBranch"
    | "createContact"
    | "createUnit"
    | null
  const [dialogType, setDialogType] = useState<DialogType>(null)

  // 会社新規・編集フォーム
  const [editTarget, setEditTarget] = useState<Company | null>(null)
  const [companyType, setCompanyType] = useState("株式会社")   // 法人種別（空 = 個人・屋号）
  const [typePosition, setTypePosition] = useState<TypePosition>("前") // 前株 or 後株
  const [companyName, setCompanyName] = useState("")           // 種別を除いた名前部分
  const [companyFurigana, setCompanyFurigana] = useState("")
  const [companyPhone, setCompanyPhone] = useState("")
  // ふりがなを手動で変更したかどうか（手動変更後はIME自動入力を止める）
  const [furiganaManuallyEdited, setFuriganaManuallyEdited] = useState(false)
  // インラインバリデーションエラー
  const [companyErrors, setCompanyErrors] = useState<{ name?: string; furigana?: string; phone?: string }>({})
  // ふりがな自動入力用：確定済みひらがなを蓄積する ref
  const committedFuriganaRef = useRef("")
  const pendingHiraganaRef = useRef("")
  // ふりがな欄の IME 変換中フラグ（変換中はフィルターを止める）
  const furiganaComposingRef = useRef(false)

  // 支払条件フォーム
  // useNetDays=true → 日数払い, false → 月次指定
  const [useNetDays, setUseNetDays] = useState(false)
  const [paymentClosingDay, setPaymentClosingDay] = useState<string>("末")   // "末"|"10"|"15"|"20"|"25"
  const [paymentMonthOffset, setPaymentMonthOffset] = useState<string>("1") // "1"|"2"
  const [paymentPayDay, setPaymentPayDay] = useState<string>("末")           // "末"|"5"|"10"|"15"|"20"|"25"
  const [paymentNetDays, setPaymentNetDays] = useState<string>("45")        // "30"|"45"|"60"|"90" or free

  function resetPaymentFields(company?: Company | null) {
    if (company) {
      setUseNetDays(company.paymentNetDays != null)
      setPaymentClosingDay(company.paymentClosingDay == null ? "末" : String(company.paymentClosingDay))
      setPaymentMonthOffset(String(company.paymentMonthOffset ?? 1))
      setPaymentPayDay(company.paymentPayDay == null ? "末" : String(company.paymentPayDay))
      setPaymentNetDays(String(company.paymentNetDays ?? 45))
    } else {
      setUseNetDays(false)
      setPaymentClosingDay("末")
      setPaymentMonthOffset("1")
      setPaymentPayDay("末")
      setPaymentNetDays("45")
    }
  }

  function openCreateCompany() {
    setEditTarget(null)
    setCompanyType("株式会社")
    setTypePosition("前")
    setCompanyName("")
    setCompanyFurigana("")
    setCompanyPhone("")
    setFuriganaManuallyEdited(false)
    setCompanyErrors({})
    committedFuriganaRef.current = ""
    pendingHiraganaRef.current = ""
    resetPaymentFields(null)
    setDialogType("createCompany")
  }

  function openEditCompany(company: Company) {
    setEditTarget(company)
    const { typeValue, nameOnly, position } = detectCompanyType(company.name)
    setCompanyType(typeValue)
    setTypePosition(position)
    setCompanyName(nameOnly)
    setCompanyFurigana(company.furigana ?? "")
    setCompanyPhone(company.phone ?? "")
    setFuriganaManuallyEdited(!!(company.furigana))
    setCompanyErrors({})
    committedFuriganaRef.current = company.furigana ?? ""
    pendingHiraganaRef.current = ""
    resetPaymentFields(company)
    setDialogType("editCompany")
  }

  /** 法人種別 + 名前を結合してフルの会社名を返す */
  function getFullCompanyName(): string {
    const name = companyName.trim()
    if (!companyType) return name
    return typePosition === "前" ? `${companyType}${name}` : `${name}${companyType}`
  }

  /** 法人種別変更時: ふりがなは変更しない（名前部分のみを自動入力する方針） */
  function handleCompanyTypeChange(value: string) {
    setCompanyType(value)
    // 法人種別の読みはふりがなに含めない
  }

  /** ひらがな以外を除去するフィルター（カタカナ・漢字が混入しないようにする） */
  function toHiraganaOnly(text: string): string {
    // カタカナ → ひらがな変換
    const kata2hira = text.replace(/[\u30A1-\u30F6]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0x60)
    )
    // ひらがな・長音符・スペース以外を除去
    return kata2hira.replace(/[^\u3041-\u3096\u309D\u309E\u30FC\s]/g, "")
  }

  // IME変換中: ひらがな候補のみを pending に保存して表示
  // ※ 漢字候補が表示中（e.data が漢字）のときは furigana をそのまま保持する
  function handleNameCompositionUpdate(e: React.CompositionEvent<HTMLInputElement>) {
    if (!furiganaManuallyEdited) {
      const hira = toHiraganaOnly(e.data)
      if (hira) {
        // ひらがなが取れた → pending を更新して表示
        pendingHiraganaRef.current = hira
        setCompanyFurigana(committedFuriganaRef.current + hira)
      }
      // hira が空 = 漢字候補表示中 → pendingHiragana・furigana をそのまま保持（何もしない）
    }
  }

  // IME確定後: pending を committed に移して次の入力に備える
  function handleNameCompositionEnd() {
    if (!furiganaManuallyEdited) {
      committedFuriganaRef.current += pendingHiraganaRef.current
      pendingHiraganaRef.current = ""
    }
  }

  // 名前フィールドクリア時にふりがなも空にリセット
  function handleNameChange(value: string) {
    setCompanyName(value)
    if (companyErrors.name) setCompanyErrors((p) => ({ ...p, name: undefined }))
    if (!furiganaManuallyEdited && !value) {
      committedFuriganaRef.current = ""
      pendingHiraganaRef.current = ""
      setCompanyFurigana("")
    }
  }

  // 電話番号：数字とハイフンのみ許可 + blur 時に自動フォーマット
  function handlePhoneChange(value: string) {
    const cleaned = value.replace(/[^\d-]/g, "")
    setCompanyPhone(cleaned)
    if (cleaned && companyErrors.phone) setCompanyErrors((p) => ({ ...p, phone: undefined }))
  }

  function handlePhoneBlur() {
    if (!companyPhone.trim()) return
    const digits = companyPhone.replace(/\D/g, "")
    let formatted = companyPhone
    if (digits.length === 10) {
      if (/^(03|06|04|05)/.test(digits)) {
        formatted = `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`
      } else {
        formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
      }
    } else if (digits.length === 11) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
    }
    setCompanyPhone(formatted)
  }

  // ふりがな欄の onChange: IME 変換中は何もしない（変換を壊さないため）
  function handleFuriganaChange(value: string) {
    if (furiganaComposingRef.current) {
      // IME 変換中はそのまま表示（フィルター禁止）
      setCompanyFurigana(value)
      return
    }
    const hiraganaOnly = toHiraganaOnly(value)
    setCompanyFurigana(hiraganaOnly)
    setFuriganaManuallyEdited(true)
    committedFuriganaRef.current = hiraganaOnly
    if (companyErrors.furigana) setCompanyErrors((p) => ({ ...p, furigana: undefined }))
  }

  // ふりがな欄の IME 確定後: フィルターをかけて確定
  function handleFuriganaCompositionEnd(e: React.CompositionEvent<HTMLInputElement>) {
    furiganaComposingRef.current = false
    const hiraganaOnly = toHiraganaOnly(e.currentTarget.value)
    setCompanyFurigana(hiraganaOnly)
    setFuriganaManuallyEdited(true)
    committedFuriganaRef.current = hiraganaOnly
    if (companyErrors.furigana) setCompanyErrors((p) => ({ ...p, furigana: undefined }))
  }

  // バリデーション
  function validateCompanyForm(): boolean {
    const errors: { name?: string; furigana?: string; phone?: string } = {}
    if (!companyName.trim()) {
      errors.name = "会社名（法人種別以降の名前）は必須項目です"
    } else if (getFullCompanyName().length > 100) {
      errors.name = "会社名は100文字以内で入力してください"
    }
    if (companyFurigana.trim() && !/^[\u3041-\u3096\u309D\u309E\u30FC\s]+$/.test(companyFurigana.trim())) {
      errors.furigana = "ふりがなはひらがなのみ入力できます（例：かぶしきかいしゃ）"
    }
    if (companyPhone.trim()) {
      if (!/^0\d{1,4}-\d{1,4}-\d{4}$/.test(companyPhone.trim())) {
        errors.phone = "電話番号の形式が正しくありません（例：03-1234-5678 / 090-1234-5678）"
      }
    }
    setCompanyErrors(errors)
    return Object.keys(errors).length === 0
  }

  /** 支払条件フォームを Prisma 用の値に変換 */
  function buildPaymentPayload() {
    if (useNetDays) {
      const net = parseInt(paymentNetDays, 10)
      return {
        paymentClosingDay: paymentClosingDay === "末" ? null : parseInt(paymentClosingDay, 10),
        paymentMonthOffset: 1,
        paymentPayDay: null,
        paymentNetDays: isNaN(net) ? null : net,
      }
    }
    return {
      paymentClosingDay: paymentClosingDay === "末" ? null : parseInt(paymentClosingDay, 10),
      paymentMonthOffset: parseInt(paymentMonthOffset, 10) || 1,
      paymentPayDay: paymentPayDay === "末" ? null : parseInt(paymentPayDay, 10),
      paymentNetDays: null,
    }
  }

  async function handleSaveCompany(goToProject = false) {
    if (!validateCompanyForm()) return
    setLoading(true)
    try {
      const paymentPayload = buildPaymentPayload()

      const fullName = getFullCompanyName()

      if (dialogType === "createCompany") {
        const res = await fetch("/api/companies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: fullName,
            furigana: companyFurigana.trim() || null,
            phone: companyPhone.trim() || null,
            ...paymentPayload,
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          const msg = typeof data.error === "string" ? data.error : "登録に失敗しました"
          throw new Error(msg)
        }
        const created = await res.json()
        toast.success("会社を登録しました")
        setDialogType(null)
        if (goToProject) {
          router.push(`/projects/new?companyId=${created.id}`)
          return
        }
      } else if (dialogType === "editCompany" && editTarget) {
        const res = await fetch(`/api/companies/${editTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: fullName,
            furigana: companyFurigana.trim() || null,
            phone: companyPhone.trim() || null,
            ...paymentPayload,
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          const msg = typeof data.error === "string" ? data.error : "更新に失敗しました"
          throw new Error(msg)
        }
        toast.success("会社情報を更新しました")
        setDialogType(null)
      }
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "エラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  // 支店フォーム
  const [branchName, setBranchName] = useState("")
  const [branchCompanyId, setBranchCompanyId] = useState("")

  function openCreateBranch(companyId?: string) {
    setBranchName("")
    setBranchCompanyId(companyId ?? "")
    setDialogType("createBranch")
  }

  async function handleCreateBranch() {
    if (!branchName.trim() || !branchCompanyId) return
    setLoading(true)
    try {
      const res = await fetch("/api/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: branchName, companyId: branchCompanyId }),
      })
      if (!res.ok) throw new Error()
      toast.success("支店を登録しました")
      setDialogType(null)
      router.refresh()
    } catch {
      toast.error("登録に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  // 担当者フォーム
  const [contactCompanyId, setContactCompanyId] = useState("")
  const [contactName, setContactName] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [contactEmail, setContactEmail] = useState("")

  function openCreateContact(companyId: string) {
    setContactCompanyId(companyId)
    setContactName("")
    setContactPhone("")
    setContactEmail("")
    setDialogType("createContact")
  }

  async function handleCreateContact() {
    if (!contactName.trim()) {
      toast.error("担当者名を入力してください")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: contactCompanyId,
          name: contactName.trim(),
          phone: contactPhone.trim() || "",
          email: contactEmail.trim() || "",
        }),
      })
      if (!res.ok) throw new Error()
      toast.success("担当者を登録しました")
      setDialogType(null)
      router.refresh()
    } catch {
      toast.error("登録に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  // 単位フォーム
  const [unitName, setUnitName] = useState("")

  async function handleCreateUnit() {
    if (!unitName.trim()) return
    setLoading(true)
    try {
      const res = await fetch("/api/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: unitName }),
      })
      if (!res.ok) throw new Error()
      toast.success("単位を登録しました")
      setUnitName("")
      setDialogType(null)
      router.refresh()
    } catch {
      toast.error("登録に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  // 担当者エリアの展開トグル
  function toggleContacts(companyId: string) {
    setExpandedContacts((prev) => {
      const next = new Set(prev)
      if (next.has(companyId)) next.delete(companyId)
      else next.add(companyId)
      return next
    })
  }

  // 会社一覧（ふりがな・会社名で絞り込み）
  const filteredCompanies = useMemo(() => {
    const q = companySearch.trim().toLowerCase()
    if (!q) return companies
    return companies.filter((c) => {
      return (
        c.name.toLowerCase().includes(q) ||
        (c.furigana ?? "").toLowerCase().includes(q) ||
        (c.alias ?? "").toLowerCase().includes(q)
      )
    })
  }, [companies, companySearch])

  // 編集ダイアログのタイトル
  const dialogTitle =
    dialogType === "createCompany"
      ? "会社を新規登録"
      : dialogType === "editCompany"
      ? "会社情報を編集"
      : dialogType === "createBranch"
      ? "支店を追加"
      : dialogType === "createContact"
      ? "担当者を追加"
      : "単位を追加"

  return (
    <div className="space-y-6">
      <div className="relative">
        <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">MM-1</span>
        <h1 className="text-2xl font-bold text-slate-900 ml-7">マスター管理</h1>
        <p className="text-sm text-slate-500 mt-1">
          会社・支店・担当者・単位を管理します
        </p>
      </div>

      <Tabs defaultValue="companies">
        <TabsList className="relative">
          <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">MM-2</span>
          <TabsTrigger value="companies" className="gap-1.5 ml-7">
            <Building2 className="w-4 h-4" />
            会社・支店・担当者
          </TabsTrigger>
          <TabsTrigger value="units" className="gap-1.5">
            <Ruler className="w-4 h-4" />
            単位
          </TabsTrigger>
          <TabsTrigger value="tags" className="gap-1.5">
            <Tag className="w-4 h-4" />
            タグ
          </TabsTrigger>
          <TabsTrigger value="subcontractors" className="gap-1.5">
            <Truck className="w-4 h-4" />
            外注先
          </TabsTrigger>
          <TabsTrigger value="workTypes" className="gap-1.5">
            <Layers className="w-4 h-4" />
            工程種別
          </TabsTrigger>
          <TabsTrigger value="workers" className="gap-1.5">
            <HardHat className="w-4 h-4" />
            職人
          </TabsTrigger>
          <TabsTrigger value="teams" className="gap-1.5">
            <Users className="w-4 h-4" />
            班
          </TabsTrigger>
          <TabsTrigger value="vehicles" className="gap-1.5">
            <Truck className="w-4 h-4" />
            車両
          </TabsTrigger>
          <TabsTrigger value="itemMaster" className="gap-1.5">
            <Layers className="w-4 h-4" />
            項目マスタ
          </TabsTrigger>
        </TabsList>

        {/* ━━ 会社・支店・担当者タブ ━━━━━━━━━━━━━━━ */}
        <TabsContent value="companies" className="space-y-4 mt-4 relative">
          <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">MM-3</span>
          {/* 操作バー */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="会社名・ふりがなで検索"
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
            <Button size="sm" onClick={openCreateCompany}>
              <Plus className="w-4 h-4 mr-1" />
              会社を追加
            </Button>
            <Button size="sm" variant="outline" onClick={() => openCreateBranch()}>
              <Plus className="w-4 h-4 mr-1" />
              支店を追加
            </Button>
          </div>

          {filteredCompanies.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-slate-400">
                {companySearch
                  ? `「${companySearch}」に一致する会社がありません`
                  : "会社が登録されていません"}
              </CardContent>
            </Card>
          ) : (
            filteredCompanies.map((company) => {
              const isContactsOpen = expandedContacts.has(company.id)
              return (
                <Card key={company.id} className="overflow-hidden">
                  {/* 会社ヘッダー */}
                  <CardHeader className="pb-0 pt-4 px-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span className="font-bold text-slate-900 text-base">
                            {company.name}
                          </span>
                          {company.furigana && (
                            <span className="text-xs text-slate-400">
                              （{company.furigana}）
                            </span>
                          )}
                        </div>
                        {company.phone && (
                          <div className="flex items-center gap-1 mt-1 ml-6">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span className="text-xs text-slate-500">
                              {company.phone}
                            </span>
                          </div>
                        )}
                        {/* 支払条件（設定済みのみ表示） */}
                        {(company.paymentClosingDay != null || company.paymentNetDays != null || company.paymentPayDay != null || company.paymentMonthOffset !== 1) && (
                          <div className="flex items-center gap-1 mt-1 ml-6">
                            <CalendarClock className="w-3 h-3 text-slate-400" />
                            <span className="text-xs text-slate-500">
                              {formatCompanyPaymentTerms({
                                paymentClosingDay: company.paymentClosingDay,
                                paymentMonthOffset: company.paymentMonthOffset,
                                paymentPayDay: company.paymentPayDay,
                                paymentNetDays: company.paymentNetDays,
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditCompany(company)}
                        className="flex-shrink-0 h-8 gap-1 text-xs"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        編集
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="px-5 pb-4 pt-3 space-y-3">
                    {/* 支店 */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          支店
                        </p>
                        <button
                          onClick={() => openCreateBranch(company.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          追加
                        </button>
                      </div>
                      {company.branches.length === 0 ? (
                        <p className="text-sm text-slate-400">支店なし</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {company.branches.map((b) => (
                            <span
                              key={b.id}
                              className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs"
                            >
                              {b.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 担当者（折りたたみ） */}
                    <div>
                      <button
                        onClick={() => toggleContacts(company.id)}
                        className="flex items-center justify-between w-full mb-1.5"
                      >
                        <div className="flex items-center gap-1.5">
                          {isContactsOpen ? (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            担当者
                          </p>
                          <span className="text-xs text-slate-400">
                            {company.contacts.length} 名
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openCreateContact(company.id)
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <UserPlus className="w-3 h-3" />
                          担当者を追加
                        </button>
                      </button>

                      {isContactsOpen && (
                        <div className="space-y-1.5 pl-1">
                          {company.contacts.length === 0 ? (
                            <p className="text-sm text-slate-400 py-1">
                              担当者が登録されていません
                            </p>
                          ) : (
                            company.contacts.map((c) => (
                              <div
                                key={c.id}
                                className="flex items-center gap-3 py-2 px-3 rounded-lg bg-slate-50 border border-slate-100"
                              >
                                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                  <Users className="w-3.5 h-3.5 text-blue-600" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-slate-800">
                                    {c.name}
                                  </p>
                                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                    {c.phone && (
                                      <span className="flex items-center gap-1 text-xs text-slate-500">
                                        <Phone className="w-3 h-3" />
                                        {c.phone}
                                      </span>
                                    )}
                                    {c.email && (
                                      <span className="flex items-center gap-1 text-xs text-slate-500">
                                        <Mail className="w-3 h-3" />
                                        {c.email}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>

        {/* ━━ 単位タブ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <TabsContent value="units" className="space-y-4 mt-4 relative">
          <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">MM-4</span>
          <Button size="sm" onClick={() => setDialogType("createUnit")} className="ml-7">
            <Plus className="w-4 h-4 mr-1" />
            単位を追加
          </Button>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>単位名</TableHead>
                    <TableHead className="w-24">並び順</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {units.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-8 text-slate-400">
                        単位が登録されていません
                      </TableCell>
                    </TableRow>
                  ) : (
                    units.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell className="text-slate-500">{u.sortOrder}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ━━ タグタブ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <TabsContent value="tags" className="space-y-4 mt-4 relative">
          <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">MM-5</span>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>タグ名</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tags.length === 0 ? (
                    <TableRow>
                      <TableCell className="text-center py-8 text-slate-400">
                        タグが登録されていません
                      </TableCell>
                    </TableRow>
                  ) : (
                    tags.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ━━ 外注先タブ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <TabsContent value="subcontractors" className="space-y-4 mt-4 relative">
          <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">MM-6</span>
          <SubcontractorTab subcontractors={subcontractors} onRefresh={() => router.refresh()} />
        </TabsContent>

        {/* ━━ 工程種別タブ ━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <TabsContent value="workTypes" className="space-y-4 mt-4 relative">
          <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">MM-7</span>
          <WorkTypeTab workTypes={scheduleWorkTypes} onRefresh={() => router.refresh()} />
        </TabsContent>

        {/* ━━ 職人タブ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <TabsContent value="workers" className="space-y-4 mt-4 relative">
          <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">MM-8</span>
          <WorkerTab workers={workers} subcontractors={subcontractors} onRefresh={() => router.refresh()} />
        </TabsContent>

        {/* ━━ 班タブ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <TabsContent value="teams" className="space-y-4 mt-4 relative">
          <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">MM-9</span>
          <TeamTab teams={teams} workers={workers} subcontractors={subcontractors} onRefresh={() => router.refresh()} />
        </TabsContent>

        {/* ━━ 車両タブ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <TabsContent value="vehicles" className="space-y-4 mt-4 relative">
          <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">MM-10</span>
          <VehicleTab vehicles={vehicles} onRefresh={() => router.refresh()} />
        </TabsContent>

        {/* ━━ 項目マスタタブ ━━━━━━━━━━━━━━━━━━━━━━━ */}
        <TabsContent value="itemMaster" className="space-y-4 mt-4 relative">
          <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">MM-11</span>
          <ItemMasterTab
            categories={itemCategories}
            units={units.map((u) => ({ id: u.id, name: u.name }))}
            templates={templates}
            onRefresh={() => router.refresh()}
          />
        </TabsContent>
      </Tabs>

      {/* ━━ 会社 新規登録 / 編集ダイアログ ━━━━━━━━━━━━ */}
      <Dialog
        open={dialogType === "createCompany" || dialogType === "editCompany"}
        onOpenChange={(v) => { if (!v) setDialogType(null) }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* ── 法人種別 ── */}
            <div className="space-y-1.5">
              <Label>法人種別</Label>
              <select
                value={companyType}
                onChange={(e) => handleCompanyTypeChange(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-white"
              >
                {COMPANY_TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.value ? t.label : "個人・屋号（種別なし）"}
                  </option>
                ))}
              </select>
              {/* 前株・後株切り替え（種別がある場合のみ） */}
              {companyType && (
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs text-slate-500">位置：</span>
                  <div className="flex rounded-md border border-slate-200 overflow-hidden h-7">
                    <button
                      type="button"
                      onClick={() => setTypePosition("前")}
                      className={`px-3 text-xs font-medium transition-colors ${
                        typePosition === "前" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      前（{companyType}○○）
                    </button>
                    <button
                      type="button"
                      onClick={() => setTypePosition("後")}
                      className={`px-3 text-xs font-medium border-l border-slate-200 transition-colors ${
                        typePosition === "後" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      後（○○{companyType}）
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── 会社名（種別以降） ── */}
            <div className="space-y-1.5">
              <Label>
                {companyType
                  ? <>会社名（{companyType}以降） <span className="text-red-500">*</span></>
                  : <>屋号・氏名 <span className="text-red-500">*</span></>}
              </Label>
              <Input
                value={companyName}
                onChange={(e) => handleNameChange(e.target.value)}
                onCompositionUpdate={handleNameCompositionUpdate}
                onCompositionEnd={handleNameCompositionEnd}
                placeholder={companyType ? `例：○○建設` : "例：山田 太郎 / 山田電気工事"}
                className={companyErrors.name ? "border-red-400 focus-visible:ring-red-400" : ""}
              />
              {companyErrors.name && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <span>⚠</span>{companyErrors.name}
                </p>
              )}
              {/* フルネームプレビュー */}
              {companyName.trim() && (
                <div className="flex items-center gap-2 mt-1 px-3 py-1.5 bg-blue-50 rounded-md border border-blue-100">
                  <span className="text-xs text-blue-400">登録名：</span>
                  <span className="text-sm font-semibold text-blue-800">{getFullCompanyName()}</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>
                ふりがな
                <span className="text-xs text-slate-400 ml-2">
                  {furiganaManuallyEdited ? "（手動入力）" : "（会社名を入力すると自動で入ります）"}
                </span>
              </Label>
              <Input
                value={companyFurigana}
                onChange={(e) => handleFuriganaChange(e.target.value)}
                onCompositionStart={() => { furiganaComposingRef.current = true }}
                onCompositionEnd={handleFuriganaCompositionEnd}
                onFocus={() => {
                  if (companyFurigana) setFuriganaManuallyEdited(true)
                }}
                placeholder="例：やまだけんせつ"
                className={companyErrors.furigana ? "border-red-400 focus-visible:ring-red-400" : ""}
              />
              {companyErrors.furigana ? (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <span>⚠</span>{companyErrors.furigana}
                </p>
              ) : (
                <p className="text-xs text-slate-400">ひらがなのみ入力できます</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>代表電話番号</Label>
              <Input
                value={companyPhone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                onBlur={handlePhoneBlur}
                placeholder="03-1234-5678 または 090-1234-5678"
                inputMode="tel"
                className={companyErrors.phone ? "border-red-400 focus-visible:ring-red-400" : ""}
              />
              {companyErrors.phone ? (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <span>⚠</span>{companyErrors.phone}
                </p>
              ) : (
                <p className="text-xs text-slate-400">形式：03-1234-5678 / 090-1234-5678（数字とハイフンのみ）</p>
              )}
            </div>

            {/* 支払条件 */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <CalendarClock className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-semibold text-slate-700">支払条件</span>
              </div>

              {/* 締め日 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">締め日</Label>
                  <select
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                    value={paymentClosingDay}
                    onChange={(e) => setPaymentClosingDay(e.target.value)}
                  >
                    <option value="末">末日</option>
                    <option value="10">10日</option>
                    <option value="15">15日</option>
                    <option value="20">20日</option>
                    <option value="25">25日</option>
                  </select>
                </div>

                {/* 支払タイプ切り替え */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">支払方式</Label>
                  <div className="flex rounded-md border border-slate-200 overflow-hidden h-[38px]">
                    <button
                      type="button"
                      onClick={() => setUseNetDays(false)}
                      className={`flex-1 text-xs font-medium transition-colors ${
                        !useNetDays
                          ? "bg-blue-600 text-white"
                          : "bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      月次指定
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseNetDays(true)}
                      className={`flex-1 text-xs font-medium border-l border-slate-200 transition-colors ${
                        useNetDays
                          ? "bg-blue-600 text-white"
                          : "bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      日数払い
                    </button>
                  </div>
                </div>
              </div>

              {/* 月次指定 */}
              {!useNetDays && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">支払月</Label>
                    <select
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                      value={paymentMonthOffset}
                      onChange={(e) => setPaymentMonthOffset(e.target.value)}
                    >
                      <option value="1">翌月</option>
                      <option value="2">翌々月</option>
                      <option value="3">翌々々月（3ヶ月後）</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">支払日</Label>
                    <select
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                      value={paymentPayDay}
                      onChange={(e) => setPaymentPayDay(e.target.value)}
                    >
                      <option value="末">末日</option>
                      <option value="5">5日</option>
                      <option value="10">10日</option>
                      <option value="15">15日</option>
                      <option value="20">20日</option>
                      <option value="25">25日</option>
                    </select>
                  </div>
                </div>
              )}

              {/* 日数払い */}
              {useNetDays && (
                <div className="mt-3 space-y-1.5">
                  <Label className="text-xs text-slate-500">締め後○日払い</Label>
                  <div className="flex items-center gap-2">
                    <select
                      className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                      value={["30","45","60","90"].includes(paymentNetDays) ? paymentNetDays : "custom"}
                      onChange={(e) => {
                        if (e.target.value !== "custom") setPaymentNetDays(e.target.value)
                      }}
                    >
                      <option value="30">30日</option>
                      <option value="45">45日</option>
                      <option value="60">60日</option>
                      <option value="90">90日</option>
                      <option value="custom">その他</option>
                    </select>
                    <Input
                      type="number"
                      min={1}
                      value={paymentNetDays}
                      onChange={(e) => setPaymentNetDays(e.target.value)}
                      className="w-24 text-sm"
                    />
                    <span className="text-sm text-slate-500">日後</span>
                  </div>
                </div>
              )}

              {/* プレビュー */}
              <div className="mt-3 px-3 py-2 rounded-md bg-slate-50 border border-slate-200">
                <span className="text-xs text-slate-500">設定内容：</span>
                <span className="text-sm font-medium text-slate-800 ml-2">
                  {formatCompanyPaymentTerms({
                    paymentClosingDay: paymentClosingDay === "末" ? null : parseInt(paymentClosingDay, 10),
                    paymentMonthOffset: parseInt(paymentMonthOffset, 10) || 1,
                    paymentPayDay: paymentPayDay === "末" ? null : parseInt(paymentPayDay, 10),
                    paymentNetDays: useNetDays ? (parseInt(paymentNetDays, 10) || null) : null,
                  })}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDialogType(null)} className="sm:mr-auto">
              キャンセル
            </Button>
            {dialogType === "createCompany" ? (
              <>
                <Button variant="outline" onClick={() => handleSaveCompany(false)} disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  登録する
                </Button>
                <Button onClick={() => handleSaveCompany(true)} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  登録して商談を作成
                </Button>
              </>
            ) : (
              <Button onClick={() => handleSaveCompany(false)} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                更新する
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ━━ 支店追加ダイアログ ━━━━━━━━━━━━━━━━━━━━ */}
      <Dialog
        open={dialogType === "createBranch"}
        onOpenChange={(v) => { if (!v) setDialogType(null) }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>支店を追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                会社 <span className="text-red-500">*</span>
              </Label>
              <select
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                value={branchCompanyId}
                onChange={(e) => setBranchCompanyId(e.target.value)}
              >
                <option value="">会社を選択</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>
                支店名 <span className="text-red-500">*</span>
              </Label>
              <Input
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="例：東京支店"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>
              キャンセル
            </Button>
            <Button onClick={handleCreateBranch} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              追加する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ━━ 担当者追加ダイアログ ━━━━━━━━━━━━━━━━━━ */}
      <Dialog
        open={dialogType === "createContact"}
        onOpenChange={(v) => { if (!v) setDialogType(null) }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              担当者を追加
              {contactCompanyId && (
                <span className="text-sm font-normal text-slate-500 ml-2">
                  — {companies.find((c) => c.id === contactCompanyId)?.name}
                </span>
              )}
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-1">
              代表者（社長など）の氏名を登録しておくと、見積作成時に自動で選択されます。
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                氏名（代表者・担当者） <span className="text-red-500">*</span>
              </Label>
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="例：山田 太郎（代表取締役）"
              />
            </div>
            <div className="space-y-2">
              <Label>電話番号（任意）</Label>
              <Input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="090-0000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label>メールアドレス（任意）</Label>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="example@company.co.jp"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>
              キャンセル
            </Button>
            <Button onClick={handleCreateContact} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              追加する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ━━ 単位追加ダイアログ ━━━━━━━━━━━━━━━━━━━━ */}
      <Dialog
        open={dialogType === "createUnit"}
        onOpenChange={(v) => { if (!v) setDialogType(null) }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>単位を追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                単位名 <span className="text-red-500">*</span>
              </Label>
              <Input
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                placeholder="例：m², 式, 本"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>
              キャンセル
            </Button>
            <Button onClick={handleCreateUnit} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              追加する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── 外注先管理サブコンポーネント ──────────────────────────

function SubcontractorTab({ subcontractors, onRefresh }: {
  subcontractors: SubcontractorItem[]; onRefresh: () => void
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SubcontractorItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [furigana, setFurigana] = useState("")
  const [representative, setRepresentative] = useState("")
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")

  function openCreate() {
    setEditing(null)
    setName(""); setFurigana(""); setRepresentative(""); setAddress(""); setPhone(""); setEmail("")
    setOpen(true)
  }

  function openEdit(s: SubcontractorItem) {
    setEditing(s)
    setName(s.name)
    setFurigana(s.furigana ?? "")
    setRepresentative(s.representative ?? "")
    setAddress(s.address ?? "")
    setPhone(s.phone ?? "")
    setEmail(s.email ?? "")
    setOpen(true)
  }

  async function handleSave() {
    if (!name.trim()) { toast.error("会社名は必須です"); return }
    setSaving(true)
    try {
      const body = {
        name: name.trim(),
        furigana: furigana.trim() || null,
        representative: representative.trim() || null,
        address: address.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
      }
      const url = editing ? `/api/subcontractors/${editing.id}` : "/api/subcontractors"
      const method = editing ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || "保存に失敗しました")
      }
      toast.success(editing ? "更新しました" : "登録しました")
      setOpen(false)
      onRefresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "エラーが発生しました")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">外注先（下請け業者）の登録・管理</p>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          外注先を追加
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>会社名</TableHead>
                <TableHead>代表者</TableHead>
                <TableHead>住所</TableHead>
                <TableHead>電話番号</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {subcontractors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                    外注先が登録されていません
                  </TableCell>
                </TableRow>
              ) : (
                subcontractors.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{s.name}</span>
                        {s.furigana && <span className="text-xs text-slate-400 ml-2">({s.furigana})</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600">{s.representative ?? "—"}</TableCell>
                    <TableCell className="text-slate-600 text-sm max-w-[200px] truncate">{s.address ?? "—"}</TableCell>
                    <TableCell className="text-slate-600">{s.phone ?? "—"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(s)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "外注先を編集" : "外注先を追加"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>会社名 <span className="text-red-500">*</span></Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 山田建設" />
            </div>
            <div className="space-y-1.5">
              <Label>ふりがな</Label>
              <Input value={furigana} onChange={(e) => setFurigana(e.target.value)} placeholder="例: やまだけんせつ" />
            </div>
            <div className="space-y-1.5">
              <Label>代表者名</Label>
              <Input value={representative} onChange={(e) => setRepresentative(e.target.value)} placeholder="例: 山田太郎" />
            </div>
            <div className="space-y-1.5">
              <Label>住所</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="例: 東京都新宿区1-1-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>電話番号</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="例: 03-1234-5678" />
              </div>
              <div className="space-y-1.5">
                <Label>メール</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="例: info@example.com" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>キャンセル</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />保存中...</> : editing ? "更新する" : "登録する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── 工程種別管理サブコンポーネント ──────────────────────────

const COLOR_LABELS = ["青", "琥珀", "灰", "緑", "紫", "赤", "水色", "桃", "橙", "青緑"]

function WorkTypeTab({ workTypes, onRefresh }: {
  workTypes: ScheduleWorkTypeItem[]; onRefresh: () => void
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ScheduleWorkTypeItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [label, setLabel] = useState("")
  const [shortLabel, setShortLabel] = useState("")
  const [colorIndex, setColorIndex] = useState(0)

  function openCreate() {
    setEditing(null)
    setLabel(""); setShortLabel(""); setColorIndex(workTypes.length % COLOR_PALETTE.length)
    setOpen(true)
  }

  function openEdit(wt: ScheduleWorkTypeItem) {
    setEditing(wt)
    setLabel(wt.label)
    setShortLabel(wt.shortLabel)
    setColorIndex(wt.colorIndex)
    setOpen(true)
  }

  async function handleSave() {
    if (!label.trim()) { toast.error("表示名は必須です"); return }
    if (!shortLabel.trim()) { toast.error("略称は必須です"); return }
    setSaving(true)
    try {
      if (editing) {
        const res = await fetch(`/api/schedule-work-types/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: label.trim(),
            shortLabel: shortLabel.trim(),
            colorIndex,
          }),
        })
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "更新に失敗しました")
        toast.success("更新しました")
      } else {
        const res = await fetch("/api/schedule-work-types", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: label.trim(),
            shortLabel: shortLabel.trim(),
            colorIndex,
          }),
        })
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "登録に失敗しました")
        toast.success("登録しました")
      }
      setOpen(false)
      onRefresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "エラーが発生しました")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(wt: ScheduleWorkTypeItem) {
    if (wt.isDefault) { toast.error("デフォルト工種は削除できません"); return }
    if (!confirm(`「${wt.label}」を削除しますか？`)) return
    try {
      const res = await fetch(`/api/schedule-work-types/${wt.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "削除に失敗しました")
      toast.success("削除しました")
      onRefresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "エラーが発生しました")
    }
  }

  // アクティブなもの + 非アクティブなものを分ける
  const activeTypes = workTypes.filter((wt) => wt.isActive)
  const inactiveTypes = workTypes.filter((wt) => !wt.isActive)

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          ガントチャートの工程種別を管理します。最初の2つは Ctrl / Shift ショートカットに対応します。
        </p>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          工程種別を追加
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">順序</TableHead>
                <TableHead>表示名</TableHead>
                <TableHead className="w-[80px]">略称</TableHead>
                <TableHead className="w-[120px]">色</TableHead>
                <TableHead className="w-[100px]">ショートカット</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeTypes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                    工程種別が登録されていません
                  </TableCell>
                </TableRow>
              ) : (
                activeTypes.map((wt, idx) => {
                  const palette = COLOR_PALETTE[wt.colorIndex % COLOR_PALETTE.length]
                  return (
                    <TableRow key={wt.id}>
                      <TableCell>
                        <div className="flex items-center gap-1 text-slate-400">
                          <GripVertical className="w-3.5 h-3.5" />
                          <span className="text-sm">{wt.sortOrder}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-sm ${palette?.actual ?? "bg-gray-500"}`} />
                          <span className="font-medium">{wt.label}</span>
                          {wt.isDefault && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">デフォルト</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600">{wt.shortLabel}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-5 h-5 rounded ${palette?.planned ?? "bg-gray-200"} border ${palette?.border ?? "border-gray-300"}`} />
                          <span className="text-xs text-slate-500">{COLOR_LABELS[wt.colorIndex % COLOR_LABELS.length]}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {idx === 0 && (
                          <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">Ctrl</span>
                        )}
                        {idx === 1 && (
                          <span className="text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-600 font-medium">Shift</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(wt)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          {!wt.isDefault && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(wt)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {inactiveTypes.length > 0 && (
        <div className="text-xs text-slate-400 mt-2">
          非アクティブ: {inactiveTypes.map((wt) => wt.label).join("、")}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "工程種別を編集" : "工程種別を追加"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>表示名 <span className="text-red-500">*</span></Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="例: 塗装" />
            </div>
            <div className="space-y-1.5">
              <Label>略称 <span className="text-red-500">*</span></Label>
              <Input value={shortLabel} onChange={(e) => setShortLabel(e.target.value)} placeholder="例: 塗" maxLength={4} />
              <p className="text-xs text-slate-400">ガントチャートのバーに表示される短い名前（1〜4文字）</p>
            </div>
            <div className="space-y-1.5">
              <Label>色</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PALETTE.map((palette, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setColorIndex(idx)}
                    className={`w-8 h-8 rounded-md border-2 transition-all ${palette.actual} ${
                      colorIndex === idx
                        ? "border-slate-800 ring-2 ring-slate-300 scale-110"
                        : "border-transparent hover:border-slate-300"
                    }`}
                    title={COLOR_LABELS[idx]}
                  />
                ))}
              </div>
              <p className="text-xs text-slate-400">選択中: {COLOR_LABELS[colorIndex % COLOR_LABELS.length]}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>キャンセル</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />保存中...</> : editing ? "更新する" : "登録する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── 職人管理サブコンポーネント ──────────────────────────────

const WORKER_TYPE_OPTIONS = [
  { value: "EMPLOYEE", label: "社員", className: "bg-blue-100 text-blue-700" },
  { value: "INDEPENDENT", label: "一人親方", className: "bg-orange-100 text-orange-700" },
]
const WORKER_ROLE_OPTIONS = [
  { value: "FOREMAN", label: "職長", className: "bg-red-100 text-red-700" },
  { value: "WORKER", label: "職人", className: "bg-slate-100 text-slate-600" },
]

function WorkerTab({ workers, subcontractors, onRefresh }: {
  workers: WorkerItem[]; subcontractors: SubcontractorItem[]; onRefresh: () => void
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<WorkerItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [furigana, setFurigana] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [workerType, setWorkerType] = useState("EMPLOYEE")
  const [defaultRole, setDefaultRole] = useState("WORKER")
  const [subcontractorId, setSubcontractorId] = useState("")
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const [scheduleWorker, setScheduleWorker] = useState<{ id: string; name: string } | null>(null)

  function openCreate() {
    setEditing(null)
    setName(""); setFurigana(""); setPhone(""); setEmail("")
    setWorkerType("EMPLOYEE"); setDefaultRole("WORKER"); setSubcontractorId("")
    setOpen(true)
  }

  function openEdit(w: WorkerItem) {
    setEditing(w)
    setName(w.name); setFurigana(w.furigana ?? ""); setPhone(w.phone ?? ""); setEmail(w.email ?? "")
    setWorkerType(w.workerType); setDefaultRole(w.defaultRole); setSubcontractorId(w.subcontractorId ?? "")
    setOpen(true)
  }

  async function handleSave() {
    if (!name.trim()) { toast.error("名前は必須です"); return }
    setSaving(true)
    try {
      const body = {
        name: name.trim(),
        furigana: furigana.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        workerType,
        defaultRole,
        subcontractorId: subcontractorId || null,
      }
      const url = editing ? `/api/workers/${editing.id}` : "/api/workers"
      const method = editing ? "PUT" : "POST"
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || "保存に失敗しました")
      }
      toast.success(editing ? "更新しました" : "登録しました")
      setOpen(false)
      onRefresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "エラーが発生しました")
    } finally { setSaving(false) }
  }

  async function toggleActive(w: WorkerItem) {
    try {
      const res = await fetch(`/api/workers/${w.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !w.isActive }),
      })
      if (!res.ok) throw new Error()
      toast.success(w.isActive ? "無効にしました" : "有効にしました")
      onRefresh()
    } catch { toast.error("更新に失敗しました") }
  }

  const typeBadge = (t: string) => WORKER_TYPE_OPTIONS.find((o) => o.value === t) ?? { label: t, className: "bg-slate-100 text-slate-600" }
  const roleBadge = (r: string) => WORKER_ROLE_OPTIONS.find((o) => o.value === r) ?? { label: r, className: "bg-slate-100 text-slate-600" }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">職人（作業員）の登録・管理</p>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          職人を追加
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名前</TableHead>
                <TableHead>電話番号</TableHead>
                <TableHead>種別</TableHead>
                <TableHead>役割</TableHead>
                <TableHead>所属外注先</TableHead>
                <TableHead>状態</TableHead>
                <TableHead className="w-[80px] text-center">スケジュール</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {workers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                    職人が登録されていません
                  </TableCell>
                </TableRow>
              ) : (
                workers.map((w) => {
                  const tb = typeBadge(w.workerType)
                  const rb = roleBadge(w.defaultRole)
                  return (
                    <TableRow key={w.id} className={!w.isActive ? "opacity-50" : undefined}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{w.name}</span>
                          {w.furigana && <span className="text-xs text-slate-400 ml-2">({w.furigana})</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600">{w.phone ?? "—"}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${tb.className}`}>{tb.label}</span>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${rb.className}`}>{rb.label}</span>
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">{w.subcontractors?.name ?? "—"}</TableCell>
                      <TableCell>
                        <button
                          onClick={() => toggleActive(w)}
                          className={`text-xs px-2 py-0.5 rounded font-medium transition-colors ${
                            w.isActive ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}
                        >
                          {w.isActive ? "有効" : "無効"}
                        </button>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 text-slate-500 hover:text-blue-600"
                          onClick={() => { setScheduleWorker({ id: w.id, name: w.name }); setScheduleDialogOpen(true) }}
                        >
                          <CalendarClock className="w-3.5 h-3.5" />
                          確認
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(w)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "職人を編集" : "職人を追加"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>名前 <span className="text-red-500">*</span></Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 田中太郎" />
            </div>
            <div className="space-y-1.5">
              <Label>フリガナ</Label>
              <Input value={furigana} onChange={(e) => setFurigana(e.target.value)} placeholder="例: たなかたろう" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>電話番号</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="例: 090-1234-5678" />
              </div>
              <div className="space-y-1.5">
                <Label>メール</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="例: tanaka@example.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>種別 <span className="text-red-500">*</span></Label>
                <select
                  value={workerType}
                  onChange={(e) => setWorkerType(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-white"
                >
                  {WORKER_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>デフォルト役割 <span className="text-red-500">*</span></Label>
                <select
                  value={defaultRole}
                  onChange={(e) => setDefaultRole(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-white"
                >
                  {WORKER_ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>所属外注先</Label>
              <select
                value={subcontractorId}
                onChange={(e) => setSubcontractorId(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-white"
              >
                <option value="">なし</option>
                {subcontractors.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>キャンセル</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />保存中...</> : editing ? "更新する" : "登録する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 職人別スケジュール確認ダイアログ */}
      {scheduleWorker && (
        <WorkerScheduleDialog
          open={scheduleDialogOpen}
          onClose={() => setScheduleDialogOpen(false)}
          workerId={scheduleWorker.id}
          workerName={scheduleWorker.name}
        />
      )}
    </>
  )
}

// ─── 班管理サブコンポーネント ────────────────────────────────

const TEAM_COLORS = [
  { value: "#3B82F6", label: "青" },
  { value: "#10B981", label: "緑" },
  { value: "#F59E0B", label: "黄" },
  { value: "#EF4444", label: "赤" },
  { value: "#8B5CF6", label: "紫" },
  { value: "#F97316", label: "オレンジ" },
  { value: "#06B6D4", label: "水色" },
  { value: "#6B7280", label: "グレー" },
]

function TeamTab({ teams, workers, subcontractors, onRefresh }: {
  teams: TeamItem[]; workers: WorkerItem[]; subcontractors: SubcontractorItem[]; onRefresh: () => void
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<TeamItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [teamType, setTeamType] = useState("INDIVIDUAL")
  const [leaderId, setLeaderId] = useState("")
  const [subcontractorId, setSubcontractorId] = useState("")
  const [colorCode, setColorCode] = useState("#3B82F6")
  const [sortOrder, setSortOrder] = useState("0")

  const activeWorkers = workers.filter((w) => w.isActive)

  function openCreate() {
    setEditing(null)
    setName(""); setTeamType("INDIVIDUAL"); setLeaderId(""); setSubcontractorId("")
    setColorCode("#3B82F6"); setSortOrder(String(teams.length))
    setOpen(true)
  }

  function openEdit(t: TeamItem) {
    setEditing(t)
    setName(t.name); setTeamType(t.teamType); setLeaderId(t.leaderId ?? "")
    setSubcontractorId(t.subcontractorId ?? ""); setColorCode(t.colorCode ?? "#3B82F6")
    setSortOrder(String(t.sortOrder))
    setOpen(true)
  }

  async function handleSave() {
    if (!name.trim()) { toast.error("班名は必須です"); return }
    setSaving(true)
    try {
      const body = {
        name: name.trim(),
        teamType,
        leaderId: teamType === "INDIVIDUAL" && leaderId ? leaderId : null,
        subcontractorId: teamType === "COMPANY" && subcontractorId ? subcontractorId : null,
        colorCode,
        sortOrder: parseInt(sortOrder, 10) || 0,
      }
      const url = editing ? `/api/teams/${editing.id}` : "/api/teams"
      const method = editing ? "PUT" : "POST"
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || "保存に失敗しました")
      }
      toast.success(editing ? "更新しました" : "登録しました")
      setOpen(false)
      onRefresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "エラーが発生しました")
    } finally { setSaving(false) }
  }

  async function toggleActive(t: TeamItem) {
    try {
      const res = await fetch(`/api/teams/${t.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !t.isActive }),
      })
      if (!res.ok) throw new Error()
      toast.success(t.isActive ? "無効にしました" : "有効にしました")
      onRefresh()
    } catch { toast.error("更新に失敗しました") }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">班（チーム）の登録・管理</p>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          班を追加
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>カラー</TableHead>
                <TableHead>班名</TableHead>
                <TableHead>種別</TableHead>
                <TableHead>班長 / 外注先</TableHead>
                <TableHead>表示順</TableHead>
                <TableHead>状態</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                    班が登録されていません
                  </TableCell>
                </TableRow>
              ) : (
                teams.map((t) => (
                  <TableRow key={t.id} className={!t.isActive ? "opacity-50" : undefined}>
                    <TableCell>
                      <div className="w-5 h-5 rounded-full border border-slate-200" style={{ backgroundColor: t.colorCode ?? "#6B7280" }} />
                    </TableCell>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        t.teamType === "INDIVIDUAL" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                      }`}>
                        {t.teamType === "INDIVIDUAL" ? "個人班" : "会社班"}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm">
                      {t.teamType === "INDIVIDUAL"
                        ? (t.workers?.name ?? "—")
                        : (t.subcontractors?.name ?? "—")}
                    </TableCell>
                    <TableCell className="text-slate-600">{t.sortOrder}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => toggleActive(t)}
                        className={`text-xs px-2 py-0.5 rounded font-medium transition-colors ${
                          t.isActive ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                      >
                        {t.isActive ? "有効" : "無効"}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(t)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "班を編集" : "班を追加"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>班名 <span className="text-red-500">*</span></Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 1班" />
            </div>
            <div className="space-y-1.5">
              <Label>種別 <span className="text-red-500">*</span></Label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="teamType" value="INDIVIDUAL" checked={teamType === "INDIVIDUAL"} onChange={() => setTeamType("INDIVIDUAL")} className="text-blue-600" />
                  <span className="text-sm">個人班</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="teamType" value="COMPANY" checked={teamType === "COMPANY"} onChange={() => setTeamType("COMPANY")} className="text-blue-600" />
                  <span className="text-sm">会社班</span>
                </label>
              </div>
            </div>
            {teamType === "INDIVIDUAL" && (
              <div className="space-y-1.5">
                <Label>班長</Label>
                <select
                  value={leaderId}
                  onChange={(e) => setLeaderId(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-white"
                >
                  <option value="">選択してください</option>
                  {activeWorkers.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            )}
            {teamType === "COMPANY" && (
              <div className="space-y-1.5">
                <Label>外注先</Label>
                <select
                  value={subcontractorId}
                  onChange={(e) => setSubcontractorId(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-white"
                >
                  <option value="">選択してください</option>
                  {subcontractors.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>カラー</Label>
              <div className="flex flex-wrap gap-2">
                {TEAM_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColorCode(c.value)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      colorCode === c.value
                        ? "border-slate-800 ring-2 ring-slate-300 scale-110"
                        : "border-transparent hover:border-slate-300"
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>表示順</Label>
              <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} placeholder="0" className="w-24" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>キャンセル</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />保存中...</> : editing ? "更新する" : "登録する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── 車両管理サブコンポーネント ──────────────────────────────

function getInspectionStatus(date: string | null): { label: string; className: string; icon: boolean } | null {
  if (!date) return null
  const now = new Date()
  const inspection = new Date(date)
  const diff = Math.ceil((inspection.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return { label: "期限切れ", className: "text-red-600 font-semibold", icon: true }
  if (diff <= 30) return { label: `残${diff}日`, className: "text-red-600 font-semibold", icon: true }
  if (diff <= 60) return { label: `残${diff}日`, className: "text-orange-500 font-medium", icon: false }
  return null
}

function VehicleTab({ vehicles, onRefresh }: {
  vehicles: VehicleItem[]; onRefresh: () => void
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<VehicleItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [licensePlate, setLicensePlate] = useState("")
  const [vehicleType, setVehicleType] = useState("")
  const [capacity, setCapacity] = useState("")
  const [inspectionDate, setInspectionDate] = useState("")

  function openCreate() {
    setEditing(null)
    setName(""); setLicensePlate(""); setVehicleType(""); setCapacity(""); setInspectionDate("")
    setOpen(true)
  }

  function openEdit(v: VehicleItem) {
    setEditing(v)
    setName(v.name); setLicensePlate(v.licensePlate); setVehicleType(v.vehicleType ?? "")
    setCapacity(v.capacity ?? ""); setInspectionDate(v.inspectionDate ? v.inspectionDate.slice(0, 10) : "")
    setOpen(true)
  }

  async function handleSave() {
    if (!name.trim()) { toast.error("車両名は必須です"); return }
    if (!licensePlate.trim()) { toast.error("ナンバープレートは必須です"); return }
    setSaving(true)
    try {
      const body = {
        name: name.trim(),
        licensePlate: licensePlate.trim(),
        vehicleType: vehicleType.trim() || null,
        capacity: capacity.trim() || null,
        inspectionDate: inspectionDate || null,
      }
      const url = editing ? `/api/vehicles/${editing.id}` : "/api/vehicles"
      const method = editing ? "PUT" : "POST"
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || "保存に失敗しました")
      }
      toast.success(editing ? "更新しました" : "登録しました")
      setOpen(false)
      onRefresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "エラーが発生しました")
    } finally { setSaving(false) }
  }

  async function toggleActive(v: VehicleItem) {
    try {
      const res = await fetch(`/api/vehicles/${v.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !v.isActive }),
      })
      if (!res.ok) throw new Error()
      toast.success(v.isActive ? "無効にしました" : "有効にしました")
      onRefresh()
    } catch { toast.error("更新に失敗しました") }
  }

  function formatDate(d: string | null) {
    if (!d) return "—"
    return new Date(d).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" })
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">車両の登録・管理</p>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          車両を追加
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>車両名</TableHead>
                <TableHead>ナンバー</TableHead>
                <TableHead>車種</TableHead>
                <TableHead>積載量</TableHead>
                <TableHead>車検期限</TableHead>
                <TableHead>状態</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                    車両が登録されていません
                  </TableCell>
                </TableRow>
              ) : (
                vehicles.map((v) => {
                  const inspStatus = getInspectionStatus(v.inspectionDate)
                  return (
                    <TableRow key={v.id} className={!v.isActive ? "opacity-50" : undefined}>
                      <TableCell className="font-medium">{v.name}</TableCell>
                      <TableCell className="text-slate-600">{v.licensePlate}</TableCell>
                      <TableCell className="text-slate-600">{v.vehicleType ?? "—"}</TableCell>
                      <TableCell className="text-slate-600">{v.capacity ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className={inspStatus?.className ?? "text-slate-600"}>
                            {formatDate(v.inspectionDate)}
                          </span>
                          {inspStatus?.icon && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                          {inspStatus && (
                            <span className={`text-xs ${inspStatus.className}`}>({inspStatus.label})</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => toggleActive(v)}
                          className={`text-xs px-2 py-0.5 rounded font-medium transition-colors ${
                            v.isActive ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}
                        >
                          {v.isActive ? "有効" : "無効"}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(v)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "車両を編集" : "車両を追加"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>車両名 <span className="text-red-500">*</span></Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 2tトラック" />
            </div>
            <div className="space-y-1.5">
              <Label>ナンバープレート <span className="text-red-500">*</span></Label>
              <Input value={licensePlate} onChange={(e) => setLicensePlate(e.target.value)} placeholder="例: 品川 300 あ 12-34" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>車種</Label>
                <Input value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} placeholder="例: トラック" />
              </div>
              <div className="space-y-1.5">
                <Label>積載量</Label>
                <Input value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="例: 2t" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>車検期限</Label>
              <Input type="date" value={inspectionDate} onChange={(e) => setInspectionDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>キャンセル</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />保存中...</> : editing ? "更新する" : "登録する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

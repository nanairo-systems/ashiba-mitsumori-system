/**
 * [COMPONENT] 商談一覧 - ProjectList
 *
 * 会社ごとにグループ化して現場を表示する。
 * 1現場につき複数見積に対応。現場をヘッダー行とし、見積をサブ行で表示する。
 *
 * 状況表示ルール:
 *   見積サブ行 → 各見積の状況
 *   現場ヘッダー → 合計金額 + 見積件数バッジ
 *
 * ビュー描画は ProjectListMobile / ProjectListDesktop に委譲。
 */
"use client"

import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { formatCompanyPaymentTerms } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2 as LoaderIcon, CalendarClock, Trash2, EyeOff } from "lucide-react"
import { useEstimateCreate, type EstimateTemplate } from "@/hooks/use-estimate-create"
import { EstimateDetail } from "@/components/estimates/EstimateDetail"
import { useIsMobile } from "@/hooks/use-mobile"
import { ContractProcessingDialog } from "@/components/contracts/ContractProcessingDialog"
import type { ContractEstimateItem } from "@/components/contracts/contract-types"
import type { EstimateStatus, EstimateType } from "@prisma/client"
import { ProjectListMobile } from "./ProjectListMobile"
import { ProjectListDesktop } from "./ProjectListDesktop"

// ─── 型定義 ────────────────────────────────────────────

export interface EstimateRow {
  id: string
  title: string | null
  estimateType: EstimateType
  status: EstimateStatus
  isArchived: boolean
  confirmedAt: Date | null
  createdAt: Date
  user: { id: string; name: string }
  totalAmount: number
}

export interface Project {
  id: string
  shortId: string
  name: string
  address: string | null
  isArchived: boolean
  createdAt: Date
  updatedAt: Date
  branch: {
    name: string
    company: {
      id: string
      name: string
      taxRate: number
      paymentClosingDay: number | null
      paymentMonthOffset: number
      paymentPayDay: number | null
      paymentNetDays: number | null
    }
  }
  contact: { name: string } | null
  estimates: EstimateRow[]
}

interface Props {
  projects: Project[]
  currentUser: { id: string; name: string }
  templates: EstimateTemplate[]
}

// ─── 表示モード ─────────────────────────────────────────

export type ViewMode = "company" | "site"
export type SiteCategory = "no_estimate" | "in_progress" | "submitted"

const VIEW_MODE_KEY = "projectlist_view_mode"

const SITE_CATEGORY_LABEL: Record<SiteCategory, string> = {
  no_estimate: "見積未作成",
  in_progress: "見積作成中",
  submitted: "見積提出済み",
}

export const SITE_CATEGORY_STYLE: Record<SiteCategory, { bg: string; text: string; badge: string }> = {
  no_estimate: { bg: "bg-amber-50", text: "text-amber-700", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  in_progress: { bg: "bg-blue-50", text: "text-blue-700", badge: "bg-blue-100 text-blue-700 border-blue-200" },
  submitted: { bg: "bg-emerald-50", text: "text-emerald-700", badge: "bg-emerald-100 text-emerald-700 border-emerald-200" },
}

function getSiteCategory(p: Project): SiteCategory {
  if (p.estimates.length === 0) return "no_estimate"
  if (p.estimates.some((e) => e.status === "SENT")) return "submitted"
  return "in_progress"
}

// ─── 定数 ──────────────────────────────────────────────

export const EST_STATUS_LABEL: Record<EstimateStatus, string> = {
  DRAFT: "下書き",
  CONFIRMED: "確定済",
  SENT: "送付済",
  OLD: "旧版",
}

// フィルタータグ用の短縮ラベル（2文字）
export const EST_STATUS_SHORT: Record<EstimateStatus, string> = {
  DRAFT: "下書",
  CONFIRMED: "確定",
  SENT: "送付",
  OLD: "旧版",
}

export const EST_STATUS_STYLE: Record<EstimateStatus, string> = {
  DRAFT: "bg-amber-500 text-white",
  CONFIRMED: "bg-blue-500 text-white",
  SENT: "bg-emerald-500 text-white",
  OLD: "bg-orange-400 text-white",
}

// 追加見積ラベル
export const EST_TYPE_STYLE: Record<EstimateType, { label: string; className: string } | null> = {
  INITIAL: null, // 表示なし
  ADDITIONAL: { label: "追加", className: "bg-amber-100 text-amber-700 border border-amber-300" },
}

// ─── ViewProps インターフェース ──────────────────────────

export interface ProjectListViewProps {
  projects: Project[]
  currentUser: { id: string; name: string }
  templates: EstimateTemplate[]
  filtered: Project[]
  grouped: { companyId: string; companyName: string; projects: Project[] }[]
  siteGrouped: { category: SiteCategory; label: string; projects: Project[] }[]
  search: string
  setSearch: (v: string) => void
  showArchived: boolean
  setShowArchived: (v: boolean) => void
  showHiddenEstimates: boolean
  setShowHiddenEstimates: (v: boolean) => void
  viewMode: ViewMode
  switchViewMode: (mode: ViewMode) => void
  collapsedProjects: Set<string>
  toggleProject: (projectId: string) => void
  collapsedCompanies: Set<string>
  toggleCompany: (companyId: string) => void
  collapsedCategories: Set<SiteCategory>
  toggleCategory: (cat: SiteCategory) => void
  checkedEstimateIds: Set<string>
  toggleCheck: (estimateId: string) => void
  setCheckedEstimateIds: (ids: Set<string>) => void
  allCheckableIds: string[]
  selectedStatuses: Set<EstimateStatus>
  toggleStatus: (s: EstimateStatus) => void
  setSelectedStatuses: (v: Set<EstimateStatus>) => void
  selectedUsers: Set<string>
  toggleUser: (userId: string) => void
  setSelectedUsers: (v: Set<string>) => void
  allUsers: { id: string; name: string }[]
  selectedEstimateId: string | null
  selectedProjectId: string | null
  handleSelectEstimate: (estimateId: string) => void
  handleSelectProject: (projectId: string) => void
  handleArchive: (projectId: string) => void
  handleDeleteEstimate: () => void
  handleHideEstimate: () => void
  handleRestoreEstimate: (estimateId: string) => void
  setDeleteEstimateId: (id: string | null) => void
  setDeleteEstimateName: (name: string) => void
  setHideEstimateId: (id: string | null) => void
  setHideEstimateName: (name: string) => void
  contractDialogOpen: boolean
  setContractDialogOpen: (v: boolean) => void
  contractDialogItems: ContractEstimateItem[]
  setContractDialogItems: (items: ContractEstimateItem[]) => void
  contractDialogMode: "individual" | "consolidated"
  setContractDialogMode: (mode: "individual" | "consolidated") => void
  bulkContractOpen: boolean
  setBulkContractOpen: (v: boolean) => void
  checkedItems: ContractEstimateItem[]
  deleteEstimateId: string | null
  deleteEstimateName: string
  deleting: boolean
  hideEstimateId: string | null
  hideEstimateName: string
  hiding: boolean
  companyDialogOpen: boolean
  setCompanyDialogOpen: (v: boolean) => void
  quickCreating: boolean
  handleQuickCreateForProject: (projectId: string, estimateCount: number) => void
  issikiTemplate: EstimateTemplate | null
  guardedAction: (action: () => void) => void
  isEstimateEditing: boolean
  setIsEstimateEditing: (v: boolean) => void
  unsavedDialogOpen: boolean
  confirmDiscard: () => void
  cancelDiscard: () => void
  hasPanel: boolean
  hasProjectPanel: boolean
  hasEstimatePanel: boolean
  listCollapsed: boolean
  setListCollapsed: (v: boolean) => void
  projectCollapsed: boolean
  setProjectCollapsed: (v: boolean) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  estimateData: any | null
  estimateLoading: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  projectDetailData: any | null
  projectLoading: boolean
  closeEstimatePanel: () => void
  closeProjectPanel: () => void
  closeAllPanels: () => void
  openEstimateFromProject: (estimateId: string) => Promise<void>
  openEstimateDirect: (estimateId: string) => Promise<void>
  refreshEstimate: () => Promise<void>
  refreshProject: () => Promise<void>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  router: any
  isMobile: boolean
  handleCreateBundle: () => Promise<void>
  handleCloseEstimate: () => void
  // Constants
  EST_STATUS_LABEL: Record<EstimateStatus, string>
  EST_STATUS_SHORT: Record<EstimateStatus, string>
  EST_STATUS_STYLE: Record<EstimateStatus, string>
  EST_TYPE_STYLE: Record<EstimateType, { label: string; className: string } | null>
  SITE_CATEGORY_STYLE: Record<SiteCategory, { bg: string; text: string; badge: string }>
}

// ─── 会社登録ダイアログ ────────────────────────────────

const COMPANY_TYPE_OPTIONS = [
  { label: "株式会社",             value: "株式会社" },
  { label: "有限会社",             value: "有限会社" },
  { label: "合同会社",             value: "合同会社" },
  { label: "合資会社",             value: "合資会社" },
  { label: "合名会社",             value: "合名会社" },
  { label: "一般社団法人",         value: "一般社団法人" },
  { label: "一般財団法人",         value: "一般財団法人" },
  { label: "社会福祉法人",         value: "社会福祉法人" },
  { label: "特定非営利活動法人",   value: "特定非営利活動法人" },
  { label: "医療法人",             value: "医療法人" },
  { label: "学校法人",             value: "学校法人" },
  { label: "農業協同組合",         value: "農業協同組合" },
  { label: "生活協同組合",         value: "生活協同組合" },
  { label: "個人・屋号",           value: "" },
] as const

type TypePosition = "前" | "後"

interface CreateCompanyDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}

function CreateCompanyDialog({ open, onOpenChange, onCreated }: CreateCompanyDialogProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [companyType, setCompanyType] = useState("株式会社")
  const [typePosition, setTypePosition] = useState<TypePosition>("前")
  const [companyName, setCompanyName] = useState("")
  const [companyFurigana, setCompanyFurigana] = useState("")
  const [companyPhone, setCompanyPhone] = useState("")
  const [furiganaManuallyEdited, setFuriganaManuallyEdited] = useState(false)
  const [companyErrors, setCompanyErrors] = useState<{ name?: string; furigana?: string; phone?: string }>({})
  const committedFuriganaRef = useRef("")
  const pendingHiraganaRef = useRef("")
  const furiganaComposingRef = useRef(false)

  const [useNetDays, setUseNetDays] = useState(false)
  const [paymentClosingDay, setPaymentClosingDay] = useState<string>("末")
  const [paymentMonthOffset, setPaymentMonthOffset] = useState<string>("1")
  const [paymentPayDay, setPaymentPayDay] = useState<string>("末")
  const [paymentNetDays, setPaymentNetDays] = useState<string>("45")

  function resetForm() {
    setCompanyType("株式会社")
    setTypePosition("前")
    setCompanyName("")
    setCompanyFurigana("")
    setCompanyPhone("")
    setFuriganaManuallyEdited(false)
    setCompanyErrors({})
    committedFuriganaRef.current = ""
    pendingHiraganaRef.current = ""
    setUseNetDays(false)
    setPaymentClosingDay("末")
    setPaymentMonthOffset("1")
    setPaymentPayDay("末")
    setPaymentNetDays("45")
  }

  function getFullCompanyName(): string {
    const name = companyName.trim()
    if (!companyType) return name
    return typePosition === "前" ? `${companyType}${name}` : `${name}${companyType}`
  }

  function toHiraganaOnly(text: string): string {
    const kata2hira = text.replace(/[\u30A1-\u30F6]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0x60)
    )
    return kata2hira.replace(/[^\u3041-\u3096\u309D\u309E\u30FC\s]/g, "")
  }

  function handleNameCompositionUpdate(e: React.CompositionEvent<HTMLInputElement>) {
    if (!furiganaManuallyEdited) {
      const hira = toHiraganaOnly(e.data)
      if (hira) {
        pendingHiraganaRef.current = hira
        setCompanyFurigana(committedFuriganaRef.current + hira)
      }
    }
  }

  function handleNameCompositionEnd() {
    if (!furiganaManuallyEdited) {
      committedFuriganaRef.current += pendingHiraganaRef.current
      pendingHiraganaRef.current = ""
    }
  }

  function handleNameChange(value: string) {
    setCompanyName(value)
    if (companyErrors.name) setCompanyErrors((p) => ({ ...p, name: undefined }))
    if (!furiganaManuallyEdited && !value) {
      committedFuriganaRef.current = ""
      pendingHiraganaRef.current = ""
      setCompanyFurigana("")
    }
  }

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

  function handleFuriganaChange(value: string) {
    if (furiganaComposingRef.current) {
      setCompanyFurigana(value)
      return
    }
    const hiraganaOnly = toHiraganaOnly(value)
    setCompanyFurigana(hiraganaOnly)
    setFuriganaManuallyEdited(true)
    committedFuriganaRef.current = hiraganaOnly
    if (companyErrors.furigana) setCompanyErrors((p) => ({ ...p, furigana: undefined }))
  }

  function handleFuriganaCompositionEnd(e: React.CompositionEvent<HTMLInputElement>) {
    furiganaComposingRef.current = false
    const hiraganaOnly = toHiraganaOnly(e.currentTarget.value)
    setCompanyFurigana(hiraganaOnly)
    setFuriganaManuallyEdited(true)
    committedFuriganaRef.current = hiraganaOnly
    if (companyErrors.furigana) setCompanyErrors((p) => ({ ...p, furigana: undefined }))
  }

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
    if (companyPhone.trim() && !/^0\d{1,4}-\d{1,4}-\d{4}$/.test(companyPhone.trim())) {
      errors.phone = "電話番号の形式が正しくありません（例：03-1234-5678）"
    }
    setCompanyErrors(errors)
    return Object.keys(errors).length === 0
  }

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

  async function handleSave(goToProject = false) {
    if (!validateCompanyForm()) return
    setLoading(true)
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: getFullCompanyName(),
          furigana: companyFurigana.trim() || null,
          phone: companyPhone.trim() || null,
          ...buildPaymentPayload(),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(typeof data.error === "string" ? data.error : "登録に失敗しました")
      }
      const created = await res.json()
      toast.success("会社を登録しました")
      onOpenChange(false)
      resetForm()
      if (goToProject) {
        router.push(`/projects/new?companyId=${created.id}`)
      } else {
        onCreated()
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "エラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  function handleClose(v: boolean) {
    if (!v) resetForm()
    onOpenChange(v)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>会社を新規登録</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* 法人種別 */}
          <div className="space-y-1.5">
            <Label>法人種別</Label>
            <select
              value={companyType}
              onChange={(e) => setCompanyType(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-white"
            >
              {COMPANY_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.value ? t.label : "個人・屋号（種別なし）"}
                </option>
              ))}
            </select>
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

          {/* 会社名 */}
          <div className="space-y-1.5">
            <Label>
              {companyType
                ? <>{`会社名（${companyType}以降）`} <span className="text-red-500">*</span></>
                : <>屋号・氏名 <span className="text-red-500">*</span></>}
            </Label>
            <Input
              value={companyName}
              onChange={(e) => handleNameChange(e.target.value)}
              onCompositionUpdate={handleNameCompositionUpdate}
              onCompositionEnd={handleNameCompositionEnd}
              placeholder={companyType ? "例：○○建設" : "例：山田 太郎 / 山田電気工事"}
              className={companyErrors.name ? "border-red-400 focus-visible:ring-red-400" : ""}
            />
            {companyErrors.name && (
              <p className="text-xs text-red-500 flex items-center gap-1">⚠ {companyErrors.name}</p>
            )}
            {companyName.trim() && (
              <div className="flex items-center gap-2 mt-1 px-3 py-1.5 bg-blue-50 rounded-md border border-blue-100">
                <span className="text-xs text-blue-400">登録名：</span>
                <span className="text-sm font-semibold text-blue-800">{getFullCompanyName()}</span>
              </div>
            )}
          </div>

          {/* ふりがな */}
          <div className="space-y-1.5">
            <Label>
              ふりがな
              <span className="text-xs text-slate-600 ml-2">
                {furiganaManuallyEdited ? "（手動入力）" : "（会社名を入力すると自動で入ります）"}
              </span>
            </Label>
            <Input
              value={companyFurigana}
              onChange={(e) => handleFuriganaChange(e.target.value)}
              onCompositionStart={() => { furiganaComposingRef.current = true }}
              onCompositionEnd={handleFuriganaCompositionEnd}
              onFocus={() => { if (companyFurigana) setFuriganaManuallyEdited(true) }}
              placeholder="例：やまだけんせつ"
              className={companyErrors.furigana ? "border-red-400 focus-visible:ring-red-400" : ""}
            />
            {companyErrors.furigana ? (
              <p className="text-xs text-red-500 flex items-center gap-1">⚠ {companyErrors.furigana}</p>
            ) : (
              <p className="text-xs text-slate-400">ひらがなのみ入力できます</p>
            )}
          </div>

          {/* 電話番号 */}
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
              <p className="text-xs text-red-500 flex items-center gap-1">⚠ {companyErrors.phone}</p>
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
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">支払方式</Label>
                <div className="flex rounded-md border border-slate-200 overflow-hidden h-[38px]">
                  <button
                    type="button"
                    onClick={() => setUseNetDays(false)}
                    className={`flex-1 text-xs font-medium transition-colors ${
                      !useNetDays ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    月次指定
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseNetDays(true)}
                    className={`flex-1 text-xs font-medium border-l border-slate-200 transition-colors ${
                      useNetDays ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    日数払い
                  </button>
                </div>
              </div>
            </div>
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
            {useNetDays && (
              <div className="mt-3 space-y-1.5">
                <Label className="text-xs text-slate-500">締め後○日払い</Label>
                <div className="flex items-center gap-2">
                  <select
                    className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                    value={["30","45","60","90"].includes(paymentNetDays) ? paymentNetDays : "custom"}
                    onChange={(e) => { if (e.target.value !== "custom") setPaymentNetDays(e.target.value) }}
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
          <Button variant="outline" onClick={() => handleClose(false)} className="sm:mr-auto">
            キャンセル
          </Button>
          <Button variant="outline" onClick={() => handleSave(false)} disabled={loading}>
            {loading && <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />}
            登録する
          </Button>
          <Button onClick={() => handleSave(true)} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white">
            {loading && <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />}
            登録して商談を作成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── メインコンポーネント ───────────────────────────────

export function ProjectList({ projects, currentUser, templates }: Props) {
  const router = useRouter()
  const isMobile = useIsMobile()

  // ── 見積作成の共通ロジック ──
  const {
    creating: quickCreating,
    issikiTemplate,
    quickCreate,
  } = useEstimateCreate({
    templates,
    onCreated: () => {
      router.refresh()
    },
  })

  async function handleQuickCreateForProject(projectId: string, estimateCount: number) {
    await quickCreate(projectId, estimateCount)
  }

  const [search, setSearch] = useState("")
  const [showArchived, setShowArchived] = useState(false)
  // タグフィルター
  const [selectedStatuses, setSelectedStatuses] = useState<Set<EstimateStatus>>(new Set())
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  // 展開状態: デフォルトで全現場を展開
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set())
  const [collapsedCompanies, setCollapsedCompanies] = useState<Set<string>>(new Set())
  const [contractDialogOpen, setContractDialogOpen] = useState(false)
  const [contractDialogItems, setContractDialogItems] = useState<ContractEstimateItem[]>([])
  const [contractDialogMode, setContractDialogMode] = useState<"individual" | "consolidated">("individual")
  // 見積削除（下書きのみ）
  const [deleteEstimateId, setDeleteEstimateId] = useState<string | null>(null)
  const [deleteEstimateName, setDeleteEstimateName] = useState("")
  const [deleting, setDeleting] = useState(false)
  // 見積非表示（確定済み・送付済み）
  const [hideEstimateId, setHideEstimateId] = useState<string | null>(null)
  const [hideEstimateName, setHideEstimateName] = useState("")
  const [hiding, setHiding] = useState(false)
  // 非表示見積の表示トグル
  const [showHiddenEstimates, setShowHiddenEstimates] = useState(false)
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false)
  // 表示モード
  const [viewMode, setViewMode] = useState<ViewMode>("company")
  const [collapsedCategories, setCollapsedCategories] = useState<Set<SiteCategory>>(new Set())

  // ── Split View 状態（3カラム対応） ─────────────────────────
  // 見積パネル（3番目）
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null)
  const [estimateData, setEstimateData] = useState<{
    estimate: Parameters<typeof EstimateDetail>[0]["estimate"]
    taxRate: number
    units: { id: string; name: string }[]
    contacts: { id: string; name: string; phone: string; email: string }[]
  } | null>(null)
  const [estimateLoading, setEstimateLoading] = useState(false)

  // 現場パネル（2番目）
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [projectDetailData, setProjectDetailData] = useState<any | null>(null)
  const [projectLoading, setProjectLoading] = useState(false)

  // パネル折りたたみ状態
  const [listCollapsed, setListCollapsed] = useState(false)
  const [projectCollapsed, setProjectCollapsed] = useState(false)

  // ── モバイル: スクロール位置の保存・復元 ──
  useEffect(() => {
    if (!isMobile) return
    const mainEl = document.querySelector("main")
    if (!mainEl) return
    const saved = sessionStorage.getItem("projectList_scrollTop")
    if (saved) {
      // requestAnimationFrame で DOM レンダリング後に復元
      requestAnimationFrame(() => {
        mainEl.scrollTo(0, parseInt(saved, 10))
      })
      sessionStorage.removeItem("projectList_scrollTop")
    }
  }, [isMobile])

  // localStorage から表示モードを復元
  useEffect(() => {
    const saved = localStorage.getItem(VIEW_MODE_KEY) as ViewMode | null
    if (saved === "company" || saved === "site") setViewMode(saved)
  }, [])

  function switchViewMode(mode: ViewMode) {
    setViewMode(mode)
    localStorage.setItem(VIEW_MODE_KEY, mode)
  }

  function toggleCategory(cat: SiteCategory) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) { next.delete(cat) } else { next.add(cat) }
      return next
    })
  }

  const saveScrollPosition = useCallback(() => {
    const mainEl = document.querySelector("main")
    if (mainEl) {
      sessionStorage.setItem("projectList_scrollTop", String(mainEl.scrollTop))
    }
  }, [])

  const hasProjectPanel = !!selectedProjectId
  const hasEstimatePanel = !!selectedEstimateId
  const hasPanel = hasProjectPanel || hasEstimatePanel

  // レイアウト制御: パネル展開時にフル幅にする（デスクトップのみ）
  useEffect(() => {
    if (isMobile) return
    const el = document.getElementById("app-content")
    if (!el) return
    if (hasPanel) {
      el.classList.remove("max-w-7xl", "mx-auto", "px-6")
      el.classList.add("px-2")
    } else {
      el.classList.remove("px-2")
      el.classList.add("max-w-7xl", "mx-auto", "px-6")
    }
    return () => {
      el.classList.remove("px-2")
      el.classList.add("max-w-7xl", "mx-auto", "px-6")
    }
  }, [hasPanel, isMobile])

  // 編集中ガード
  const [isEstimateEditing, setIsEstimateEditing] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false)

  function guardedAction(action: () => void) {
    if (isEstimateEditing) {
      setPendingAction(() => action)
      setUnsavedDialogOpen(true)
    } else {
      action()
    }
  }
  function confirmDiscard() {
    setIsEstimateEditing(false)
    setUnsavedDialogOpen(false)
    pendingAction?.()
    setPendingAction(null)
  }
  function cancelDiscard() {
    setUnsavedDialogOpen(false)
    setPendingAction(null)
  }

  function closeEstimatePanel() {
    guardedAction(() => {
      setSelectedEstimateId(null)
      setEstimateData(null)
      setListCollapsed(false)
    })
  }

  function closeProjectPanel() {
    guardedAction(() => {
      setSelectedProjectId(null)
      setProjectDetailData(null)
      setSelectedEstimateId(null)
      setEstimateData(null)
      setProjectCollapsed(false)
    })
  }

  function closeAllPanels() {
    guardedAction(() => {
      setSelectedEstimateId(null)
      setEstimateData(null)
      setSelectedProjectId(null)
      setProjectDetailData(null)
      setListCollapsed(false)
      setProjectCollapsed(false)
    })
  }

  // 見積データを非同期で取得（現場パネルは維持、一覧は自動折りたたみ）
  const openEstimateFromProject = useCallback(async (estimateId: string) => {
    if (estimateId === selectedEstimateId) return
    setListCollapsed(true)
    setSelectedEstimateId(estimateId)
    setEstimateLoading(true)
    setEstimateData(null)
    try {
      const res = await fetch(`/api/estimates/${estimateId}`)
      if (!res.ok) throw new Error("取得失敗")
      const data = await res.json()
      setEstimateData(data)
    } catch {
      toast.error("見積データの取得に失敗しました")
      setSelectedEstimateId(null)
    } finally {
      setEstimateLoading(false)
    }
  }, [selectedEstimateId])

  // 一覧から直接見積を開く（現場パネルなし）
  const openEstimateDirect = useCallback(async (estimateId: string) => {
    if (estimateId === selectedEstimateId && !hasProjectPanel) return
    setSelectedProjectId(null)
    setProjectDetailData(null)
    setProjectCollapsed(false)
    setSelectedEstimateId(estimateId)
    setEstimateLoading(true)
    setEstimateData(null)
    try {
      const res = await fetch(`/api/estimates/${estimateId}`)
      if (!res.ok) throw new Error("取得失敗")
      const data = await res.json()
      setEstimateData(data)
    } catch {
      toast.error("見積データの取得に失敗しました")
      setSelectedEstimateId(null)
    } finally {
      setEstimateLoading(false)
    }
  }, [selectedEstimateId, hasProjectPanel])

  const refreshEstimate = useCallback(async () => {
    if (!selectedEstimateId) return
    router.refresh()
    try {
      const [estRes] = await Promise.all([
        fetch(`/api/estimates/${selectedEstimateId}`),
        selectedProjectId ? fetch(`/api/projects/${selectedProjectId}`).then(r => r.json()).then(d => setProjectDetailData(d)).catch(() => {}) : Promise.resolve(),
      ])
      if (!estRes.ok) throw new Error("取得失敗")
      const data = await estRes.json()
      setEstimateData(data)
    } catch {
      toast.error("見積データの再取得に失敗しました")
    }
  }, [selectedEstimateId, selectedProjectId, router])

  // 現場データを非同期で取得
  const openProject = useCallback(async (projectId: string) => {
    if (projectId === selectedProjectId) return
    setSelectedProjectId(projectId)
    setSelectedEstimateId(null)
    setEstimateData(null)
    setProjectCollapsed(false)
    setProjectLoading(true)
    setProjectDetailData(null)
    try {
      const res = await fetch(`/api/projects/${projectId}`)
      if (!res.ok) throw new Error("取得失敗")
      const data = await res.json()
      setProjectDetailData(data)
    } catch {
      toast.error("現場データの取得に失敗しました")
      setSelectedProjectId(null)
    } finally {
      setProjectLoading(false)
    }
  }, [selectedProjectId])

  const refreshProject = useCallback(async () => {
    if (!selectedProjectId) return
    router.refresh()
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}`)
      if (!res.ok) throw new Error("取得失敗")
      const data = await res.json()
      setProjectDetailData(data)
    } catch {
      toast.error("現場データの再取得に失敗しました")
    }
  }, [selectedProjectId, router])

  function handleSelectEstimate(estimateId: string) {
    if (isMobile) {
      saveScrollPosition()
      router.push(`/estimates/${estimateId}`)
      return
    }
    guardedAction(() => openEstimateDirect(estimateId))
  }

  function handleSelectProject(projectId: string) {
    if (isMobile) {
      saveScrollPosition()
      router.push(`/projects/${projectId}`)
      return
    }
    guardedAction(() => openProject(projectId))
  }

  function handleCloseEstimate() {
    closeEstimatePanel()
  }

  // ── 複数チェック・一括契約 ──────────────────────────────
  const [checkedEstimateIds, setCheckedEstimateIds] = useState<Set<string>>(new Set())
  const [bulkContractOpen, setBulkContractOpen] = useState(false)

  /** チェック可能な見積（CONFIRMED/SENT → 契約処理対象） */
  function isCheckable(est: EstimateRow): boolean {
    return est.status === "CONFIRMED" || est.status === "SENT"
  }

  function toggleCheck(estimateId: string) {
    setCheckedEstimateIds((prev) => {
      const next = new Set(prev)
      if (next.has(estimateId)) { next.delete(estimateId) } else { next.add(estimateId) }
      return next
    })
  }

  // ── Esc キーハンドラ ───────────────────────────────────
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key !== "Escape") return
      // モーダル/ダイアログが開いている場合はそちらに任せる
      if (contractDialogOpen || bulkContractOpen || companyDialogOpen || unsavedDialogOpen) return
      // チェックが入っていたらチェック解除を優先
      if (checkedEstimateIds.size > 0) {
        e.preventDefault()
        setCheckedEstimateIds(new Set())
        return
      }
      // 見積パネルが開いていたら閉じる
      if (selectedEstimateId) {
        e.preventDefault()
        closeEstimatePanel()
        return
      }
      // 現場パネルが開いていたら閉じる
      if (selectedProjectId) {
        e.preventDefault()
        closeProjectPanel()
        return
      }
    }
    window.addEventListener("keydown", handleEsc)
    return () => window.removeEventListener("keydown", handleEsc)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEstimateId, selectedProjectId, checkedEstimateIds.size, contractDialogOpen, bulkContractOpen, companyDialogOpen, unsavedDialogOpen, isEstimateEditing])

  // 見積セット作成
  async function handleCreateBundle() {
    // 選択された見積のプロジェクトを特定
    const selectedEstimates: { estimateId: string; projectId: string }[] = []
    for (const p of projects) {
      for (const est of p.estimates) {
        if (checkedEstimateIds.has(est.id) && (est.status === "CONFIRMED" || est.status === "SENT")) {
          selectedEstimates.push({ estimateId: est.id, projectId: p.id })
        }
      }
    }
    if (selectedEstimates.length === 0) { toast.error("セットにできる見積がありません（確定済み・送付済みのみ）"); return }

    // 同一プロジェクトか確認
    const projectIds = new Set(selectedEstimates.map(e => e.projectId))
    if (projectIds.size > 1) { toast.error("見積セットは同じ現場の見積のみ作成できます"); return }

    const projectId = selectedEstimates[0].projectId
    const estimateIds = selectedEstimates.map(e => e.estimateId)

    try {
      const res = await fetch("/api/estimate-bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, estimateIds }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "作成に失敗しました" }))
        toast.error(err.error || "作成に失敗しました")
        return
      }
      const data = await res.json()
      toast.success(`見積セットを作成しました（${data.bundleNumber}）`)
      window.open(`/estimate-bundles/${data.id}/print`, "_blank")
      setCheckedEstimateIds(new Set())
    } catch (e) {
      console.error("Bundle creation error:", e)
      toast.error("見積セットの作成に失敗しました")
    }
  }

  /** チェック済み見積の ContractEstimateItem 一覧 */
  const checkedItems = useMemo((): ContractEstimateItem[] => {
    const result: ContractEstimateItem[] = []
    for (const p of projects) {
      for (const est of p.estimates) {
        if (!checkedEstimateIds.has(est.id)) continue
        const displayName = est.title
          ?? (p.estimates.length === 1 ? "見積" : `見積 ${p.estimates.indexOf(est) + 1}`)
        const companyTaxRate = p.branch.company.taxRate
        result.push({
          estimateId: est.id,
          estimateName: displayName,
          projectId: p.id,
          projectName: p.name,
          companyName: p.branch.company.name,
          taxExcludedAmount: Math.round(est.totalAmount / (1 + companyTaxRate)),
          taxRate: companyTaxRate,
        })
      }
    }
    return result
  }, [checkedEstimateIds, projects])

  // フィルタータグ用：全プロジェクトからユニーク担当者を収集
  const allUsers = useMemo(() => {
    const map = new Map<string, string>() // id → name
    for (const p of projects) {
      for (const est of p.estimates) {
        if (!map.has(est.user.id)) map.set(est.user.id, est.user.name)
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [projects])

  // タグトグル
  function toggleStatus(s: EstimateStatus) {
    setSelectedStatuses((prev) => {
      const next = new Set(prev)
      if (next.has(s)) { next.delete(s) } else { next.add(s) }
      return next
    })
  }
  function toggleUser(userId: string) {
    setSelectedUsers((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) { next.delete(userId) } else { next.add(userId) }
      return next
    })
  }

  const filtered = projects
    .filter((p) => {
      const q = search.toLowerCase()
      const matchSearch =
        q === "" ||
        p.branch.company.name.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.contact?.name.toLowerCase().includes(q) ?? false)
      const matchArchive = showArchived ? p.isArchived : !p.isArchived
      if (!matchSearch || !matchArchive) return false

      // 状況・担当者フィルター: 現場内の見積が1件以上マッチすれば現場を表示
      return p.estimates.some((est) => {
        const okStatus = selectedStatuses.size === 0 || selectedStatuses.has(est.status)
        const okUser = selectedUsers.size === 0 || selectedUsers.has(est.user.id)
        return okStatus && okUser
      })
    })
    .map((p) => {
      // フィルターが有効な場合、見積サブ行もフィルター済みのみ表示
      const visibleEstimates =
        selectedStatuses.size === 0 && selectedUsers.size === 0
          ? p.estimates
          : p.estimates.filter((est) => {
              const okStatus = selectedStatuses.size === 0 || selectedStatuses.has(est.status)
              const okUser = selectedUsers.size === 0 || selectedUsers.has(est.user.id)
              return okStatus && okUser
            })
      return { ...p, estimates: visibleEstimates }
    })

  // 会社別グループ化
  const grouped = useMemo(() => {
    const map = new Map<string, { companyId: string; companyName: string; projects: Project[] }>()
    for (const p of filtered) {
      const key = p.branch.company.id
      if (!map.has(key)) {
        map.set(key, { companyId: key, companyName: p.branch.company.name, projects: [] })
      }
      map.get(key)!.projects.push(p)
    }
    return Array.from(map.values())
  }, [filtered])

  // 現場順グルーピング（ステータスカテゴリ別、更新日順）
  const siteGrouped = useMemo(() => {
    if (viewMode !== "site") return []
    const categories: SiteCategory[] = ["no_estimate", "in_progress", "submitted"]
    return categories
      .map((cat) => ({
        category: cat,
        label: SITE_CATEGORY_LABEL[cat],
        projects: filtered
          .filter((p) => getSiteCategory(p) === cat)
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
      }))
      .filter((g) => g.projects.length > 0)
  }, [filtered, viewMode])

  /** 全チェック可能な見積 ID（現在 filtered に表示中のもの） */
  const allCheckableIds = useMemo(() => {
    const ids: string[] = []
    for (const p of filtered) {
      for (const est of p.estimates) {
        if (isCheckable(est)) ids.push(est.id)
      }
    }
    return ids
  }, [filtered])

  function toggleCompany(companyId: string) {
    setCollapsedCompanies((prev) => {
      const next = new Set(prev)
      if (next.has(companyId)) { next.delete(companyId) } else { next.add(companyId) }
      return next
    })
  }

  function toggleProject(projectId: string) {
    setCollapsedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) { next.delete(projectId) } else { next.add(projectId) }
      return next
    })
  }

  async function handleArchive(projectId: string) {
    if (!confirm("この現場を失注としてアーカイブしますか？")) return
    const res = await fetch(`/api/projects/${projectId}/archive`, { method: "PATCH" })
    if (res.ok) {
      toast.success("アーカイブしました")
      router.refresh()
    } else {
      toast.error("失敗しました")
    }
  }

  async function handleDeleteEstimate() {
    if (!deleteEstimateId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/estimates/${deleteEstimateId}`, { method: "DELETE" })
      if (res.ok) {
        toast.success("見積を削除しました")
        setDeleteEstimateId(null)
        if (selectedEstimateId === deleteEstimateId) setSelectedEstimateId(null)
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || "削除に失敗しました")
      }
    } catch {
      toast.error("削除に失敗しました")
    } finally {
      setDeleting(false)
    }
  }

  async function handleHideEstimate() {
    if (!hideEstimateId) return
    setHiding(true)
    try {
      const res = await fetch(`/api/estimates/${hideEstimateId}/archive`, { method: "POST" })
      if (res.ok) {
        toast.success("見積を非表示にしました")
        setHideEstimateId(null)
        if (selectedEstimateId === hideEstimateId) setSelectedEstimateId(null)
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || "非表示に失敗しました")
      }
    } catch {
      toast.error("非表示に失敗しました")
    } finally {
      setHiding(false)
    }
  }

  async function handleRestoreEstimate(estimateId: string) {
    try {
      const res = await fetch(`/api/estimates/${estimateId}/archive`, { method: "DELETE" })
      if (res.ok) {
        toast.success("見積を復元しました")
        router.refresh()
      } else {
        toast.error("復元に失敗しました")
      }
    } catch {
      toast.error("復元に失敗しました")
    }
  }

  // ── ViewProps の構築 ──
  const viewProps: ProjectListViewProps = {
    projects,
    currentUser,
    templates,
    filtered,
    grouped,
    siteGrouped,
    search,
    setSearch,
    showArchived,
    setShowArchived,
    showHiddenEstimates,
    setShowHiddenEstimates,
    viewMode,
    switchViewMode,
    collapsedProjects,
    toggleProject,
    collapsedCompanies,
    toggleCompany,
    collapsedCategories,
    toggleCategory,
    checkedEstimateIds,
    toggleCheck,
    setCheckedEstimateIds,
    allCheckableIds,
    selectedStatuses,
    toggleStatus,
    setSelectedStatuses,
    selectedUsers,
    toggleUser,
    setSelectedUsers,
    allUsers,
    selectedEstimateId,
    selectedProjectId,
    handleSelectEstimate,
    handleSelectProject,
    handleArchive,
    handleDeleteEstimate,
    handleHideEstimate,
    handleRestoreEstimate,
    setDeleteEstimateId,
    setDeleteEstimateName,
    setHideEstimateId,
    setHideEstimateName,
    contractDialogOpen,
    setContractDialogOpen,
    contractDialogItems,
    setContractDialogItems,
    contractDialogMode,
    setContractDialogMode,
    bulkContractOpen,
    setBulkContractOpen,
    checkedItems,
    deleteEstimateId,
    deleteEstimateName,
    deleting,
    hideEstimateId,
    hideEstimateName,
    hiding,
    companyDialogOpen,
    setCompanyDialogOpen,
    quickCreating,
    handleQuickCreateForProject,
    issikiTemplate,
    guardedAction,
    isEstimateEditing,
    setIsEstimateEditing,
    unsavedDialogOpen,
    confirmDiscard,
    cancelDiscard,
    hasPanel,
    hasProjectPanel,
    hasEstimatePanel,
    listCollapsed,
    setListCollapsed,
    projectCollapsed,
    setProjectCollapsed,
    estimateData,
    estimateLoading,
    projectDetailData,
    projectLoading,
    closeEstimatePanel,
    closeProjectPanel,
    closeAllPanels,
    openEstimateFromProject,
    openEstimateDirect,
    refreshEstimate,
    refreshProject,
    router,
    isMobile,
    handleCreateBundle,
    handleCloseEstimate,
    // Constants
    EST_STATUS_LABEL,
    EST_STATUS_SHORT,
    EST_STATUS_STYLE,
    EST_TYPE_STYLE,
    SITE_CATEGORY_STYLE,
  }

  return (
    <>
      {isMobile ? (
        <ProjectListMobile {...viewProps} />
      ) : (
        <ProjectListDesktop {...viewProps} />
      )}

      {/* ── 共通ダイアログ群 ── */}

      {/* 契約処理ダイアログ（共通モジュール: 単件 & 一括） */}
      <ContractProcessingDialog
        open={contractDialogOpen}
        onOpenChange={setContractDialogOpen}
        items={contractDialogItems}
        mode={contractDialogMode}
        onCompleted={() => {
          setCheckedEstimateIds(new Set())
          router.refresh()
        }}
      />

      {/* 一括契約処理ダイアログ（統合モード） */}
      <ContractProcessingDialog
        open={bulkContractOpen}
        onOpenChange={setBulkContractOpen}
        items={checkedItems}
        mode="consolidated"
        onCompleted={() => {
          setCheckedEstimateIds(new Set())
          router.refresh()
        }}
      />

      {/* 見積削除確認ダイアログ */}
      <Dialog open={!!deleteEstimateId} onOpenChange={(open) => { if (!open) setDeleteEstimateId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>見積を削除</DialogTitle>
            <DialogDescription>
              「{deleteEstimateName}」を削除します。この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteEstimateId(null)} disabled={deleting}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={handleDeleteEstimate} disabled={deleting}>
              {deleting ? <LoaderIcon className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 見積非表示確認ダイアログ */}
      <Dialog open={!!hideEstimateId} onOpenChange={(open) => { if (!open) setHideEstimateId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>見積を非表示にする</DialogTitle>
            <DialogDescription>
              「{hideEstimateName}」を非表示にします。非表示にした見積は「非表示を表示」ボタンで確認でき、いつでも元に戻せます。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setHideEstimateId(null)} disabled={hiding}>
              キャンセル
            </Button>
            <Button className="bg-orange-600 hover:bg-orange-700 text-white" onClick={handleHideEstimate} disabled={hiding}>
              {hiding ? <LoaderIcon className="w-4 h-4 mr-1 animate-spin" /> : <EyeOff className="w-4 h-4 mr-1" />}
              非表示にする
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 会社新規登録ダイアログ */}
      <CreateCompanyDialog
        open={companyDialogOpen}
        onOpenChange={setCompanyDialogOpen}
        onCreated={() => router.refresh()}
      />

      {/* 未保存確認ダイアログ */}
      <Dialog open={unsavedDialogOpen} onOpenChange={(v) => { if (!v) cancelDiscard() }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>編集内容が保存されていません</DialogTitle>
            <DialogDescription>
              保存せずに移動すると、編集内容が失われます。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={cancelDiscard}>
              戻る
            </Button>
            <Button variant="destructive" onClick={confirmDiscard}>
              保存せず移動
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

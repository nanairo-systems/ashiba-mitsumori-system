/**
 * [COMPONENT] 現場詳細 - ProjectDetail
 *
 * 現場の基本情報・担当者・見積一覧を表示。
 * 1現場に複数見積を持てる。見積ごとに「当初見積 / 追加見積」の区別あり。
 *
 * 新規見積作成フロー:
 * 1. 「新規見積追加」ボタン → ダイアログ
 * 2. 見積タイトル入力（任意）・種別選択（当初/追加）・テンプレート選択
 * 3. POST /api/estimates → 作成された見積の編集画面へ遷移
 *
 * autoOpenDialog=true の場合（?newEstimate=1 付きでアクセス時）は
 * ページロード直後にダイアログを自動で開く。
 */
"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { formatDate, formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ArrowLeft,
  Plus,
  FileText,
  Building2,
  MapPin,
  User,
  Calendar,
  LayoutTemplate,
  CheckCircle2,
  Loader2,
  ChevronRight,
  ChevronDown,
  FilePlus2,
  Wrench,
  Eye,
  HandshakeIcon,
  CheckSquare,
  Square,
  Pencil,
  Printer,
} from "lucide-react"
import { KeyboardHint } from "@/components/ui/keyboard-hint"
import { useIsMobile } from "@/hooks/use-mobile"
import { ContractProcessingDialog } from "@/components/contracts/ContractProcessingDialog"
import type { ContractEstimateItem } from "@/components/contracts/contract-types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import type { EstimateStatus, ContractStatus, EstimateType, AddressType } from "@prisma/client"
import { EstimateDetail } from "@/components/estimates/EstimateDetail"

// ─── ステータス表示設定 ────────────────────────────────

const statusConfig: Record<EstimateStatus, { label: string; className: string }> = {
  DRAFT: { label: "下書き", className: "bg-orange-100 text-orange-700" },
  CONFIRMED: { label: "確定", className: "bg-blue-100 text-blue-700" },
  SENT: { label: "送付済", className: "bg-green-100 text-green-700" },
  OLD: { label: "旧版", className: "bg-slate-100 text-slate-500" },
}

const contractStatusConfig: Record<ContractStatus, { label: string; className: string }> = {
  CONTRACTED: { label: "契約済", className: "bg-green-100 text-green-700" },
  SCHEDULE_CREATED: { label: "工程作成済", className: "bg-cyan-100 text-cyan-700" },
  IN_PROGRESS: { label: "着工", className: "bg-amber-100 text-amber-700" },
  COMPLETED: { label: "完工", className: "bg-teal-100 text-teal-700" },
  BILLED: { label: "請求済", className: "bg-purple-100 text-purple-700" },
  PAID: { label: "入金済", className: "bg-emerald-100 text-emerald-700" },
  CANCELLED: { label: "キャンセル", className: "bg-red-100 text-red-600" },
}

// ─── 型定義 ────────────────────────────────────────────

interface TemplateItem {
  id: string
  name: string
  quantity: number
  unitPrice: number
  unit: { name: string } | null
}

interface TemplateGroup {
  id: string
  name: string
  items: TemplateItem[]
}

interface TemplateSection {
  id: string
  name: string
  groups: TemplateGroup[]
}

interface Template {
  id: string
  name: string
  description: string | null
  estimateType: "INITIAL" | "ADDITIONAL" | "BOTH"
  sections: TemplateSection[]
}

interface EstimateInProject {
  id: string
  estimateNumber: string | null
  revision: number
  title: string | null
  estimateType: EstimateType
  status: EstimateStatus
  addressType: AddressType
  validDays: number
  note: string | null
  discountAmount: number | null
  createdAt: Date
  confirmedAt: Date | null
  sentAt: Date | null
  user: { id: string; name: string }
  contract: { id: string; status: ContractStatus } | null
  sections: {
    id: string
    name: string
    sortOrder: number
    groups: {
      id: string
      name: string
      items: {
        id: string
        name: string
        quantity: number
        unitPrice: number
        unit: { id: string; name: string }
      }[]
    }[]
  }[]
}

interface ContactOption {
  id: string
  name: string
  phone: string
  email: string
}

interface UnitOption {
  id: string
  name: string
}

interface Props {
  project: {
    id: string
    shortId: string
    name: string
    address: string | null
    startDate: Date | null
    endDate: Date | null
    branch: { name: string; company: { name: string } }
    contact: { id: string; name: string; phone: string; email: string } | null
    estimates: EstimateInProject[]
  }
  templates: Template[]
  currentUser: { id: string; name: string }
  autoOpenDialog?: boolean
  contacts: ContactOption[]
  units: UnitOption[]
  taxRate: number
  embedded?: boolean
  compact?: boolean
  activeEstimateId?: string | null
  onClose?: () => void
  onRefresh?: () => void
  onSelectEstimate?: (estimateId: string) => void
}

// Select の「未設定」用センチネル値（空文字列は Radix UI で不可）
const NO_CONTACT = "__none__"

// ─── 金額計算 ─────────────────────────────────────────

function calcTotal(
  sections: { groups: { items: { quantity: number; unitPrice: number }[] }[] }[]
): number {
  return sections.reduce(
    (s, sec) => s + sec.groups.reduce((gs, g) => gs + g.items.reduce((is, i) => is + i.quantity * i.unitPrice, 0), 0),
    0
  )
}

// ─── メインコンポーネント ───────────────────────────────

export function ProjectDetail({ project, templates, currentUser, autoOpenDialog = false, contacts, units, taxRate, embedded = false, compact = false, activeEstimateId, onClose, onRefresh, onSelectEstimate: onSelectEstimateProp }: Props) {
  const router = useRouter()
  const isMobile = useIsMobile()

  const [internalSelectedEstimateId, setInternalSelectedEstimateId] = useState<string | null>(null)
  const selectedEstimateId = (embedded && onSelectEstimateProp) ? (activeEstimateId ?? null) : internalSelectedEstimateId
  const setSelectedEstimateId = (embedded && onSelectEstimateProp)
    ? (_id: string | null) => {}
    : setInternalSelectedEstimateId

  useEffect(() => {
    if (embedded || isMobile) return
    const el = document.getElementById("app-content")
    if (!el) return
    if (selectedEstimateId) {
      el.classList.remove("max-w-7xl", "mx-auto")
    } else {
      el.classList.add("max-w-7xl", "mx-auto")
    }
    return () => { el.classList.add("max-w-7xl", "mx-auto") }
  }, [selectedEstimateId, embedded, isMobile])

  function refreshData() {
    if (embedded && onRefresh) {
      onRefresh()
    } else {
      router.refresh()
    }
  }

  // ── 編集中の保護 ──────────────────────────────────────
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

  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null)
  const [estimateTitle, setEstimateTitle] = useState("")
  // "INITIAL" = 当初見積, "ADDITIONAL" = 追加見積
  const [estimateType, setEstimateType] = useState<"INITIAL" | "ADDITIONAL">("INITIAL")
  const [creating, setCreating] = useState(false)

  // ── 現場情報編集 ──────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState(project.name)
  const [editAddress, setEditAddress] = useState(project.address ?? "")
  const [editContactId, setEditContactId] = useState(
    project.contact
      ? contacts.find((c) => c.name === project.contact?.name)?.id ?? NO_CONTACT
      : NO_CONTACT
  )
  const [editStartDate, setEditStartDate] = useState(
    project.startDate ? new Date(project.startDate).toISOString().slice(0, 10) : ""
  )
  const [editEndDate, setEditEndDate] = useState(
    project.endDate ? new Date(project.endDate).toISOString().slice(0, 10) : ""
  )
  const [editSaving, setEditSaving] = useState(false)
  const [editFocusField, setEditFocusField] = useState<string | null>(null)
  const editNameRef = useRef<HTMLInputElement>(null)
  const editAddressRef = useRef<HTMLInputElement>(null)
  const editContactRef = useRef<HTMLButtonElement>(null)
  const editStartDateRef = useRef<HTMLInputElement>(null)
  const editEndDateRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editOpen && editFocusField) {
      const timer = setTimeout(() => {
        if (editFocusField === "contact") {
          editContactRef.current?.focus()
        } else {
          const refMap: Record<string, React.RefObject<HTMLInputElement | null>> = {
            name: editNameRef,
            address: editAddressRef,
            startDate: editStartDateRef,
            endDate: editEndDateRef,
          }
          refMap[editFocusField]?.current?.focus()
        }
        setEditFocusField(null)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [editOpen, editFocusField])

  function openEdit(focusField?: string) {
    setEditName(project.name)
    setEditAddress(project.address ?? "")
    setEditContactId(
      project.contact
        ? contacts.find((c) => c.name === project.contact?.name)?.id ?? NO_CONTACT
        : NO_CONTACT
    )
    setEditStartDate(project.startDate ? new Date(project.startDate).toISOString().slice(0, 10) : "")
    setEditEndDate(project.endDate ? new Date(project.endDate).toISOString().slice(0, 10) : "")
    setEditFocusField(focusField ?? "name")
    setEditOpen(true)
  }

  async function handleSaveEdit() {
    if (!editName.trim()) { toast.error("現場名は必須です"); return }
    setEditSaving(true)
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          address: editAddress.trim() || null,
          contactId: editContactId === NO_CONTACT ? null : editContactId,
          startDate: editStartDate || null,
          endDate: editEndDate || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "更新に失敗しました")
      }
      toast.success("現場情報を更新しました")
      setEditOpen(false)
      refreshData()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "エラーが発生しました")
    } finally {
      setEditSaving(false)
    }
  }

  // ── 複数チェック・一括契約・一括印刷 ──────────────────
  const [checkedEstimateIds, setCheckedEstimateIds] = useState<Set<string>>(new Set())
  const [bulkContractOpen, setBulkContractOpen] = useState(false)

  // 契約処理対象：確定済み・送付済みで未契約
  function isContractable(est: EstimateInProject): boolean {
    return !est.contract && (est.status === "CONFIRMED" || est.status === "SENT")
  }

  // 印刷対象：確定済み・送付済み（契約済み含む）
  function isPrintable(est: EstimateInProject): boolean {
    return est.status === "CONFIRMED" || est.status === "SENT"
  }

  // チェックボックスで選択できる（契約処理または印刷できる）
  function isCheckable(est: EstimateInProject): boolean {
    return isContractable(est) || isPrintable(est)
  }

  function toggleCheck(id: string) {
    setCheckedEstimateIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  const checkableEstimates = useMemo(
    () => project.estimates.filter(isCheckable),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project.estimates]
  )

  // 一括印刷：選択中の印刷可能な見積のIDを使う
  function handleBulkPrint() {
    const printIds = project.estimates
      .filter((e) => checkedEstimateIds.has(e.id) && isPrintable(e))
      .map((e) => e.id)
    if (printIds.length === 0) { toast.error("印刷できる見積がありません（確定済み・送付済みのみ印刷できます）"); return }
    window.open(`/estimates/bulk?ids=${printIds.join(",")}`, "_blank")
  }

  // 契約ダイアログ用の items を組み立て
  const contractDialogItems: ContractEstimateItem[] = useMemo(() => {
    return project.estimates
      .filter((e) => checkedEstimateIds.has(e.id) && isContractable(e))
      .map((est, idx) => ({
        estimateId: est.id,
        estimateName: est.title ?? `見積 ${idx + 1}`,
        estimateNumber: est.estimateNumber ?? null,
        projectId: project.id,
        projectName: project.name,
        companyName: project.branch.company.name,
        taxExcludedAmount: calcTotal(est.sections),
        taxRate,
      }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, checkedEstimateIds, taxRate])

  // ?newEstimate=1 で自動オープン
  useEffect(() => {
    if (autoOpenDialog) {
      setDialogOpen(true)
    }
  }, [autoOpenDialog])

  // 見積の連番（タイトル未設定時の表示用）
  const nextEstimateIndex = project.estimates.length + 1

  // ── 見積作成 ──────────────────────────────────────────
  async function handleCreateEstimate() {
    setCreating(true)
    try {
      const res = await fetch("/api/estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          templateId: selectedTemplateId ?? undefined,
          title: estimateTitle.trim() || null,
          estimateType,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast.success(
        selectedTemplateId
          ? "テンプレートから見積を作成しました。内容を確認・編集してください。"
          : "空の見積を作成しました。明細を入力してください。"
      )
      setDialogOpen(false)
      refreshData()
      setSelectedEstimateId(data.id)
    } catch {
      toast.error("見積の作成に失敗しました")
    } finally {
      setCreating(false)
    }
  }

  function openDialog() {
    setSelectedTemplateId(null)
    setEstimateTitle("")
    // 既に見積がある場合は「追加見積」をデフォルトに
    setEstimateType(project.estimates.length > 0 ? "ADDITIONAL" : "INITIAL")
    setDialogOpen(true)
  }

  // 見積種別ごとにグループ化して表示
  const initialEstimates = project.estimates.filter((e) => e.estimateType === "INITIAL")
  const additionalEstimates = project.estimates.filter((e) => e.estimateType === "ADDITIONAL")

  // 選択中の見積データを EstimateDetail 用に変換
  const selectedEstimate = selectedEstimateId
    ? project.estimates.find((e) => e.id === selectedEstimateId) ?? null
    : null

  const estimateDetailData = selectedEstimate
    ? {
        ...selectedEstimate,
        project: {
          id: project.id,
          shortId: project.shortId,
          name: project.name,
          address: project.address,
          startDate: project.startDate,
          endDate: project.endDate,
          branch: project.branch,
          contact: project.contact ? { id: project.contact.id, name: project.contact.name } : null,
        },
      }
    : null

  return (
    <div className={embedded ? "" : "flex gap-0"}>
      {/* 左パネル：現場情報 + 見積一覧 */}
      <div className={embedded ? (compact ? "space-y-3" : "space-y-4") : isMobile ? "space-y-4 flex-1" : `space-y-6 transition-all duration-300 ${selectedEstimateId ? "w-[480px] shrink-0 overflow-y-auto max-h-[calc(100vh-4rem)] pr-6" : "flex-1"}`}>

      {/* ヘッダー */}
      {isMobile && !embedded ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => guardedAction(() => router.push("/"))} className="h-9 px-3 text-sm">
              <ArrowLeft className="w-4 h-4 mr-1" />
              戻る
            </Button>
            <div className="flex-1" />
            <Button size="sm" onClick={() => guardedAction(openDialog)} className="h-9 px-4 text-sm font-semibold">
              <Plus className="w-4 h-4 mr-1" />
              見積追加
            </Button>
          </div>
          <div className="px-1">
            <h1 className="text-xl font-bold text-slate-900 leading-tight">{project.name}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {project.branch.company.name}
              {project.branch.name !== "本社" && ` / ${project.branch.name}`}
            </p>
          </div>
        </div>
      ) : (
      <div className={`flex items-center ${compact ? "gap-1.5 flex-wrap pt-3" : embedded ? "gap-2 flex-wrap pt-4" : "gap-4"}`}>
        {embedded ? (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} className={compact ? "h-7 px-2 text-xs" : ""}>
              <ArrowLeft className={compact ? "w-3.5 h-3.5 mr-0.5" : "w-4 h-4 mr-1"} />
              {compact ? "✕" : "閉じる"}
            </Button>
            {!compact && <KeyboardHint keyName="Esc" label="閉じる" />}
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => guardedAction(() => router.push("/"))}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            一覧に戻る
          </Button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {!compact && <span className="text-xs text-slate-400 font-mono">{project.shortId}</span>}
            <h1 className={`${compact ? "text-base" : embedded ? "text-lg" : "text-2xl"} font-bold text-slate-900 truncate`}>{project.name}</h1>
          </div>
          <p className={`${compact ? "text-xs" : "text-sm"} text-slate-500 mt-0.5 truncate`}>
            {project.branch.company.name}
            {project.branch.name !== "本社" && ` / ${project.branch.name}`}
          </p>
        </div>
        <Button size="sm" onClick={() => guardedAction(openDialog)} className={compact ? "h-7 px-2 text-xs" : ""}>
          <Plus className={compact ? "w-3 h-3 mr-0.5" : "w-4 h-4 mr-1"} />
          {compact ? "追加" : "見積を追加"}
        </Button>
      </div>
      )}

      {/* 現場情報カード */}
      {isMobile && !embedded ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">現場情報</span>
            <button onClick={() => openEdit("name")} className="text-xs text-blue-500 hover:text-blue-700 transition-colors flex items-center gap-1 font-medium">
              <Pencil className="w-3.5 h-3.5" />
              編集
            </button>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-slate-700">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="font-medium">{project.branch.company.name}{project.branch.name !== "本社" && ` / ${project.branch.name}`}</span>
          </div>
          {project.address && (
            <div className="flex items-center gap-2.5 text-sm text-slate-700">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{project.address}</span>
            </div>
          )}
          {project.contact && (
            <div className="flex items-center gap-2.5 text-sm text-slate-700">
              <User className="w-4 h-4 text-slate-400 shrink-0" />
              <span>{project.contact.name}</span>
              {project.contact.phone && <span className="text-slate-400 text-sm">/ {project.contact.phone}</span>}
            </div>
          )}
          {(project.startDate || project.endDate) && (
            <div className="flex items-center gap-2.5 text-sm text-slate-700">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                {project.startDate ? formatDate(project.startDate, "yyyy/MM/dd") : "未定"}
                {" 〜 "}
                {project.endDate ? formatDate(project.endDate, "yyyy/MM/dd") : "未定"}
              </span>
            </div>
          )}
        </div>
      ) : compact ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">現場情報</span>
            <button onClick={() => openEdit("name")} className="text-[10px] text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-0.5">
              <Pencil className="w-2.5 h-2.5" />
              編集
            </button>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">{project.branch.company.name}{project.branch.name !== "本社" && ` / ${project.branch.name}`}</span>
          </div>
          {project.address && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate">{project.address}</span>
            </div>
          )}
          {project.contact && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <User className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate">{project.contact.name}</span>
              {project.contact.phone && <span className="text-slate-400">/ {project.contact.phone}</span>}
            </div>
          )}
          {(project.startDate || project.endDate) && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
              <span>
                {project.startDate ? formatDate(project.startDate, "yyyy/MM/dd") : "未定"}
                {" 〜 "}
                {project.endDate ? formatDate(project.endDate, "yyyy/MM/dd") : "未定"}
              </span>
            </div>
          )}
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-500">基本情報</CardTitle>
              <button
                onClick={() => openEdit("name")}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition-colors px-2 py-1 rounded hover:bg-blue-50"
              >
                <Pencil className="w-3 h-3" />
                編集
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span className="text-slate-600">会社:</span>
              <span className="font-medium">{project.branch.company.name}</span>
              {project.branch.name !== "本社" && (
                <span className="text-slate-400">/ {project.branch.name}</span>
              )}
            </div>
            {project.address ? (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600">住所:</span>
                <span>{project.address}</span>
              </div>
            ) : (
              <button
                onClick={() => openEdit("address")}
                className="flex items-center gap-2 text-sm px-3 py-1.5 -mx-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors w-full"
              >
                <MapPin className="w-4 h-4 text-amber-500" />
                <span className="font-medium">現場住所が未設定です</span>
                <span className="ml-auto text-xs text-amber-500">クリックして追加</span>
              </button>
            )}
            {(project.startDate || project.endDate) && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600">工期:</span>
                <span>
                  {project.startDate ? formatDate(project.startDate, "yyyy/MM/dd") : "未定"}
                  {" 〜 "}
                  {project.endDate ? formatDate(project.endDate, "yyyy/MM/dd") : "未定"}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-500">先方担当者</CardTitle>
              <button
                onClick={() => openEdit("contact")}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-blue-600 transition-colors px-2 py-1 rounded hover:bg-blue-50"
              >
                <Pencil className="w-3 h-3" />
                編集
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {project.contact ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="font-medium">{project.contact.name}</span>
                </div>
                {project.contact.phone && (
                  <p className="text-sm text-slate-500 pl-6">{project.contact.phone}</p>
                )}
                {project.contact.email && (
                  <p className="text-sm text-slate-500 pl-6">{project.contact.email}</p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <User className="w-4 h-4" />
                <span>担当者未設定</span>
                {contacts.length > 0 && (
                  <button onClick={() => openEdit("contact")} className="text-blue-500 hover:underline text-xs">設定</button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      {/* 見積一覧 */}
      {isMobile && !embedded ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-400" />
              <span className="text-base font-bold text-slate-700">見積一覧</span>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-semibold">{project.estimates.length}件</span>
            </div>
            {checkableEstimates.length > 0 && checkedEstimateIds.size > 0 && (
              <span className="text-xs text-green-600 font-semibold">{checkedEstimateIds.size}件選択</span>
            )}
          </div>
          {project.estimates.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <p className="text-sm">見積がまだありません</p>
              <Button variant="outline" size="sm" className="mt-3 h-9 text-sm px-4" onClick={openDialog}>
                <Plus className="w-4 h-4 mr-1" />
                作成
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {project.estimates.map((est, idx) => {
                const { label, className: statusClass } = est.contract
                  ? contractStatusConfig[est.contract.status]
                  : statusConfig[est.status]
                const total = calcTotal(est.sections)
                const displayTitle = est.title ?? (project.estimates.length === 1 ? "見積" : `見積 ${idx + 1}`)
                const checkable = isCheckable(est)
                const isChecked = checkedEstimateIds.has(est.id)
                const isSelected = selectedEstimateId === est.id
                const isOld = est.status === "OLD"
                const selectFn = embedded && onSelectEstimateProp ? onSelectEstimateProp : (embedded || isMobile) ? (id: string) => router.push(`/estimates/${id}`) : setSelectedEstimateId

                return (
                  <div
                    key={est.id}
                    className={`rounded-xl border-2 px-4 py-3 cursor-pointer transition-all ${
                      isSelected ? "border-blue-400 bg-blue-50 shadow-sm" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    } ${isOld ? "opacity-50" : ""} ${isChecked ? "bg-green-50/60 border-green-300" : ""}`}
                    onClick={() => guardedAction(() => selectFn(est.id))}
                  >
                    <div className="flex items-center gap-2.5">
                      {checkable && (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleCheck(est.id) }}
                          className={`w-7 h-7 shrink-0 rounded flex items-center justify-center transition-colors ${isChecked ? "text-green-600" : "text-slate-300 hover:text-slate-500"}`}
                        >
                          {isChecked ? <CheckSquare className="w-6 h-6" /> : <Square className="w-6 h-6" />}
                        </button>
                      )}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold shrink-0 ${statusClass}`}>
                        {label}
                      </span>
                      <span className="text-sm font-semibold text-slate-800 truncate flex-1">{displayTitle}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1.5 ml-0">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        {est.estimateType === "ADDITIONAL" && <span className="text-amber-500 font-semibold">追加</span>}
                        <span>{est.user.name}</span>
                        <span>{formatDate(est.createdAt, "MM/dd")}</span>
                        {est.confirmedAt && <span className="text-green-600 font-medium">確定: {formatDate(est.confirmedAt, "MM/dd")}</span>}
                      </div>
                      <span className="font-mono text-base font-bold text-slate-900 shrink-0">¥{formatCurrency(total)}</span>
                    </div>
                  </div>
                )
              })}

              {project.estimates.length > 1 && (
                <div className="flex justify-between items-center px-4 py-3 rounded-xl bg-slate-800 text-white">
                  <span className="text-sm font-bold">合計（税抜）</span>
                  <span className="font-mono text-lg font-bold">
                    ¥{formatCurrency(project.estimates.reduce((s, e) => s + calcTotal(e.sections), 0))}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      ) : compact ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500">見積一覧</span>
              <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{project.estimates.length}件</span>
            </div>
            {checkableEstimates.length > 0 && checkedEstimateIds.size > 0 && (
              <span className="text-[10px] text-green-600 font-medium">{checkedEstimateIds.size}件選択</span>
            )}
          </div>
          {project.estimates.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p className="text-xs">見積がまだありません</p>
              <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={openDialog}>
                <Plus className="w-3 h-3 mr-1" />
                作成
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              {project.estimates.map((est, idx) => {
                const { label, className: statusClass } = est.contract
                  ? contractStatusConfig[est.contract.status]
                  : statusConfig[est.status]
                const total = calcTotal(est.sections)
                const displayTitle = est.title ?? (project.estimates.length === 1 ? "見積" : `見積 ${idx + 1}`)
                const checkable = isCheckable(est)
                const isChecked = checkedEstimateIds.has(est.id)
                const isSelected = selectedEstimateId === est.id
                const isOld = est.status === "OLD"
                const selectFn = embedded && onSelectEstimateProp ? onSelectEstimateProp : (embedded || isMobile) ? (id: string) => router.push(`/estimates/${id}`) : setSelectedEstimateId

                return (
                  <div
                    key={est.id}
                    className={`rounded-lg border px-3 py-2 cursor-pointer transition-all ${
                      isSelected ? "border-blue-400 bg-blue-50 shadow-sm" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    } ${isOld ? "opacity-50" : ""} ${isChecked ? "bg-green-50/60 border-green-300" : ""}`}
                    onClick={() => guardedAction(() => selectFn(est.id))}
                  >
                    <div className="flex items-center gap-2">
                      {checkable && (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleCheck(est.id) }}
                          className={`w-6 h-6 shrink-0 rounded flex items-center justify-center transition-colors ${isChecked ? "text-green-600" : "text-slate-300 hover:text-slate-500"}`}
                        >
                          {isChecked ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                        </button>
                      )}
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${statusClass}`}>
                        {label}
                      </span>
                      <span className="text-xs font-medium text-slate-700 truncate flex-1">{displayTitle}</span>
                      <span className="font-mono text-xs font-semibold text-slate-800 shrink-0">¥{formatCurrency(total)}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 ml-0 text-[10px] text-slate-400">
                      {est.estimateType === "ADDITIONAL" && <span className="text-amber-500 font-medium">追加</span>}
                      <span>{est.user.name}</span>
                      <span>{formatDate(est.createdAt, "MM/dd")}</span>
                      {est.confirmedAt && <span className="text-green-600">確定: {formatDate(est.confirmedAt, "MM/dd")}</span>}
                    </div>
                  </div>
                )
              })}

              {project.estimates.length > 1 && (
                <div className="flex justify-between items-center px-3 py-2 rounded-lg bg-slate-100 border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500">合計（税抜）</span>
                  <span className="font-mono text-xs font-bold text-slate-900">
                    ¥{formatCurrency(project.estimates.reduce((s, e) => s + calcTotal(e.sections), 0))}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 flex-wrap">
            <FileText className="w-5 h-5" />
            見積一覧
            <Badge variant="secondary" className="ml-2">
              {project.estimates.length}件
            </Badge>
            {checkableEstimates.length > 0 && (
              <span className="ml-auto flex items-center gap-2">
                {checkedEstimateIds.size > 0 ? (
                  <>
                    <span className="text-sm font-normal text-green-700">
                      {checkedEstimateIds.size}件選択中
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setCheckedEstimateIds(new Set())}
                    >
                      選択解除
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-blue-600 border-blue-300 hover:bg-blue-50"
                      onClick={handleBulkPrint}
                    >
                      <Printer className="w-3.5 h-3.5 mr-1" />
                      一括印刷
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => {
                        const contractable = project.estimates.filter(
                          (e) => checkedEstimateIds.has(e.id) && isContractable(e)
                        )
                        if (contractable.length === 0) { toast.error("契約処理できる見積がありません（確定済み・未契約のみ）"); return }
                        setBulkContractOpen(true)
                      }}
                    >
                      <HandshakeIcon className="w-3.5 h-3.5 mr-1" />
                      一括契約処理
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs text-slate-500"
                    onClick={() => setCheckedEstimateIds(new Set(checkableEstimates.map((e) => e.id)))}
                  >
                    <CheckSquare className="w-3.5 h-3.5 mr-1" />
                    全件選択
                  </Button>
                )}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {project.estimates.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <LayoutTemplate className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p>見積がまだありません</p>
              <p className="text-xs mt-1">「見積を追加」ボタンから作成できます</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={openDialog}>
                <Plus className="w-4 h-4 mr-2" />
                最初の見積を作成する
              </Button>
            </div>
          ) : (
            <div>
              {/* 当初見積 */}
              {initialEstimates.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                    <FilePlus2 className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">当初見積</span>
                    <span className="text-xs text-slate-400">{initialEstimates.length}件</span>
                  </div>
                  <EstimateTable
                    estimates={initialEstimates}
                    projectEstimateCount={project.estimates.length}
                    startIndex={0}
                    checkedIds={checkedEstimateIds}
                    onToggleCheck={toggleCheck}
                    isCheckable={isCheckable}
                    selectedEstimateId={selectedEstimateId}
                    onSelectEstimate={embedded && onSelectEstimateProp ? onSelectEstimateProp : (embedded || isMobile) ? (id: string) => router.push(`/estimates/${id}`) : setSelectedEstimateId}
                    isEditing={isEstimateEditing}
                    onGuardedSelect={(id) => guardedAction(() => embedded && onSelectEstimateProp ? onSelectEstimateProp(id) : (embedded || isMobile) ? router.push(`/estimates/${id}`) : setSelectedEstimateId(id))}
                  />
                </>
              )}

              {/* 追加見積 */}
              {additionalEstimates.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                    <Wrench className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">追加見積</span>
                    <span className="text-xs text-amber-600">{additionalEstimates.length}件</span>
                  </div>
                  <EstimateTable
                    estimates={additionalEstimates}
                    projectEstimateCount={project.estimates.length}
                    startIndex={initialEstimates.length}
                    checkedIds={checkedEstimateIds}
                    onToggleCheck={toggleCheck}
                    isCheckable={isCheckable}
                    selectedEstimateId={selectedEstimateId}
                    onSelectEstimate={embedded && onSelectEstimateProp ? onSelectEstimateProp : (embedded || isMobile) ? (id: string) => router.push(`/estimates/${id}`) : setSelectedEstimateId}
                    isEditing={isEstimateEditing}
                    onGuardedSelect={(id) => guardedAction(() => embedded && onSelectEstimateProp ? onSelectEstimateProp(id) : (embedded || isMobile) ? router.push(`/estimates/${id}`) : setSelectedEstimateId(id))}
                  />
                </>
              )}

              {/* 合計行 */}
              {project.estimates.length > 1 && (
                <div className="flex justify-between items-center px-4 py-3 bg-slate-50 border-t-2 border-slate-200">
                  <span className="text-sm font-semibold text-slate-700">合計（全見積 税抜）</span>
                  <span className="font-mono font-bold text-slate-900">
                    ¥{formatCurrency(project.estimates.reduce((s, e) => s + calcTotal(e.sections), 0))}
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* ── 現場情報編集ダイアログ ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4" />
              現場情報を編集
            </DialogTitle>
            <DialogDescription>
              住所・担当者・工期を変更できます。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>現場名 <span className="text-red-500">*</span></Label>
              <Input
                ref={editNameRef}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="例：〇〇ビル改修工事"
              />
            </div>
            <div className="space-y-1.5">
              <Label>住所</Label>
              <Input
                ref={editAddressRef}
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                placeholder="例：東京都渋谷区〇〇1-1-1"
              />
            </div>
            <div className="space-y-1.5">
              <Label>先方担当者</Label>
              {contacts.length > 0 ? (
                <Select
                  value={editContactId}
                  onValueChange={setEditContactId}
                >
                  <SelectTrigger ref={editContactRef}>
                    <SelectValue placeholder="担当者を選択（任意）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CONTACT}>未設定</SelectItem>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.phone && <span className="text-slate-400 ml-2 text-xs">{c.phone}</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-slate-400 py-1">
                  担当者が登録されていません。マスター管理で追加できます。
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>着工予定日</Label>
                <Input
                  ref={editStartDateRef}
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>完工予定日</Label>
                <Input
                  ref={editEndDateRef}
                  type="date"
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving}>
              キャンセル
            </Button>
            <Button onClick={handleSaveEdit} disabled={editSaving}>
              {editSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />保存中...</> : "保存する"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 契約処理ダイアログ（共通モジュール） */}
      <ContractProcessingDialog
        open={bulkContractOpen}
        onOpenChange={setBulkContractOpen}
        items={contractDialogItems}
        mode="individual"
        onCompleted={() => {
          setCheckedEstimateIds(new Set())
          refreshData()
        }}
      />

      {/* 新規見積作成ダイアログ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              見積を追加
            </DialogTitle>
            <DialogDescription>
              {project.name} に新しい見積を作成します。
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-5 pr-1">
            {/* 見積のタイトル入力 */}
            <div className="space-y-1.5">
              <Label htmlFor="est-title">見積タイトル（任意）</Label>
              <Input
                id="est-title"
                placeholder={`例: A棟工事、追加養生、見積${nextEstimateIndex}`}
                value={estimateTitle}
                onChange={(e) => setEstimateTitle(e.target.value)}
              />
              <p className="text-xs text-slate-400">
                未入力の場合は「見積{nextEstimateIndex}」として表示されます
              </p>
            </div>

            {/* 見積種別 */}
            <div className="space-y-2">
              <Label>見積の種別</Label>
              <div className="grid grid-cols-2 gap-3">
                {/* 当初見積 */}
                <button
                  type="button"
                  onClick={() => { setEstimateType("INITIAL"); setSelectedTemplateId(null) }}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    estimateType === "INITIAL"
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <FilePlus2 className="w-4 h-4 text-blue-500" />
                    <span className="font-medium text-sm">当初見積</span>
                    {estimateType === "INITIAL" && (
                      <CheckCircle2 className="w-4 h-4 text-blue-500 ml-auto" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500">工事開始前の通常の見積</p>
                </button>

                {/* 追加見積 */}
                <button
                  type="button"
                  onClick={() => { setEstimateType("ADDITIONAL"); setSelectedTemplateId(null) }}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    estimateType === "ADDITIONAL"
                      ? "border-amber-500 bg-amber-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Wrench className="w-4 h-4 text-amber-500" />
                    <span className="font-medium text-sm">追加見積</span>
                    {estimateType === "ADDITIONAL" && (
                      <CheckCircle2 className="w-4 h-4 text-amber-500 ml-auto" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500">工事開始後の追加・変更工事</p>
                </button>
              </div>
            </div>

            {/* テンプレート選択 */}
            <div className="space-y-2">
              <Label>テンプレート</Label>
              {/* 空の見積 */}
              <button
                type="button"
                onClick={() => setSelectedTemplateId(null)}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                  selectedTemplateId === null
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center ${selectedTemplateId === null ? "bg-blue-500" : "bg-slate-200"}`}>
                    {selectedTemplateId === null ? <CheckCircle2 className="w-4 h-4 text-white" /> : <FileText className="w-3.5 h-3.5 text-slate-500" />}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-slate-900">空の見積から作成</p>
                    <p className="text-xs text-slate-500">一から明細を入力する</p>
                  </div>
                </div>
              </button>

              {/* テンプレート一覧（選択した見積種別に応じてフィルタ） */}
              {(() => {
                const filteredTemplates = templates.filter((tpl) =>
                  tpl.estimateType === "BOTH" || tpl.estimateType === estimateType
                )
                return filteredTemplates.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-400 px-1">
                    テンプレートから作成（{estimateType === "INITIAL" ? "当初" : "追加"}見積用）
                  </p>
                  {filteredTemplates.map((tpl) => {
                    const isSelected = selectedTemplateId === tpl.id
                    const isPreviewing = previewTemplateId === tpl.id
                    const total = calcTotal(tpl.sections)
                    const itemCount = tpl.sections.reduce(
                      (s, sec) => s + sec.groups.reduce((gs, g) => gs + g.items.length, 0), 0
                    )
                    return (
                      <div
                        key={tpl.id}
                        className={`rounded-xl border-2 transition-all overflow-hidden ${isSelected ? "border-blue-500 shadow-sm shadow-blue-100" : "border-slate-200"}`}
                      >
                        {/* テンプレートカードヘッダー（カード全体クリックで選択） */}
                        <button
                          type="button"
                          onClick={() => setSelectedTemplateId(isSelected ? null : tpl.id)}
                          className={`w-full flex items-start gap-3 p-3 text-left ${isSelected ? "bg-blue-50" : "bg-white hover:bg-slate-50"} transition-colors`}
                        >
                          {/* 選択チェック */}
                          <span
                            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors ${isSelected ? "bg-blue-500" : "bg-slate-200"}`}
                          >
                            {isSelected ? <CheckCircle2 className="w-4 h-4 text-white" /> : <LayoutTemplate className="w-3.5 h-3.5 text-slate-500" />}
                          </span>

                          {/* テンプレート名・説明 */}
                          <span className="flex-1 min-w-0">
                            <span className={`block font-medium text-sm ${isSelected ? "text-blue-800" : "text-slate-800"}`}>{tpl.name}</span>
                            {tpl.description && (
                              <span className="block text-xs text-slate-500 mt-0.5">{tpl.description}</span>
                            )}
                            <span className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-slate-400">
                                {tpl.sections.length}セクション / {itemCount}項目
                              </span>
                              {total > 0 && (
                                <span className="text-xs font-mono text-slate-500">
                                  参考: ¥{formatCurrency(total)}〜
                                </span>
                              )}
                            </span>
                          </span>

                          {/* 中身を見るボタン（クリックが親のbutton bubbleに行かないよう stopPropagation） */}
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (isPreviewing) {
                                setPreviewTemplateId(null)
                              } else {
                                setPreviewTemplateId(tpl.id)
                                setSelectedTemplateId(tpl.id) // プレビューを開いたら自動で選択
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                e.stopPropagation()
                                if (isPreviewing) {
                                  setPreviewTemplateId(null)
                                } else {
                                  setPreviewTemplateId(tpl.id)
                                  setSelectedTemplateId(tpl.id)
                                }
                              }
                            }}
                            className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                              isPreviewing
                                ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            <Eye className="w-3 h-3" />
                            {isPreviewing ? "閉じる" : "中身を見る"}
                            {isPreviewing ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          </span>
                        </button>

                        {/* テンプレート中身プレビュー */}
                        {isPreviewing && (
                          <div className="border-t border-slate-100 bg-slate-50 px-3 py-3 space-y-3">
                            {tpl.sections.map((sec) => (
                              <div key={sec.id}>
                                {/* セクション名 */}
                                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                                  {sec.name}
                                </p>
                                {sec.groups.map((grp) => (
                                  <div key={grp.id} className="mb-2 ml-3">
                                    {/* グループ名 */}
                                    <p className="text-xs font-semibold text-slate-500 mb-1">{grp.name}</p>
                                    {/* 明細一覧 */}
                                    <div className="rounded-lg overflow-hidden border border-slate-200">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="bg-slate-100 text-slate-500">
                                            <th className="text-left px-2 py-1 font-medium">品名</th>
                                            <th className="text-right px-2 py-1 font-medium w-16">数量</th>
                                            <th className="text-left px-2 py-1 font-medium w-12">単位</th>
                                            <th className="text-right px-2 py-1 font-medium w-24">単価</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                          {grp.items.map((item) => (
                                            <tr key={item.id}>
                                              <td className="px-2 py-1.5 text-slate-700">{item.name}</td>
                                              <td className="px-2 py-1.5 text-right text-slate-600 font-mono">
                                                {item.quantity > 0 ? item.quantity : "—"}
                                              </td>
                                              <td className="px-2 py-1.5 text-slate-500">
                                                {item.unit?.name ?? "—"}
                                              </td>
                                              <td className="px-2 py-1.5 text-right text-slate-700 font-mono">
                                                ¥{formatCurrency(item.unitPrice)}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ))}
                            {/* プレビュー内に「このテンプレートで作成」ボタン */}
                            <div className="pt-2 border-t border-slate-200 flex justify-end">
                              <Button
                                size="sm"
                                onClick={handleCreateEstimate}
                                disabled={creating}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8"
                              >
                                {creating ? (
                                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />作成中...</>
                                ) : (
                                  <><Plus className="w-3.5 h-3.5 mr-1.5" />このテンプレートで作成</>
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
              })()}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)} disabled={creating}>
              キャンセル
            </Button>
            <Button className="flex-1" onClick={handleCreateEstimate} disabled={creating}>
              {creating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />作成中...</>
              ) : (
                <><Plus className="w-4 h-4 mr-2" />{selectedTemplateId ? "このテンプレートで作成" : "空の見積で作成"}</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>

      {/* 右パネル：見積詳細（embedded・モバイル時は入れ子パネルなし） */}
      {!embedded && !isMobile && selectedEstimateId && estimateDetailData && (
        <div className="flex-1 min-w-0 border-l border-slate-200 bg-white shadow-sm">
          <div className="max-h-[calc(100vh-4rem)] overflow-y-auto px-6 pb-8">
            <EstimateDetail
              key={selectedEstimateId}
              estimate={estimateDetailData}
              taxRate={taxRate}
              units={units}
              currentUser={currentUser}
              contacts={contacts}
              embedded
              onClose={() => guardedAction(() => setSelectedEstimateId(null))}
              onNavigateEstimate={(id) => guardedAction(() => setSelectedEstimateId(id))}
              onEditingChange={setIsEstimateEditing}
              onRefresh={() => refreshData()}
            />
          </div>
        </div>
      )}

      {/* 未保存確認ダイアログ */}
      <Dialog open={unsavedDialogOpen} onOpenChange={(v) => { if (!v) cancelDiscard() }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-orange-600 flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              編集中の内容があります
            </DialogTitle>
            <DialogDescription>
              保存されていない変更があります。このまま移動すると編集中の内容は失われます。
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={cancelDiscard}>
              編集に戻る
            </Button>
            <Button variant="destructive" className="flex-1" onClick={confirmDiscard}>
              保存せずに移動
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* フローティング一括操作バー（モバイル・コンパクト用） */}
      {(isMobile || compact) && checkedEstimateIds.size > 0 && (
        <div className={`fixed ${embedded ? "bottom-4" : "bottom-16"} left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-slate-900 text-white ${isMobile && !embedded ? "px-4 py-2.5" : "px-3 py-2"} rounded-full shadow-2xl shadow-slate-900/40 border border-slate-700 animate-in slide-in-from-bottom-4 duration-200`}>
          <div className="flex items-center gap-1.5">
            <CheckSquare className={`${isMobile ? "w-4 h-4" : "w-3.5 h-3.5"} text-green-400`} />
            <span className={`font-semibold ${isMobile ? "text-sm" : "text-xs"}`}>
              {checkedEstimateIds.size}件選択
            </span>
          </div>
          <div className={`w-px ${isMobile ? "h-5" : "h-4"} bg-slate-700`} />
          <button
            onClick={() => {
              const allIds = new Set(checkableEstimates.map((e) => e.id))
              setCheckedEstimateIds(allIds)
            }}
            className={`${isMobile ? "text-xs" : "text-[11px]"} text-slate-300 hover:text-white transition-colors`}
          >
            全選択
          </button>
          <button
            onClick={() => setCheckedEstimateIds(new Set())}
            className={`${isMobile ? "text-xs" : "text-[11px]"} text-slate-300 hover:text-white transition-colors`}
          >
            解除
          </button>
          <Button
            size="sm"
            onClick={handleBulkPrint}
            className={`bg-blue-500 hover:bg-blue-400 text-white ${isMobile ? "h-8 px-3.5" : "h-7 px-3"} rounded-full font-semibold ${isMobile ? "text-sm" : "text-xs"}`}
          >
            <Printer className={`${isMobile ? "w-3.5 h-3.5" : "w-3 h-3"} mr-1`} />
            印刷
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const contractable = project.estimates.filter(
                (e) => checkedEstimateIds.has(e.id) && isContractable(e)
              )
              if (contractable.length === 0) { toast.error("契約処理できる見積がありません（確定済み・未契約のみ）"); return }
              setBulkContractOpen(true)
            }}
            className={`bg-green-500 hover:bg-green-400 text-white ${isMobile ? "h-8 px-3.5" : "h-7 px-3"} rounded-full font-semibold ${isMobile ? "text-sm" : "text-xs"}`}
          >
            <HandshakeIcon className={`${isMobile ? "w-3.5 h-3.5" : "w-3 h-3"} mr-1`} />
            契約
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── 見積テーブル（種別ごとに共通） ─────────────────────

function EstimateTable({
  estimates,
  projectEstimateCount,
  startIndex,
  checkedIds,
  onToggleCheck,
  isCheckable: checkableFn,
  selectedEstimateId,
  onSelectEstimate,
  isEditing,
  onGuardedSelect,
}: {
  estimates: EstimateInProject[]
  projectEstimateCount: number
  startIndex: number
  checkedIds: Set<string>
  onToggleCheck: (id: string) => void
  isCheckable: (est: EstimateInProject) => boolean
  selectedEstimateId: string | null
  onSelectEstimate: (id: string) => void
  isEditing: boolean
  onGuardedSelect: (id: string) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-white">
          <TableHead className="w-10" />
          <TableHead className="w-[180px]">見積タイトル</TableHead>
          <TableHead>ステータス</TableHead>
          <TableHead>金額（税抜）</TableHead>
          <TableHead>確定日</TableHead>
          <TableHead>作成者</TableHead>
          <TableHead>作成日</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {estimates.map((est, idx) => {
          const { label, className } = est.contract
            ? contractStatusConfig[est.contract.status]
            : statusConfig[est.status]
          const total = calcTotal(est.sections)
          const displayTitle = est.title
            ?? (projectEstimateCount === 1 ? "見積" : `見積 ${startIndex + idx + 1}`)
          const checkable = checkableFn(est)
          const isChecked = checkedIds.has(est.id)
          const isSelected = selectedEstimateId === est.id

          const isOld = est.status === "OLD"

          return (
            <TableRow
              key={est.id}
              className={`cursor-pointer transition-colors ${isOld ? "opacity-50 hover:opacity-70 hover:bg-slate-50" : "hover:bg-slate-50"} ${isChecked ? "bg-green-50/50" : ""} ${isSelected ? "bg-blue-50 ring-1 ring-inset ring-blue-300" : ""}`}
              onClick={() => onGuardedSelect(est.id)}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                {checkable ? (
                  <button
                    onClick={() => onToggleCheck(est.id)}
                    className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
                      isChecked ? "text-green-600 hover:text-green-700" : "text-slate-300 hover:text-slate-500"
                    }`}
                    title={isChecked ? "選択解除" : "契約処理に追加"}
                  >
                    {isChecked ? <CheckSquare className="w-4.5 h-4.5" /> : <Square className="w-4.5 h-4.5" />}
                  </button>
                ) : null}
              </TableCell>
              <TableCell>
                <span className={`font-medium text-sm ${isOld ? "text-slate-400" : "text-blue-600"}`}>
                  {displayTitle}
                </span>
                {est.estimateNumber && (
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{est.estimateNumber}</p>
                )}
              </TableCell>
              <TableCell>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>
                  {label}
                </span>
              </TableCell>
              <TableCell className="font-mono text-sm">¥{formatCurrency(total)}</TableCell>
              <TableCell className="text-sm text-slate-500">
                {est.confirmedAt ? formatDate(est.confirmedAt, "yyyy/MM/dd") : "—"}
              </TableCell>
              <TableCell className="text-sm text-slate-600">{est.user.name}</TableCell>
              <TableCell className="text-sm text-slate-500">
                {formatDate(est.createdAt, "yyyy/MM/dd")}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

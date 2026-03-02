/**
 * [COMPONENT] 現場・見積一覧 - ProjectList
 *
 * 会社ごとにグループ化して現場を表示する。
 * 1現場につき複数見積に対応。現場をヘッダー行とし、見積をサブ行で表示する。
 *
 * 状況表示ルール:
 *   見積サブ行 → 各見積の状況
 *   現場ヘッダー → 合計金額 + 見積件数バッジ
 */
"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { formatDate, formatCurrency, formatCompanyPaymentTerms } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Plus,
  Search,
  Archive,
  MoreHorizontal,
  Eye,
  FileText,
  HandshakeIcon,
  ChevronDown,
  ChevronRight,
  Building2,
  FilePlus2,
  CheckSquare,
  Square,
  Tag,
  User2,
  X,
  MapPin,
  Calendar,
} from "lucide-react"
import { toast } from "sonner"
import { Loader2 as LoaderIcon } from "lucide-react"
import { EstimateDetail } from "@/components/estimates/EstimateDetail"
import type { EstimateStatus, EstimateType } from "@prisma/client"

// ─── 型定義 ────────────────────────────────────────────

interface EstimateRow {
  id: string
  title: string | null
  estimateType: EstimateType
  status: EstimateStatus
  confirmedAt: Date | null
  createdAt: Date
  user: { id: string; name: string }
  totalAmount: number
}

interface Project {
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
}

// ─── 定数 ──────────────────────────────────────────────

const EST_STATUS_LABEL: Record<EstimateStatus, string> = {
  DRAFT: "下書き",
  CONFIRMED: "確定済",
  SENT: "送付済",
  OLD: "旧版",
}

// フィルタータグ用の短縮ラベル（2文字）
const EST_STATUS_SHORT: Record<EstimateStatus, string> = {
  DRAFT: "下書",
  CONFIRMED: "確定",
  SENT: "送付",
  OLD: "旧版",
}

const EST_STATUS_STYLE: Record<EstimateStatus, string> = {
  DRAFT: "bg-amber-500 text-white",
  CONFIRMED: "bg-blue-500 text-white",
  SENT: "bg-emerald-500 text-white",
  OLD: "bg-orange-400 text-white",
}

// 追加見積ラベル
const EST_TYPE_STYLE: Record<EstimateType, { label: string; className: string } | null> = {
  INITIAL: null, // 表示なし
  ADDITIONAL: { label: "追加", className: "bg-amber-100 text-amber-700 border border-amber-300" },
}

// ─── 契約処理ダイアログ ────────────────────────────────

interface ContractDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  project: Project
  estimate: EstimateRow
  onContracted: () => void
}

function ContractDialog({ open, onOpenChange, project, estimate, onContracted }: ContractDialogProps) {
  const totalAmount = estimate.totalAmount
  const taxExcluded = Math.round(totalAmount / 1.1)
  const taxAmount = totalAmount - taxExcluded

  // 会社マスターから支払条件テキストを自動生成（画面非表示、APIに自動送信）
  const companyPaymentTerms = formatCompanyPaymentTerms({
    paymentClosingDay: project.branch.company.paymentClosingDay,
    paymentMonthOffset: project.branch.company.paymentMonthOffset,
    paymentPayDay: project.branch.company.paymentPayDay,
    paymentNetDays: project.branch.company.paymentNetDays,
  })

  const today = new Date().toISOString().slice(0, 10)
  const [contractDate, setContractDate] = useState(today)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!contractDate) { toast.error("契約日を入力してください"); return }
    setLoading(true)
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          estimateId: estimate.id,
          contractAmount: taxExcluded,
          taxAmount,
          totalAmount,
          contractDate,
          startDate: startDate || null,
          endDate: endDate || null,
          paymentTerms: companyPaymentTerms || null,
          note: note || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "契約処理に失敗しました")
      }
      toast.success("契約処理が完了しました")
      onOpenChange(false)
      onContracted()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "エラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  const estLabel = estimate.title ?? EST_STATUS_LABEL[estimate.status]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandshakeIcon className="w-5 h-5 text-green-600" />
            契約処理
          </DialogTitle>
          <DialogDescription>
            {project.branch.company.name} / {project.name}
            {estimate.title && ` — ${estLabel}`}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1 text-sm">
          <div className="flex justify-between text-slate-500">
            <span>税抜金額</span>
            <span className="font-mono">¥{formatCurrency(taxExcluded)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>消費税（10%）</span>
            <span className="font-mono">¥{formatCurrency(taxAmount)}</span>
          </div>
          <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
            <span>契約金額（税込）</span>
            <span className="font-mono text-base">¥{formatCurrency(totalAmount)}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">契約日 <span className="text-red-500">*</span></Label>
            <Input type="date" value={contractDate} onChange={(e) => setContractDate(e.target.value)} className="text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">着工予定日</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">完工予定日</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">備考</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="特記事項があれば入力" rows={2} className="text-sm resize-none" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>キャンセル</Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-green-600 hover:bg-green-700">
            <HandshakeIcon className="w-4 h-4 mr-2" />
            {loading ? "処理中..." : "契約を確定する"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── 一括契約処理ダイアログ ───────────────────────────────

interface BulkContractItem {
  estimateId: string
  estimateName: string
  projectId: string
  projectName: string
  companyName: string
  totalAmount: number
}

interface BulkContractDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  items: BulkContractItem[]
  onCompleted: () => void
}

function BulkContractDialog({ open, onOpenChange, items, onCompleted }: BulkContractDialogProps) {
  const today = new Date().toISOString().slice(0, 10)
  const [contractDate, setContractDate] = useState(today)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)

  const grandTotal = items.reduce((s, i) => s + i.totalAmount, 0)

  async function handleSubmit() {
    if (!contractDate) { toast.error("契約日を入力してください"); return }
    setLoading(true)
    try {
      const res = await fetch("/api/contracts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimateIds: items.map((i) => i.estimateId),
          contractDate,
          startDate: startDate || null,
          endDate: endDate || null,
          note: note || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "契約処理に失敗しました")
      }
      const data = await res.json()
      toast.success(`${data.count}件の契約処理が完了しました`)
      onOpenChange(false)
      onCompleted()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "エラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandshakeIcon className="w-5 h-5 text-green-600" />
            一括契約処理
          </DialogTitle>
          <DialogDescription>
            {items.length}件の見積をまとめて契約処理します。共通の契約情報を設定してください。
          </DialogDescription>
        </DialogHeader>

        {/* 対象見積一覧 */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr] gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wide">
            <span>見積</span>
            <span>現場</span>
            <span>会社</span>
            <span className="text-right">金額（税込）</span>
          </div>
          {items.map((item) => (
            <div key={item.estimateId} className="grid grid-cols-[2fr_1.5fr_1fr_1fr] gap-2 px-3 py-2 border-b border-slate-100 last:border-0 text-sm items-center">
              <span className="font-medium text-slate-800 truncate">{item.estimateName}</span>
              <span className="text-slate-600 truncate">{item.projectName}</span>
              <span className="text-slate-500 truncate text-xs">{item.companyName}</span>
              <span className="font-mono text-right font-semibold text-slate-800">¥{formatCurrency(item.totalAmount)}</span>
            </div>
          ))}
          <div className="flex justify-between px-3 py-2 bg-slate-50 border-t border-slate-200 font-bold text-sm">
            <span>合計 {items.length}件</span>
            <span className="font-mono">¥{formatCurrency(grandTotal)}</span>
          </div>
        </div>

        {/* 共通契約情報 */}
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">契約日 <span className="text-red-500">*</span></Label>
            <Input type="date" value={contractDate} onChange={(e) => setContractDate(e.target.value)} className="text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">着工予定日</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">完工予定日</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">備考</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="特記事項があれば入力" rows={2} className="text-sm resize-none" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>キャンセル</Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-green-600 hover:bg-green-700">
            <HandshakeIcon className="w-4 h-4 mr-2" />
            {loading ? "処理中..." : `${items.length}件を一括契約する`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── メインコンポーネント ───────────────────────────────

export function ProjectList({ projects, currentUser }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [showArchived, setShowArchived] = useState(false)
  // タグフィルター
  const [selectedStatuses, setSelectedStatuses] = useState<Set<EstimateStatus>>(new Set())
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  // 展開状態: デフォルトで全現場を展開
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set())
  const [collapsedCompanies, setCollapsedCompanies] = useState<Set<string>>(new Set())
  const [contractTarget, setContractTarget] = useState<{
    project: Project
    estimate: EstimateRow
  } | null>(null)

  // ── Split View 状態 ─────────────────────────────────────
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null)
  const [estimateData, setEstimateData] = useState<{
    estimate: Parameters<typeof EstimateDetail>[0]["estimate"]
    taxRate: number
    units: { id: string; name: string }[]
    contacts: { id: string; name: string; phone: string; email: string }[]
  } | null>(null)
  const [estimateLoading, setEstimateLoading] = useState(false)

  // レイアウト制御: 右パネル展開時にフル幅にする
  useEffect(() => {
    const el = document.getElementById("app-content")
    if (!el) return
    if (selectedEstimateId) {
      el.classList.remove("max-w-7xl", "mx-auto")
    } else {
      el.classList.add("max-w-7xl", "mx-auto")
    }
    return () => { el.classList.add("max-w-7xl", "mx-auto") }
  }, [selectedEstimateId])

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

  // 見積データを非同期で取得
  const openEstimate = useCallback(async (estimateId: string) => {
    if (estimateId === selectedEstimateId) return
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

  function handleSelectEstimate(estimateId: string) {
    guardedAction(() => openEstimate(estimateId))
  }

  function handleCloseEstimate() {
    guardedAction(() => {
      setSelectedEstimateId(null)
      setEstimateData(null)
    })
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

  // allCheckableIds は filtered 依存なので後で定義（filtered の後に移動）

  /** チェック済み見積の BulkContractItem 一覧 */
  const checkedItems = useMemo((): BulkContractItem[] => {
    const result: BulkContractItem[] = []
    for (const p of projects) {
      for (const est of p.estimates) {
        if (!checkedEstimateIds.has(est.id)) continue
        const displayName = est.title
          ?? (p.estimates.length === 1 ? "見積" : `見積 ${p.estimates.indexOf(est) + 1}`)
        result.push({
          estimateId: est.id,
          estimateName: displayName,
          projectId: p.id,
          projectName: p.name,
          companyName: p.branch.company.name,
          totalAmount: est.totalAmount,
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

  // ── 見積サブ行 ────────────────────────────────────────
  function EstimateSubRow({
    est,
    project,
    isLast,
    estimateIndex,
  }: {
    est: EstimateRow
    project: Project
    isLast: boolean
    estimateIndex: number
  }) {
    const typeTag = EST_TYPE_STYLE[est.estimateType]
    const displayName = est.title
      ?? (project.estimates.length === 1 ? null : `見積 ${estimateIndex + 1}`)
    const checkable = isCheckable(est)
    const isChecked = checkedEstimateIds.has(est.id)
    const isSelected = selectedEstimateId === est.id

    return (
      <div
        className={`grid grid-cols-[2.5rem_5rem_2.5fr_0.8fr_1.2fr_0.9fr_2.5rem] gap-x-2 pl-10 pr-4 py-2.5 items-center text-sm hover:bg-blue-50/30 transition-colors cursor-pointer ${
          !isLast ? "border-b border-slate-100" : ""
        } ${isChecked ? "bg-green-50/60" : ""} ${isSelected ? "bg-blue-50 ring-1 ring-inset ring-blue-300" : ""}`}
        onClick={() => handleSelectEstimate(est.id)}
      >
        {/* チェックボックス / ツリー線 */}
        <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          {checkable ? (
            <button
              onClick={() => toggleCheck(est.id)}
              className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                isChecked
                  ? "text-green-600 hover:text-green-700"
                  : "text-slate-300 hover:text-slate-500"
              }`}
              title={isChecked ? "チェックを外す" : "契約処理に追加"}
            >
              {isChecked
                ? <CheckSquare className="w-4.5 h-4.5" />
                : <Square className="w-4.5 h-4.5" />
              }
            </button>
          ) : (
            <div className="w-px h-3 bg-slate-300 mx-auto" />
          )}
        </div>

        {/* 状況 */}
        <div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${EST_STATUS_STYLE[est.status]}`}>
            {EST_STATUS_LABEL[est.status]}
          </span>
        </div>

        {/* 見積名 */}
        <div className="min-w-0 flex items-center gap-2 overflow-hidden">
          <div className="group inline-flex items-center gap-1.5 min-w-0 overflow-hidden">
            <FileText className="w-3.5 h-3.5 shrink-0 text-blue-400 group-hover:text-blue-600 transition-colors" />
            <span className="truncate text-sm text-slate-600 group-hover:text-blue-600 transition-colors">
              {displayName ?? "（無題）"}
            </span>
            <ChevronRight className="w-3 h-3 shrink-0 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
          </div>
          {typeTag && (
            <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${typeTag.className}`}>
              {typeTag.label}
            </span>
          )}
        </div>

        {/* 見積確定日 */}
        <div className="text-slate-500">
          {est.confirmedAt
            ? formatDate(est.confirmedAt, "M/d")
            : <span className="text-slate-300">—</span>}
        </div>

        {/* 金額 */}
        <div className="font-mono font-semibold text-slate-800">
          ¥{formatCurrency(est.totalAmount)}
        </div>

        {/* 担当者 */}
        <div className="text-slate-600 truncate">
          {est.user.name}
        </div>

        {/* 三点メニュー */}
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => handleSelectEstimate(est.id)}>
                <FileText className="w-4 h-4 mr-2" />
                見積を開く
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {(est.status === "CONFIRMED" || est.status === "SENT") ? (
                <DropdownMenuItem
                  onClick={() => setContractTarget({ project, estimate: est })}
                  className="flex items-center gap-2 text-green-700 focus:text-green-700 focus:bg-green-50"
                >
                  <HandshakeIcon className="w-4 h-4" />
                  契約処理
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem disabled className="flex items-center gap-2 text-slate-400">
                  <HandshakeIcon className="w-4 h-4" />
                  契約処理（確定後に可）
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-0">
    {/* 左パネル：一覧 */}
    <div className={`space-y-6 transition-all duration-300 ${selectedEstimateId ? "w-[520px] shrink-0 overflow-y-auto max-h-[calc(100vh-4rem)] pr-4" : "flex-1"}`}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">現場・見積一覧</h1>
          <p className="text-sm text-slate-500 mt-1">
            こんにちは、{currentUser.name} さん
          </p>
        </div>
        <Button onClick={() => guardedAction(() => router.push("/projects/new"))}>
          <Plus className="w-4 h-4 mr-2" />
          新規現場作成
        </Button>
      </div>

      {/* 検索・フィルター */}
      <div className="space-y-2">
        {/* 検索バー */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="会社名・現場名・担当者で検索"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
          >
            <Archive className="w-4 h-4 mr-2" />
            {showArchived ? "失注を隠す" : "失注を表示"}
          </Button>
        </div>

        {/* タグフィルター */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-1">

          {/* ── 状況グループ ── */}
          <div className="flex items-center gap-1.5">
            {/* グループラベル */}
            <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-200 text-slate-600">
              <Tag className="w-3.5 h-3.5" />
              <span className="text-xs font-bold tracking-wide leading-none">状況</span>
            </div>
            {/* 四角ボタン */}
            {(["DRAFT", "CONFIRMED", "SENT"] as EstimateStatus[]).map((s) => {
              const active = selectedStatuses.has(s)
              const baseStyle = EST_STATUS_STYLE[s]
              return (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  title={EST_STATUS_LABEL[s]}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all select-none flex items-center justify-center leading-none ${
                    active
                      ? `${baseStyle} ring-2 ring-offset-1 ring-current shadow-md`
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {EST_STATUS_SHORT[s]}
                </button>
              )
            })}
          </div>

          {/* 区切り */}
          <div className="w-px h-6 bg-slate-200 hidden sm:block" />

          {/* ── 担当者グループ ── */}
          {allUsers.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* グループラベル */}
              <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-200 text-slate-600">
                <User2 className="w-3.5 h-3.5" />
                <span className="text-xs font-bold tracking-wide leading-none">担当</span>
              </div>
              {allUsers.map(({ id, name }) => {
                const active = selectedUsers.has(id)
                const short = name.slice(0, 2)
                return (
                  <button
                    key={id}
                    onClick={() => toggleUser(id)}
                    title={name}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all select-none flex items-center justify-center leading-none ${
                      active
                        ? "bg-indigo-500 text-white ring-2 ring-offset-1 ring-indigo-400 shadow-md"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {short}
                  </button>
                )
              })}
            </div>
          )}

          {/* リセット（選択中のときのみ） */}
          {(selectedStatuses.size > 0 || selectedUsers.size > 0) && (
            <button
              onClick={() => { setSelectedStatuses(new Set()); setSelectedUsers(new Set()) }}
              className="flex items-center gap-0.5 text-xs text-slate-400 hover:text-slate-700 transition-colors"
              title="絞り込みをリセット"
            >
              <X className="w-3.5 h-3.5" />
              <span className="text-xs">解除</span>
            </button>
          )}
        </div>
      </div>

      {/* 一覧 */}
      {grouped.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-slate-400">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          現場が見つかりません
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ companyId, companyName, projects: companyProjects }) => {
            const isCompanyCollapsed = collapsedCompanies.has(companyId)
            const totalEstimates = companyProjects.reduce((s, p) => s + p.estimates.length, 0)

            return (
              <div key={companyId} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* 会社名ヘッダー */}
                <button
                  onClick={() => toggleCompany(companyId)}
                  className="w-full flex items-center gap-2 px-4 py-3 bg-slate-800 text-white text-left hover:bg-slate-700 transition-colors"
                >
                  {isCompanyCollapsed ? (
                    <ChevronRight className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 flex-shrink-0" />
                  )}
                  <Building2 className="w-4 h-4 flex-shrink-0 text-slate-300" />
                  <span className="font-semibold">{companyName}</span>
                  <span className="ml-auto text-xs text-slate-400 font-normal">
                    {companyProjects.length} 現場 / {totalEstimates} 見積
                  </span>
                </button>

                {/* カラムヘッダー */}
                {!isCompanyCollapsed && (
                  <div>
                    {/* 各現場 */}
                    {companyProjects.map((project, pIdx) => {
                      const isProjectCollapsed = collapsedProjects.has(project.id)
                      const isLastProject = pIdx === companyProjects.length - 1

                      return (
                        <div
                          key={project.id}
                          className={!isLastProject ? "border-b border-slate-200" : ""}
                        >
                          {/* 現場ヘッダー行 — 現場固有の情報のみ表示 */}
                          <div className="flex items-center gap-3 px-4 py-3 bg-slate-50/70 hover:bg-slate-100/80 transition-colors">
                            {/* 展開ボタン */}
                            <div className="flex-shrink-0">
                              {project.estimates.length > 0 ? (
                                <button
                                  onClick={() => toggleProject(project.id)}
                                  title={isProjectCollapsed ? "見積を表示" : "見積を隠す"}
                                  className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                                    isProjectCollapsed
                                      ? "bg-slate-200 text-slate-600 hover:bg-blue-500 hover:text-white"
                                      : "bg-blue-500 text-white hover:bg-blue-600"
                                  }`}
                                >
                                  {isProjectCollapsed ? (
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              ) : <div className="w-6" />}
                            </div>

                            {/* 現場名 */}
                            <div className="min-w-0 flex items-center gap-2">
                              <button
                                onClick={() => guardedAction(() => router.push(`/projects/${project.id}`))}
                                className="group inline-flex items-center gap-1.5 min-w-0"
                              >
                                <span className="font-bold text-sm text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                                  {project.name}
                                </span>
                                <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                              </button>
                              {project.branch.name !== "本社" && (
                                <span className="text-xs text-slate-400 shrink-0 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {project.branch.name}
                                </span>
                              )}
                            </div>

                            {/* 住所 */}
                            {project.address ? (
                              <div className="hidden md:flex items-center gap-1 text-xs text-slate-500 min-w-0 shrink">
                                <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                                <span className="truncate">{project.address}</span>
                              </div>
                            ) : (
                              <div className="hidden md:flex items-center gap-1 text-xs text-amber-600 shrink-0">
                                <MapPin className="w-3 h-3 shrink-0 text-amber-500" />
                                <span className="font-medium">住所未設定</span>
                              </div>
                            )}

                            {/* 先方担当 */}
                            <div className="hidden sm:flex items-center gap-1 text-xs text-slate-500 shrink-0">
                              <User2 className="w-3 h-3 text-slate-400" />
                              <span>{project.contact?.name ?? "—"}</span>
                            </div>

                            {/* 立ち上げ日 */}
                            <div className="hidden sm:flex items-center gap-1 text-xs text-slate-500 shrink-0">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>{formatDate(project.createdAt, "M/d")}</span>
                            </div>

                            {/* 見積件数バッジ */}
                            <button
                              onClick={() => toggleProject(project.id)}
                              className="shrink-0 ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 font-medium hover:bg-blue-200 transition-colors"
                            >
                              <FileText className="w-3 h-3" />
                              {project.estimates.length}件
                            </button>

                            {/* 三点メニュー（現場レベル） */}
                            <div className="flex-shrink-0">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem
                                    onClick={() => guardedAction(() => router.push(`/projects/${project.id}`))}
                                    className="flex items-center gap-2"
                                  >
                                    <Eye className="w-4 h-4" />
                                    現場詳細を開く
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => guardedAction(() => router.push(`/projects/${project.id}?newEstimate=1`))}
                                    className="flex items-center gap-2"
                                  >
                                    <FilePlus2 className="w-4 h-4" />
                                    新規見積を追加
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => guardedAction(() => handleArchive(project.id))}
                                    className="flex items-center gap-2 text-orange-600 focus:text-orange-600 focus:bg-orange-50"
                                  >
                                    <Archive className="w-4 h-4" />
                                    失注としてアーカイブ
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>

                          {/* 見積サブ行（展開時） */}
                          {!isProjectCollapsed && project.estimates.length > 0 && (
                            <div className="bg-white">
                              {/* 見積カラムヘッダー */}
                              <div className="grid grid-cols-[2.5rem_5rem_2.5fr_0.8fr_1.2fr_0.9fr_2.5rem] gap-x-2 pl-10 pr-4 py-1.5 bg-slate-100/60 border-y border-slate-100 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                <span />
                                <span>状況</span>
                                <span>見積名</span>
                                <span>確定日</span>
                                <span>金額（税込）</span>
                                <span>担当者</span>
                                <span />
                              </div>
                              {project.estimates.map((est, eIdx) => (
                                <EstimateSubRow
                                  key={est.id}
                                  est={est}
                                  project={project}
                                  isLast={eIdx === project.estimates.length - 1}
                                  estimateIndex={eIdx}
                                />
                              ))}
                            </div>
                          )}

                          {/* 見積なしの場合 */}
                          {!isProjectCollapsed && project.estimates.length === 0 && (
                            <div className="pl-10 pr-4 py-3 border-t border-dashed border-slate-200 bg-slate-50/50">
                              <button
                                onClick={() => guardedAction(() => router.push(`/projects/${project.id}?newEstimate=1`))}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-50 border border-blue-200 text-sm text-blue-600 font-medium hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors"
                              >
                                <FilePlus2 className="w-4 h-4" />
                                最初の見積を作成する
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs text-slate-400 text-right">
        {filtered.length} 件表示
      </p>

      {/* 契約処理ダイアログ（単件） */}
      {contractTarget && (
        <ContractDialog
          open={true}
          onOpenChange={(v) => { if (!v) setContractTarget(null) }}
          project={contractTarget.project}
          estimate={contractTarget.estimate}
          onContracted={() => {
            setContractTarget(null)
            router.refresh()
          }}
        />
      )}

      {/* 一括契約処理ダイアログ */}
      <BulkContractDialog
        open={bulkContractOpen}
        onOpenChange={setBulkContractOpen}
        items={checkedItems}
        onCompleted={() => {
          setCheckedEstimateIds(new Set())
          router.refresh()
        }}
      />

      {/* フローティング一括操作バー */}
      {checkedEstimateIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900 text-white px-5 py-3 rounded-full shadow-2xl shadow-slate-900/40 border border-slate-700 animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-green-400" />
            <span className="text-sm font-semibold">
              {checkedEstimateIds.size}件の見積を選択中
            </span>
          </div>
          <div className="w-px h-5 bg-slate-700" />
          <button
            onClick={() => {
              const newSet = new Set(allCheckableIds)
              setCheckedEstimateIds(newSet)
            }}
            className="text-xs text-slate-300 hover:text-white transition-colors"
          >
            全選択
          </button>
          <button
            onClick={() => setCheckedEstimateIds(new Set())}
            className="text-xs text-slate-300 hover:text-white transition-colors"
          >
            解除
          </button>
          <Button
            size="sm"
            onClick={() => setBulkContractOpen(true)}
            className="bg-green-500 hover:bg-green-400 text-white h-8 px-4 rounded-full font-semibold"
          >
            <HandshakeIcon className="w-3.5 h-3.5 mr-1.5" />
            一括契約処理
          </Button>
        </div>
      )}
    </div>

    {/* 右パネル：見積詳細 */}
    {selectedEstimateId && (
      <div className="flex-1 min-w-0 border-l border-slate-200 bg-white shadow-sm">
        <div className="max-h-[calc(100vh-4rem)] overflow-y-auto px-6 pb-8">
          {estimateLoading || !estimateData ? (
            <div className="flex items-center justify-center py-32">
              <LoaderIcon className="w-6 h-6 animate-spin text-slate-400" />
              <span className="ml-2 text-slate-500">読み込み中...</span>
            </div>
          ) : (
            <EstimateDetail
              key={selectedEstimateId}
              estimate={estimateData.estimate}
              taxRate={estimateData.taxRate}
              units={estimateData.units}
              currentUser={currentUser}
              contacts={estimateData.contacts}
              embedded
              onClose={handleCloseEstimate}
              onNavigateEstimate={(id) => handleSelectEstimate(id)}
              onEditingChange={setIsEstimateEditing}
            />
          )}
        </div>
      </div>
    )}

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
    </div>
  )
}

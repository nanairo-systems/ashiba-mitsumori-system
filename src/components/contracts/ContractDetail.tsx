/**
 * [COMPONENT] 契約詳細 - ContractDetail
 *
 * 契約基本情報・ステータス遷移・工事区分（自社/外注）・発注管理を統合表示。
 */
"use client"

import { useState, useMemo, useRef, useCallback, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { EstimateDetail } from "@/components/estimates/EstimateDetail"
import { formatDate, formatCurrency } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  FileText,
  HandshakeIcon,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Printer,
  Trash2,
  User,
  Wrench,
  Users,
  Truck,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Layers,
  Receipt,
  Wallet,
  XCircle,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Ban,
  X,
  AlertTriangle,
} from "lucide-react"
import { KeyboardHint } from "@/components/ui/keyboard-hint"
import { toast } from "sonner"
import type { ContractStatus, WorkType, OrderStatus, SubcontractorPaymentStatus, EstimateStatus, EstimateType } from "@prisma/client"

// ─── 型定義 ────────────────────────────────────────────

interface EstimateItem {
  id: string; name: string; quantity: number; unitPrice: number; unit: { name: string }
}
interface EstimateGroup {
  id: string; name: string; items: EstimateItem[]
}
interface EstimateSection {
  id: string; name: string; groups: EstimateGroup[]
}

interface SubcontractorOption {
  id: string; name: string; representative: string | null
  address: string | null; phone: string | null
}

interface ScheduleData {
  id: string
  contractId: string
  workType: string
  name: string | null
  plannedStartDate: string | null
  plannedEndDate: string | null
  actualStartDate: string | null
  actualEndDate: string | null
  workersCount: number | null
  notes: string | null
}

interface ContractWorkData {
  id: string
  workType: WorkType
  workerCount: number | null
  workDays: number | null
  subcontractorId: string | null
  orderAmount: number | null
  orderTaxAmount: number | null
  orderTotalAmount: number | null
  orderStatus: OrderStatus
  orderedAt: string | null
  note: string | null
  createdAt: string
  subcontractor: SubcontractorOption | null
}

interface SubPaymentData {
  id: string
  subcontractorId: string
  subcontractorName: string
  orderAmount: number
  taxAmount: number
  totalAmount: number
  closingDate: string | null
  paymentDueDate: string | null
  paymentDate: string | null
  paymentAmount: number | null
  status: SubcontractorPaymentStatus
  notes: string | null
}

interface ContractData {
  id: string
  contractNumber: string | null
  name: string | null
  status: ContractStatus
  contractAmount: number
  taxAmount: number
  totalAmount: number
  contractDate: string
  startDate: string | null
  endDate: string | null
  paymentTerms: string | null
  note: string | null
  createdAt: string
  project: {
    id: string; name: string; address: string | null
    branch: {
      name: string
      company: { id: string; name: string; phone: string | null; taxRate: number }
    }
    contact: { name: string; phone: string; email: string } | null
  }
  estimate: {
    id: string; estimateNumber: string | null
    user: { id: string; name: string }
    sections: EstimateSection[]
  } | null
  contractEstimates: Array<{
    id: string
    estimate: {
      id: string; estimateNumber: string | null; title: string | null
      status?: string
      user: { id: string; name: string }
      subtotal?: number
      discountAmount?: number
      taxAmount?: number
      total?: number
      purchaseOrder?: {
        id: string
        subcontractorId: string
        subcontractorName: string
        orderAmount: number
        taxRate: number
        status: string
        orderedAt: string | null
        note: string | null
      } | null
    }
  }>
  works: ContractWorkData[]
  schedules: ScheduleData[]
  invoices: { id: string; status: string }[]
  subcontractorPayments: SubPaymentData[]
}

interface SiblingContract {
  id: string
  contractNumber: string | null
  name: string | null
  status: ContractStatus
  contractAmount: number
  taxAmount: number
  totalAmount: number
  contractDate: string
  estimate: {
    id: string
    estimateNumber: string | null
    title: string | null
    status: EstimateStatus
    estimateType: EstimateType
    user: { id: string; name: string }
  } | null
  estimateCount: number
}

interface Props {
  contract: ContractData
  siblingContracts: SiblingContract[]
  subcontractors: SubcontractorOption[]
  currentUser: { id: string; name: string }
  workTypes: WorkTypeMaster[]
  onOpenEstimate?: (estimateId: string) => void
  onOpenContract?: (contractId: string) => void
  onClose?: () => void
}

// ─── 定数 ──────────────────────────────────────────────

const STATUS_CONFIG: Record<ContractStatus, { label: string; color: string; icon: typeof HandshakeIcon }> = {
  CONTRACTED:       { label: "契約済",     color: "bg-blue-50 text-blue-700 border-blue-200",     icon: HandshakeIcon },
  SCHEDULE_CREATED: { label: "工程作成済", color: "bg-cyan-50 text-cyan-700 border-cyan-200",     icon: CalendarCheck },
  IN_PROGRESS:      { label: "着工",       color: "bg-amber-50 text-amber-700 border-amber-200",   icon: Wrench },
  COMPLETED:        { label: "完工",       color: "bg-green-50 text-green-700 border-green-200",    icon: CheckCircle2 },
  BILLED:           { label: "請求済",     color: "bg-purple-50 text-purple-700 border-purple-200", icon: Receipt },
  PAID:             { label: "入金済",     color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: Wallet },
  CANCELLED:        { label: "キャンセル", color: "bg-slate-100 text-slate-500 border-slate-200",  icon: XCircle },
}

const STATUS_FLOW: ContractStatus[] = ["CONTRACTED", "SCHEDULE_CREATED", "IN_PROGRESS", "COMPLETED", "BILLED", "PAID"]

function getGateBlock(nextStatus: ContractStatus, contract: ContractData): string | null {
  const { schedules, invoices } = contract
  switch (nextStatus) {
    case "SCHEDULE_CREATED":
      if (schedules.length === 0) return "工程が未登録です。先に工程を作成してください。"
      break
    case "IN_PROGRESS":
      if (schedules.length === 0) return "工程が未登録です。"
      if (!schedules.some((s) => s.actualStartDate)) return "実績組み立て日が未入力です。着工するには実績を入力してください。"
      break
    case "COMPLETED":
      if (schedules.length === 0) return "工程が未登録です。"
      if (!schedules.every((s) => s.actualEndDate)) return "全工程の実績解体日が未入力です。完工にするには全工程を完了してください。"
      break
    case "BILLED":
      if (invoices.length === 0) return "請求書が未作成です。先に請求書を作成してください。"
      break
    case "PAID":
      if (invoices.length === 0) return "請求書が未作成です。"
      if (!invoices.every((inv) => inv.status === "PAID")) return "未入金の請求書があります。全ての請求書が入金済みになるまで進められません。"
      break
  }
  return null
}

const SCHEDULE_WORK_TYPE_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  ASSEMBLY:    { label: "組立",   color: "text-blue-700",   bgColor: "bg-blue-50 border-blue-200" },
  DISASSEMBLY: { label: "解体",   color: "text-amber-700",  bgColor: "bg-amber-50 border-amber-200" },
  REWORK:      { label: "その他", color: "text-slate-700",  bgColor: "bg-slate-50 border-slate-200" },
}

const SUB_PAY_STATUS_LABEL: Record<SubcontractorPaymentStatus, string> = {
  PENDING: "未処理", SCHEDULED: "支払予定", PAID: "支払済",
}
const SUB_PAY_STATUS_STYLE: Record<SubcontractorPaymentStatus, string> = {
  PENDING: "bg-slate-100 text-slate-600",
  SCHEDULED: "bg-blue-50 text-blue-700",
  PAID: "bg-green-50 text-green-700",
}

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  NOT_ORDERED: "未発注",
  ORDERED: "発注済",
  COMPLETED: "完了",
}
const ORDER_STATUS_STYLE: Record<OrderStatus, string> = {
  NOT_ORDERED: "bg-slate-100 text-slate-600",
  ORDERED: "bg-blue-50 text-blue-700",
  COMPLETED: "bg-green-50 text-green-700",
}

// ─── メインコンポーネント ───────────────────────────────

export function ContractDetail({ contract: initialContract, siblingContracts, subcontractors, currentUser, workTypes, onOpenEstimate, onOpenContract, onClose }: Props) {
  const router = useRouter()
  const [contract, setContract] = useState(initialContract)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [addWorkOpen, setAddWorkOpen] = useState(false)
  const [addWorkType, setAddWorkType] = useState<WorkType>("INHOUSE")
  const [addWorkerCount, setAddWorkerCount] = useState("")
  const [addWorkDays, setAddWorkDays] = useState("")
  const [addSubId, setAddSubId] = useState("")
  const [addOrderAmount, setAddOrderAmount] = useState("")
  const [addWorkNote, setAddWorkNote] = useState("")
  const [addingSaving, setAddingSaving] = useState(false)

  const taxRate = contract.project.branch.company.taxRate

  // ── スプリットビュー ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [estimatePanel, setEstimatePanel] = useState<{ id: string; data: any | null; loading: boolean } | null>(null)

  const openEstimate = useCallback((estimateId: string) => {
    setEstimatePanel({ id: estimateId, data: null, loading: true })
    fetch(`/api/estimates/${estimateId}`)
      .then((r) => r.json())
      .then((data) => setEstimatePanel((prev) => prev?.id === estimateId ? { ...prev, data, loading: false } : prev))
      .catch(() => setEstimatePanel((prev) => prev?.id === estimateId ? { ...prev, loading: false } : prev))
  }, [])

  const closeEstimate = useCallback(() => setEstimatePanel(null), [])

  const refreshEstimate = useCallback(() => {
    setEstimatePanel((prev) => {
      if (!prev) return prev
      fetch(`/api/estimates/${prev.id}`)
        .then((r) => r.json())
        .then((data) => setEstimatePanel((cur) => cur?.id === prev.id ? { ...cur, data, loading: false } : cur))
      return prev
    })
  }, [])

  const isEmbedded = !!onOpenEstimate
  const isConsolidated = !contract.estimate && contract.contractEstimates.length > 0

  // ── 契約統合 ──
  const [consolidateOpen, setConsolidateOpen] = useState(false)
  const [consolidating, setConsolidating] = useState(false)

  const handleConsolidate = useCallback(async () => {
    if (siblingContracts.length < 2) return
    setConsolidating(true)
    try {
      const ids = siblingContracts.map(sc => sc.id)
      const res = await fetch("/api/contracts/consolidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractIds: ids }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "統合に失敗しました" }))
        toast.error(err.error || "統合に失敗しました")
        return
      }
      const data = await res.json()
      toast.success(`契約を統合しました（${data.contractNumber}）`)
      setConsolidateOpen(false)
      // リスト更新 + 新しい統合契約を開く
      router.refresh()
      if (onOpenContract) {
        setTimeout(() => onOpenContract(data.id), 500)
      }
    } catch {
      toast.error("統合に失敗しました")
    } finally {
      setConsolidating(false)
    }
  }, [siblingContracts, onOpenContract, router])

  useEffect(() => {
    if (isEmbedded) return
    const el = document.getElementById("app-content")
    if (!el) return
    if (estimatePanel) {
      el.classList.remove("max-w-7xl", "mx-auto")
    } else {
      el.classList.add("max-w-7xl", "mx-auto")
    }
    return () => { el.classList.add("max-w-7xl", "mx-auto") }
  }, [estimatePanel, isEmbedded])

  // 工事区分の集計
  const workSummary = useMemo(() => {
    let totalManDays = 0
    let totalOrderAmount = 0
    for (const w of contract.works) {
      if (w.workType === "INHOUSE") {
        totalManDays += (w.workerCount ?? 0) * (w.workDays ?? 0)
      } else {
        totalOrderAmount += w.orderTotalAmount ?? 0
      }
    }
    return { totalManDays, totalOrderAmount }
  }, [contract.works])

  // ── ステータス更新 ──
  async function handleStatusUpdate(newStatus: ContractStatus) {
    const label = STATUS_CONFIG[newStatus].label
    if (!confirm(`ステータスを「${label}」に変更しますか？`)) return
    setStatusUpdating(true)
    try {
      const res = await fetch(`/api/contracts/${contract.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        toast.error(data?.error ?? "更新に失敗しました")
        return
      }
      setContract((prev) => ({ ...prev, status: newStatus }))
      toast.success(`${label}に更新しました`)
    } catch {
      toast.error("更新に失敗しました")
    } finally {
      setStatusUpdating(false)
    }
  }

  // ── 工事区分追加 ──
  async function handleAddWork() {
    setAddingSaving(true)
    try {
      const orderAmt = addOrderAmount ? parseFloat(addOrderAmount) : null
      const orderTax = orderAmt != null ? Math.floor(orderAmt * taxRate) : null
      const orderTotal = orderAmt != null && orderTax != null ? orderAmt + orderTax : null

      const res = await fetch(`/api/contracts/${contract.id}/works`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workType: addWorkType,
          workerCount: addWorkType === "INHOUSE" ? (addWorkerCount ? parseInt(addWorkerCount) : null) : null,
          workDays: addWorkType === "INHOUSE" ? (addWorkDays ? parseInt(addWorkDays) : null) : null,
          subcontractorId: addWorkType === "SUBCONTRACT" && addSubId ? addSubId : null,
          orderAmount: addWorkType === "SUBCONTRACT" ? orderAmt : null,
          orderTaxAmount: addWorkType === "SUBCONTRACT" ? orderTax : null,
          orderTotalAmount: addWorkType === "SUBCONTRACT" ? orderTotal : null,
          note: addWorkNote.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || "追加に失敗しました")
      }
      toast.success("工事区分を追加しました")
      setAddWorkOpen(false)
      resetAddForm()
      router.refresh()
      const refreshed = await fetch(`/api/contracts/${contract.id}`).then((r) => r.json())
      if (refreshed.works) {
        setContract((prev) => ({
          ...prev,
          works: refreshed.works.map(serializeWork),
        }))
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "追加に失敗しました")
    } finally {
      setAddingSaving(false)
    }
  }

  function resetAddForm() {
    setAddWorkType("INHOUSE")
    setAddWorkerCount("")
    setAddWorkDays("")
    setAddSubId("")
    setAddOrderAmount("")
    setAddWorkNote("")
  }

  // ── 発注ステータス更新 ──
  async function handleOrderStatusUpdate(workId: string, orderStatus: OrderStatus) {
    const res = await fetch(`/api/contracts/${contract.id}/works/${workId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderStatus }),
    })
    if (res.ok) {
      toast.success(`発注ステータスを「${ORDER_STATUS_LABEL[orderStatus]}」に更新しました`)
      setContract((prev) => ({
        ...prev,
        works: prev.works.map((w) =>
          w.id === workId ? { ...w, orderStatus, orderedAt: orderStatus === "ORDERED" ? new Date().toISOString() : w.orderedAt } : w
        ),
      }))
    } else {
      toast.error("更新に失敗しました")
    }
  }

  // ── 工事区分削除 ──
  async function handleDeleteWork(workId: string) {
    if (!confirm("この工事区分を削除しますか？")) return
    const res = await fetch(`/api/contracts/${contract.id}/works/${workId}`, { method: "DELETE" })
    if (res.ok) {
      toast.success("削除しました")
      setContract((prev) => ({
        ...prev,
        works: prev.works.filter((w) => w.id !== workId),
      }))
    } else {
      toast.error("削除に失敗しました")
    }
  }

  const currentStatusIndex = STATUS_FLOW.indexOf(contract.status)
  const nextStatus = currentStatusIndex >= 0 && currentStatusIndex < STATUS_FLOW.length - 1
    ? STATUS_FLOW[currentStatusIndex + 1]
    : null

  return (
    <div className={isEmbedded ? "" : "flex gap-0"}>
      {/* ── 左パネル: 契約詳細 ── */}
      <div className={isEmbedded ? "space-y-4" : `space-y-6 transition-all duration-300 ${estimatePanel ? "w-[560px] shrink-0 overflow-y-auto max-h-[calc(100vh-4rem)] pr-4" : "flex-1"}`}>
      {/* ── ヘッダー ── */}
      <div className={isEmbedded
        ? "flex flex-col gap-2 sticky top-0 z-10 bg-white pt-3 pb-2 -mt-4 border-b border-slate-100"
        : "flex items-center justify-between"
      }>
        <div className="flex items-center gap-3">
          {isEmbedded ? (
            <>
              <button onClick={onClose} className="flex items-center gap-1 px-3 py-1.5 rounded-sm text-sm font-bold text-slate-500 hover:bg-slate-100 active:scale-95 transition-all">
                <X className="w-4 h-4" />
                閉じる
              </button>
              <KeyboardHint keyName="Esc" label="閉じる" />
            </>
          ) : (
            <Link href="/contracts">
              <button className="flex items-center gap-1 px-3 py-1.5 rounded-sm text-sm font-bold text-slate-500 hover:bg-slate-100 active:scale-95 transition-all">
                <ArrowLeft className="w-4 h-4" />
                契約一覧
              </button>
            </Link>
          )}
          <div>
            <h1 className={`${isEmbedded ? "text-lg" : "text-2xl"} font-extrabold text-slate-900 flex items-center gap-2`}>
              {contract.name || contract.contractNumber || "契約詳細"}
              <span className={`inline-flex items-center px-3 py-1 rounded-sm text-xs font-bold border-2 ${STATUS_CONFIG[contract.status].color}`}>
                {STATUS_CONFIG[contract.status].label}
              </span>
              {(contract.contractEstimates?.length ?? 0) > 1 && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-sm text-xs font-bold bg-purple-100 text-purple-700">
                  {contract.contractEstimates.length}件の見積
                </span>
              )}
            </h1>
            <p className="text-sm font-bold text-slate-500 mt-0.5">
              {contract.project.branch.company.name} — {contract.project.name}
              {contract.name && contract.contractNumber && (
                <span className="ml-2 font-mono text-xs text-slate-600">{contract.contractNumber}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/estimates/new?projectId=${contract.project.id}`}>
            <button className="flex items-center gap-1 px-3 py-1.5 rounded-sm text-xs font-bold border-2 border-orange-300 text-orange-700 hover:bg-orange-50 active:scale-95 transition-all">
              <Plus className="w-3.5 h-3.5" />
              追加工事の見積を作成
            </button>
          </Link>
          <Link href={`/projects/${contract.project.id}`}>
            <button className="flex items-center gap-1 px-3 py-1.5 rounded-sm text-xs font-bold border-2 border-slate-300 text-slate-700 hover:bg-slate-50 active:scale-95 transition-all">
              <MapPin className="w-3.5 h-3.5" />
              現場詳細
            </button>
          </Link>
        </div>
      </div>

      {/* ── ステータス進捗バー ── */}
      <div className="bg-white rounded-sm border-2 border-slate-300 p-4">
          <div className="flex items-center gap-1">
            {STATUS_FLOW.map((s, i) => {
              const config = STATUS_CONFIG[s]
              const Icon = config.icon
              const isActive = contract.status === s
              const isPast = currentStatusIndex >= 0 && i < currentStatusIndex
              const isCancelled = contract.status === "CANCELLED"
              return (
                <div key={s} className="flex items-center flex-1">
                  <div className={`flex items-center gap-1.5 px-3 py-2 rounded-sm text-xs font-bold border-2 transition-all w-full justify-center ${
                    isCancelled ? "bg-slate-50 text-slate-300 border-slate-100" :
                    isActive ? config.color + " ring-2 ring-offset-1 ring-current/20 border-current" :
                    isPast ? "bg-slate-100 text-slate-500 border-slate-200" :
                    "bg-slate-50 text-slate-300 border-dashed border-slate-200"
                  }`}>
                    <Icon className="w-3.5 h-3.5" />
                    {config.label}
                  </div>
                  {i < STATUS_FLOW.length - 1 && (
                    <ChevronRight className={`w-4 h-4 flex-shrink-0 mx-0.5 ${
                      isPast || isActive ? "text-slate-400" : "text-slate-200"
                    }`} />
                  )}
                </div>
              )
            })}
          </div>
          {contract.status !== "CANCELLED" && (() => {
            const gateBlock = nextStatus ? getGateBlock(nextStatus, contract) : null
            return (
              <div className="space-y-2 mt-4 pt-3 border-t border-slate-100">
                {/* 工程登録状況（契約済み〜着工の間で表示） */}
                {(contract.status === "CONTRACTED" || contract.status === "SCHEDULE_CREATED") && (
                  <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-sm ${
                    contract.schedules.length === 0
                      ? "bg-red-50 text-red-700 border-2 border-red-200"
                      : "bg-emerald-50 text-emerald-700 border-2 border-emerald-200"
                  }`}>
                    {contract.schedules.length === 0 ? (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-bold">工程が未登録です</span>
                        <span className="text-red-500">— 下の工程セクションで工程を作成してください</span>
                      </>
                    ) : (
                      <>
                        <CalendarCheck className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-bold">工程 {contract.schedules.length}件 登録済み</span>
                      </>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {nextStatus && gateBlock ? (
                    <div className="flex items-center gap-2">
                      <button
                        disabled
                        className="flex items-center gap-1 px-3 py-1.5 rounded-sm text-xs font-bold bg-slate-200 text-slate-400 cursor-not-allowed"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        「{STATUS_CONFIG[nextStatus].label}」に進める
                      </button>
                      <span className="text-xs font-bold text-red-600 flex items-center gap-1">
                        <Ban className="w-3 h-3 flex-shrink-0" />
                        {gateBlock}
                      </span>
                    </div>
                  ) : nextStatus ? (
                    <button
                      onClick={() => handleStatusUpdate(nextStatus)}
                      disabled={statusUpdating}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-sm text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {statusUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      「{STATUS_CONFIG[nextStatus].label}」に進める
                    </button>
                  ) : null}
                  <button
                    onClick={() => handleStatusUpdate("CANCELLED")}
                    disabled={statusUpdating}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-sm text-xs font-bold border-2 border-red-200 text-red-600 hover:bg-red-50 active:scale-95 transition-all ml-auto disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    キャンセル
                  </button>
                </div>
              </div>
            )
          })()}
      </div>

      {/* ── 工程未登録警告 ── */}
      {contract.status === "CONTRACTED" && contract.schedules.length === 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border-2 border-amber-200 rounded-sm text-amber-800">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold">工程が未登録です</p>
            <p className="text-xs text-amber-600 mt-0.5">
              「工程作成済み」に進むには、下の工程セクションで工程を1件以上登録してください。
            </p>
          </div>
        </div>
      )}

      {/* ── 工期セクション（ガントチャート） ── */}
      <ScheduleSection
        contractId={contract.id}
        contractStatus={contract.status}
        schedules={contract.schedules}
        workTypes={workTypes}
        project={{
          id: contract.project.id,
          name: contract.project.name,
          companyName: contract.project.branch.company.name,
        }}
        onStatusChange={(newStatus) => setContract((prev) => ({ ...prev, status: newStatus }))}
        onRefresh={() => {
          fetch(`/api/contracts/${contract.id}`)
            .then((r) => r.json())
            .then((data) => {
              if (data.schedules) {
                setContract((prev) => ({
                  ...prev,
                  schedules: data.schedules.map((s: Record<string, unknown>) => ({
                    id: s.id as string,
                    contractId: s.contractId as string,
                    workType: s.workType as string,
                    name: (s.name as string) ?? null,
                    plannedStartDate: s.plannedStartDate ? String(s.plannedStartDate) : null,
                    plannedEndDate: s.plannedEndDate ? String(s.plannedEndDate) : null,
                    actualStartDate: s.actualStartDate ? String(s.actualStartDate) : null,
                    actualEndDate: s.actualEndDate ? String(s.actualEndDate) : null,
                    workersCount: s.workersCount as number | null,
                    notes: s.notes as string | null,
                  })),
                }))
              }
            })
        }}
      />

      {/* ── 契約サマリー + お客様・現場（横並び） ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 左: 契約サマリー */}
        <div className="bg-white rounded-sm border-2 border-slate-300">
          <div className="px-4 py-3 border-b-2 border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-orange-600" />
                {isConsolidated ? "契約サマリー" : "契約・見積一覧"}
                {isConsolidated && (
                  <span className="text-xs text-slate-600 font-normal">（{contract.contractEstimates.length}件統合）</span>
                )}
                {!isConsolidated && siblingContracts.length > 1 && (
                  <span className="text-xs text-slate-600 font-normal">（{siblingContracts.length}件）</span>
                )}
              </h3>
              <div className="flex items-center gap-1">
                {isConsolidated && (
                  <button
                    className="flex items-center gap-0.5 px-2 py-1 rounded-sm text-xs font-bold border-2 border-blue-300 text-blue-700 hover:bg-blue-50 active:scale-95 transition-all"
                    onClick={() => window.open(`/contracts/${contract.id}/print`, "_blank")}
                  >
                    <Printer className="w-3 h-3" />印刷
                  </button>
                )}
                {!isConsolidated && siblingContracts.length >= 2 && (
                  <button
                    className="flex items-center gap-0.5 px-2 py-1 rounded-sm text-xs font-bold border-2 border-purple-300 text-purple-700 hover:bg-purple-50 active:scale-95 transition-all"
                    onClick={() => setConsolidateOpen(true)}
                  >
                    <Layers className="w-3 h-3" />統合する
                  </button>
                )}
                <Link href={`/estimates/new?projectId=${contract.project.id}`}>
                  <button className="flex items-center gap-0.5 px-2 py-1 rounded-sm text-xs font-bold border-2 border-orange-300 text-orange-700 hover:bg-orange-50 active:scale-95 transition-all">
                    <Plus className="w-3 h-3" />追加
                  </button>
                </Link>
              </div>
            </div>
          </div>
          <div className="p-4 space-y-2">
            {isConsolidated ? (
              <>
                {/* 統合契約: 契約全体の情報 */}
                <div className="bg-slate-50 rounded-sm border-2 border-slate-200 p-2.5 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">契約番号</span>
                    <span className="font-mono font-bold text-slate-700">{contract.contractNumber ?? "—"}</span>
                  </div>
                  {contract.name && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-bold">契約名</span>
                      <span className="text-slate-700 font-bold">{contract.name}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">契約日</span>
                    <span className="text-slate-700 font-bold">{formatDate(contract.contractDate, "yyyy/MM/dd")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">工期</span>
                    <span className="text-slate-700 font-bold">
                      {contract.startDate || contract.endDate
                        ? `${contract.startDate ? formatDate(contract.startDate, "MM/dd") : "未定"} 〜 ${contract.endDate ? formatDate(contract.endDate, "MM/dd") : "未定"}`
                        : "未設定"}
                    </span>
                  </div>
                  <div className="flex justify-between font-extrabold border-t-2 border-slate-200 pt-1 mt-1">
                    <span className="text-slate-700">契約金額（税込）</span>
                    <span className="font-mono text-slate-900">¥{formatCurrency(contract.totalAmount)}</span>
                  </div>
                </div>

                {/* 見積別内訳 */}
                <div className="border-2 border-slate-200 rounded-sm overflow-hidden divide-y divide-slate-100">
                  {contract.contractEstimates.map((ce, i) => {
                    const est = ce.estimate
                    const po = est.purchaseOrder
                    const grossProfit = est.subtotal != null && po ? est.subtotal - po.orderAmount : null
                    const grossMargin = est.subtotal && grossProfit != null ? Math.round((grossProfit / est.subtotal) * 100) : null
                    const poStatusConfig: Record<string, { label: string; cls: string }> = {
                      DRAFT: { label: "未発注", cls: "bg-slate-100 text-slate-600" },
                      ORDERED: { label: "発注済", cls: "bg-blue-100 text-blue-700" },
                      COMPLETED: { label: "完了", cls: "bg-green-100 text-green-700" },
                    }

                    return (
                      <div key={ce.id} className="px-2.5 py-2">
                        {/* 見積ヘッダー */}
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs font-bold shrink-0 ${
                            i === 0 ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                          }`}>
                            {i === 0 ? "本工事" : `追加${i}`}
                          </span>
                          <span className="text-xs font-bold text-slate-800 truncate">
                            {est.title || est.estimateNumber || "見積"}
                          </span>
                          <button
                            onClick={() => (onOpenEstimate ?? openEstimate)(est.id)}
                            className="ml-auto inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm text-xs font-bold text-blue-600 hover:bg-blue-100 transition-colors shrink-0"
                          >
                            <FileText className="w-2.5 h-2.5" />開く
                          </button>
                        </div>

                        {/* 金額情報 */}
                        <div className="mt-1.5 pl-[52px] grid grid-cols-2 gap-x-3 gap-y-0.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-600">見積額</span>
                            <span className="font-mono text-slate-600">¥{formatCurrency(est.total ?? 0)}</span>
                          </div>
                          {po ? (
                            <div className="flex justify-between">
                              <span className="text-slate-600">発注額</span>
                              <span className="font-mono text-slate-600">¥{formatCurrency(po.orderAmount)}</span>
                            </div>
                          ) : (
                            <div className="flex justify-between">
                              <span className="text-slate-600">発注</span>
                              <span className="text-slate-400">未設定</span>
                            </div>
                          )}
                          {po && grossProfit != null && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-slate-600">粗利額</span>
                                <span className={`font-mono ${grossProfit < 0 ? "text-red-600" : "text-emerald-600"}`}>
                                  {grossProfit < 0 ? "▲" : ""}¥{formatCurrency(Math.abs(grossProfit))}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-600">粗利率</span>
                                <span className={`font-mono ${grossProfit < 0 ? "text-red-600" : "text-emerald-600"}`}>
                                  {grossMargin}%
                                </span>
                              </div>
                            </>
                          )}
                        </div>

                        {/* 発注ステータス */}
                        {po && (
                          <div className="mt-1 pl-[52px] flex items-center gap-1.5">
                            <Truck className="w-3 h-3 text-slate-600" />
                            <span className="text-xs text-slate-500">{po.subcontractorName}</span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs font-bold ${poStatusConfig[po.status]?.cls ?? ""}`}>
                              {poStatusConfig[po.status]?.label ?? po.status}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* 合計集計 */}
                {(() => {
                  const estimatesTotal = contract.contractEstimates.reduce((s, ce) => s + (ce.estimate.total ?? 0), 0)
                  const ordersTotal = contract.contractEstimates.reduce((s, ce) => s + (ce.estimate.purchaseOrder?.orderAmount ?? 0), 0)
                  const hasOrders = contract.contractEstimates.some(ce => ce.estimate.purchaseOrder)
                  const totalGrossProfit = estimatesTotal - ordersTotal
                  const totalGrossMargin = estimatesTotal > 0 ? Math.round((totalGrossProfit / estimatesTotal) * 100) : 0
                  return (
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-sm p-2.5 text-xs space-y-0.5">
                      <div className="flex justify-between">
                        <span className="text-blue-600">見積合計（税込）</span>
                        <span className="font-mono font-bold text-blue-800">¥{formatCurrency(estimatesTotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-600">契約金額（税込）</span>
                        <span className="font-mono font-bold text-blue-800">¥{formatCurrency(contract.totalAmount)}</span>
                      </div>
                      {hasOrders && (
                        <>
                          <div className="border-t border-blue-200 pt-0.5 mt-0.5" />
                          <div className="flex justify-between">
                            <span className="text-blue-600">発注合計（税抜）</span>
                            <span className="font-mono text-blue-700">¥{formatCurrency(ordersTotal)}</span>
                          </div>
                          <div className="flex justify-between font-bold">
                            <span className={totalGrossProfit < 0 ? "text-red-600" : "text-emerald-700"}>粗利合計 / 率</span>
                            <span className={`font-mono ${totalGrossProfit < 0 ? "text-red-600" : "text-emerald-700"}`}>
                              {totalGrossProfit < 0 ? "▲" : ""}¥{formatCurrency(Math.abs(totalGrossProfit))} ({totalGrossMargin}%)
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })()}
              </>
            ) : (
              <>
                {/* 非統合: 通常の契約一覧 */}
                {(() => {
                  const allContracts = siblingContracts.length > 1 ? siblingContracts : [{
                    id: contract.id,
                    contractNumber: contract.contractNumber,
                    name: contract.name,
                    status: contract.status,
                    contractAmount: contract.contractAmount,
                    taxAmount: contract.taxAmount,
                    totalAmount: contract.totalAmount,
                    contractDate: contract.contractDate,
                    estimate: contract.estimate ? {
                      id: contract.estimate.id,
                      estimateNumber: contract.estimate.estimateNumber,
                      title: null,
                      status: "CONFIRMED" as EstimateStatus,
                      estimateType: "INITIAL" as EstimateType,
                      user: contract.estimate.user,
                    } : null,
                    estimateCount: contract.contractEstimates.length,
                  }]
                  return (
                    <div className="border-2 border-slate-200 rounded-sm overflow-hidden divide-y divide-slate-100">
                      {allContracts.map((sc, i) => {
                        const isCurrent = sc.id === contract.id
                        const cConfig = STATUS_CONFIG[sc.status]
                        const canSwitch = !isCurrent && onOpenContract
                        return (
                          <div
                            key={sc.id}
                            onClick={() => canSwitch && onOpenContract!(sc.id)}
                            className={`px-2.5 py-2 transition-colors ${
                              isCurrent ? "bg-blue-50/50 border-l-2 border-l-blue-500" : "hover:bg-slate-50"
                            } ${canSwitch ? "cursor-pointer" : ""}`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs font-bold shrink-0 ${
                                i === 0 ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                              }`}>
                                {i === 0 ? "本工事" : `追加${i}`}
                              </span>
                              <span className={`text-xs font-bold truncate ${isCurrent ? "text-slate-800" : "text-slate-700"}`}>
                                {sc.name || sc.estimate?.title || sc.estimate?.estimateNumber || "見積"}
                              </span>
                              {isCurrent && <span className="text-xs text-blue-600 shrink-0">表示中</span>}
                              {canSwitch && <span className="text-xs text-blue-500 shrink-0">切替 →</span>}
                              <span className="ml-auto text-xs font-mono font-bold text-slate-700 shrink-0">
                                ¥{formatCurrency(sc.totalAmount)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 pl-[52px]">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs font-bold border ${cConfig.color}`}>
                                {cConfig.label}
                              </span>
                              {sc.contractNumber && (
                                <span className="text-xs text-slate-600 font-mono">{sc.contractNumber}</span>
                              )}
                              {isCurrent && sc.estimate && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); (onOpenEstimate ?? openEstimate)(sc.estimate!.id) }}
                                  className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-xs font-bold text-blue-600 hover:bg-blue-100 transition-colors"
                                >
                                  <FileText className="w-2.5 h-2.5" />見積書を開く
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </>
            )}
          </div>
        </div>

        {/* 右: お客様・現場情報 */}
        <div className="bg-white rounded-sm border-2 border-slate-300">
          <div className="px-4 py-3 border-b-2 border-slate-200">
            <h3 className="text-sm font-extrabold flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-slate-600" />
              お客様・現場
            </h3>
          </div>
          <div className="p-4 space-y-1 text-sm">
            <InfoRow label="会社名" value={contract.project.branch.company.name} compact />
            {contract.project.branch.name !== "本社" && (
              <InfoRow label="支店" value={contract.project.branch.name} compact />
            )}
            {contract.project.branch.company.phone && (
              <InfoRow label="電話" value={contract.project.branch.company.phone} compact />
            )}
            <div className="border-t-2 border-slate-100 pt-1 mt-1" />
            <InfoRow label="現場名" value={contract.project.name} compact />
            {contract.project.address && (
              <InfoRow label="住所" value={contract.project.address} compact />
            )}
            {contract.project.contact && (
              <>
                <div className="border-t-2 border-slate-100 pt-1 mt-1" />
                <InfoRow label="担当者" value={contract.project.contact.name} compact />
                {contract.project.contact.phone && (
                  <InfoRow label="電話" value={contract.project.contact.phone} compact />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── 下請け支払セクション ── */}
      {contract.works.some((w) => w.workType === "SUBCONTRACT") && (
        <SubPaymentSection
          contractId={contract.id}
          subPayments={contract.subcontractorPayments}
          works={contract.works.filter((w) => w.workType === "SUBCONTRACT")}
          onRefresh={() => {
            fetch(`/api/contracts/${contract.id}`)
              .then((r) => r.json())
              .then((data) => {
                if (data.subcontractorPayments) {
                  setContract((prev) => ({
                    ...prev,
                    subcontractorPayments: (data.subcontractorPayments as Record<string, unknown>[]).map((sp) => ({
                      id: sp.id as string,
                      subcontractorId: sp.subcontractorId as string,
                      subcontractorName: (sp.subcontractor as Record<string, unknown>)?.name as string ?? "",
                      orderAmount: Number(sp.orderAmount),
                      taxAmount: Number(sp.taxAmount),
                      totalAmount: Number(sp.totalAmount),
                      closingDate: sp.closingDate ? String(sp.closingDate) : null,
                      paymentDueDate: sp.paymentDueDate ? String(sp.paymentDueDate) : null,
                      paymentDate: sp.paymentDate ? String(sp.paymentDate) : null,
                      paymentAmount: sp.paymentAmount ? Number(sp.paymentAmount) : null,
                      status: sp.status as SubcontractorPaymentStatus,
                      notes: sp.notes as string | null,
                    })),
                  }))
                }
              })
          }}
        />
      )}

      {/* ── 工事区分セクション ── */}
      <div className="bg-white rounded-sm border-2 border-slate-300">
        <div className="px-4 py-3 border-b-2 border-slate-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-600" />
              工事区分
            </h3>
            <button
              className="flex items-center gap-1 px-3 py-1.5 rounded-sm text-xs font-bold border-2 border-slate-300 text-slate-700 hover:bg-slate-50 active:scale-95 transition-all"
              onClick={() => setAddWorkOpen(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              工事区分を追加
            </button>
          </div>
          {contract.works.length > 0 && (
            <div className="flex gap-4 mt-2 text-xs text-slate-500">
              {workSummary.totalManDays > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  自社工数: <strong className="text-slate-700">{workSummary.totalManDays} 人日</strong>
                </span>
              )}
              {workSummary.totalOrderAmount > 0 && (
                <span className="flex items-center gap-1">
                  <Truck className="w-3 h-3" />
                  外注合計: <strong className="text-slate-700">¥{formatCurrency(workSummary.totalOrderAmount)}</strong>
                </span>
              )}
            </div>
          )}
        </div>
        <div className="p-4">
          {contract.works.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Wrench className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-bold">工事区分がまだ登録されていません</p>
              <p className="text-xs mt-1">「工事区分を追加」から自社工事・外注工事を登録してください</p>
            </div>
          ) : (
            <div className="space-y-3">
              {contract.works.map((work) => (
                <WorkCard
                  key={work.id}
                  work={work}
                  contractId={contract.id}
                  taxRate={taxRate}
                  onOrderStatusUpdate={handleOrderStatusUpdate}
                  onDelete={handleDeleteWork}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 工事区分追加ダイアログ ── */}
      <Dialog open={addWorkOpen} onOpenChange={setAddWorkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              工事区分を追加
            </DialogTitle>
            <DialogDescription>自社工事または外注工事を登録します。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700">工事区分</label>
              <Select value={addWorkType} onValueChange={(v) => setAddWorkType(v as WorkType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INHOUSE">自社工事</SelectItem>
                  <SelectItem value="SUBCONTRACT">外注工事</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {addWorkType === "INHOUSE" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700">工事人数（人）</label>
                  <input
                    type="number"
                    min={1}
                    value={addWorkerCount}
                    onChange={(e) => setAddWorkerCount(e.target.value)}
                    placeholder="例: 3"
                    className="w-full px-3 py-2 rounded-sm border-2 border-slate-300 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700">工事日数（日）</label>
                  <input
                    type="number"
                    min={1}
                    value={addWorkDays}
                    onChange={(e) => setAddWorkDays(e.target.value)}
                    placeholder="例: 5"
                    className="w-full px-3 py-2 rounded-sm border-2 border-slate-300 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                {addWorkerCount && addWorkDays && (
                  <div className="col-span-2 text-sm font-bold text-blue-700 bg-blue-50 rounded-sm border-2 border-blue-200 px-3 py-2">
                    工数: <strong>{parseInt(addWorkerCount) * parseInt(addWorkDays)} 人日</strong>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700">外注先（下請け業者）</label>
                  {subcontractors.length > 0 ? (
                    <Select value={addSubId} onValueChange={setAddSubId}>
                      <SelectTrigger>
                        <SelectValue placeholder="外注先を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {subcontractors.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                            {s.representative && <span className="text-slate-400 ml-2 text-xs">（{s.representative}）</span>}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm text-slate-400 py-1">
                      外注先が未登録です。マスター管理から追加してください。
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700">発注金額（税抜）</label>
                  <input
                    type="number"
                    min={0}
                    value={addOrderAmount}
                    onChange={(e) => setAddOrderAmount(e.target.value)}
                    placeholder="例: 500000"
                    className="w-full px-3 py-2 rounded-sm border-2 border-slate-300 text-sm focus:outline-none focus:border-blue-500"
                  />
                  {addOrderAmount && (
                    <div className="text-xs text-slate-500 mt-1">
                      消費税: ¥{formatCurrency(Math.floor(parseFloat(addOrderAmount) * taxRate))}
                      {" / "}
                      合計: ¥{formatCurrency(Math.floor(parseFloat(addOrderAmount) * (1 + taxRate)))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700">備考</label>
              <textarea
                value={addWorkNote}
                onChange={(e) => setAddWorkNote(e.target.value)}
                placeholder="任意のメモ"
                rows={2}
                className="w-full px-3 py-2 rounded-sm border-2 border-slate-300 text-sm focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setAddWorkOpen(false)} disabled={addingSaving} className="px-4 py-2 rounded-sm text-sm font-bold border-2 border-slate-300 text-slate-700 hover:bg-slate-50 active:scale-95 transition-all disabled:opacity-50">
              キャンセル
            </button>
            <button onClick={handleAddWork} disabled={addingSaving} className="px-4 py-2 rounded-sm text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-50">
              {addingSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />保存中...</> : "追加する"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
      </div>

      {/* ── 右パネル: 見積詳細 ── */}
      {!isEmbedded && estimatePanel && (
        <div className="flex-1 min-w-0 border-l border-slate-200 bg-white shadow-sm">
          <div className="max-h-[calc(100vh-4rem)] overflow-y-auto px-6 pb-8">
            {estimatePanel.loading || !estimatePanel.data ? (
              <div className="flex items-center justify-center py-32">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                <span className="ml-2 text-slate-500">読み込み中...</span>
              </div>
            ) : (
              <EstimateDetail
                key={estimatePanel.id}
                estimate={estimatePanel.data.estimate}
                taxRate={estimatePanel.data.taxRate}
                units={estimatePanel.data.units}
                currentUser={currentUser}
                contacts={estimatePanel.data.contacts}
                embedded
                onClose={closeEstimate}
                onNavigateEstimate={(id) => openEstimate(id)}
                onRefresh={refreshEstimate}
              />
            )}
          </div>
        </div>
      )}

      {/* ── 契約統合確認ダイアログ ── */}
      <Dialog open={consolidateOpen} onOpenChange={setConsolidateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Layers className="w-4 h-4 text-purple-600" />契約の統合
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              以下の{siblingContracts.length}件の契約を1つに統合します。統合後、個別の契約は削除され、1つの契約としてまとめて管理されます。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 my-2">
            {siblingContracts.map((sc, i) => (
              <div key={sc.id} className="flex items-center gap-2 p-2 rounded-sm border-2 border-slate-200 bg-slate-50 text-xs">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs font-bold shrink-0 ${
                  i === 0 ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                }`}>
                  {i === 0 ? "本工事" : `追加${i}`}
                </span>
                <span className="text-slate-700 truncate flex-1">{sc.name || sc.estimate?.title || sc.contractNumber}</span>
                <span className="font-mono text-slate-600 shrink-0">¥{formatCurrency(sc.totalAmount)}</span>
              </div>
            ))}
            <div className="flex justify-between p-2 rounded-sm border-2 border-purple-300 bg-purple-50 text-xs font-bold">
              <span className="text-purple-700">統合後の契約金額</span>
              <span className="font-mono text-purple-900">¥{formatCurrency(siblingContracts.reduce((s, c) => s + c.totalAmount, 0))}</span>
            </div>
          </div>
          <div className="bg-amber-50 border-2 border-amber-200 rounded-sm p-2 text-sm text-amber-700 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">この操作は取り消せません</p>
              <p>工事区分・工程・請求書・下請支払は統合契約に引き継がれます。</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={() => setConsolidateOpen(false)} className="px-3 py-1.5 rounded-sm text-xs font-bold border-2 border-slate-300 text-slate-700 hover:bg-slate-50 active:scale-95 transition-all">
              キャンセル
            </button>
            <button
              className="flex items-center gap-1 px-3 py-1.5 rounded-sm text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 active:scale-95 transition-all disabled:opacity-50"
              onClick={handleConsolidate}
              disabled={consolidating}
            >
              {consolidating && <Loader2 className="w-3 h-3 animate-spin" />}
              統合する
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── サブコンポーネント ──────────────────────────────────

function InfoRow({ label, value, mono, bold, icon, compact }: {
  label: string; value: string; mono?: boolean; bold?: boolean; icon?: React.ReactNode; compact?: boolean
}) {
  if (compact) {
    return (
      <div className="flex items-start gap-2">
        <span className="text-xs text-slate-600 flex items-center gap-0.5 shrink-0 w-[70px]">
          {icon}
          {label}
        </span>
        <span className={`text-xs break-all ${mono ? "font-mono" : ""} ${bold ? "font-bold text-slate-900" : "text-slate-700"}`}>
          {value}
        </span>
      </div>
    )
  }
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-slate-600 flex items-center gap-1 flex-shrink-0 min-w-[100px]">
        {icon}
        {label}
      </span>
      <span className={`text-sm text-right ${mono ? "font-mono" : ""} ${bold ? "font-bold text-slate-900" : "text-slate-700"}`}>
        {value}
      </span>
    </div>
  )
}

function WorkCard({ work, contractId, taxRate, onOrderStatusUpdate, onDelete }: {
  work: ContractWorkData
  contractId: string
  taxRate: number
  onOrderStatusUpdate: (workId: string, status: OrderStatus) => void
  onDelete: (workId: string) => void
}) {
  const isInhouse = work.workType === "INHOUSE"
  const manDays = isInhouse ? (work.workerCount ?? 0) * (work.workDays ?? 0) : 0

  return (
    <div className={`border-2 rounded-sm p-4 ${isInhouse ? "border-blue-200 bg-blue-50/30" : "border-amber-200 bg-amber-50/30"}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 mb-3">
          {isInhouse ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-xs font-bold bg-blue-100 text-blue-700">
              <Users className="w-3 h-3" />
              自社工事
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-xs font-bold bg-amber-100 text-amber-700">
              <Truck className="w-3 h-3" />
              外注工事
            </span>
          )}
          {!isInhouse && (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-sm text-xs font-bold ${ORDER_STATUS_STYLE[work.orderStatus]}`}>
              {ORDER_STATUS_LABEL[work.orderStatus]}
            </span>
          )}
        </div>
        <button
          className="h-7 w-7 flex items-center justify-center rounded-sm text-slate-400 hover:text-red-500 hover:bg-red-50 active:scale-95 transition-all"
          onClick={() => onDelete(work.id)}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {isInhouse ? (
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs font-bold text-slate-600">人数</p>
            <p className="font-bold">{work.workerCount ?? "—"} 人</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-600">日数</p>
            <p className="font-bold">{work.workDays ?? "—"} 日</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-600">工数</p>
            <p className="font-extrabold text-blue-700">{manDays} 人日</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {work.subcontractor && (
            <div>
              <p className="text-xs font-bold text-slate-600">外注先</p>
              <p className="text-sm font-bold">{work.subcontractor.name}</p>
              {work.subcontractor.representative && (
                <p className="text-xs text-slate-500">代表: {work.subcontractor.representative}</p>
              )}
            </div>
          )}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs font-bold text-slate-600">発注金額（税抜）</p>
              <p className="font-mono font-bold">¥{formatCurrency(work.orderAmount ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-600">消費税</p>
              <p className="font-mono text-slate-600">¥{formatCurrency(work.orderTaxAmount ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-600">合計（税込）</p>
              <p className="font-mono font-extrabold text-amber-700">¥{formatCurrency(work.orderTotalAmount ?? 0)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t-2 border-amber-200/50">
            {work.orderStatus === "NOT_ORDERED" && (
              <button
                className="flex items-center gap-1 px-3 py-1.5 rounded-sm text-xs font-bold border-2 border-slate-300 text-slate-700 hover:bg-slate-50 active:scale-95 transition-all"
                onClick={() => onOrderStatusUpdate(work.id, "ORDERED")}
              >
                <Clock className="w-3 h-3" />
                発注済にする
              </button>
            )}
            {work.orderStatus === "ORDERED" && (
              <>
                <button
                  className="flex items-center gap-1 px-3 py-1.5 rounded-sm text-xs font-bold border-2 border-green-300 text-green-700 hover:bg-green-50 active:scale-95 transition-all"
                  onClick={() => onOrderStatusUpdate(work.id, "COMPLETED")}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  完了にする
                </button>
                <Link href={`/orders/${work.id}/print`} target="_blank">
                  <button className="flex items-center gap-1 px-3 py-1.5 rounded-sm text-xs font-bold border-2 border-slate-300 text-slate-700 hover:bg-slate-50 active:scale-95 transition-all">
                    <Printer className="w-3 h-3" />
                    発注書
                  </button>
                </Link>
              </>
            )}
            {work.orderStatus === "COMPLETED" && work.orderedAt && (
              <span className="text-xs font-bold text-slate-600">
                発注日: {formatDate(work.orderedAt, "yyyy/MM/dd")}
              </span>
            )}
            {(work.orderStatus === "ORDERED" || work.orderStatus === "COMPLETED") && (
              <Link href={`/orders/${work.id}/print`} target="_blank" className="ml-auto">
                <button className="flex items-center gap-1 px-2 py-1 rounded-sm text-xs font-bold text-slate-500 hover:bg-slate-100 active:scale-95 transition-all">
                  <Printer className="w-3 h-3" />
                  発注書印刷
                </button>
              </Link>
            )}
          </div>
        </div>
      )}
      {work.note && (
        <p className="text-xs text-slate-500 mt-2 pt-2 border-t-2 border-slate-200/50">
          備考: {work.note}
        </p>
      )}
    </div>
  )
}

function SectionRows({ section }: { section: EstimateSection }) {
  return (
    <>
      <tr className="bg-slate-50/50">
        <td colSpan={5} className="px-3 py-1.5 text-xs font-bold text-slate-600 border-b border-slate-100">
          {section.name}
        </td>
      </tr>
      {section.groups.map((group) => (
        <GroupRows key={group.id} group={group} />
      ))}
    </>
  )
}

function GroupRows({ group }: { group: EstimateGroup }) {
  return (
    <>
      <tr>
        <td colSpan={5} className="px-3 py-1 text-xs text-slate-500 border-b border-slate-50 pl-6">
          {group.name}
        </td>
      </tr>
      {group.items.map((item) => {
        const amount = item.quantity * item.unitPrice
        return (
          <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50">
            <td className="px-3 py-1.5 text-sm pl-9">{item.name}</td>
            <td className="px-3 py-1.5 text-sm text-right font-mono">{item.quantity}</td>
            <td className="px-3 py-1.5 text-sm text-center text-slate-500">{item.unit.name}</td>
            <td className="px-3 py-1.5 text-sm text-right font-mono">¥{formatCurrency(item.unitPrice)}</td>
            <td className="px-3 py-1.5 text-sm text-right font-mono font-bold">¥{formatCurrency(amount)}</td>
          </tr>
        )
      })}
    </>
  )
}

// ─── 工期セクション ────────────────────────────────────

import type { WorkTypeMaster } from "@/components/schedules/schedule-types"
import { buildWtConfigMap, getWtConfig } from "@/components/schedules/schedule-constants"
import { ScheduleMiniGantt } from "@/components/schedules/ScheduleMiniGantt"
import { SiteOpsDialog } from "@/components/site-operations/SiteOpsDialog"
import { SiteOpsDateSection } from "@/components/site-operations/SiteOpsDateSection"
import { ScheduleCalendarModal } from "@/components/schedules/ScheduleCalendarModal"

function ScheduleSection({ contractId, contractStatus, schedules, workTypes, project, onRefresh, onStatusChange }: {
  contractId: string; contractStatus: ContractStatus; schedules: ScheduleData[]; workTypes: WorkTypeMaster[];
  project?: { id: string; name: string; companyName: string };
  onRefresh: () => void; onStatusChange: (s: ContractStatus) => void
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [viewMode, setViewMode] = useState<"gantt" | "list">("gantt")

  // カレンダーモーダル用 ContractData
  const contractDataForCalendar = useMemo(() => project ? [{
    id: contractId,
    contractNumber: null,
    status: contractStatus,
    startDate: null,
    endDate: null,
    project: { id: project.id, name: project.name, companyName: project.companyName },
    schedules,
  }] : [], [contractId, contractStatus, schedules, project])

  // 工種設定マップ
  const wtConfigMap = useMemo(() => buildWtConfigMap(workTypes), [workTypes])

  const STATUS_IDX: Record<ContractStatus, number> = {
    CONTRACTED: 0, SCHEDULE_CREATED: 1, IN_PROGRESS: 2, COMPLETED: 3, BILLED: 4, PAID: 5, CANCELLED: 6,
  }
  const isLocked = STATUS_IDX[contractStatus] >= STATUS_IDX["SCHEDULE_CREATED"]
  const canConfirm = contractStatus === "CONTRACTED" && schedules.length > 0
  const canUnconfirm = contractStatus === "SCHEDULE_CREATED"

  async function handleConfirmSchedule() {
    if (!confirm("工程を確定し、「工程作成済み」に進めますか？\n確定後は工程の編集ができなくなります。")) return
    setSaving(true)
    try {
      const res = await fetch(`/api/contracts/${contractId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SCHEDULE_CREATED" }),
      })
      if (!res.ok) { const data = await res.json().catch(() => null); throw new Error(data?.error ?? "更新に失敗しました") }
      toast.success("工程を確定しました"); onStatusChange("SCHEDULE_CREATED"); router.refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : "更新に失敗しました") }
    finally { setSaving(false) }
  }

  async function handleUnconfirmSchedule() {
    if (!confirm("工程の確定を解除しますか？\n「契約済み」に戻り、工程を再編集できるようになります。")) return
    setSaving(true)
    try {
      const res = await fetch(`/api/contracts/${contractId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CONTRACTED" }),
      })
      if (!res.ok) { const data = await res.json().catch(() => null); throw new Error(data?.error ?? "更新に失敗しました") }
      toast.success("確定を解除しました"); onStatusChange("CONTRACTED"); router.refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : "更新に失敗しました") }
    finally { setSaving(false) }
  }

  // 現場操作ダイアログ
  const [siteOpsScheduleId, setSiteOpsScheduleId] = useState<string | null>(null)

  // API: スケジュール作成
  const handleCreateSchedule = useCallback(async (workType: string, name: string, startDate: string, endDate: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/contracts/${contractId}/schedules`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workType, name, plannedStartDate: startDate, plannedEndDate: endDate }),
      })
      if (!res.ok) throw new Error()
      toast.success(`${getWtConfig(workType, wtConfigMap).label}を追加しました`)
      onRefresh(); router.refresh()
    } catch { toast.error("追加に失敗しました") }
    finally { setSaving(false) }
  }, [contractId, wtConfigMap, onRefresh, router])

  // API: 日付更新
  const handleUpdateDates = useCallback(async (scheduleId: string, newStart: string, newEnd: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plannedStartDate: newStart, plannedEndDate: newEnd }),
      })
      if (!res.ok) throw new Error()
      toast.success("日付を更新しました")
      onRefresh(); router.refresh()
    } catch { toast.error("更新に失敗しました") }
    finally { setSaving(false) }
  }, [onRefresh, router])


  return (
    <div className="bg-white rounded-sm border-2 border-slate-300">
      <div className="px-4 py-3 border-b-2 border-slate-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-blue-600" />
            工期
          </h3>
          <div className="flex items-center gap-1.5">
            {/* リスト / ガント 切替 */}
            <div className="flex items-center bg-slate-100 rounded-sm p-0.5">
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1 px-2 py-1 rounded-sm text-xs font-bold transition-all ${
                  viewMode === "list" ? "bg-white text-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                リスト
              </button>
              <button
                onClick={() => setViewMode("gantt")}
                className={`flex items-center gap-1 px-2 py-1 rounded-sm text-xs font-bold transition-all ${
                  viewMode === "gantt" ? "bg-white text-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                ガント
              </button>
            </div>
            {project && (
              <button
                className="flex items-center gap-1 px-2 py-1 rounded-sm text-xs font-bold border-2 border-blue-200 text-blue-600 hover:bg-blue-50 active:scale-95 transition-all"
                onClick={() => setCalendarOpen(true)}
              >
                <CalendarDays className="w-3 h-3" />
                カレンダー
              </button>
            )}
            <Link href={`/schedules?contractId=${contractId}`}>
              <button className="flex items-center gap-1 px-2 py-1 rounded-sm text-xs font-bold border-2 border-slate-300 text-slate-700 hover:bg-slate-50 active:scale-95 transition-all">
                <ExternalLink className="w-3 h-3" />
                全体表示
              </button>
            </Link>
          </div>
        </div>
      </div>
      <div className="p-4">
        {/* ロック状態バナー */}
        {isLocked && (
          <div className={`flex items-center gap-2 mb-2 px-3 py-2 rounded-sm text-xs border-2 ${
            canUnconfirm
              ? "bg-cyan-50 text-cyan-800 border-cyan-200"
              : "bg-slate-50 text-slate-500 border-slate-200"
          }`}>
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span className="font-bold">工程確定済み</span>
            <span className="text-xs opacity-70">— 編集するには確定を解除してください</span>
            {canUnconfirm && (
              <button
                className="ml-auto px-2 py-1 rounded-sm text-xs font-bold border-2 border-cyan-300 text-cyan-700 hover:bg-cyan-100 active:scale-95 transition-all disabled:opacity-50"
                onClick={handleUnconfirmSchedule}
                disabled={saving}
              >
                確定解除
              </button>
            )}
          </div>
        )}

        {viewMode === "gantt" ? (
          /* ── 共有ガントチャートモジュール ── */
          <ScheduleMiniGantt
            schedules={schedules}
            displayDays={15}
            isLocked={isLocked}
            workTypes={workTypes}
            onCreateSchedule={handleCreateSchedule}
            onUpdateDates={handleUpdateDates}
            onClickSchedule={isLocked ? undefined : (id) => setSiteOpsScheduleId(id)}
            onCalendarOpen={project ? () => setCalendarOpen(true) : undefined}
          />
        ) : (
          /* ── リスト表示（SiteOpsDateSection共有） ── */
          project ? (
            <SiteOpsDateSection
              activeScheduleId={schedules[0]?.id ?? ""}
              siblings={schedules as never[]}
              projectId={project.id}
              contractId={contractId}
              onUpdated={onRefresh}
            />
          ) : (
            <div className="text-center py-6 text-slate-400">
              <p className="text-xs">プロジェクト情報がありません</p>
            </div>
          )
        )}

        {/* 確定ボタン */}
        {canConfirm && (
          <div className="flex justify-end mt-2">
            <button
              className="flex items-center gap-1 px-3 py-1.5 rounded-sm text-xs font-bold bg-cyan-600 text-white hover:bg-cyan-700 active:scale-95 transition-all disabled:opacity-50"
              onClick={handleConfirmSchedule}
              disabled={saving}
            >
              <CheckCircle2 className="w-3 h-3" />
              工程を確定する
            </button>
          </div>
        )}
      </div>

      {/* 現場操作ダイアログ */}
      <SiteOpsDialog
        open={!!siteOpsScheduleId}
        onClose={() => setSiteOpsScheduleId(null)}
        scheduleId={siteOpsScheduleId}
        onUpdated={() => { onRefresh(); router.refresh() }}
      />

      {/* カレンダーモーダル */}
      {contractDataForCalendar.length > 0 && (
        <ScheduleCalendarModal
          open={calendarOpen}
          onClose={() => setCalendarOpen(false)}
          contracts={contractDataForCalendar}
          workTypes={workTypes}
          defaultContractId={contractId}
          onScheduleChanged={() => { onRefresh(); router.refresh() }}
        />
      )}
    </div>
  )
}


// ─── この商談の契約・見積一覧セクション ────────────────────

const ESTIMATE_TYPE_LABEL: Record<EstimateType, string> = {
  INITIAL: "通常", ADDITIONAL: "追加",
}
const ESTIMATE_STATUS_LABEL: Record<EstimateStatus, string> = {
  DRAFT: "下書き", CONFIRMED: "確定済", SENT: "送付済", OLD: "旧版",
}
const ESTIMATE_STATUS_STYLE: Record<EstimateStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  CONFIRMED: "bg-blue-50 text-blue-700",
  SENT: "bg-green-50 text-green-700",
  OLD: "bg-slate-50 text-slate-500",
}

function SiblingContractsSection({ currentContractId, siblings, projectId, onOpenEstimate, onOpenContract, compact }: {
  currentContractId: string
  siblings: SiblingContract[]
  projectId: string
  onOpenEstimate?: (id: string) => void
  onOpenContract?: (id: string) => void
  compact?: boolean
}) {
  const totalAmount = siblings.reduce((s, c) => s + c.totalAmount, 0)

  if (compact) {
    return (
      <div className="bg-white rounded-sm border-2 border-slate-300">
        <div className="px-4 py-3 border-b-2 border-slate-200">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-orange-600" />
              契約・見積一覧
              <span className="text-xs text-slate-600 font-normal">（{siblings.length}件）</span>
            </h3>
            <Link href={`/estimates/new?projectId=${projectId}`}>
              <button className="flex items-center gap-0.5 px-2 py-1 rounded-sm text-xs font-bold border-2 border-orange-300 text-orange-700 hover:bg-orange-50 active:scale-95 transition-all">
                <Plus className="w-3 h-3" />追加
              </button>
            </Link>
          </div>
          <div className="text-xs font-bold text-slate-500 mt-1">
            合計: <strong className="text-slate-700 font-mono">¥{formatCurrency(totalAmount)}</strong>
          </div>
        </div>
        <div className="p-4">
          <div className="border-2 border-slate-200 rounded-sm overflow-hidden divide-y divide-slate-100">
            {siblings.map((sc, i) => {
              const isCurrent = sc.id === currentContractId
              const cConfig = STATUS_CONFIG[sc.status]
              const canSwitch = !isCurrent && onOpenContract
              return (
                <div
                  key={sc.id}
                  onClick={() => canSwitch && onOpenContract!(sc.id)}
                  className={`px-2.5 py-2 transition-colors ${
                    isCurrent ? "bg-blue-50/50 border-l-[3px] border-l-blue-500" : "hover:bg-slate-50"
                  } ${canSwitch ? "cursor-pointer" : ""}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs font-bold shrink-0 ${
                      i === 0 ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                    }`}>
                      {i === 0 ? "本工事" : `追加${i}`}
                    </span>
                    <span className={`text-xs font-bold truncate ${isCurrent ? "text-slate-800" : "text-slate-700"}`}>
                      {sc.name || sc.estimate?.title || sc.estimate?.estimateNumber || "見積"}
                    </span>
                    {isCurrent && <span className="text-xs font-bold text-blue-600 shrink-0">表示中</span>}
                    {canSwitch && <span className="text-xs font-bold text-blue-500 shrink-0">切替 →</span>}
                    <span className="ml-auto text-xs font-mono font-bold text-slate-700 shrink-0">
                      ¥{formatCurrency(sc.totalAmount)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 ml-[52px]">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs font-bold border-2 ${cConfig.color}`}>
                      {cConfig.label}
                    </span>
                    {sc.estimate && (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs font-bold ${ESTIMATE_STATUS_STYLE[sc.estimate.status]}`}>
                        {ESTIMATE_STATUS_LABEL[sc.estimate.status]}
                      </span>
                    )}
                    {sc.contractNumber && (
                      <span className="text-xs text-slate-600 font-mono ml-auto">{sc.contractNumber}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-sm border-2 border-slate-300">
      <div className="px-4 py-3 border-b-2 border-slate-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold flex items-center gap-2">
            <Layers className="w-4 h-4 text-orange-600" />
            この商談の契約・見積一覧
            <span className="text-xs text-slate-600 font-normal">（{siblings.length}件）</span>
          </h3>
          <Link href={`/estimates/new?projectId=${projectId}`}>
            <button className="flex items-center gap-1 px-3 py-1.5 rounded-sm text-xs font-bold border-2 border-orange-300 text-orange-700 hover:bg-orange-50 active:scale-95 transition-all">
              <Plus className="w-3.5 h-3.5" />追加工事の見積を作成
            </button>
          </Link>
        </div>
        <div className="flex gap-4 mt-2 text-xs font-bold text-slate-500">
          <span>合計金額: <strong className="text-slate-700">¥{formatCurrency(totalAmount)}</strong></span>
        </div>
      </div>
      <div className="p-4">
        <div className="border-2 border-slate-200 rounded-sm overflow-hidden">
          <div className="grid grid-cols-[0.5fr_2fr_1fr_0.8fr_1fr_0.8fr] gap-x-3 px-3 py-2 bg-slate-50 border-b-2 border-slate-200 text-xs font-bold text-slate-600">
            <span>種別</span>
            <span>見積タイトル / 契約番号</span>
            <span>見積ステータス</span>
            <span>契約ステータス</span>
            <span className="text-right">金額（税込）</span>
            <span>契約日</span>
          </div>
          {siblings.map((sc, i) => {
            const isCurrent = sc.id === currentContractId
            const cConfig = STATUS_CONFIG[sc.status]
            const canSwitch = !isCurrent && onOpenContract
            return (
              <div
                key={sc.id}
                onClick={() => canSwitch && onOpenContract!(sc.id)}
                className={`grid grid-cols-[0.5fr_2fr_1fr_0.8fr_1fr_0.8fr] gap-x-3 px-3 py-2.5 items-center transition-colors ${
                  isCurrent ? "bg-blue-50/50 border-l-[3px] border-l-blue-500" : "hover:bg-slate-50"
                } ${canSwitch ? "cursor-pointer" : ""} ${i < siblings.length - 1 ? "border-b border-slate-100" : ""}`}
              >
                <div>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs font-bold ${
                    i === 0 ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                  }`}>
                    {i === 0 ? "本工事" : `追加${i}`}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm font-bold truncate ${isCurrent ? "text-slate-800" : "text-slate-700"}`}>
                      {sc.name || sc.estimate?.title || sc.estimate?.estimateNumber || "見積"}
                    </span>
                    {isCurrent && <span className="text-xs font-bold text-blue-600 shrink-0">(表示中)</span>}
                    {canSwitch && <span className="text-xs font-bold text-blue-500 shrink-0">切替 →</span>}
                  </div>
                  {sc.contractNumber && (
                    <span className="text-xs text-slate-600 font-mono">{sc.contractNumber}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {sc.estimate ? (
                    <>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs font-bold ${ESTIMATE_STATUS_STYLE[sc.estimate.status]}`}>
                        {ESTIMATE_STATUS_LABEL[sc.estimate.status]}
                      </span>
                      <span className="text-xs font-bold text-slate-600">
                        {ESTIMATE_TYPE_LABEL[sc.estimate.estimateType]}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs font-bold text-slate-600">一括契約</span>
                  )}
                </div>
                <div>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs font-bold border-2 ${cConfig.color}`}>
                    {cConfig.label}
                  </span>
                </div>
                <div className="text-right font-mono text-sm font-bold text-slate-700">
                  ¥{formatCurrency(sc.totalAmount)}
                </div>
                <div className="text-xs font-bold text-slate-500">
                  {formatDate(sc.contractDate, "MM/dd")}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── 下請け支払セクション ────────────────────────────────

function SubPaymentSection({ contractId, subPayments, works, onRefresh }: {
  contractId: string
  subPayments: SubPaymentData[]
  works: ContractWorkData[]
  onRefresh: () => void
}) {
  const router = useRouter()

  const totalSub = subPayments.reduce((s, p) => s + p.totalAmount, 0)
  const paidSub = subPayments.filter((p) => p.status === "PAID").reduce((s, p) => s + (p.paymentAmount ?? p.totalAmount), 0)

  async function handleStatusUpdate(payId: string, status: SubcontractorPaymentStatus) {
    const label = SUB_PAY_STATUS_LABEL[status]
    if (!confirm(`ステータスを「${label}」に変更しますか？`)) return
    const body: Record<string, unknown> = { status }
    if (status === "PAID") body.paymentDate = new Date().toISOString().slice(0, 10)
    const res = await fetch(`/api/subcontractor-payments/${payId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (res.ok) { toast.success(`${label}に更新`); onRefresh(); router.refresh() }
    else toast.error("更新に失敗")
  }

  async function handleDelete(payId: string) {
    if (!confirm("この支払いを削除しますか？")) return
    const res = await fetch(`/api/subcontractor-payments/${payId}`, { method: "DELETE" })
    if (res.ok) { toast.success("削除しました"); onRefresh(); router.refresh() }
    else toast.error("削除に失敗")
  }

  async function handleCreateFromWork(work: ContractWorkData) {
    if (!work.subcontractorId) return
    const res = await fetch("/api/subcontractor-payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contractId,
        subcontractorId: work.subcontractorId,
        orderAmount: work.orderAmount ?? 0,
        taxAmount: work.orderTaxAmount ?? 0,
        totalAmount: work.orderTotalAmount ?? 0,
      }),
    })
    if (res.ok) { toast.success("支払いを登録しました"); onRefresh(); router.refresh() }
    else toast.error("登録に失敗しました")
  }

  const hasUnregistered = works.some((w) =>
    w.subcontractorId && !subPayments.some((sp) => sp.subcontractorId === w.subcontractorId)
  )

  return (
    <div className="bg-white rounded-sm border-2 border-slate-300">
      <div className="px-4 py-3 border-b-2 border-slate-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold flex items-center gap-2">
            <Truck className="w-4 h-4 text-orange-600" />
            下請け支払い
          </h3>
          {hasUnregistered && (
            <div className="flex gap-1">
              {works.filter((w) => w.subcontractorId && !subPayments.some((sp) => sp.subcontractorId === w.subcontractorId)).map((w) => (
                <button key={w.id} className="flex items-center gap-1 px-3 py-1.5 rounded-sm text-xs font-bold border-2 border-slate-300 text-slate-700 hover:bg-slate-50 active:scale-95 transition-all" onClick={() => handleCreateFromWork(w)}>
                  <Plus className="w-3 h-3" />{w.subcontractor?.name}
                </button>
              ))}
            </div>
          )}
        </div>
        {subPayments.length > 0 && (
          <div className="flex gap-4 mt-2 text-xs font-bold text-slate-500">
            <span>支払合計: <strong className="text-slate-700">¥{formatCurrency(totalSub)}</strong></span>
            <span>支払済: <strong className="text-green-700">¥{formatCurrency(paidSub)}</strong></span>
          </div>
        )}
      </div>
      <div className="p-4">
        {subPayments.length === 0 ? (
          <div className="text-center py-6 text-slate-400">
            <Truck className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-bold">下請け支払いがまだ登録されていません</p>
          </div>
        ) : (
          <div className="space-y-2">
            {subPayments.map((sp) => (
              <div key={sp.id} className="border-2 border-slate-200 rounded-sm p-3 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-sm text-xs font-bold ${SUB_PAY_STATUS_STYLE[sp.status]}`}>
                      {SUB_PAY_STATUS_LABEL[sp.status]}
                    </span>
                    <span className="text-sm font-bold text-slate-700">{sp.subcontractorName}</span>
                  </div>
                  <button className="h-7 w-7 flex items-center justify-center rounded-sm text-slate-400 hover:text-red-500 hover:bg-red-50 active:scale-95 transition-all" onClick={() => handleDelete(sp.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex gap-3 text-xs font-bold text-slate-600">
                    {sp.closingDate && <span>締日: {formatDate(sp.closingDate, "MM/dd")}</span>}
                    {sp.paymentDueDate && <span>期日: {formatDate(sp.paymentDueDate, "MM/dd")}</span>}
                    {sp.paymentDate && <span className="text-green-600">支払日: {formatDate(sp.paymentDate, "MM/dd")}</span>}
                  </div>
                  <span className="font-mono font-extrabold">¥{formatCurrency(sp.totalAmount)}</span>
                </div>
                <div className="flex items-center gap-2 mt-2 pt-2 border-t-2 border-slate-100">
                  {sp.status === "PENDING" && (
                    <button className="flex items-center gap-1 px-3 py-1.5 rounded-sm text-xs font-bold border-2 border-blue-300 text-blue-700 hover:bg-blue-50 active:scale-95 transition-all" onClick={() => handleStatusUpdate(sp.id, "SCHEDULED")}>
                      <Clock className="w-3 h-3" />支払予定にする
                    </button>
                  )}
                  {(sp.status === "PENDING" || sp.status === "SCHEDULED") && (
                    <button className="flex items-center gap-1 px-3 py-1.5 rounded-sm text-xs font-bold border-2 border-green-300 text-green-700 hover:bg-green-50 active:scale-95 transition-all" onClick={() => handleStatusUpdate(sp.id, "PAID")}>
                      <CheckCircle2 className="w-3 h-3" />支払済にする
                    </button>
                  )}
                </div>
                {sp.notes && <p className="text-xs text-slate-500 mt-1">備考: {sp.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Decimal/Date を number/string に変換するヘルパー
function serializeWork(w: Record<string, unknown>): ContractWorkData {
  return {
    id: w.id as string,
    workType: w.workType as WorkType,
    workerCount: w.workerCount as number | null,
    workDays: w.workDays as number | null,
    subcontractorId: w.subcontractorId as string | null,
    orderAmount: w.orderAmount ? Number(w.orderAmount) : null,
    orderTaxAmount: w.orderTaxAmount ? Number(w.orderTaxAmount) : null,
    orderTotalAmount: w.orderTotalAmount ? Number(w.orderTotalAmount) : null,
    orderStatus: w.orderStatus as OrderStatus,
    orderedAt: w.orderedAt ? String(w.orderedAt) : null,
    note: w.note as string | null,
    createdAt: String(w.createdAt),
    subcontractor: w.subcontractor ? {
      id: (w.subcontractor as Record<string, unknown>).id as string,
      name: (w.subcontractor as Record<string, unknown>).name as string,
      representative: (w.subcontractor as Record<string, unknown>).representative as string | null,
      address: (w.subcontractor as Record<string, unknown>).address as string | null,
      phone: (w.subcontractor as Record<string, unknown>).phone as string | null,
    } : null,
  }
}

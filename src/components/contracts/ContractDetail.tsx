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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Ban,
  X,
  AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"
import {
  format,
  eachDayOfInterval,
  isToday,
  isWeekend,
  parseISO,
  isBefore,
  isAfter,
  differenceInDays,
  addDays,
  subDays,
  getDate,
} from "date-fns"
import { ja } from "date-fns/locale"
import type { ContractStatus, WorkType, OrderStatus, ScheduleWorkType, SubcontractorPaymentStatus, EstimateStatus, EstimateType } from "@prisma/client"

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
  workType: ScheduleWorkType
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
  }
  works: ContractWorkData[]
  schedules: ScheduleData[]
  invoices: { id: string; status: string }[]
  subcontractorPayments: SubPaymentData[]
}

interface SiblingContract {
  id: string
  contractNumber: string | null
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
  }
}

interface Props {
  contract: ContractData
  siblingContracts: SiblingContract[]
  subcontractors: SubcontractorOption[]
  currentUser: { id: string; name: string }
  onOpenEstimate?: (estimateId: string) => void
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
      if (!schedules.some((s) => s.actualStartDate)) return "実績開始日が未入力です。着工するには実績を入力してください。"
      break
    case "COMPLETED":
      if (schedules.length === 0) return "工程が未登録です。"
      if (!schedules.every((s) => s.actualEndDate)) return "全工程の実績終了日が未入力です。完工にするには全工程を完了してください。"
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

const SCHEDULE_WORK_TYPE_CONFIG: Record<ScheduleWorkType, { label: string; color: string; bgColor: string }> = {
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

export function ContractDetail({ contract: initialContract, siblingContracts, subcontractors, currentUser, onOpenEstimate, onClose }: Props) {
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
      <div className={isEmbedded ? "flex flex-col gap-2" : "flex items-center justify-between"}>
        <div className="flex items-center gap-3">
          {isEmbedded ? (
            <Button variant="ghost" size="sm" className="text-slate-500" onClick={onClose}>
              <X className="w-4 h-4 mr-1" />
              閉じる
            </Button>
          ) : (
            <Link href="/contracts">
              <Button variant="ghost" size="sm" className="text-slate-500">
                <ArrowLeft className="w-4 h-4 mr-1" />
                契約一覧
              </Button>
            </Link>
          )}
          <div>
            <h1 className={`${isEmbedded ? "text-lg" : "text-2xl"} font-bold text-slate-900 flex items-center gap-2`}>
              {contract.contractNumber ?? "契約詳細"}
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_CONFIG[contract.status].color}`}>
                {STATUS_CONFIG[contract.status].label}
              </span>
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {contract.project.branch.company.name} — {contract.project.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/estimates/new?projectId=${contract.project.id}`}>
            <Button variant="outline" size="sm" className="text-xs gap-1 text-orange-700 border-orange-300 hover:bg-orange-50">
              <Plus className="w-3.5 h-3.5" />
              追加工事の見積を作成
            </Button>
          </Link>
          <Link href={`/projects/${contract.project.id}`}>
            <Button variant="outline" size="sm" className="text-xs gap-1">
              <MapPin className="w-3.5 h-3.5" />
              現場詳細
            </Button>
          </Link>
        </div>
      </div>

      {/* ── ステータス進捗バー ── */}
      <Card>
        <CardContent className="pt-6 pb-4">
          <div className="flex items-center gap-1">
            {STATUS_FLOW.map((s, i) => {
              const config = STATUS_CONFIG[s]
              const Icon = config.icon
              const isActive = contract.status === s
              const isPast = currentStatusIndex >= 0 && i < currentStatusIndex
              const isCancelled = contract.status === "CANCELLED"
              return (
                <div key={s} className="flex items-center flex-1">
                  <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all w-full justify-center ${
                    isCancelled ? "bg-slate-50 text-slate-300 border-slate-100" :
                    isActive ? config.color + " ring-2 ring-offset-1 ring-current/20" :
                    isPast ? "bg-slate-100 text-slate-500 border-slate-200" :
                    "bg-slate-50 text-slate-300 border-slate-100"
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
                  <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
                    contract.schedules.length === 0
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  }`}>
                    {contract.schedules.length === 0 ? (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-medium">工程が未登録です</span>
                        <span className="text-red-500">— 下の工程セクションで工程を作成してください</span>
                      </>
                    ) : (
                      <>
                        <CalendarCheck className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-medium">工程 {contract.schedules.length}件 登録済み</span>
                      </>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {nextStatus && gateBlock ? (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        disabled
                        className="text-xs gap-1 opacity-50"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        「{STATUS_CONFIG[nextStatus].label}」に進める
                      </Button>
                      <span className="text-xs text-red-600 flex items-center gap-1">
                        <Ban className="w-3 h-3 flex-shrink-0" />
                        {gateBlock}
                      </span>
                    </div>
                  ) : nextStatus ? (
                    <Button
                      size="sm"
                      onClick={() => handleStatusUpdate(nextStatus)}
                      disabled={statusUpdating}
                      className="text-xs gap-1"
                    >
                      {statusUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      「{STATUS_CONFIG[nextStatus].label}」に進める
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusUpdate("CANCELLED")}
                    disabled={statusUpdating}
                    className="text-xs text-red-600 border-red-200 hover:bg-red-50 gap-1 ml-auto"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    キャンセル
                  </Button>
                </div>
              </div>
            )
          })()}
        </CardContent>
      </Card>

      {/* ── 工程未登録警告 ── */}
      {contract.status === "CONTRACTED" && contract.schedules.length === 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
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
                    workType: s.workType as ScheduleWorkType,
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

      {/* ── 基本情報 ── */}
      <div className={isEmbedded ? "space-y-4" : "grid grid-cols-1 lg:grid-cols-2 gap-6"}>
        {/* 契約情報 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <HandshakeIcon className="w-4 h-4 text-blue-600" />
              契約基本情報
            </CardTitle>
          </CardHeader>
          <CardContent className={isEmbedded ? "space-y-1.5" : "space-y-3"}>
            <InfoRow label="契約番号" value={contract.contractNumber ?? "—"} mono compact={isEmbedded} />
            <InfoRow label="金額（税抜）" value={`¥${formatCurrency(contract.contractAmount)}`} mono compact={isEmbedded} />
            <InfoRow label="消費税" value={`¥${formatCurrency(contract.taxAmount)}`} mono compact={isEmbedded} />
            <InfoRow label="合計（税込）" value={`¥${formatCurrency(contract.totalAmount)}`} mono bold compact={isEmbedded} />
            <InfoRow label="契約日" value={formatDate(contract.contractDate, "yyyy年MM月dd日")} compact={isEmbedded} />
            <InfoRow
              label="工期"
              compact={isEmbedded}
              value={
                contract.startDate || contract.endDate
                  ? `${contract.startDate ? formatDate(contract.startDate, "yyyy/MM/dd") : "未定"} 〜 ${contract.endDate ? formatDate(contract.endDate, "yyyy/MM/dd") : "未定"}`
                  : "未設定"
              }
            />
            {contract.paymentTerms && <InfoRow label="支払条件" value={contract.paymentTerms} compact={isEmbedded} />}
            {contract.note && <InfoRow label="備考" value={contract.note} compact={isEmbedded} />}
            <InfoRow label="自社担当" value={contract.estimate.user.name} compact={isEmbedded} />
          </CardContent>
        </Card>

        {/* 顧客情報 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-600" />
              お客様（元請）情報
            </CardTitle>
          </CardHeader>
          <CardContent className={isEmbedded ? "space-y-1.5" : "space-y-3"}>
            <InfoRow label="会社名" value={contract.project.branch.company.name} compact={isEmbedded} />
            {contract.project.branch.name !== "本社" && (
              <InfoRow label="支店" value={contract.project.branch.name} compact={isEmbedded} />
            )}
            {contract.project.branch.company.phone && (
              <InfoRow label="電話番号" value={contract.project.branch.company.phone} icon={<Phone className="w-3 h-3" />} compact={isEmbedded} />
            )}
            <div className="border-t border-slate-100 pt-1.5 mt-1.5" />
            <InfoRow label="現場名" value={contract.project.name} compact={isEmbedded} />
            {contract.project.address && (
              <InfoRow label="現場住所" value={contract.project.address} icon={<MapPin className="w-3 h-3" />} compact={isEmbedded} />
            )}
            <div className="border-t border-slate-100 pt-1.5 mt-1.5" />
            {contract.project.contact ? (
              <>
                <InfoRow label="先方担当者" value={contract.project.contact.name} icon={<User className="w-3 h-3" />} compact={isEmbedded} />
                {contract.project.contact.phone && (
                  <InfoRow label="担当者電話" value={contract.project.contact.phone} compact={isEmbedded} />
                )}
                {contract.project.contact.email && (
                  <InfoRow label="担当者メール" value={contract.project.contact.email} compact={isEmbedded} />
                )}
              </>
            ) : (
              <p className="text-sm text-slate-400">先方担当者：未設定</p>
            )}
          </CardContent>
        </Card>
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

      {/* ── この商談の契約・見積一覧 ── */}
      {siblingContracts.length > 1 && (
        <SiblingContractsSection
          currentContractId={contract.id}
          siblings={siblingContracts}
          projectId={contract.project.id}
          onOpenEstimate={onOpenEstimate ?? openEstimate}
          compact={isEmbedded}
        />
      )}

      {/* ── 工事区分セクション ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-600" />
              工事区分
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1"
              onClick={() => setAddWorkOpen(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              工事区分を追加
            </Button>
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
        </CardHeader>
        <CardContent>
          {contract.works.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Wrench className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">工事区分がまだ登録されていません</p>
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
        </CardContent>
      </Card>

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
              <Label>工事区分</Label>
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
                  <Label>工事人数（人）</Label>
                  <Input
                    type="number"
                    min={1}
                    value={addWorkerCount}
                    onChange={(e) => setAddWorkerCount(e.target.value)}
                    placeholder="例: 3"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>工事日数（日）</Label>
                  <Input
                    type="number"
                    min={1}
                    value={addWorkDays}
                    onChange={(e) => setAddWorkDays(e.target.value)}
                    placeholder="例: 5"
                  />
                </div>
                {addWorkerCount && addWorkDays && (
                  <div className="col-span-2 text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                    工数: <strong>{parseInt(addWorkerCount) * parseInt(addWorkDays)} 人日</strong>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>外注先（下請け業者）</Label>
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
                  <Label>発注金額（税抜）</Label>
                  <Input
                    type="number"
                    min={0}
                    value={addOrderAmount}
                    onChange={(e) => setAddOrderAmount(e.target.value)}
                    placeholder="例: 500000"
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
              <Label>備考</Label>
              <Textarea
                value={addWorkNote}
                onChange={(e) => setAddWorkNote(e.target.value)}
                placeholder="任意のメモ"
                rows={2}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAddWorkOpen(false)} disabled={addingSaving}>
              キャンセル
            </Button>
            <Button onClick={handleAddWork} disabled={addingSaving}>
              {addingSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />保存中...</> : "追加する"}
            </Button>
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
        <span className="text-[10px] text-slate-400 flex items-center gap-0.5 shrink-0 w-[70px]">
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
      <span className="text-xs text-slate-400 flex items-center gap-1 flex-shrink-0 min-w-[100px]">
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
    <div className={`border rounded-lg p-4 ${isInhouse ? "border-blue-200 bg-blue-50/30" : "border-amber-200 bg-amber-50/30"}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 mb-3">
          {isInhouse ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
              <Users className="w-3 h-3" />
              自社工事
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              <Truck className="w-3 h-3" />
              外注工事
            </span>
          )}
          {!isInhouse && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ORDER_STATUS_STYLE[work.orderStatus]}`}>
              {ORDER_STATUS_LABEL[work.orderStatus]}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
          onClick={() => onDelete(work.id)}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {isInhouse ? (
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-slate-400">人数</p>
            <p className="font-medium">{work.workerCount ?? "—"} 人</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">日数</p>
            <p className="font-medium">{work.workDays ?? "—"} 日</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">工数</p>
            <p className="font-bold text-blue-700">{manDays} 人日</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {work.subcontractor && (
            <div>
              <p className="text-xs text-slate-400">外注先</p>
              <p className="text-sm font-medium">{work.subcontractor.name}</p>
              {work.subcontractor.representative && (
                <p className="text-xs text-slate-500">代表: {work.subcontractor.representative}</p>
              )}
            </div>
          )}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-400">発注金額（税抜）</p>
              <p className="font-mono font-medium">¥{formatCurrency(work.orderAmount ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">消費税</p>
              <p className="font-mono text-slate-600">¥{formatCurrency(work.orderTaxAmount ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">合計（税込）</p>
              <p className="font-mono font-bold text-amber-700">¥{formatCurrency(work.orderTotalAmount ?? 0)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-amber-200/50">
            {work.orderStatus === "NOT_ORDERED" && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1"
                onClick={() => onOrderStatusUpdate(work.id, "ORDERED")}
              >
                <Clock className="w-3 h-3" />
                発注済にする
              </Button>
            )}
            {work.orderStatus === "ORDERED" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50"
                  onClick={() => onOrderStatusUpdate(work.id, "COMPLETED")}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  完了にする
                </Button>
                <Link href={`/orders/${work.id}/print`} target="_blank">
                  <Button size="sm" variant="outline" className="text-xs gap-1">
                    <Printer className="w-3 h-3" />
                    発注書
                  </Button>
                </Link>
              </>
            )}
            {work.orderStatus === "COMPLETED" && work.orderedAt && (
              <span className="text-xs text-slate-400">
                発注日: {formatDate(work.orderedAt, "yyyy/MM/dd")}
              </span>
            )}
            {(work.orderStatus === "ORDERED" || work.orderStatus === "COMPLETED") && (
              <Link href={`/orders/${work.id}/print`} target="_blank" className="ml-auto">
                <Button size="sm" variant="ghost" className="text-xs gap-1 text-slate-500">
                  <Printer className="w-3 h-3" />
                  発注書印刷
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
      {work.note && (
        <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200/50">
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
        <td colSpan={5} className="px-3 py-1.5 text-xs font-semibold text-slate-600 border-b border-slate-100">
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
            <td className="px-3 py-1.5 text-sm text-right font-mono font-medium">¥{formatCurrency(amount)}</td>
          </tr>
        )
      })}
    </>
  )
}

// ─── 工期セクション ────────────────────────────────────

function ScheduleSection({ contractId, contractStatus, schedules, onRefresh, onStatusChange }: {
  contractId: string; contractStatus: ContractStatus; schedules: ScheduleData[]; onRefresh: () => void; onStatusChange: (s: ContractStatus) => void
}) {
  const router = useRouter()
  const today = new Date()
  const [saving, setSaving] = useState(false)

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

  const MINI_WT: Record<ScheduleWorkType, {
    label: string; short: string
    planned: string; actual: string; text: string; bg: string; border: string
  }> = {
    ASSEMBLY:    { label: "組立", short: "組", planned: "bg-blue-200/80", actual: "bg-blue-500", text: "text-blue-700", bg: "bg-blue-50", border: "border-blue-300" },
    DISASSEMBLY: { label: "解体", short: "解", planned: "bg-amber-200/80", actual: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-300" },
    REWORK:      { label: "その他", short: "他", planned: "bg-slate-300/80", actual: "bg-slate-500", text: "text-slate-700", bg: "bg-slate-100", border: "border-slate-400" },
  }
  const WORK_TYPES: ScheduleWorkType[] = ["ASSEMBLY", "DISASSEMBLY", "REWORK"]

  const displayDays = 30
  const [rangeStart, setRangeStart] = useState(() => {
    const allDates = schedules.flatMap((s) =>
      [s.plannedStartDate, s.plannedEndDate, s.actualStartDate, s.actualEndDate].filter(Boolean) as string[]
    )
    if (allDates.length > 0) {
      const earliest = allDates.reduce((a, b) => (a < b ? a : b))
      return subDays(parseISO(earliest), 3)
    }
    return subDays(today, 3)
  })
  const rangeEnd = addDays(rangeStart, displayDays - 1)
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd })

  type MiniDrawMode = "select" | ScheduleWorkType
  const [drawMode, setDrawMode] = useState<MiniDrawMode>("select")

  // Shift → 解体, Ctrl → 組立
  const [heldKey, setHeldKey] = useState<"shift" | "ctrl" | null>(null)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === "Shift") setHeldKey("shift")
      else if (e.key === "Control" || e.key === "Meta") setHeldKey("ctrl")
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === "Shift") setHeldKey((prev) => prev === "shift" ? null : prev)
      else if (e.key === "Control" || e.key === "Meta") setHeldKey((prev) => prev === "ctrl" ? null : prev)
    }
    function onBlur() { setHeldKey(null) }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("blur", onBlur)
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); window.removeEventListener("blur", onBlur) }
  }, [])
  const effectiveDrawMode: MiniDrawMode = heldKey === "shift" ? "DISASSEMBLY" : heldKey === "ctrl" ? "ASSEMBLY" : drawMode
  const dragDrawModeRef = useRef<ScheduleWorkType>("ASSEMBLY")

  // Navigation (with repeat on hold)
  const repeatRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; interval: ReturnType<typeof setInterval> | null }>({ timer: null, interval: null })
  const accelRef = useRef(1)
  const shiftDays = useCallback((n: number) => setRangeStart((prev) => addDays(prev, n)), [])
  const startRepeat = useCallback((n: number) => {
    accelRef.current = 1
    shiftDays(n)
    repeatRef.current.timer = setTimeout(() => {
      repeatRef.current.interval = setInterval(() => {
        accelRef.current = Math.min(accelRef.current + 0.3, 7)
        shiftDays(n > 0 ? Math.round(accelRef.current) : -Math.round(accelRef.current))
      }, 80)
    }, 400)
  }, [shiftDays])
  const stopRepeat = useCallback(() => {
    if (repeatRef.current.timer) { clearTimeout(repeatRef.current.timer); repeatRef.current.timer = null }
    if (repeatRef.current.interval) { clearInterval(repeatRef.current.interval); repeatRef.current.interval = null }
    accelRef.current = 1
  }, [])
  useEffect(() => () => stopRepeat(), [stopRepeat])

  // Drag to create
  const [dragInfo, setDragInfo] = useState<{ rowIdx: number; startDay: number; endDay: number } | null>(null)
  const isDragging = useRef(false)

  // Move by long-press
  const [moveState, setMoveState] = useState<{
    schedule: ScheduleData; span: number; moveStartDay: number; grabOffset: number; barAreaRect: DOMRect
  } | null>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Resize from edges
  const [resizeState, setResizeState] = useState<{
    schedule: ScheduleData; edge: "left" | "right"; startDay: number; endDay: number; barAreaRect: DOMRect
  } | null>(null)
  const resizeStateRef = useRef(resizeState)
  const resizeDaysRef = useRef({ startDay: 0, endDay: 0 })
  resizeStateRef.current = resizeState
  if (resizeState) { resizeDaysRef.current.startDay = resizeState.startDay; resizeDaysRef.current.endDay = resizeState.endDay }

  // Edit popover
  const [editSchedule, setEditSchedule] = useState<ScheduleData | null>(null)
  const [editPlannedStart, setEditPlannedStart] = useState("")
  const [editPlannedEnd, setEditPlannedEnd] = useState("")
  const [editActualStart, setEditActualStart] = useState("")
  const [editActualEnd, setEditActualEnd] = useState("")
  const [editWorkers, setEditWorkers] = useState("")
  const [editNotes, setEditNotes] = useState("")

  const getBarPos = useCallback((startStr: string | null, endStr: string | null) => {
    if (!startStr) return null
    const start = parseISO(startStr)
    const end = endStr ? parseISO(endStr) : start
    const barStart = isBefore(start, rangeStart) ? rangeStart : start
    const barEnd = isAfter(end, rangeEnd) ? rangeEnd : end
    if (isAfter(barStart, rangeEnd) || isBefore(barEnd, rangeStart)) return null
    const startIdx = differenceInDays(barStart, rangeStart)
    const span = differenceInDays(barEnd, barStart) + 1
    return { left: `${(startIdx / displayDays) * 100}%`, width: `${(Math.max(span, 1) / displayDays) * 100}%` }
  }, [rangeStart, rangeEnd, displayDays])

  function dayIdxToStr(idx: number) {
    return format(addDays(rangeStart, Math.max(0, Math.min(idx, displayDays - 1))), "yyyy-MM-dd")
  }

  // Rows: each schedule gets its own row, plus one empty row at the bottom for creation
  const rows = useMemo(() => {
    const sorted = [...schedules].sort((a, b) => {
      const order = { ASSEMBLY: 0, DISASSEMBLY: 1, REWORK: 2 }
      return (order[a.workType] - order[b.workType]) || ((a.plannedStartDate ?? "") > (b.plannedStartDate ?? "") ? 1 : -1)
    })
    return sorted
  }, [schedules])

  // Drag to create
  function handleMouseDown(rowIdx: number, dayIdx: number) {
    if (effectiveDrawMode === "select") return
    isDragging.current = true
    dragDrawModeRef.current = effectiveDrawMode as ScheduleWorkType
    setDragInfo({ rowIdx, startDay: dayIdx, endDay: dayIdx })
    setEditSchedule(null)
  }
  function handleMouseMove(dayIdx: number) {
    if (!isDragging.current || !dragInfo) return
    setDragInfo((prev) => prev ? { ...prev, endDay: dayIdx } : null)
  }
  function handleMouseUp() {
    if (!isDragging.current || !dragInfo) { isDragging.current = false; setDragInfo(null); return }
    isDragging.current = false
    const startDay = Math.min(dragInfo.startDay, dragInfo.endDay)
    const endDay = Math.max(dragInfo.startDay, dragInfo.endDay)
    createSchedule(dragDrawModeRef.current, dayIdxToStr(startDay), dayIdxToStr(endDay))
    setDragInfo(null)
  }

  async function createSchedule(workType: ScheduleWorkType, startDate: string, endDate: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/contracts/${contractId}/schedules`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workType, plannedStartDate: startDate, plannedEndDate: endDate }),
      })
      if (!res.ok) throw new Error()
      toast.success(`${MINI_WT[workType].label}を追加しました`)
      onRefresh(); router.refresh()
    } catch { toast.error("追加に失敗しました") }
    finally { setSaving(false) }
  }

  // Bar long-press -> move
  function handleBarMouseDown(schedule: ScheduleData, e: React.MouseEvent) {
    e.stopPropagation()
    if (effectiveDrawMode !== "select" || !schedule.plannedStartDate) return
    const barArea = (e.currentTarget as HTMLElement).closest("[data-mini-bar-area]") as HTMLElement | null
    if (!barArea) return
    const rect = barArea.getBoundingClientRect()
    const span = schedule.plannedEndDate ? differenceInDays(parseISO(schedule.plannedEndDate), parseISO(schedule.plannedStartDate)) + 1 : 1
    const clickDayIdx = Math.floor(((e.clientX - rect.left) / rect.width) * displayDays)
    const barStartIdx = Math.max(0, differenceInDays(parseISO(schedule.plannedStartDate), rangeStart))
    const grabOffset = Math.max(0, Math.min(clickDayIdx - barStartIdx, span - 1))
    const startIdx = Math.max(0, Math.min(clickDayIdx - grabOffset, displayDays - span))
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null
      setEditSchedule(null)
      setMoveState({ schedule, span, moveStartDay: startIdx, grabOffset, barAreaRect: rect })
    }, 400)
  }
  function handleBarMouseUp(schedule: ScheduleData, e: React.MouseEvent) {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null
      handleBarClick(schedule, e)
    }
  }

  // Edge resize
  function handleBarEdgeMouseDown(schedule: ScheduleData, edge: "left" | "right", e: React.MouseEvent) {
    e.stopPropagation(); e.preventDefault()
    if (effectiveDrawMode !== "select" || !schedule.plannedStartDate) return
    const barArea = (e.currentTarget as HTMLElement).closest("[data-mini-bar-area]") as HTMLElement | null
    if (!barArea) return
    const rect = barArea.getBoundingClientRect()
    const startDay = Math.max(0, differenceInDays(parseISO(schedule.plannedStartDate), rangeStart))
    const endDay = schedule.plannedEndDate ? Math.min(displayDays - 1, differenceInDays(parseISO(schedule.plannedEndDate), rangeStart)) : startDay
    longPressTimerRef.current && clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null
    setResizeState({ schedule, edge, startDay, endDay, barAreaRect: rect })
  }

  async function saveScheduleDates(scheduleId: string, newStart: string, newEnd: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plannedStartDate: newStart, plannedEndDate: newEnd }),
      })
      if (!res.ok) throw new Error()
      toast.success("日付を更新しました")
      setResizeState(null); setMoveState(null)
      onRefresh(); router.refresh()
    } catch { toast.error("更新に失敗しました") }
    finally { setSaving(false) }
  }

  // Resize document events
  useEffect(() => {
    if (!resizeState) return
    function onMouseMove(e: MouseEvent) {
      const r = resizeStateRef.current; if (!r) return
      const rect = r.barAreaRect
      const dayIdx = Math.max(0, Math.min(displayDays - 1, Math.floor(((e.clientX - rect.left) / rect.width) * displayDays)))
      if (r.edge === "left") {
        resizeDaysRef.current.startDay = Math.min(dayIdx, resizeDaysRef.current.endDay)
        setResizeState((prev) => prev ? { ...prev, startDay: resizeDaysRef.current.startDay } : null)
      } else {
        resizeDaysRef.current.endDay = Math.max(dayIdx, resizeDaysRef.current.startDay)
        setResizeState((prev) => prev ? { ...prev, endDay: resizeDaysRef.current.endDay } : null)
      }
    }
    function onMouseUp() {
      const r = resizeStateRef.current; const { startDay, endDay } = resizeDaysRef.current
      if (r) saveScheduleDates(r.schedule.id, dayIdxToStr(startDay), dayIdxToStr(endDay))
    }
    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
    return () => { document.removeEventListener("mousemove", onMouseMove); document.removeEventListener("mouseup", onMouseUp) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!resizeState])

  // Move document events
  const moveStateRef = useRef(moveState)
  const moveStartDayRef = useRef(0)
  moveStateRef.current = moveState
  if (moveState) moveStartDayRef.current = moveState.moveStartDay

  useEffect(() => {
    if (!moveState) return
    function onMouseMove(e: MouseEvent) {
      const m = moveStateRef.current; if (!m) return
      const rect = m.barAreaRect
      const dayIdx = Math.floor(((e.clientX - rect.left) / rect.width) * displayDays)
      const startIdx = Math.max(0, Math.min(dayIdx - m.grabOffset, displayDays - m.span))
      moveStartDayRef.current = startIdx
      setMoveState((prev) => prev ? { ...prev, moveStartDay: startIdx } : null)
    }
    function onMouseUp() {
      const m = moveStateRef.current; const startDay = moveStartDayRef.current
      if (m) saveScheduleDates(m.schedule.id, dayIdxToStr(startDay), dayIdxToStr(startDay + m.span - 1))
    }
    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
    return () => { document.removeEventListener("mousemove", onMouseMove); document.removeEventListener("mouseup", onMouseUp) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!moveState])

  // Click to edit popover
  function handleBarClick(schedule: ScheduleData, e: React.MouseEvent) {
    e.stopPropagation()
    if (effectiveDrawMode !== "select") return
    setEditSchedule(schedule)
    setEditPlannedStart(schedule.plannedStartDate?.slice(0, 10) ?? "")
    setEditPlannedEnd(schedule.plannedEndDate?.slice(0, 10) ?? "")
    setEditActualStart(schedule.actualStartDate?.slice(0, 10) ?? "")
    setEditActualEnd(schedule.actualEndDate?.slice(0, 10) ?? "")
    setEditWorkers(schedule.workersCount?.toString() ?? "")
    setEditNotes(schedule.notes ?? "")
  }

  async function handleUpdate() {
    if (!editSchedule) return
    setSaving(true)
    try {
      const res = await fetch(`/api/schedules/${editSchedule.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plannedStartDate: editPlannedStart || null, plannedEndDate: editPlannedEnd || null,
          actualStartDate: editActualStart || null, actualEndDate: editActualEnd || null,
          workersCount: editWorkers ? parseInt(editWorkers) : null, notes: editNotes.trim() || null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success("更新しました"); setEditSchedule(null); onRefresh(); router.refresh()
    } catch { toast.error("更新に失敗しました") }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!editSchedule || !confirm("この工程を削除しますか？")) return
    const res = await fetch(`/api/schedules/${editSchedule.id}`, { method: "DELETE" })
    if (res.ok) { toast.success("削除しました"); setEditSchedule(null); onRefresh(); router.refresh() }
    else toast.error("削除に失敗しました")
  }

  const cellWidthPct = 100 / displayDays

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-blue-600" />
            工期（ガントチャート）
          </CardTitle>
          <Link href={`/schedules?contractId=${contractId}`}>
            <Button size="sm" variant="outline" className="text-xs gap-1 h-7">
              <ExternalLink className="w-3 h-3" />
              全体表示
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* ロック状態バナー */}
        {isLocked && (
          <div className={`flex items-center gap-2 mb-2 px-3 py-2 rounded-lg text-xs border ${
            canUnconfirm
              ? "bg-cyan-50 text-cyan-800 border-cyan-200"
              : "bg-slate-50 text-slate-500 border-slate-200"
          }`}>
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span className="font-medium">工程確定済み</span>
            <span className="text-[10px] opacity-70">— 編集するには確定を解除してください</span>
            {canUnconfirm && (
              <Button
                size="sm"
                variant="outline"
                className="ml-auto text-[10px] h-6 px-2 text-cyan-700 border-cyan-300 hover:bg-cyan-100"
                onClick={handleUnconfirmSchedule}
                disabled={saving}
              >
                確定解除
              </Button>
            )}
          </div>
        )}

        {/* ミニツールバー */}
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          {!isLocked && (
            <>
              <span className="text-[10px] text-slate-400 mr-0.5">モード:</span>
              <Button size="sm" variant={effectiveDrawMode === "select" ? "default" : "outline"} onClick={() => setDrawMode("select")} className="text-[10px] h-6 px-2 gap-1">選択</Button>
              {WORK_TYPES.map((wt) => {
                const cfg = MINI_WT[wt]
                const isActive = effectiveDrawMode === wt
                const shortcutLabel = wt === "ASSEMBLY" ? "Ctrl" : wt === "DISASSEMBLY" ? "Shift" : null
                return (
                  <Button key={wt} size="sm" variant={isActive ? "default" : "outline"} onClick={() => setDrawMode(drawMode === wt ? "select" : wt)}
                    className={`text-[10px] h-6 px-2 gap-1 ${isActive ? "" : `${cfg.text} border-current`}`}
                  >
                    <span className={`inline-block w-2.5 h-2.5 rounded-sm ${isActive ? "bg-white/80" : cfg.actual}`} />{cfg.label}
                    {shortcutLabel && <span className={`text-[8px] ml-0.5 ${isActive ? "text-white/70" : "text-slate-400"}`}>{shortcutLabel}</span>}
                  </Button>
                )
              })}
              <div className="w-px h-4 bg-slate-200" />
            </>
          )}
          <div className="flex items-center gap-0.5">
            <Button variant="outline" size="sm" className="h-6 w-6 p-0" onMouseDown={() => startRepeat(-7)} onMouseUp={stopRepeat} onMouseLeave={stopRepeat}>
              <ChevronsLeft className="w-3 h-3" />
            </Button>
            <Button variant="outline" size="sm" className="h-6 w-6 p-0" onMouseDown={() => startRepeat(-1)} onMouseUp={stopRepeat} onMouseLeave={stopRepeat}>
              <ChevronLeft className="w-3 h-3" />
            </Button>
            <Button variant="outline" size="sm" className="h-6 w-6 p-0" onMouseDown={() => startRepeat(1)} onMouseUp={stopRepeat} onMouseLeave={stopRepeat}>
              <ChevronRight className="w-3 h-3" />
            </Button>
            <Button variant="outline" size="sm" className="h-6 w-6 p-0" onMouseDown={() => startRepeat(7)} onMouseUp={stopRepeat} onMouseLeave={stopRepeat}>
              <ChevronsRight className="w-3 h-3" />
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="text-[10px] h-6 px-1.5" onClick={() => setRangeStart(subDays(today, 3))}>今日</Button>
          <span className="text-[10px] text-slate-400 ml-auto">{format(rangeStart, "M/d")} 〜 {format(rangeEnd, "M/d")}（{displayDays}日）</span>
        </div>

        {/* ミニGanttチャート本体 */}
        <div className={`bg-white border rounded-lg overflow-hidden select-none ${!isLocked && effectiveDrawMode !== "select" ? "cursor-crosshair" : ""} ${isLocked ? "opacity-90" : ""}`}
          onMouseUp={isLocked ? undefined : handleMouseUp} onMouseLeave={isLocked ? undefined : handleMouseUp}
        >
          {/* 日付ヘッダー */}
          <div className="flex border-b border-slate-200">
            <div className="w-[110px] flex-shrink-0 bg-slate-50 border-r border-slate-200 px-2 py-0.5 text-[9px] font-medium text-slate-400 flex items-end">工種</div>
            <div className="flex-1 flex">
              {days.map((day, i) => {
                const isTd = isToday(day)
                const isWe = isWeekend(day)
                const d = getDate(day)
                const isFirst = d === 1
                const monthLabel = isFirst ? format(day, "M月", { locale: ja }) : null
                return (
                  <div key={i} style={{ width: `${cellWidthPct}%` }}
                    className={`flex-shrink-0 text-center py-0.5 text-[9px] leading-tight border-r border-slate-100 last:border-r-0 ${
                      isTd ? "bg-blue-100 font-bold text-blue-700" : isWe ? "bg-red-50/50 text-red-400" : "text-slate-400"
                    } ${isFirst ? "border-l-2 border-l-slate-300" : ""}`}
                  >
                    {monthLabel && <div className="text-[7px] font-bold text-slate-600 -mb-0.5">{monthLabel}</div>}
                    <div className="font-medium">{d}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 工程行 */}
          {rows.length === 0 && effectiveDrawMode === "select" ? (
            <div className="text-center py-6 text-slate-400">
              <CalendarDays className="w-6 h-6 mx-auto mb-1 opacity-30" />
              <p className="text-xs">工程がまだ登録されていません</p>
              <p className="text-[10px] text-slate-300 mt-0.5">上のモード切替で工種を選択し、ドラッグで作成</p>
            </div>
          ) : (
            <>
              {rows.map((schedule, rowIdx) => {
                const cfg = MINI_WT[schedule.workType]
                const plannedPos = getBarPos(schedule.plannedStartDate, schedule.plannedEndDate)
                const actualPos = getBarPos(schedule.actualStartDate, schedule.actualEndDate)
                const isMoving = moveState?.schedule.id === schedule.id
                const isResizing = resizeState?.schedule.id === schedule.id

                const allDates = [schedule.plannedStartDate, schedule.plannedEndDate, schedule.actualStartDate, schedule.actualEndDate].filter(Boolean) as string[]
                const rowEarliest = allDates.length > 0 ? allDates.reduce((a, b) => (a < b ? a : b)) : null
                const rowLatest = allDates.length > 0 ? allDates.reduce((a, b) => (a > b ? a : b)) : null
                const rowInRange = rowEarliest && rowLatest
                  ? !isAfter(parseISO(rowEarliest), rangeEnd) && !isBefore(parseISO(rowLatest), rangeStart)
                  : false

                return (
                  <div key={schedule.id} className="flex border-b border-slate-100 last:border-b-0">
                    {/* 工種ラベル + 日付情報 */}
                    <div className={`w-[110px] flex-shrink-0 px-2 py-1 border-r border-slate-200 ${cfg.bg}`}>
                      <div className="flex items-center gap-1">
                        <span className={`inline-block w-2 h-2 rounded-sm ${cfg.actual}`} />
                        <span className={`text-[10px] font-medium ${cfg.text} truncate`}>{cfg.label}</span>
                      </div>
                      {rowEarliest && rowLatest && (
                        <p className="text-[8px] text-slate-500 mt-0.5 leading-tight">
                          {format(parseISO(rowEarliest), "M/d")}〜{format(parseISO(rowLatest), "M/d")}
                          {!rowInRange && (
                            <button
                              className="text-amber-600 ml-0.5 hover:underline hover:text-amber-800 text-[8px]"
                              onClick={(e) => { e.stopPropagation(); setRangeStart(subDays(parseISO(rowEarliest), 3)) }}
                            >
                              →表示
                            </button>
                          )}
                        </p>
                      )}
                    </div>
                    {/* バー領域 */}
                    <div data-mini-bar-area className="flex-1 relative" style={{ height: 44 }}
                      onMouseDown={isLocked ? undefined : (e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        handleMouseDown(rowIdx, Math.floor(((e.clientX - rect.left) / rect.width) * displayDays))
                      }}
                      onMouseMove={isLocked ? undefined : (e) => {
                        if (!isDragging.current) return
                        const rect = e.currentTarget.getBoundingClientRect()
                        handleMouseMove(Math.floor(((e.clientX - rect.left) / rect.width) * displayDays))
                      }}
                    >
                      {/* Today line */}
                      {(() => {
                        const todayIdx = differenceInDays(today, rangeStart)
                        if (todayIdx < 0 || todayIdx >= displayDays) return null
                        return <div className="absolute top-0 bottom-0 w-px bg-red-400/60 z-10 pointer-events-none" style={{ left: `${((todayIdx + 0.5) / displayDays) * 100}%` }} />
                      })()}
                      {/* Weekend bg */}
                      {days.map((day, i) => isWeekend(day) ? (
                        <div key={`wbg-${i}`} className="absolute top-0 bottom-0 bg-red-50/20 pointer-events-none" style={{ left: `${(i / displayDays) * 100}%`, width: `${cellWidthPct}%` }} />
                      ) : null)}
                      {/* Month boundaries */}
                      {days.map((day, i) => getDate(day) === 1 && i > 0 ? (
                        <div key={`ml-${i}`} className="absolute top-0 bottom-0 w-px bg-slate-300/60 pointer-events-none" style={{ left: `${(i / displayDays) * 100}%` }} />
                      ) : null)}

                      {/* Planned bar */}
                      {plannedPos && !isMoving && !isResizing && (
                        <div className={`absolute rounded ${cfg.planned} border ${cfg.border} z-[5] ${
                          isLocked ? "cursor-default" : effectiveDrawMode === "select" ? "cursor-grab hover:shadow-md hover:brightness-95 active:cursor-grabbing" : "pointer-events-none"
                        }`}
                          style={{ ...plannedPos, top: 4, height: 20 }}
                          onMouseDown={isLocked ? undefined : (e) => handleBarMouseDown(schedule, e)}
                          onMouseUp={isLocked ? undefined : (e) => handleBarMouseUp(schedule, e)}
                        >
                          {!isLocked && effectiveDrawMode === "select" && (
                            <>
                              <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize z-10 rounded-l hover:bg-white/30"
                                onMouseDown={(e) => handleBarEdgeMouseDown(schedule, "left", e)} />
                              <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize z-10 rounded-r hover:bg-white/30"
                                onMouseDown={(e) => handleBarEdgeMouseDown(schedule, "right", e)} />
                            </>
                          )}
                          <div className="flex items-center h-full px-1 overflow-hidden">
                            <span className={`text-[9px] font-bold ${cfg.text} whitespace-nowrap`}>{cfg.short}</span>
                            {schedule.plannedStartDate && (
                              <span className="text-[7px] text-slate-500 ml-0.5 whitespace-nowrap">
                                {format(parseISO(schedule.plannedStartDate), "M/d")}
                                {schedule.plannedEndDate && `–${format(parseISO(schedule.plannedEndDate), "M/d")}`}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {/* Move ghost */}
                      {isMoving && moveState && (
                        <div className={`absolute rounded ${cfg.planned} border-2 border-blue-500 shadow-lg z-[15] cursor-grabbing opacity-95`}
                          style={{ left: `${(moveState.moveStartDay / displayDays) * 100}%`, width: `${(moveState.span / displayDays) * 100}%`, top: 4, height: 20 }}
                        >
                          <div className="flex items-center h-full px-1 overflow-hidden">
                            <span className={`text-[9px] font-bold ${cfg.text}`}>{cfg.short}</span>
                            <span className="text-[7px] text-slate-500 ml-0.5 whitespace-nowrap">
                              {format(addDays(rangeStart, moveState.moveStartDay), "M/d")}–{format(addDays(rangeStart, moveState.moveStartDay + moveState.span - 1), "M/d")}
                            </span>
                          </div>
                        </div>
                      )}
                      {/* Resize ghost */}
                      {isResizing && resizeState && (
                        <div className={`absolute rounded ${cfg.planned} border-2 border-amber-500 shadow-lg z-[15] opacity-95`}
                          style={{ left: `${(resizeState.startDay / displayDays) * 100}%`, width: `${((resizeState.endDay - resizeState.startDay + 1) / displayDays) * 100}%`, top: 4, height: 20 }}
                        >
                          <div className="flex items-center h-full px-1 overflow-hidden">
                            <span className={`text-[9px] font-bold ${cfg.text}`}>{cfg.short}</span>
                            <span className="text-[7px] text-slate-500 ml-0.5 whitespace-nowrap">
                              {format(addDays(rangeStart, resizeState.startDay), "M/d")}–{format(addDays(rangeStart, resizeState.endDay), "M/d")}
                            </span>
                          </div>
                        </div>
                      )}
                      {/* Actual bar */}
                      {actualPos && !isMoving && !isResizing && (
                        <div className={`absolute rounded ${cfg.actual} z-[6] ${
                          isLocked ? "cursor-default" : effectiveDrawMode === "select" ? "cursor-pointer hover:brightness-110" : "pointer-events-none"
                        }`}
                          style={{ ...actualPos, top: 26, height: 12 }}
                          onClick={isLocked ? undefined : (e) => handleBarClick(schedule, e)}
                        >
                          <div className="flex items-center h-full px-1 overflow-hidden">
                            <span className="text-[7px] text-white font-medium whitespace-nowrap">実績</span>
                          </div>
                        </div>
                      )}
                      {/* Out-of-range indicator */}
                      {!plannedPos && !actualPos && (() => {
                        const refDate = schedule.plannedStartDate ?? schedule.actualStartDate
                        const isAfterRange = refDate ? isAfter(parseISO(refDate), rangeEnd) : false
                        const dateLabel = refDate ? format(parseISO(refDate), "M/d") : ""
                        return (
                          <div
                            className="absolute z-[5] flex items-center cursor-pointer hover:opacity-80"
                            style={{ top: 4, height: 20, ...(isAfterRange ? { right: 4 } : { left: 4 }) }}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (refDate) setRangeStart(subDays(parseISO(refDate), 3))
                              else if (!isLocked) handleBarClick(schedule, e)
                            }}
                          >
                            <span className={`text-[8px] ${cfg.text} px-1 py-0.5 rounded ${cfg.bg} border ${cfg.border} flex items-center gap-0.5`}>
                              {!isAfterRange && <span>◀</span>}
                              {cfg.label} {dateLabel && `${dateLabel}〜`}
                              {isAfterRange && <span>▶</span>}
                            </span>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                )
              })}

              {/* 新規追加行（ドラッグ作成用） */}
              {!isLocked && effectiveDrawMode !== "select" && (
                <div className="flex border-b border-slate-100">
                  <div className="w-[110px] flex-shrink-0 px-2 py-1 border-r border-slate-200 flex items-center">
                    <span className="text-[9px] text-slate-300">＋新規</span>
                  </div>
                  <div data-mini-bar-area className="flex-1 relative" style={{ height: 36 }}
                    onMouseDown={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      handleMouseDown(rows.length, Math.floor(((e.clientX - rect.left) / rect.width) * displayDays))
                    }}
                    onMouseMove={(e) => {
                      if (!isDragging.current) return
                      const rect = e.currentTarget.getBoundingClientRect()
                      handleMouseMove(Math.floor(((e.clientX - rect.left) / rect.width) * displayDays))
                    }}
                  >
                    {(() => {
                      const todayIdx = differenceInDays(today, rangeStart)
                      if (todayIdx < 0 || todayIdx >= displayDays) return null
                      return <div className="absolute top-0 bottom-0 w-px bg-red-400/60 z-10 pointer-events-none" style={{ left: `${((todayIdx + 0.5) / displayDays) * 100}%` }} />
                    })()}
                    {/* Drag preview on create row */}
                    {dragInfo && dragInfo.rowIdx >= rows.length && (() => {
                      const s = Math.min(dragInfo.startDay, dragInfo.endDay)
                      const e = Math.max(dragInfo.startDay, dragInfo.endDay)
                      const wt = isDragging.current ? dragDrawModeRef.current : effectiveDrawMode as ScheduleWorkType
                      return (
                        <div className={`absolute rounded ${MINI_WT[wt].actual} opacity-40 z-[15] pointer-events-none`}
                          style={{ left: `${(s / displayDays) * 100}%`, width: `${((e - s + 1) / displayDays) * 100}%`, top: 4, height: 20 }}
                        >
                          <div className="flex items-center h-full px-1">
                            <span className="text-[9px] text-white font-bold">{MINI_WT[wt].label}</span>
                          </div>
                        </div>
                      )
                    })()}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-[9px] text-slate-300">ドラッグして{MINI_WT[effectiveDrawMode as ScheduleWorkType].label}を追加</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 凡例 + 確定ボタン */}
        <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
          {WORK_TYPES.map((wt) => (
            <div key={wt} className="flex items-center gap-1">
              <span className={`inline-block w-3 h-2 rounded-sm ${MINI_WT[wt].planned} border ${MINI_WT[wt].border}`} />
              <span>予定</span>
              <span className={`inline-block w-3 h-2 rounded-sm ${MINI_WT[wt].actual}`} />
              <span>{MINI_WT[wt].label}</span>
            </div>
          ))}
          <span className="ml-auto mr-2">{rows.length}件</span>
          {canConfirm && (
            <Button
              size="sm"
              className="text-[10px] h-6 px-3 bg-cyan-600 hover:bg-cyan-700 text-white gap-1"
              onClick={handleConfirmSchedule}
              disabled={saving}
            >
              <CheckCircle2 className="w-3 h-3" />
              工程を確定する
            </Button>
          )}
        </div>
      </CardContent>

      {/* 編集ポップオーバー */}
      {editSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setEditSchedule(null)}>
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-[340px] p-3.5 space-y-2.5 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`inline-block w-3 h-3 rounded-sm ${MINI_WT[editSchedule.workType].actual}`} />
                <span className="text-sm font-bold text-slate-800">{MINI_WT[editSchedule.workType].label}</span>
              </div>
              <button onClick={() => setEditSchedule(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">予定期間</Label>
              <div className="flex items-center gap-1.5">
                <Input type="date" value={editPlannedStart} onChange={(e) => setEditPlannedStart(e.target.value)} className="h-7 text-xs" />
                <span className="text-xs text-slate-400">〜</span>
                <Input type="date" value={editPlannedEnd} onChange={(e) => setEditPlannedEnd(e.target.value)} className="h-7 text-xs" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">実績期間</Label>
              <div className="flex items-center gap-1.5">
                <Input type="date" value={editActualStart} onChange={(e) => setEditActualStart(e.target.value)} className="h-7 text-xs" />
                <span className="text-xs text-slate-400">〜</span>
                <Input type="date" value={editActualEnd} onChange={(e) => setEditActualEnd(e.target.value)} className="h-7 text-xs" />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="space-y-1 flex-1">
                <Label className="text-xs text-slate-500 flex items-center gap-1"><Users className="w-3 h-3" />人数</Label>
                <Input type="number" min={1} value={editWorkers} onChange={(e) => setEditWorkers(e.target.value)} className="h-7 text-xs" placeholder="—" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">備考</Label>
              <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} className="text-xs" placeholder="メモ" />
            </div>
            <div className="flex items-center justify-between pt-1">
              <Button variant="ghost" size="sm" className="text-xs text-red-600 hover:bg-red-50 gap-1 h-7" onClick={handleDelete}>
                <Trash2 className="w-3 h-3" />削除
              </Button>
              <Button size="sm" className="text-xs h-7" onClick={handleUpdate} disabled={saving}>
                {saving ? "保存中..." : "更新"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}


// ─── この商談の契約・見積一覧セクション ────────────────────

const ESTIMATE_TYPE_LABEL: Record<EstimateType, string> = {
  INITIAL: "当初", ADDITIONAL: "追加",
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

function SiblingContractsSection({ currentContractId, siblings, projectId, onOpenEstimate, compact }: {
  currentContractId: string
  siblings: SiblingContract[]
  projectId: string
  onOpenEstimate?: (id: string) => void
  compact?: boolean
}) {
  const totalAmount = siblings.reduce((s, c) => s + c.totalAmount, 0)

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-orange-600" />
              契約・見積一覧
              <span className="text-[10px] text-slate-400 font-normal">（{siblings.length}件）</span>
            </CardTitle>
            <Link href={`/estimates/new?projectId=${projectId}`}>
              <Button variant="outline" size="sm" className="text-[10px] h-6 px-2 gap-0.5 text-orange-700 border-orange-300 hover:bg-orange-50">
                <Plus className="w-3 h-3" />追加
              </Button>
            </Link>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            合計: <strong className="text-slate-700 font-mono">¥{formatCurrency(totalAmount)}</strong>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="border rounded-lg overflow-hidden divide-y divide-slate-100">
            {siblings.map((sc, i) => {
              const isCurrent = sc.id === currentContractId
              const cConfig = STATUS_CONFIG[sc.status]
              return (
                <div
                  key={sc.id}
                  className={`px-2.5 py-2 transition-colors ${
                    isCurrent ? "bg-blue-50/50 border-l-2 border-l-blue-500" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {onOpenEstimate ? (
                      <button
                        onClick={() => onOpenEstimate(sc.estimate.id)}
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 cursor-pointer transition-all hover:ring-2 hover:ring-offset-1 ${
                          i === 0
                            ? "bg-blue-100 text-blue-700 hover:bg-blue-200 hover:ring-blue-300"
                            : "bg-orange-100 text-orange-700 hover:bg-orange-200 hover:ring-orange-300"
                        }`}
                      >
                        {i === 0 ? "本工事" : `追加${i}`}
                      </button>
                    ) : (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                        i === 0 ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                      }`}>
                        {i === 0 ? "本工事" : `追加${i}`}
                      </span>
                    )}
                    <span className={`text-xs font-medium truncate ${isCurrent ? "text-slate-800" : "text-slate-700"}`}>
                      {sc.estimate.title || sc.estimate.estimateNumber || "見積"}
                    </span>
                    {isCurrent && <span className="text-[9px] text-blue-600 shrink-0">表示中</span>}
                    <span className="ml-auto text-xs font-mono font-medium text-slate-700 shrink-0">
                      ¥{formatCurrency(sc.totalAmount)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 ml-[52px]">
                    <span className={`inline-flex items-center px-1 py-0.5 rounded-full text-[9px] font-medium border ${cConfig.color}`}>
                      {cConfig.label}
                    </span>
                    <span className={`inline-flex items-center px-1 py-0.5 rounded-full text-[9px] font-medium ${ESTIMATE_STATUS_STYLE[sc.estimate.status]}`}>
                      {ESTIMATE_STATUS_LABEL[sc.estimate.status]}
                    </span>
                    {sc.contractNumber && (
                      <span className="text-[9px] text-slate-400 font-mono ml-auto">{sc.contractNumber}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Layers className="w-4 h-4 text-orange-600" />
            この商談の契約・見積一覧
            <span className="text-xs text-slate-400 font-normal">（{siblings.length}件）</span>
          </CardTitle>
          <Link href={`/estimates/new?projectId=${projectId}`}>
            <Button variant="outline" size="sm" className="text-xs gap-1 text-orange-700 border-orange-300 hover:bg-orange-50">
              <Plus className="w-3.5 h-3.5" />追加工事の見積を作成
            </Button>
          </Link>
        </div>
        <div className="flex gap-4 mt-2 text-xs text-slate-500">
          <span>合計金額: <strong className="text-slate-700">¥{formatCurrency(totalAmount)}</strong></span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[0.5fr_2fr_1fr_0.8fr_1fr_0.8fr] gap-x-3 px-3 py-2 bg-slate-50 border-b text-[10px] font-medium text-slate-400">
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
            return (
              <div
                key={sc.id}
                className={`grid grid-cols-[0.5fr_2fr_1fr_0.8fr_1fr_0.8fr] gap-x-3 px-3 py-2.5 items-center transition-colors ${
                  isCurrent ? "bg-blue-50/50 border-l-2 border-l-blue-500" : "hover:bg-slate-50"
                } ${i < siblings.length - 1 ? "border-b border-slate-100" : ""}`}
              >
                <div>
                  {onOpenEstimate ? (
                    <button
                      onClick={() => onOpenEstimate(sc.estimate.id)}
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-all hover:ring-2 hover:ring-offset-1 ${
                        i === 0
                          ? "bg-blue-100 text-blue-700 hover:bg-blue-200 hover:ring-blue-300"
                          : "bg-orange-100 text-orange-700 hover:bg-orange-200 hover:ring-orange-300"
                      }`}
                    >
                      {i === 0 ? "本工事" : `追加${i}`}
                    </button>
                  ) : (
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      i === 0 ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                    }`}>
                      {i === 0 ? "本工事" : `追加${i}`}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <span className={`text-sm font-medium truncate block ${isCurrent ? "text-slate-800" : "text-slate-700"}`}>
                    {sc.estimate.title || sc.estimate.estimateNumber || "見積"}
                    {isCurrent && <span className="ml-1.5 text-[10px] text-blue-600">(表示中)</span>}
                  </span>
                  {sc.contractNumber && (
                    <span className="text-[10px] text-slate-400 font-mono">{sc.contractNumber}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${ESTIMATE_STATUS_STYLE[sc.estimate.status]}`}>
                    {ESTIMATE_STATUS_LABEL[sc.estimate.status]}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {ESTIMATE_TYPE_LABEL[sc.estimate.estimateType]}
                  </span>
                </div>
                <div>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${cConfig.color}`}>
                    {cConfig.label}
                  </span>
                </div>
                <div className="text-right font-mono text-sm font-medium text-slate-700">
                  ¥{formatCurrency(sc.totalAmount)}
                </div>
                <div className="text-xs text-slate-500">
                  {formatDate(sc.contractDate, "MM/dd")}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Truck className="w-4 h-4 text-orange-600" />
            下請け支払い
          </CardTitle>
          {hasUnregistered && (
            <div className="flex gap-1">
              {works.filter((w) => w.subcontractorId && !subPayments.some((sp) => sp.subcontractorId === w.subcontractorId)).map((w) => (
                <Button key={w.id} size="sm" variant="outline" className="text-xs gap-1" onClick={() => handleCreateFromWork(w)}>
                  <Plus className="w-3 h-3" />{w.subcontractor?.name}
                </Button>
              ))}
            </div>
          )}
        </div>
        {subPayments.length > 0 && (
          <div className="flex gap-4 mt-2 text-xs text-slate-500">
            <span>支払合計: <strong className="text-slate-700">¥{formatCurrency(totalSub)}</strong></span>
            <span>支払済: <strong className="text-green-700">¥{formatCurrency(paidSub)}</strong></span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {subPayments.length === 0 ? (
          <div className="text-center py-6 text-slate-400">
            <Truck className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">下請け支払いがまだ登録されていません</p>
          </div>
        ) : (
          <div className="space-y-2">
            {subPayments.map((sp) => (
              <div key={sp.id} className="border rounded-lg p-3 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${SUB_PAY_STATUS_STYLE[sp.status]}`}>
                      {SUB_PAY_STATUS_LABEL[sp.status]}
                    </span>
                    <span className="text-sm font-medium text-slate-700">{sp.subcontractorName}</span>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-red-500" onClick={() => handleDelete(sp.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex gap-3 text-xs text-slate-400">
                    {sp.closingDate && <span>締日: {formatDate(sp.closingDate, "MM/dd")}</span>}
                    {sp.paymentDueDate && <span>期日: {formatDate(sp.paymentDueDate, "MM/dd")}</span>}
                    {sp.paymentDate && <span className="text-green-600">支払日: {formatDate(sp.paymentDate, "MM/dd")}</span>}
                  </div>
                  <span className="font-mono font-bold">¥{formatCurrency(sp.totalAmount)}</span>
                </div>
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                  {sp.status === "PENDING" && (
                    <Button size="sm" variant="outline" className="text-xs gap-1 h-6 text-blue-700 border-blue-300" onClick={() => handleStatusUpdate(sp.id, "SCHEDULED")}>
                      <Clock className="w-3 h-3" />支払予定にする
                    </Button>
                  )}
                  {(sp.status === "PENDING" || sp.status === "SCHEDULED") && (
                    <Button size="sm" variant="outline" className="text-xs gap-1 h-6 text-green-700 border-green-300" onClick={() => handleStatusUpdate(sp.id, "PAID")}>
                      <CheckCircle2 className="w-3 h-3" />支払済にする
                    </Button>
                  )}
                </div>
                {sp.notes && <p className="text-xs text-slate-500 mt-1">備考: {sp.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
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

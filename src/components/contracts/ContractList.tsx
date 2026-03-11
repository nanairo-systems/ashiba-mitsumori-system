/**
 * [COMPONENT] 契約一覧 - ContractList
 *
 * 現場（プロジェクト）単位で1行にまとめて表示。
 * 1つの現場に複数契約(追加工事等)があっても1行。展開で個別契約を確認できる。
 * ステータス（工程）順にグループ化。追加工事見積の作成にも対応。
 */
"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ContractDetail } from "@/components/contracts/ContractDetail"
import type { WorkTypeMaster } from "@/components/schedules/schedule-types"
import { EstimateDetail } from "@/components/estimates/EstimateDetail"
import { formatDate, formatCurrency } from "@/lib/utils"
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
  Search,
  MoreHorizontal,
  FileText,
  CheckCircle2,
  XCircle,
  HandshakeIcon,
  CalendarCheck,
  Wrench,
  PackageCheck,
  Receipt,
  Wallet,
  AlertTriangle,
  ArrowDown,
  ChevronDown,
  ChevronRight,
  Plus,
  Layers,
  Ban,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { differenceInDays } from "date-fns"
import type { ContractStatus } from "@prisma/client"

// ─── 型定義 ────────────────────────────────────────────

interface GateInfo {
  scheduleCount: number
  hasActualStart: boolean
  allActualEnd: boolean
  invoiceCount: number
  allInvoicesPaid: boolean
}

interface Contract {
  id: string
  contractNumber: string | null
  name: string | null
  status: ContractStatus
  contractAmount: number
  taxAmount: number
  totalAmount: number
  contractDate: Date
  startDate: Date | null
  endDate: Date | null
  paymentTerms: string | null
  note: string | null
  createdAt: Date
  project: {
    id: string
    name: string
    address: string | null
    branch: { name: string; company: { id: string; name: string } }
    contact: { name: string } | null
  }
  estimate: {
    id: string
    estimateNumber: string | null
    title: string | null
    user: { id: string; name: string }
  } | null
  estimateCount: number
  gate: GateInfo
}

interface ProjectGroup {
  projectId: string
  projectName: string
  projectAddress: string | null
  companyId: string
  companyName: string
  contactName: string | null
  contracts: Contract[]
  totalAmount: number
  overallStatus: ContractStatus
  earliestDate: Date
  startDate: Date | null
  endDate: Date | null
  mainUser: string
}

interface Props {
  contracts: Contract[]
  currentUser: { id: string; name: string }
  workTypes: WorkTypeMaster[]
}

// ─── 工程順序定義 ──────────────────────────────────────

const STATUS_ORDER: ContractStatus[] = [
  "CONTRACTED",
  "SCHEDULE_CREATED",
  "IN_PROGRESS",
  "COMPLETED",
  "BILLED",
  "PAID",
  "CANCELLED",
]

const STATUS_INDEX = Object.fromEntries(STATUS_ORDER.map((s, i) => [s, i])) as Record<ContractStatus, number>

const STATUS_CONFIG: Record<ContractStatus, {
  label: string
  style: string
  bgHeader: string
  icon: typeof HandshakeIcon
  description: string
  staleWarningDays: number | null
}> = {
  CONTRACTED: {
    label: "契約済",
    style: "bg-blue-50 text-blue-700 border-blue-200",
    bgHeader: "bg-blue-600",
    icon: HandshakeIcon,
    description: "契約締結済み → 次は工程作成",
    staleWarningDays: 7,
  },
  SCHEDULE_CREATED: {
    label: "工程作成済",
    style: "bg-cyan-50 text-cyan-700 border-cyan-200",
    bgHeader: "bg-cyan-600",
    icon: CalendarCheck,
    description: "工程作成済み → 次は着工",
    staleWarningDays: 14,
  },
  IN_PROGRESS: {
    label: "着工",
    style: "bg-amber-50 text-amber-700 border-amber-200",
    bgHeader: "bg-amber-600",
    icon: Wrench,
    description: "施工中 → 次は完工",
    staleWarningDays: 90,
  },
  COMPLETED: {
    label: "完工",
    style: "bg-green-50 text-green-700 border-green-200",
    bgHeader: "bg-green-600",
    icon: PackageCheck,
    description: "施工完了 → 次は請求",
    staleWarningDays: 14,
  },
  BILLED: {
    label: "請求済",
    style: "bg-purple-50 text-purple-700 border-purple-200",
    bgHeader: "bg-purple-600",
    icon: Receipt,
    description: "請求済み → 入金待ち",
    staleWarningDays: 60,
  },
  PAID: {
    label: "入金済",
    style: "bg-emerald-50 text-emerald-700 border-emerald-200",
    bgHeader: "bg-emerald-600",
    icon: Wallet,
    description: "完了",
    staleWarningDays: null,
  },
  CANCELLED: {
    label: "キャンセル",
    style: "bg-slate-100 text-slate-500 border-slate-200",
    bgHeader: "bg-slate-500",
    icon: XCircle,
    description: "キャンセル済み",
    staleWarningDays: null,
  },
}

function getNextStatus(status: ContractStatus): ContractStatus | null {
  const idx = STATUS_ORDER.indexOf(status)
  if (idx < 0 || idx >= STATUS_ORDER.length - 2) return null
  return STATUS_ORDER[idx + 1]
}

function getGateBlock(nextStatus: ContractStatus, gate: GateInfo): string | null {
  switch (nextStatus) {
    case "SCHEDULE_CREATED":
      if (gate.scheduleCount === 0) return "工程が未登録です"
      break
    case "IN_PROGRESS":
      if (gate.scheduleCount === 0) return "工程が未登録です"
      if (!gate.hasActualStart) return "実績開始日が未入力です"
      break
    case "COMPLETED":
      if (gate.scheduleCount === 0) return "工程が未登録です"
      if (!gate.allActualEnd) return "全工程の実績終了日が未入力です"
      break
    case "BILLED":
      if (gate.invoiceCount === 0) return "請求書が未作成です"
      break
    case "PAID":
      if (gate.invoiceCount === 0) return "請求書が未作成です"
      if (!gate.allInvoicesPaid) return "未入金の請求書があります"
      break
  }
  return null
}

function getProjectGateBlock(nextStatus: ContractStatus, contracts: Contract[]): string | null {
  const active = contracts.filter((c) => c.status !== "CANCELLED")
  for (const c of active) {
    const block = getGateBlock(nextStatus, c.gate)
    if (block) return block
  }
  return null
}

function getOverallStatus(contracts: Contract[]): ContractStatus {
  const active = contracts.filter((c) => c.status !== "CANCELLED")
  if (active.length === 0) return "CANCELLED"
  let lowest = STATUS_INDEX[active[0].status]
  for (const c of active) {
    const idx = STATUS_INDEX[c.status]
    if (idx < lowest) lowest = idx
  }
  return STATUS_ORDER[lowest]
}

function getStaleDays(pg: ProjectGroup): number {
  const cfg = STATUS_CONFIG[pg.overallStatus]
  if (!cfg.staleWarningDays) return 0
  const ref = pg.startDate ?? pg.earliestDate
  const days = differenceInDays(new Date(), new Date(ref))
  return days > cfg.staleWarningDays ? days : 0
}

// ─── メインコンポーネント ───────────────────────────────

export function ContractList({ contracts, currentUser, workTypes }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<ContractStatus | "ALL">("ALL")
  const [collapsedStatuses, setCollapsedStatuses] = useState<Set<ContractStatus>>(new Set(["CANCELLED"]))
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())

  // ── スプリットビュー（契約詳細 + 見積詳細） ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type ContractPanel = { id: string; data: any | null; loading: boolean }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type EstimatePanel = { id: string; data: any | null; loading: boolean }

  const [contractPanel, setContractPanel] = useState<ContractPanel | null>(null)
  const [estimatePanel, setEstimatePanel] = useState<EstimatePanel | null>(null)

  const hasPanel = !!(contractPanel || estimatePanel)

  const openContract = useCallback((contractId: string) => {
    setContractPanel({ id: contractId, data: null, loading: true })
    setEstimatePanel(null)
    fetch(`/api/contracts/${contractId}?include=full`)
      .then((r) => r.json())
      .then((data) => setContractPanel((prev) => prev?.id === contractId ? { ...prev, data, loading: false } : prev))
      .catch(() => setContractPanel((prev) => prev?.id === contractId ? { ...prev, loading: false } : prev))
  }, [])

  const openEstimate = useCallback((estimateId: string) => {
    setEstimatePanel((prev) => ({ id: estimateId, data: prev?.data ?? null, loading: true }))
    fetch(`/api/estimates/${estimateId}`)
      .then((r) => r.json())
      .then((data) => setEstimatePanel((prev) => prev?.id === estimateId ? { ...prev, data, loading: false } : prev))
      .catch(() => setEstimatePanel((prev) => prev?.id === estimateId ? { ...prev, loading: false } : prev))
  }, [])

  const closeAllPanels = useCallback(() => {
    setContractPanel(null)
    setEstimatePanel(null)
  }, [])

  const refreshEstimatePanel = useCallback(() => {
    setEstimatePanel((prev) => {
      if (!prev) return prev
      fetch(`/api/estimates/${prev.id}`)
        .then((r) => r.json())
        .then((data) => setEstimatePanel((cur) => cur?.id === prev.id ? { ...cur, data, loading: false } : cur))
      return prev
    })
  }, [])

  const closeEstimatePanel = useCallback(() => {
    setEstimatePanel(null)
  }, [])

  useEffect(() => {
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
  }, [hasPanel])

  // 現場単位でグループ化
  const projectGroups = useMemo(() => {
    const map = new Map<string, ProjectGroup>()
    for (const c of contracts) {
      const key = c.project.id
      if (!map.has(key)) {
        map.set(key, {
          projectId: key,
          projectName: c.project.name,
          projectAddress: c.project.address,
          companyId: c.project.branch.company.id,
          companyName: c.project.branch.company.name,
          contactName: c.project.contact?.name ?? null,
          contracts: [],
          totalAmount: 0,
          overallStatus: "CONTRACTED",
          earliestDate: c.contractDate,
          startDate: null,
          endDate: null,
          mainUser: c.estimate?.user?.name || "",
        })
      }
      const pg = map.get(key)!
      pg.contracts.push(c)
      pg.totalAmount += c.totalAmount
      if (new Date(c.contractDate) < new Date(pg.earliestDate)) pg.earliestDate = c.contractDate
      if (c.startDate && (!pg.startDate || new Date(c.startDate) < new Date(pg.startDate))) pg.startDate = c.startDate
      if (c.endDate && (!pg.endDate || new Date(c.endDate) > new Date(pg.endDate))) pg.endDate = c.endDate
    }
    for (const pg of map.values()) {
      pg.overallStatus = getOverallStatus(pg.contracts)
    }
    return Array.from(map.values())
  }, [contracts])

  // フィルタ
  const filtered = projectGroups.filter((pg) => {
    const q = search.toLowerCase()
    const matchSearch =
      q === "" ||
      pg.companyName.toLowerCase().includes(q) ||
      pg.projectName.toLowerCase().includes(q) ||
      pg.contracts.some((c) => c.contractNumber?.toLowerCase().includes(q))
    const matchStatus = statusFilter === "ALL" || pg.overallStatus === statusFilter
    return matchSearch && matchStatus
  })

  // ステータス別にグループ
  const statusGroups = useMemo(() => {
    return STATUS_ORDER.map((status) => ({
      status,
      config: STATUS_CONFIG[status],
      items: filtered
        .filter((pg) => pg.overallStatus === status)
        .sort((a, b) => new Date(a.earliestDate).getTime() - new Date(b.earliestDate).getTime()),
    }))
  }, [filtered])

  // 件数カウントは現場単位（contracts ではなく projectGroups を使う）
  const projectCountByStatus = useMemo(() => {
    const counts: Record<string, number> = { ALL: 0 }
    for (const s of STATUS_ORDER) counts[s] = 0
    for (const pg of projectGroups) {
      counts[pg.overallStatus] = (counts[pg.overallStatus] || 0) + 1
      if (pg.overallStatus !== "CANCELLED") counts.ALL++
    }
    return counts
  }, [projectGroups])

  const amountByStatus = useMemo(() => {
    const amounts: Record<string, number> = { ALL: 0 }
    for (const s of STATUS_ORDER) amounts[s] = 0
    for (const pg of projectGroups) {
      amounts[pg.overallStatus] = (amounts[pg.overallStatus] || 0) + pg.totalAmount
      if (pg.overallStatus !== "CANCELLED") amounts.ALL += pg.totalAmount
    }
    return amounts
  }, [projectGroups])

  // 当月・前月の金額・件数を計算（契約日ベース）
  const { currentMonth, prevMonth } = useMemo(() => {
    const now = new Date()
    const curYear = now.getFullYear()
    const curMon = now.getMonth() // 0-indexed
    const prevYear = curMon === 0 ? curYear - 1 : curYear
    const prevMon = curMon === 0 ? 11 : curMon - 1

    const cur: Record<string, { amount: number; count: number }> = {}
    const prev: Record<string, { amount: number; count: number }> = {}
    for (const key of ["ALL", ...STATUS_ORDER]) {
      cur[key] = { amount: 0, count: 0 }
      prev[key] = { amount: 0, count: 0 }
    }

    for (const pg of projectGroups) {
      // 現場の最初の契約日で月を判定
      const d = new Date(pg.earliestDate)
      const y = d.getFullYear()
      const m = d.getMonth()
      const status = pg.overallStatus

      if (y === curYear && m === curMon) {
        cur[status].amount += pg.totalAmount
        cur[status].count++
        if (status !== "CANCELLED") {
          cur.ALL.amount += pg.totalAmount
          cur.ALL.count++
        }
      } else if (y === prevYear && m === prevMon) {
        prev[status].amount += pg.totalAmount
        prev[status].count++
        if (status !== "CANCELLED") {
          prev.ALL.amount += pg.totalAmount
          prev.ALL.count++
        }
      }
    }

    const monthLabel = (y: number, m: number) => `${y}年${m + 1}月`

    return {
      currentMonth: { label: monthLabel(curYear, curMon), data: cur },
      prevMonth: { label: monthLabel(prevYear, prevMon), data: prev },
    }
  }, [projectGroups])

  function toggleStatus(status: ContractStatus) {
    setCollapsedStatuses((prev) => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  function toggleProject(projectId: string) {
    setExpandedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
  }

  async function updateStatus(contractId: string, status: string) {
    const label = STATUS_CONFIG[status as ContractStatus].label
    if (!confirm(`ステータスを「${label}」に変更しますか？`)) return
    const res = await fetch(`/api/contracts/${contractId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      toast.success(`${label}に更新しました`)
      router.refresh()
    } else {
      const data = await res.json().catch(() => null)
      toast.error(data?.error ?? "更新に失敗しました")
    }
  }

  async function updateAllStatus(pg: ProjectGroup, status: string) {
    const label = STATUS_CONFIG[status as ContractStatus].label
    const activeContracts = pg.contracts.filter((c) => c.status !== "CANCELLED")
    if (!confirm(`${pg.projectName}の全契約（${activeContracts.length}件）を「${label}」に変更しますか？`)) return
    let success = 0
    for (const c of activeContracts) {
      const res = await fetch(`/api/contracts/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (res.ok) success++
    }
    if (success > 0) {
      toast.success(`${success}件を${label}に更新しました`)
      router.refresh()
    } else {
      toast.error("更新に失敗しました")
    }
  }

  const totalAmount = filtered
    .filter((pg) => pg.overallStatus !== "CANCELLED")
    .reduce((sum, pg) => sum + pg.totalAmount, 0)

  return (
    <div className="flex gap-0">
      {/* ── 左パネル: 契約一覧 ── */}
      <div className={`space-y-6 transition-all duration-300 ${hasPanel ? "w-[320px] shrink-0 overflow-y-auto max-h-[calc(100vh-4rem)] pr-2" : "flex-1"}`}>
      {/* ヘッダー */}
      <div className={hasPanel ? "flex items-center justify-between gap-2" : "flex items-center justify-between"}>
        <div>
          <h1 className={`${hasPanel ? "text-lg" : "text-2xl"} font-bold text-slate-900`}>契約管理</h1>
          {!hasPanel && (
            <p className="text-sm text-slate-500 mt-1">
              現場ごとに工程を管理 — こんにちは、{currentUser.name} さん
            </p>
          )}
        </div>
        {!hasPanel && (
          <Link href="/">
            <Button variant="outline" size="sm">商談一覧へ</Button>
          </Link>
        )}
      </div>

      {/* 工程フロー案内 */}
      <div className={`flex items-center gap-0 bg-white border rounded-xl ${hasPanel ? "p-1.5 flex-wrap" : "p-3"} overflow-x-auto`}>
        {STATUS_ORDER.filter((s) => s !== "CANCELLED").map((s, i, arr) => {
          const cfg = STATUS_CONFIG[s]
          const Icon = cfg.icon
          const count = projectCountByStatus[s] || 0
          return (
            <div key={s} className="flex items-center">
              <button
                onClick={() => setStatusFilter(statusFilter === s ? "ALL" : s)}
                className={`flex items-center gap-1 ${hasPanel ? "px-1.5 py-1" : "px-3 py-2"} rounded-lg text-xs font-medium border transition-all whitespace-nowrap ${
                  statusFilter === s
                    ? `${cfg.style} ring-2 ring-offset-1 ring-current`
                    : "border-transparent text-slate-500 hover:bg-slate-50"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {!hasPanel && cfg.label}
                <span className={`${hasPanel ? "" : "ml-1"} bg-white/80 text-slate-600 px-1.5 py-0.5 rounded-full text-xs leading-none font-bold`}>
                  {count}
                </span>
              </button>
              {i < arr.length - 1 && <ArrowDown className={`${hasPanel ? "w-2.5 h-2.5" : "w-3.5 h-3.5"} text-slate-500 mx-0.5 rotate-[-90deg]`} />}
            </div>
          )
        })}
      </div>

      {/* サマリーカード（当月・前月表示） */}
      <div className={`${hasPanel ? "hidden" : ""}`}>
        <div className="grid gap-1.5 grid-cols-3 lg:grid-cols-6">
          {(["ALL", ...STATUS_ORDER.filter((s) => s !== "CANCELLED" && s !== "IN_PROGRESS")] as const).map((key) => {
            const curData = currentMonth.data[key] || { amount: 0, count: 0 }
            const prevData = prevMonth.data[key] || { amount: 0, count: 0 }
            const label = key === "ALL" ? "合計" : STATUS_CONFIG[key].label
            const isActive = statusFilter === key
            const cardStyle = key === "ALL"
              ? "border-slate-200 bg-slate-50"
              : STATUS_CONFIG[key].style.replace("text-", "border-").split(" ")[0] + " " + STATUS_CONFIG[key].style.split(" ")[0]
            const textColor = key === "ALL" ? "text-slate-700" : STATUS_CONFIG[key].style.split(" ")[1]

            return (
              <button
                key={key}
                onClick={() => setStatusFilter(key === "ALL" ? "ALL" : key)}
                className={`rounded-lg border px-2.5 py-1.5 text-left transition-all ${cardStyle} ${isActive ? "ring-2 ring-offset-1 ring-current" : "hover:shadow-sm"}`}
              >
                <div className="flex items-baseline justify-between gap-1">
                  <p className={`text-[10px] font-medium ${textColor}`}>{label}</p>
                  <p className={`text-[10px] ${textColor} opacity-60`}>{curData.count}件</p>
                </div>
                <p className={`text-sm font-bold font-mono leading-tight ${textColor}`}>¥{formatCurrency(curData.amount)}</p>
                <p className="text-[10px] text-slate-400 leading-tight">前月 ¥{formatCurrency(prevData.amount)}（{prevData.count}件）</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* 検索 */}
      <div className="flex items-center gap-2">
        <div className={`relative flex-1 ${hasPanel ? "" : "max-w-sm"}`}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder={hasPanel ? "検索" : "会社名・現場名・契約番号で検索"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`pl-9 ${hasPanel ? "h-8 text-xs" : ""}`}
          />
        </div>
        {statusFilter !== "ALL" && (
          <Button size="sm" variant="ghost" onClick={() => setStatusFilter("ALL")} className="text-xs">
            解除
          </Button>
        )}
      </div>

      {/* ステータス別一覧 */}
      <div className="space-y-4">
        {statusGroups.map(({ status, config, items }) => {
          if (items.length === 0 && statusFilter !== "ALL") return null
          const isCollapsed = collapsedStatuses.has(status)
          const Icon = config.icon
          const groupAmount = items.reduce((s, pg) => s + pg.totalAmount, 0)

          return (
            <div key={status} className="bg-white rounded-xl border overflow-hidden">
              {/* ステータスヘッダー */}
              <button
                onClick={() => toggleStatus(status)}
                className={`w-full flex items-center gap-2 ${hasPanel ? "px-3 py-2" : "px-4 py-2.5"} text-white text-left hover:opacity-90 transition-opacity ${config.bgHeader}`}
              >
                {isCollapsed
                  ? <ChevronRight className="w-4 h-4 flex-shrink-0" />
                  : <ChevronDown className="w-4 h-4 flex-shrink-0" />
                }
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className={`font-semibold ${hasPanel ? "text-xs" : "text-sm"}`}>{config.label}</span>
                {!hasPanel && <span className="text-xs opacity-80 ml-1">{config.description}</span>}
                <span className={`ml-auto ${hasPanel ? "text-xs" : "text-sm"} font-mono opacity-90`}>
                  ¥{formatCurrency(groupAmount)}
                </span>
                <span className={`${hasPanel ? "text-xs" : "text-xs"} opacity-70 font-normal ml-2`}>
                  {items.length}件
                </span>
              </button>

              {!isCollapsed && items.length > 0 && (
                <div>
                  {/* 通常表示: ワイドグリッド */}
                  {!hasPanel && (
                    <>
                    <div className="grid grid-cols-[2fr_0.8fr_1.2fr_0.8fr_1fr_0.8fr_0.8fr_2.5rem] gap-x-3 px-4 py-2 bg-slate-50 border-b text-xs font-medium text-slate-600">
                      <span>現場名 / 会社名</span>
                      <span>ステータス</span>
                      <span className="text-right">合計金額（税込）</span>
                      <span>契約日</span>
                      <span>着工〜完工</span>
                      <span>先方担当</span>
                      <span>自社担当</span>
                      <span />
                    </div>

                    {items.map((pg, idx) => {
                      const isLast = idx === items.length - 1
                      const staleDays = getStaleDays(pg)
                      const isExpanded = expandedProjects.has(pg.projectId)
                      const hasMultiple = pg.contracts.length > 1
                      const nextStatus = getNextStatus(pg.overallStatus)
                      const nextLabel = nextStatus ? STATUS_CONFIG[nextStatus].label : null

                      return (
                        <div key={pg.projectId} className={!isLast ? "border-b border-slate-100" : ""}>
                          <div
                            className={`grid grid-cols-[2fr_0.8fr_1.2fr_0.8fr_1fr_0.8fr_0.8fr_2.5rem] gap-x-3 px-4 py-3 items-center hover:bg-blue-50/40 transition-colors ${
                              staleDays > 0 ? "bg-red-50/30" : ""
                            } ${pg.overallStatus === "CANCELLED" ? "opacity-50" : ""}`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                {hasMultiple && (
                                  <button onClick={() => toggleProject(pg.projectId)} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
                                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                                <button
                                  onClick={() => openContract(pg.contracts[0].id)}
                                  className="font-medium text-sm text-slate-800 hover:text-blue-600 hover:underline truncate text-left"
                                >
                                  {pg.projectName}
                                </button>
                                {hasMultiple && (
                                  <span className="flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-medium">
                                    <Layers className="w-2.5 h-2.5" />
                                    {pg.contracts.length}件
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ml-5">
                                <span className="text-xs text-slate-600">{pg.companyName}</span>
                                {pg.contracts[0].contractNumber && (
                                  <span className="text-xs text-slate-600 font-mono">{pg.contracts[0].contractNumber}</span>
                                )}
                              </div>
                              {staleDays > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-xs text-red-600 mt-0.5 ml-5">
                                  <AlertTriangle className="w-3 h-3" />
                                  {staleDays}日間滞留中
                                </span>
                              )}
                            </div>

                            <div className="space-y-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${config.style}`}>
                                {config.label}
                              </span>
                              {(() => {
                                const totalSchedules = pg.contracts.reduce((s, c) => s + c.gate.scheduleCount, 0)
                                if (pg.overallStatus === "CONTRACTED") {
                                  return totalSchedules === 0 ? (
                                    <span className="flex items-center gap-0.5 text-xs text-red-500 font-medium">
                                      <AlertTriangle className="w-3 h-3" />工程未登録
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-0.5 text-xs text-emerald-600 font-medium">
                                      <CalendarCheck className="w-3 h-3" />工程{totalSchedules}件
                                    </span>
                                  )
                                }
                                if (totalSchedules > 0 && STATUS_INDEX[pg.overallStatus] <= STATUS_INDEX["IN_PROGRESS"]) {
                                  return (
                                    <span className="flex items-center gap-0.5 text-xs text-slate-600">
                                      <CalendarCheck className="w-3 h-3" />工程{totalSchedules}件
                                    </span>
                                  )
                                }
                                return null
                              })()}
                            </div>

                            <div className="text-right font-mono text-sm font-semibold text-slate-800">
                              ¥{formatCurrency(pg.totalAmount)}
                            </div>
                            <div className="text-sm text-slate-600">
                              {formatDate(pg.earliestDate, "yyyy/MM/dd")}
                            </div>
                            <div className="text-xs text-slate-500">
                              {pg.startDate || pg.endDate ? (
                                <>
                                  {pg.startDate ? formatDate(pg.startDate, "M/d") : "—"}
                                  {" 〜 "}
                                  {pg.endDate ? formatDate(pg.endDate, "M/d") : "—"}
                                </>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </div>
                            <div className="text-sm text-slate-600 truncate">
                              {pg.contactName ?? <span className="text-slate-500">—</span>}
                            </div>
                            <div className="text-sm text-slate-600 truncate">
                              {pg.mainUser}
                            </div>
                            <div className="flex justify-end">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                  <DropdownMenuItem onClick={() => openContract(pg.contracts[0].id)} className="flex items-center gap-2">
                                    <HandshakeIcon className="w-4 h-4" />契約詳細を開く
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem asChild>
                                    <Link href={`/estimates/new?projectId=${pg.projectId}`} className="flex items-center gap-2 text-orange-700">
                                      <Plus className="w-4 h-4" />追加工事の見積を作成
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {hasMultiple ? (
                                    nextStatus && (() => {
                                      const block = getProjectGateBlock(nextStatus, pg.contracts)
                                      return block ? (
                                        <DropdownMenuItem disabled className="flex items-center gap-2 text-slate-400 opacity-60">
                                          <Ban className="w-4 h-4" />
                                          <span className="flex flex-col">
                                            <span>全契約を{nextLabel}にする</span>
                                            <span className="text-xs text-red-500">{block}</span>
                                          </span>
                                        </DropdownMenuItem>
                                      ) : (
                                        <DropdownMenuItem onClick={() => updateAllStatus(pg, nextStatus)} className="flex items-center gap-2 text-blue-700">
                                          <CheckCircle2 className="w-4 h-4" />全契約を{nextLabel}にする
                                        </DropdownMenuItem>
                                      )
                                    })()
                                  ) : (
                                    nextStatus && (() => {
                                      const block = getGateBlock(nextStatus, pg.contracts[0].gate)
                                      return block ? (
                                        <DropdownMenuItem disabled className="flex items-center gap-2 text-slate-400 opacity-60">
                                          <Ban className="w-4 h-4" />
                                          <span className="flex flex-col">
                                            <span>{nextLabel}にする</span>
                                            <span className="text-xs text-red-500">{block}</span>
                                          </span>
                                        </DropdownMenuItem>
                                      ) : (
                                        <DropdownMenuItem onClick={() => updateStatus(pg.contracts[0].id, nextStatus)} className="flex items-center gap-2 text-blue-700">
                                          <CheckCircle2 className="w-4 h-4" />{nextLabel}にする
                                        </DropdownMenuItem>
                                      )
                                    })()
                                  )}
                                  {pg.overallStatus !== "CANCELLED" && (
                                    <DropdownMenuItem
                                      onClick={() => hasMultiple ? updateAllStatus(pg, "CANCELLED") : updateStatus(pg.contracts[0].id, "CANCELLED")}
                                      className="flex items-center gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
                                    >
                                      <XCircle className="w-4 h-4" />キャンセルにする
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>

                          {/* 展開: 個別契約一覧 */}
                          {isExpanded && hasMultiple && (
                            <div className="mx-4 mb-3 rounded-lg border border-slate-200 overflow-hidden bg-slate-50/50">
                              <div className="grid grid-cols-[0.5fr_2fr_0.8fr_1fr_0.8fr_2.5rem] gap-x-3 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 border-b">
                                <span>種別</span>
                                <span>見積タイトル / 契約番号</span>
                                <span>ステータス</span>
                                <span className="text-right">金額（税込）</span>
                                <span>契約日</span>
                                <span />
                              </div>
                              {pg.contracts.map((c, ci) => {
                                const cNextStatus = getNextStatus(c.status)
                                const cNextLabel = cNextStatus ? STATUS_CONFIG[cNextStatus].label : null
                                const cConfig = STATUS_CONFIG[c.status]
                                return (
                                  <div
                                    key={c.id}
                                    className={`grid grid-cols-[0.5fr_2fr_0.8fr_1fr_0.8fr_2.5rem] gap-x-3 px-3 py-2 items-center hover:bg-white transition-colors ${
                                      ci < pg.contracts.length - 1 ? "border-b border-slate-100" : ""
                                    }`}
                                  >
                                    <div>
                                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                        ci === 0 ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                                      }`}>
                                        {ci === 0 ? "本工事" : `追加${ci}`}
                                      </span>
                                    </div>
                                    <div className="min-w-0">
                                      <button
                                        onClick={() => openContract(c.id)}
                                        className="text-sm text-slate-700 hover:text-blue-600 hover:underline truncate block text-left"
                                      >
                                        {c.name || c.estimate?.title || c.estimate?.estimateNumber || "見積"}
                                      </button>
                                      <div className="flex items-center gap-1.5">
                                        {c.contractNumber && (
                                          <span className="text-xs text-slate-600 font-mono">{c.contractNumber}</span>
                                        )}
                                        {c.estimateCount > 1 && (
                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                                            {c.estimateCount}件の見積
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="space-y-0.5">
                                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium border ${cConfig.style}`}>
                                        {cConfig.label}
                                      </span>
                                      {c.status === "CONTRACTED" && (
                                        c.gate.scheduleCount === 0 ? (
                                          <span className="flex items-center gap-0.5 text-xs text-red-500 font-medium">
                                            <AlertTriangle className="w-2.5 h-2.5" />工程未登録
                                          </span>
                                        ) : (
                                          <span className="flex items-center gap-0.5 text-xs text-emerald-600 font-medium">
                                            <CalendarCheck className="w-2.5 h-2.5" />工程{c.gate.scheduleCount}件
                                          </span>
                                        )
                                      )}
                                    </div>
                                    <div className="text-right font-mono text-sm font-medium text-slate-700">
                                      ¥{formatCurrency(c.totalAmount)}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {formatDate(c.contractDate, "MM/dd")}
                                    </div>
                                    <div className="flex justify-end">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                            <MoreHorizontal className="w-3.5 h-3.5" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-44">
                                          <DropdownMenuItem onClick={() => openContract(c.id)} className="flex items-center gap-2 text-xs">
                                            <HandshakeIcon className="w-3.5 h-3.5" />契約詳細を開く
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          {cNextStatus && (() => {
                                            const cBlock = getGateBlock(cNextStatus, c.gate)
                                            return cBlock ? (
                                              <DropdownMenuItem disabled className="flex items-center gap-2 text-xs text-slate-400 opacity-60">
                                                <Ban className="w-3.5 h-3.5" />
                                                <span className="flex flex-col">
                                                  <span>{cNextLabel}にする</span>
                                                  <span className="text-xs text-red-500">{cBlock}</span>
                                                </span>
                                              </DropdownMenuItem>
                                            ) : (
                                              <DropdownMenuItem onClick={() => updateStatus(c.id, cNextStatus)} className="flex items-center gap-2 text-xs text-blue-700">
                                                <CheckCircle2 className="w-3.5 h-3.5" />{cNextLabel}にする
                                              </DropdownMenuItem>
                                            )
                                          })()}
                                          {c.status !== "CANCELLED" && (
                                            <DropdownMenuItem onClick={() => updateStatus(c.id, "CANCELLED")} className="flex items-center gap-2 text-xs text-red-600">
                                              <XCircle className="w-3.5 h-3.5" />キャンセル
                                            </DropdownMenuItem>
                                          )}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    </>
                  )}

                  {/* コンパクト表示: パネル開時 */}
                  {hasPanel && items.map((pg, idx) => {
                    const isLast = idx === items.length - 1
                    const staleDays = getStaleDays(pg)
                    const hasMultiple = pg.contracts.length > 1
                    const isActive = contractPanel?.id === pg.contracts[0].id
                    const totalSchedules = pg.contracts.reduce((s, c) => s + c.gate.scheduleCount, 0)

                    return (
                      <button
                        key={pg.projectId}
                        onClick={() => openContract(pg.contracts[0].id)}
                        className={`w-full text-left px-3 py-2.5 transition-colors ${
                          isActive ? "bg-blue-50 border-l-2 border-l-blue-500" : "hover:bg-slate-50"
                        } ${!isLast ? "border-b border-slate-100" : ""} ${
                          pg.overallStatus === "CANCELLED" ? "opacity-50" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-medium text-slate-800 truncate">
                                {pg.projectName}
                              </span>
                              {hasMultiple && (
                                <span className="flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 text-xs font-medium">
                                  {pg.contracts.length}件
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-600 truncate block">{pg.companyName}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs font-mono font-semibold text-slate-700">
                              ¥{formatCurrency(pg.totalAmount)}
                            </div>
                            <div className="text-xs text-slate-600">
                              {formatDate(pg.earliestDate, "MM/dd")}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          {staleDays > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-xs text-red-600">
                              <AlertTriangle className="w-2.5 h-2.5" />{staleDays}日滞留
                            </span>
                          )}
                          {pg.overallStatus === "CONTRACTED" && (
                            totalSchedules === 0 ? (
                              <span className="inline-flex items-center gap-0.5 text-xs text-red-500 font-medium">
                                <AlertTriangle className="w-2.5 h-2.5" />工程未登録
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-xs text-emerald-600 font-medium">
                                <CalendarCheck className="w-2.5 h-2.5" />工程{totalSchedules}件
                              </span>
                            )
                          )}
                          {pg.mainUser && (
                            <span className="text-xs text-slate-600 ml-auto truncate">{pg.mainUser}</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {!isCollapsed && items.length === 0 && (
                <div className="py-6 text-center text-sm text-slate-400">
                  該当する現場はありません
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-slate-600 text-right">
        {filtered.length} 現場 / 合計 ¥{formatCurrency(totalAmount)}
      </p>
      </div>

      {/* ── 中パネル: 契約詳細 ── */}
      {contractPanel && (
        <div className={`border-l border-slate-200 bg-white shadow-sm relative ${estimatePanel ? "w-[420px] shrink-0" : "flex-1 min-w-0"}`}>
          <div className="max-h-[calc(100vh-4rem)] overflow-y-auto px-3 pb-6">
            {!contractPanel.data ? (
              <div className="flex items-center justify-center py-32">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                <span className="ml-2 text-slate-500">読み込み中...</span>
              </div>
            ) : (
              <ContractDetail
                key={contractPanel.id}
                contract={contractPanel.data.contract}
                siblingContracts={contractPanel.data.siblingContracts}
                subcontractors={contractPanel.data.subcontractors}
                currentUser={currentUser}
                workTypes={workTypes}
                onOpenEstimate={openEstimate}
                onOpenContract={openContract}
                onClose={closeAllPanels}
              />
            )}
          </div>
          {contractPanel.loading && contractPanel.data && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10 pointer-events-none">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          )}
        </div>
      )}

      {/* ── 右パネル: 見積詳細 ── */}
      {estimatePanel && (
        <div className="flex-1 min-w-0 border-l border-slate-200 bg-white shadow-sm relative">
          <div className="max-h-[calc(100vh-4rem)] overflow-y-auto px-3 pb-6">
            {!estimatePanel.data ? (
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
                onClose={closeEstimatePanel}
                onNavigateEstimate={openEstimate}
                onRefresh={refreshEstimatePanel}
              />
            )}
          </div>
          {estimatePanel.loading && estimatePanel.data && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10 pointer-events-none">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

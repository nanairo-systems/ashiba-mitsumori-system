/**
 * [COMPONENT] 契約一覧 - ContractList
 *
 * 商談一覧（ProjectList）と同じデザイン：
 * - カード型ブロック（テーブルグリッド廃止）
 * - 超大文字・角張り・ボールド
 * - ステータス別ステージ表示
 * - 展開で個別契約をカードで表示
 */
"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ContractDetail } from "@/components/contracts/ContractDetail"
import type { WorkTypeMaster } from "@/components/schedules/schedule-types"
import { EstimateDetail } from "@/components/estimates/EstimateDetail"
import { formatDate, formatCurrency } from "@/lib/utils"
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
  CheckCircle2,
  XCircle,
  HandshakeIcon,
  CalendarCheck,
  Wrench,
  PackageCheck,
  Receipt,
  Wallet,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Plus,
  Layers,
  Ban,
  Loader2,
  X,
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
  icon: typeof HandshakeIcon
  description: string
  staleWarningDays: number | null
  // ステージヘッダー色
  bg: string
  hoverBg: string
  lightBg: string
  border: string
  text: string
  // カード色
  cardBg: string
  cardBorder: string
  cardHover: string
  // バッジ色
  badgeBg: string
  badgeText: string
  accent: string
}> = {
  CONTRACTED: {
    label: "契約済",
    icon: HandshakeIcon,
    description: "契約締結 → 工程作成",
    staleWarningDays: 7,
    bg: "bg-blue-600", hoverBg: "hover:bg-blue-700", lightBg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700",
    cardBg: "bg-gradient-to-r from-blue-50 to-indigo-50", cardBorder: "border-l-blue-500", cardHover: "hover:from-blue-100 hover:to-indigo-100",
    badgeBg: "bg-blue-500", badgeText: "text-white", accent: "text-blue-600",
  },
  SCHEDULE_CREATED: {
    label: "工程作成済",
    icon: CalendarCheck,
    description: "工程作成 → 着工",
    staleWarningDays: 14,
    bg: "bg-cyan-600", hoverBg: "hover:bg-cyan-700", lightBg: "bg-cyan-50", border: "border-cyan-200", text: "text-cyan-700",
    cardBg: "bg-gradient-to-r from-cyan-50 to-teal-50", cardBorder: "border-l-cyan-500", cardHover: "hover:from-cyan-100 hover:to-teal-100",
    badgeBg: "bg-cyan-500", badgeText: "text-white", accent: "text-cyan-600",
  },
  IN_PROGRESS: {
    label: "着工",
    icon: Wrench,
    description: "施工中 → 完工",
    staleWarningDays: 90,
    bg: "bg-amber-600", hoverBg: "hover:bg-amber-700", lightBg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700",
    cardBg: "bg-gradient-to-r from-amber-50 to-orange-50", cardBorder: "border-l-amber-500", cardHover: "hover:from-amber-100 hover:to-orange-100",
    badgeBg: "bg-amber-500", badgeText: "text-white", accent: "text-amber-600",
  },
  COMPLETED: {
    label: "完工",
    icon: PackageCheck,
    description: "完了 → 請求",
    staleWarningDays: 14,
    bg: "bg-green-600", hoverBg: "hover:bg-green-700", lightBg: "bg-green-50", border: "border-green-200", text: "text-green-700",
    cardBg: "bg-gradient-to-r from-green-50 to-emerald-50", cardBorder: "border-l-green-500", cardHover: "hover:from-green-100 hover:to-emerald-100",
    badgeBg: "bg-green-500", badgeText: "text-white", accent: "text-green-600",
  },
  BILLED: {
    label: "請求済",
    icon: Receipt,
    description: "請求済 → 入金",
    staleWarningDays: 60,
    bg: "bg-purple-600", hoverBg: "hover:bg-purple-700", lightBg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700",
    cardBg: "bg-gradient-to-r from-purple-50 to-fuchsia-50", cardBorder: "border-l-purple-500", cardHover: "hover:from-purple-100 hover:to-fuchsia-100",
    badgeBg: "bg-purple-500", badgeText: "text-white", accent: "text-purple-600",
  },
  PAID: {
    label: "入金済",
    icon: Wallet,
    description: "完了",
    staleWarningDays: null,
    bg: "bg-emerald-600", hoverBg: "hover:bg-emerald-700", lightBg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700",
    cardBg: "bg-gradient-to-r from-emerald-50 to-green-50", cardBorder: "border-l-emerald-500", cardHover: "hover:from-emerald-100 hover:to-green-100",
    badgeBg: "bg-emerald-500", badgeText: "text-white", accent: "text-emerald-600",
  },
  CANCELLED: {
    label: "キャンセル",
    icon: XCircle,
    description: "キャンセル",
    staleWarningDays: null,
    bg: "bg-slate-500", hoverBg: "hover:bg-slate-600", lightBg: "bg-slate-50", border: "border-slate-200", text: "text-slate-500",
    cardBg: "bg-slate-50", cardBorder: "border-l-slate-300", cardHover: "hover:bg-slate-100",
    badgeBg: "bg-slate-400", badgeText: "text-white", accent: "text-slate-500",
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
      if (!gate.hasActualStart) return "実績組み立て日が未入力です"
      break
    case "COMPLETED":
      if (gate.scheduleCount === 0) return "工程が未登録です"
      if (!gate.allActualEnd) return "全工程の実績解体日が未入力です"
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
  const ref = pg.earliestDate
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

  // ── スプリットビュー ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [contractPanel, setContractPanel] = useState<{ id: string; data: any | null; loading: boolean } | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [estimatePanel, setEstimatePanel] = useState<{ id: string; data: any | null; loading: boolean } | null>(null)

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

  const collapseSidebar = useCallback(() => {
    window.dispatchEvent(new Event("collapse-sidebar"))
  }, [])

  useEffect(() => {
    const el = document.getElementById("app-content")
    if (!el) return
    if (hasPanel) {
      el.classList.remove("max-w-7xl", "mx-auto", "px-6")
      el.classList.add("px-2")
      collapseSidebar()
    } else {
      el.classList.remove("px-2")
      el.classList.add("max-w-7xl", "mx-auto", "px-6")
    }
    return () => {
      el.classList.remove("px-2")
      el.classList.add("max-w-7xl", "mx-auto", "px-6")
    }
  }, [hasPanel, collapseSidebar])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && hasPanel) closeAllPanels()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [hasPanel, closeAllPanels])

  // ── データ ──
  const projectGroups = useMemo(() => {
    const map = new Map<string, ProjectGroup>()
    for (const c of contracts) {
      const key = c.project.id
      if (!map.has(key)) {
        map.set(key, {
          projectId: key, projectName: c.project.name, projectAddress: c.project.address,
          companyId: c.project.branch.company.id, companyName: c.project.branch.company.name,
          contactName: c.project.contact?.name ?? null,
          contracts: [], totalAmount: 0, overallStatus: "CONTRACTED",
          earliestDate: c.contractDate,
          mainUser: c.estimate?.user?.name || "",
        })
      }
      const pg = map.get(key)!
      pg.contracts.push(c)
      pg.totalAmount += c.totalAmount
      if (new Date(c.contractDate) < new Date(pg.earliestDate)) pg.earliestDate = c.contractDate
    }
    for (const pg of map.values()) pg.overallStatus = getOverallStatus(pg.contracts)
    return Array.from(map.values())
  }, [contracts])

  const filtered = projectGroups.filter((pg) => {
    const q = search.toLowerCase()
    const matchSearch = q === "" ||
      pg.companyName.toLowerCase().includes(q) ||
      pg.projectName.toLowerCase().includes(q) ||
      pg.contracts.some((c) => c.contractNumber?.toLowerCase().includes(q))
    const matchStatus = statusFilter === "ALL" || pg.overallStatus === statusFilter
    return matchSearch && matchStatus
  })

  const statusGroups = useMemo(() => {
    return STATUS_ORDER.map((status) => ({
      status, config: STATUS_CONFIG[status],
      items: filtered.filter((pg) => pg.overallStatus === status)
        .sort((a, b) => new Date(a.earliestDate).getTime() - new Date(b.earliestDate).getTime()),
    }))
  }, [filtered])

  const countByStatus = useMemo(() => {
    const c: Record<string, number> = { ALL: 0 }
    for (const s of STATUS_ORDER) c[s] = 0
    for (const pg of projectGroups) {
      c[pg.overallStatus] = (c[pg.overallStatus] || 0) + 1
      if (pg.overallStatus !== "CANCELLED") c.ALL++
    }
    return c
  }, [projectGroups])

  function toggleStatus(status: ContractStatus) {
    setCollapsedStatuses((prev) => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status); else next.add(status)
      return next
    })
  }

  function toggleProject(projectId: string) {
    setExpandedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) next.delete(projectId); else next.add(projectId)
      return next
    })
  }

  async function updateStatus(contractId: string, status: string) {
    const label = STATUS_CONFIG[status as ContractStatus].label
    if (!confirm(`ステータスを「${label}」に変更しますか？`)) return
    const res = await fetch(`/api/contracts/${contractId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (res.ok) { toast.success(`${label}に更新しました`); router.refresh() }
    else { const data = await res.json().catch(() => null); toast.error(data?.error ?? "更新に失敗しました") }
  }

  async function updateAllStatus(pg: ProjectGroup, status: string) {
    const label = STATUS_CONFIG[status as ContractStatus].label
    const active = pg.contracts.filter((c) => c.status !== "CANCELLED")
    if (!confirm(`${pg.projectName}の全契約（${active.length}件）を「${label}」に変更しますか？`)) return
    let success = 0
    for (const c of active) {
      const res = await fetch(`/api/contracts/${c.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (res.ok) success++
    }
    if (success > 0) { toast.success(`${success}件を${label}に更新しました`); router.refresh() }
    else toast.error("更新に失敗しました")
  }

  const totalAmount = filtered.filter((pg) => pg.overallStatus !== "CANCELLED").reduce((sum, pg) => sum + pg.totalAmount, 0)

  // 現在のパネルで選択中の契約ID
  const activePanelId = contractPanel?.id ?? null

  return (
    <div className="flex gap-0 h-full">
      {/* ── 一覧パネル ── */}
      <div className={`${hasPanel ? "w-[32%] min-w-[340px] shrink-0 border-r border-slate-200" : "flex-1"} overflow-y-auto max-h-[calc(100vh-4rem)]`}>
        <div className={`${hasPanel ? "p-2" : "px-6 py-4"} space-y-3`}>

          {/* ヘッダー */}
          <div className="relative flex items-center justify-between">
            <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">CL-1</span>
            <div>
              <h1 className={`ml-7 ${hasPanel ? "text-base" : "text-3xl"} font-extrabold text-slate-900`}>契約管理</h1>
              {!hasPanel && <p className="text-base text-slate-500 mt-0.5">{currentUser.name} さん</p>}
            </div>
            <Link href="/">
              <button className={`inline-flex items-center gap-1.5 ${hasPanel ? "px-3 py-1.5 rounded-sm text-sm" : "px-5 py-2.5 rounded-sm text-base"} bg-slate-700 text-white font-bold hover:bg-slate-800 active:bg-slate-900 transition-all shadow-lg shadow-slate-200 active:scale-95`}>
                商談一覧へ
              </button>
            </Link>
          </div>

          {/* サマリーバー（ステータス別件数） */}
          <div className={`relative grid ${hasPanel ? "grid-cols-4 gap-1" : "grid-cols-4 gap-2"}`}>
            <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">CL-2</span>
            {([
              { key: "ALL" as const, label: "すべて", count: countByStatus.ALL, colors: { activeBg: "border-slate-700 bg-slate-700", activeText: "text-white", activeShadow: "shadow-slate-200", inactiveBg: "border-slate-200 bg-white", inactiveNum: "text-slate-600", inactiveLabel: "text-slate-500" } },
              { key: "CONTRACTED" as const, label: "契約済", count: countByStatus.CONTRACTED, colors: { activeBg: "border-blue-500 bg-blue-500", activeText: "text-white", activeShadow: "shadow-blue-200", inactiveBg: "border-blue-200 bg-blue-50", inactiveNum: "text-blue-600", inactiveLabel: "text-blue-500" } },
              { key: "IN_PROGRESS" as const, label: "施工中", count: countByStatus.IN_PROGRESS + countByStatus.SCHEDULE_CREATED, colors: { activeBg: "border-amber-500 bg-amber-500", activeText: "text-white", activeShadow: "shadow-amber-200", inactiveBg: "border-amber-200 bg-amber-50", inactiveNum: "text-amber-600", inactiveLabel: "text-amber-500" } },
              { key: "COMPLETED" as const, label: "完工以降", count: countByStatus.COMPLETED + countByStatus.BILLED + countByStatus.PAID, colors: { activeBg: "border-emerald-500 bg-emerald-500", activeText: "text-white", activeShadow: "shadow-emerald-200", inactiveBg: "border-emerald-200 bg-emerald-50", inactiveNum: "text-emerald-600", inactiveLabel: "text-emerald-500" } },
            ]).map((item) => {
              const isActive = statusFilter === item.key
              const c = item.colors
              return (
                <button
                  key={item.key}
                  onClick={() => setStatusFilter(isActive && item.key !== "ALL" ? "ALL" : item.key === "ALL" ? "ALL" : item.key)}
                  className={`${hasPanel ? "rounded-sm p-2" : "rounded-sm p-4"} border-2 transition-all active:scale-95 ${
                    isActive ? `${c.activeBg} ${c.activeText} shadow-lg ${c.activeShadow}` : `${c.inactiveBg} hover:opacity-80`
                  }`}
                >
                  <div className={`${hasPanel ? "text-xl" : "text-3xl"} font-black tabular-nums ${isActive ? c.activeText : c.inactiveNum}`}>{item.count}</div>
                  <div className={`${hasPanel ? "text-xs" : "text-sm"} font-bold ${hasPanel ? "mt-0" : "mt-1"} ${isActive ? "opacity-70" : c.inactiveLabel}`}>{item.label}</div>
                </button>
              )
            })}
          </div>

          {/* 検索バー */}
          <div className="relative">
            <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">CL-3</span>
            <Search className={`absolute ${hasPanel ? "left-3 w-4 h-4" : "left-4 w-5 h-5"} top-1/2 -translate-y-1/2 text-slate-400`} />
            <input
              type="text"
              placeholder={hasPanel ? "検索" : "会社名・現場名・契約番号で検索"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full ${hasPanel ? "pl-9 pr-8 py-2 rounded-sm text-sm" : "pl-12 pr-10 py-3 rounded-sm text-base"} border-2 border-slate-200 font-medium placeholder:text-slate-400 focus:outline-none focus:border-blue-400 transition-all bg-white`}
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            )}
          </div>

          {/* フィルター表示 */}
          {(search || statusFilter !== "ALL") && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">{filtered.length}件表示</span>
              <button onClick={() => { setSearch(""); setStatusFilter("ALL") }} className="text-sm text-blue-600 font-bold hover:underline">
                リセット
              </button>
            </div>
          )}

          {/* ─── ステータス別一覧（カード型パイプライン） ─── */}
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-xl font-bold text-slate-400 mb-2">
                {search || statusFilter !== "ALL" ? "条件に一致する現場がありません" : "契約がありません"}
              </p>
              {(search || statusFilter !== "ALL") && (
                <button
                  onClick={() => { setSearch(""); setStatusFilter("ALL") }}
                  className="mt-4 px-5 py-2.5 rounded-sm bg-slate-100 text-base font-bold text-slate-600 hover:bg-slate-200 active:scale-95 transition-all"
                >
                  絞り込みを解除
                </button>
              )}
            </div>
          ) : (
            <div className="relative space-y-2">
              <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">CL-4</span>
              {statusGroups.map(({ status, config, items }) => {
                if (items.length === 0 && statusFilter !== "ALL") return null
                const isCollapsed = collapsedStatuses.has(status)
                const Icon = config.icon

                return (
                  <div key={status} className="rounded-sm overflow-hidden shadow-sm">
                    {/* ステージヘッダー */}
                    <button
                      onClick={() => toggleStatus(status)}
                      className={`w-full flex items-center gap-2 ${hasPanel ? "px-3 py-2" : "px-4 py-3"} ${config.bg} ${config.hoverBg} text-white text-left active:opacity-90 transition-colors`}
                    >
                      {isCollapsed
                        ? <ChevronRight className={`${hasPanel ? "w-3.5 h-3.5" : "w-5 h-5"} shrink-0`} />
                        : <ChevronDown className={`${hasPanel ? "w-3.5 h-3.5" : "w-5 h-5"} shrink-0`} />
                      }
                      <Icon className={`${hasPanel ? "w-4 h-4" : "w-5 h-5"} shrink-0`} />
                      <span className={`${hasPanel ? "text-sm" : "text-base"} font-bold flex-1`}>{config.label}</span>
                      {!hasPanel && <span className="text-sm opacity-80">{config.description}</span>}
                      <span className={`${hasPanel ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-0.5"} rounded-full bg-white/20 font-bold`}>
                        {items.length}件
                      </span>
                    </button>

                    {/* ステージ内の現場カード一覧 */}
                    {!isCollapsed && items.length > 0 && (
                      <div className={`${config.lightBg} border border-t-0 ${config.border} rounded-b-sm divide-y divide-slate-200`}>
                        {items.map((pg) => (
                          <ProjectBlock
                            key={pg.projectId}
                            pg={pg}
                            config={config}
                            hasPanel={hasPanel}
                            activePanelId={activePanelId}
                            expandedProjects={expandedProjects}
                            toggleProject={toggleProject}
                            openContract={openContract}
                            updateStatus={updateStatus}
                            updateAllStatus={updateAllStatus}
                          />
                        ))}
                      </div>
                    )}

                    {/* 空のステージ */}
                    {!isCollapsed && items.length === 0 && (
                      <div className={`${config.lightBg} border border-t-0 ${config.border} rounded-b-sm px-4 py-6 text-center`}>
                        <p className={`text-sm ${config.text} font-medium opacity-60`}>該当する現場はありません</p>
                      </div>
                    )}

                    {/* ステージ間の接続線 */}
                    {statusFilter === "ALL" && status !== "CANCELLED" && status !== "PAID" && (
                      <div className="flex justify-center py-1">
                        <div className="w-0.5 h-3 bg-slate-300" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <p className="text-sm text-slate-500 text-right font-bold tabular-nums">
            {filtered.length} 現場 / 合計 ¥{formatCurrency(totalAmount)}
          </p>
        </div>
      </div>

      {/* ── 中パネル: 契約詳細 ── */}
      {contractPanel && (
        <div className={`border-l border-slate-200 bg-white shadow-sm relative ${estimatePanel ? "w-[420px] shrink-0" : "flex-1 min-w-0"}`}>
          <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">CL-5</span>
          <div className="max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-5 py-3 flex items-center justify-end">
              <button onClick={closeAllPanels} className="inline-flex items-center gap-2 px-3 py-2 rounded-sm text-sm font-bold text-slate-500 hover:bg-slate-100 active:bg-slate-200 transition-colors">
                <X className="w-5 h-5" />閉じる
              </button>
            </div>
            <div className="px-3 pb-6">
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
          <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">CL-6</span>
          <div className="max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-5 py-3 flex items-center justify-end">
              <button onClick={closeEstimatePanel} className="inline-flex items-center gap-2 px-3 py-2 rounded-sm text-sm font-bold text-slate-500 hover:bg-slate-100 active:bg-slate-200 transition-colors">
                <X className="w-5 h-5" />閉じる
              </button>
            </div>
            <div className="px-3 pb-6">
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

// ─── 現場ブロック（カード型） ──────────────────────────────

function ProjectBlock({
  pg, config, hasPanel, activePanelId,
  expandedProjects, toggleProject,
  openContract, updateStatus, updateAllStatus,
}: {
  pg: ProjectGroup
  config: typeof STATUS_CONFIG[ContractStatus]
  hasPanel: boolean
  activePanelId: string | null
  expandedProjects: Set<string>
  toggleProject: (id: string) => void
  openContract: (id: string) => void
  updateStatus: (contractId: string, status: string) => void
  updateAllStatus: (pg: ProjectGroup, status: string) => void
}) {
  const staleDays = getStaleDays(pg)
  const isExpanded = expandedProjects.has(pg.projectId)
  const hasMultiple = pg.contracts.length > 1
  const nextStatus = getNextStatus(pg.overallStatus)
  const nextLabel = nextStatus ? STATUS_CONFIG[nextStatus]?.label : null
  const isActive = activePanelId === pg.contracts[0].id
  const totalSchedules = pg.contracts.reduce((s, c) => s + c.gate.scheduleCount, 0)

  return (
    <div className={`${hasPanel ? "px-2 py-2" : "px-4 py-4"}`}>
      {/* 現場カード */}
      <div
        onClick={() => openContract(pg.contracts[0].id)}
        className={`bg-white rounded-sm border-2 ${hasPanel ? "px-2.5 py-2" : "px-4 py-3"} shadow-sm cursor-pointer hover:bg-slate-50 active:bg-slate-100 transition-colors ${
          isActive ? "border-blue-500 ring-2 ring-blue-200 bg-blue-50" : "border-slate-300"
        } ${pg.overallStatus === "CANCELLED" ? "opacity-50" : ""}`}
      >
        <div className="flex items-center gap-2">
          {/* 展開アイコン */}
          {hasMultiple && (
            <button
              onClick={(e) => { e.stopPropagation(); toggleProject(pg.projectId) }}
              className={`${hasPanel ? "w-5 h-5" : "w-7 h-7"} shrink-0 rounded-sm flex items-center justify-center transition-colors ${
                isExpanded
                  ? "bg-blue-500 text-white hover:bg-blue-600"
                  : "bg-slate-200 text-slate-600 hover:bg-blue-500 hover:text-white"
              }`}
            >
              {isExpanded ? <ChevronDown className={`${hasPanel ? "w-3 h-3" : "w-4 h-4"}`} /> : <ChevronRight className={`${hasPanel ? "w-3 h-3" : "w-4 h-4"}`} />}
            </button>
          )}

          {/* 現場名 */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <h3 className={`${hasPanel ? "text-sm" : "text-lg"} font-extrabold text-slate-900 leading-tight truncate`}>
              {pg.projectName}
            </h3>
            {hasMultiple && (
              <span className={`shrink-0 ${hasPanel ? "px-1 py-0 text-[10px]" : "px-2 py-0.5 text-xs"} rounded-sm bg-orange-100 text-orange-700 font-bold`}>
                <Layers className="w-2.5 h-2.5 inline mr-0.5" />{pg.contracts.length}件
              </span>
            )}
          </div>

          {/* 契約日 */}
          {!hasPanel && (
            <span className="shrink-0 text-sm text-slate-500 font-medium tabular-nums">
              {formatDate(pg.earliestDate, "yyyy/M/d")} 契約
            </span>
          )}

          {/* 金額 */}
          <span className={`shrink-0 ${hasPanel ? "text-sm" : "text-xl"} font-black ${config.accent} tabular-nums`}>
            ¥{formatCurrency(pg.totalAmount)}
          </span>

          {/* アクションボタン */}
          {!hasPanel && (
            <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="px-2 py-1.5 rounded-sm bg-slate-100 text-slate-500 hover:bg-slate-200 active:scale-95 transition-all">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
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
                          <span className="flex flex-col"><span>全契約を{nextLabel}にする</span><span className="text-xs text-red-500">{block}</span></span>
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
                          <span className="flex flex-col"><span>{nextLabel}にする</span><span className="text-xs text-red-500">{block}</span></span>
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
          )}
        </div>

        {/* 2行目: 会社名・担当者・住所 */}
        <div className={`flex items-center gap-2 mt-0.5 ${hasPanel ? "text-xs" : "text-sm"} text-slate-500`}>
          <span className="font-medium">{pg.companyName}</span>
          {!hasPanel && (
            <>
              <span className="text-slate-300">|</span>
              <span className="font-medium">{pg.contactName ?? "担当未設定"}</span>
              {pg.mainUser && (
                <>
                  <span className="text-slate-300">|</span>
                  <span className="px-2 py-0.5 rounded-sm bg-indigo-100 text-indigo-700 text-xs font-bold">{pg.mainUser}</span>
                </>
              )}
            </>
          )}
        </div>

        {/* 3行目: ステップ進行バー */}
        <div className={`flex items-center ${hasPanel ? "gap-1 mt-1" : "gap-1.5 mt-2"} flex-wrap`}>
          {/* STEP: 工程 */}
          {totalSchedules > 0 ? (
            <span className={`inline-flex items-center gap-0.5 ${hasPanel ? "px-1.5 py-0.5 text-xs" : "px-3 py-1.5 text-sm"} rounded-sm font-bold bg-cyan-500 text-white shadow-sm`}>
              <CalendarCheck className={`${hasPanel ? "w-2.5 h-2.5" : "w-3.5 h-3.5"}`} />
              工程{totalSchedules}件
            </span>
          ) : (
            <span className={`inline-flex items-center gap-0.5 ${hasPanel ? "px-1.5 py-0.5 text-xs" : "px-3 py-1.5 text-sm"} rounded-sm font-bold border-2 border-dashed border-cyan-300 text-cyan-400 bg-cyan-50/50`}>
              <CalendarCheck className={`${hasPanel ? "w-2.5 h-2.5" : "w-3.5 h-3.5"}`} />
              工程未登録
            </span>
          )}

          <ChevronRight className={`${hasPanel ? "w-2.5 h-2.5" : "w-3.5 h-3.5"} text-slate-300 shrink-0`} />

          {/* STEP: 着工 */}
          {STATUS_INDEX[pg.overallStatus] >= STATUS_INDEX["IN_PROGRESS"] ? (
            <span className={`inline-flex items-center gap-0.5 ${hasPanel ? "px-1.5 py-0.5 text-xs" : "px-3 py-1.5 text-sm"} rounded-sm font-bold bg-amber-500 text-white shadow-sm`}>
              <Wrench className={`${hasPanel ? "w-2.5 h-2.5" : "w-3.5 h-3.5"}`} />
              {hasPanel ? "着工" : "着工済"}
            </span>
          ) : (
            <span className={`inline-flex items-center gap-0.5 ${hasPanel ? "px-1.5 py-0.5 text-xs" : "px-3 py-1.5 text-sm"} rounded-sm font-bold border-2 border-dashed border-amber-300 text-amber-400 bg-amber-50/50`}>
              <Wrench className={`${hasPanel ? "w-2.5 h-2.5" : "w-3.5 h-3.5"}`} />
              未着工
            </span>
          )}

          <ChevronRight className={`${hasPanel ? "w-2.5 h-2.5" : "w-3.5 h-3.5"} text-slate-300 shrink-0`} />

          {/* STEP: 完工 */}
          {STATUS_INDEX[pg.overallStatus] >= STATUS_INDEX["COMPLETED"] ? (
            <span className={`inline-flex items-center gap-0.5 ${hasPanel ? "px-1.5 py-0.5 text-xs" : "px-3 py-1.5 text-sm"} rounded-sm font-bold bg-green-500 text-white shadow-sm`}>
              <PackageCheck className={`${hasPanel ? "w-2.5 h-2.5" : "w-3.5 h-3.5"}`} />
              {hasPanel ? "完工" : "完工済"}
            </span>
          ) : (
            <span className={`inline-flex items-center gap-0.5 ${hasPanel ? "px-1.5 py-0.5 text-xs" : "px-3 py-1.5 text-sm"} rounded-sm font-bold border-2 border-dashed border-green-300 text-green-400 bg-green-50/50`}>
              <PackageCheck className={`${hasPanel ? "w-2.5 h-2.5" : "w-3.5 h-3.5"}`} />
              未完工
            </span>
          )}

          <ChevronRight className={`${hasPanel ? "w-2.5 h-2.5" : "w-3.5 h-3.5"} text-slate-300 shrink-0`} />

          {/* STEP: 入金 */}
          {STATUS_INDEX[pg.overallStatus] >= STATUS_INDEX["PAID"] ? (
            <span className={`inline-flex items-center gap-0.5 ${hasPanel ? "px-1.5 py-0.5 text-xs" : "px-3 py-1.5 text-sm"} rounded-sm font-bold bg-emerald-500 text-white shadow-sm`}>
              <Wallet className={`${hasPanel ? "w-2.5 h-2.5" : "w-3.5 h-3.5"}`} />
              入金済
            </span>
          ) : STATUS_INDEX[pg.overallStatus] >= STATUS_INDEX["BILLED"] ? (
            <span className={`inline-flex items-center gap-0.5 ${hasPanel ? "px-1.5 py-0.5 text-xs" : "px-3 py-1.5 text-sm"} rounded-sm font-bold bg-purple-500 text-white shadow-sm`}>
              <Receipt className={`${hasPanel ? "w-2.5 h-2.5" : "w-3.5 h-3.5"}`} />
              {hasPanel ? "請求済" : "請求済"}
            </span>
          ) : (
            <span className={`inline-flex items-center gap-0.5 ${hasPanel ? "px-1.5 py-0.5 text-xs" : "px-3 py-1.5 text-sm"} rounded-sm font-bold border-2 border-dashed border-slate-200 text-slate-300 bg-slate-50/50`}>
              <Wallet className={`${hasPanel ? "w-2.5 h-2.5" : "w-3.5 h-3.5"}`} />
              {hasPanel ? "入金" : "入金待ち"}
            </span>
          )}

          {/* 滞留警告 */}
          {staleDays > 0 && (
            <span className={`inline-flex items-center gap-0.5 ml-auto ${hasPanel ? "text-xs" : "text-sm"} text-red-600 font-bold`}>
              <AlertTriangle className={`${hasPanel ? "w-2.5 h-2.5" : "w-3.5 h-3.5"}`} />
              {staleDays}日滞留
            </span>
          )}
        </div>
      </div>

      {/* 展開: 個別契約カード群 */}
      {isExpanded && hasMultiple && (
        <div className={`${hasPanel ? "ml-4 pl-2" : "ml-8 pl-4"} border-l-3 border-slate-300 mt-1 space-y-1.5 pt-1.5 pb-1`}>
          {pg.contracts.map((c, ci) => {
            const cConfig = STATUS_CONFIG[c.status]
            const cNextStatus = getNextStatus(c.status)
            const cNextLabel = cNextStatus ? STATUS_CONFIG[cNextStatus]?.label : null
            const cIsActive = activePanelId === c.id

            return (
              <div
                key={c.id}
                onClick={() => openContract(c.id)}
                className={`
                  rounded-sm border-l-[5px] ${cConfig.cardBorder}
                  ${cIsActive ? "ring-2 ring-blue-500 shadow-lg shadow-blue-100 bg-blue-50" : `${cConfig.cardBg} ${cConfig.cardHover}`}
                  border border-slate-200 transition-all cursor-pointer
                  ${hasPanel ? "px-2 py-1.5" : "px-4 py-3"}
                `}
              >
                {/* 1行目: 種別 + 名前 + 金額 */}
                <div className="flex items-center gap-1.5">
                  <span className={`shrink-0 ${hasPanel ? "px-1 py-0 text-[10px]" : "px-2 py-0.5 text-xs"} rounded-sm font-bold ${
                    ci === 0 ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                  }`}>
                    {ci === 0 ? "本工事" : `追加${ci}`}
                  </span>
                  <span className={`${hasPanel ? "text-xs" : "text-base"} font-extrabold text-slate-800 truncate flex-1`}>
                    {c.name || c.estimate?.title || c.estimate?.estimateNumber || "契約"}
                  </span>
                  {!hasPanel && c.contractNumber && (
                    <span className="shrink-0 text-sm text-slate-500 font-mono">{c.contractNumber}</span>
                  )}
                  <span className={`shrink-0 ${hasPanel ? "text-sm" : "text-xl"} font-black ${cConfig.accent} tabular-nums`}>
                    ¥{formatCurrency(c.totalAmount)}
                  </span>
                </div>

                {/* 2行目: ステータスバッジ + 次ステップ */}
                <div className={`flex items-center ${hasPanel ? "gap-1 mt-1" : "gap-1.5 mt-2"} flex-wrap`}>
                  <span className={`inline-flex items-center gap-0.5 ${hasPanel ? "px-1.5 py-0.5 text-xs" : "px-3 py-1.5 text-sm"} rounded-sm font-bold ${cConfig.badgeBg} ${cConfig.badgeText}`}>
                    {cConfig.label}
                  </span>

                  {cNextStatus && !hasPanel && (
                    <>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      {(() => {
                        const cBlock = getGateBlock(cNextStatus, c.gate)
                        return cBlock ? (
                          <span className="inline-flex items-center gap-0.5 px-3 py-1.5 text-sm rounded-sm font-bold border-2 border-dashed border-red-200 text-red-400 bg-red-50/50">
                            <AlertTriangle className="w-3.5 h-3.5" />{cBlock}
                          </span>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); updateStatus(c.id, cNextStatus) }}
                            className="inline-flex items-center gap-0.5 px-3 py-1.5 text-sm rounded-sm font-bold border-2 border-dashed border-blue-300 text-blue-500 bg-blue-50/50 hover:bg-blue-100 hover:border-blue-500 hover:text-blue-700 active:scale-95 transition-all cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />{cNextLabel}にする
                          </button>
                        )
                      })()}
                    </>
                  )}

                  {c.status !== "CANCELLED" && !hasPanel && (
                    <>
                      <div className="flex-1" />
                      <button
                        onClick={(e) => { e.stopPropagation(); updateStatus(c.id, "CANCELLED") }}
                        className="px-2 py-1.5 rounded-sm bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-600 active:scale-95 transition-all"
                        title="キャンセル"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

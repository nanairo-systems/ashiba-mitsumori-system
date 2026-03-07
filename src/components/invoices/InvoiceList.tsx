/**
 * [COMPONENT] 請求管理 - InvoiceList
 *
 * 月別表示の請求管理画面。
 * - 完工処理をしたら、その完工月の請求一覧に表示される
 * - 施工中の契約は完工予定月に「予定」として表示
 * - 会社ごとに締め日ベースでグループ化
 */
"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
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
  Receipt,
  Plus,
  Loader2,
  Search,
  Building2,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  CalendarDays,
  MapPin,
  User,
  ExternalLink,
  Wrench,
  Users,
  Truck,
  FileText,
  Calendar,
  ShieldAlert,
} from "lucide-react"
import { toast } from "sonner"
import {
  format,
  parseISO,
  endOfMonth,
  setDate,
} from "date-fns"
import { ja } from "date-fns/locale"
import type { ContractStatus, InvoiceType, WorkType, EstimateType } from "@prisma/client"

// ─── 型定義 ────────────────────────────────────────────

interface ScheduleInfo {
  id: string
  workType: string
  plannedStartDate: string | null
  plannedEndDate: string | null
  actualStartDate: string | null
  actualEndDate: string | null
  workersCount: number | null
  notes: string | null
}

interface WorkInfo {
  id: string
  workType: WorkType
  workerCount: number | null
  subcontractorName: string | null
}

interface InvoiceInfo {
  id: string
  invoiceNumber: string | null
  invoiceType: InvoiceType
  amount: number
  taxAmount: number
  totalAmount: number
  invoiceDate: string
  dueDate: string | null
  status: string
  paidAmount: number | null
  notes: string | null
}

interface ContractInfo {
  id: string
  contractNumber: string | null
  status: ContractStatus
  contractAmount: number
  taxAmount: number
  totalAmount: number
  contractDate: string
  startDate: string | null
  endDate: string | null
  projectId: string
  projectName: string
  projectAddress: string | null
  companyId: string
  companyName: string
  taxRate: number
  closingDay: number | null
  paymentMonthOffset: number
  paymentPayDay: number | null
  userName: string
  estimateTitle: string | null
  estimateType: EstimateType | null
  works: WorkInfo[]
  schedules: ScheduleInfo[]
  invoices: InvoiceInfo[]
}

interface CompanyGroup {
  companyId: string
  companyName: string
  closingDay: number | null
  paymentMonthOffset: number
  paymentPayDay: number | null
  contracts: ContractInfo[]
  totalAmount: number
  readyToBillCount: number
  inProgressCount: number
}

interface Props {
  contracts: ContractInfo[]
  currentUser: { id: string; name: string }
}

// ─── 定数 ──────────────────────────────────────────────

const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  CONTRACTED: "契約済", SCHEDULE_CREATED: "工程作成済", IN_PROGRESS: "着工",
  COMPLETED: "完工", BILLED: "請求済", PAID: "入金済", CANCELLED: "キャンセル",
}
const CONTRACT_STATUS_STYLE: Record<ContractStatus, string> = {
  CONTRACTED: "bg-blue-50 text-blue-700 border-blue-200",
  SCHEDULE_CREATED: "bg-cyan-50 text-cyan-700 border-cyan-200",
  IN_PROGRESS: "bg-amber-50 text-amber-700 border-amber-200",
  COMPLETED: "bg-green-50 text-green-700 border-green-200",
  BILLED: "bg-purple-50 text-purple-700 border-purple-200",
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-slate-100 text-slate-500 border-slate-200",
}

const WT_LABEL: Record<string, string> = {
  ASSEMBLY: "組立", DISASSEMBLY: "解体", REWORK: "その他",
}
const WT_STYLE: Record<string, string> = {
  ASSEMBLY: "bg-blue-100 text-blue-700 border-blue-200",
  DISASSEMBLY: "bg-amber-100 text-amber-700 border-amber-200",
  REWORK: "bg-slate-100 text-slate-600 border-slate-200",
}

const WORK_TYPE_LABEL: Record<WorkType, string> = {
  INHOUSE: "自社", SUBCONTRACT: "外注",
}

function closingDayLabel(day: number | null): string {
  return day === null ? "末日締め" : `${day}日締め`
}

function getClosingDate(year: number, month: number, closingDay: number | null): Date {
  const base = new Date(year, month - 1, 1)
  if (closingDay === null) return endOfMonth(base)
  const eom = endOfMonth(base)
  const d = closingDay > eom.getDate() ? eom.getDate() : closingDay
  return setDate(base, d)
}

type BillingCategory = "NEED_BILL" | "IN_PROGRESS" | "NOT_STARTED" | "DONE"

function getBillingCategory(c: ContractInfo): BillingCategory {
  const invoiced = c.invoices.reduce((s, i) => s + i.totalAmount, 0)
  if (invoiced >= c.totalAmount) return "DONE"
  if (c.status === "COMPLETED" || c.status === "BILLED" || c.status === "PAID") return "NEED_BILL"
  if (c.status === "IN_PROGRESS") return "IN_PROGRESS"
  return "NOT_STARTED"
}

/**
 * 請求対象月を決定する。
 * - 完工済み: 最終工程の実績終了日の月 → endDateの月 → contractDateの月
 * - 施工中: endDate（完工予定日）の月
 * - 未着工: endDateの月
 */
function getBillingMonth(c: ContractInfo): { year: number; month: number } | null {
  const cat = getBillingCategory(c)

  if (cat === "NEED_BILL") {
    const actualEndDates = c.schedules
      .filter((s) => s.actualEndDate)
      .map((s) => new Date(s.actualEndDate!))
    if (actualEndDates.length > 0) {
      const latest = actualEndDates.reduce((a, b) => a > b ? a : b)
      return { year: latest.getFullYear(), month: latest.getMonth() + 1 }
    }
    if (c.endDate) {
      const d = new Date(c.endDate)
      return { year: d.getFullYear(), month: d.getMonth() + 1 }
    }
    const d = new Date(c.contractDate)
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  }

  if (cat === "IN_PROGRESS") {
    const plannedEndDates = c.schedules
      .filter((s) => s.plannedEndDate)
      .map((s) => new Date(s.plannedEndDate!))
    if (plannedEndDates.length > 0) {
      const latest = plannedEndDates.reduce((a, b) => a > b ? a : b)
      return { year: latest.getFullYear(), month: latest.getMonth() + 1 }
    }
    if (c.endDate) {
      const d = new Date(c.endDate)
      return { year: d.getFullYear(), month: d.getMonth() + 1 }
    }
    return null
  }

  if (c.endDate) {
    const d = new Date(c.endDate)
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  }
  return null
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`
}

function fmtShortDate(d: string | null) {
  if (!d) return null
  return format(parseISO(d), "M/d", { locale: ja })
}

function fmtDate(d: string | null) {
  if (!d) return null
  return format(parseISO(d), "yyyy/M/d", { locale: ja })
}

// ─── メインコンポーネント ───────────────────────────────

export function InvoiceList({ contracts, currentUser }: Props) {
  const router = useRouter()
  const today = new Date()
  const [targetYear, setTargetYear] = useState(today.getFullYear())
  const [targetMonth, setTargetMonth] = useState(today.getMonth() + 1)
  const [search, setSearch] = useState("")
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string> | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [addContractId, setAddContractId] = useState("")
  const [addType, setAddType] = useState<InvoiceType>("FULL")
  const [addAmount, setAddAmount] = useState("")
  const [addDate, setAddDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [addDueDate, setAddDueDate] = useState("")
  const [addNotes, setAddNotes] = useState("")
  const [saving, setSaving] = useState(false)

  // 請求対象の契約（キャンセル・全額請求済みを除外）
  const targetContracts = useMemo(() => {
    return contracts.filter((c) => {
      if (c.status === "CANCELLED") return false
      return getBillingCategory(c) !== "DONE"
    })
  }, [contracts])

  // 月別マップ: monthKey → ContractInfo[]
  const monthMap = useMemo(() => {
    const map = new Map<string, ContractInfo[]>()
    for (const c of targetContracts) {
      const bm = getBillingMonth(c)
      const key = bm ? monthKey(bm.year, bm.month) : "UNSET"
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(c)
    }
    return map
  }, [targetContracts])

  // 3ヶ月分のサマリー（前月、当月、翌月、翌々月）
  const monthSummaries = useMemo(() => {
    const months: { year: number; month: number; key: string; label: string }[] = []
    for (let offset = -1; offset <= 2; offset++) {
      const d = new Date(targetYear, targetMonth - 1 + offset, 1)
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      months.push({ year: y, month: m, key: monthKey(y, m), label: `${m}月` })
    }
    return months.map((mo) => {
      const items = monthMap.get(mo.key) ?? []
      const needBill = items.filter((c) => getBillingCategory(c) === "NEED_BILL")
      const inProgress = items.filter((c) => getBillingCategory(c) === "IN_PROGRESS")
      const total = items.reduce((s, c) => s + c.totalAmount, 0)
      const needBillTotal = needBill.reduce((s, c) => s + c.totalAmount, 0)
      return {
        ...mo,
        count: items.length,
        total,
        needBillCount: needBill.length,
        needBillTotal,
        inProgressCount: inProgress.length,
      }
    })
  }, [targetYear, targetMonth, monthMap])

  // 選択月の契約リスト
  const currentMonthContracts = useMemo(() => {
    const key = monthKey(targetYear, targetMonth)
    return monthMap.get(key) ?? []
  }, [targetYear, targetMonth, monthMap])

  // 日付未定のもの
  const unsetContracts = useMemo(() => monthMap.get("UNSET") ?? [], [monthMap])

  // 検索フィルター適用
  const filteredContracts = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return currentMonthContracts
    return currentMonthContracts.filter((c) =>
      c.projectName.toLowerCase().includes(q) ||
      c.companyName.toLowerCase().includes(q) ||
      (c.projectAddress ?? "").toLowerCase().includes(q)
    )
  }, [currentMonthContracts, search])

  // 会社別グループ化
  const companyGroups = useMemo(() => {
    const map = new Map<string, CompanyGroup>()
    for (const c of filteredContracts) {
      if (!map.has(c.companyId)) {
        map.set(c.companyId, {
          companyId: c.companyId, companyName: c.companyName,
          closingDay: c.closingDay, paymentMonthOffset: c.paymentMonthOffset,
          paymentPayDay: c.paymentPayDay,
          contracts: [], totalAmount: 0,
          readyToBillCount: 0, inProgressCount: 0,
        })
      }
      const g = map.get(c.companyId)!
      g.contracts.push(c)
      g.totalAmount += c.totalAmount
      const cat = getBillingCategory(c)
      if (cat === "NEED_BILL") g.readyToBillCount++
      if (cat === "IN_PROGRESS") g.inProgressCount++
    }
    const groups = Array.from(map.values())
    groups.sort((a, b) => {
      if (a.readyToBillCount !== b.readyToBillCount) return b.readyToBillCount - a.readyToBillCount
      return a.companyName.localeCompare(b.companyName, "ja")
    })
    const catOrder: Record<BillingCategory, number> = { NEED_BILL: 0, IN_PROGRESS: 1, NOT_STARTED: 2, DONE: 3 }
    for (const g of groups) {
      g.contracts.sort((a, b) => catOrder[getBillingCategory(a)] - catOrder[getBillingCategory(b)])
    }
    return groups
  }, [filteredContracts])

  // 当月集計
  const currentSummary = useMemo(() => {
    const needBill = currentMonthContracts.filter((c) => getBillingCategory(c) === "NEED_BILL")
    const inProg = currentMonthContracts.filter((c) => getBillingCategory(c) === "IN_PROGRESS")
    return {
      total: currentMonthContracts.reduce((s, c) => s + c.totalAmount, 0),
      count: currentMonthContracts.length,
      needBillCount: needBill.length,
      needBillTotal: needBill.reduce((s, c) => s + c.totalAmount, 0),
      inProgressCount: inProg.length,
    }
  }, [currentMonthContracts])

  const periodLabel = `${targetYear}年${targetMonth}月`

  function shiftMonth(n: number) {
    const d = new Date(targetYear, targetMonth - 1 + n, 1)
    setTargetYear(d.getFullYear())
    setTargetMonth(d.getMonth() + 1)
  }

  function toggleCompany(id: string) {
    setExpandedCompanies((prev) => {
      const all = new Set(prev === null ? companyGroups.map((g) => g.companyId) : prev)
      if (all.has(id)) all.delete(id); else all.add(id)
      return all
    })
  }

  function expandAll() {
    setExpandedCompanies(null)
  }
  function collapseAll() {
    setExpandedCompanies(new Set())
  }

  function openAddDialog(contractId: string) {
    const c = contracts.find((x) => x.id === contractId)
    if (!c) return
    setAddContractId(contractId)
    setAddType("FULL")
    setAddAmount(String(c.contractAmount))
    setAddDate(format(new Date(), "yyyy-MM-dd"))
    setAddDueDate("")
    setAddNotes("")
    setAddOpen(true)
  }

  const addContract = contracts.find((c) => c.id === addContractId)
  function calcTax() {
    if (!addAmount || !addContract) return 0
    return Math.floor(parseFloat(addAmount) * addContract.taxRate)
  }

  async function handleCreate() {
    if (!addContractId || !addAmount) { toast.error("契約と金額を入力してください"); return }
    const amt = parseFloat(addAmount)
    const tax = calcTax()
    setSaving(true)
    try {
      const res = await fetch("/api/invoices", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId: addContractId, invoiceType: addType,
          amount: amt, taxAmount: tax, totalAmount: amt + tax,
          invoiceDate: addDate, dueDate: addDueDate || null, notes: addNotes.trim() || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "作成に失敗しました")
      toast.success("請求を作成しました")
      setAddOpen(false)
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "エラーが発生しました")
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-purple-600" />
            請求管理
          </h1>
          <p className="text-sm text-slate-500 mt-1">完工月ベースの月別請求一覧 — {currentUser.name} さん</p>
        </div>
      </div>

      {/* 月ナビゲーション + 月別サマリー */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 bg-white border rounded-lg px-3 py-2 flex-shrink-0">
          <Calendar className="w-4 h-4 text-slate-500" />
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => shiftMonth(-1)}>
            <ChevronRightIcon className="w-4 h-4 rotate-180" />
          </Button>
          <span className="text-sm font-bold text-slate-800 w-[100px] text-center">{periodLabel}</span>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => shiftMonth(1)}>
            <ChevronRightIcon className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setTargetYear(today.getFullYear()); setTargetMonth(today.getMonth() + 1) }}>
            今月
          </Button>
        </div>

        {/* 4ヶ月サマリータブ */}
        <div className="flex gap-1.5 flex-1 overflow-x-auto">
          {monthSummaries.map((mo) => {
            const isActive = mo.year === targetYear && mo.month === targetMonth
            const isCurrentRealMonth = mo.year === today.getFullYear() && mo.month === today.getMonth() + 1
            return (
              <button
                key={mo.key}
                onClick={() => { setTargetYear(mo.year); setTargetMonth(mo.month) }}
                className={`flex-1 min-w-[140px] rounded-lg border px-3 py-2 text-left transition-all ${
                  isActive
                    ? "bg-slate-800 text-white border-slate-800 shadow-md"
                    : "bg-white hover:bg-slate-50 border-slate-200"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold ${isActive ? "text-white" : "text-slate-700"}`}>
                    {mo.year === targetYear ? `${mo.month}月` : `${mo.year}/${mo.month}月`}
                  </span>
                  {isCurrentRealMonth && (
                    <span className={`text-[9px] px-1 py-0.5 rounded ${isActive ? "bg-white/20 text-white" : "bg-blue-100 text-blue-600"}`}>今月</span>
                  )}
                  {mo.needBillCount > 0 && (
                    <span className={`text-[9px] px-1 py-0.5 rounded-full font-bold ${isActive ? "bg-red-400 text-white" : "bg-red-100 text-red-600"}`}>
                      {mo.needBillCount}
                    </span>
                  )}
                </div>
                <div className={`text-sm font-mono font-bold mt-0.5 ${isActive ? "text-white" : "text-slate-800"}`}>
                  ¥{formatCurrency(mo.total)}
                </div>
                <div className={`text-[10px] mt-0.5 ${isActive ? "text-slate-300" : "text-slate-400"}`}>
                  {mo.count}件
                  {mo.needBillCount > 0 && <span className={isActive ? " text-red-300" : " text-red-500"}> / 要請求{mo.needBillCount}</span>}
                  {mo.inProgressCount > 0 && <span className={isActive ? " text-amber-300" : " text-amber-500"}> / 予定{mo.inProgressCount}</span>}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 当月アラート */}
      <div className="flex items-center gap-3 flex-wrap">
        {currentSummary.needBillCount > 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            <ShieldAlert className="w-5 h-5 text-red-500" />
            <div>
              <p className="text-sm font-bold text-red-700">要請求: {currentSummary.needBillCount}件（¥{formatCurrency(currentSummary.needBillTotal)}）</p>
              <p className="text-[10px] text-red-500">{periodLabel}に完工済みで未請求の現場</p>
            </div>
          </div>
        )}
        {currentSummary.inProgressCount > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
            <Wrench className="w-4 h-4 text-amber-500" />
            <p className="text-xs text-amber-700">施工中（{periodLabel}完工予定）: <strong>{currentSummary.inProgressCount}件</strong></p>
          </div>
        )}
        {unsetContracts.length > 0 && (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <p className="text-xs text-slate-500">完工日未定: {unsetContracts.length}件</p>
          </div>
        )}
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-3">
            <p className="text-[10px] text-slate-500 mb-0.5">{periodLabel} 請求対象</p>
            <p className="text-base font-bold text-slate-700">{currentSummary.count} 件</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-3">
            <p className="text-[10px] text-slate-500 mb-0.5">{periodLabel} 請求見込額</p>
            <p className="text-base font-bold font-mono text-slate-700">¥{formatCurrency(currentSummary.total)}</p>
          </CardContent>
        </Card>
        <Card className={`${currentSummary.needBillCount > 0 ? "border-red-300 bg-red-50 ring-2 ring-red-200" : "border-slate-200 bg-slate-50"}`}>
          <CardContent className="p-3">
            <p className={`text-[10px] mb-0.5 flex items-center gap-1 ${currentSummary.needBillCount > 0 ? "text-red-600" : "text-slate-500"}`}>
              <ShieldAlert className="w-3 h-3" />要請求（完工済み）
            </p>
            <p className={`text-base font-bold ${currentSummary.needBillCount > 0 ? "text-red-700" : "text-slate-700"}`}>{currentSummary.needBillCount} 件</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-3">
            <p className="text-[10px] text-amber-600 mb-0.5 flex items-center gap-1"><Wrench className="w-3 h-3" />施工中（完工予定）</p>
            <p className="text-base font-bold text-amber-700">{currentSummary.inProgressCount} 件</p>
          </CardContent>
        </Card>
      </div>

      {/* 検索・操作バー */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="会社名・現場名・住所で検索" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={expandAll}>全展開</Button>
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={collapseAll}>全閉じる</Button>
        </div>
      </div>

      {/* 会社別一覧 */}
      {companyGroups.length === 0 ? (
        <div className="bg-white rounded-xl border py-16 text-center text-slate-400">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>{periodLabel}の請求対象はありません</p>
          <p className="text-xs mt-1">他の月を確認するか、完工処理をしてください</p>
        </div>
      ) : (
        <div className="space-y-3">
          {companyGroups.map((group) => {
            const isExpanded = expandedCompanies === null || expandedCompanies.has(group.companyId)
            const closingLabel = closingDayLabel(group.closingDay)
            const closingDate = getClosingDate(targetYear, targetMonth, group.closingDay)
            const payDayLabel = group.paymentPayDay === null ? "末日" : `${group.paymentPayDay}日`
            const payMonthLabel = group.paymentMonthOffset === 1 ? "翌月" : group.paymentMonthOffset === 2 ? "翌々月" : `${group.paymentMonthOffset}ヶ月後`

            return (
              <div key={group.companyId} className={`bg-white rounded-xl border overflow-hidden shadow-sm ${group.readyToBillCount > 0 ? "ring-2 ring-red-200" : ""}`}>
                <button
                  onClick={() => toggleCompany(group.companyId)}
                  className="w-full flex items-center gap-2 px-4 py-3 bg-slate-800 text-white text-left hover:bg-slate-700 transition-colors"
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4 flex-shrink-0" /> : <ChevronRightIcon className="w-4 h-4 flex-shrink-0" />}
                  <Building2 className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  <span className="font-semibold">{group.companyName}</span>

                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-slate-600 text-[10px] font-medium text-slate-200">
                    <Calendar className="w-2.5 h-2.5" />
                    {closingLabel}
                  </span>
                  <span className="text-[10px] text-slate-400">支払: {payMonthLabel}{payDayLabel}</span>

                  {group.readyToBillCount > 0 && (
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold animate-pulse">
                      <ShieldAlert className="w-2.5 h-2.5" />{group.readyToBillCount}件 要請求
                    </span>
                  )}
                  {group.inProgressCount > 0 && (
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                      <Wrench className="w-2.5 h-2.5" />{group.inProgressCount}件 完工予定
                    </span>
                  )}

                  <div className="ml-auto flex items-center gap-4 text-xs text-slate-300 flex-shrink-0">
                    <span>¥{formatCurrency(group.totalAmount)}</span>
                    <span>{group.contracts.length}件</span>
                  </div>
                </button>

                {isExpanded && (
                  <div>
                    <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <strong>{periodLabel}</strong> 締め日: <strong>{format(closingDate, "M月d日")}</strong>
                      </span>
                      <span className="text-slate-400">|</span>
                      <span>{closingLabel} → {payMonthLabel}{payDayLabel}払い</span>
                      {group.readyToBillCount > 0 && (
                        <>
                          <span className="text-slate-400">|</span>
                          <span className="text-red-600 font-bold">⚠ {group.readyToBillCount}件が要請求</span>
                        </>
                      )}
                    </div>

                    <div className="divide-y divide-slate-100">
                      {group.contracts.map((c) => {
                        const cat = getBillingCategory(c)
                        const allActualDone = c.schedules.length > 0 && c.schedules.every((s) => s.actualEndDate)
                        const invoicedTotal = c.invoices.reduce((s, i) => s + i.totalAmount, 0)
                        const remaining = c.totalAmount - invoicedTotal

                        return (
                          <div key={c.id} className={`${cat === "NEED_BILL" ? "bg-red-50/40 border-l-4 border-l-red-400" : cat === "IN_PROGRESS" ? "bg-amber-50/20 border-l-4 border-l-amber-300" : ""}`}>
                            <div className="px-4 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {cat === "NEED_BILL" ? (
                                      <ShieldAlert className="w-4 h-4 flex-shrink-0 text-red-600" />
                                    ) : cat === "IN_PROGRESS" ? (
                                      <Wrench className="w-4 h-4 flex-shrink-0 text-amber-600" />
                                    ) : (
                                      <Clock className="w-4 h-4 flex-shrink-0 text-slate-400" />
                                    )}
                                    <Link href={`/contracts/${c.id}`} className="text-sm font-bold text-slate-800 hover:text-blue-600 hover:underline">
                                      {c.projectName}
                                    </Link>
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${CONTRACT_STATUS_STYLE[c.status]}`}>
                                      {CONTRACT_STATUS_LABEL[c.status]}
                                    </span>
                                    {cat === "NEED_BILL" && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-red-600 bg-red-50">要請求</span>
                                    )}
                                    {cat === "IN_PROGRESS" && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-amber-600 bg-amber-50">完工予定</span>
                                    )}
                                    {c.estimateType === "ADDITIONAL" && (
                                      <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-medium">追加工事</span>
                                    )}
                                    {c.contractNumber && <span className="text-[10px] text-slate-400 font-mono">{c.contractNumber}</span>}
                                    <Link href={`/contracts/${c.id}`} className="text-slate-400 hover:text-blue-500">
                                      <ExternalLink className="w-3 h-3" />
                                    </Link>
                                  </div>

                                  <div className="flex items-center gap-3 mt-1.5 ml-6 flex-wrap text-[11px] text-slate-500">
                                    {c.projectAddress && (
                                      <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3 text-slate-400" />{c.projectAddress}</span>
                                    )}
                                    {c.estimateTitle && (
                                      <span className="flex items-center gap-0.5"><FileText className="w-3 h-3 text-slate-400" />{c.estimateTitle}</span>
                                    )}
                                    <span className="flex items-center gap-0.5"><User className="w-3 h-3 text-slate-400" />{c.userName}</span>
                                    {c.startDate && <span className="text-slate-400">工期: {fmtShortDate(c.startDate)}〜{c.endDate ? fmtShortDate(c.endDate) : ""}</span>}
                                  </div>

                                  {c.works.length > 0 && (
                                    <div className="flex items-center gap-1.5 mt-1.5 ml-6">
                                      <Wrench className="w-3 h-3 text-slate-400" />
                                      {c.works.map((w) => (
                                        <span key={w.id} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium border ${
                                          w.workType === "INHOUSE" ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-orange-50 text-orange-700 border-orange-200"
                                        }`}>
                                          {w.workType === "INHOUSE" ? (
                                            <><Users className="w-2.5 h-2.5" />{WORK_TYPE_LABEL[w.workType]}{w.workerCount ? ` ${w.workerCount}人` : ""}</>
                                          ) : (
                                            <><Truck className="w-2.5 h-2.5" />{w.subcontractorName ?? "外注"}</>
                                          )}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  <div className="mt-2 ml-6">
                                    {c.schedules.length > 0 ? (
                                      <div className="space-y-1">
                                        {c.schedules.map((s) => {
                                          const done = !!s.actualEndDate
                                          return (
                                            <div key={s.id} className="flex items-center gap-2 text-[11px]">
                                              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-medium border ${done ? "bg-green-50 text-green-700 border-green-200" : WT_STYLE[s.workType]}`}>
                                                {done && <CheckCircle2 className="w-2.5 h-2.5" />}
                                                {WT_LABEL[s.workType]}
                                              </span>
                                              <span className="text-slate-500">
                                                <CalendarDays className="w-3 h-3 inline mr-0.5" />
                                                予定: {s.plannedStartDate ? fmtShortDate(s.plannedStartDate) : "—"} 〜 {s.plannedEndDate ? fmtShortDate(s.plannedEndDate) : "—"}
                                              </span>
                                              {(s.actualStartDate || s.actualEndDate) && (
                                                <span className={done ? "text-green-600" : "text-blue-600"}>
                                                  実績: {s.actualStartDate ? fmtShortDate(s.actualStartDate) : "—"} 〜 {s.actualEndDate ? fmtShortDate(s.actualEndDate) : "進行中"}
                                                </span>
                                              )}
                                              {s.workersCount && <span className="text-slate-400">{s.workersCount}人</span>}
                                            </div>
                                          )
                                        })}
                                        {allActualDone && (
                                          <span className="inline-flex items-center gap-0.5 text-[10px] text-green-600 font-semibold">
                                            <CheckCircle2 className="w-3 h-3" />全工程完了
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-slate-300 flex items-center gap-0.5">
                                        <CalendarDays className="w-3 h-3" />工程未登録
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                  <p className="text-sm font-mono font-bold text-slate-800">¥{formatCurrency(c.totalAmount)}</p>
                                  {invoicedTotal > 0 && remaining > 0 && (
                                    <p className="text-[10px] text-orange-600 font-medium">未請求残: ¥{formatCurrency(remaining)}</p>
                                  )}
                                  {cat === "NEED_BILL" && remaining > 0 && (
                                    <Button size="sm" className="text-xs gap-1 h-7 mt-1 bg-red-600 hover:bg-red-700" onClick={() => openAddDialog(c.id)}>
                                      <Plus className="w-3 h-3" />請求作成
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 新規請求ダイアログ */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="w-4 h-4" />請求を作成</DialogTitle>
            <DialogDescription>
              {addContract && <span>{addContract.companyName} / {addContract.projectName}</span>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {addContract && (
              <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">契約金額（税込）</span><span className="font-mono font-bold">¥{formatCurrency(addContract.totalAmount)}</span></div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>請求パターン</Label>
              <Select value={addType} onValueChange={(v) => {
                setAddType(v as InvoiceType)
                if (v === "FULL" && addContract) setAddAmount(String(addContract.contractAmount))
                else setAddAmount("")
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL">一括請求</SelectItem>
                  <SelectItem value="ASSEMBLY">組立分</SelectItem>
                  <SelectItem value="DISASSEMBLY">解体分</SelectItem>
                  <SelectItem value="PROGRESS">出来高</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>請求金額（税抜）<span className="text-red-500">*</span></Label>
              <Input type="number" min={0} value={addAmount} onChange={(e) => setAddAmount(e.target.value)} />
              {addAmount && addContract && (
                <p className="text-xs text-slate-500">
                  消費税: ¥{formatCurrency(calcTax())} / 合計: ¥{formatCurrency(parseFloat(addAmount) + calcTax())}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>請求日<span className="text-red-500">*</span></Label>
                <Input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>支払期日</Label>
                <Input type="date" value={addDueDate} onChange={(e) => setAddDueDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>備考</Label>
              <Input value={addNotes} onChange={(e) => setAddNotes(e.target.value)} placeholder="任意" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>キャンセル</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />作成中...</> : "作成する"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

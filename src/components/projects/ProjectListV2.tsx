/**
 * [COMPONENT] 商談一覧 v2 - カラフルブロック型 + 元の全情報量
 *
 * 元のバージョンの情報量をすべて維持しつつ、
 * 大きな文字・カラフルなカードブロックで直感的に表示する。
 */
"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { formatCurrency, formatDate, formatRelativeDate } from "@/lib/utils"
import { toast } from "sonner"
import {
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Loader2,
  X,
  ArrowLeft,
  Archive,
  EyeOff,
  RotateCcw,
  Trash2,
  HandshakeIcon,
  CheckSquare,
  Square,
  CalendarDays,
  CalendarPlus,
  CalendarCheck,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { EstimateDetail } from "@/components/estimates/EstimateDetail"
import { ContractProcessingDialog } from "@/components/contracts/ContractProcessingDialog"
import type { ContractEstimateItem } from "@/components/contracts/contract-types"
import type { EstimateStatus } from "@prisma/client"

// ─── 型定義 ────────────────────────────────────────────

interface EstimateRow {
  id: string
  title: string | null
  estimateType: string
  status: EstimateStatus
  isArchived: boolean
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  templates: any[]
}

// ─── ステータス設定 ──────────────────────────────────────

type StatusFilter = EstimateStatus | "ALL"

const STATUS_BLOCK: Record<EstimateStatus, {
  label: string
  cardBg: string
  cardBorder: string
  cardHover: string
  badgeBg: string
  badgeText: string
  accent: string
}> = {
  DRAFT: {
    label: "下書き",
    cardBg: "bg-gradient-to-r from-amber-50 to-orange-50",
    cardBorder: "border-l-amber-400",
    cardHover: "hover:from-amber-100 hover:to-orange-100",
    badgeBg: "bg-amber-500",
    badgeText: "text-white",
    accent: "text-amber-600",
  },
  CONFIRMED: {
    label: "確定済",
    cardBg: "bg-gradient-to-r from-blue-50 to-indigo-50",
    cardBorder: "border-l-blue-500",
    cardHover: "hover:from-blue-100 hover:to-indigo-100",
    badgeBg: "bg-blue-500",
    badgeText: "text-white",
    accent: "text-blue-600",
  },
  SENT: {
    label: "送付済",
    cardBg: "bg-gradient-to-r from-emerald-50 to-green-50",
    cardBorder: "border-l-emerald-500",
    cardHover: "hover:from-emerald-100 hover:to-green-100",
    badgeBg: "bg-emerald-500",
    badgeText: "text-white",
    accent: "text-emerald-600",
  },
  OLD: {
    label: "旧版",
    cardBg: "bg-slate-50",
    cardBorder: "border-l-slate-300",
    cardHover: "hover:bg-slate-100",
    badgeBg: "bg-slate-400",
    badgeText: "text-white",
    accent: "text-slate-500",
  },
}

// ─── メインコンポーネント ───────────────────────────────

export function ProjectListV2({ projects, currentUser, templates }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [showArchived, setShowArchived] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const [collapsedCompanies, setCollapsedCompanies] = useState<Set<string>>(new Set())
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set())

  // 見積詳細パネル
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [estimateData, setEstimateData] = useState<any | null>(null)
  const [estimateLoading, setEstimateLoading] = useState(false)

  // チェックボックス（契約処理用）
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())

  // 契約ダイアログ
  const [contractOpen, setContractOpen] = useState(false)
  const [contractItems, setContractItems] = useState<ContractEstimateItem[]>([])
  const [contractMode, setContractMode] = useState<"individual" | "consolidated">("individual")

  // 削除・非表示ダイアログ
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteName, setDeleteName] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [hideId, setHideId] = useState<string | null>(null)
  const [hideName, setHideName] = useState("")
  const [hiding, setHiding] = useState(false)

  // 担当者フィルター
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())

  // 担当者一覧
  const allUsers = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of projects) {
      for (const est of p.estimates) {
        if (!map.has(est.user.id)) map.set(est.user.id, est.user.name)
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [projects])

  // サマリー
  const summary = useMemo(() => {
    let draft = 0, confirmed = 0, sent = 0
    for (const p of projects) {
      for (const e of p.estimates) {
        if (e.isArchived) continue
        if (e.status === "DRAFT") draft++
        if (e.status === "CONFIRMED") confirmed++
        if (e.status === "SENT") sent++
      }
    }
    return { draft, confirmed, sent, total: draft + confirmed + sent }
  }, [projects])

  // フィルター
  const filtered = useMemo(() => {
    let result = projects

    // アーカイブ
    result = result.filter((p) => showArchived ? p.isArchived : !p.isArchived)

    // 検索
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.branch.company.name.toLowerCase().includes(q) ||
          (p.address && p.address.toLowerCase().includes(q)) ||
          (p.contact?.name && p.contact.name.toLowerCase().includes(q))
      )
    }

    // ステータスフィルター
    if (statusFilter !== "ALL") {
      result = result
        .map((p) => ({
          ...p,
          estimates: p.estimates.filter((e) => e.status === statusFilter),
        }))
        .filter((p) => p.estimates.length > 0)
    }

    // 担当者フィルター
    if (selectedUsers.size > 0) {
      result = result
        .map((p) => ({
          ...p,
          estimates: p.estimates.filter((e) => selectedUsers.has(e.user.id)),
        }))
        .filter((p) => p.estimates.length > 0)
    }

    return result
  }, [projects, search, statusFilter, showArchived, selectedUsers])

  // 会社別グループ化
  const grouped = useMemo(() => {
    const map = new Map<string, { companyId: string; companyName: string; projects: Project[] }>()
    for (const p of filtered) {
      const cid = p.branch.company.id
      if (!map.has(cid)) {
        map.set(cid, { companyId: cid, companyName: p.branch.company.name, projects: [] })
      }
      map.get(cid)!.projects.push(p)
    }
    return Array.from(map.values())
  }, [filtered])

  const toggleCompany = useCallback((companyId: string) => {
    setCollapsedCompanies((prev) => {
      const next = new Set(prev)
      if (next.has(companyId)) next.delete(companyId)
      else next.add(companyId)
      return next
    })
  }, [])

  const toggleProject = useCallback((projectId: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
  }, [])

  const toggleCheck = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleUser = useCallback((userId: string) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }, [])

  // 見積詳細
  const openEstimate = useCallback(async (estimateId: string) => {
    setSelectedEstimateId(estimateId)
    setEstimateLoading(true)
    try {
      const res = await fetch(`/api/estimates/${estimateId}`)
      if (!res.ok) throw new Error("取得に失敗しました")
      setEstimateData(await res.json())
    } catch {
      toast.error("見積の取得に失敗しました")
      setSelectedEstimateId(null)
    } finally {
      setEstimateLoading(false)
    }
  }, [])

  const closeEstimate = useCallback(() => {
    setSelectedEstimateId(null)
    setEstimateData(null)
  }, [])

  const refreshEstimate = useCallback(async () => {
    if (!selectedEstimateId) return
    try {
      const res = await fetch(`/api/estimates/${selectedEstimateId}`)
      if (res.ok) setEstimateData(await res.json())
    } catch { /* ignore */ }
  }, [selectedEstimateId])

  // アーカイブ
  const handleArchive = useCallback(async (projectId: string) => {
    if (!confirm("この現場を失注としてアーカイブしますか？")) return
    const res = await fetch(`/api/projects/${projectId}/archive`, { method: "PATCH" })
    if (res.ok) { toast.success("アーカイブしました"); router.refresh() }
    else toast.error("失敗しました")
  }, [router])

  // 削除
  const handleDelete = useCallback(async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/estimates/${deleteId}`, { method: "DELETE" })
      if (res.ok) {
        toast.success("見積を削除しました")
        setDeleteId(null)
        if (selectedEstimateId === deleteId) { setSelectedEstimateId(null); setEstimateData(null) }
        router.refresh()
      } else toast.error("削除に失敗しました")
    } catch { toast.error("削除に失敗しました") }
    finally { setDeleting(false) }
  }, [deleteId, selectedEstimateId, router])

  // 非表示
  const handleHide = useCallback(async () => {
    if (!hideId) return
    setHiding(true)
    try {
      const res = await fetch(`/api/estimates/${hideId}/archive`, { method: "POST" })
      if (res.ok) {
        toast.success("非表示にしました")
        setHideId(null)
        if (selectedEstimateId === hideId) { setSelectedEstimateId(null); setEstimateData(null) }
        router.refresh()
      } else toast.error("失敗しました")
    } catch { toast.error("失敗しました") }
    finally { setHiding(false) }
  }, [hideId, selectedEstimateId, router])

  // 復元
  const handleRestore = useCallback(async (estimateId: string) => {
    try {
      const res = await fetch(`/api/estimates/${estimateId}/archive`, { method: "DELETE" })
      if (res.ok) { toast.success("復元しました"); router.refresh() }
      else toast.error("失敗しました")
    } catch { toast.error("失敗しました") }
  }, [router])

  // 契約処理を開く
  const openContract = useCallback((est: EstimateRow, project: Project) => {
    const taxRate = project.branch.company.taxRate
    setContractItems([{
      estimateId: est.id,
      estimateName: est.title ?? "見積",
      projectId: project.id,
      projectName: project.name,
      companyName: project.branch.company.name,
      taxExcludedAmount: Math.round(est.totalAmount / (1 + taxRate)),
      taxRate,
    }])
    setContractMode("individual")
    setContractOpen(true)
  }, [])

  // 一括契約
  const checkedItems = useMemo((): ContractEstimateItem[] => {
    const result: ContractEstimateItem[] = []
    for (const p of projects) {
      for (const est of p.estimates) {
        if (!checkedIds.has(est.id)) continue
        const taxRate = p.branch.company.taxRate
        result.push({
          estimateId: est.id,
          estimateName: est.title ?? "見積",
          projectId: p.id,
          projectName: p.name,
          companyName: p.branch.company.name,
          taxExcludedAmount: Math.round(est.totalAmount / (1 + taxRate)),
          taxRate,
        })
      }
    }
    return result
  }, [checkedIds, projects])

  // Escキー
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return
      if (checkedIds.size > 0) { setCheckedIds(new Set()); return }
      if (selectedEstimateId) { closeEstimate(); return }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [checkedIds, selectedEstimateId, closeEstimate])

  const hasPanel = selectedEstimateId !== null

  return (
    <>
      <div className="flex gap-0 h-full">
        {/* ── 一覧パネル ── */}
        <div className={`${hasPanel ? "w-[500px] shrink-0 border-r border-slate-200" : "flex-1"} overflow-y-auto max-h-[calc(100vh-4rem)]`}>
          <div className={`${hasPanel ? "p-4" : "p-6 max-w-5xl mx-auto"} space-y-4`}>

            {/* ヘッダー */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className={`${hasPanel ? "text-xl" : "text-3xl"} font-extrabold text-slate-900`}>商談一覧</h1>
                {!hasPanel && <p className="text-base text-slate-500 mt-0.5">{currentUser.name} さん</p>}
              </div>
              <button
                onClick={() => router.push("/projects/new")}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-blue-600 text-white font-bold text-base hover:bg-blue-700 active:bg-blue-800 transition-all shadow-lg shadow-blue-200 active:scale-95"
              >
                <Plus className="w-5 h-5 stroke-[2.5]" />
                新規作成
              </button>
            </div>

            {/* サマリーバー */}
            <div className={`grid ${hasPanel ? "grid-cols-3" : "grid-cols-4"} gap-3`}>
              {!hasPanel && (
                <SummaryCard
                  count={summary.total} label="全件"
                  active={statusFilter === "ALL"}
                  onClick={() => setStatusFilter("ALL")}
                  colors={{ activeBg: "bg-slate-800", activeText: "text-white", activeShadow: "", inactiveBg: "border-slate-200 bg-white", inactiveNum: "text-slate-800", inactiveLabel: "text-slate-500" }}
                />
              )}
              <SummaryCard
                count={summary.draft} label="下書き"
                active={statusFilter === "DRAFT"}
                onClick={() => setStatusFilter(statusFilter === "DRAFT" ? "ALL" : "DRAFT")}
                colors={{ activeBg: "bg-amber-500 border-amber-400", activeText: "text-white", activeShadow: "shadow-amber-200", inactiveBg: "border-amber-200 bg-amber-50", inactiveNum: "text-amber-600", inactiveLabel: "text-amber-500" }}
              />
              <SummaryCard
                count={summary.confirmed} label="確定済"
                active={statusFilter === "CONFIRMED"}
                onClick={() => setStatusFilter(statusFilter === "CONFIRMED" ? "ALL" : "CONFIRMED")}
                colors={{ activeBg: "bg-blue-500 border-blue-400", activeText: "text-white", activeShadow: "shadow-blue-200", inactiveBg: "border-blue-200 bg-blue-50", inactiveNum: "text-blue-600", inactiveLabel: "text-blue-500" }}
              />
              <SummaryCard
                count={summary.sent} label="送付済"
                active={statusFilter === "SENT"}
                onClick={() => setStatusFilter(statusFilter === "SENT" ? "ALL" : "SENT")}
                colors={{ activeBg: "bg-emerald-500 border-emerald-400", activeText: "text-white", activeShadow: "shadow-emerald-200", inactiveBg: "border-emerald-200 bg-emerald-50", inactiveNum: "text-emerald-600", inactiveLabel: "text-emerald-500" }}
              />
            </div>

            {/* 検索バー */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="会社名・現場名・住所・担当者で検索"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-10 py-3.5 rounded-2xl border-2 border-slate-200 text-base font-medium placeholder:text-slate-400 focus:outline-none focus:border-blue-400 transition-all bg-white"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-slate-100">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              )}
            </div>

            {/* フィルター行 */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* 担当者フィルター */}
              {allUsers.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-slate-500 mr-1">担当</span>
                  {allUsers.map(({ id, name }) => {
                    const active = selectedUsers.has(id)
                    return (
                      <button
                        key={id}
                        onClick={() => toggleUser(id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all active:scale-95 ${
                          active
                            ? "bg-indigo-500 text-white shadow-md"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {name.slice(0, 3)}
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="flex-1" />

              {/* 失注表示 */}
              <button
                onClick={() => setShowArchived(!showArchived)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  showArchived ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                <Archive className="w-4 h-4 inline mr-1" />
                失注
              </button>

              {/* 非表示見積 */}
              <button
                onClick={() => setShowHidden(!showHidden)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  showHidden ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                <EyeOff className="w-4 h-4 inline mr-1" />
                非表示
              </button>
            </div>

            {/* アクティブフィルター表示 */}
            {(statusFilter !== "ALL" || search || selectedUsers.size > 0) && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">{filtered.length}件表示</span>
                <button
                  onClick={() => { setStatusFilter("ALL"); setSearch(""); setSelectedUsers(new Set()) }}
                  className="text-sm text-blue-600 font-bold hover:underline"
                >
                  リセット
                </button>
              </div>
            )}

            {/* 一覧 */}
            {filtered.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-xl font-bold text-slate-400 mb-2">
                  {search || statusFilter !== "ALL" ? "条件に一致する商談がありません" : "商談がありません"}
                </p>
                {(search || statusFilter !== "ALL" || selectedUsers.size > 0) && (
                  <button
                    onClick={() => { setSearch(""); setStatusFilter("ALL"); setSelectedUsers(new Set()) }}
                    className="mt-4 px-6 py-3 rounded-2xl bg-slate-100 text-base font-bold text-slate-600 hover:bg-slate-200 active:scale-95 transition-all"
                  >
                    絞り込みを解除
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {grouped.map(({ companyId, companyName, projects: companyProjects }) => {
                  const isCollapsed = collapsedCompanies.has(companyId)
                  const visibleCount = companyProjects.reduce(
                    (s, p) => s + p.estimates.filter((e) => showHidden || !e.isArchived).length, 0
                  )
                  const companyTotal = companyProjects.reduce(
                    (s, p) => s + p.estimates.filter((e) => !e.isArchived).reduce((a, e) => a + e.totalAmount, 0), 0
                  )

                  return (
                    <div key={companyId} className="rounded-2xl overflow-hidden shadow-sm">
                      {/* 会社ヘッダー */}
                      <button
                        onClick={() => toggleCompany(companyId)}
                        className="w-full flex items-center gap-3 px-5 py-4 bg-slate-800 text-white text-left hover:bg-slate-700 active:bg-slate-900 transition-colors"
                      >
                        {isCollapsed
                          ? <ChevronRight className="w-6 h-6 shrink-0" />
                          : <ChevronDown className="w-6 h-6 shrink-0" />
                        }
                        <span className={`${hasPanel ? "text-base" : "text-lg"} font-bold truncate flex-1`}>{companyName}</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm text-slate-400">{companyProjects.length}現場 {visibleCount}件</span>
                          {!hasPanel && companyTotal > 0 && (
                            <span className="text-base font-bold text-white tabular-nums">¥{formatCurrency(companyTotal)}</span>
                          )}
                        </div>
                      </button>

                      {/* 現場群 */}
                      {!isCollapsed && (
                        <div className="bg-slate-50 border border-t-0 border-slate-200 rounded-b-2xl divide-y divide-slate-200">
                          {companyProjects.map((project) => (
                            <SiteBlock
                              key={project.id}
                              project={project}
                              onEstimateClick={openEstimate}
                              selectedEstimateId={selectedEstimateId}
                              hasPanel={hasPanel}
                              showHidden={showHidden}
                              collapsedProjects={collapsedProjects}
                              toggleProject={toggleProject}
                              checkedIds={checkedIds}
                              toggleCheck={toggleCheck}
                              onArchive={handleArchive}
                              onContract={openContract}
                              onDelete={(id, name) => { setDeleteId(id); setDeleteName(name) }}
                              onHide={(id, name) => { setHideId(id); setHideName(name) }}
                              onRestore={handleRestore}
                              router={router}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── チェック済みバー ── */}
        {checkedIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-2xl shadow-2xl px-6 py-3 flex items-center gap-4">
            <span className="text-base font-bold">{checkedIds.size}件選択中</span>
            <button
              onClick={() => { setContractItems(checkedItems); setContractMode("consolidated"); setContractOpen(true) }}
              className="px-5 py-2 rounded-xl bg-green-500 text-white font-bold text-sm hover:bg-green-600 active:scale-95 transition-all"
            >
              一括契約
            </button>
            <button
              onClick={() => setCheckedIds(new Set())}
              className="px-4 py-2 rounded-xl bg-slate-700 text-slate-300 font-bold text-sm hover:bg-slate-600 transition-colors"
            >
              解除
            </button>
          </div>
        )}

        {/* ── 見積詳細パネル ── */}
        {hasPanel && (
          <div className="flex-1 overflow-y-auto max-h-[calc(100vh-4rem)] bg-white">
            {estimateLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : estimateData ? (
              <div>
                <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-5 py-3">
                  <button
                    onClick={closeEstimate}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-base font-bold text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                    戻る
                  </button>
                </div>
                <EstimateDetail
                  estimate={estimateData.estimate}
                  taxRate={estimateData.taxRate}
                  units={estimateData.units}
                  contacts={estimateData.contacts}
                  currentUser={currentUser}
                  embedded
                  onRefresh={() => { refreshEstimate(); router.refresh() }}
                  onClose={closeEstimate}
                />
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* ── ダイアログ群 ── */}
      <ContractProcessingDialog
        open={contractOpen}
        onOpenChange={setContractOpen}
        items={contractItems}
        mode={contractMode}
        onCompleted={() => { setCheckedIds(new Set()); router.refresh() }}
      />

      <Dialog open={!!deleteId} onOpenChange={(v) => { if (!v) setDeleteId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>見積を削除</DialogTitle>
            <DialogDescription>「{deleteName}」を削除します。取り消せません。</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>キャンセル</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}削除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!hideId} onOpenChange={(v) => { if (!v) setHideId(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>見積を非表示</DialogTitle>
            <DialogDescription>「{hideName}」を非表示にします。いつでも元に戻せます。</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setHideId(null)} disabled={hiding}>キャンセル</Button>
            <Button className="bg-orange-600 hover:bg-orange-700 text-white" onClick={handleHide} disabled={hiding}>
              {hiding && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}非表示
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── サマリーカード ─────────────────────────────────────

function SummaryCard({
  count, label, active, onClick, colors,
}: {
  count: number
  label: string
  active: boolean
  onClick: () => void
  colors: { activeBg: string; activeText: string; activeShadow: string; inactiveBg: string; inactiveNum: string; inactiveLabel: string }
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl p-4 border-2 transition-all active:scale-95 ${
        active
          ? `${colors.activeBg} ${colors.activeText} shadow-lg ${colors.activeShadow}`
          : `${colors.inactiveBg} hover:opacity-80`
      }`}
    >
      <div className={`text-3xl font-black tabular-nums ${active ? colors.activeText : colors.inactiveNum}`}>{count}</div>
      <div className={`text-sm font-bold mt-1 ${active ? "opacity-70" : colors.inactiveLabel}`}>{label}</div>
    </button>
  )
}

// ─── 現場ブロック ──────────────────────────────────────

function SiteBlock({
  project, onEstimateClick, selectedEstimateId, hasPanel,
  showHidden, collapsedProjects, toggleProject,
  checkedIds, toggleCheck,
  onArchive, onContract, onDelete, onHide, onRestore, router,
}: {
  project: Project
  onEstimateClick: (id: string) => void
  selectedEstimateId: string | null
  hasPanel: boolean
  showHidden: boolean
  collapsedProjects: Set<string>
  toggleProject: (id: string) => void
  checkedIds: Set<string>
  toggleCheck: (id: string) => void
  onArchive: (id: string) => void
  onContract: (est: EstimateRow, project: Project) => void
  onDelete: (id: string, name: string) => void
  onHide: (id: string, name: string) => void
  onRestore: (id: string) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  router: any
}) {
  const visibleEstimates = project.estimates.filter((e) => showHidden || !e.isArchived)
  const totalAmount = visibleEstimates.filter((e) => !e.isArchived).reduce((sum, e) => sum + e.totalAmount, 0)
  const isCollapsed = collapsedProjects.has(project.id)

  return (
    <div className={`${hasPanel ? "px-3 py-3" : "px-4 py-4"}`}>
      {/* ── 現場ヘッダー（全体クリックで展開/折りたたみ） ── */}
      <div
        onClick={() => toggleProject(project.id)}
        className="bg-white rounded-xl border-2 border-slate-300 px-4 py-3 shadow-sm cursor-pointer hover:bg-slate-50 active:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          {/* 展開アイコン */}
          {visibleEstimates.length > 0 && (
            <div className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center ${
              isCollapsed
                ? "bg-slate-200 text-slate-600"
                : "bg-blue-500 text-white"
            }`}>
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          )}

          {/* 現場名 + 支店 */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h3 className={`${hasPanel ? "text-base" : "text-lg"} font-extrabold text-slate-900 leading-tight truncate`}>
              {project.name}
            </h3>
            {project.branch.name !== "本社" && (
              <span className="shrink-0 px-2 py-0.5 rounded-md bg-slate-200 text-xs font-bold text-slate-600">
                {project.branch.name}
              </span>
            )}
          </div>

          {/* 日付（コンパクト） */}
          <span className={`shrink-0 ${hasPanel ? "text-xs" : "text-sm"} text-slate-500 font-medium tabular-nums`}>
            {formatDate(project.createdAt, "yyyy/M/d")} 立上
          </span>

          {/* 件数 */}
          <span className="shrink-0 px-2.5 py-1 rounded-lg bg-blue-100 text-blue-700 text-sm font-bold">
            {visibleEstimates.length}件
          </span>

          {/* アクションボタン（stopPropagationで現場クリックと独立） */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); router.push(`/projects/${project.id}`) }}
              className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold hover:bg-slate-200 active:scale-95 transition-all"
            >
              詳細
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); router.push(`/projects/${project.id}?newEstimate=1`) }}
              className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-sm font-bold hover:bg-blue-600 active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5 inline mr-0.5" />見積追加
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onArchive(project.id) }}
              className="px-2 py-1.5 rounded-lg bg-slate-100 text-slate-400 hover:bg-orange-100 hover:text-orange-600 active:scale-95 transition-all"
              title="失注アーカイブ"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 住所・担当（1行にまとめる） */}
        <div className={`flex items-center gap-3 mt-1 ml-10 ${hasPanel ? "text-xs" : "text-sm"} text-slate-500`}>
          {project.address ? (
            <span className="truncate max-w-[300px]">{project.address}</span>
          ) : (
            <span className="text-amber-500 font-medium">住所未設定</span>
          )}
          <span className="text-slate-300">|</span>
          <span className="font-medium">{project.contact?.name ?? "担当未設定"}</span>
        </div>
      </div>

      {/* ── 見積ブロック群（左線でぶら下がり表現） ── */}
      {!isCollapsed && visibleEstimates.length > 0 && (
        <div className={`${hasPanel ? "ml-6" : "ml-8"} border-l-3 border-slate-300 pl-4 mt-1 space-y-2 pt-2 pb-1`}>
          {visibleEstimates.map((est, idx) => {
            const displayName = est.title ?? (visibleEstimates.length === 1 ? "見積" : `見積 ${idx + 1}`)
            const config = STATUS_BLOCK[est.status]
            const isSelected = selectedEstimateId === est.id
            const isChecked = checkedIds.has(est.id)
            const checkable = est.status === "CONFIRMED" || est.status === "SENT"
            const isHidden = est.isArchived

            // 非表示見積
            if (isHidden) {
              return (
                <div key={est.id} className="flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-100 border border-slate-200 opacity-60">
                  <EyeOff className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-400 truncate flex-1">{displayName}</span>
                  <button
                    onClick={() => onRestore(est.id)}
                    className="px-3 py-1.5 rounded-lg text-sm font-bold bg-blue-100 text-blue-600 hover:bg-blue-200 active:scale-95 transition-all"
                  >
                    復元
                  </button>
                </div>
              )
            }

            return (
              <div
                key={est.id}
                onClick={() => onEstimateClick(est.id)}
                className={`
                  rounded-xl border-l-[5px] ${config.cardBorder}
                  ${isSelected ? "ring-2 ring-blue-400 shadow-lg shadow-blue-100 bg-white" : `${config.cardBg} ${config.cardHover}`}
                  ${isChecked ? "ring-2 ring-green-400 shadow-md" : ""}
                  border border-slate-200 transition-all cursor-pointer
                  ${hasPanel ? "px-3 py-2.5" : "px-4 py-3"}
                `}
              >
                {/* 1行目: 見積名 + 金額 + 担当者 + 作成日 */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className={`${hasPanel ? "text-sm" : "text-base"} font-extrabold text-slate-800 truncate`}>
                      {displayName}
                    </span>
                    {est.estimateType === "ADDITIONAL" && (
                      <span className="shrink-0 px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 border border-amber-300 text-xs font-bold">
                        追加
                      </span>
                    )}
                  </div>

                  {/* 担当者 */}
                  <span className={`shrink-0 px-3 py-1 rounded-lg ${hasPanel ? "text-xs" : "text-sm"} font-bold bg-indigo-100 text-indigo-700`}>
                    {est.user.name}
                  </span>

                  {/* 作成日 */}
                  <span className={`shrink-0 ${hasPanel ? "text-xs" : "text-sm"} text-slate-500 font-medium tabular-nums`}>
                    {formatDate(est.createdAt, "M/d")} 作成
                  </span>

                  {/* 金額 */}
                  <span className={`shrink-0 ${hasPanel ? "text-lg" : "text-xl"} font-black ${config.accent} tabular-nums`}>
                    ¥{formatCurrency(est.totalAmount)}
                  </span>
                </div>

                {/* 2行目: ステップ進行バー + アクション */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {/* STEP 1: 確定 */}
                  {est.status === "DRAFT" ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold border-2 border-dashed border-amber-300 text-amber-400 bg-amber-50/50">
                      <CalendarCheck className="w-3.5 h-3.5" />
                      確定待ち
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold bg-blue-500 text-white shadow-sm">
                      <CalendarCheck className="w-3.5 h-3.5" />
                      {est.confirmedAt ? `${formatDate(est.confirmedAt, "M/d")} 確定` : "確定済"}
                    </span>
                  )}

                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />

                  {/* STEP 2: 送付 */}
                  {est.status === "SENT" ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold bg-emerald-500 text-white shadow-sm">
                      送付済
                    </span>
                  ) : est.status === "CONFIRMED" ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold border-2 border-dashed border-blue-300 text-blue-400 bg-blue-50/50">
                      未送付
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold border-2 border-dashed border-slate-200 text-slate-300 bg-slate-50/50">
                      送付
                    </span>
                  )}

                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />

                  {/* STEP 3: 契約処理 */}
                  {checkable ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); onContract(est, project) }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold border-2 border-dashed border-green-400 text-green-500 bg-green-50/50 hover:bg-green-100 hover:border-green-500 hover:text-green-700 active:scale-95 transition-all cursor-pointer"
                    >
                      <HandshakeIcon className="w-3.5 h-3.5" />
                      契約へ進む
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold border-2 border-dashed border-slate-200 text-slate-300 bg-slate-50/50">
                      <HandshakeIcon className="w-3.5 h-3.5" />
                      契約
                    </span>
                  )}

                  <div className="flex-1" />

                  {/* チェックボックス */}
                  {checkable && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleCheck(est.id) }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all active:scale-95 ${
                        isChecked
                          ? "bg-green-100 text-green-700 border-2 border-green-400"
                          : "bg-slate-100 text-slate-500 border border-slate-200 hover:bg-green-50 hover:text-green-600"
                      }`}
                    >
                      {isChecked
                        ? <><CheckSquare className="w-3.5 h-3.5 inline mr-0.5" />選択中</>
                        : <><Square className="w-3.5 h-3.5 inline mr-0.5" />選択</>
                      }
                    </button>
                  )}

                  {/* 削除 or 非表示 */}
                  {est.status === "DRAFT" ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(est.id, displayName) }}
                      className="px-2 py-1.5 rounded-lg bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-600 active:scale-95 transition-all"
                      title="削除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); onHide(est.id, displayName) }}
                      className="px-2 py-1.5 rounded-lg bg-slate-100 text-slate-400 hover:bg-orange-100 hover:text-orange-600 active:scale-95 transition-all"
                      title="非表示"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {/* 合計 */}
          {visibleEstimates.filter((e) => !e.isArchived).length >= 2 && (
            <div className="flex justify-end py-1">
              <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-slate-800 ${hasPanel ? "text-sm" : "text-sm"}`}>
                <span className="text-slate-400 font-medium">合計</span>
                <span className="text-white font-black tabular-nums">¥{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

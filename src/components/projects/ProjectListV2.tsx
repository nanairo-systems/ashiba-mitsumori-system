/**
 * [COMPONENT] 商談一覧 v2 - カラフルブロック型デザイン
 *
 * 設計方針:
 * - 各見積をステータス色の独立したブロックカードで表示
 * - 色で直感的にステータスがわかる（下書き=オレンジ, 確定=ブルー, 送付済=グリーン）
 * - 大きな文字・広いタップ領域
 * - 現場情報（住所・担当者・日付）も適度に表示
 * - サマリーバーでステータス別件数を一目で把握
 * - 既存ページとは完全に独立したデザイン
 */
"use client"

import { useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { formatCurrency, formatDate } from "@/lib/utils"
import { toast } from "sonner"
import {
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Loader2,
  X,
  ArrowLeft,
} from "lucide-react"
import { EstimateDetail } from "@/components/estimates/EstimateDetail"
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
  pillBg: string
  pillText: string
  pillActiveBg: string
  pillActiveText: string
}> = {
  DRAFT: {
    label: "下書き",
    cardBg: "bg-gradient-to-r from-amber-50 to-orange-50",
    cardBorder: "border-l-amber-400",
    cardHover: "hover:from-amber-100 hover:to-orange-100",
    badgeBg: "bg-amber-500",
    badgeText: "text-white",
    accent: "text-amber-600",
    pillBg: "bg-amber-50 border-amber-200 text-amber-700",
    pillText: "text-amber-700",
    pillActiveBg: "bg-amber-500 border-amber-500",
    pillActiveText: "text-white",
  },
  CONFIRMED: {
    label: "確定済",
    cardBg: "bg-gradient-to-r from-blue-50 to-indigo-50",
    cardBorder: "border-l-blue-500",
    cardHover: "hover:from-blue-100 hover:to-indigo-100",
    badgeBg: "bg-blue-500",
    badgeText: "text-white",
    accent: "text-blue-600",
    pillBg: "bg-blue-50 border-blue-200 text-blue-700",
    pillText: "text-blue-700",
    pillActiveBg: "bg-blue-500 border-blue-500",
    pillActiveText: "text-white",
  },
  SENT: {
    label: "送付済",
    cardBg: "bg-gradient-to-r from-emerald-50 to-green-50",
    cardBorder: "border-l-emerald-500",
    cardHover: "hover:from-emerald-100 hover:to-green-100",
    badgeBg: "bg-emerald-500",
    badgeText: "text-white",
    accent: "text-emerald-600",
    pillBg: "bg-emerald-50 border-emerald-200 text-emerald-700",
    pillText: "text-emerald-700",
    pillActiveBg: "bg-emerald-500 border-emerald-500",
    pillActiveText: "text-white",
  },
  OLD: {
    label: "旧版",
    cardBg: "bg-slate-50",
    cardBorder: "border-l-slate-300",
    cardHover: "hover:bg-slate-100",
    badgeBg: "bg-slate-400",
    badgeText: "text-white",
    accent: "text-slate-500",
    pillBg: "bg-slate-50 border-slate-200 text-slate-500",
    pillText: "text-slate-500",
    pillActiveBg: "bg-slate-500 border-slate-500",
    pillActiveText: "text-white",
  },
}

// ─── メインコンポーネント ───────────────────────────────

export function ProjectListV2({ projects, currentUser, templates }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [collapsedCompanies, setCollapsedCompanies] = useState<Set<string>>(new Set())

  // 見積詳細パネル
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [estimateData, setEstimateData] = useState<any | null>(null)
  const [estimateLoading, setEstimateLoading] = useState(false)

  // サマリー集計
  const summary = useMemo(() => {
    let draft = 0, confirmed = 0, sent = 0, totalAmount = 0
    for (const p of projects) {
      for (const e of p.estimates) {
        if (e.isArchived) continue
        if (e.status === "DRAFT") draft++
        if (e.status === "CONFIRMED") confirmed++
        if (e.status === "SENT") sent++
        totalAmount += e.totalAmount
      }
    }
    return { draft, confirmed, sent, total: draft + confirmed + sent, totalAmount }
  }, [projects])

  // フィルター
  const filtered = useMemo(() => {
    let result = projects
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
    if (statusFilter !== "ALL") {
      result = result
        .map((p) => ({
          ...p,
          estimates: p.estimates.filter((e) => !e.isArchived && e.status === statusFilter),
        }))
        .filter((p) => p.estimates.length > 0)
    }
    return result
  }, [projects, search, statusFilter])

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

  // 見積詳細
  const openEstimate = useCallback(async (estimateId: string) => {
    setSelectedEstimateId(estimateId)
    setEstimateLoading(true)
    try {
      const res = await fetch(`/api/estimates/${estimateId}`)
      if (!res.ok) throw new Error("取得に失敗しました")
      const data = await res.json()
      setEstimateData(data)
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
      if (!res.ok) return
      const data = await res.json()
      setEstimateData(data)
    } catch { /* ignore */ }
  }, [selectedEstimateId])

  const hasPanel = selectedEstimateId !== null

  return (
    <div className="flex gap-0 h-full">
      {/* ── 一覧パネル ── */}
      <div className={`${hasPanel ? "w-[480px] shrink-0 border-r border-slate-200 overflow-y-auto max-h-[calc(100vh-4rem)]" : "flex-1 overflow-y-auto max-h-[calc(100vh-4rem)]"}`}>
        <div className={`${hasPanel ? "p-4" : "p-6 max-w-5xl mx-auto"} space-y-5`}>

          {/* ── ヘッダー ── */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`${hasPanel ? "text-xl" : "text-3xl"} font-extrabold text-slate-900`}>
                商談一覧
              </h1>
              {!hasPanel && (
                <p className="text-base text-slate-500 mt-1">{currentUser.name} さん</p>
              )}
            </div>
            <button
              onClick={() => router.push("/projects/new")}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-blue-600 text-white font-bold text-base hover:bg-blue-700 active:bg-blue-800 transition-all shadow-lg shadow-blue-200 active:scale-95"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
              新規作成
            </button>
          </div>

          {/* ── サマリーバー ── */}
          <div className={`grid ${hasPanel ? "grid-cols-3" : "grid-cols-4"} gap-3`}>
            {/* 全体 */}
            {!hasPanel && (
              <button
                onClick={() => setStatusFilter("ALL")}
                className={`rounded-2xl p-4 border-2 transition-all active:scale-95 ${
                  statusFilter === "ALL"
                    ? "border-slate-800 bg-slate-800 text-white shadow-lg"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className={`text-3xl font-black tabular-nums ${statusFilter === "ALL" ? "text-white" : "text-slate-800"}`}>
                  {summary.total}
                </div>
                <div className={`text-sm font-bold mt-1 ${statusFilter === "ALL" ? "text-slate-300" : "text-slate-500"}`}>
                  全件
                </div>
              </button>
            )}
            {/* 下書き */}
            <button
              onClick={() => setStatusFilter(statusFilter === "DRAFT" ? "ALL" : "DRAFT")}
              className={`rounded-2xl p-4 border-2 transition-all active:scale-95 ${
                statusFilter === "DRAFT"
                  ? "border-amber-400 bg-amber-500 text-white shadow-lg shadow-amber-200"
                  : "border-amber-200 bg-amber-50 hover:border-amber-300"
              }`}
            >
              <div className={`text-3xl font-black tabular-nums ${statusFilter === "DRAFT" ? "text-white" : "text-amber-600"}`}>
                {summary.draft}
              </div>
              <div className={`text-sm font-bold mt-1 ${statusFilter === "DRAFT" ? "text-amber-100" : "text-amber-500"}`}>
                下書き
              </div>
            </button>
            {/* 確定済 */}
            <button
              onClick={() => setStatusFilter(statusFilter === "CONFIRMED" ? "ALL" : "CONFIRMED")}
              className={`rounded-2xl p-4 border-2 transition-all active:scale-95 ${
                statusFilter === "CONFIRMED"
                  ? "border-blue-400 bg-blue-500 text-white shadow-lg shadow-blue-200"
                  : "border-blue-200 bg-blue-50 hover:border-blue-300"
              }`}
            >
              <div className={`text-3xl font-black tabular-nums ${statusFilter === "CONFIRMED" ? "text-white" : "text-blue-600"}`}>
                {summary.confirmed}
              </div>
              <div className={`text-sm font-bold mt-1 ${statusFilter === "CONFIRMED" ? "text-blue-100" : "text-blue-500"}`}>
                確定済
              </div>
            </button>
            {/* 送付済 */}
            <button
              onClick={() => setStatusFilter(statusFilter === "SENT" ? "ALL" : "SENT")}
              className={`rounded-2xl p-4 border-2 transition-all active:scale-95 ${
                statusFilter === "SENT"
                  ? "border-emerald-400 bg-emerald-500 text-white shadow-lg shadow-emerald-200"
                  : "border-emerald-200 bg-emerald-50 hover:border-emerald-300"
              }`}
            >
              <div className={`text-3xl font-black tabular-nums ${statusFilter === "SENT" ? "text-white" : "text-emerald-600"}`}>
                {summary.sent}
              </div>
              <div className={`text-sm font-bold mt-1 ${statusFilter === "SENT" ? "text-emerald-100" : "text-emerald-500"}`}>
                送付済
              </div>
            </button>
          </div>

          {/* ── 検索 ── */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="会社名・現場名・住所・担当者で検索"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-10 py-3.5 rounded-2xl border-2 border-slate-200 text-base font-medium placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:shadow-lg focus:shadow-blue-100 transition-all bg-white"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            )}
          </div>

          {/* ── フィルター状態表示 ── */}
          {(statusFilter !== "ALL" || search) && (
            <div className="flex items-center gap-2 flex-wrap">
              {statusFilter !== "ALL" && (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold border ${STATUS_BLOCK[statusFilter].pillActiveBg} ${STATUS_BLOCK[statusFilter].pillActiveText}`}>
                  {STATUS_BLOCK[statusFilter].label}のみ表示
                  <button onClick={() => setStatusFilter("ALL")} className="ml-1 hover:opacity-70">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}
              {search && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-slate-600 text-white border border-slate-600">
                  「{search}」
                  <button onClick={() => setSearch("")} className="ml-1 hover:opacity-70">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}
              <span className="text-sm text-slate-500 ml-1">
                {filtered.length}件
              </span>
            </div>
          )}

          {/* ── 一覧 ── */}
          {filtered.length === 0 ? (
            <div className="py-20 text-center">
              <div className="text-6xl mb-4">
                {search ? "🔍" : "📋"}
              </div>
              <p className="text-xl font-bold text-slate-400 mb-2">
                {search ? "見つかりません" : "商談がありません"}
              </p>
              <p className="text-base text-slate-400 mb-6">
                {search ? `「${search}」に一致する商談がありません` : "新規作成から商談を追加してください"}
              </p>
              {(search || statusFilter !== "ALL") && (
                <button
                  onClick={() => { setSearch(""); setStatusFilter("ALL") }}
                  className="px-6 py-3 rounded-2xl bg-slate-100 text-base font-bold text-slate-600 hover:bg-slate-200 transition-colors active:scale-95"
                >
                  絞り込みを解除
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {grouped.map(({ companyId, companyName, projects: companyProjects }) => {
                const isCollapsed = collapsedCompanies.has(companyId)
                const visibleCount = companyProjects.reduce(
                  (s, p) => s + p.estimates.filter((e) => !e.isArchived).length, 0
                )
                const companyTotal = companyProjects.reduce(
                  (s, p) => s + p.estimates.filter((e) => !e.isArchived).reduce((a, e) => a + e.totalAmount, 0), 0
                )

                return (
                  <div key={companyId} className="rounded-2xl overflow-hidden shadow-sm">
                    {/* 会社名ヘッダー */}
                    <button
                      onClick={() => toggleCompany(companyId)}
                      className="w-full flex items-center gap-3 px-5 py-4 bg-slate-800 text-white text-left hover:bg-slate-700 active:bg-slate-900 transition-colors"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-6 h-6 shrink-0" />
                      ) : (
                        <ChevronDown className="w-6 h-6 shrink-0" />
                      )}
                      <span className={`${hasPanel ? "text-base" : "text-lg"} font-bold truncate flex-1`}>
                        {companyName}
                      </span>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-base text-slate-300">
                          {companyProjects.length}現場 {visibleCount}件
                        </span>
                        {!hasPanel && companyTotal > 0 && (
                          <span className="text-base font-bold text-white tabular-nums">
                            ¥{formatCurrency(companyTotal)}
                          </span>
                        )}
                      </div>
                    </button>

                    {/* 現場カード群 */}
                    {!isCollapsed && (
                      <div className="bg-slate-50 border border-t-0 border-slate-200 rounded-b-2xl">
                        {companyProjects.map((project, pIdx) => (
                          <SiteBlock
                            key={project.id}
                            project={project}
                            onEstimateClick={openEstimate}
                            selectedEstimateId={selectedEstimateId}
                            hasPanel={hasPanel}
                            isLast={pIdx === companyProjects.length - 1}
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

      {/* ── 見積詳細パネル ── */}
      {hasPanel && (
        <div className="flex-1 overflow-y-auto max-h-[calc(100vh-4rem)] bg-white">
          {estimateLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : estimateData ? (
            <div>
              <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-5 py-3 flex items-center gap-3">
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
  )
}

// ─── 現場ブロック ──────────────────────────────────────

function SiteBlock({
  project,
  onEstimateClick,
  selectedEstimateId,
  hasPanel,
  isLast,
}: {
  project: Project
  onEstimateClick: (id: string) => void
  selectedEstimateId: string | null
  hasPanel: boolean
  isLast: boolean
}) {
  const visibleEstimates = project.estimates.filter((e) => !e.isArchived)
  const totalAmount = visibleEstimates.reduce((sum, e) => sum + e.totalAmount, 0)

  return (
    <div className={`${hasPanel ? "px-3 py-3" : "px-5 py-5"} ${!isLast ? "border-b border-slate-200" : ""}`}>
      {/* 現場ヘッダー */}
      <div className="mb-3">
        <h3 className={`${hasPanel ? "text-base" : "text-xl"} font-extrabold text-slate-800 leading-tight`}>
          {project.name}
        </h3>
        <div className={`flex items-center gap-3 mt-1.5 ${hasPanel ? "text-xs" : "text-sm"} text-slate-500 flex-wrap`}>
          {project.address && (
            <span className="truncate max-w-[300px]">{project.address}</span>
          )}
          {project.contact && (
            <span className="font-medium">担当: {project.contact.name}</span>
          )}
          <span>{formatDate(project.createdAt, "M月d日")}登録</span>
        </div>
      </div>

      {/* 見積ブロック群（積み重なるカード） */}
      <div className="space-y-2">
        {visibleEstimates.map((est, idx) => {
          const displayName = est.title ?? (visibleEstimates.length === 1 ? "見積" : `見積 ${idx + 1}`)
          const config = STATUS_BLOCK[est.status]
          const isSelected = selectedEstimateId === est.id

          return (
            <button
              key={est.id}
              onClick={() => onEstimateClick(est.id)}
              className={`
                w-full text-left rounded-xl border-l-4 ${config.cardBorder}
                ${isSelected
                  ? "ring-2 ring-blue-400 shadow-lg shadow-blue-100 bg-white"
                  : `${config.cardBg} ${config.cardHover}`
                }
                border border-slate-200 transition-all active:scale-[0.99]
                ${hasPanel ? "p-3" : "p-4"}
              `}
            >
              {/* 上段: ステータス + 見積名 + 担当者 */}
              <div className="flex items-center gap-2.5 mb-2">
                <span className={`shrink-0 px-3 py-1 rounded-lg ${hasPanel ? "text-xs" : "text-sm"} font-extrabold ${config.badgeBg} ${config.badgeText}`}>
                  {config.label}
                </span>
                <span className={`flex-1 ${hasPanel ? "text-sm" : "text-base"} font-bold text-slate-800 truncate`}>
                  {displayName}
                </span>
                <span className={`shrink-0 ${hasPanel ? "text-xs" : "text-sm"} text-slate-400`}>
                  {est.user.name}
                </span>
              </div>

              {/* 下段: 金額 + 日付 */}
              <div className="flex items-end justify-between">
                <span className={`${hasPanel ? "text-lg" : "text-2xl"} font-black ${config.accent} tabular-nums leading-none`}>
                  ¥{formatCurrency(est.totalAmount)}
                </span>
                <span className={`${hasPanel ? "text-xs" : "text-sm"} text-slate-400`}>
                  {est.confirmedAt
                    ? `${formatDate(est.confirmedAt, "M/d")}確定`
                    : `${formatDate(est.createdAt, "M/d")}作成`
                  }
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* 合計（2件以上） */}
      {visibleEstimates.length >= 2 && (
        <div className={`mt-3 flex justify-end ${hasPanel ? "pr-1" : "pr-2"}`}>
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 ${hasPanel ? "text-sm" : "text-base"}`}>
            <span className="text-slate-400 font-medium">合計</span>
            <span className="text-white font-black tabular-nums">¥{formatCurrency(totalAmount)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

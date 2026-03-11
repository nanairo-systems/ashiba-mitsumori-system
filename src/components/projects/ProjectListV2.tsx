/**
 * [COMPONENT] 商談一覧 v2 - シンプル・大文字版
 *
 * 設計方針:
 * - 大きな文字・ボタンで誰でも使いやすく
 * - 不要な装飾・アイコン・情報を排除
 * - カード型レイアウトで直感的に
 * - 必要最小限: 会社名、現場名、ステータス、金額
 */
"use client"

import { useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { formatCurrency } from "@/lib/utils"
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

// ─── 定数 ──────────────────────────────────────────────

const STATUS_CONFIG: Record<EstimateStatus, { label: string; bg: string; text: string }> = {
  DRAFT:     { label: "下書き", bg: "bg-amber-100", text: "text-amber-800" },
  CONFIRMED: { label: "確定済", bg: "bg-blue-100", text: "text-blue-800" },
  SENT:      { label: "送付済", bg: "bg-emerald-100", text: "text-emerald-800" },
  OLD:       { label: "旧版",   bg: "bg-slate-100", text: "text-slate-500" },
}

// ─── メインコンポーネント ───────────────────────────────

export function ProjectListV2({ projects, currentUser, templates }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [collapsedCompanies, setCollapsedCompanies] = useState<Set<string>>(new Set())

  // 見積詳細パネル
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [estimateData, setEstimateData] = useState<any | null>(null)
  const [estimateLoading, setEstimateLoading] = useState(false)

  // フィルター後のプロジェクト
  const filtered = useMemo(() => {
    if (!search.trim()) return projects
    const q = search.toLowerCase()
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.branch.company.name.toLowerCase().includes(q)
    )
  }, [projects, search])

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

  // 見積詳細を開く
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

  // 見積パネルが開いている場合は2カラム表示
  const hasPanel = selectedEstimateId !== null

  return (
    <div className="flex gap-0 h-full">
      {/* ── 一覧パネル ── */}
      <div className={`${hasPanel ? "w-[420px] shrink-0 border-r border-slate-200 overflow-y-auto max-h-[calc(100vh-4rem)]" : "flex-1"}`}>
        <div className={`${hasPanel ? "p-4" : "p-6 max-w-4xl mx-auto"} space-y-5`}>
          {/* ヘッダー */}
          <div className="flex items-center justify-between">
            <h1 className={`${hasPanel ? "text-xl" : "text-3xl"} font-bold text-slate-900`}>
              商談一覧
            </h1>
            <button
              onClick={() => router.push("/projects/new")}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white font-bold text-base hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5" />
              新規作成
            </button>
          </div>

          {/* 検索 */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="会社名・現場名で検索"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-10 py-3.5 rounded-xl border-2 border-slate-200 text-base placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            )}
          </div>

          {/* 件数表示 */}
          <div className="text-base text-slate-500">
            {filtered.length}件の商談
          </div>

          {/* 一覧 */}
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-lg text-slate-400 mb-6">
                {search ? `「${search}」に一致する商談がありません` : "商談がありません"}
              </p>
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="px-6 py-3 rounded-xl bg-slate-100 text-base text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  検索をクリア
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {grouped.map(({ companyId, companyName, projects: companyProjects }) => {
                const isCollapsed = collapsedCompanies.has(companyId)
                const totalEstimates = companyProjects.reduce((s, p) => s + p.estimates.filter(e => !e.isArchived).length, 0)

                return (
                  <div key={companyId} className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                    {/* 会社名ヘッダー */}
                    <button
                      onClick={() => toggleCompany(companyId)}
                      className="w-full flex items-center gap-3 px-5 py-4 bg-slate-800 text-white text-left hover:bg-slate-700 active:bg-slate-900 transition-colors"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-5 h-5 shrink-0" />
                      ) : (
                        <ChevronDown className="w-5 h-5 shrink-0" />
                      )}
                      <span className="text-lg font-bold truncate flex-1">{companyName}</span>
                      <span className="text-base text-slate-300 shrink-0">
                        {companyProjects.length}現場・{totalEstimates}件
                      </span>
                    </button>

                    {/* 現場一覧 */}
                    {!isCollapsed && (
                      <div className="divide-y divide-slate-100">
                        {companyProjects.map((project) => (
                          <ProjectCard
                            key={project.id}
                            project={project}
                            onEstimateClick={openEstimate}
                            selectedEstimateId={selectedEstimateId}
                            hasPanel={hasPanel}
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
              <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
                <button
                  onClick={closeEstimate}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-base font-medium text-slate-600 hover:bg-slate-100 transition-colors"
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

// ─── 現場カード ────────────────────────────────────────

function ProjectCard({
  project,
  onEstimateClick,
  selectedEstimateId,
  hasPanel,
}: {
  project: Project
  onEstimateClick: (id: string) => void
  selectedEstimateId: string | null
  hasPanel: boolean
}) {
  const router = useRouter()
  const visibleEstimates = project.estimates.filter((e) => !e.isArchived)

  // 現場全体の最高ステータスを判定
  const topStatus: EstimateStatus | null = useMemo(() => {
    if (visibleEstimates.some((e) => e.status === "SENT")) return "SENT"
    if (visibleEstimates.some((e) => e.status === "CONFIRMED")) return "CONFIRMED"
    if (visibleEstimates.some((e) => e.status === "DRAFT")) return "DRAFT"
    return null
  }, [visibleEstimates])

  // 現場全体の合計金額
  const totalAmount = useMemo(() => {
    return visibleEstimates.reduce((sum, e) => sum + e.totalAmount, 0)
  }, [visibleEstimates])

  return (
    <div className={`${hasPanel ? "px-4 py-3" : "px-5 py-4"}`}>
      {/* 現場名行 */}
      <div className="flex items-center gap-3 mb-3">
        <h3 className={`${hasPanel ? "text-base" : "text-lg"} font-bold text-slate-800 flex-1 leading-snug`}>
          {project.name}
        </h3>
        {topStatus && (
          <span className={`shrink-0 px-3 py-1 rounded-lg text-sm font-bold ${STATUS_CONFIG[topStatus].bg} ${STATUS_CONFIG[topStatus].text}`}>
            {STATUS_CONFIG[topStatus].label}
          </span>
        )}
      </div>

      {/* 見積一覧 */}
      <div className="space-y-2">
        {visibleEstimates.map((est, idx) => {
          const displayName = est.title ?? (visibleEstimates.length === 1 ? "見積" : `見積${idx + 1}`)
          const config = STATUS_CONFIG[est.status]
          const isSelected = selectedEstimateId === est.id

          return (
            <button
              key={est.id}
              onClick={() => onEstimateClick(est.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all active:scale-[0.99] ${
                isSelected
                  ? "border-blue-500 bg-blue-50 shadow-sm"
                  : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
              }`}
            >
              {/* ステータスバッジ */}
              <span className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-bold ${config.bg} ${config.text}`}>
                {config.label}
              </span>

              {/* 見積名 */}
              <span className={`flex-1 ${hasPanel ? "text-sm" : "text-base"} font-medium text-slate-700 truncate`}>
                {displayName}
              </span>

              {/* 金額 */}
              <span className={`shrink-0 ${hasPanel ? "text-base" : "text-lg"} font-bold text-slate-900 tabular-nums`}>
                ¥{formatCurrency(est.totalAmount)}
              </span>
            </button>
          )
        })}
      </div>

      {/* 現場の合計（見積が2件以上ある場合のみ） */}
      {visibleEstimates.length >= 2 && (
        <div className="mt-2 flex justify-end">
          <span className={`${hasPanel ? "text-sm" : "text-base"} font-bold text-slate-500`}>
            合計 ¥{formatCurrency(totalAmount)}
          </span>
        </div>
      )}
    </div>
  )
}

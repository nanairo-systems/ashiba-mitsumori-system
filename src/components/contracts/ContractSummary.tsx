"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts"
import { cn, formatYen, formatDate } from "@/lib/utils"
import { Building2, TrendingUp, FileText, Calendar, X, ExternalLink, Loader2, ChevronRight, Wallet } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { useIsMobile } from "@/hooks/use-mobile"

interface ContractRow {
  id: string
  contractDate: string
  contractAmount: number
  taxAmount: number
  totalAmount: number
  name: string | null
  projectName: string | null
  companyId: string
  companyName: string
}

// スライドオーバーパネルで表示する契約詳細データ
interface PanelContractData {
  id: string
  contractNumber: string | null
  name: string | null
  contractDate: string
  contractAmount: number
  taxAmount: number
  totalAmount: number
  status: string
  project: {
    id: string
    name: string
    address: string | null
    branch: {
      name: string
      company: { id: string; name: string; phone: string | null }
    }
    contact: { name: string; phone: string | null; email: string | null } | null
  }
  estimate: {
    id: string
    estimateNumber: string | null
    user: { id: string; name: string }
    sections: Array<{
      id: string
      name: string
      groups: Array<{
        id: string
        name: string
        items: Array<{
          id: string
          name: string
          quantity: number
          unitPrice: number
          unit: { name: string }
        }>
      }>
    }>
  } | null
  contractEstimates: Array<{
    id: string
    estimate: {
      id: string
      estimateNumber: string | null
      title: string | null
      user: { id: string; name: string }
    }
  }>
}

interface Props {
  contracts: ContractRow[]
}

const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]

function formatDateFull(iso: string) {
  return formatDate(iso, "yyyy/MM/dd")
}

// カスタムツールチップ
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-3 text-sm">
        <p className="font-bold text-slate-700 mb-1">{label}</p>
        <p className="text-blue-600 font-mono">{formatYen(payload[0].value)}</p>
        <p className="text-slate-500 text-xs">{payload[0].payload.count}件</p>
      </div>
    )
  }
  return null
}

// ステータスラベル
const STATUS_LABEL: Record<string, string> = {
  CONTRACTED: "契約",
  SCHEDULE_CREATED: "工程作成済",
  IN_PROGRESS: "施工中",
  COMPLETED: "完工",
  BILLED: "請求済",
  PAID: "入金済",
  CANCELLED: "キャンセル",
}
const STATUS_STYLE: Record<string, string> = {
  CONTRACTED: "bg-blue-100 text-blue-700",
  SCHEDULE_CREATED: "bg-indigo-100 text-indigo-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  BILLED: "bg-purple-100 text-purple-700",
  PAID: "bg-green-100 text-green-700",
  CANCELLED: "bg-slate-100 text-slate-400",
}

// ─── 契約プレビューパネル ────────────────────────────────────

interface ContractPanelProps {
  data: PanelContractData | null
  loading: boolean
  onClose: () => void
}

function ContractPanel({ data, loading, onClose }: ContractPanelProps) {
  // ESCキーで閉じる
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  return (
    <>
      {/* オーバーレイ */}
      <div
        className="fixed inset-0 z-40 bg-black/30 md:bg-black/20"
        onClick={onClose}
      />

      {/* パネル本体 */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <h2 className="text-base font-bold text-slate-800">契約詳細</h2>
          <div className="flex items-center gap-2">
            {data && (
              <Link
                href={`/contracts/${data.id}`}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                詳細ページへ
              </Link>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              <span className="ml-2 text-sm text-slate-500">読み込み中...</span>
            </div>
          ) : !data ? (
            <div className="flex items-center justify-center h-40 text-sm text-slate-400">
              データを取得できませんでした
            </div>
          ) : (
            <div className="p-4 space-y-4">

              {/* 基本情報 */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-slate-600 mb-0.5">会社 / 支店</p>
                    <p className="text-sm font-bold text-slate-800">{data.project.branch.company.name}</p>
                    <p className="text-xs text-slate-500">{data.project.branch.name}</p>
                  </div>
                  {data.status && (
                    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full shrink-0", STATUS_STYLE[data.status] ?? "bg-slate-100 text-slate-500")}>
                      {STATUS_LABEL[data.status] ?? data.status}
                    </span>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <p className="text-xs text-slate-600 mb-0.5">現場名</p>
                  <p className="text-sm font-medium text-slate-700">{data.project.name}</p>
                  {data.project.address && (
                    <p className="text-xs text-slate-600 mt-0.5">{data.project.address}</p>
                  )}
                </div>

                {data.contractNumber && (
                  <div className="pt-2 border-t border-slate-200">
                    <p className="text-xs text-slate-600 mb-0.5">契約番号</p>
                    <p className="text-sm font-mono text-slate-600">{data.contractNumber}</p>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200">
                  <div>
                    <p className="text-xs text-slate-600 mb-0.5">契約日</p>
                    <p className="text-sm text-slate-700">{formatDateFull(data.contractDate)}</p>
                  </div>
                </div>
              </div>

              {/* 金額 */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-500">契約金額</p>
                </div>
                <div className="px-4 py-3 space-y-2 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>税抜金額</span>
                    <span className="font-mono">{formatYen(data.contractAmount)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>消費税</span>
                    <span className="font-mono">{formatYen(data.taxAmount)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-800 pt-2 border-t border-slate-100">
                    <span>税込合計</span>
                    <span className="font-mono text-blue-600">{formatYen(data.totalAmount)}</span>
                  </div>
                </div>
              </div>

              {/* 見積内訳（単体契約の場合） */}
              {data.estimate && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-blue-500" />
                      <p className="text-xs font-semibold text-slate-500">見積内訳</p>
                    </div>
                    {data.estimate.estimateNumber && (
                      <span className="text-xs text-slate-600 font-mono">{data.estimate.estimateNumber}</span>
                    )}
                  </div>
                  <div className="divide-y divide-slate-50">
                    {data.estimate.sections.map((section) => {
                      const sectionTotal = section.groups.reduce((st, grp) =>
                        st + grp.items.reduce((it, item) => it + item.quantity * item.unitPrice, 0), 0
                      )
                      return (
                        <div key={section.id}>
                          {/* セクションヘッダー */}
                          <div className="flex items-center justify-between px-4 py-2 bg-slate-50/80">
                            <span className="text-xs font-bold text-slate-700">{section.name}</span>
                            <span className="text-xs font-mono font-bold text-slate-700">{formatYen(sectionTotal)}</span>
                          </div>
                          {/* グループ */}
                          {section.groups.map((group) => {
                            const groupTotal = group.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0)
                            return (
                              <div key={group.id}>
                                {/* グループヘッダー */}
                                <div className="flex items-center justify-between px-5 py-1.5 bg-slate-50/40">
                                  <span className="text-xs text-slate-500 font-medium">{group.name}</span>
                                  <span className="text-xs font-mono text-slate-500">{formatYen(groupTotal)}</span>
                                </div>
                                {/* 明細行 */}
                                {group.items.map((item) => (
                                  <div key={item.id} className="flex items-center justify-between px-6 py-1.5 text-xs text-slate-600 border-t border-slate-50">
                                    <span className="flex-1 truncate pr-2">{item.name}</span>
                                    <span className="text-slate-600 whitespace-nowrap">
                                      {item.quantity}{item.unit.name} × {formatYen(item.unitPrice)}
                                    </span>
                                    <span className="font-mono ml-3 text-slate-700 whitespace-nowrap">{formatYen(item.quantity * item.unitPrice)}</span>
                                  </div>
                                ))}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                  {/* 合計 */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-t border-slate-200">
                    <span className="text-xs font-bold text-slate-700">合計（税抜）</span>
                    <span className="text-sm font-mono font-bold text-slate-800">{formatYen(data.contractAmount)}</span>
                  </div>
                </div>
              )}

              {/* 一括契約の場合：対象見積一覧 */}
              {!data.estimate && data.contractEstimates.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-b border-slate-100">
                    <FileText className="w-3.5 h-3.5 text-blue-500" />
                    <p className="text-xs font-semibold text-slate-500">対象見積（{data.contractEstimates.length}件）</p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {data.contractEstimates.map((ce, idx) => (
                      <div key={ce.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-slate-500">{idx + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">
                            {ce.estimate.title ?? ce.estimate.estimateNumber ?? `見積 ${idx + 1}`}
                          </p>
                          <p className="text-xs text-slate-600">{ce.estimate.user.name}</p>
                        </div>
                        {ce.estimate.estimateNumber && (
                          <span className="text-xs text-slate-600 font-mono shrink-0">{ce.estimate.estimateNumber}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 担当者 */}
              {data.project.contact && (
                <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
                  <p className="text-xs text-slate-600 mb-1">担当者</p>
                  <p className="text-sm font-medium text-slate-700">{data.project.contact.name}</p>
                  {data.project.contact.phone && (
                    <p className="text-xs text-slate-500 mt-0.5">{data.project.contact.phone}</p>
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── メインコンポーネント ────────────────────────────────────

export function ContractSummary({ contracts }: Props) {
  const [tab, setTab] = useState<"summary" | "list">("summary")
  const isMobile = useIsMobile()

  // パネル状態
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null)
  const [panelData, setPanelData] = useState<PanelContractData | null>(null)
  const [panelLoading, setPanelLoading] = useState(false)

  // 契約行クリック → パネルを開く
  const openPanel = useCallback(async (contractId: string) => {
    if (contractId === selectedContractId) {
      // 同じ行をクリック → 閉じる
      setSelectedContractId(null)
      setPanelData(null)
      return
    }
    setSelectedContractId(contractId)
    setPanelLoading(true)
    setPanelData(null)
    try {
      const res = await fetch(`/api/contracts/${contractId}`)
      if (!res.ok) throw new Error("取得失敗")
      const data = await res.json()
      setPanelData(data)
    } catch {
      toast.error("契約データの取得に失敗しました")
      setSelectedContractId(null)
    } finally {
      setPanelLoading(false)
    }
  }, [selectedContractId])

  const closePanel = useCallback(() => {
    setSelectedContractId(null)
    setPanelData(null)
  }, [])

  // ===== 月別集計 =====
  const monthlyData = useMemo(() => {
    return MONTHS.map((month, idx) => {
      const monthContracts = contracts.filter((c) => {
        const d = new Date(c.contractDate)
        return d.getMonth() === idx
      })
      return {
        month,
        count: monthContracts.length,
        contractAmount: monthContracts.reduce((s, c) => s + c.contractAmount, 0),
        totalAmount: monthContracts.reduce((s, c) => s + c.totalAmount, 0),
      }
    })
  }, [contracts])

  const totalCount = contracts.length
  const totalContractAmount = contracts.reduce((s, c) => s + c.contractAmount, 0)
  const totalTotalAmount = contracts.reduce((s, c) => s + c.totalAmount, 0)

  // ===== 会社別集計（件数の多い順）=====
  const companyData = useMemo(() => {
    const map = new Map<string, { companyName: string; contracts: ContractRow[] }>()
    for (const c of contracts) {
      if (!map.has(c.companyId)) {
        map.set(c.companyId, { companyName: c.companyName, contracts: [] })
      }
      map.get(c.companyId)!.contracts.push(c)
    }
    return Array.from(map.values()).sort((a, b) => b.contracts.length - a.contracts.length)
  }, [contracts])

  // ===== 月別一覧（全件） =====
  const monthlyList = useMemo(() => {
    return MONTHS.map((month, idx) => {
      const items = contracts.filter((c) => new Date(c.contractDate).getMonth() === idx)
      return { month, items }
    })
  }, [contracts])

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 min-h-screen">
      {/* ヘッダー */}
      <div className={cn(
        "bg-white border-b border-slate-200 sticky top-0 z-10",
        isMobile ? "px-4 py-3" : "px-4 md:px-8 py-4",
      )}>
        <h1 className={cn(
          "font-bold text-slate-800",
          isMobile ? "text-xl" : "text-lg",
        )}>
          契約集計 <span className={cn("font-normal text-slate-600", isMobile ? "text-sm" : "text-sm")}>2026年</span>
        </h1>
        {/* タブ */}
        <div className={cn("flex mt-3", isMobile ? "gap-2 bg-slate-100 rounded-xl p-1" : "gap-1")}>
          <button
            onClick={() => setTab("summary")}
            className={cn(
              "font-bold transition-all",
              isMobile
                ? cn("flex-1 py-2.5 rounded-xl text-sm", tab === "summary" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400")
                : cn("px-4 py-1.5 rounded-lg text-sm font-medium", tab === "summary" ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100"),
            )}
          >
            集計・グラフ
          </button>
          <button
            onClick={() => setTab("list")}
            className={cn(
              "font-bold transition-all",
              isMobile
                ? cn("flex-1 py-2.5 rounded-xl text-sm", tab === "list" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400")
                : cn("px-4 py-1.5 rounded-lg text-sm font-medium", tab === "list" ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100"),
            )}
          >
            月別一覧
          </button>
        </div>
      </div>

      <div className={cn("py-5 space-y-5 pb-24", isMobile ? "px-3" : "px-4 md:px-8 space-y-6")}>

        {/* ===== 集計・グラフタブ ===== */}
        {tab === "summary" && (
          <>
            {/* サマリーカード */}
            {isMobile ? (
              <>
                {/* ヒーローカード */}
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 text-white">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-medium text-blue-100">税込合計</span>
                  </div>
                  <p className="text-3xl font-bold tracking-tight">{formatYen(totalTotalAmount)}</p>
                  <p className="text-blue-200 text-sm mt-1">2026年 契約実績</p>
                </div>
                {/* サブ情報 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                        <FileText className="w-4 h-4 text-blue-500" />
                      </div>
                      <span className="text-xs font-medium text-slate-600">総件数</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">{totalCount}<span className="text-sm text-slate-600 ml-0.5">件</span></p>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                        <Wallet className="w-4 h-4 text-emerald-500" />
                      </div>
                      <span className="text-xs font-medium text-slate-600">税抜合計</span>
                    </div>
                    <p className="text-lg font-bold text-slate-800 font-mono">{formatYen(totalContractAmount)}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                  <p className="text-xs text-slate-600 mb-1">総件数</p>
                  <p className="text-2xl font-bold text-slate-800">{totalCount}<span className="text-sm font-normal text-slate-600 ml-1">件</span></p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                  <p className="text-xs text-slate-600 mb-1">税抜合計</p>
                  <p className="text-sm font-bold text-slate-800 font-mono">{formatYen(totalContractAmount)}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                  <p className="text-xs text-slate-600 mb-1">税込合計</p>
                  <p className="text-sm font-bold text-blue-600 font-mono">{formatYen(totalTotalAmount)}</p>
                </div>
              </div>
            )}

            {/* 棒グラフ */}
            <div className={cn("bg-white border border-slate-200", isMobile ? "rounded-2xl p-3" : "rounded-xl p-4")}>
              <div className={cn("flex items-center gap-2", isMobile ? "mb-3" : "mb-4")}>
                <TrendingUp className={cn("text-blue-500", isMobile ? "w-5 h-5" : "w-4 h-4")} />
                <h2 className={cn("font-bold text-slate-700", isMobile ? "text-base" : "text-sm")}>月別契約金額（税込）</h2>
              </div>
              <ResponsiveContainer width="100%" height={isMobile ? 200 : 220}>
                <BarChart data={monthlyData} margin={isMobile ? { top: 4, right: 4, left: 0, bottom: 0 } : { top: 4, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: isMobile ? 10 : 11, fill: "#94a3b8" }} />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickFormatter={(v) => v === 0 ? "0" : `${(v / 10000).toFixed(0)}万`}
                    width={40}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="totalAmount" radius={[4, 4, 0, 0]}>
                    {monthlyData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={entry.count > 0 ? "#3b82f6" : "#e2e8f0"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 月別合計表 */}
            <div className={cn("bg-white border border-slate-200 overflow-hidden", isMobile ? "rounded-2xl" : "rounded-xl")}>
              <div className={cn("flex items-center gap-2 border-b border-slate-100", isMobile ? "px-4 py-3" : "px-4 py-3")}>
                <FileText className={cn("text-blue-500", isMobile ? "w-5 h-5" : "w-4 h-4")} />
                <h2 className={cn("font-bold text-slate-700", isMobile ? "text-base" : "text-sm")}>月別集計</h2>
              </div>
              {isMobile ? (
                <div className="divide-y divide-slate-100">
                  {monthlyData.filter(r => r.count > 0).map((row, idx) => (
                    <div key={idx} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <span className="text-base font-bold text-slate-700">{row.month}</span>
                        <span className="text-sm text-slate-600 ml-2">{row.count}件</span>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold font-mono text-slate-800">{formatYen(row.totalAmount)}</p>
                        <p className="text-xs font-mono text-slate-600">{formatYen(row.contractAmount)}</p>
                      </div>
                    </div>
                  ))}
                  {/* 合計行 */}
                  <div className="px-4 py-3.5 flex items-center justify-between bg-slate-800">
                    <span className="text-base font-bold text-white">合計</span>
                    <div className="text-right">
                      <p className="text-lg font-bold font-mono text-white">{formatYen(totalTotalAmount)}</p>
                      <p className="text-xs font-mono text-slate-600">{totalCount}件</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-xs text-slate-600">
                        <th className="text-left px-4 py-2 font-medium">月</th>
                        <th className="text-right px-4 py-2 font-medium">件数</th>
                        <th className="text-right px-4 py-2 font-medium">税抜金額</th>
                        <th className="text-right px-4 py-2 font-medium">税込金額</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyData.map((row, idx) => (
                        <tr key={idx} className={cn("border-t border-slate-50", row.count === 0 && "opacity-40")}>
                          <td className="px-4 py-2.5 font-medium text-slate-700">{row.month}</td>
                          <td className="px-4 py-2.5 text-right text-slate-500">{row.count}件</td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-600">
                            {row.count > 0 ? formatYen(row.contractAmount) : "ー"}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-800">
                            {row.count > 0 ? formatYen(row.totalAmount) : "ー"}
                          </td>
                        </tr>
                      ))}
                      {/* 合計行 */}
                      <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                        <td className="px-4 py-3 text-slate-700">合計</td>
                        <td className="px-4 py-3 text-right text-slate-700">{totalCount}件</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700">{formatYen(totalContractAmount)}</td>
                        <td className="px-4 py-3 text-right font-mono text-blue-600">{formatYen(totalTotalAmount)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 会社別一覧 */}
            {isMobile ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-5 h-5 text-blue-500" />
                  <h2 className="text-base font-bold text-slate-700">会社別一覧</h2>
                </div>
                {companyData.map(({ companyName, contracts: ccs }) => {
                  const compTotal = ccs.reduce((s, c) => s + c.totalAmount, 0)
                  return (
                    <div key={companyName} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                      {/* 会社ヘッダー */}
                      <div className="bg-slate-800 px-4 py-3">
                        <p className="text-base font-bold text-white">{companyName}</p>
                        <p className="text-sm text-slate-300 mt-0.5">{ccs.length}件 / 税込 {formatYen(compTotal)}</p>
                      </div>
                      {/* 契約カード */}
                      <div className="divide-y divide-slate-100">
                        {ccs.map((c) => {
                          const isSelected = selectedContractId === c.id
                          return (
                            <div
                              key={c.id}
                              onClick={() => openPanel(c.id)}
                              className={cn(
                                "px-4 py-3.5 active:bg-slate-50 transition-colors cursor-pointer",
                                isSelected && "bg-blue-50",
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-slate-800 truncate">{c.projectName ?? c.name ?? "ー"}</p>
                                  <p className="text-xs text-slate-600 mt-1">{formatDateFull(c.contractDate)}</p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-base font-bold font-mono text-slate-800">{formatYen(c.totalAmount)}</p>
                                  <p className="text-xs font-mono text-slate-600">{formatYen(c.contractAmount)}</p>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
                {companyData.length === 0 && (
                  <div className="py-8 text-center text-sm text-slate-600">2026年の契約データがありません</div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                  <Building2 className="w-4 h-4 text-blue-500" />
                  <h2 className="text-sm font-bold text-slate-700">会社別一覧</h2>
                  <span className="text-xs text-slate-600">（契約件数の多い順）</span>
                  <span className="ml-auto text-xs text-slate-600">行をタップで詳細</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {companyData.map(({ companyName, contracts: ccs }) => {
                    const compTotal = ccs.reduce((s, c) => s + c.totalAmount, 0)
                    return (
                      <div key={companyName}>
                        {/* 会社ヘッダー */}
                        <div className="flex items-center justify-between px-4 py-2 bg-slate-50">
                          <span className="text-sm font-bold text-slate-700">{companyName}</span>
                          <span className="text-xs text-slate-600">{ccs.length}件 / 税込 {formatYen(compTotal)}</span>
                        </div>
                        {/* 契約一覧（クリック可能） */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs md:text-sm">
                            <thead>
                              <tr className="text-xs text-slate-600">
                                <th className="text-left px-4 py-1.5 font-medium">契約日</th>
                                <th className="text-left px-4 py-1.5 font-medium">現場名</th>
                                <th className="text-right px-4 py-1.5 font-medium">税抜</th>
                                <th className="text-right px-4 py-1.5 font-medium">税込</th>
                                <th className="w-6" />
                              </tr>
                            </thead>
                            <tbody>
                              {ccs.map((c) => {
                                const isSelected = selectedContractId === c.id
                                return (
                                  <tr
                                    key={c.id}
                                    onClick={() => openPanel(c.id)}
                                    className={cn(
                                      "border-t border-slate-50 cursor-pointer transition-colors",
                                      isSelected
                                        ? "bg-blue-50 hover:bg-blue-100"
                                        : "hover:bg-blue-50/40",
                                    )}
                                  >
                                    <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{formatDateFull(c.contractDate)}</td>
                                    <td className="px-4 py-2 text-slate-700 max-w-[120px] truncate">{c.projectName ?? c.name ?? "ー"}</td>
                                    <td className="px-4 py-2 text-right font-mono text-slate-600">{formatYen(c.contractAmount)}</td>
                                    <td className="px-4 py-2 text-right font-mono font-medium text-slate-800">{formatYen(c.totalAmount)}</td>
                                    <td className="px-2 py-2">
                                      <ChevronRight className={cn(
                                        "w-3.5 h-3.5 transition-colors",
                                        isSelected ? "text-blue-500" : "text-slate-300",
                                      )} />
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })}
                  {companyData.length === 0 && (
                    <div className="px-4 py-8 text-center text-sm text-slate-600">2026年の契約データがありません</div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ===== 月別一覧タブ ===== */}
        {tab === "list" && (
          <div className="space-y-4">
            {/* 件数バッジ */}
            <div className="flex items-center gap-2">
              <Calendar className={cn("text-blue-500", isMobile ? "w-5 h-5" : "w-4 h-4")} />
              <span className={cn("text-slate-500", isMobile ? "text-base font-medium" : "text-sm")}>2026年 全{totalCount}件</span>
            </div>

            {monthlyList.map(({ month, items }) => (
              <div key={month} className={cn("bg-white border border-slate-200 overflow-hidden", isMobile ? "rounded-2xl" : "rounded-xl")}>
                {/* 月ヘッダー */}
                <div className={cn("flex items-center justify-between bg-slate-800", isMobile ? "px-4 py-3.5" : "px-4 py-3")}>
                  <span className={cn("font-bold text-white", isMobile ? "text-base" : "text-sm")}>{month}</span>
                  <span className={cn("text-slate-300", isMobile ? "text-sm" : "text-xs")}>{items.length}件</span>
                </div>

                {items.length === 0 ? (
                  <div className={cn("text-slate-500 text-center", isMobile ? "px-4 py-5 text-base" : "px-4 py-4 text-sm")}>契約なし</div>
                ) : isMobile ? (
                  /* モバイル: カード表示 */
                  <div className="divide-y divide-slate-100">
                    {items.map((c) => {
                      const isSelected = selectedContractId === c.id
                      return (
                        <div
                          key={c.id}
                          onClick={() => openPanel(c.id)}
                          className={cn(
                            "px-4 py-3.5 active:bg-slate-50 transition-colors cursor-pointer",
                            isSelected && "bg-blue-50",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-blue-600">{c.companyName}</p>
                              <p className="text-sm font-semibold text-slate-800 mt-0.5 truncate">{c.projectName ?? c.name ?? "ー"}</p>
                              <p className="text-xs text-slate-600 mt-1">{formatDateFull(c.contractDate)}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-base font-bold font-mono text-slate-800">{formatYen(c.totalAmount)}</p>
                              <p className="text-xs font-mono text-slate-600">{formatYen(c.contractAmount)}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {/* 月合計 */}
                    <div className="px-4 py-3 flex items-center justify-between bg-blue-50">
                      <span className="text-sm font-bold text-slate-600">月合計</span>
                      <div className="text-right">
                        <p className="text-base font-bold font-mono text-blue-700">{formatYen(items.reduce((s, c) => s + c.totalAmount, 0))}</p>
                        <p className="text-xs font-mono text-slate-600">{formatYen(items.reduce((s, c) => s + c.contractAmount, 0))}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* デスクトップ: テーブル表示 */
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs md:text-sm">
                      <thead>
                        <tr className="text-xs text-slate-600 bg-slate-50">
                          <th className="text-left px-3 py-2 font-medium">契約日</th>
                          <th className="text-left px-3 py-2 font-medium">会社名</th>
                          <th className="text-left px-3 py-2 font-medium">現場名</th>
                          <th className="text-right px-3 py-2 font-medium">税抜</th>
                          <th className="text-right px-3 py-2 font-medium">税込</th>
                          <th className="w-6" />
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((c, i) => {
                          const isSelected = selectedContractId === c.id
                          return (
                            <tr
                              key={c.id}
                              onClick={() => openPanel(c.id)}
                              className={cn(
                                "border-t border-slate-50 cursor-pointer transition-colors",
                                isSelected
                                  ? "bg-blue-50 hover:bg-blue-100"
                                  : i % 2 === 1 ? "bg-slate-50/50 hover:bg-blue-50/40" : "hover:bg-blue-50/40",
                              )}
                            >
                              <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{formatDateFull(c.contractDate)}</td>
                              <td className="px-3 py-2.5 text-slate-700 max-w-[100px] truncate">{c.companyName}</td>
                              <td className="px-3 py-2.5 text-slate-700 max-w-[120px] truncate">{c.projectName ?? c.name ?? "ー"}</td>
                              <td className="px-3 py-2.5 text-right font-mono text-slate-600">{formatYen(c.contractAmount)}</td>
                              <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800">{formatYen(c.totalAmount)}</td>
                              <td className="px-2 py-2">
                                <ChevronRight className={cn(
                                  "w-3.5 h-3.5 transition-colors",
                                  isSelected ? "text-blue-500" : "text-slate-300",
                                )} />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      {/* 月合計 */}
                      <tfoot>
                        <tr className="border-t-2 border-slate-200 bg-blue-50 font-bold text-xs">
                          <td className="px-3 py-2 text-slate-600" colSpan={3}>月合計</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-700">
                            {formatYen(items.reduce((s, c) => s + c.contractAmount, 0))}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-blue-700">
                            {formatYen(items.reduce((s, c) => s + c.totalAmount, 0))}
                          </td>
                          <td />
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== スライドオーバーパネル ===== */}
      {selectedContractId && (
        <ContractPanel
          data={panelData}
          loading={panelLoading}
          onClose={closePanel}
        />
      )}
    </div>
  )
}

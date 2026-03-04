"use client"

import { useState, useMemo } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts"
import { cn } from "@/lib/utils"
import { Building2, TrendingUp, FileText, Calendar } from "lucide-react"

interface ContractRow {
  id: string
  contractDate: string
  contractAmount: number
  taxAmount: number
  totalAmount: number
  startDate: string | null
  endDate: string | null
  name: string | null
  projectName: string | null
  companyId: string
  companyName: string
}

interface Props {
  contracts: ContractRow[]
}

const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]

function formatYen(n: number) {
  return "¥" + n.toLocaleString("ja-JP")
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function formatDateFull(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
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

export function ContractSummary({ contracts }: Props) {
  const [tab, setTab] = useState<"summary" | "list">("summary")

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
      <div className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10">
        <h1 className="text-lg font-bold text-slate-800">契約集計 <span className="text-sm font-normal text-slate-400">2026年</span></h1>
        {/* タブ */}
        <div className="flex gap-1 mt-3">
          <button
            onClick={() => setTab("summary")}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
              tab === "summary" ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100",
            )}
          >
            集計・グラフ
          </button>
          <button
            onClick={() => setTab("list")}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
              tab === "list" ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100",
            )}
          >
            月別一覧
          </button>
        </div>
      </div>

      <div className="px-4 md:px-8 py-6 space-y-6 pb-24">

        {/* ===== 集計・グラフタブ ===== */}
        {tab === "summary" && (
          <>
            {/* サマリーカード */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                <p className="text-xs text-slate-400 mb-1">総件数</p>
                <p className="text-2xl font-bold text-slate-800">{totalCount}<span className="text-sm font-normal text-slate-400 ml-1">件</span></p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                <p className="text-xs text-slate-400 mb-1">税抜合計</p>
                <p className="text-sm font-bold text-slate-800 font-mono">{formatYen(totalContractAmount)}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                <p className="text-xs text-slate-400 mb-1">税込合計</p>
                <p className="text-sm font-bold text-blue-600 font-mono">{formatYen(totalTotalAmount)}</p>
              </div>
            </div>

            {/* 棒グラフ */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                <h2 className="text-sm font-bold text-slate-700">月別契約金額（税込）</h2>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickFormatter={(v) => v === 0 ? "0" : `${(v / 10000).toFixed(0)}万`}
                    width={45}
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
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                <FileText className="w-4 h-4 text-blue-500" />
                <h2 className="text-sm font-bold text-slate-700">月別集計</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-400">
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
            </div>

            {/* 会社別一覧 */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                <Building2 className="w-4 h-4 text-blue-500" />
                <h2 className="text-sm font-bold text-slate-700">会社別一覧</h2>
                <span className="text-xs text-slate-400">（契約件数の多い順）</span>
              </div>
              <div className="divide-y divide-slate-100">
                {companyData.map(({ companyName, contracts: ccs }) => {
                  const compTotal = ccs.reduce((s, c) => s + c.totalAmount, 0)
                  const compContractAmount = ccs.reduce((s, c) => s + c.contractAmount, 0)
                  return (
                    <div key={companyName}>
                      {/* 会社ヘッダー */}
                      <div className="flex items-center justify-between px-4 py-2 bg-slate-50">
                        <span className="text-sm font-bold text-slate-700">{companyName}</span>
                        <span className="text-xs text-slate-400">{ccs.length}件 / 税込 {formatYen(compTotal)}</span>
                      </div>
                      {/* 契約一覧 */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs md:text-sm">
                          <thead>
                            <tr className="text-xs text-slate-400">
                              <th className="text-left px-4 py-1.5 font-medium">契約日</th>
                              <th className="text-left px-4 py-1.5 font-medium">現場名</th>
                              <th className="text-right px-4 py-1.5 font-medium">税抜</th>
                              <th className="text-right px-4 py-1.5 font-medium">税込</th>
                              <th className="text-left px-4 py-1.5 font-medium">工期</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ccs.map((c) => (
                              <tr key={c.id} className="border-t border-slate-50 hover:bg-blue-50/30 transition-colors">
                                <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{formatDateFull(c.contractDate)}</td>
                                <td className="px-4 py-2 text-slate-700 max-w-[120px] truncate">{c.projectName ?? c.name ?? "ー"}</td>
                                <td className="px-4 py-2 text-right font-mono text-slate-600">{formatYen(c.contractAmount)}</td>
                                <td className="px-4 py-2 text-right font-mono font-medium text-slate-800">{formatYen(c.totalAmount)}</td>
                                <td className="px-4 py-2 text-slate-400 whitespace-nowrap text-xs">
                                  {c.startDate && c.endDate
                                    ? `${formatDate(c.startDate)}〜${formatDate(c.endDate)}`
                                    : c.startDate
                                    ? `${formatDate(c.startDate)}〜`
                                    : "未設定"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
                {companyData.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-slate-400">2026年の契約データがありません</div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ===== 月別一覧タブ ===== */}
        {tab === "list" && (
          <div className="space-y-4">
            {/* 件数バッジ */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-slate-500">2026年 全{totalCount}件</span>
            </div>

            {monthlyList.map(({ month, items }) => (
              <div key={month} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* 月ヘッダー */}
                <div className="flex items-center justify-between px-4 py-3 bg-slate-800">
                  <span className="text-sm font-bold text-white">{month}</span>
                  <span className="text-xs text-slate-300">{items.length}件</span>
                </div>

                {items.length === 0 ? (
                  <div className="px-4 py-4 text-sm text-slate-300 text-center">契約なし</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs md:text-sm">
                      <thead>
                        <tr className="text-xs text-slate-400 bg-slate-50">
                          <th className="text-left px-3 py-2 font-medium">契約日</th>
                          <th className="text-left px-3 py-2 font-medium">会社名</th>
                          <th className="text-left px-3 py-2 font-medium">現場名</th>
                          <th className="text-right px-3 py-2 font-medium">税抜</th>
                          <th className="text-right px-3 py-2 font-medium">税込</th>
                          <th className="text-left px-3 py-2 font-medium">工期</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((c, i) => (
                          <tr key={c.id} className={cn("border-t border-slate-50", i % 2 === 1 && "bg-slate-50/50")}>
                            <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{formatDateFull(c.contractDate)}</td>
                            <td className="px-3 py-2.5 text-slate-700 max-w-[100px] truncate">{c.companyName}</td>
                            <td className="px-3 py-2.5 text-slate-700 max-w-[120px] truncate">{c.projectName ?? c.name ?? "ー"}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-slate-600">{formatYen(c.contractAmount)}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800">{formatYen(c.totalAmount)}</td>
                            <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap text-xs">
                              {c.startDate && c.endDate
                                ? `${formatDate(c.startDate)}〜${formatDate(c.endDate)}`
                                : c.startDate
                                ? `${formatDate(c.startDate)}〜`
                                : "未設定"}
                            </td>
                          </tr>
                        ))}
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
    </div>
  )
}

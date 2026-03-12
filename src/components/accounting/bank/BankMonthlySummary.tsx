"use client"

import { useState, useMemo, Fragment } from "react"
import {
  BarChart3,
  Building2,
  Landmark,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Search,
} from "lucide-react"
import { useBankStore } from "./useBankStore"

interface MonthData {
  yearMonth: string
  depositCount: number
  withdrawalCount: number
  totalDeposit: number
  totalWithdrawal: number
  byCompanyBank: {
    key: string
    company: string
    bankName: string
    depositCount: number
    withdrawalCount: number
    totalDeposit: number
    totalWithdrawal: number
  }[]
}

function formatYearMonth(ym: string) {
  const [year, month] = ym.split("-")
  return `${year}年${parseInt(month)}月`
}

export function BankMonthlySummary() {
  const { transactions } = useBankStore()
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null)
  const [filterCompany, setFilterCompany] = useState("all")

  const companies = useMemo(
    () => [...new Set(transactions.map((t) => t.company).filter(Boolean))].sort(),
    [transactions],
  )

  const monthlyData = useMemo(() => {
    const filtered =
      filterCompany === "all"
        ? transactions
        : transactions.filter((t) => t.company === filterCompany)

    const byMonth = new Map<string, MonthData>()
    for (const t of filtered) {
      const ym = t.date.slice(0, 7)
      if (!byMonth.has(ym)) {
        byMonth.set(ym, {
          yearMonth: ym,
          depositCount: 0,
          withdrawalCount: 0,
          totalDeposit: 0,
          totalWithdrawal: 0,
          byCompanyBank: [],
        })
      }
      const m = byMonth.get(ym)!
      if (t.type === "deposit") {
        m.depositCount++
        m.totalDeposit += t.amount
      } else {
        m.withdrawalCount++
        m.totalWithdrawal += t.amount
      }
    }

    // Build company/bank breakdown for each month
    for (const [ym, m] of byMonth) {
      const monthTxns = filtered.filter((t) => t.date.startsWith(ym))
      const groupMap = new Map<
        string,
        {
          company: string
          bankName: string
          depositCount: number
          withdrawalCount: number
          totalDeposit: number
          totalWithdrawal: number
        }
      >()
      for (const t of monthTxns) {
        const key = `${t.company || "不明"}__${t.bankName}`
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            company: t.company || "不明",
            bankName: t.bankName,
            depositCount: 0,
            withdrawalCount: 0,
            totalDeposit: 0,
            totalWithdrawal: 0,
          })
        }
        const g = groupMap.get(key)!
        if (t.type === "deposit") {
          g.depositCount++
          g.totalDeposit += t.amount
        } else {
          g.withdrawalCount++
          g.totalWithdrawal += t.amount
        }
      }
      m.byCompanyBank = [...groupMap.entries()]
        .map(([key, v]) => ({ key, ...v }))
        .sort((a, b) => {
          if (a.company !== b.company) return a.company.localeCompare(b.company)
          return (b.totalDeposit + b.totalWithdrawal) - (a.totalDeposit + a.totalWithdrawal)
        })
    }

    return [...byMonth.values()].sort((a, b) => b.yearMonth.localeCompare(a.yearMonth))
  }, [transactions, filterCompany])

  // Auto-expand the latest month
  const effectiveExpanded = expandedMonth ?? (monthlyData.length > 0 ? monthlyData[0].yearMonth : null)

  if (transactions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <BarChart3 className="w-10 h-10 mx-auto mb-2 text-slate-300" />
        <p className="text-sm text-slate-400">
          データがありません。「取込」タブからファイルを取り込んでください。
        </p>
      </div>
    )
  }

  const maxNet = Math.max(...monthlyData.map((d) => d.totalDeposit + d.totalWithdrawal), 1)

  return (
    <div className="space-y-6">
      {/* フィルター */}
      <div className="flex items-center gap-3">
        <div>
          <label className="text-xs text-slate-500 block mb-1">会社</label>
          <select
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
          >
            <option value="all">全社</option>
            {companies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 月別棒グラフ */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-sky-500" />
          月別入出金推移
        </h3>
        <div className="space-y-2">
          {monthlyData.map((month, idx) => {
            const prevMonth = idx < monthlyData.length - 1 ? monthlyData[idx + 1] : null
            const net = month.totalDeposit - month.totalWithdrawal
            const prevNet = prevMonth ? prevMonth.totalDeposit - prevMonth.totalWithdrawal : null
            const diff = prevNet !== null ? net - prevNet : 0
            const depWidth = maxNet > 0 ? (month.totalDeposit / maxNet) * 100 : 0
            const wdWidth = maxNet > 0 ? (month.totalWithdrawal / maxNet) * 100 : 0

            return (
              <div
                key={month.yearMonth}
                className="group cursor-pointer"
                onClick={() =>
                  setExpandedMonth(
                    effectiveExpanded === month.yearMonth ? "__none__" : month.yearMonth,
                  )
                }
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-20 flex-shrink-0 font-medium">
                    {formatYearMonth(month.yearMonth)}
                  </span>
                  <div className="flex-1 space-y-0.5">
                    {/* 入金バー */}
                    <div className="h-3.5 bg-slate-100 rounded overflow-hidden relative">
                      <div
                        className="h-full bg-emerald-400 group-hover:bg-emerald-500 rounded transition-all duration-300"
                        style={{ width: `${depWidth}%` }}
                      />
                      <span className="absolute inset-y-0 left-1.5 flex items-center text-[10px] font-medium text-slate-600">
                        入 ¥{month.totalDeposit.toLocaleString()}
                      </span>
                    </div>
                    {/* 出金バー */}
                    <div className="h-3.5 bg-slate-100 rounded overflow-hidden relative">
                      <div
                        className="h-full bg-red-400 group-hover:bg-red-500 rounded transition-all duration-300"
                        style={{ width: `${wdWidth}%` }}
                      />
                      <span className="absolute inset-y-0 left-1.5 flex items-center text-[10px] font-medium text-slate-600">
                        出 ¥{month.totalWithdrawal.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 w-12 text-right flex-shrink-0">
                    {month.depositCount + month.withdrawalCount}件
                  </span>
                  <span className="w-24 flex-shrink-0 text-right">
                    {prevMonth ? (
                      <span
                        className={`text-xs font-medium inline-flex items-center gap-0.5 ${
                          diff > 0
                            ? "text-emerald-500"
                            : diff < 0
                              ? "text-red-500"
                              : "text-slate-400"
                        }`}
                      >
                        {diff > 0 ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : diff < 0 ? (
                          <TrendingDown className="w-3 h-3" />
                        ) : (
                          <Minus className="w-3 h-3" />
                        )}
                        {diff !== 0 ? `¥${Math.abs(diff).toLocaleString()}` : "±0"}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 月別詳細テーブル */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 w-8"></th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">月</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">件数</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-emerald-600">入金</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-red-600">出金</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">差引</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {monthlyData.map((month) => {
              const isExpanded = effectiveExpanded === month.yearMonth
              const net = month.totalDeposit - month.totalWithdrawal
              return (
                <Fragment key={month.yearMonth}>
                  <tr
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() =>
                      setExpandedMonth(isExpanded ? "__none__" : month.yearMonth)
                    }
                  >
                    <td className="px-4 py-3 text-slate-400">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {formatYearMonth(month.yearMonth)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">
                      {month.depositCount + month.withdrawalCount} 件
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">
                      ¥{month.totalDeposit.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-red-600">
                      ¥{month.totalWithdrawal.toLocaleString()}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-bold ${net >= 0 ? "text-slate-800" : "text-red-600"}`}
                    >
                      ¥{net.toLocaleString()}
                    </td>
                  </tr>
                  {isExpanded && month.byCompanyBank.length > 0 && (
                    <tr>
                      <td colSpan={6} className="bg-slate-50 px-4 py-3">
                        <p className="text-xs font-medium text-slate-500 mb-2">
                          {formatYearMonth(month.yearMonth)} 会社・銀行別内訳
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                          {month.byCompanyBank.map((g) => (
                            <div
                              key={g.key}
                              className="bg-white rounded-lg border border-slate-200 p-3"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-1.5">
                                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="text-xs font-bold text-slate-700">
                                    {g.company}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Landmark className="w-3 h-3 text-sky-400" />
                                  <span className="text-xs text-slate-500">{g.bankName}</span>
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                <div>
                                  <span className="text-emerald-600 block">入金</span>
                                  <span className="font-bold text-emerald-700">
                                    {g.depositCount}件
                                  </span>
                                  <span className="block text-emerald-600 tabular-nums">
                                    ¥{g.totalDeposit.toLocaleString()}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-red-600 block">出金</span>
                                  <span className="font-bold text-red-700">
                                    {g.withdrawalCount}件
                                  </span>
                                  <span className="block text-red-600 tabular-nums">
                                    ¥{g.totalWithdrawal.toLocaleString()}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500 block">差引</span>
                                  <span
                                    className={`font-bold tabular-nums ${
                                      g.totalDeposit - g.totalWithdrawal >= 0
                                        ? "text-slate-700"
                                        : "text-red-600"
                                    }`}
                                  >
                                    ¥{(g.totalDeposit - g.totalWithdrawal).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
          <tfoot className="bg-slate-100 border-t-2 border-slate-300">
            <tr>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3 font-bold text-slate-700">合計</td>
              <td className="px-4 py-3 text-right font-medium text-slate-600">
                {monthlyData.reduce(
                  (s, d) => s + d.depositCount + d.withdrawalCount,
                  0,
                )}{" "}
                件
              </td>
              <td className="px-4 py-3 text-right font-bold text-lg text-emerald-600">
                ¥
                {monthlyData
                  .reduce((s, d) => s + d.totalDeposit, 0)
                  .toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right font-bold text-lg text-red-600">
                ¥
                {monthlyData
                  .reduce((s, d) => s + d.totalWithdrawal, 0)
                  .toLocaleString()}
              </td>
              <td
                className={`px-4 py-3 text-right font-bold text-lg ${
                  monthlyData.reduce((s, d) => s + d.totalDeposit - d.totalWithdrawal, 0) >= 0
                    ? "text-slate-800"
                    : "text-red-600"
                }`}
              >
                ¥
                {monthlyData
                  .reduce((s, d) => s + d.totalDeposit - d.totalWithdrawal, 0)
                  .toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

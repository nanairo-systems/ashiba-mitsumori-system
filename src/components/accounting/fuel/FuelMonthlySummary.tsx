"use client"

import { useState, useEffect } from "react"
import { Loader2, BarChart3, Car, User, TrendingUp, TrendingDown, Minus } from "lucide-react"

interface CardSummary {
  cardNumber: string
  amount: number
  count: number
  vehicleName: string | null
  driverName: string | null
}

interface MonthSummary {
  yearMonth: string
  totalAmount: number
  count: number
  cards: CardSummary[]
}

function formatYearMonth(ym: string) {
  const [year, month] = ym.split("-")
  return `${year}年${parseInt(month)}月`
}

export function FuelMonthlySummary() {
  const [data, setData] = useState<MonthSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/accounting/fuel/monthly-summary")
      .then((res) => res.json())
      .then((json) => {
        const items: MonthSummary[] = Array.isArray(json) ? json : (json.data ?? [])
        setData(items)
        if (items.length > 0) setExpandedMonth(items[0].yearMonth)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  if (data.length === 0 || data.every((d) => d.count === 0)) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <BarChart3 className="w-10 h-10 mx-auto mb-2 text-slate-300" />
        <p className="text-sm text-slate-400">データがありません</p>
      </div>
    )
  }

  const maxAmount = Math.max(...data.map((d) => d.totalAmount))

  return (
    <div className="space-y-6">
      {/* 月別推移グラフ */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-orange-500" />
          月別ガソリン利用額推移（過去12ヶ月）
        </h3>
        <div className="space-y-2">
          {data
            .filter((d) => d.count > 0)
            .reverse()
            .map((month, idx, arr) => {
              const prevMonth = idx > 0 ? arr[idx - 1] : null
              const diff = prevMonth ? month.totalAmount - prevMonth.totalAmount : 0
              const barWidth = maxAmount > 0 ? (month.totalAmount / maxAmount) * 100 : 0

              return (
                <div
                  key={month.yearMonth}
                  className="group cursor-pointer"
                  onClick={() =>
                    setExpandedMonth(expandedMonth === month.yearMonth ? null : month.yearMonth)
                  }
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 w-20 flex-shrink-0 font-medium">
                      {formatYearMonth(month.yearMonth)}
                    </span>
                    <div className="flex-1 h-7 bg-slate-100 rounded-md overflow-hidden relative">
                      <div
                        className="h-full bg-orange-400 group-hover:bg-orange-500 rounded-md transition-all duration-300"
                        style={{ width: `${barWidth}%` }}
                      />
                      <span className="absolute inset-y-0 left-2 flex items-center text-xs font-medium text-slate-700">
                        ¥{month.totalAmount.toLocaleString()}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 w-12 text-right flex-shrink-0">
                      {month.count}件
                    </span>
                    <span className="w-20 flex-shrink-0 text-right">
                      {prevMonth ? (
                        <span
                          className={`text-xs font-medium inline-flex items-center gap-0.5 ${
                            diff > 0 ? "text-red-500" : diff < 0 ? "text-emerald-500" : "text-slate-400"
                          }`}
                        >
                          {diff > 0 ? <TrendingUp className="w-3 h-3" /> : diff < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
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
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">月</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">件数</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">合計金額</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 hidden md:table-cell">前月比</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data
              .filter((d) => d.count > 0)
              .map((month, idx, arr) => {
                const nextIdx = idx + 1
                const prevMonth = nextIdx < arr.length ? arr[nextIdx] : null
                const diff = prevMonth ? month.totalAmount - prevMonth.totalAmount : 0
                const isExpanded = expandedMonth === month.yearMonth

                return (
                  <>
                    <tr
                      key={month.yearMonth}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => setExpandedMonth(isExpanded ? null : month.yearMonth)}
                    >
                      <td className="px-4 py-3 font-medium text-slate-700">{formatYearMonth(month.yearMonth)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{month.count} 件</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">¥{month.totalAmount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        {prevMonth ? (
                          <span className={`text-xs font-medium inline-flex items-center gap-0.5 ${diff > 0 ? "text-red-500" : diff < 0 ? "text-emerald-500" : "text-slate-400"}`}>
                            {diff > 0 ? <TrendingUp className="w-3 h-3" /> : diff < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                            {diff !== 0 ? `¥${Math.abs(diff).toLocaleString()}` : "±0"}
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                    {isExpanded && month.cards.length > 0 && (
                      <tr key={`${month.yearMonth}-detail`}>
                        <td colSpan={4} className="bg-slate-50 px-4 py-3">
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-slate-500 mb-2">
                              {formatYearMonth(month.yearMonth)} 車両・ドライバー別内訳
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {month.cards.map((card) => (
                                <div key={card.cardNumber} className="bg-white rounded-lg border border-slate-200 p-3 flex items-center justify-between">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                                      <Car className="w-3.5 h-3.5 text-blue-400" />
                                      {card.vehicleName ?? "未設定"}
                                    </span>
                                    <span className="flex items-center gap-1.5 text-xs text-slate-400">
                                      <User className="w-3 h-3 text-purple-400" />
                                      {card.driverName ?? "未設定"}
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-bold text-slate-800">¥{card.amount.toLocaleString()}</p>
                                    <p className="text-xs text-slate-400">{card.count} 件</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
          </tbody>
          <tfoot className="bg-slate-100 border-t-2 border-slate-300">
            <tr>
              <td className="px-4 py-3 font-bold text-slate-700">合計</td>
              <td className="px-4 py-3 text-right font-medium text-slate-600">
                {data.reduce((s, d) => s + d.count, 0)} 件
              </td>
              <td className="px-4 py-3 text-right font-bold text-lg text-slate-800">
                ¥{data.reduce((s, d) => s + d.totalAmount, 0).toLocaleString()}
              </td>
              <td className="px-4 py-3 hidden md:table-cell"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, TableIcon } from "lucide-react"

interface VehicleRow {
  cardNumber: string
  vehicleName: string
  driverName: string
  plateNumber: string
  monthly: Record<string, { amount: number; count: number }>
  total: { amount: number; count: number }
}

interface ApiResponse {
  months: string[]
  vehicles: VehicleRow[]
  monthlyTotals: Record<string, { amount: number; count: number }>
}

function getDefaultRange() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  return {
    from: `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}`,
    to: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  }
}

function getMonthOptions() {
  const options: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const label = `${d.getFullYear()}年${d.getMonth() + 1}月`
    options.push({ value, label })
  }
  return options
}

function formatMonth(ym: string) {
  const [, month] = ym.split("-")
  return `${parseInt(month)}月`
}

function formatMonthFull(ym: string) {
  const [year, month] = ym.split("-")
  return `${year}年${parseInt(month)}月`
}

export function FuelVehicleMonthlyTable() {
  const defaultRange = getDefaultRange()
  const [fromMonth, setFromMonth] = useState(defaultRange.from)
  const [toMonth, setToMonth] = useState(defaultRange.to)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const monthOptions = getMonthOptions()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from: fromMonth, to: toMonth })
      const res = await fetch(`/api/accounting/fuel/vehicle-monthly?${params}`)
      const json = await res.json()
      setData(json)
    } finally {
      setLoading(false)
    }
  }, [fromMonth, toMonth])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!data || data.vehicles.length === 0) {
    return (
      <div className="space-y-4">
        <FilterBar fromMonth={fromMonth} toMonth={toMonth} setFromMonth={setFromMonth} setToMonth={setToMonth} monthOptions={monthOptions} />
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <TableIcon className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="text-sm text-slate-400">データがありません</p>
        </div>
      </div>
    )
  }

  const { months, vehicles, monthlyTotals } = data
  const grandTotal = Object.values(monthlyTotals).reduce((s, v) => s + v.amount, 0)

  return (
    <div className="space-y-4">
      <FilterBar fromMonth={fromMonth} toMonth={toMonth} setFromMonth={setFromMonth} setToMonth={setToMonth} monthOptions={monthOptions} />

      <div className="flex items-center justify-between px-1">
        <span className="text-sm text-slate-500">
          {formatMonthFull(months[0])} 〜 {formatMonthFull(months[months.length - 1])}（{vehicles.length} 台）
        </span>
        <span className="text-base font-bold text-slate-800">
          総合計: ¥{grandTotal.toLocaleString()}
        </span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 sticky left-0 bg-slate-50 z-10 min-w-[120px] border-r border-slate-200">
                車両名
              </th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-slate-600 min-w-[90px] border-r border-slate-200">
                担当者
              </th>
              {months.map((ym) => (
                <th key={ym} className="text-right px-3 py-3 text-xs font-semibold text-slate-600 min-w-[100px]">
                  {formatMonth(ym)}
                </th>
              ))}
              <th className="text-right px-4 py-3 text-xs font-bold text-slate-700 min-w-[110px] bg-slate-100 border-l border-slate-200">
                合計
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {vehicles.map((v) => (
              <tr key={v.cardNumber} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2.5 font-medium text-slate-700 sticky left-0 bg-white z-10 border-r border-slate-100">
                  <div className="leading-tight">
                    <span className="block text-sm">{v.vehicleName}</span>
                    {v.vehicleName !== v.plateNumber && (
                      <span className="block text-[10px] text-slate-400">{v.plateNumber}</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-500 border-r border-slate-100">
                  {v.driverName}
                </td>
                {months.map((ym) => {
                  const cell = v.monthly[ym]
                  return (
                    <td key={ym} className="px-3 py-2.5 text-right text-slate-600 tabular-nums">
                      {cell ? (
                        <div>
                          <span className="font-medium">¥{cell.amount.toLocaleString()}</span>
                          <span className="block text-[10px] text-slate-400">{cell.count}件</span>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  )
                })}
                <td className="px-4 py-2.5 text-right font-bold text-slate-800 bg-slate-50 border-l border-slate-200 tabular-nums">
                  ¥{v.total.amount.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 border-t-2 border-slate-300">
              <td className="px-4 py-3 font-bold text-slate-700 sticky left-0 bg-slate-100 z-10 border-r border-slate-200">月合計</td>
              <td className="px-3 py-3 bg-slate-100 border-r border-slate-200" />
              {months.map((ym) => (
                <td key={ym} className="px-3 py-3 text-right font-bold text-slate-700 tabular-nums">
                  ¥{(monthlyTotals[ym]?.amount ?? 0).toLocaleString()}
                </td>
              ))}
              <td className="px-4 py-3 text-right font-bold text-lg text-slate-800 bg-slate-200 border-l border-slate-300 tabular-nums">
                ¥{grandTotal.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function FilterBar({
  fromMonth, toMonth, setFromMonth, setToMonth, monthOptions,
}: {
  fromMonth: string; toMonth: string
  setFromMonth: (v: string) => void; setToMonth: (v: string) => void
  monthOptions: { value: string; label: string }[]
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">開始月</label>
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            value={fromMonth}
            onChange={(e) => { setFromMonth(e.target.value); if (e.target.value > toMonth) setToMonth(e.target.value) }}
          >
            {monthOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <span className="text-slate-400 pb-2">〜</span>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">終了月</label>
          <select
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            value={toMonth}
            onChange={(e) => { setToMonth(e.target.value); if (e.target.value < fromMonth) setFromMonth(e.target.value) }}
          >
            {monthOptions.filter((m) => m.value >= fromMonth).map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

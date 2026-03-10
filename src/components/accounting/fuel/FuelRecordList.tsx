"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, Car, User, CreditCard, Loader2, ChevronDown, ChevronUp, Fuel } from "lucide-react"

interface FuelRecord {
  id: string
  cardNumber: string
  usageDate: string
  dayOfWeek: string | null
  usageType: string | null
  destinationName: string | null
  driverLastName: string | null
  driverFirstName: string | null
  plateNumber: string | null
  amount: string
  tax: string | null
  usageInfo: string | null
  complianceInfo: string | null
  vehicleName: string | null
  driverName: string | null
}

interface Props {
  defaultYearMonth: string
}

function getMonthOptions() {
  const options = []
  const now = new Date()
  for (let i = 0; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const label = `${d.getFullYear()}年${d.getMonth() + 1}月`
    options.push({ value: ym, label })
  }
  return options
}

export function FuelRecordList({ defaultYearMonth }: Props) {
  const [yearMonth, setYearMonth] = useState(defaultYearMonth)
  const [records, setRecords] = useState<FuelRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"list" | "vehicle" | "type">("list")

  const monthOptions = getMonthOptions()

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (yearMonth) params.set("yearMonth", yearMonth)
      const res = await fetch(`/api/accounting/fuel/records?${params}`)
      const data = await res.json()
      setRecords(data)
    } finally {
      setLoading(false)
    }
  }, [yearMonth])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  const totalAmount = records.reduce((sum, r) => sum + Number(r.amount), 0)

  // 車両別集計
  const vehicleGroups = records.reduce<Record<string, { label: string; records: FuelRecord[]; total: number }>>((acc, r) => {
    const key = r.plateNumber ?? "不明"
    const label = r.vehicleName ?? r.plateNumber ?? "不明"
    if (!acc[key]) acc[key] = { label, records: [], total: 0 }
    acc[key].records.push(r)
    acc[key].total += Number(r.amount)
    return acc
  }, {})

  // 利用内容別集計
  const typeGroups = records.reduce<Record<string, { label: string; records: FuelRecord[]; total: number }>>((acc, r) => {
    const key = r.usageType ?? "不明"
    if (!acc[key]) acc[key] = { label: key, records: [], total: 0 }
    acc[key].records.push(r)
    acc[key].total += Number(r.amount)
    return acc
  }, {})

  function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  function parseUsageInfo(info: string | null) {
    if (!info) return null
    const ssMatch = info.match(/SS名：([^、]+)/)
    const priceMatch = info.match(/単価：([^、]+)/)
    const qtyMatch = info.match(/数量：([^、]+)/)
    return {
      ssName: ssMatch?.[1]?.trim() ?? "",
      unitPrice: priceMatch?.[1]?.trim() ?? "",
      quantity: qtyMatch?.[1]?.trim() ?? "",
    }
  }

  function usageTypeColor(type: string | null) {
    if (!type) return "bg-slate-100 text-slate-600"
    if (type.includes("軽油")) return "bg-amber-100 text-amber-700"
    if (type.includes("レギュラー")) return "bg-red-100 text-red-700"
    if (type.includes("ハイオク")) return "bg-purple-100 text-purple-700"
    if (type.includes("洗車")) return "bg-blue-100 text-blue-700"
    if (type.includes("パーキング")) return "bg-green-100 text-green-700"
    return "bg-slate-100 text-slate-600"
  }

  return (
    <div className="space-y-4">
      {/* フィルター */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">年月</label>
            <select
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
            >
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="ml-auto self-end">
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              {(["list", "vehicle", "type"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    viewMode === mode ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {mode === "list" ? "一覧" : mode === "vehicle" ? "車両別" : "種別"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 合計 */}
      <div className="flex items-center justify-between px-1">
        <span className="text-sm text-slate-500">
          {loading ? "読込中..." : `${records.length} 件`}
        </span>
        <span className="text-base font-bold text-slate-800">
          合計: ¥{totalAmount.toLocaleString()}
        </span>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      )}

      {!loading && records.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Search className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p className="text-sm text-slate-400">データがありません</p>
          <p className="text-xs text-slate-300 mt-1">「取込」タブからガソリン明細をインポートしてください</p>
        </div>
      )}

      {/* 一覧モード */}
      {!loading && viewMode === "list" && records.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">日付</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">車両</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 hidden md:table-cell">種別</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 hidden lg:table-cell">SS</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">金額</th>
                <th className="px-2 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((r) => {
                const parsed = parseUsageInfo(r.usageInfo)
                const isExpanded = expandedId === r.id
                return (
                  <>
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        <span>{formatDate(r.usageDate)}</span>
                        {r.dayOfWeek && <span className="ml-1 text-xs text-slate-400">({r.dayOfWeek})</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-slate-700">
                          <Car className="w-3 h-3 text-blue-400" />
                          {r.vehicleName ?? r.plateNumber ?? "不明"}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {r.usageType && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${usageTypeColor(r.usageType)}`}>
                            {r.usageType}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-slate-500 max-w-[200px] truncate">
                        {parsed?.ssName || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">
                        ¥{Number(r.amount).toLocaleString()}
                      </td>
                      <td className="px-2 py-3">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : r.id)}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${r.id}-detail`} className="bg-slate-50">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="text-xs text-slate-500 space-y-1">
                            <div className="flex flex-wrap gap-4">
                              <p className="flex items-center gap-1">
                                <CreditCard className="w-3 h-3" />
                                <span className="font-mono">{r.cardNumber}</span>
                              </p>
                              {r.driverName && (
                                <p className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {r.driverName}
                                </p>
                              )}
                              {r.driverLastName && (
                                <p className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {r.driverLastName}{r.driverFirstName}（CSV記載）
                                </p>
                              )}
                              {r.tax && (
                                <p>消費税: ¥{Number(r.tax).toLocaleString()}</p>
                              )}
                              {parsed?.unitPrice && <p>単価: {parsed.unitPrice}</p>}
                              {parsed?.quantity && <p>数量: {parsed.quantity}</p>}
                            </div>
                            {r.usageInfo && <p className="text-slate-400">{r.usageInfo}</p>}
                            {r.complianceInfo && (
                              <p className="text-amber-600 font-medium">⚠ {r.complianceInfo}</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 車両別モード */}
      {!loading && viewMode === "vehicle" && records.length > 0 && (
        <div className="space-y-3">
          {Object.entries(vehicleGroups)
            .sort((a, b) => b[1].total - a[1].total)
            .map(([key, group]) => (
              <div key={key} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <span className="flex items-center gap-2 font-medium text-slate-700 text-sm">
                    <Car className="w-4 h-4 text-blue-400" />
                    {group.label}
                  </span>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-slate-400">{group.records.length} 件</span>
                    <span className="font-bold text-slate-800">¥{group.total.toLocaleString()}</span>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {group.records.map((r) => {
                    const parsed = parseUsageInfo(r.usageInfo)
                    return (
                      <div key={r.id} className="flex items-center px-4 py-2.5 text-sm">
                        <span className="text-slate-500 w-14 flex-shrink-0">
                          {formatDate(r.usageDate)}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${usageTypeColor(r.usageType)} w-28 text-center flex-shrink-0`}>
                          {r.usageType ?? "—"}
                        </span>
                        <span className="flex-1 text-xs text-slate-400 truncate mx-3">
                          {parsed?.ssName || "—"}
                        </span>
                        <span className="font-medium text-slate-700 ml-auto">¥{Number(r.amount).toLocaleString()}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* 種別モード */}
      {!loading && viewMode === "type" && records.length > 0 && (
        <div className="space-y-3">
          {Object.entries(typeGroups)
            .sort((a, b) => b[1].total - a[1].total)
            .map(([key, group]) => (
              <div key={key} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <span className="flex items-center gap-2 font-medium text-slate-700 text-sm">
                    <Fuel className="w-4 h-4 text-orange-400" />
                    {group.label}
                  </span>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-slate-400">{group.records.length} 件</span>
                    <span className="font-bold text-slate-800">¥{group.total.toLocaleString()}</span>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {group.records.map((r) => (
                    <div key={r.id} className="flex items-center px-4 py-2.5 text-sm">
                      <span className="text-slate-500 w-14 flex-shrink-0">
                        {formatDate(r.usageDate)}
                      </span>
                      <span className="text-xs text-blue-500 w-32 flex-shrink-0 truncate">
                        {r.vehicleName ?? r.plateNumber ?? "—"}
                      </span>
                      <span className="flex-1 text-xs text-slate-400 truncate mx-2">
                        {r.driverName ?? (`${r.driverLastName ?? ""}${r.driverFirstName ?? ""}` || "—")}
                      </span>
                      <span className="font-medium text-slate-700">¥{Number(r.amount).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

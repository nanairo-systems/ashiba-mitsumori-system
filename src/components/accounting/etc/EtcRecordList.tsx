"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, Filter, Car, User, CreditCard, Loader2, ChevronDown, ChevronUp } from "lucide-react"
import { formatDate } from "@/lib/utils"

interface Vehicle {
  id: string
  plateNumber: string
  nickname: string | null
  cards: { id: string; cardNumber: string }[]
}

interface Driver {
  id: string
  name: string
  cards: { id: string; cardNumber: string }[]
}

interface Card {
  id: string
  cardNumber: string
  vehicle: { id: string; plateNumber: string; nickname: string | null } | null
  driver: { id: string; name: string } | null
}

interface EtcRecord {
  id: string
  cardNumber: string
  usageDate: string
  dayOfWeek: string | null
  usageType: string | null
  destinationName: string | null
  plateNumber: string | null
  amount: string
  usageInfo: string | null
  complianceInfo: string | null
  card: {
    cardNumber: string
    vehicle: { plateNumber: string; nickname: string | null } | null
    driver: { name: string } | null
  } | null
}

interface VehicleSummary {
  cardNumber: string
  amount: number
  count: number
}

interface Props {
  vehicles: Vehicle[]
  drivers: Driver[]
  cards: Card[]
  defaultYearMonth: string
  vehicleSummary: VehicleSummary[]
}

// 過去12ヶ月の選択肢
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

export function EtcRecordList({ vehicles, drivers, cards, defaultYearMonth, vehicleSummary }: Props) {
  const [yearMonth, setYearMonth] = useState(defaultYearMonth)
  const [vehicleId, setVehicleId] = useState("")
  const [driverId, setDriverId] = useState("")
  const [records, setRecords] = useState<EtcRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"list" | "vehicle" | "driver">("list")

  const monthOptions = getMonthOptions()

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (yearMonth) params.set("yearMonth", yearMonth)
      if (vehicleId) params.set("vehicleId", vehicleId)
      if (driverId) params.set("driverId", driverId)
      const res = await fetch(`/api/accounting/etc/records?${params}`)
      const data = await res.json()
      setRecords(data)
    } finally {
      setLoading(false)
    }
  }, [yearMonth, vehicleId, driverId])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  const totalAmount = records.reduce((sum, r) => sum + Number(r.amount), 0)

  // 車両別集計
  const vehicleGroups = records.reduce<Record<string, { label: string; records: EtcRecord[]; total: number }>>((acc, r) => {
    const key = r.card?.vehicle?.plateNumber ?? r.plateNumber ?? "不明"
    const label = r.card?.vehicle ? (r.card.vehicle.nickname ?? r.card.vehicle.plateNumber) : (r.plateNumber ?? "不明")
    if (!acc[key]) acc[key] = { label, records: [], total: 0 }
    acc[key].records.push(r)
    acc[key].total += Number(r.amount)
    return acc
  }, {})

  // ドライバー別集計
  const driverGroups = records.reduce<Record<string, { label: string; records: EtcRecord[]; total: number }>>((acc, r) => {
    const key = r.card?.driver?.name ?? "未設定"
    if (!acc[key]) acc[key] = { label: key, records: [], total: 0 }
    acc[key].records.push(r)
    acc[key].total += Number(r.amount)
    return acc
  }, {})

  function parseUsageInfo(info: string | null): { entry: string; exit: string; time: string } | null {
    if (!info) return null
    const entryMatch = info.match(/入口IC：([^、]+)/)
    const exitMatch = info.match(/出口IC：([^、]+)/)
    const timeMatch = info.match(/課金時刻：([^、]+)/)
    return {
      entry: entryMatch?.[1]?.trim() ?? "",
      exit: exitMatch?.[1]?.trim() ?? "",
      time: timeMatch?.[1]?.trim() ?? "",
    }
  }

  return (
    <div className="space-y-4">
      {/* フィルター */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">年月</label>
            <select
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
            >
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">車両</label>
            <select
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              value={vehicleId}
              onChange={(e) => { setVehicleId(e.target.value); setDriverId("") }}
            >
              <option value="">全て</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.nickname ?? v.plateNumber}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">ドライバー</label>
            <select
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              value={driverId}
              onChange={(e) => { setDriverId(e.target.value); setVehicleId("") }}
            >
              <option value="">全て</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          {/* 表示モード */}
          <div className="ml-auto self-end">
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              {(["list", "vehicle", "driver"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    viewMode === mode ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {mode === "list" ? "一覧" : mode === "vehicle" ? "車両別" : "人別"}
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
          <p className="text-xs text-slate-300 mt-1">「取込」タブからETC明細をインポートしてください</p>
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
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 hidden md:table-cell">ドライバー</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 hidden lg:table-cell">区間</th>
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
                        <span>{formatDate(r.usageDate, "M/d")}</span>
                        {r.dayOfWeek && <span className="ml-1 text-xs text-slate-400">({r.dayOfWeek})</span>}
                        {parsed?.time && <span className="ml-1 text-xs text-slate-400">{parsed.time}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {r.card?.vehicle ? (
                          <span className="flex items-center gap-1 text-slate-700">
                            <Car className="w-3 h-3 text-blue-400" />
                            {r.card.vehicle.nickname ?? r.card.vehicle.plateNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">{r.plateNumber ?? "不明"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {r.card?.driver ? (
                          <span className="flex items-center gap-1 text-slate-600">
                            <User className="w-3 h-3 text-purple-400" />
                            {r.card.driver.name}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-slate-500">
                        {parsed ? `${parsed.entry} → ${parsed.exit}` : "—"}
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
                            <p className="flex items-center gap-1">
                              <CreditCard className="w-3 h-3" />
                              <span className="font-mono">{r.cardNumber}</span>
                            </p>
                            {r.usageInfo && <p className="text-slate-400">{r.usageInfo}</p>}
                            {r.complianceInfo && (
                              <p className="text-amber-600 font-medium">{r.complianceInfo}</p>
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
                          {formatDate(r.usageDate, "M/d")}
                          {r.dayOfWeek && <span className="text-xs">({r.dayOfWeek})</span>}
                        </span>
                        <span className="flex-1 text-xs text-slate-400 truncate mx-3">
                          {parsed ? `${parsed.entry} → ${parsed.exit}` : r.usageInfo ?? "—"}
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

      {/* ドライバー別モード */}
      {!loading && viewMode === "driver" && records.length > 0 && (
        <div className="space-y-3">
          {Object.entries(driverGroups)
            .sort((a, b) => b[1].total - a[1].total)
            .map(([key, group]) => (
              <div key={key} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <span className="flex items-center gap-2 font-medium text-slate-700 text-sm">
                    <User className="w-4 h-4 text-purple-400" />
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
                          {formatDate(r.usageDate, "M/d")}
                        </span>
                        <span className="text-xs text-blue-500 w-24 flex-shrink-0">
                          {r.card?.vehicle?.nickname ?? r.card?.vehicle?.plateNumber ?? r.plateNumber ?? "—"}
                        </span>
                        <span className="flex-1 text-xs text-slate-400 truncate mx-2">
                          {parsed ? `${parsed.entry} → ${parsed.exit}` : "—"}
                        </span>
                        <span className="font-medium text-slate-700">¥{Number(r.amount).toLocaleString()}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

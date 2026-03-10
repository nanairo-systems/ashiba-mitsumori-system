"use client"

import { useState, useEffect, useMemo } from "react"
import {
  AlertTriangle, DollarSign, Clock, TrendingUp, Fuel, MapPin, Tag,
  Loader2, ArrowLeft, Search, Download, ChevronDown, ChevronUp,
  ShieldAlert, Repeat, CalendarOff, Droplets, Store, BarChart2, Info,
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

interface AlertRecord {
  id: string
  usageDate: string
  amount: number
  tax: number | null
  cardNumber: string
  usageType: string | null
  plateNumber: string | null
  destinationName: string | null
  driverLastName: string | null
  driverFirstName: string | null
  vehicleName: string
  driverName: string
  ssName: string | null
  ssAddress: string | null
  unitPrice: number | null
  quantity: number | null
  complianceInfo: string | null
  usageInfo: string | null
}

interface Alert {
  type: string
  severity: "warning" | "info"
  title: string
  description: string
  record: AlertRecord
}

const typeConfig: Record<string, { icon: typeof AlertTriangle; color: string; bgColor: string; label: string; desc: string }> = {
  compliance_fuel_mismatch: {
    icon: ShieldAlert, color: "text-red-600", bgColor: "bg-red-50 border-red-200",
    label: "指定外燃料",
    desc: "車両に指定された燃料と異なる種類の燃料で給油された場合に検知します。例: 軽油指定車にレギュラーガソリンを給油",
  },
  compliance_multi_refuel: {
    icon: Repeat, color: "text-orange-600", bgColor: "bg-orange-50 border-orange-200",
    label: "同日複数回給油",
    desc: "同じカードで1日に2回以上給油された場合に検知します。私的利用や不正利用の可能性を示唆します",
  },
  compliance_holiday: {
    icon: CalendarOff, color: "text-yellow-600", bgColor: "bg-yellow-50 border-yellow-200",
    label: "指定休日給油",
    desc: "AMS側で休日指定された日に給油が行われた場合に検知します（カード会社の判定）",
  },
  high_amount: {
    icon: DollarSign, color: "text-rose-600", bgColor: "bg-rose-50 border-rose-200",
    label: "高額利用",
    desc: "1回の利用金額が閾値（デフォルト15,000円）を超えた場合に検知します。大型車両の満タン給油等は除外対象です",
  },
  unusual_time: {
    icon: Clock, color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200",
    label: "休日/深夜",
    desc: "日曜・祝日・深夜（22時〜翌6時）に利用があった場合に検知します。業務外利用の可能性をチェックできます",
  },
  monthly_spike: {
    icon: TrendingUp, color: "text-purple-600", bgColor: "bg-purple-50 border-purple-200",
    label: "月間急増",
    desc: "カード別の月間利用額が前月比150%以上に急増した場合に検知します。走行ルート変更や異常利用を早期発見できます",
  },
  above_avg: {
    icon: BarChart2, color: "text-pink-600", bgColor: "bg-pink-50 border-pink-200",
    label: "平均超過",
    desc: "1回の給油金額が過去3ヶ月の個人平均の250%を超えた場合に検知します",
  },
  high_frequency: {
    icon: Repeat, color: "text-amber-600", bgColor: "bg-amber-50 border-amber-200",
    label: "高頻度給油",
    desc: "同じカードで週3回以上の給油があった場合に検知します。燃費悪化や不正利用の可能性を示します",
  },
  small_quantity: {
    icon: Droplets, color: "text-cyan-600", bgColor: "bg-cyan-50 border-cyan-200",
    label: "少量給油",
    desc: "1回の給油量が10L以下の場合に検知します。少量の繰り返し給油は私的利用の疑いがあります",
  },
  non_fuel: {
    icon: Tag, color: "text-emerald-600", bgColor: "bg-emerald-50 border-emerald-200",
    label: "給油以外",
    desc: "洗車・コインパーキング等、給油以外の利用が検出された場合に通知します。経費区分の確認が必要です",
  },
  unknown_ss: {
    icon: Store, color: "text-indigo-600", bgColor: "bg-indigo-50 border-indigo-200",
    label: "初めてのSS",
    desc: "過去3ヶ月で一度も利用していないガソリンスタンドで給油があった場合に検知します。遠方出張や私的利用の可能性",
  },
  price_anomaly: {
    icon: MapPin, color: "text-violet-600", bgColor: "bg-violet-50 border-violet-200",
    label: "単価異常",
    desc: "同じ燃料種別の期間内平均単価から大きく乖離（標準偏差の2倍超）した場合に検知します",
  },
}

const allTypes = Object.keys(typeConfig)

export function FuelAlertPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [summary, setSummary] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().slice(0, 10)
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [filterType, setFilterType] = useState("all")
  const [filterSeverity, setFilterSeverity] = useState("all")
  const [searchText, setSearchText] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showGuide, setShowGuide] = useState(false)

  async function fetchAlerts() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate })
      const res = await fetch(`/api/accounting/fuel/alerts?${params}`)
      const data = await res.json()
      setAlerts(data.alerts ?? [])
      setSummary(data.summary ?? {})
    } catch {
      toast.error("アラート取得に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAlerts() }, [fromDate, toDate])

  const filtered = useMemo(() => {
    let list = alerts
    if (filterType !== "all") list = list.filter((a) => a.type === filterType)
    if (filterSeverity !== "all") list = list.filter((a) => a.severity === filterSeverity)
    if (searchText) {
      const q = searchText.toLowerCase()
      list = list.filter((a) =>
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.record.vehicleName.toLowerCase().includes(q) ||
        a.record.driverName.toLowerCase().includes(q) ||
        (a.record.ssName?.toLowerCase().includes(q)) ||
        (a.record.cardNumber.includes(q))
      )
    }
    return list
  }, [alerts, filterType, filterSeverity, searchText])

  function exportCSV() {
    const header = "種別,重要度,タイトル,説明,日付,車両,ドライバー,金額,カード番号,利用種別,SS名,SS住所,数量,単価,適正利用情報"
    const rows = filtered.map((a) => {
      const r = a.record
      const d = new Date(r.usageDate)
      const date = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
      return [
        typeConfig[a.type]?.label ?? a.type,
        a.severity === "warning" ? "警告" : "情報",
        a.title,
        `"${a.description.replace(/"/g, '""')}"`,
        date,
        r.vehicleName,
        r.driverName,
        r.amount,
        r.cardNumber,
        r.usageType ?? "",
        r.ssName ?? "",
        r.ssAddress ?? "",
        r.quantity ?? "",
        r.unitPrice ?? "",
        r.complianceInfo ?? "",
      ].join(",")
    })
    const bom = "\uFEFF"
    const blob = new Blob([bom + header + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ガソリンアラート_${fromDate}_${toDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/accounting/fuel" className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-500" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-slate-800">ガソリン アラート一覧</h1>
              <p className="text-sm text-slate-500 mt-0.5">不正利用・異常パターンの自動検知</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              <Info className="w-4 h-4" />
              アラート説明
            </button>
            <button
              onClick={exportCSV}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-sm font-medium hover:bg-orange-100 disabled:opacity-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              CSV出力
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 py-4 space-y-4">
        {/* アラート説明パネル */}
        {showGuide && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-500" />
              アラート種別の説明
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {allTypes.map((type) => {
                const config = typeConfig[type]
                const Icon = config.icon
                return (
                  <div key={type} className={`rounded-lg border p-3 ${config.bgColor}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon className={`w-4 h-4 ${config.color}`} />
                      <span className={`text-sm font-bold ${config.color}`}>{config.label}</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{config.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* フィルター */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">開始日</label>
              <input type="date" className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">終了日</label>
              <input type="date" className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">種別</label>
              <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="all">全て</option>
                {allTypes.map((t) => <option key={t} value={t}>{typeConfig[t].label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">重要度</label>
              <select className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}>
                <option value="all">全て</option>
                <option value="warning">警告のみ</option>
                <option value="info">情報のみ</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-slate-500 mb-1 block">検索</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="車両名・ドライバー・SS名..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* サマリーカード */}
        <div className="grid grid-cols-4 sm:grid-cols-7 lg:grid-cols-13 gap-2">
          <button
            onClick={() => setFilterType("all")}
            className={`rounded-lg border p-2 text-center transition-all col-span-1 ${
              filterType === "all" ? "bg-slate-800 border-slate-800 text-white ring-2 ring-offset-1 ring-slate-800" : "bg-white border-slate-200 hover:bg-slate-50"
            }`}
          >
            <AlertTriangle className={`w-4 h-4 mx-auto mb-0.5 ${filterType === "all" ? "text-white" : "text-slate-500"}`} />
            <div className={`text-lg font-bold ${filterType === "all" ? "text-white" : "text-slate-800"}`}>{summary.total ?? 0}</div>
            <div className={`text-[9px] ${filterType === "all" ? "text-slate-300" : "text-slate-500"}`}>全件</div>
          </button>
          {allTypes.map((type) => {
            const config = typeConfig[type]
            const Icon = config.icon
            const count = summary[type] ?? 0
            return (
              <button
                key={type}
                onClick={() => setFilterType(filterType === type ? "all" : type)}
                className={`rounded-lg border p-2 text-center transition-all ${
                  filterType === type
                    ? `${config.bgColor} ring-2 ring-offset-1 ring-current ${config.color}`
                    : count > 0
                    ? "bg-white border-slate-200 hover:bg-slate-50"
                    : "bg-slate-50 border-slate-100 opacity-50"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 mx-auto mb-0.5 ${count > 0 ? config.color : "text-slate-400"}`} />
                <div className={`text-lg font-bold ${count > 0 ? config.color : "text-slate-400"}`}>{count}</div>
                <div className="text-[9px] text-slate-500 leading-tight">{config.label}</div>
              </button>
            )
          })}
        </div>

        {/* 件数表示 */}
        <div className="flex items-center justify-between px-1">
          <span className="text-sm text-slate-500">
            {loading ? "検知中..." : `${filtered.length} 件のアラート`}
            {filterType !== "all" && ` (${typeConfig[filterType]?.label})`}
          </span>
        </div>

        {/* アラート一覧 */}
        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
            <p className="text-sm text-slate-400 mt-2">アラートを検知中...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Fuel className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
            <p className="text-sm text-slate-500">アラートはありません</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
              {filtered.slice(0, 200).map((alert, i) => {
                const config = typeConfig[alert.type] ?? typeConfig.high_amount
                const Icon = config.icon
                const isExpanded = expandedId === `${alert.record.id}-${i}`

                return (
                  <div key={`${alert.record.id}-${i}`}>
                    <div
                      className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : `${alert.record.id}-${i}`)}
                    >
                      <div className={`w-9 h-9 rounded-lg ${config.bgColor} border flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        <Icon className={`w-4 h-4 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-bold ${config.color}`}>{alert.title}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            alert.severity === "warning" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                          }`}>
                            {alert.severity === "warning" ? "警告" : "情報"}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${config.bgColor} ${config.color}`}>
                            {config.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">{alert.description}</p>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400 flex-wrap">
                          <span>{alert.record.vehicleName}</span>
                          <span>{alert.record.driverName}</span>
                          {alert.record.amount > 0 && <span>¥{alert.record.amount.toLocaleString()}</span>}
                          {alert.record.ssName && <span>{alert.record.ssName}</span>}
                          <span>{formatDate(alert.record.usageDate)}</span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 mt-1">
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </div>

                    {/* 展開詳細 */}
                    {isExpanded && (
                      <div className="bg-slate-50 border-t border-slate-100 px-4 py-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div>
                            <span className="text-slate-400 block mb-0.5">カード番号</span>
                            <span className="font-mono text-slate-700">{alert.record.cardNumber}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block mb-0.5">車両</span>
                            <span className="text-slate-700 font-medium">{alert.record.vehicleName}</span>
                            {alert.record.plateNumber && (
                              <span className="block text-slate-400">{alert.record.plateNumber}</span>
                            )}
                          </div>
                          <div>
                            <span className="text-slate-400 block mb-0.5">ドライバー</span>
                            <span className="text-slate-700 font-medium">{alert.record.driverName}</span>
                            {alert.record.driverLastName && (
                              <span className="block text-slate-400">CSV記載: {alert.record.driverLastName}{alert.record.driverFirstName}</span>
                            )}
                          </div>
                          <div>
                            <span className="text-slate-400 block mb-0.5">利用日時</span>
                            <span className="text-slate-700">{formatDate(alert.record.usageDate)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block mb-0.5">金額（税込）</span>
                            <span className="text-slate-700 font-bold">¥{alert.record.amount.toLocaleString()}</span>
                            {alert.record.tax !== null && (
                              <span className="block text-slate-400">（税: ¥{alert.record.tax.toLocaleString()}）</span>
                            )}
                          </div>
                          <div>
                            <span className="text-slate-400 block mb-0.5">利用種別</span>
                            <span className="text-slate-700">{alert.record.usageType ?? "—"}</span>
                          </div>
                          {alert.record.quantity !== null && (
                            <div>
                              <span className="text-slate-400 block mb-0.5">給油量</span>
                              <span className="text-slate-700">{alert.record.quantity} L</span>
                            </div>
                          )}
                          {alert.record.unitPrice !== null && (
                            <div>
                              <span className="text-slate-400 block mb-0.5">単価</span>
                              <span className="text-slate-700">{alert.record.unitPrice} 円/L</span>
                            </div>
                          )}
                          {alert.record.ssName && (
                            <div className="col-span-2">
                              <span className="text-slate-400 block mb-0.5">SS名</span>
                              <span className="text-slate-700">{alert.record.ssName}</span>
                            </div>
                          )}
                          {alert.record.ssAddress && (
                            <div className="col-span-2">
                              <span className="text-slate-400 block mb-0.5">SS住所</span>
                              <span className="text-slate-700">{alert.record.ssAddress}</span>
                            </div>
                          )}
                          {alert.record.complianceInfo && (
                            <div className="col-span-2 md:col-span-4">
                              <span className="text-slate-400 block mb-0.5">適正利用情報（AMS判定）</span>
                              <span className="text-amber-600 font-medium">{alert.record.complianceInfo}</span>
                            </div>
                          )}
                          {alert.record.usageInfo && (
                            <div className="col-span-2 md:col-span-4">
                              <span className="text-slate-400 block mb-0.5">利用情報（詳細）</span>
                              <span className="text-slate-600 break-all">{alert.record.usageInfo}</span>
                            </div>
                          )}
                        </div>
                        {/* アラート種別の説明 */}
                        <div className={`mt-3 p-2.5 rounded-lg ${config.bgColor} border`}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                            <span className={`text-xs font-bold ${config.color}`}>{config.label}とは</span>
                          </div>
                          <p className="text-xs text-slate-600">{config.desc}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

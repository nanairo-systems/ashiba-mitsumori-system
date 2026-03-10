"use client"

import { useState, useEffect, useMemo } from "react"
import {
  AlertTriangle, MapPin, DollarSign, Clock, Navigation, Activity, TrendingUp,
  Loader2, Shield, Database, CheckCircle, ArrowLeft, Search, Download,
  ChevronDown, ChevronUp, BarChart2,
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

interface AlertRecord {
  id: string
  usageDate: string
  amount: number
  cardNumber: string
  destinationName: string | null
  usageType: string | null
  plateNumber: string | null
  vehicleName: string
  driverName: string
}

interface Alert {
  type: string
  severity: "warning" | "info"
  title: string
  description: string
  record: AlertRecord
}

interface AlertSummary {
  total: number
  unknown_ic: number
  high_amount: number
  unusual_time: number
  first_ic: number
  high_frequency: number
  monthly_spike: number
  above_avg: number
}

const typeConfig: Record<string, { icon: typeof AlertTriangle; color: string; bgColor: string; borderColor: string; label: string }> = {
  unknown_ic: { icon: MapPin, color: "text-red-600", bgColor: "bg-red-50", borderColor: "border-red-200", label: "未登録IC" },
  high_amount: { icon: DollarSign, color: "text-orange-600", bgColor: "bg-orange-50", borderColor: "border-orange-200", label: "高額利用" },
  unusual_time: { icon: Clock, color: "text-blue-600", bgColor: "bg-blue-50", borderColor: "border-blue-200", label: "休日/深夜/祝日" },
  first_ic: { icon: Navigation, color: "text-purple-600", bgColor: "bg-purple-50", borderColor: "border-purple-200", label: "初めての行先" },
  high_frequency: { icon: Activity, color: "text-amber-600", bgColor: "bg-amber-50", borderColor: "border-amber-200", label: "高頻度" },
  monthly_spike: { icon: TrendingUp, color: "text-rose-600", bgColor: "bg-rose-50", borderColor: "border-rose-200", label: "月間急増" },
  above_avg: { icon: BarChart2, color: "text-pink-600", bgColor: "bg-pink-50", borderColor: "border-pink-200", label: "個人平均超過" },
}

export function EtcAlertPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [summary, setSummary] = useState<AlertSummary | null>(null)
  const [icMasterCount, setIcMasterCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [seedLoading, setSeedLoading] = useState(false)

  // フィルター
  const now = new Date()
  const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  const defaultTo = now.toISOString().slice(0, 10)
  const [fromDate, setFromDate] = useState(defaultFrom)
  const [toDate, setToDate] = useState(defaultTo)
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [severityFilter, setSeverityFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  async function fetchAlerts() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (fromDate) params.set("from", fromDate)
      if (toDate) params.set("to", toDate)
      const res = await fetch(`/api/accounting/etc/alerts?${params}`)
      const data = await res.json()
      setAlerts(data.alerts)
      setSummary(data.summary)
      setIcMasterCount(data.icMasterCount)
    } catch {
      toast.error("アラート取得に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAlerts() }, [])

  async function handleSeedICs() {
    setSeedLoading(true)
    try {
      const res = await fetch("/api/accounting/etc/highway-ics", { method: "PUT" })
      const data = await res.json()
      toast.success(`ICマスター: ${data.created}件登録、${data.skipped}件スキップ`)
      setIcMasterCount((prev) => prev + data.created)
      await fetchAlerts()
    } catch {
      toast.error("ICマスター登録に失敗しました")
    } finally {
      setSeedLoading(false)
    }
  }

  function handleSearch() {
    fetchAlerts()
  }

  // クライアントサイドフィルター
  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (typeFilter !== "all" && a.type !== typeFilter) return false
      if (severityFilter !== "all" && a.severity !== severityFilter) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const match =
          a.record.driverName.toLowerCase().includes(q) ||
          a.record.vehicleName.toLowerCase().includes(q) ||
          (a.record.destinationName?.toLowerCase().includes(q)) ||
          a.description.toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    })
  }, [alerts, typeFilter, severityFilter, searchQuery])

  // CSV出力
  function handleExportCSV() {
    const rows = [
      ["日時", "種別", "重要度", "タイトル", "詳細", "車両", "ドライバー", "金額", "行先", "カード番号"].join(","),
      ...filtered.map((a) => {
        const d = new Date(a.record.usageDate)
        return [
          `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
          typeConfig[a.type]?.label ?? a.type,
          a.severity === "warning" ? "警告" : "情報",
          a.title,
          `"${a.description.replace(/"/g, '""')}"`,
          a.record.vehicleName,
          a.record.driverName,
          a.record.amount,
          a.record.destinationName ?? "",
          a.record.cardNumber,
        ].join(",")
      }),
    ].join("\n")

    const bom = "\uFEFF"
    const blob = new Blob([bom + rows], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `ETCアラート_${fromDate}_${toDate}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function formatDateTime(dateStr: string) {
    const d = new Date(dateStr)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/accounting/etc" className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                ETCアラート一覧
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">不審利用・高額利用・パターン異常を自動検知</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-200 disabled:opacity-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              CSV出力
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 space-y-4">
        {/* ICマスター状態 */}
        <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Shield className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">ICマスター</h3>
              <p className="text-xs text-slate-500">
                {icMasterCount > 0
                  ? `${icMasterCount}件のICが登録済み`
                  : "ICマスターが未登録です"}
              </p>
            </div>
          </div>
          <button
            onClick={handleSeedICs}
            disabled={seedLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-medium hover:bg-emerald-100 disabled:opacity-50 transition-colors"
          >
            {seedLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
            {icMasterCount > 0 ? "IC追加登録" : "初期データ投入（愛知・三重・岐阜）"}
          </button>
        </div>

        {/* 日付フィルター */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">開始日</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">終了日</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              検索
            </button>

            <div className="ml-auto flex items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="all">全種別</option>
                {Object.entries(typeConfig).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>

              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="all">全重要度</option>
                <option value="warning">警告のみ</option>
                <option value="info">情報のみ</option>
              </select>

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="車両・ドライバー・IC名"
                  className="pl-8 w-44 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* サマリーカード */}
        {summary && (
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            <button
              onClick={() => setTypeFilter("all")}
              className={`rounded-lg border p-2.5 text-center transition-all ${
                typeFilter === "all"
                  ? "bg-amber-50 border-amber-300 ring-2 ring-offset-1 ring-amber-400"
                  : "bg-white border-slate-200 hover:bg-slate-50"
              }`}
            >
              <AlertTriangle className="w-4 h-4 mx-auto mb-1 text-amber-500" />
              <div className="text-lg font-bold text-slate-800">{summary.total}</div>
              <div className="text-[10px] text-slate-500">全て</div>
            </button>
            {Object.entries(typeConfig).map(([type, config]) => {
              const count = summary[type as keyof AlertSummary] as number
              const Icon = config.icon
              return (
                <button
                  key={type}
                  onClick={() => setTypeFilter(typeFilter === type ? "all" : type)}
                  className={`rounded-lg border p-2.5 text-center transition-all ${
                    typeFilter === type
                      ? `${config.bgColor} ${config.borderColor} ring-2 ring-offset-1 ring-current ${config.color}`
                      : count > 0
                      ? "bg-white border-slate-200 hover:bg-slate-50"
                      : "bg-slate-50 border-slate-100 opacity-40"
                  }`}
                >
                  <Icon className={`w-4 h-4 mx-auto mb-1 ${count > 0 ? config.color : "text-slate-400"}`} />
                  <div className={`text-lg font-bold ${count > 0 ? config.color : "text-slate-400"}`}>{count}</div>
                  <div className="text-[10px] text-slate-500">{config.label}</div>
                </button>
              )
            })}
          </div>
        )}

        {/* アラート一覧テーブル */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-700">
              検出結果: {filtered.length}件
              {typeFilter !== "all" && <span className="ml-2 text-xs font-normal bg-slate-200 px-2 py-0.5 rounded-full">{typeConfig[typeFilter]?.label}</span>}
            </h4>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
              <p className="text-sm text-slate-400 mt-3">アラートを検知中...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
              <p className="text-sm text-slate-500">該当するアラートはありません</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((alert, i) => {
                const config = typeConfig[alert.type] ?? typeConfig.unknown_ic
                const Icon = config.icon
                const isExpanded = expandedId === `${alert.record.id}-${i}`
                return (
                  <div key={`${alert.record.id}-${i}`}>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : `${alert.record.id}-${i}`)}
                      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className={`w-9 h-9 rounded-lg ${config.bgColor} border ${config.borderColor} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        <Icon className={`w-4 h-4 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-bold ${config.color}`}>{alert.title}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            alert.severity === "warning" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                          }`}>
                            {alert.severity === "warning" ? "警告" : "情報"}
                          </span>
                          <span className="text-[10px] text-slate-400">{formatDateTime(alert.record.usageDate)}</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">{alert.description}</p>
                        <div className="flex items-center gap-4 mt-1 text-[11px] text-slate-400">
                          <span className="font-medium text-slate-500">{alert.record.vehicleName}</span>
                          <span>{alert.record.driverName}</span>
                          {alert.record.amount > 0 && <span className="font-medium">{alert.record.amount.toLocaleString()}円</span>}
                          {alert.record.destinationName && <span>{alert.record.destinationName}</span>}
                        </div>
                      </div>
                      <div className="flex-shrink-0 mt-1">
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </button>

                    {/* 詳細展開 */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pl-16">
                        <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1.5">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div>
                              <span className="text-slate-400">カード番号</span>
                              <p className="font-mono text-slate-700">{alert.record.cardNumber}</p>
                            </div>
                            <div>
                              <span className="text-slate-400">車両</span>
                              <p className="text-slate-700">{alert.record.vehicleName}</p>
                            </div>
                            <div>
                              <span className="text-slate-400">ドライバー</span>
                              <p className="text-slate-700">{alert.record.driverName}</p>
                            </div>
                            <div>
                              <span className="text-slate-400">金額</span>
                              <p className="text-slate-700 font-medium">{alert.record.amount > 0 ? `${alert.record.amount.toLocaleString()}円` : "-"}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                            <div>
                              <span className="text-slate-400">日時</span>
                              <p className="text-slate-700">{formatDateTime(alert.record.usageDate)}</p>
                            </div>
                            <div>
                              <span className="text-slate-400">行先IC</span>
                              <p className="text-slate-700">{alert.record.destinationName || "-"}</p>
                            </div>
                            {alert.record.usageType && (
                              <div>
                                <span className="text-slate-400">利用種別</span>
                                <p className="text-slate-700">{alert.record.usageType}</p>
                              </div>
                            )}
                            {alert.record.plateNumber && (
                              <div>
                                <span className="text-slate-400">車番</span>
                                <p className="text-slate-700">{alert.record.plateNumber}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import {
  AlertTriangle, MapPin, DollarSign, Clock, Navigation, Activity, TrendingUp,
  Loader2, Shield, ChevronDown, ChevronUp, Database, CheckCircle, ExternalLink,
  BarChart2, Info,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

interface AlertRecord {
  id: string
  usageDate: string
  amount: number
  cardNumber: string
  destinationName: string | null
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

const typeConfig: Record<string, { icon: typeof AlertTriangle; color: string; bgColor: string; label: string; desc: string }> = {
  unknown_ic: { icon: MapPin, color: "text-red-600", bgColor: "bg-red-50 border-red-200", label: "未登録IC",
    desc: "ICマスターに未登録のIC名が検出された場合に通知" },
  high_amount: { icon: DollarSign, color: "text-orange-600", bgColor: "bg-orange-50 border-orange-200", label: "高額利用",
    desc: "1回の利用金額が5,000円を超えた場合に検知" },
  unusual_time: { icon: Clock, color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200", label: "休日/深夜",
    desc: "日曜・祝日・深夜（22時〜6時）のETC利用を検知" },
  first_ic: { icon: Navigation, color: "text-purple-600", bgColor: "bg-purple-50 border-purple-200", label: "初めての行先",
    desc: "過去3ヶ月で未利用のICでの通行を検知" },
  high_frequency: { icon: Activity, color: "text-amber-600", bgColor: "bg-amber-50 border-amber-200", label: "高頻度",
    desc: "1日5回以上のETC利用を検知" },
  monthly_spike: { icon: TrendingUp, color: "text-rose-600", bgColor: "bg-rose-50 border-rose-200", label: "月間急増",
    desc: "月間利用額が前月比150%以上の急増を検知" },
  above_avg: { icon: BarChart2, color: "text-pink-600", bgColor: "bg-pink-50 border-pink-200", label: "平均超過",
    desc: "利用金額が過去3ヶ月平均の250%超を検知" },
}

const allTypes = Object.keys(typeConfig)

export function EtcAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [summary, setSummary] = useState<AlertSummary | null>(null)
  const [icMasterCount, setIcMasterCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [seedLoading, setSeedLoading] = useState(false)
  const [filter, setFilter] = useState<string>("all")
  const [expanded, setExpanded] = useState(true)
  const [showGuide, setShowGuide] = useState(false)

  async function fetchAlerts() {
    setLoading(true)
    try {
      const res = await fetch("/api/accounting/etc/alerts?months=1")
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
      // アラート再計算
      await fetchAlerts()
    } catch {
      toast.error("ICマスター登録に失敗しました")
    } finally {
      setSeedLoading(false)
    }
  }

  const filtered = filter === "all" ? alerts : alerts.filter((a) => a.type === filter)

  function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  }

  return (
    <div className="space-y-4">
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
                ? `${icMasterCount}件のICが登録済み（未登録ICの利用を自動検知）`
                : "ICマスターが未登録です。初期データを投入してください。"
              }
            </p>
          </div>
        </div>
        <button
          onClick={handleSeedICs}
          disabled={seedLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm font-medium hover:bg-emerald-100 disabled:opacity-50 transition-colors"
        >
          {seedLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
          {icMasterCount > 0 ? "IC追加登録" : "初期データ投入"}
        </button>
      </div>

      {/* リンク＆説明ボタン */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link
          href="/accounting/etc/alerts"
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          アラート詳細ページ（日付絞込・CSV出力）
        </Link>
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
        >
          <Info className="w-4 h-4" />
          アラート説明
        </button>
      </div>

      {/* アラート説明パネル */}
      {showGuide && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500" />
            アラート種別の説明
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {allTypes.map((type) => {
              const config = typeConfig[type]
              const Icon = config.icon
              return (
                <div key={type} className={`rounded-lg border p-2.5 ${config.bgColor}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                    <span className={`text-xs font-bold ${config.color}`}>{config.label}</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{config.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* サマリーカード */}
      {summary && (
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {Object.entries(typeConfig).map(([type, config]) => {
            const count = summary[type as keyof AlertSummary] as number
            const Icon = config.icon
            return (
              <button
                key={type}
                onClick={() => setFilter(filter === type ? "all" : type)}
                className={`rounded-lg border p-2.5 text-center transition-all ${
                  filter === type
                    ? `${config.bgColor} ring-2 ring-offset-1 ring-current ${config.color}`
                    : count > 0
                    ? "bg-white border-slate-200 hover:bg-slate-50"
                    : "bg-slate-50 border-slate-100 opacity-50"
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

      {/* アラート一覧 */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 hover:bg-slate-100 transition-colors"
        >
          <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            アラート詳細
            {filter !== "all" && (
              <span className="text-xs bg-slate-200 px-2 py-0.5 rounded-full">
                {typeConfig[filter]?.label} のみ表示中
              </span>
            )}
          </h4>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{filtered.length}件</span>
            {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
        </button>

        {expanded && (
          loading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
              <p className="text-sm text-slate-400 mt-2">アラートを検知中...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
              <p className="text-sm text-slate-500">アラートはありません</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {filtered.slice(0, 100).map((alert, i) => {
                const config = typeConfig[alert.type] ?? typeConfig.unknown_ic
                const Icon = config.icon
                return (
                  <div key={`${alert.record.id}-${i}`} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                    <div className={`w-8 h-8 rounded-lg ${config.bgColor} border flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold ${config.color}`}>{alert.title}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          alert.severity === "warning" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {alert.severity === "warning" ? "警告" : "情報"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">{alert.description}</p>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                        <span>{alert.record.vehicleName}</span>
                        <span>{alert.record.driverName}</span>
                        {alert.record.amount > 0 && <span>{alert.record.amount.toLocaleString()}円</span>}
                        <span>{formatDate(alert.record.usageDate)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>
    </div>
  )
}

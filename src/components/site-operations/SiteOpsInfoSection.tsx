/**
 * [現操-03] 現場情報クイック確認セクション
 *
 * 現場名・作業種別・元請会社・契約情報・住所（Google Maps連携）を表示。
 * 他ページからも再利用可能なモジュール。
 */
"use client"

import { Building2, MapPin, ExternalLink, FileText, Calendar } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { ScheduleData } from "@/components/worker-assignments/types"

const WORK_TYPE_LABELS: Record<string, { label: string; className: string }> = {
  ASSEMBLY: { label: "組立", className: "bg-blue-100 text-blue-700" },
  DISASSEMBLY: { label: "解体", className: "bg-orange-100 text-orange-700" },
  REWORK: { label: "その他", className: "bg-slate-100 text-slate-600" },
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "―"
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
}

function formatCurrency(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  if (isNaN(num)) return "―"
  return `¥${num.toLocaleString()}`
}

interface Props {
  schedule: ScheduleData
}

export function SiteOpsInfoSection({ schedule }: Props) {
  const { contract } = schedule
  const project = contract.project
  const company = project.branch.company
  const workTypeInfo = WORK_TYPE_LABELS[schedule.workType] ?? WORK_TYPE_LABELS.REWORK

  const address = project.address
  const mapsUrl = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null

  const siteName = schedule.name ?? project.name

  return (
    <div className="space-y-3">
      {/* セクションヘッダー */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
        <Building2 className="w-3.5 h-3.5" />
        <span>現操-03 現場情報</span>
      </div>

      {/* 現場名 + 作業種別 */}
      <div className="flex items-start gap-2">
        <h3 className="text-base font-bold text-slate-900 flex-1 leading-tight">
          {siteName}
        </h3>
        <Badge className={`text-[10px] px-1.5 py-0.5 ${workTypeInfo.className} border-0 flex-shrink-0`}>
          {workTypeInfo.label}
        </Badge>
      </div>

      {/* 情報グリッド */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {/* 元請会社 */}
        <div>
          <span className="text-slate-400">元請会社</span>
          <p className="text-slate-700 font-medium mt-0.5">{company.name}</p>
        </div>

        {/* 契約番号 */}
        <div>
          <span className="text-slate-400">契約番号</span>
          <p className="text-slate-700 font-medium mt-0.5">
            {contract.contractNumber ?? "―"}
          </p>
        </div>

        {/* 契約金額 */}
        <div>
          <span className="text-slate-400">契約金額</span>
          <p className="text-slate-700 font-medium mt-0.5">
            {formatCurrency(contract.contractAmount)}
          </p>
        </div>

        {/* 合計金額 */}
        <div>
          <span className="text-slate-400">合計金額</span>
          <p className="text-slate-700 font-medium mt-0.5">
            {formatCurrency(contract.totalAmount)}
          </p>
        </div>
      </div>

      {/* 住所 + Google Maps */}
      {address && (
        <div className="flex items-start gap-2 bg-slate-50 rounded-lg p-2.5">
          <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-700 leading-relaxed">{address}</p>
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 mt-1"
              >
                <ExternalLink className="w-3 h-3" />
                Google Maps で開く
              </a>
            )}
          </div>
        </div>
      )}

      {/* 予定日 vs 実績日 */}
      <div className="flex items-start gap-2 text-xs">
        <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 flex-1">
          <div>
            <span className="text-slate-400">予定</span>
            <p className="text-slate-700 mt-0.5">
              {formatDate(schedule.plannedStartDate)} 〜 {formatDate(schedule.plannedEndDate)}
            </p>
          </div>
          <div>
            <span className="text-slate-400">実績</span>
            <p className="text-slate-700 mt-0.5">
              {formatDate(schedule.actualStartDate)} 〜 {formatDate(schedule.actualEndDate)}
            </p>
          </div>
        </div>
      </div>

      {/* メモ */}
      {schedule.notes && (
        <div className="flex items-start gap-2 text-xs">
          <FileText className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
          <p className="text-slate-600 leading-relaxed">{schedule.notes}</p>
        </div>
      )}
    </div>
  )
}

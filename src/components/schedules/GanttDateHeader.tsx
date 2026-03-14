/**
 * [COMPONENT] ガントチャート 日付ヘッダー
 *
 * 日付セル行を描画する共通コンポーネント。
 * variant: "full" (ScheduleGantt), "mini" (ContractDetail) で表示を切り替え。
 */
"use client"

import { isToday, isWeekend, getDate, format } from "date-fns"
import { ja } from "date-fns/locale"

interface GanttDateHeaderProps {
  days: Date[]
  cellWidthPct: number
  leftColumnWidth: number | string
  leftColumnLabel?: string
  variant?: "full" | "mini"
  /** 各日の現場数マップ (yyyy-MM-dd → 件数) */
  dailySiteCounts?: Map<string, number>
}

export function GanttDateHeader({
  days,
  cellWidthPct,
  leftColumnWidth,
  leftColumnLabel = "案件名",
  variant = "full",
  dailySiteCounts,
}: GanttDateHeaderProps) {
  const isMini = variant === "mini"

  return (
    <div className={`flex border-b ${isMini ? "border-slate-200" : "border-slate-300 sticky top-0 z-20 bg-white"}`}>
      <div
        className={`flex-shrink-0 border-r border-slate-200 flex items-end ${
          isMini
            ? "bg-slate-50 px-2 py-0.5 text-sm font-bold text-slate-700"
            : "bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
        }`}
        style={{ width: typeof leftColumnWidth === "number" ? `${leftColumnWidth}px` : leftColumnWidth }}
      >
        {leftColumnLabel}
      </div>
      <div className="flex-1 flex">
        {days.map((day, i) => {
          const isTd = isToday(day)
          const isWe = isWeekend(day)
          const d = getDate(day)
          const isFirstOfMonth = d === 1
          const monthLabel = isFirstOfMonth ? format(day, "M月", { locale: ja }) : null

          const dateKey = format(day, "yyyy-MM-dd")
          const siteCount = dailySiteCounts?.get(dateKey) ?? 0

          return (
            <div
              key={i}
              style={{ width: `${cellWidthPct}%` }}
              className={`flex-shrink-0 text-center leading-tight border-r border-slate-100 last:border-r-0 ${
                isMini ? "py-0.5 text-xs" : "py-1 text-xs"
              } ${
                isTd ? "bg-blue-100 font-bold text-blue-700"
                  : isWe ? "bg-red-50/50 text-red-400"
                  : "text-slate-600"
              } ${isFirstOfMonth ? "border-l-2 border-l-slate-300" : ""}`}
            >
              {monthLabel && (
                <div className={`font-bold text-slate-600 -mb-0.5 ${isMini ? "text-[8px]" : "text-[9px]"}`}>
                  {monthLabel}
                </div>
              )}
              <div className="font-medium">{d}</div>
              {!isMini && (
                <div className="text-[9px]">{format(day, "E", { locale: ja })}</div>
              )}
              {!isMini && dailySiteCounts && siteCount > 0 && (
                <div className={`text-[9px] font-bold mt-0.5 ${
                  siteCount >= 5 ? "text-red-500" : siteCount >= 3 ? "text-orange-500" : "text-blue-500"
                }`}>
                  {siteCount}件
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

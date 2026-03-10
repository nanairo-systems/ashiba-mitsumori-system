/**
 * [COMPONENT] 工程カレンダー - ScheduleCalendar
 *
 * 月次カレンダーグリッド。工程を横断バーで表示し、日付クリックで工程作成を呼び出す。
 */
"use client"

import { useMemo } from "react"
import {
  addDays,
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  parseISO,
  isAfter,
  isBefore,
} from "date-fns"
import { cn } from "@/lib/utils"
import type { ScheduleData, WorkTypeMaster, WorkTypeConfig } from "./schedule-types"
import { buildWtConfigMap, getWtConfig } from "./schedule-constants"

const DAY_HEADERS = ["日", "月", "火", "水", "木", "金", "土"]
const MAX_VISIBLE_SLOTS = 3

interface CalendarSchedule extends ScheduleData {
  contractName?: string
}

interface EventLayout {
  schedule: CalendarSchedule
  colStart: number
  colEnd: number
  slot: number
  isStart: boolean
  isEnd: boolean
  config: WorkTypeConfig
}

interface Props {
  year: number
  month: number // 0-11
  schedules: CalendarSchedule[]
  workTypes: WorkTypeMaster[]
  onDateClick: (dateStr: string) => void
  onScheduleClick: (schedule: ScheduleData) => void
}

export function ScheduleCalendar({
  year,
  month,
  schedules,
  workTypes,
  onDateClick,
  onScheduleClick,
}: Props) {
  const wtConfigMap = useMemo(() => buildWtConfigMap(workTypes), [workTypes])
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  // カレンダーグリッドの週配列を計算
  const { weeks, weekLayouts } = useMemo(() => {
    const monthStart = startOfMonth(new Date(year, month))
    const monthEnd = endOfMonth(monthStart)
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

    const weeks: Date[][] = []
    let cur = calStart
    while (!isAfter(cur, calEnd)) {
      const week: Date[] = []
      for (let i = 0; i < 7; i++) {
        week.push(cur)
        cur = addDays(cur, 1)
      }
      weeks.push(week)
    }

    // 各週のイベントレイアウト計算
    const weekLayouts: EventLayout[][] = weeks.map((week) => {
      const weekStart = week[0]
      const weekEnd = week[6]

      const weekSchedules = schedules.filter((s) => {
        if (!s.plannedStartDate || !s.plannedEndDate) return false
        const start = parseISO(s.plannedStartDate)
        const end = parseISO(s.plannedEndDate)
        return !isAfter(start, weekEnd) && !isBefore(end, weekStart)
      })

      // 開始日順、同じ開始日なら長い工程を先に
      weekSchedules.sort((a, b) => {
        const aStart = parseISO(a.plannedStartDate!)
        const bStart = parseISO(b.plannedStartDate!)
        if (!isSameDay(aStart, bStart)) return isBefore(aStart, bStart) ? -1 : 1
        const aEnd = parseISO(a.plannedEndDate!)
        const bEnd = parseISO(b.plannedEndDate!)
        return isAfter(bEnd, aEnd) ? 1 : -1
      })

      const slotEnds: Date[] = []
      const layouts: EventLayout[] = []

      for (const s of weekSchedules) {
        const sStart = parseISO(s.plannedStartDate!)
        const sEnd = parseISO(s.plannedEndDate!)

        const colStart = Math.max(
          0,
          Math.round((sStart.getTime() - weekStart.getTime()) / 86400000)
        )
        const colEnd = Math.min(
          6,
          Math.round((sEnd.getTime() - weekStart.getTime()) / 86400000)
        )

        // 空きスロットを探す
        let slot = slotEnds.findIndex(
          (slotEnd) => !slotEnd || isBefore(slotEnd, week[colStart])
        )
        if (slot === -1) slot = slotEnds.length
        slotEnds[slot] = week[colEnd]

        layouts.push({
          schedule: s,
          colStart,
          colEnd,
          slot,
          isStart: !isBefore(sStart, weekStart),
          isEnd: !isAfter(sEnd, weekEnd),
          config: getWtConfig(s.workType, wtConfigMap),
        })
      }

      return layouts
    })

    return { weeks, weekLayouts }
  }, [year, month, schedules, wtConfigMap])

  return (
    <div className="select-none border rounded-lg overflow-hidden">
      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 bg-slate-50 border-b">
        {DAY_HEADERS.map((d, i) => (
          <div
            key={i}
            className={cn(
              "text-center py-2 text-xs font-medium",
              i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-slate-500"
            )}
          >
            {d}
          </div>
        ))}
      </div>

      {/* 週ごとの行 */}
      {weeks.map((week, weekIdx) => {
        const layouts = weekLayouts[weekIdx]
        const maxSlot =
          layouts.length > 0 ? Math.max(...layouts.map((l) => l.slot)) : -1
        const visibleSlots = Math.min(maxSlot + 1, MAX_VISIBLE_SLOTS)
        const rowHeight = Math.max(56, 26 + visibleSlots * 22 + 8)

        // 各日のオーバーフロー件数
        const overflowByDay = week.map((_, dayIdx) =>
          layouts.filter((l) => l.colStart <= dayIdx && l.colEnd >= dayIdx && l.slot >= MAX_VISIBLE_SLOTS).length
        )

        return (
          <div
            key={weekIdx}
            className="relative border-b last:border-b-0"
            style={{ height: rowHeight }}
          >
            {/* クリック可能なセル（日付番号） */}
            <div className="absolute inset-0 grid grid-cols-7">
              {week.map((day, dayIdx) => {
                const isToday = isSameDay(day, today)
                const isCurrentMonth = isSameMonth(day, new Date(year, month))
                const isSun = dayIdx === 0
                const isSat = dayIdx === 6
                return (
                  <div
                    key={dayIdx}
                    className={cn(
                      "border-r last:border-r-0 cursor-pointer transition-colors pt-1 pl-1.5",
                      isCurrentMonth ? "hover:bg-blue-50/60" : "bg-slate-50/60 hover:bg-slate-100/60"
                    )}
                    onClick={() => onDateClick(format(day, "yyyy-MM-dd"))}
                  >
                    <span
                      className={cn(
                        "text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full leading-none",
                        isToday && "bg-blue-500 text-white",
                        !isToday && !isCurrentMonth && "text-slate-500",
                        !isToday && isCurrentMonth && isSun && "text-red-500",
                        !isToday && isCurrentMonth && isSat && "text-blue-500",
                        !isToday && isCurrentMonth && !isSun && !isSat && "text-slate-700"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {/* オーバーフロー件数 */}
                    {overflowByDay[dayIdx] > 0 && (
                      <span className="text-xs text-slate-600 leading-none pl-0.5">
                        +{overflowByDay[dayIdx]}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* 工程バー */}
            {layouts
              .filter((l) => l.slot < MAX_VISIBLE_SLOTS)
              .map((layout) => {
                const leftPct = (layout.colStart / 7) * 100
                const widthPct = ((layout.colEnd - layout.colStart + 1) / 7) * 100
                const topPx = 26 + layout.slot * 22

                return (
                  <div
                    key={`${layout.schedule.id}-${weekIdx}`}
                    className={cn(
                      "absolute text-xs font-medium px-1.5 cursor-pointer overflow-hidden whitespace-nowrap z-10 flex items-center",
                      layout.config.actual,
                      "text-white opacity-90 hover:opacity-100 transition-opacity",
                      layout.isStart ? "rounded-l-sm ml-0.5" : "rounded-l-none",
                      layout.isEnd ? "rounded-r-sm mr-0.5" : "rounded-r-none"
                    )}
                    style={{
                      left: `calc(${leftPct}% + ${layout.isStart ? 2 : 0}px)`,
                      width: `calc(${widthPct}% - ${(layout.isStart ? 2 : 0) + (layout.isEnd ? 2 : 0)}px)`,
                      top: topPx,
                      height: 18,
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onScheduleClick(layout.schedule)
                    }}
                    title={`${layout.config.label}: ${layout.schedule.name ?? ""}`}
                  >
                    {layout.isStart ? (
                      <>
                        <span className="opacity-75 mr-0.5 flex-shrink-0">{layout.config.short}</span>
                        <span className="truncate">{layout.schedule.name ?? layout.config.label}</span>
                      </>
                    ) : (
                      <span className="opacity-60 text-xs">▶</span>
                    )}
                  </div>
                )
              })}
          </div>
        )
      })}
    </div>
  )
}

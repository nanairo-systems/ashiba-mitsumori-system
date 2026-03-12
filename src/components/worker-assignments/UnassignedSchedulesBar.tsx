/**
 * [COMPONENT] 未配置工程バー - ガントチャート風
 *
 * チームが1つも割り当てられていない工程をミニガント形式で表示。
 * - 日程が重ならない工程は同じ行にまとめる（行詰めアルゴリズム）
 * - テーブル上部に常時表示、未配置0件なら非表示
 * - expandedDateKeys でテーブルの展開状態と列幅を同期
 */
"use client"

import { useMemo, useState, useRef, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import {
  format,
  eachDayOfInterval,
  addDays,
  isSameDay,
  differenceInDays,
  startOfDay,
} from "date-fns"
import { useDraggable } from "@dnd-kit/core"
import { cn, formatDateRange } from "@/lib/utils"
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import type { ScheduleData, UnassignedBarDragData } from "./types"
import { workTypeLabel } from "./types"

interface Props {
  schedules: ScheduleData[]
  rangeStart: Date
  displayDays: number
  expandedDateKeys?: Set<string>
  leftColWidth?: number
  scrollRef?: React.RefObject<HTMLDivElement | null>
  onScroll?: () => void
}

const DEFAULT_LEFT_COL_WIDTH = 160
const FALLBACK_COL_WIDTH = 180
const ROW_HEIGHT = 26
const DAY_OF_WEEK_SHORT = ["日", "月", "火", "水", "木", "金", "土"]

const BAR_COLORS = [
  { from: "#f59e0b", to: "#b45309" },
  { from: "#10b981", to: "#047857" },
  { from: "#8b5cf6", to: "#6d28d9" },
  { from: "#f43f5e", to: "#be123c" },
  { from: "#3b82f6", to: "#1d4ed8" },
  { from: "#06b6d4", to: "#0e7490" },
  { from: "#84cc16", to: "#4d7c0f" },
  { from: "#ec4899", to: "#be185d" },
]

function formatAmount(amount: string) {
  const n = Number(amount)
  if (isNaN(n)) return ""
  return `¥${n.toLocaleString()}`
}

/** バー1本分のデータ */
interface BarData {
  schedule: ScheduleData
  startIdx: number
  endIdx: number
  colorIdx: number
}

/** 日程が被らないバーを同じ行にまとめるアルゴリズム */
function packRows(bars: BarData[]): BarData[][] {
  const sorted = [...bars].sort((a, b) => a.startIdx - b.startIdx)
  const rows: BarData[][] = []

  for (const bar of sorted) {
    let placed = false
    for (const row of rows) {
      const last = row[row.length - 1]
      if (bar.startIdx > last.endIdx) {
        row.push(bar)
        placed = true
        break
      }
    }
    if (!placed) {
      rows.push([bar])
    }
  }

  return rows
}

/** ドラッグ可能なバーのラッパー（ホバーで現場名ツールチップ表示） */
function DraggableBar({
  bar,
  style,
  className,
  children,
}: {
  bar: BarData
  style: React.CSSProperties
  className: string
  children: React.ReactNode
}) {
  const color = BAR_COLORS[bar.colorIdx]
  const dragData: UnassignedBarDragData = {
    type: "unassigned-bar",
    scheduleId: bar.schedule.id,
    scheduleName: bar.schedule.name,
    projectName: bar.schedule.contract.project.name,
    workType: bar.schedule.workType,
    formattedDateRange: formatDateRange(
      bar.schedule.plannedStartDate,
      bar.schedule.plannedEndDate
    ),
    barColor: color.from,
    plannedStartDate: bar.schedule.plannedStartDate,
    plannedEndDate: bar.schedule.plannedEndDate,
  }

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `unassigned:${bar.schedule.id}`,
    data: dragData,
  })

  const label = bar.schedule.name ?? bar.schedule.contract.project.name
  const companyName = bar.schedule.contract.project.branch.company.name
  const address = bar.schedule.contract.project.address
  const dateRange = formatDateRange(bar.schedule.plannedStartDate, bar.schedule.plannedEndDate)
  const wt = workTypeLabel(bar.schedule.workType)

  // ホバーツールチップ（position: fixed でポータル表示 → overflow に影響されない）
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null)
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    hoverTimeout.current = setTimeout(() => {
      setHoverPos({ x: rect.left + rect.width / 2, y: rect.top })
    }, 300)
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
    setHoverPos(null)
  }, [])

  return (
    <div
      ref={setNodeRef}
      className={className}
      style={{ ...style, opacity: isDragging ? 0.3 : 1 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...listeners}
      {...attributes}
    >
      {children}
      {/* ポータルツールチップ（overflow 親の影響を受けない） */}
      {hoverPos && typeof document !== "undefined" && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none animate-in fade-in-0 duration-150"
          style={{
            left: hoverPos.x,
            top: hoverPos.y,
            transform: "translate(-50%, -100%) translateY(-8px)",
          }}
        >
          <div className="bg-slate-800 text-white text-xs rounded-sm px-3 py-2 shadow-xl whitespace-nowrap max-w-[300px]">
            <div className="font-bold truncate">{label}</div>
            <div className="text-slate-300 truncate">{companyName}</div>
            {address && <div className="text-slate-400 truncate">{address}</div>}
            <div className="text-slate-300">{wt} ・ {dateRange}</div>
            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-slate-800" />
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export function UnassignedSchedulesBar({
  schedules,
  rangeStart,
  displayDays,
  expandedDateKeys,
  leftColWidth,
  scrollRef,
  onScroll,
}: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  const effectiveLeftColWidth = leftColWidth ?? DEFAULT_LEFT_COL_WIDTH

  // コンテナ幅を計測して日付列幅を動的に決定
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const today = useMemo(() => startOfDay(new Date()), [])

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: rangeStart,
        end: addDays(rangeStart, displayDays - 1),
      }),
    [rangeStart, displayDays]
  )

  const dayColWidth = containerWidth > 0
    ? Math.floor((containerWidth - effectiveLeftColWidth) / days.length)
    : FALLBACK_COL_WIDTH

  /** 各日付列の幅（全列均等） */
  const dayWidths = useMemo(() => {
    return days.map(() => dayColWidth)
  }, [days, dayColWidth])

  /** 各列の左端位置（累積和） */
  const colLeftPositions = useMemo(() => {
    const positions: number[] = [0]
    for (let i = 0; i < dayWidths.length - 1; i++) {
      positions.push(positions[i] + dayWidths[i])
    }
    return positions
  }, [dayWidths])

  const totalDayWidth = useMemo(
    () => dayWidths.reduce((sum, w) => sum + w, 0),
    [dayWidths]
  )

  const rangeStartDay = useMemo(() => startOfDay(rangeStart), [rangeStart])
  const rangeEndDay = useMemo(
    () => startOfDay(addDays(rangeStart, displayDays - 1)),
    [rangeStart, displayDays]
  )

  // 日程未定の件数
  const noDatesCount = useMemo(
    () => schedules.filter((s) => !s.plannedStartDate).length,
    [schedules]
  )

  // 表示範囲と重なるバーを生成
  const bars = useMemo(() => {
    const result: BarData[] = []
    let colorIdx = 0

    for (const schedule of schedules) {
      if (!schedule.plannedStartDate) continue

      const schedStart = startOfDay(new Date(schedule.plannedStartDate))
      const schedEnd = schedule.plannedEndDate
        ? startOfDay(new Date(schedule.plannedEndDate))
        : schedStart

      // 完全に範囲外ならスキップ
      if (schedEnd < rangeStartDay || schedStart > rangeEndDay) {
        colorIdx++
        continue
      }

      // 表示範囲にクランプ
      const clampedStart = schedStart < rangeStartDay ? rangeStartDay : schedStart
      const clampedEnd = schedEnd > rangeEndDay ? rangeEndDay : schedEnd

      result.push({
        schedule,
        startIdx: differenceInDays(clampedStart, rangeStartDay),
        endIdx: differenceInDays(clampedEnd, rangeStartDay),
        colorIdx: colorIdx % BAR_COLORS.length,
      })
      colorIdx++
    }

    return result
  }, [schedules, rangeStartDay, rangeEndDay])

  // 範囲外の件数（日程はあるが表示範囲外）
  const outOfRangeCount = useMemo(
    () =>
      schedules.filter((s) => {
        if (!s.plannedStartDate) return false
        const schedStart = startOfDay(new Date(s.plannedStartDate))
        const schedEnd = s.plannedEndDate
          ? startOfDay(new Date(s.plannedEndDate))
          : schedStart
        return schedEnd < rangeStartDay || schedStart > rangeEndDay
      }).length,
    [schedules, rangeStartDay, rangeEndDay]
  )

  const rows = useMemo(() => packRows(bars), [bars])

  if (schedules.length === 0) return null

  const totalWidth = effectiveLeftColWidth + totalDayWidth
  const contentHeight = collapsed ? 0 : Math.max(rows.length * ROW_HEIGHT, ROW_HEIGHT) + 8

  return (
    <div ref={wrapperRef} className="bg-white border-2 border-slate-300 rounded-sm overflow-hidden shadow-sm">
      {/* 左端のアクセントライン */}
      <div className="border-l-[3px] border-l-amber-400">
        <div ref={scrollRef} onScroll={onScroll}>
          <div>
            {/* ヘッダー */}
            <div className="flex border-b border-slate-200">
              <div
                className="flex-shrink-0 px-3 py-1.5 border-r border-slate-200 bg-gradient-to-b from-amber-50 to-orange-50/30 flex items-center gap-2 sticky left-0 z-20"
                style={{ width: effectiveLeftColWidth }}
              >
                <button
                  onClick={() => setCollapsed((v) => !v)}
                  className="flex items-center gap-1.5 group"
                >
                  {collapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 text-amber-500 group-hover:text-amber-600 transition-colors" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-amber-500 group-hover:text-amber-600 transition-colors" />
                  )}
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-bold text-slate-700">未配置</span>
                </button>
                <span className="text-xs font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full min-w-[22px] text-center">
                  {schedules.length}
                </span>
              </div>

              {/* ミニ日付ヘッダー */}
              {days.map((day, i) => {
                const dateKey = format(day, "yyyy-MM-dd")
                const isToday = isSameDay(day, today)
                const dow = day.getDay()
                const colWidth = dayWidths[i]

                return (
                  <div
                    key={dateKey}
                    className={cn(
                      "text-center border-r border-slate-100 last:border-r-0 py-1 select-none",
                      isToday && "bg-blue-50",
                      dow === 0 && !isToday && "bg-red-50/40",
                      dow === 6 && !isToday && "bg-blue-50/40"
                    )}
                    style={{
                      width: colWidth,
                      minWidth: colWidth,
                      flexShrink: 0,
                    }}
                  >
                    <div
                      className={cn(
                        "text-xs leading-tight",
                        isToday
                          ? "text-blue-600 font-bold"
                          : "text-slate-600"
                      )}
                    >
                      {format(day, "M/d")}
                    </div>
                    <div
                      className={cn(
                        "text-xs font-medium leading-tight",
                        dow === 0 && "text-red-500",
                        dow === 6 && "text-blue-500",
                        dow !== 0 && dow !== 6 && "text-slate-600"
                      )}
                    >
                      {DAY_OF_WEEK_SHORT[dow]}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* バーエリア */}
            {!collapsed && (
              <div className="flex overflow-y-auto" style={{ maxHeight: ROW_HEIGHT * 6 + 16 }}>
                {/* 左カラム: 補足情報 */}
                <div
                  className="flex-shrink-0 border-r border-slate-200 bg-gradient-to-b from-amber-50/30 to-transparent px-3 py-1 sticky left-0 z-10 bg-white"
                  style={{ width: effectiveLeftColWidth, minHeight: contentHeight }}
                >
                  {noDatesCount > 0 && (
                    <div className="text-xs text-slate-600 mt-1">
                      日程未定: {noDatesCount}件
                    </div>
                  )}
                  {outOfRangeCount > 0 && (
                    <div className="text-xs text-slate-600">
                      範囲外: {outOfRangeCount}件
                    </div>
                  )}
                </div>

                {/* ガントバーエリア */}
                <div
                  className="relative flex-1"
                  style={{
                    minHeight: contentHeight,
                    minWidth: totalDayWidth,
                  }}
                >
                  {/* 日付グリッド線 */}
                  <div className="absolute inset-0 flex pointer-events-none">
                    {days.map((day, i) => {
                      const dateKey = format(day, "yyyy-MM-dd")
                      const isToday = isSameDay(day, today)
                      const dow = day.getDay()
                      const colWidth = dayWidths[i]

                      return (
                        <div
                          key={dateKey}
                          className={cn(
                            "border-r border-slate-100 last:border-r-0 h-full",
                            isToday && "bg-blue-50/20",
                            dow === 0 && !isToday && "bg-red-50/10",
                            dow === 6 && !isToday && "bg-blue-50/10"
                          )}
                          style={{
                            width: colWidth,
                            minWidth: colWidth,
                            flexShrink: 0,
                          }}
                        />
                      )
                    })}
                  </div>

                  {/* バー描画 */}
                  {rows.map((row, rowIdx) =>
                    row.map((bar) => {
                      const color = BAR_COLORS[bar.colorIdx]
                      // 可変列幅に基づくバー位置・幅計算
                      const left = colLeftPositions[bar.startIdx] + 3
                      const barRight = colLeftPositions[bar.endIdx] + dayWidths[bar.endIdx]
                      const width = barRight - colLeftPositions[bar.startIdx] - 6
                      const top = rowIdx * ROW_HEIGHT + 4
                      const barHeight = ROW_HEIGHT - 6

                      const label =
                        bar.schedule.name ??
                        bar.schedule.contract.project.name
                      const workType = workTypeLabel(bar.schedule.workType)
                      const companyName =
                        bar.schedule.contract.project.branch.company.name

                      // バーが1日分しかない場合でも最低幅を確保
                      const minWidth = dayColWidth - 6

                      return (
                        <Tooltip key={bar.schedule.id}>
                          <TooltipTrigger asChild>
                            <DraggableBar
                              bar={bar}
                              className="absolute rounded-sm cursor-grab transition-all duration-150 flex items-center px-2 overflow-hidden hover:shadow-lg hover:scale-y-110 hover:z-10"
                              style={{
                                left,
                                width: Math.max(width, minWidth),
                                top,
                                height: barHeight,
                                background: `linear-gradient(135deg, ${color.from} 0%, ${color.to} 100%)`,
                                boxShadow: `0 1px 3px ${color.from}40`,
                              }}
                            >
                              <span className="text-xs font-extrabold text-white truncate leading-none drop-shadow-sm">
                                {label}
                              </span>
                              {width > 140 && (
                                <span className="text-xs text-white/60 truncate ml-1.5 flex-shrink-0 leading-none">
                                  {workType}
                                </span>
                              )}
                            </DraggableBar>
                          </TooltipTrigger>
                          <TooltipContent
                            side="bottom"
                            className="text-xs max-w-[260px] p-3"
                          >
                            <div className="space-y-1">
                              <div className="font-bold text-slate-800">
                                {label}
                              </div>
                              <div className="flex items-center gap-2 text-slate-500">
                                <span className="px-1.5 py-0.5 rounded-sm bg-slate-100 text-xs font-bold">
                                  {workType}
                                </span>
                                <span>{companyName}</span>
                              </div>
                              <div className="text-slate-500">
                                {formatDateRange(
                                  bar.schedule.plannedStartDate,
                                  bar.schedule.plannedEndDate
                                )}
                              </div>
                              <div className="text-slate-500">
                                {formatAmount(
                                  bar.schedule.contract.totalAmount
                                )}
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )
                    })
                  )}

                  {/* バーが0本の場合 */}
                  {rows.length === 0 && (
                    <div className="flex items-center justify-center h-full text-xs text-slate-600">
                      表示期間内に未配置の工程はありません
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

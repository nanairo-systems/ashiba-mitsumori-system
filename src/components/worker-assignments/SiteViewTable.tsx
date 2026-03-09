/**
 * [COMPONENT] 人員配置管理 - 現場ビューテーブル
 *
 * 左列なし：日付セル内に現場情報を表示するガントチャート風レイアウト。
 * - レーンパッキング: 日程が重ならない工程を同じ行にまとめて縦を最小化
 * - 現場情報は開始日セルにバーとして表示
 * - 日付列クリックで全工程のセルが一斉に展開・折りたたみ
 * - 展開セルに班カード表示（班カラー・班名・職人数・車両名）
 * - 「+ 班を追加」ボタン
 * - 左右のはみ出しインジケーター（画面外に工程がある場合）
 * - data-lane-sync による行内高さ同期
 * - 班ビューとデータを共有、どちらで操作しても即時反映
 */
"use client"

import { useState, useMemo, useRef, useLayoutEffect } from "react"
import { format, eachDayOfInterval, addDays, isSameDay, subDays, parseISO } from "date-fns"
import { ja } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { Plus, ChevronDown, ChevronRight, ChevronLeft } from "lucide-react"
import { toast } from "sonner"
import { AssignmentDetailPanel } from "./AssignmentDetailPanel"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import type { TeamData, AssignmentData, DragItemData } from "./types"

interface Props {
  teams: TeamData[]
  assignments: AssignmentData[]
  rangeStart: Date
  displayDays: number
  onDeleteAssignment: (assignmentId: string) => void
  onRefresh: () => void
  activeItem: DragItemData | null
  isDragging: boolean
  hoveredTeamId: string | null
  collapsedDates: Set<string>
  datesWithAssignments: Set<string>
  onToggleDate: (dateKey: string) => void
  scrollRef?: React.RefObject<HTMLDivElement | null>
  onScroll?: () => void
  onRangeStartChange?: (date: Date) => void
  overflow?: {
    left: { count: number; nearest: { id: string; name: string | null; plannedStartDate: string | null; plannedEndDate: string | null; workType: string; contract: { project: { name: string } } } | null }
    right: { count: number; nearest: { id: string; name: string | null; plannedStartDate: string | null; plannedEndDate: string | null; workType: string; contract: { project: { name: string } } } | null }
  }
}

const COLLAPSED_WIDTH = 80
const EXPANDED_WIDTH = 200
const BAR_HEIGHT = 32
const DAY_OF_WEEK_SHORT = ["日", "月", "火", "水", "木", "金", "土"]

/** 丸数字（分割現場のサフィックス） */
const CIRCLE_NUMBERS = ["①", "②", "③", "④", "⑤"]

/** 分割現場のリンクカラーパレット */
const SPLIT_LINK_COLORS = [
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#10b981", // emerald
]

/** レーン内の工程を色で区別するパレット */
const LANE_SCHEDULE_COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#10b981", // emerald
]

function formatAmount(amount: string) {
  const n = Number(amount)
  if (isNaN(n)) return ""
  return `¥${n.toLocaleString()}`
}

function formatDateRange(start: string | null, end: string | null) {
  if (!start) return "日程未定"
  const s = format(new Date(start), "M/d", { locale: ja })
  const e = end ? format(new Date(end), "M/d", { locale: ja }) : s
  return `${s}〜${e}`
}

/** 工程（schedule）ごとのグループ */
interface ScheduleRow {
  scheduleId: string
  scheduleName: string | null
  projectName: string
  address: string | null
  workType: string
  totalAmount: string
  plannedStartDate: string | null
  plannedEndDate: string | null
  assignments: AssignmentData[]
}

/** レーン: 日程が重ならない工程をまとめた1行 */
interface SiteLane {
  laneIndex: number
  schedules: ScheduleRow[]
}

/** 班ごとのグループ（展開セル内で使う） */
interface TeamGroup {
  teamId: string
  teamName: string
  teamColor: string
  workerCount: number
  assignments: AssignmentData[]
}

function groupBySchedule(assignments: AssignmentData[]): ScheduleRow[] {
  const map = new Map<string, ScheduleRow>()
  for (const a of assignments) {
    const key = a.scheduleId
    if (!map.has(key)) {
      map.set(key, {
        scheduleId: a.scheduleId,
        scheduleName: a.schedule.name,
        projectName: a.schedule.contract.project.name,
        address: a.schedule.contract.project.address,
        workType: a.schedule.workType,
        totalAmount: a.schedule.contract.totalAmount,
        plannedStartDate: a.schedule.plannedStartDate,
        plannedEndDate: a.schedule.plannedEndDate,
        assignments: [],
      })
    }
    map.get(key)!.assignments.push(a)
  }
  return Array.from(map.values())
}

function groupByTeam(assignments: AssignmentData[]): TeamGroup[] {
  const nonVehicle = assignments.filter((a) => !a.vehicleId)
  const map = new Map<string, TeamGroup>()
  for (const a of nonVehicle) {
    const key = a.teamId
    if (!map.has(key)) {
      map.set(key, {
        teamId: a.teamId,
        teamName: a.team.name,
        teamColor: a.team.colorCode ?? "#94a3b8",
        workerCount: 0,
        assignments: [],
      })
    }
    const group = map.get(key)!
    group.assignments.push(a)
    if (a.workerId) group.workerCount++
  }
  return Array.from(map.values())
}

export function SiteViewTable({
  teams,
  assignments,
  rangeStart,
  displayDays,
  onDeleteAssignment,
  onRefresh,
  activeItem,
  isDragging,
  hoveredTeamId: _hoveredTeamId,
  collapsedDates,
  datesWithAssignments,
  onToggleDate,
  scrollRef,
  onScroll,
  onRangeStartChange,
  overflow,
}: Props) {
  const [addingTeam, setAddingTeam] = useState<{ scheduleId: string; date: Date } | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const days = useMemo(
    () => eachDayOfInterval({ start: rangeStart, end: addDays(rangeStart, displayDays - 1) }),
    [rangeStart, displayDays]
  )

  const scheduleRows = useMemo(() => groupBySchedule(assignments), [assignments])

  // ── レーンパッキング ──
  const siteLanes = useMemo(() => {
    const schedWithDates = scheduleRows.map((row) => ({
      ...row,
      _start: (row.plannedStartDate ?? "9999-12-31").slice(0, 10),
      _end: (row.plannedEndDate ?? row.plannedStartDate ?? "9999-12-31").slice(0, 10),
    }))
    const sorted = [...schedWithDates].sort((a, b) => {
      const cmp = a._start.localeCompare(b._start)
      return cmp !== 0 ? cmp : a._end.localeCompare(b._end)
    })
    const lanes: SiteLane[] = []
    const laneEnds: string[] = []
    for (const sched of sorted) {
      let lane = -1
      for (let i = 0; i < laneEnds.length; i++) {
        if (laneEnds[i] < sched._start) {
          lane = i
          break
        }
      }
      if (lane === -1) {
        lane = laneEnds.length
        laneEnds.push("")
        lanes.push({ laneIndex: lane, schedules: [] })
      }
      laneEnds[lane] = sched._end
      lanes[lane].schedules.push(sched)
    }
    return lanes
  }, [scheduleRows])

  // レーン内の工程を色で区別するマップ
  const scheduleColorMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const lane of siteLanes) {
      lane.schedules.forEach((sched, idx) => {
        map.set(sched.scheduleId, LANE_SCHEDULE_COLORS[idx % LANE_SCHEDULE_COLORS.length])
      })
    }
    return map
  }, [siteLanes])

  // レーン×日付 → アクティブ工程の高速検索マップ
  const laneDateScheduleMap = useMemo(() => {
    const result = new Map<number, Map<string, ScheduleRow>>()
    for (const lane of siteLanes) {
      const dateMap = new Map<string, ScheduleRow>()
      for (const sched of lane.schedules) {
        for (const day of days) {
          if (isDateInRange(day, sched.plannedStartDate, sched.plannedEndDate)) {
            const dk = format(day, "yyyy-MM-dd")
            dateMap.set(dk, sched)
          }
        }
      }
      result.set(lane.laneIndex, dateMap)
    }
    return result
  }, [siteLanes, days])

  // 各日付セルの幅（展開/折りたたみ依存）
  const dayWidths = useMemo(() => {
    return days.map((day) => {
      const dk = format(day, "yyyy-MM-dd")
      const isExp = datesWithAssignments.has(dk) && !collapsedDates.has(dk)
      return isExp ? EXPANDED_WIDTH : COLLAPSED_WIDTH
    })
  }, [days, datesWithAssignments, collapsedDates])

  // 各セルの累積左端位置
  const dayCumulativeLeft = useMemo(() => {
    const result: number[] = [0]
    for (let i = 0; i < dayWidths.length; i++) {
      result.push(result[i] + dayWidths[i])
    }
    return result
  }, [dayWidths])

  // 各工程のガントバー位置（left, width）
  const scheduleBarPositions = useMemo(() => {
    const result = new Map<string, { left: number; width: number }>()
    for (const lane of siteLanes) {
      for (const sched of lane.schedules) {
        let startIdx = -1
        let endIdx = -1
        for (let i = 0; i < days.length; i++) {
          if (isDateInRange(days[i], sched.plannedStartDate, sched.plannedEndDate)) {
            if (startIdx === -1) startIdx = i
            endIdx = i
          }
        }
        if (startIdx === -1) continue
        const left = dayCumulativeLeft[startIdx]
        const width = dayCumulativeLeft[endIdx + 1] - left
        result.set(sched.scheduleId, { left, width })
      }
    }
    return result
  }, [siteLanes, days, dayCumulativeLeft])

  // 複数班に存在する scheduleId を検出（分割現場）
  const multiTeamSchedules = useMemo(() => {
    const schedTeams = new Map<string, Set<string>>()
    for (const a of assignments) {
      if (!schedTeams.has(a.scheduleId)) schedTeams.set(a.scheduleId, new Set())
      schedTeams.get(a.scheduleId)!.add(a.teamId)
    }
    const result = new Map<string, string[]>()
    for (const [schedId, teamSet] of schedTeams) {
      if (teamSet.size >= 2) result.set(schedId, [...teamSet])
    }
    return result
  }, [assignments])

  // 分割現場ごとのリンクカラーを割り当て
  const splitLinkColorMap = useMemo(() => {
    const map = new Map<string, string>()
    let idx = 0
    for (const schedId of multiTeamSchedules.keys()) {
      map.set(schedId, SPLIT_LINK_COLORS[idx % SPLIT_LINK_COLORS.length])
      idx++
    }
    return map
  }, [multiTeamSchedules])

  // ── 画面外の工程情報（APIから取得） ──
  const leftOverflowCount = overflow?.left.count ?? 0
  const rightOverflowCount = overflow?.right.count ?? 0
  const leftNearest = overflow?.left.nearest ?? null
  const rightNearest = overflow?.right.nearest ?? null

  function isDateInRange(date: Date, start: string | null, end: string | null): boolean {
    if (!start) return false
    const s = new Date(start)
    s.setHours(0, 0, 0, 0)
    const e = end ? new Date(end) : new Date(start)
    e.setHours(0, 0, 0, 0)
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d >= s && d <= e
  }

  async function handleAddTeam(scheduleId: string, teamId: string) {
    try {
      const res = await fetch("/api/worker-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId, teamId, assignedRole: "WORKER" }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? "追加に失敗しました")
      }
      toast.success("班を追加しました")
      setAddingTeam(null)
      onRefresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "追加に失敗しました"
      toast.error(msg)
    }
  }

  function handleNavigateToDate(dateStr: string | null) {
    if (!onRangeStartChange || !dateStr) return
    const d = subDays(parseISO(dateStr), 2)
    onRangeStartChange(d)
  }

  // ── レーン高さ同期 ──
  useLayoutEffect(() => {
    const container = tableRef.current
    if (!container) return

    const allCells = container.querySelectorAll<HTMLElement>('[data-lane-sync]')
    allCells.forEach((el) => {
      el.style.minHeight = ''
    })

    const groups = new Map<string, { maxHeight: number; elements: HTMLElement[] }>()
    allCells.forEach((el) => {
      const key = el.getAttribute('data-lane-sync')!
      if (!groups.has(key)) {
        groups.set(key, { maxHeight: 0, elements: [] })
      }
      const g = groups.get(key)!
      g.elements.push(el)
      const h = el.scrollHeight
      if (h > g.maxHeight) g.maxHeight = h
    })

    groups.forEach(({ maxHeight, elements }) => {
      if (maxHeight > 0) {
        elements.forEach((el) => {
          el.style.minHeight = `${maxHeight}px`
        })
      }
    })
  })

  return (
    <div className="bg-white border rounded-xl overflow-hidden relative">
      {/* 左はみ出しインジケーター */}
      {leftOverflowCount > 0 && onRangeStartChange && (
        <div className="absolute left-0 top-12 bottom-0 z-30 flex items-start pointer-events-none">
          <div className="pointer-events-auto mt-2 ml-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleNavigateToDate(leftNearest?.plannedStartDate ?? null)}
                  className="flex items-center gap-1 px-2.5 py-2 rounded-r-lg bg-amber-500 text-white shadow-lg hover:bg-amber-600 transition-colors animate-pulse"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <div className="text-xs font-bold">
                    <div>{leftOverflowCount}件</div>
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs max-w-[260px]">
                <div className="font-medium mb-1">← 画面左に {leftOverflowCount} 件の工程</div>
                {leftNearest && (
                  <div className="text-slate-300">
                    直近: {leftNearest.name ?? leftNearest.contract.project.name}
                    ({formatDateRange(leftNearest.plannedStartDate, leftNearest.plannedEndDate)})
                  </div>
                )}
                <div className="mt-1 text-slate-400">クリックで移動</div>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}

      {/* 右はみ出しインジケーター */}
      {rightOverflowCount > 0 && onRangeStartChange && (
        <div className="absolute right-0 top-12 bottom-0 z-30 flex items-start pointer-events-none">
          <div className="pointer-events-auto mt-2 mr-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleNavigateToDate(rightNearest?.plannedStartDate ?? null)}
                  className="flex items-center gap-1 px-2.5 py-2 rounded-l-lg bg-amber-500 text-white shadow-lg hover:bg-amber-600 transition-colors animate-pulse"
                >
                  <div className="text-xs font-bold">
                    <div>{rightOverflowCount}件</div>
                  </div>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs max-w-[260px]">
                <div className="font-medium mb-1">→ 画面右に {rightOverflowCount} 件の工程</div>
                {rightNearest && (
                  <div className="text-slate-300">
                    直近: {rightNearest.name ?? rightNearest.contract.project.name}
                    ({formatDateRange(rightNearest.plannedStartDate, rightNearest.plannedEndDate)})
                  </div>
                )}
                <div className="mt-1 text-slate-400">クリックで移動</div>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}

      <div className="overflow-x-auto" ref={scrollRef} onScroll={onScroll}>
        <div ref={tableRef} style={{ minWidth: days.length * COLLAPSED_WIDTH }}>
          {/* 日付ヘッダー */}
          <div className="flex border-b border-slate-200 sticky top-0 z-10 bg-white">
            {days.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd")
              const isExpanded = datesWithAssignments.has(dateKey) && !collapsedDates.has(dateKey)
              const isToday = isSameDay(day, today)
              const dow = day.getDay()

              return (
                <div
                  key={dateKey}
                  className={cn(
                    "px-1 py-1.5 text-center border-r border-slate-100 last:border-r-0 cursor-pointer select-none transition-all duration-200",
                    isExpanded && "bg-blue-100/60",
                    isToday && !isExpanded && "bg-blue-50",
                    !isToday && !isExpanded && dow === 6 && "bg-blue-50/50",
                    !isToday && !isExpanded && dow === 0 && "bg-red-50/50",
                    isToday && "border-b-2 border-blue-500"
                  )}
                  style={{
                    width: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
                    minWidth: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
                    flexShrink: 0,
                  }}
                  onClick={() => datesWithAssignments.has(dateKey) && onToggleDate(dateKey)}
                >
                  <div className="flex items-center justify-center gap-0.5">
                    {datesWithAssignments.has(dateKey) ? (
                      isExpanded ? (
                        <ChevronDown className="w-3 h-3 text-blue-500" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-slate-400" />
                      )
                    ) : null}
                    <span className={cn("text-[10px]", isToday ? "text-blue-600 font-bold" : !datesWithAssignments.has(dateKey) ? "text-slate-300" : "text-slate-400")}>
                      {format(day, "M/d")}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "text-xs font-medium",
                      dow === 0 && "text-red-500",
                      dow === 6 && "text-blue-500",
                      dow !== 0 && dow !== 6 && "text-slate-700"
                    )}
                  >
                    {DAY_OF_WEEK_SHORT[dow]}
                  </div>
                </div>
              )
            })}
          </div>

          {/* レーンごとの行 */}
          {siteLanes.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <span className="text-sm">表示する工程がありません</span>
            </div>
          ) : (
            siteLanes.map((lane) => {
              const hasVisibleSchedules = lane.schedules.some((s) => scheduleBarPositions.has(s.scheduleId))
              return (
                <div key={lane.laneIndex} className="relative border-b border-slate-100 last:border-b-0">
                  {/* ── ガントバー行（工程名・工種・期間を日付列にまたがるバーで表示） ── */}
                  {hasVisibleSchedules && (
                    <div className="flex relative" style={{ height: BAR_HEIGHT }}>
                      {/* 背景セル（日付区切り線） */}
                      {days.map((day) => {
                        const dateKey = format(day, "yyyy-MM-dd")
                        const isExpanded = datesWithAssignments.has(dateKey) && !collapsedDates.has(dateKey)
                        return (
                          <div
                            key={dateKey}
                            className="border-r border-slate-100 last:border-r-0 flex-shrink-0 bg-slate-50/40"
                            style={{
                              width: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
                              minWidth: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
                            }}
                          />
                        )
                      })}
                      {/* バー本体 */}
                      {lane.schedules.map((sched) => {
                        const pos = scheduleBarPositions.get(sched.scheduleId)
                        if (!pos) return null
                        const color = scheduleColorMap.get(sched.scheduleId) ?? "#94a3b8"
                        return (
                          <Tooltip key={sched.scheduleId}>
                            <TooltipTrigger asChild>
                              <div
                                className="absolute z-10 rounded-md px-2 flex items-center gap-2 cursor-default overflow-hidden"
                                style={{
                                  left: pos.left,
                                  width: pos.width,
                                  top: 2,
                                  height: BAR_HEIGHT - 4,
                                  backgroundColor: `${color}20`,
                                  borderLeft: `3px solid ${color}`,
                                }}
                              >
                                <div className="text-[11px] font-semibold text-slate-800 truncate whitespace-nowrap">
                                  {sched.scheduleName ?? sched.projectName}
                                </div>
                                <span className="text-[9px] px-1 rounded bg-white/60 text-slate-500 flex-shrink-0 whitespace-nowrap">
                                  {sched.workType}
                                </span>
                                <span className="text-[9px] text-slate-400 flex-shrink-0 whitespace-nowrap">
                                  {formatDateRange(sched.plannedStartDate, sched.plannedEndDate)}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs max-w-[240px]">
                              <div className="space-y-0.5">
                                <div className="font-medium">{sched.scheduleName ?? sched.projectName}</div>
                                {sched.address && <div className="text-slate-300">{sched.address}</div>}
                                <div className="text-slate-300">{sched.workType}</div>
                                <div className="text-slate-300">{formatAmount(sched.totalAmount)}</div>
                                <div className="text-slate-300">{formatDateRange(sched.plannedStartDate, sched.plannedEndDate)}</div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )
                      })}
                    </div>
                  )}

                  {/* ── セル行（班カード・チーム情報） ── */}
                  <div className="flex hover:bg-slate-50/30 transition-colors">
                    {days.map((day) => {
                      const dateKey = format(day, "yyyy-MM-dd")
                      const isExpanded = datesWithAssignments.has(dateKey) && !collapsedDates.has(dateKey)
                      const isToday = isSameDay(day, today)
                      const dow = day.getDay()

                      const activeSchedule = laneDateScheduleMap.get(lane.laneIndex)?.get(dateKey) ?? null
                      const schedColor = activeSchedule ? (scheduleColorMap.get(activeSchedule.scheduleId) ?? "#94a3b8") : null

                      const dayTeamGroups = activeSchedule
                        ? groupByTeam(
                            activeSchedule.assignments.filter((a) => {
                              const s = a.schedule.plannedStartDate ? new Date(a.schedule.plannedStartDate) : null
                              const e = a.schedule.plannedEndDate ? new Date(a.schedule.plannedEndDate) : s
                              if (!s) return false
                              const d = new Date(day)
                              d.setHours(0, 0, 0, 0)
                              s.setHours(0, 0, 0, 0)
                              if (e) e.setHours(0, 0, 0, 0)
                              return d >= s && d <= (e ?? s)
                            })
                          )
                        : []

                      return (
                        <div
                          key={dateKey}
                          data-lane-sync={`lane:${lane.laneIndex}`}
                          className={cn(
                            "px-1 py-1 border-r border-slate-100 last:border-r-0 transition-all duration-200",
                            isExpanded && activeSchedule && "bg-blue-50/30",
                            isExpanded && !activeSchedule && "bg-slate-50/20",
                            isToday && !isExpanded && "bg-blue-50/50",
                            !isToday && !isExpanded && dow === 6 && "bg-blue-50/30",
                            !isToday && !isExpanded && dow === 0 && "bg-red-50/30",
                            !activeSchedule && !isExpanded && "bg-slate-50/30"
                          )}
                          style={{
                            width: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
                            minWidth: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
                            flexShrink: 0,
                            ...(activeSchedule && schedColor && !isExpanded
                              ? { backgroundColor: `${schedColor}08` }
                              : {}),
                          }}
                        >
                          {!activeSchedule ? (
                            <div className="flex items-center justify-center h-full min-h-[32px]">
                              <span className="text-[7px] text-slate-200">−</span>
                            </div>
                          ) : isExpanded ? (
                            <div className="space-y-1">
                              {dayTeamGroups.map((tg) => {
                                const multiTeams = multiTeamSchedules.get(activeSchedule.scheduleId)
                                const teamSuffix = multiTeams
                                  ? CIRCLE_NUMBERS[multiTeams.indexOf(tg.teamId)] ?? ""
                                  : ""
                                const linkColor = splitLinkColorMap.get(activeSchedule.scheduleId)

                                return (
                                  <div key={tg.teamId}>
                                    <div
                                      className="rounded-md px-2 py-1.5 text-[10px] border transition-all"
                                      style={{
                                        backgroundColor: linkColor ? `${linkColor}15` : `${tg.teamColor}20`,
                                        borderColor: linkColor ? `${linkColor}60` : `${tg.teamColor}40`,
                                        borderLeftWidth: linkColor ? "4px" : undefined,
                                        borderLeftColor: linkColor ?? undefined,
                                      }}
                                    >
                                      <div className="flex items-center gap-1.5">
                                        {teamSuffix && linkColor ? (
                                          <span
                                            className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-white text-[8px] font-bold flex-shrink-0"
                                            style={{ backgroundColor: linkColor }}
                                          >
                                            {teamSuffix}
                                          </span>
                                        ) : (
                                          <div
                                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: tg.teamColor }}
                                          />
                                        )}
                                        <span className="font-medium text-slate-800 truncate">
                                          {tg.teamName}{teamSuffix}
                                        </span>
                                      </div>
                                    </div>

                                    <AssignmentDetailPanel
                                      assignments={tg.assignments}
                                      scheduleName={activeSchedule.scheduleName}
                                      projectName={activeSchedule.projectName}
                                      plannedStartDate={activeSchedule.plannedStartDate}
                                      plannedEndDate={activeSchedule.plannedEndDate}
                                      teamId={tg.teamId}
                                      scheduleId={activeSchedule.scheduleId}
                                      dateKey={dateKey}
                                      accentColor={tg.teamColor}
                                      onRefresh={onRefresh}
                                      isDragging={isDragging}
                                    />
                                  </div>
                                )
                              })}

                              {/* 班追加ボタン */}
                              <div className="relative">
                                <button
                                  onClick={() =>
                                    setAddingTeam(
                                      addingTeam?.scheduleId === activeSchedule.scheduleId
                                        ? null
                                        : { scheduleId: activeSchedule.scheduleId, date: day }
                                    )
                                  }
                                  className="w-full flex items-center justify-center gap-1 py-1.5 rounded-md border border-dashed border-slate-300 text-[10px] text-slate-400 hover:text-blue-500 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                  班を追加
                                </button>

                                {addingTeam?.scheduleId === activeSchedule.scheduleId && (
                                  <div className="absolute top-full left-0 mt-1 z-20 bg-white border rounded-lg shadow-lg p-1 min-w-[140px] max-h-[200px] overflow-y-auto">
                                    {teams
                                      .filter((t) => t.isActive)
                                      .filter((t) => !dayTeamGroups.some((tg) => tg.teamId === t.id))
                                      .map((t) => (
                                        <button
                                          key={t.id}
                                          onClick={() => handleAddTeam(activeSchedule.scheduleId, t.id)}
                                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-slate-700 hover:bg-slate-100 transition-colors"
                                        >
                                          <div
                                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: t.colorCode ?? "#94a3b8" }}
                                          />
                                          {t.name}
                                        </button>
                                      ))}
                                    {teams.filter((t) => t.isActive).filter((t) => !dayTeamGroups.some((tg) => tg.teamId === t.id)).length === 0 && (
                                      <div className="px-2 py-1.5 text-xs text-slate-400">
                                        追加可能な班がありません
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            /* ── 折りたたみ表示 ── */
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className="rounded px-1 py-0.5 min-h-[32px] cursor-default"
                                  style={{
                                    backgroundColor: `${schedColor}12`,
                                    borderLeft: `3px solid ${schedColor}`,
                                  }}
                                >
                                  <div className="space-y-0.5">
                                    {dayTeamGroups.length === 0 ? (
                                      <span className="text-[7px] text-slate-300">−</span>
                                    ) : (
                                      dayTeamGroups.map((tg) => (
                                        <div key={tg.teamId} className="flex items-center gap-0.5 text-[8px]">
                                          <div
                                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: tg.teamColor }}
                                          />
                                          <span className="truncate text-slate-500">{tg.teamName}</span>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs max-w-[200px]">
                                <div className="space-y-0.5">
                                  <div className="font-medium">{activeSchedule.scheduleName ?? activeSchedule.projectName}</div>
                                  <div className="text-slate-300">{activeSchedule.workType}</div>
                                  <div className="text-slate-300">{formatDateRange(activeSchedule.plannedStartDate, activeSchedule.plannedEndDate)}</div>
                                  {dayTeamGroups.map((tg) => (
                                    <div key={tg.teamId} className="text-slate-300">
                                      {tg.teamName}: {tg.workerCount}名
                                    </div>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

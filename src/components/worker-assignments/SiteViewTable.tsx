/**
 * [COMPONENT] 人員配置管理 - 現場ビューテーブル
 *
 * 日付セル内に現場情報を表示するガントチャート風レイアウト。
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

import { useState, useMemo, useRef, useLayoutEffect, useEffect } from "react"
import { format, eachDayOfInterval, addDays, isSameDay } from "date-fns"
import { cn } from "@/lib/utils"
import { Plus, ChevronDown, ChevronRight, X, ArrowRightLeft, Trash2, MoreHorizontal } from "lucide-react"
import { toast } from "sonner"
import { AssignmentDetailPanel } from "./AssignmentDetailPanel"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { OverflowIndicator, formatDateRange, type OverflowData } from "./OverflowIndicator"
import type { TeamData, AssignmentData, DragItemData, WorkerBusyInfo } from "./types"
import { workTypeLabel, workTypeColor } from "./types"

interface Props {
  teams: TeamData[]
  assignments: AssignmentData[]
  rangeStart: Date
  displayDays: number
  onDeleteAssignment: (assignmentId: string) => void
  onBulkDeleteTeamSchedule?: (assignmentIds: string[]) => void
  onMoveTeamSchedule?: (assignmentIds: string[], newTeamId: string) => void
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
  overflow?: OverflowData
  unassignedByDate?: Map<string, number>
  onSiteOpsClick?: (schedule: AssignmentData["schedule"]) => void
}

const FALLBACK_COL_WIDTH = 180
const BAR_HEIGHT = 48
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

/** 工程（schedule）ごとのグループ */
interface ScheduleRow {
  scheduleId: string
  scheduleName: string | null
  projectName: string
  companyName: string
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
        companyName: a.schedule.contract.project.branch.company.name,
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
  onBulkDeleteTeamSchedule,
  onMoveTeamSchedule,
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
  unassignedByDate,
  onSiteOpsClick,
}: Props) {
  const [addingTeam, setAddingTeam] = useState<{ scheduleId: string; date: Date } | null>(null)
  const [actionPopover, setActionPopover] = useState<{
    teamId: string
    scheduleId: string
    scheduleName: string
    assignments: AssignmentData[]
  } | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

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

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const days = useMemo(
    () => eachDayOfInterval({ start: rangeStart, end: addDays(rangeStart, displayDays - 1) }),
    [rangeStart, displayDays]
  )

  // 左列なし: 全幅を日付列に使う
  const dayColWidth = containerWidth > 0
    ? Math.floor(containerWidth / days.length)
    : FALLBACK_COL_WIDTH

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

  // 各セルの累積左端位置
  const dayCumulativeLeft = useMemo(() => {
    const result: number[] = [0]
    for (let i = 0; i < days.length; i++) {
      result.push(result[i] + dayColWidth)
    }
    return result
  }, [days, dayColWidth])

  // 各工程のガントバー位置（left, width）
  const scheduleBarPositions = useMemo(() => {
    const result = new Map<string, { left: number; width: number; startIdx: number; endIdx: number }>()
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
        const width = dayCumulativeLeft[endIdx + 1] - dayCumulativeLeft[startIdx]
        result.set(sched.scheduleId, { left, width, startIdx, endIdx })
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

  // 職人の配置情報（重複検知用）
  const busyWorkerInfoByDate = useMemo(() => {
    const map = new Map<string, Map<string, WorkerBusyInfo>>()
    for (const day of days) {
      const dk = format(day, "yyyy-MM-dd")
      const infoMap = new Map<string, WorkerBusyInfo>()
      for (const a of assignments) {
        if (a.workerId && isDateInRange(day, a.schedule.plannedStartDate, a.schedule.plannedEndDate)) {
          const existing = infoMap.get(a.workerId)
          const siteName = a.schedule?.name ?? a.schedule?.contract?.project?.name ?? "不明"
          if (existing) {
            if (!existing.siteNames.includes(siteName)) existing.siteNames.push(siteName)
          } else {
            infoMap.set(a.workerId, { siteNames: [siteName] })
          }
        }
      }
      map.set(dk, infoMap)
    }
    return map
  }, [assignments, days])

  // ── 画面外の工程情報 ──
  const leftOverflowCount = overflow?.left.count ?? 0
  const leftItems = overflow?.left.items ?? []
  const rightOverflowCount = overflow?.right.count ?? 0
  const rightItems = overflow?.right.items ?? []

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

  // テーブルの全幅（日付列のみ）
  const tableWidth = dayColWidth * days.length

  return (
    <div ref={wrapperRef} className="bg-white border rounded-xl overflow-hidden relative pb-1">
      {onRangeStartChange && (
        <>
          <OverflowIndicator side="left" count={leftOverflowCount} items={leftItems} onNavigate={onRangeStartChange} />
          <OverflowIndicator side="right" count={rightOverflowCount} items={rightItems} onNavigate={onRangeStartChange} />
        </>
      )}

      <div ref={scrollRef} onScroll={onScroll}>
        <div ref={tableRef} style={{ width: tableWidth, minWidth: "100%" }}>
          {/* 日付ヘッダー */}
          <div className="flex border-b-2 border-slate-300 sticky top-0 z-10 bg-white">
            {days.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd")
              const isExpanded = datesWithAssignments.has(dateKey) && !collapsedDates.has(dateKey)
              const isToday = isSameDay(day, today)
              const dow = day.getDay()

              return (
                <div
                  key={dateKey}
                  className={cn(
                    "py-1.5 text-center border-r border-slate-200 last:border-r-0 cursor-pointer select-none transition-all duration-200",
                    isExpanded && "bg-blue-100/60",
                    isToday && !isExpanded && "bg-blue-50",
                    !isToday && !isExpanded && dow === 6 && "bg-blue-50/50",
                    !isToday && !isExpanded && dow === 0 && "bg-red-50/50",
                    isToday && "border-b-2 border-blue-500"
                  )}
                  style={{
                    width: dayColWidth,
                    minWidth: dayColWidth,
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
                    <span className={cn("text-xs", isToday ? "text-blue-600 font-bold" : !datesWithAssignments.has(dateKey) ? "text-slate-500" : "text-slate-600")}>
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
                  {(unassignedByDate?.get(dateKey) ?? 0) > 0 && (
                    <div className="mt-0.5">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                        未{unassignedByDate!.get(dateKey)}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* レーンごとの行 */}
          {siteLanes.length === 0 ? (
            <div className="text-center py-16 text-slate-600">
              <span className="text-sm">表示する工程がありません</span>
            </div>
          ) : (
            siteLanes.map((lane, laneIdx) => {
              const hasVisibleSchedules = lane.schedules.some((s) => scheduleBarPositions.has(s.scheduleId))
              const isLastLane = laneIdx === siteLanes.length - 1
              return (
                <div key={lane.laneIndex} className={cn("relative", !isLastLane && "border-b border-slate-200")}>
                  {/* ── ガントバー行 ── */}
                  {hasVisibleSchedules && (
                    <div className="flex relative" style={{ height: BAR_HEIGHT }}>
                      {/* 背景セル（日付区切り線） */}
                      {days.map((day) => {
                        const dateKey = format(day, "yyyy-MM-dd")
                        return (
                          <div
                            key={dateKey}
                            className="border-r border-slate-100 last:border-r-0 flex-shrink-0 bg-slate-50/30"
                            style={{
                              width: dayColWidth,
                              minWidth: dayColWidth,
                            }}
                          />
                        )
                      })}
                      {/* バー本体 */}
                      {lane.schedules.map((sched) => {
                        const pos = scheduleBarPositions.get(sched.scheduleId)
                        if (!pos) return null
                        const color = scheduleColorMap.get(sched.scheduleId) ?? "#94a3b8"
                        const barWidth = pos.width
                        const isNarrow = barWidth < 120
                        return (
                          <Tooltip key={sched.scheduleId}>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  "absolute z-10 rounded-md px-2 py-1 overflow-hidden",
                                  onSiteOpsClick ? "cursor-pointer hover:shadow-md transition-shadow" : "cursor-default"
                                )}
                                style={{
                                  left: pos.left,
                                  width: barWidth,
                                  top: 3,
                                  height: BAR_HEIGHT - 6,
                                  backgroundColor: `${color}18`,
                                  borderLeft: `4px solid ${color}`,
                                  borderTop: `1px solid ${color}30`,
                                  borderRight: `1px solid ${color}30`,
                                  borderBottom: `1px solid ${color}30`,
                                }}
                                onClick={() => {
                                  if (onSiteOpsClick && sched.assignments[0]) {
                                    onSiteOpsClick(sched.assignments[0].schedule)
                                  }
                                }}
                              >
                                <div className="flex items-center h-full gap-1.5">
                                  {/* 左: 工種ラベル（大きく中央寄せ） */}
                                  <div
                                    className={cn(
                                      "flex-shrink-0 flex items-center justify-center rounded px-1.5 self-stretch font-bold text-[13px] min-w-[32px]",
                                      workTypeColor(sched.workType).bg,
                                      workTypeColor(sched.workType).text
                                    )}
                                  >
                                    {workTypeLabel(sched.workType)}
                                  </div>
                                  {/* 右: 現場名（上）+ 会社名（下） */}
                                  <div className="min-w-0 flex-1 flex flex-col justify-center leading-tight">
                                    <div className="text-sm font-bold text-slate-800 truncate">
                                      {sched.scheduleName ?? sched.projectName}
                                    </div>
                                    <div className="text-xs text-slate-600 truncate">
                                      {sched.companyName}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs max-w-[240px]">
                              <div className="space-y-0.5">
                                <div className="font-medium">{sched.scheduleName ?? sched.projectName}</div>
                                {sched.address && <div className="text-slate-500">{sched.address}</div>}
                                <div className="text-slate-500">{workTypeLabel(sched.workType)}</div>
                                <div className="text-slate-500">{formatAmount(sched.totalAmount)}</div>
                                <div className="text-slate-500">{formatDateRange(sched.plannedStartDate, sched.plannedEndDate)}</div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )
                      })}
                    </div>
                  )}

                  {/* ── セル行（班カード・チーム情報） ── */}
                  <div className="flex">
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
                            "px-1 py-1 border-r border-slate-200 last:border-r-0 transition-all duration-200",
                            isExpanded && activeSchedule && "bg-blue-50/30",
                            isExpanded && !activeSchedule && "bg-slate-50/20",
                            isToday && !isExpanded && "bg-blue-50/50",
                            !isToday && !isExpanded && dow === 6 && "bg-blue-50/30",
                            !isToday && !isExpanded && dow === 0 && "bg-red-50/30",
                            !activeSchedule && !isExpanded && "bg-slate-50/30"
                          )}
                          style={{
                            width: dayColWidth,
                            minWidth: dayColWidth,
                            flexShrink: 0,
                            ...(activeSchedule && schedColor && !isExpanded
                              ? { backgroundColor: `${schedColor}08` }
                              : {}),
                          }}
                        >
                          {!activeSchedule ? (
                            <div className="flex items-center justify-center h-full min-h-[28px]">
                              <span className="text-[9px] text-slate-400">−</span>
                            </div>
                          ) : isExpanded ? (
                            <div className="space-y-1">
                              {dayTeamGroups.map((tg) => {
                                const multiTeams = multiTeamSchedules.get(activeSchedule.scheduleId)
                                const teamSuffix = multiTeams
                                  ? CIRCLE_NUMBERS[multiTeams.indexOf(tg.teamId)] ?? ""
                                  : ""
                                const linkColor = splitLinkColorMap.get(activeSchedule.scheduleId)

                                // 重複配置チェック（同じ日に複数現場に配置されている職人）
                                const duplicateWorkerIds = (() => {
                                  if (dayTeamGroups.length < 2) return undefined
                                  const workerCount = new Map<string, number>()
                                  for (const g of dayTeamGroups) {
                                    const seenW = new Set<string>()
                                    for (const a of g.assignments) {
                                      if (a.workerId && !seenW.has(a.workerId)) {
                                        seenW.add(a.workerId)
                                        workerCount.set(a.workerId, (workerCount.get(a.workerId) ?? 0) + 1)
                                      }
                                    }
                                  }
                                  const dupW = new Set<string>()
                                  for (const [id, c] of workerCount) { if (c > 1) dupW.add(id) }
                                  return dupW.size > 0 ? dupW : undefined
                                })()

                                return (
                                  <div key={tg.teamId}>
                                    <div
                                      className="relative rounded-md px-2 py-1.5 text-xs border transition-all group/team"
                                      style={{
                                        backgroundColor: `${tg.teamColor}30`,
                                        borderColor: `${tg.teamColor}60`,
                                        borderLeftWidth: "4px",
                                        borderLeftColor: tg.teamColor,
                                      }}
                                    >
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-medium text-slate-800 truncate flex-1">
                                          {tg.teamName}{teamSuffix}
                                        </span>
                                        {/* 操作メニューボタン */}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            const isOpen = actionPopover?.teamId === tg.teamId && actionPopover?.scheduleId === activeSchedule.scheduleId
                                            setActionPopover(isOpen ? null : {
                                              teamId: tg.teamId,
                                              scheduleId: activeSchedule.scheduleId,
                                              scheduleName: activeSchedule.scheduleName ?? activeSchedule.projectName,
                                              assignments: tg.assignments,
                                            })
                                          }}
                                          className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover/team:opacity-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-all flex-shrink-0"
                                          title="操作"
                                        >
                                          <MoreHorizontal className="w-3.5 h-3.5" />
                                        </button>
                                      </div>

                                      {/* 操作ポップオーバー */}
                                      {actionPopover?.teamId === tg.teamId && actionPopover?.scheduleId === activeSchedule.scheduleId && (
                                        <div className="mt-1.5 bg-white border border-slate-200 rounded-lg shadow-lg p-1.5 z-30 relative">
                                          {/* 班を変更 */}
                                          <div className="text-xs font-medium text-slate-500 px-2 pt-1 pb-0.5">班を変更</div>
                                          <div className="max-h-[120px] overflow-y-auto">
                                            {teams
                                              .filter((t) => t.isActive && t.id !== tg.teamId)
                                              .map((t) => (
                                                <button
                                                  key={t.id}
                                                  onClick={() => {
                                                    const ids = tg.assignments.map((a) => a.id)
                                                    onMoveTeamSchedule?.(ids, t.id)
                                                    setActionPopover(null)
                                                  }}
                                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                                                >
                                                  <ArrowRightLeft className="w-3 h-3 flex-shrink-0" />
                                                  <div
                                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: t.colorCode ?? "#94a3b8" }}
                                                  />
                                                  <span className="truncate">{t.name}</span>
                                                </button>
                                              ))}
                                          </div>
                                          <div className="border-t border-slate-100 my-1" />
                                          {/* 配置を削除 */}
                                          <button
                                            onClick={() => {
                                              const ids = tg.assignments.map((a) => a.id)
                                              const ok = window.confirm(
                                                `「${tg.teamName}」の「${activeSchedule.scheduleName ?? activeSchedule.projectName}」への配置を削除しますか？\n（職人・車両の配置も全て削除されます）`
                                              )
                                              if (ok) {
                                                onBulkDeleteTeamSchedule?.(ids)
                                                setActionPopover(null)
                                              }
                                            }}
                                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-red-600 hover:bg-red-50 transition-colors font-medium"
                                          >
                                            <Trash2 className="w-3 h-3 flex-shrink-0" />
                                            配置を削除
                                          </button>
                                        </div>
                                      )}
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
                                      duplicateWorkerIds={duplicateWorkerIds}
                                      busyWorkerInfoMap={busyWorkerInfoByDate.get(dateKey)}
                                      compact={displayDays >= 14}
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
                                  className="w-full flex items-center justify-center gap-1 py-1.5 rounded-md border border-dashed border-slate-300 text-xs text-slate-600 hover:text-blue-500 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
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
                                      <div className="px-2 py-1.5 text-xs text-slate-600">
                                        追加可能な班がありません
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            /* ── 折りたたみ表示（現場名を常に表示） ── */
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className="rounded px-1 py-0.5 min-h-[28px] cursor-default"
                                  style={{
                                    backgroundColor: `${schedColor}10`,
                                    borderLeft: `3px solid ${schedColor}`,
                                  }}
                                >
                                  <div className="space-y-0">
                                    {dayTeamGroups.length === 0 ? (
                                      <span className="text-[9px] text-slate-500">−</span>
                                    ) : (
                                      dayTeamGroups.map((tg) => (
                                        <div
                                          key={tg.teamId}
                                          className="flex items-center text-xs rounded px-1"
                                          style={{ backgroundColor: `${tg.teamColor}25` }}
                                        >
                                          <span className="truncate text-slate-700 font-medium">{tg.teamName}</span>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs max-w-[200px]">
                                <div className="space-y-0.5">
                                  <div className="font-medium">{activeSchedule.scheduleName ?? activeSchedule.projectName}</div>
                                  <div className="text-slate-500">{workTypeLabel(activeSchedule.workType)}</div>
                                  <div className="text-slate-500">{formatDateRange(activeSchedule.plannedStartDate, activeSchedule.plannedEndDate)}</div>
                                  {dayTeamGroups.map((tg) => (
                                    <div key={tg.teamId} className="text-slate-500">
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

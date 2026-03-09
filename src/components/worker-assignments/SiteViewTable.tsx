/**
 * [COMPONENT] 人員配置管理 - 現場ビューテーブル
 *
 * 左列に工程（現場名・工種・工期・金額）、右側に日付セルを表示。
 * - レーンパッキング: 日程が重ならない工程を同じ行にまとめて縦を最小化
 * - 日付列クリックで全工程のセルが一斉に展開・折りたたみ
 * - 展開セルに班カード表示（班カラー・班名・職人数・車両名）
 * - 班カードクリックで詳細パネル（職人・車両管理）
 * - 「+ 班を追加」ボタン
 * - 班ビューとデータを共有、どちらで操作しても即時反映
 */
"use client"

import { useState, useMemo } from "react"
import { format, eachDayOfInterval, addDays, isSameDay } from "date-fns"
import { ja } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { Plus, ChevronDown, ChevronRight } from "lucide-react"
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
}

const LEFT_COL_WIDTH = 220
const COLLAPSED_WIDTH = 80
const EXPANDED_WIDTH = 200
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
  // 車両アサインメントを除外（車両は班レベルで管理）
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
}: Props) {
  // 詳細パネルは常時展開
  const [addingTeam, setAddingTeam] = useState<{ scheduleId: string; date: Date } | null>(null)

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

  // ── レーンパッキング: 日程が重ならない工程を同じ行にまとめる ──
  const siteLanes = useMemo(() => {
    const schedWithDates = scheduleRows.map((row) => ({
      ...row,
      _start: (row.plannedStartDate ?? "9999-12-31").slice(0, 10),
      _end: (row.plannedEndDate ?? row.plannedStartDate ?? "9999-12-31").slice(0, 10),
    }))
    // 開始日順、同日なら終了日順でソート
    const sorted = [...schedWithDates].sort((a, b) => {
      const cmp = a._start.localeCompare(b._start)
      return cmp !== 0 ? cmp : a._end.localeCompare(b._end)
    })
    // 貪欲法: 空いている一番上のレーンに詰める
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

  // 各工程の14日間内の最初の表示日
  const scheduleFirstVisibleDate = useMemo(() => {
    const map = new Map<string, string>()
    for (const lane of siteLanes) {
      for (const sched of lane.schedules) {
        for (const day of days) {
          if (isDateInRange(day, sched.plannedStartDate, sched.plannedEndDate)) {
            if (!map.has(sched.scheduleId)) {
              map.set(sched.scheduleId, format(day, "yyyy-MM-dd"))
            }
            break
          }
        }
      }
    }
    return map
  }, [siteLanes, days])

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

  const hasAnyExpanded = [...datesWithAssignments].some((dk) => !collapsedDates.has(dk))

  return (
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="overflow-x-auto" ref={scrollRef} onScroll={onScroll}>
          <div style={{ minWidth: LEFT_COL_WIDTH + days.length * COLLAPSED_WIDTH }}>
            {/* 日付ヘッダー */}
            <div className="flex border-b border-slate-200 sticky top-0 z-10 bg-white">
              <div
                className="flex-shrink-0 px-3 py-2 border-r border-slate-200 bg-slate-50 flex items-center sticky left-0 z-20"
                style={{ width: LEFT_COL_WIDTH }}
              >
                <span className="text-xs font-semibold text-slate-600">工程（現場）</span>
              </div>

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

            {/* レーンごとの行（レーンパッキング済み） */}
            {siteLanes.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <span className="text-sm">表示する工程がありません</span>
              </div>
            ) : (
              siteLanes.map((lane) => (
                <div key={lane.laneIndex} className="flex border-b border-slate-100 last:border-b-0 hover:bg-slate-50/30 transition-colors">
                  {/* 左列: レーン内の工程リスト */}
                  <div
                    className="flex-shrink-0 px-2 py-2 border-r border-slate-200 bg-white sticky left-0 z-10"
                    style={{ width: LEFT_COL_WIDTH, minHeight: hasAnyExpanded ? 80 : 64 }}
                  >
                    <div className="space-y-1.5">
                      {lane.schedules.map((sched) => {
                        const color = scheduleColorMap.get(sched.scheduleId) ?? "#94a3b8"
                        return (
                          <Tooltip key={sched.scheduleId}>
                            <TooltipTrigger asChild>
                              <div className="flex items-start gap-1.5 min-w-0">
                                <div
                                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0 mt-0.5"
                                  style={{ backgroundColor: color }}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="text-[11px] font-medium text-slate-700 truncate leading-tight">
                                    {sched.scheduleName ?? sched.projectName}
                                  </div>
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <span className="text-[9px] px-1 py-0 rounded bg-slate-100 text-slate-500">
                                      {sched.workType}
                                    </span>
                                    <span className="text-[9px] text-slate-400">
                                      {formatDateRange(sched.plannedStartDate, sched.plannedEndDate)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="text-xs max-w-[240px]">
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
                  </div>

                  {/* 日付セル */}
                  {days.map((day) => {
                    const dateKey = format(day, "yyyy-MM-dd")
                    const isExpanded = datesWithAssignments.has(dateKey) && !collapsedDates.has(dateKey)
                    const isToday = isSameDay(day, today)
                    const dow = day.getDay()

                    // このレーン×この日にアクティブな工程を検索
                    const activeSchedule = laneDateScheduleMap.get(lane.laneIndex)?.get(dateKey) ?? null
                    const schedColor = activeSchedule ? (scheduleColorMap.get(activeSchedule.scheduleId) ?? "#94a3b8") : null
                    const isFirstVisible = activeSchedule ? scheduleFirstVisibleDate.get(activeSchedule.scheduleId) === dateKey : false

                    // この工程・この日に配置されている班
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
                          minHeight: hasAnyExpanded ? 80 : 64,
                          flexShrink: 0,
                          // アクティブ工程のセルに薄い色付き背景
                          ...(activeSchedule && schedColor && !isExpanded
                            ? { backgroundColor: `${schedColor}08` }
                            : {}),
                        }}
                      >
                        {!activeSchedule ? (
                          /* ── 工程なし: 空セル ── */
                          <div className="flex items-center justify-center h-full min-h-[32px]">
                            <span className="text-[7px] text-slate-200">−</span>
                          </div>
                        ) : isExpanded ? (
                          /* ── 展開表示 ── */
                          <div className="space-y-1">
                            {/* 初日のみ: 工程情報ヘッダー */}
                            {isFirstVisible && (
                              <div
                                className="rounded-md px-2 py-1.5 mb-1 border-l-[3px]"
                                style={{
                                  backgroundColor: `${schedColor}10`,
                                  borderLeftColor: schedColor ?? "#94a3b8",
                                }}
                              >
                                <div className="text-[11px] font-semibold text-slate-800 truncate">
                                  {activeSchedule.scheduleName ?? activeSchedule.projectName}
                                </div>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className="text-[9px] px-1 py-0 rounded bg-white/60 text-slate-500">
                                    {activeSchedule.workType}
                                  </span>
                                  <span className="text-[9px] text-slate-400">
                                    {formatAmount(activeSchedule.totalAmount)}
                                  </span>
                                </div>
                              </div>
                            )}

                            {dayTeamGroups.map((tg) => {
                              const multiTeams = multiTeamSchedules.get(activeSchedule.scheduleId)
                              const teamSuffix = multiTeams
                                ? CIRCLE_NUMBERS[multiTeams.indexOf(tg.teamId)] ?? ""
                                : ""
                              const linkColor = splitLinkColorMap.get(activeSchedule.scheduleId)

                              return (
                                <div key={tg.teamId}>
                                  {/* 班カードヘッダー */}
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

                                  {/* 詳細パネル（常時展開） */}
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

                              {/* チーム選択ポップオーバー */}
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
                                {/* 初日のみ工程名略称 */}
                                {isFirstVisible && (
                                  <div className="text-[9px] font-medium text-slate-700 truncate leading-tight mb-0.5">
                                    {(activeSchedule.scheduleName ?? activeSchedule.projectName).slice(0, 8)}
                                  </div>
                                )}
                                {/* チーム情報 */}
                                <div className="space-y-0.5">
                                  {dayTeamGroups.length === 0 ? (
                                    !isFirstVisible && (
                                      <span className="text-[7px] text-slate-300">−</span>
                                    )
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
              ))
            )}
          </div>
        </div>
      </div>
  )
}

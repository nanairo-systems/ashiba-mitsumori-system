/**
 * [COMPONENT] 人員配置管理 - 班ビューテーブル
 *
 * 左列に班名・カラー、右側に14日分の日付セルを表示。
 * - 日付列クリックで全班のセルが一斉に展開・折りたたみ
 * - 展開セルに現場カード表示（班カラー、現場名、金額、工期）
 * - 現場カードクリックで詳細パネル（職人・車両管理）
 * - 「+ 現場を追加」ボタン
 * - 「+ 行を追加」ボタンで同じ班に行を追加
 * - @dnd-kit によるドラッグ&ドロップ（現場カード・職人カード）
 */
"use client"

import { useState, useMemo, useCallback, useRef, useLayoutEffect } from "react"
import { format, eachDayOfInterval, addDays, isSameDay, isWeekend } from "date-fns"
import { ja } from "date-fns/locale"
import { useDraggable, useDroppable } from "@dnd-kit/core"
import { cn } from "@/lib/utils"
import { Plus, X, ChevronDown, ChevronRight } from "lucide-react"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { AssignmentDetailPanel, type CopyableSourceInfo } from "./AssignmentDetailPanel"
import { TeamVehicleSection } from "./TeamVehicleSection"
import type { TeamData, AssignmentData, TeamRow, DragItemData, SiteCardDragData, SiteCardDropData, TeamCellDropData, UnassignedBarDragData } from "./types"

interface Props {
  teams: TeamData[]
  assignments: AssignmentData[]
  rangeStart: Date
  displayDays: number
  onAddClick: (teamId: string, date: Date) => void
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

const LEFT_COL_WIDTH = 160
const COLLAPSED_WIDTH = 80
const EXPANDED_WIDTH = 200
const DAY_OF_WEEK_SHORT = ["日", "月", "火", "水", "木", "金", "土"]

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

/** 会社名ごとにくっきりした色を割り当てるパレット */
const COMPANY_COLORS = [
  "#2563eb", // 青
  "#dc2626", // 赤
  "#059669", // 緑
  "#7c3aed", // 紫
  "#d97706", // 橙
  "#0891b2", // 水色
  "#be185d", // ピンク
  "#4338ca", // 藍
  "#15803d", // 深緑
  "#b91c1c", // 暗赤
  "#7e22ce", // 濃紫
  "#0369a1", // 濃青
]

/** 会社名→色のマッピングキャッシュ */
const companyColorCache = new Map<string, string>()

function getCompanyColor(companyName: string): string {
  if (companyColorCache.has(companyName)) return companyColorCache.get(companyName)!
  const idx = companyColorCache.size % COMPANY_COLORS.length
  const color = COMPANY_COLORS[idx]
  companyColorCache.set(companyName, color)
  return color
}

/** 指定日にこの配置が有効かどうかを判定（assignedDate / excludedDates 考慮） */
function isDateInScheduleRange(date: Date, assignment: AssignmentData): boolean {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)

  // assignedDate がある場合: その日だけ有効
  if (assignment.assignedDate) {
    const ad = new Date(assignment.assignedDate)
    ad.setHours(0, 0, 0, 0)
    return d.getTime() === ad.getTime()
  }

  // 通常: スケジュール範囲でチェック
  const start = assignment.schedule.plannedStartDate
    ? new Date(assignment.schedule.plannedStartDate)
    : null
  const end = assignment.schedule.plannedEndDate
    ? new Date(assignment.schedule.plannedEndDate)
    : null
  if (!start) return false
  const endDate = end ?? start
  const s = new Date(start)
  s.setHours(0, 0, 0, 0)
  const e = new Date(endDate)
  e.setHours(0, 0, 0, 0)
  if (d < s || d > e) return false

  // excludedDates チェック
  if (assignment.excludedDates?.length) {
    for (const excl of assignment.excludedDates) {
      const ed = new Date(excl)
      ed.setHours(0, 0, 0, 0)
      if (d.getTime() === ed.getTime()) return false
    }
  }

  return true
}

/** 同じ schedule+team のアサイン群をグループ化 */
interface ScheduleGroup {
  scheduleId: string
  scheduleName: string | null
  projectName: string
  companyName: string
  workType: string
  totalAmount: string
  plannedStartDate: string | null
  plannedEndDate: string | null
  assignments: AssignmentData[]
}

function groupBySchedule(assignments: AssignmentData[]): ScheduleGroup[] {
  const map = new Map<string, ScheduleGroup>()
  for (const a of assignments) {
    const key = a.scheduleId
    if (!map.has(key)) {
      map.set(key, {
        scheduleId: a.scheduleId,
        scheduleName: a.schedule.name,
        projectName: a.schedule.contract.project.name,
        companyName: a.schedule.contract.project.branch.company.name,
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

// ── DnD サブコンポーネント ──

/** ドラッグ可能＆ドロップ可能な現場カードのラッパー */
function DraggableSiteCard({
  id,
  data,
  dropData,
  children,
  activeDragType,
}: {
  id: string
  data: SiteCardDragData
  dropData: SiteCardDropData
  children: React.ReactNode
  activeDragType?: string
}) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id, data })
  const { isOver, setNodeRef: setDropRef } = useDroppable({
    id: `site-drop:${data.scheduleId}:${data.teamId}:${data.dateKey}`,
    data: dropData,
  })
  const showSwapHighlight = isOver && activeDragType === "site-card"
  return (
    <div
      ref={(node) => { setDragRef(node); setDropRef(node) }}
      style={isDragging ? { opacity: 0.3 } : undefined}
      className={cn(showSwapHighlight && "ring-2 ring-orange-400 rounded-md")}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  )
}

/** ドロップ可能なチームセル（展開時のみ使用） */
function DroppableTeamCell({
  id,
  data,
  children,
  activeDragType,
  activeDragDateKey,
  isInDragDateRange,
}: {
  id: string
  data: TeamCellDropData
  children: React.ReactNode
  activeDragType?: string
  activeDragDateKey?: string
  /** 未配置バードラッグ中、このセルが工程の日付範囲内 & ホバー中チーム */
  isInDragDateRange?: boolean
}) {
  const { isOver, setNodeRef } = useDroppable({ id, data })
  const isDirectHover =
    isOver && (
      (activeDragType === "site-card" && activeDragDateKey === data.dateKey) ||
      activeDragType === "unassigned-bar"
    )
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "h-full",
        // ドラッグ中: ホバー中チームの日付範囲セルを緑ハイライト
        isInDragDateRange && !isDirectHover && "ring-2 ring-emerald-400 ring-inset rounded bg-emerald-50/40",
        // 直接ホバー中のセル: より強いハイライト
        isDirectHover && "ring-2 ring-emerald-500 ring-inset rounded bg-emerald-100/60",
      )}
    >
      {children}
    </div>
  )
}

// ── メインコンポーネント ──

export function WorkerAssignmentTable({
  teams,
  assignments,
  rangeStart,
  displayDays,
  onAddClick,
  onDeleteAssignment,
  onRefresh,
  activeItem,
  isDragging,
  hoveredTeamId,
  collapsedDates,
  datesWithAssignments,
  onToggleDate,
  scrollRef,
  onScroll,
}: Props) {
  const [extraRows, setExtraRows] = useState<Map<string, number>>(new Map())
  const tableRef = useRef<HTMLDivElement>(null)

  // ドラッグ中の工程の日付範囲を計算（未配置バー・現場カード共通）
  const dragDateRange = useMemo(() => {
    if (!activeItem) return null
    if (activeItem.type === "unassigned-bar") {
      const d = activeItem as UnassignedBarDragData
      if (!d.plannedStartDate) return null
      return { start: d.plannedStartDate.slice(0, 10), end: (d.plannedEndDate ?? d.plannedStartDate).slice(0, 10) }
    }
    if (activeItem.type === "site-card") {
      const d = activeItem as SiteCardDragData
      if (!d.plannedStartDate) return null
      return { start: d.plannedStartDate.slice(0, 10), end: (d.plannedEndDate ?? d.plannedStartDate).slice(0, 10) }
    }
    return null
  }, [activeItem])

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const days = useMemo(
    () => eachDayOfInterval({ start: rangeStart, end: addDays(rangeStart, displayDays - 1) }),
    [rangeStart, displayDays]
  )

  const assignmentsByTeam = useMemo(() => {
    const map = new Map<string, AssignmentData[]>()
    for (const a of assignments) {
      const list = map.get(a.teamId) ?? []
      list.push(a)
      map.set(a.teamId, list)
    }
    return map
  }, [assignments])

  /**
   * チームごとに工程を「レーン（行）」に振り分ける。
   * - 日程が重ならない工程は同じレーンに入れて行数を最小化
   * - 同じ現場は必ず同じレーン（行位置）に表示される
   * - 開始日順でソートし、空いているレーンの上から詰める
   */
  const teamLaneAssignment = useMemo(() => {
    const result = new Map<string, { laneCount: number; scheduleToLane: Map<string, number> }>()
    for (const team of teams) {
      const teamAssigns = assignmentsByTeam.get(team.id) ?? []
      // 全展開日で登場する工程を収集（日付範囲付き）
      const schedMap = new Map<string, { scheduleId: string; start: string; end: string }>()
      for (const day of days) {
        const dateKey = format(day, "yyyy-MM-dd")
        const isExpanded = datesWithAssignments.has(dateKey) && !collapsedDates.has(dateKey)
        if (!isExpanded) continue
        const dayAssigns = teamAssigns.filter((a) => isDateInScheduleRange(day, a))
        const groups = groupBySchedule(dayAssigns)
        for (const g of groups) {
          if (!schedMap.has(g.scheduleId)) {
            schedMap.set(g.scheduleId, {
              scheduleId: g.scheduleId,
              start: (g.plannedStartDate ?? "9999").slice(0, 10),
              end: (g.plannedEndDate ?? g.plannedStartDate ?? "9999").slice(0, 10),
            })
          }
        }
      }
      // 開始日順でソート
      const sorted = Array.from(schedMap.values()).sort((a, b) => a.start.localeCompare(b.start))
      // 貪欲法: 空いている一番上のレーンに詰める
      const laneEnds: string[] = [] // laneEnds[i] = そのレーンに最後に入った工程の終了日
      const scheduleToLane = new Map<string, number>()
      for (const sched of sorted) {
        let lane = -1
        for (let i = 0; i < laneEnds.length; i++) {
          if (laneEnds[i] < sched.start) { // 重なりなし → このレーンに入れる
            lane = i
            break
          }
        }
        if (lane === -1) { // 空きなし → 新レーン追加
          lane = laneEnds.length
          laneEnds.push("")
        }
        laneEnds[lane] = sched.end
        scheduleToLane.set(sched.scheduleId, lane)
      }
      result.set(team.id, { laneCount: laneEnds.length, scheduleToLane })
    }
    return result
  }, [teams, assignmentsByTeam, days, collapsedDates, datesWithAssignments])

  // toggleCard は不要（詳細パネル常時展開）

  /**
   * レーン高さ同期: 全日付列にまたがって同じチーム・同じレーンの高さを揃える。
   * スペーサー（空きレーン）もカードと同じ高さになるので、横一列に完全に揃う。
   */
  useLayoutEffect(() => {
    const container = tableRef.current
    if (!container) return

    // 1. 全レーンセルの min-height をリセット（自然な高さに戻す）
    const allCells = container.querySelectorAll<HTMLElement>('[data-lane-sync]')
    allCells.forEach((el) => {
      el.style.minHeight = ''
    })

    // 2. 自然な高さを測定し、チーム+レーン ごとにグルーピング
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

    // 3. 各グループ内の全セルに最大高さを適用
    groups.forEach(({ maxHeight, elements }) => {
      if (maxHeight > 0) {
        elements.forEach((el) => {
          el.style.minHeight = `${maxHeight}px`
        })
      }
    })
  })

  const addRow = useCallback((teamId: string) => {
    setExtraRows((prev) => {
      const next = new Map(prev)
      next.set(teamId, (next.get(teamId) ?? 0) + 1)
      return next
    })
  }, [])

  const removeRow = useCallback((teamId: string) => {
    setExtraRows((prev) => {
      const next = new Map(prev)
      const count = next.get(teamId) ?? 0
      if (count <= 1) next.delete(teamId)
      else next.set(teamId, count - 1)
      return next
    })
  }, [])

  function getTeamRows(teamId: string): TeamRow[] {
    const extra = extraRows.get(teamId) ?? 0
    const rows: TeamRow[] = [{ teamId, rowIndex: 0 }]
    for (let i = 1; i <= extra; i++) {
      rows.push({ teamId, rowIndex: i })
    }
    return rows
  }

  const hasAnyExpanded = [...datesWithAssignments].some((dk) => !collapsedDates.has(dk))

  return (
      <div ref={tableRef} className="bg-white border rounded-xl overflow-hidden">
        <div className="overflow-x-auto" ref={scrollRef} onScroll={onScroll}>
          <div style={{ minWidth: LEFT_COL_WIDTH + days.length * COLLAPSED_WIDTH }}>
            {/* 日付ヘッダー */}
            <div className="flex border-b border-slate-200 sticky top-0 z-10 bg-white">
              <div
                className="flex-shrink-0 px-3 py-2 border-r border-slate-200 bg-slate-50 flex items-center sticky left-0 z-20"
                style={{ width: LEFT_COL_WIDTH }}
              >
                <span className="text-sm font-bold text-slate-700">班名</span>
              </div>

              {days.map((day) => {
                const dateKey = format(day, "yyyy-MM-dd")
                const isExpanded = datesWithAssignments.has(dateKey) && !collapsedDates.has(dateKey)
                const isToday = isSameDay(day, today)
                const isWknd = isWeekend(day)
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
                      <span className={cn("text-xs", isToday ? "text-blue-600 font-bold" : !datesWithAssignments.has(dateKey) ? "text-slate-300" : "text-slate-500")}>{format(day, "M/d")}</span>
                    </div>
                    <div
                      className={cn(
                        "text-sm font-bold",
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

            {/* 班ごとの行 */}
            {teams.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <span className="text-sm">表示する班がありません</span>
              </div>
            ) : (
              teams.map((team) => {
                const teamAssignments = assignmentsByTeam.get(team.id) ?? []
                const rows = getTeamRows(team.id)

                return (
                  <div key={team.id} className="border-b border-slate-100 last:border-b-0">
                    {rows.map((row) => {
                      const isMainRow = row.rowIndex === 0
                      const rowHasAssignment = false

                      return (
                        <div
                          key={`${team.id}-${row.rowIndex}`}
                          className="flex hover:bg-slate-50/30 transition-colors"
                        >
                          {/* 班名列 */}
                          <div
                            className="flex-shrink-0 px-3 py-3 border-r border-slate-200 bg-white sticky left-0 z-10"
                            style={{ width: LEFT_COL_WIDTH, minHeight: hasAnyExpanded ? 80 : 64 }}
                          >
                            {isMainRow ? (
                              <div className="flex items-start gap-2">
                                <div
                                  className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5"
                                  style={{ backgroundColor: team.colorCode ?? "#94a3b8" }}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-bold text-slate-800 truncate">
                                    {team.name}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {teamAssignments.length > 0
                                      ? `${new Set(teamAssignments.map((a) => a.workerId).filter(Boolean)).size}名配置`
                                      : "未配置"}
                                  </div>
                                  <button
                                    onClick={() => addRow(team.id)}
                                    className="mt-1.5 flex items-center gap-0.5 text-xs text-blue-500 hover:text-blue-700 transition-colors font-medium"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    行を追加
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between h-full">
                                <span className="text-[10px] text-slate-300">
                                  {team.name} ({row.rowIndex + 1})
                                </span>
                                {!rowHasAssignment && (
                                  <button
                                    onClick={() => removeRow(team.id)}
                                    className="p-0.5 text-slate-300 hover:text-red-500 transition-colors"
                                    title="行を削除"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* 日付セル */}
                          {days.map((day) => {
                            const dateKey = format(day, "yyyy-MM-dd")
                            const isExpanded = datesWithAssignments.has(dateKey) && !collapsedDates.has(dateKey)
                            const isToday = isSameDay(day, today)
                            const isWknd = isWeekend(day)

                            const dayAssignments = isMainRow
                              ? teamAssignments.filter((a) => isDateInScheduleRange(day, a))
                              : []

                            // 車両アサインメントを分離（班レベルで管理）
                            const vehicleAssignmentsForDay = dayAssignments.filter((a) => a.vehicleId)
                            const nonVehicleAssignments = dayAssignments.filter((a) => !a.vehicleId)

                            // schedule ごとにグループ化（車両を除く）
                            const scheduleGroups = isExpanded ? groupBySchedule(nonVehicleAssignments) : []

                            // ホスト現場（車両の scheduleId として使用する最初の現場）
                            const hostGroup = scheduleGroups[0] ?? null

                            // 重複配置チェック: 同じ日に複数の現場に配置されている職人
                            const duplicateWorkerIds = (() => {
                              if (scheduleGroups.length < 2) return undefined
                              const workerCount = new Map<string, number>()
                              for (const g of scheduleGroups) {
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
                              <div
                                key={dateKey}
                                className={cn(
                                  "px-1 py-1 border-r border-slate-100 last:border-r-0 transition-all duration-200",
                                  isExpanded && "bg-blue-50/30",
                                  isToday && !isExpanded && "bg-blue-50/50",
                                  isWknd && !isToday && !isExpanded && "bg-slate-50/50"
                                )}
                                style={{
                                  width: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
                                  minWidth: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
                                  minHeight: hasAnyExpanded ? 80 : 64,
                                  flexShrink: 0,
                                }}
                              >
                                {isExpanded ? (
                                  /* ── 展開表示（ドロップ可能エリア） ── */
                                  <DroppableTeamCell
                                    id={`team-cell:${team.id}:${dateKey}`}
                                    data={{ type: "team-cell", teamId: team.id, dateKey }}
                                    activeDragType={activeItem?.type}
                                    activeDragDateKey={
                                      activeItem?.type === "site-card" ? activeItem.dateKey : undefined
                                    }
                                    isInDragDateRange={
                                      !!dragDateRange && hoveredTeamId === team.id &&
                                      dateKey >= dragDateRange.start && dateKey <= dragDateRange.end
                                    }
                                  >
                                    {(() => {
                                      // レーン方式: 同じ現場は同じ行、重ならない現場は行を再利用
                                      const scheduleGroupsMap = new Map(scheduleGroups.map((g) => [g.scheduleId, g]))
                                      const laneInfo = teamLaneAssignment.get(team.id)
                                      const laneCount = laneInfo?.laneCount ?? 0
                                      const scheduleToLane = laneInfo?.scheduleToLane ?? new Map<string, number>()

                                      // この日の各レーンに入る工程を配置
                                      const lanes: (ScheduleGroup | null)[] = Array(laneCount).fill(null)
                                      for (const [schedId, group] of scheduleGroupsMap) {
                                        const lane = scheduleToLane.get(schedId)
                                        if (lane !== undefined && lane < laneCount) lanes[lane] = group
                                      }

                                      return (
                                        <div className="space-y-1">
                                          {/* 班レベル車両セクション */}
                                          {hostGroup && (
                                            <TeamVehicleSection
                                              vehicleAssignments={vehicleAssignmentsForDay}
                                              teamId={team.id}
                                              dateKey={dateKey}
                                              hostScheduleId={hostGroup.scheduleId}
                                              hostScheduleDates={{
                                                start: hostGroup.plannedStartDate,
                                                end: hostGroup.plannedEndDate,
                                              }}
                                              accentColor={team.colorCode ?? "#94a3b8"}
                                              onRefresh={onRefresh}
                                            />
                                          )}

                                          {lanes.map((group, laneIdx) => {
                                            if (!group) {
                                              // ── 空きレーン: useLayoutEffect で高さが同期される ──
                                              return <div key={`spacer-${laneIdx}`} data-lane-sync={`${team.id}:${laneIdx}`} />
                                            }

                                            // ── 現場カード ──
                                            const siteCardData: SiteCardDragData = {
                                              type: "site-card",
                                              scheduleId: group.scheduleId,
                                              teamId: team.id,
                                              dateKey,
                                              scheduleName: group.scheduleName,
                                              projectName: group.projectName,
                                              teamColor: team.colorCode ?? "#94a3b8",
                                              workType: group.workType,
                                              formattedAmount: formatAmount(group.totalAmount),
                                              formattedDateRange: formatDateRange(
                                                group.plannedStartDate,
                                                group.plannedEndDate
                                              ),
                                              assignmentIds: group.assignments.map((a) => a.id),
                                              workerCount: group.assignments.filter((a) => a.workerId).length,
                                              plannedStartDate: group.plannedStartDate,
                                              plannedEndDate: group.plannedEndDate,
                                            }

                                            const siteDropData: SiteCardDropData = {
                                              type: "site-card-drop",
                                              scheduleId: group.scheduleId,
                                              teamId: team.id,
                                              dateKey,
                                              assignmentIds: group.assignments.map((a) => a.id),
                                            }

                                            const companyColor = getCompanyColor(group.companyName)

                                            return (
                                              <div key={group.scheduleId} data-lane-sync={`${team.id}:${laneIdx}`}>
                                                <DraggableSiteCard
                                                  id={`site:${group.scheduleId}:${team.id}:${dateKey}`}
                                                  data={siteCardData}
                                                  dropData={siteDropData}
                                                  activeDragType={activeItem?.type}
                                                >
                                                  <div
                                                    className="relative rounded-lg px-2.5 py-1.5 text-xs transition-all shadow-sm"
                                                    style={{
                                                      backgroundColor: `${companyColor}15`,
                                                      borderTop: `2px solid ${companyColor}50`,
                                                      borderRight: `2px solid ${companyColor}50`,
                                                      borderBottom: `2px solid ${companyColor}50`,
                                                      borderLeft: `5px solid ${companyColor}`,
                                                    }}
                                                  >
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation()
                                                        const mainAssignment =
                                                          group.assignments.find(
                                                            (a) => !a.workerId && !a.vehicleId
                                                          ) ?? group.assignments[0]
                                                        if (mainAssignment) {
                                                          const ok = window.confirm(`「${group.scheduleName ?? group.projectName}」の配置を削除しますか？`)
                                                          if (ok) onDeleteAssignment(mainAssignment.id)
                                                        }
                                                      }}
                                                      className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center hover:bg-red-100 text-slate-300 hover:text-red-500 transition-colors"
                                                      title="配置を削除"
                                                    >
                                                      <X className="w-3.5 h-3.5" />
                                                    </button>
                                                    <div className="font-semibold text-slate-800 truncate pr-5">
                                                      {group.scheduleName ?? group.projectName}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                                                      <span className="font-medium text-slate-600">{formatAmount(group.totalAmount)}</span>
                                                      <span>{formatDateRange(group.plannedStartDate, group.plannedEndDate)}</span>
                                                    </div>
                                                  </div>
                                                </DraggableSiteCard>

                                                <AssignmentDetailPanel
                                                  assignments={group.assignments}
                                                  scheduleName={group.scheduleName ?? null}
                                                  projectName={group.projectName}
                                                  plannedStartDate={group.plannedStartDate}
                                                  plannedEndDate={group.plannedEndDate}
                                                  teamId={team.id}
                                                  scheduleId={group.scheduleId}
                                                  dateKey={dateKey}
                                                  accentColor={team.colorCode ?? "#94a3b8"}
                                                  onRefresh={onRefresh}
                                                  isDragging={isDragging}
                                                  duplicateWorkerIds={duplicateWorkerIds}
                                                  copyableSources={
                                                    scheduleGroups
                                                      .filter((g) => g.scheduleId !== group.scheduleId)
                                                      .map((g): CopyableSourceInfo => ({
                                                        scheduleName: g.scheduleName,
                                                        projectName: g.projectName,
                                                        workers: g.assignments
                                                          .filter((a) => a.workerId && a.worker)
                                                          .filter((a, i, arr) => arr.findIndex((x) => x.workerId === a.workerId) === i)
                                                          .map((a) => ({
                                                            workerId: a.workerId!,
                                                            workerName: a.worker!.name,
                                                            workerType: a.worker!.workerType,
                                                            driverLicenseType: a.worker!.driverLicenseType,
                                                            assignedRole: a.assignedRole,
                                                          })),
                                                      }))
                                                      .filter((s) => s.workers.length > 0)
                                                  }
                                                />
                                              </div>
                                            )
                                          })}

                                          {/* 現場追加ボタン */}
                                          <button
                                            onClick={() => onAddClick(team.id, day)}
                                            className="w-full flex items-center justify-center gap-1 py-2 rounded-lg border-2 border-dashed border-slate-300 text-xs text-slate-400 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 transition-all font-medium"
                                          >
                                            <Plus className="w-3.5 h-3.5" />
                                            {laneCount > 0 ? "追加" : "現場を追加"}
                                          </button>
                                        </div>
                                      )
                                    })()}
                                  </DroppableTeamCell>
                                ) : (
                                  /* ── 折りたたみ表示 ── */
                                  <div className="space-y-0.5">
                                    {dayAssignments.length === 0 && isMainRow ? (
                                      <div className="flex items-center justify-center h-full min-h-[32px] bg-slate-50/50 rounded">
                                        <span className="text-[10px] text-slate-300">-</span>
                                      </div>
                                    ) : (
                                      dayAssignments
                                        .filter(
                                          (a, i, arr) =>
                                            arr.findIndex((x) => x.scheduleId === a.scheduleId) === i
                                        )
                                        .map((a) => (
                                          <Tooltip key={a.scheduleId}>
                                            <TooltipTrigger asChild>
                                              <div
                                                className="text-[10px] px-1.5 py-0.5 rounded truncate cursor-default font-medium"
                                                style={{
                                                  backgroundColor: `${team.colorCode ?? "#94a3b8"}20`,
                                                  color: "#334155",
                                                }}
                                              >
                                                {(
                                                  a.schedule.name ?? a.schedule.contract.project.name
                                                ).slice(0, 6)}
                                              </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="text-xs max-w-[200px]">
                                              <div className="space-y-0.5">
                                                <div className="font-medium">{a.schedule.name ?? a.schedule.contract.project.name}</div>
                                                {a.schedule.contract.project.address && (
                                                  <div className="text-slate-300">{a.schedule.contract.project.address}</div>
                                                )}
                                                <div className="text-slate-300">{formatDateRange(a.schedule.plannedStartDate, a.schedule.plannedEndDate)}</div>
                                              </div>
                                            </TooltipContent>
                                          </Tooltip>
                                        ))
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

  )
}

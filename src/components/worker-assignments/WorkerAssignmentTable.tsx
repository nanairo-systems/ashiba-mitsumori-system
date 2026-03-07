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

import { useState, useMemo, useCallback } from "react"
import { format, eachDayOfInterval, addDays, isSameDay, isWeekend } from "date-fns"
import { ja } from "date-fns/locale"
import { DndContext, DragOverlay, useDraggable, useDroppable, pointerWithin } from "@dnd-kit/core"
import { cn } from "@/lib/utils"
import { Plus, X, ChevronDown, ChevronRight, HardHat, Truck } from "lucide-react"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useWorkerAssignmentDrag } from "@/hooks/use-worker-assignment-drag"
import { AssignmentDetailPanel } from "./AssignmentDetailPanel"
import type { TeamData, AssignmentData, TeamRow, SiteCardDragData, TeamCellDropData } from "./types"

interface Props {
  teams: TeamData[]
  assignments: AssignmentData[]
  rangeStart: Date
  displayDays: number
  onAddClick: (teamId: string, date: Date) => void
  onDeleteAssignment: (assignmentId: string) => void
  onRefresh: () => void
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

/** 同じ schedule+team のアサイン群をグループ化 */
interface ScheduleGroup {
  scheduleId: string
  scheduleName: string | null
  projectName: string
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

/** ドラッグ可能な現場カードのラッパー */
function DraggableSiteCard({
  id,
  data,
  children,
}: {
  id: string
  data: SiteCardDragData
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data })
  return (
    <div
      ref={setNodeRef}
      style={isDragging ? { opacity: 0.3 } : undefined}
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
}: {
  id: string
  data: TeamCellDropData
  children: React.ReactNode
  activeDragType?: string
  activeDragDateKey?: string
}) {
  const { isOver, setNodeRef } = useDroppable({ id, data })
  const isValidDrop =
    isOver && activeDragType === "site-card" && activeDragDateKey === data.dateKey
  return (
    <div
      ref={setNodeRef}
      className={cn("h-full", isValidDrop && "ring-2 ring-blue-400 ring-inset rounded")}
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
}: Props) {
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
  const [extraRows, setExtraRows] = useState<Map<string, number>>(new Map())
  // 詳細パネルの開閉: "scheduleId:teamId" をキーとする
  const [expandedCard, setExpandedCard] = useState<string | null>(null)

  // DnD フック
  const {
    sensors,
    activeItem,
    isDragging,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  } = useWorkerAssignmentDrag(onRefresh)

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

  function isDateInScheduleRange(date: Date, assignment: AssignmentData): boolean {
    const start = assignment.schedule.plannedStartDate
      ? new Date(assignment.schedule.plannedStartDate)
      : null
    const end = assignment.schedule.plannedEndDate
      ? new Date(assignment.schedule.plannedEndDate)
      : null
    if (!start) return false
    const endDate = end ?? start
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    const s = new Date(start)
    s.setHours(0, 0, 0, 0)
    const e = new Date(endDate)
    e.setHours(0, 0, 0, 0)
    return d >= s && d <= e
  }

  // ドラッグ中は展開・折りたたみを無効化
  const toggleDate = useCallback(
    (dateKey: string) => {
      if (isDragging) return
      setExpandedDates((prev) => {
        const next = new Set(prev)
        if (next.has(dateKey)) next.delete(dateKey)
        else next.add(dateKey)
        return next
      })
    },
    [isDragging]
  )

  const toggleCard = useCallback(
    (scheduleId: string, teamId: string) => {
      if (isDragging) return
      const key = `${scheduleId}:${teamId}`
      setExpandedCard((prev) => (prev === key ? null : key))
    },
    [isDragging]
  )

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

  const hasAnyExpanded = expandedDates.size > 0

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: LEFT_COL_WIDTH + days.length * COLLAPSED_WIDTH }}>
            {/* 日付ヘッダー */}
            <div className="flex border-b border-slate-200 sticky top-0 z-10 bg-white">
              <div
                className="flex-shrink-0 px-3 py-2 border-r border-slate-200 bg-slate-50 flex items-center"
                style={{ width: LEFT_COL_WIDTH }}
              >
                <span className="text-xs font-semibold text-slate-600">班名</span>
              </div>

              {days.map((day) => {
                const dateKey = format(day, "yyyy-MM-dd")
                const isExpanded = expandedDates.has(dateKey)
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
                    onClick={() => toggleDate(dateKey)}
                  >
                    <div className="flex items-center justify-center gap-0.5">
                      {isExpanded ? (
                        <ChevronDown className="w-3 h-3 text-blue-500" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-slate-300" />
                      )}
                      <span className={cn("text-[10px]", isToday ? "text-blue-600 font-bold" : "text-slate-400")}>{format(day, "M/d")}</span>
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
                            className="flex-shrink-0 px-3 py-3 border-r border-slate-200"
                            style={{ width: LEFT_COL_WIDTH, minHeight: hasAnyExpanded ? 80 : 64 }}
                          >
                            {isMainRow ? (
                              <div className="flex items-start gap-2">
                                <div
                                  className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5"
                                  style={{ backgroundColor: team.colorCode ?? "#94a3b8" }}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium text-slate-800 truncate">
                                    {team.name}
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    {teamAssignments.length > 0
                                      ? `${new Set(teamAssignments.map((a) => a.workerId).filter(Boolean)).size}名配置`
                                      : "未配置"}
                                  </div>
                                  <button
                                    onClick={() => addRow(team.id)}
                                    className="mt-1 flex items-center gap-0.5 text-[10px] text-blue-500 hover:text-blue-700 transition-colors"
                                  >
                                    <Plus className="w-3 h-3" />
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
                            const isExpanded = expandedDates.has(dateKey)
                            const isToday = isSameDay(day, today)
                            const isWknd = isWeekend(day)

                            const dayAssignments = isMainRow
                              ? teamAssignments.filter((a) => isDateInScheduleRange(day, a))
                              : []

                            // schedule ごとにグループ化
                            const scheduleGroups = isExpanded ? groupBySchedule(dayAssignments) : []

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
                                  >
                                    <div className="space-y-1">
                                      {scheduleGroups.map((group) => {
                                        const cardKey = `${group.scheduleId}:${team.id}`
                                        const isCardExpanded = expandedCard === cardKey

                                        const siteCardData: SiteCardDragData = {
                                          type: "site-card",
                                          scheduleId: group.scheduleId,
                                          teamId: team.id,
                                          dateKey,
                                          scheduleName: group.scheduleName,
                                          projectName: group.projectName,
                                          teamColor: team.colorCode ?? "#94a3b8",
                                          formattedAmount: formatAmount(group.totalAmount),
                                          formattedDateRange: formatDateRange(
                                            group.plannedStartDate,
                                            group.plannedEndDate
                                          ),
                                          assignmentIds: group.assignments.map((a) => a.id),
                                          workerCount: group.assignments.filter((a) => a.workerId).length,
                                        }

                                        return (
                                          <div key={group.scheduleId}>
                                            {/* ドラッグ可能な現場カード */}
                                            <DraggableSiteCard
                                              id={`site:${group.scheduleId}:${team.id}`}
                                              data={siteCardData}
                                            >
                                              <div
                                                className={cn(
                                                  "relative rounded-md px-2 py-1.5 text-[10px] border cursor-pointer transition-all",
                                                  isCardExpanded && "ring-1"
                                                )}
                                                style={{
                                                  backgroundColor: `${team.colorCode ?? "#94a3b8"}20`,
                                                  borderColor: `${team.colorCode ?? "#94a3b8"}40`,
                                                  ...(isCardExpanded && {
                                                    ringColor: team.colorCode ?? "#94a3b8",
                                                  }),
                                                }}
                                                onClick={() => toggleCard(group.scheduleId, team.id)}
                                              >
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    const mainAssignment =
                                                      group.assignments.find(
                                                        (a) => !a.workerId && !a.vehicleId
                                                      ) ?? group.assignments[0]
                                                    if (mainAssignment)
                                                      onDeleteAssignment(mainAssignment.id)
                                                  }}
                                                  className="absolute top-0.5 right-0.5 p-0.5 rounded-full hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors"
                                                  title="配置を削除"
                                                >
                                                  <X className="w-3 h-3" />
                                                </button>
                                                <div className="font-medium text-slate-800 truncate pr-4">
                                                  {group.scheduleName ?? group.projectName}
                                                </div>
                                                <div className="text-slate-500">
                                                  {formatAmount(group.totalAmount)}
                                                </div>
                                                <div className="flex items-center justify-between">
                                                  <span className="text-slate-400">
                                                    {formatDateRange(
                                                      group.plannedStartDate,
                                                      group.plannedEndDate
                                                    )}
                                                  </span>
                                                  {group.assignments.filter((a) => a.workerId)
                                                    .length > 0 && (
                                                    <span className="text-[8px] px-1 py-px rounded bg-white/60 text-slate-500">
                                                      {
                                                        group.assignments.filter((a) => a.workerId)
                                                          .length
                                                      }
                                                      名
                                                    </span>
                                                  )}
                                                </div>
                                                {/* 車両表示 */}
                                                {group.assignments
                                                  .filter((a) => a.vehicleId && a.vehicle)
                                                  .map((a) => (
                                                    <div
                                                      key={a.id}
                                                      className="flex items-center gap-1 text-[8px] text-slate-500"
                                                    >
                                                      <Truck className="w-2.5 h-2.5 flex-shrink-0" />
                                                      <span className="truncate">{a.vehicle!.name}</span>
                                                    </div>
                                                  ))}
                                              </div>
                                            </DraggableSiteCard>

                                            {/* 詳細パネル（スライド展開） */}
                                            {isCardExpanded && (
                                              <AssignmentDetailPanel
                                                assignments={group.assignments}
                                                scheduleName={group.scheduleName ?? null}
                                                projectName={group.projectName}
                                                plannedStartDate={group.plannedStartDate}
                                                plannedEndDate={group.plannedEndDate}
                                                teamId={team.id}
                                                scheduleId={group.scheduleId}
                                                accentColor={team.colorCode ?? "#94a3b8"}
                                                onRefresh={onRefresh}
                                                isDragging={isDragging}
                                              />
                                            )}
                                          </div>
                                        )
                                      })}

                                      {/* 現場追加ボタン */}
                                      <button
                                        onClick={() => onAddClick(team.id, day)}
                                        className="w-full flex items-center justify-center gap-1 py-1.5 rounded-md border border-dashed border-slate-300 text-[10px] text-slate-400 hover:text-blue-500 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                                      >
                                        <Plus className="w-3 h-3" />
                                        {scheduleGroups.length > 0 ? "追加" : "現場を追加"}
                                      </button>
                                    </div>
                                  </DroppableTeamCell>
                                ) : (
                                  /* ── 折りたたみ表示 ── */
                                  <div className="space-y-0.5">
                                    {dayAssignments.length === 0 && isMainRow ? (
                                      <div className="flex items-center justify-center h-full min-h-[32px] bg-slate-50/50 rounded">
                                        <span className="text-[8px] text-slate-300">現場なし</span>
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
                                                className="text-[9px] px-1 py-0.5 rounded truncate cursor-default"
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

      {/* DragOverlay: ドラッグ中にカーソルに追従するコンパクトカード */}
      <DragOverlay dropAnimation={null}>
        {activeItem?.type === "site-card" && (
          <div
            className="rounded-md px-2 py-1.5 text-[10px] border shadow-lg pointer-events-none"
            style={{
              borderColor: `${activeItem.teamColor}60`,
              backgroundColor: `${activeItem.teamColor}15`,
              width: EXPANDED_WIDTH - 16,
            }}
          >
            <div className="font-medium text-slate-800 truncate">
              {activeItem.scheduleName || activeItem.projectName}
            </div>
            <div className="text-slate-500">{activeItem.formattedAmount}</div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">{activeItem.formattedDateRange}</span>
              {activeItem.workerCount > 0 && (
                <span className="text-[8px] px-1 py-px rounded bg-white/60 text-slate-500">
                  {activeItem.workerCount}名
                </span>
              )}
            </div>
          </div>
        )}
        {activeItem?.type === "worker-card" && (
          <div
            className="flex items-center gap-1.5 rounded-md px-2 py-1 border shadow-lg text-[10px] pointer-events-none"
            style={{
              borderColor: `${activeItem.accentColor}60`,
              backgroundColor: `${activeItem.accentColor}15`,
            }}
          >
            <HardHat className="w-3.5 h-3.5" style={{ color: activeItem.accentColor }} />
            <span className="font-medium text-slate-800">{activeItem.workerName}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

/**
 * [COMPONENT] 人員配置管理 - 現場ビューテーブル
 *
 * 左列に工程（現場名・工種・工期・金額）、右側に日付セルを表示。
 * - 日付列クリックで全工程のセルが一斉に展開・折りたたみ
 * - 展開セルに班カード表示（班カラー・班名・職人数・車両名）
 * - 班カードクリックで詳細パネル（職人・車両管理）
 * - 「+ 班を追加」ボタン
 * - 班ビューとデータを共有、どちらで操作しても即時反映
 */
"use client"

import { useState, useMemo, useCallback } from "react"
import { format, eachDayOfInterval, addDays, isSameDay, isWeekend } from "date-fns"
import { ja } from "date-fns/locale"
import { DndContext, DragOverlay, pointerWithin } from "@dnd-kit/core"
import { cn } from "@/lib/utils"
import { Plus, ChevronDown, ChevronRight, HardHat } from "lucide-react"
import { toast } from "sonner"
import { useWorkerAssignmentDrag } from "@/hooks/use-worker-assignment-drag"
import { AssignmentDetailPanel } from "./AssignmentDetailPanel"
import { MoveWorkerDialog } from "./MoveWorkerDialog"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import type { TeamData, AssignmentData } from "./types"

interface Props {
  teams: TeamData[]
  assignments: AssignmentData[]
  rangeStart: Date
  displayDays: number
  onDeleteAssignment: (assignmentId: string) => void
  onRefresh: () => void
}

const LEFT_COL_WIDTH = 220
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

/** 班ごとのグループ（展開セル内で使う） */
interface TeamGroup {
  teamId: string
  teamName: string
  teamColor: string
  workerCount: number
  vehicleNames: string[]
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
  const map = new Map<string, TeamGroup>()
  for (const a of assignments) {
    const key = a.teamId
    if (!map.has(key)) {
      map.set(key, {
        teamId: a.teamId,
        teamName: a.team.name,
        teamColor: a.team.colorCode ?? "#94a3b8",
        workerCount: 0,
        vehicleNames: [],
        assignments: [],
      })
    }
    const group = map.get(key)!
    group.assignments.push(a)
    if (a.workerId) group.workerCount++
    if (a.vehicleId && a.vehicle) {
      if (!group.vehicleNames.includes(a.vehicle.name)) {
        group.vehicleNames.push(a.vehicle.name)
      }
    }
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
}: Props) {
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set())
  // 詳細パネルは常時展開
  const [addingTeam, setAddingTeam] = useState<{ scheduleId: string; date: Date } | null>(null)

  const {
    sensors,
    activeItem,
    isDragging,
    pendingWorkerMove,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
    confirmWorkerMove,
    cancelWorkerMove,
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

  const scheduleRows = useMemo(() => groupBySchedule(assignments), [assignments])

  const toggleDate = useCallback(
    (dateKey: string) => {
      if (isDragging) return
      setCollapsedDates((prev) => {
        const next = new Set(prev)
        if (next.has(dateKey)) next.delete(dateKey)
        else next.add(dateKey)
        return next
      })
    },
    [isDragging]
  )

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

  const datesWithAssignments = useMemo(() => {
    const set = new Set<string>()
    for (const day of days) {
      const dateKey = format(day, "yyyy-MM-dd")
      if (scheduleRows.some((row) => isDateInRange(day, row.plannedStartDate, row.plannedEndDate))) {
        set.add(dateKey)
      }
    }
    return set
  }, [days, scheduleRows])

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
                    onClick={() => datesWithAssignments.has(dateKey) && toggleDate(dateKey)}
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

            {/* 工程ごとの行 */}
            {scheduleRows.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <span className="text-sm">表示する工程がありません</span>
              </div>
            ) : (
              scheduleRows.map((row) => (
                <div key={row.scheduleId} className="flex border-b border-slate-100 last:border-b-0 hover:bg-slate-50/30 transition-colors">
                  {/* 工程名列 */}
                  <div
                    className="flex-shrink-0 px-3 py-3 border-r border-slate-200"
                    style={{ width: LEFT_COL_WIDTH, minHeight: hasAnyExpanded ? 80 : 64 }}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-800 truncate">
                            {row.scheduleName ?? row.projectName}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                              {row.workType}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {formatAmount(row.totalAmount)}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {formatDateRange(row.plannedStartDate, row.plannedEndDate)}
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="text-xs max-w-[240px]">
                        <div className="space-y-0.5">
                          <div className="font-medium">{row.scheduleName ?? row.projectName}</div>
                          {row.address && <div className="text-slate-300">{row.address}</div>}
                          <div className="text-slate-300">{formatDateRange(row.plannedStartDate, row.plannedEndDate)}</div>
                          <div className="text-slate-300">{formatAmount(row.totalAmount)}</div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  {/* 日付セル */}
                  {days.map((day) => {
                    const dateKey = format(day, "yyyy-MM-dd")
                    const isExpanded = datesWithAssignments.has(dateKey) && !collapsedDates.has(dateKey)
                    const isToday = isSameDay(day, today)
                    const dow = day.getDay()
                    const inRange = isDateInRange(day, row.plannedStartDate, row.plannedEndDate)

                    // この工程・この日に配置されている班
                    const dayTeamGroups = inRange
                      ? groupByTeam(
                          row.assignments.filter((a) => {
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
                          isExpanded && "bg-blue-50/30",
                          isToday && !isExpanded && "bg-blue-50/50",
                          !isToday && !isExpanded && dow === 6 && "bg-blue-50/30",
                          !isToday && !isExpanded && dow === 0 && "bg-red-50/30",
                          !inRange && "bg-slate-50/30"
                        )}
                        style={{
                          width: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
                          minWidth: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
                          minHeight: hasAnyExpanded ? 80 : 64,
                          flexShrink: 0,
                        }}
                      >
                        {!inRange ? (
                          <div className="flex items-center justify-center h-full min-h-[32px]">
                            <span className="text-[7px] text-slate-200">−</span>
                          </div>
                        ) : isExpanded ? (
                          /* ── 展開表示 ── */
                          <div className="space-y-1">
                            {dayTeamGroups.map((tg) => {
                              return (
                                <div key={tg.teamId}>
                                  {/* 班カードヘッダー */}
                                  <div
                                    className="rounded-md px-2 py-1.5 text-[10px] border transition-all"
                                    style={{
                                      backgroundColor: `${tg.teamColor}20`,
                                      borderColor: `${tg.teamColor}40`,
                                    }}
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <div
                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: tg.teamColor }}
                                      />
                                      <span className="font-medium text-slate-800 truncate">
                                        {tg.teamName}
                                      </span>
                                    </div>
                                  </div>

                                  {/* 詳細パネル（常時展開） */}
                                  <AssignmentDetailPanel
                                    assignments={tg.assignments}
                                    scheduleName={row.scheduleName}
                                    projectName={row.projectName}
                                    plannedStartDate={row.plannedStartDate}
                                    plannedEndDate={row.plannedEndDate}
                                    teamId={tg.teamId}
                                    scheduleId={row.scheduleId}
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
                                    addingTeam?.scheduleId === row.scheduleId
                                      ? null
                                      : { scheduleId: row.scheduleId, date: day }
                                  )
                                }
                                className="w-full flex items-center justify-center gap-1 py-1.5 rounded-md border border-dashed border-slate-300 text-[10px] text-slate-400 hover:text-blue-500 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                                班を追加
                              </button>

                              {/* チーム選択ポップオーバー */}
                              {addingTeam?.scheduleId === row.scheduleId && (
                                <div className="absolute top-full left-0 mt-1 z-20 bg-white border rounded-lg shadow-lg p-1 min-w-[140px] max-h-[200px] overflow-y-auto">
                                  {teams
                                    .filter((t) => t.isActive)
                                    .filter((t) => !dayTeamGroups.some((tg) => tg.teamId === t.id))
                                    .map((t) => (
                                      <button
                                        key={t.id}
                                        onClick={() => handleAddTeam(row.scheduleId, t.id)}
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
                          <div className="space-y-0.5">
                            {dayTeamGroups.length === 0 ? (
                              <div className="flex items-center justify-center h-full min-h-[32px]">
                                <span className="text-[8px] text-slate-300">未配置</span>
                              </div>
                            ) : (
                              dayTeamGroups.map((tg) => (
                                <Tooltip key={tg.teamId}>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 text-[9px] px-1 py-0.5 rounded truncate cursor-default"
                                      style={{ backgroundColor: `${tg.teamColor}20` }}
                                    >
                                      <div
                                        className="w-2 h-2 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: tg.teamColor }}
                                      />
                                      <span className="truncate text-slate-600">{tg.teamName}</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    <div className="space-y-0.5">
                                      <div className="font-medium">{tg.teamName}</div>
                                      {tg.workerCount > 0 && <div className="text-slate-300">{tg.workerCount}名配置</div>}
                                      {tg.vehicleNames.length > 0 && (
                                        <div className="text-slate-300">{tg.vehicleNames.join(", ")}</div>
                                      )}
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
              ))
            )}
          </div>
        </div>
      </div>

      {/* DragOverlay */}
      <DragOverlay dropAnimation={null}>
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

      {/* 職人移動ダイアログ */}
      <MoveWorkerDialog
        move={pendingWorkerMove}
        onConfirm={confirmWorkerMove}
        onCancel={cancelWorkerMove}
      />
    </DndContext>
  )
}

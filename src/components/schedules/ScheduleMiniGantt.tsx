/**
 * [COMPONENT] 共有ミニガントチャート
 *
 * SiteOpsDialog と ContractDetail の両方で使用する共有モジュール。
 * GanttToolbar / GanttDateHeader / GanttBar / GanttBarArea の共通部品を利用。
 *
 * 機能:
 * - 工種別バー表示（予定＋実績）
 * - ドラッグ作成（空エリアでドラッグ → 新規工程）
 * - ロングプレス移動（バーを長押しでドラッグ移動）
 * - エッジリサイズ（バー端をドラッグ）
 * - Ctrl/Shift キーで工種切替
 * - モード切替（選択 / 工種ドローモード）
 * - ナビゲーション（矢印・今日ボタン）
 */
"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { addDays, subDays, parseISO, eachDayOfInterval, format, isAfter, isBefore } from "date-fns"
import type { ScheduleData, WorkTypeMaster, DrawMode } from "./schedule-types"
import { groupSchedulesByName, getBarPos, dayIdxToStr } from "./schedule-utils"
import { buildWtConfigMap, getWtConfig } from "./schedule-constants"
import { GanttToolbar } from "./GanttToolbar"
import { GanttDateHeader } from "./GanttDateHeader"
import { GanttBar } from "./GanttBar"
import { GanttBarAreaBackground, GanttDragPreview } from "./GanttBarArea"
import { useGanttDrag } from "@/hooks/use-gantt-drag"
import { useGanttMove } from "@/hooks/use-gantt-move"
import { useGanttResize } from "@/hooks/use-gantt-resize"

export interface ScheduleMiniGanttProps {
  /** 表示するスケジュール一覧 */
  schedules: ScheduleData[]
  /** 表示日数（デフォルト: 30） */
  displayDays?: number
  /** 編集ロック */
  isLocked?: boolean
  /** 工種マスター（未指定時は自動取得） */
  workTypes?: WorkTypeMaster[]
  /** 新規作成コールバック */
  onCreateSchedule: (workType: string, name: string, startDate: string, endDate: string) => void
  /** 日付更新コールバック */
  onUpdateDates: (scheduleId: string, startDate: string, endDate: string) => void
  /** バークリックコールバック */
  onClickSchedule?: (scheduleId: string) => void
  /** カレンダーモーダルを開く */
  onCalendarOpen?: () => void
  /** 左カラム幅（デフォルト: 110px） */
  leftColumnWidth?: number
  /** 新規行作成時にグループ名をpromptするか（デフォルト: true） */
  promptGroupName?: boolean
  /** デフォルトのグループ名（promptGroupName=false時に使用） */
  defaultGroupName?: string | null
}

export function ScheduleMiniGantt({
  schedules,
  displayDays: displayDaysProp = 30,
  isLocked = false,
  workTypes: workTypesProp,
  onCreateSchedule,
  onUpdateDates,
  onClickSchedule,
  onCalendarOpen,
  leftColumnWidth = 110,
  promptGroupName = true,
  defaultGroupName = null,
}: ScheduleMiniGanttProps) {
  const today = new Date()
  const displayDays = displayDaysProp

  // ── 工種マスター ──
  const [fetchedWorkTypes, setFetchedWorkTypes] = useState<WorkTypeMaster[]>([])
  useEffect(() => {
    if (workTypesProp) return
    fetch("/api/schedule-work-types")
      .then((r) => r.ok ? r.json() : [])
      .then(setFetchedWorkTypes)
      .catch(() => {})
  }, [workTypesProp])
  const workTypes = workTypesProp ?? fetchedWorkTypes

  const wtConfigMap = useMemo(() => buildWtConfigMap(workTypes), [workTypes])
  const workTypeSortOrder = useMemo(() => {
    const m = new Map<string, number>()
    workTypes.forEach((wt, i) => m.set(wt.code, i))
    return m
  }, [workTypes])

  // ── 表示範囲 ──
  const [rangeStart, setRangeStart] = useState(() => {
    const allDates = schedules.flatMap((s) =>
      [s.plannedStartDate, s.plannedEndDate, s.actualStartDate, s.actualEndDate].filter(Boolean) as string[]
    )
    if (allDates.length > 0) {
      const earliest = allDates.reduce((a, b) => (a < b ? a : b))
      return subDays(parseISO(earliest), 3)
    }
    return subDays(today, 3)
  })
  const rangeEnd = addDays(rangeStart, displayDays - 1)
  const days = useMemo(
    () => eachDayOfInterval({ start: rangeStart, end: rangeEnd }),
    [rangeStart, rangeEnd]
  )
  const cellWidthPct = 100 / displayDays

  // ── ドローモード ──
  const [drawMode, setDrawMode] = useState<DrawMode>("select")
  const [heldKey, setHeldKey] = useState<"shift" | "ctrl" | null>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === "Shift") setHeldKey("shift")
      else if (e.key === "Control" || e.key === "Meta") setHeldKey("ctrl")
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === "Shift") setHeldKey((prev) => prev === "shift" ? null : prev)
      else if (e.key === "Control" || e.key === "Meta") setHeldKey((prev) => prev === "ctrl" ? null : prev)
    }
    function onBlur() { setHeldKey(null) }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("blur", onBlur)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("blur", onBlur)
    }
  }, [])

  const effectiveDrawMode: DrawMode = heldKey === "shift" && workTypes[1]
    ? workTypes[1].code
    : heldKey === "ctrl" && workTypes[0]
      ? workTypes[0].code
      : drawMode

  const shiftDays = useCallback((n: number) => setRangeStart((prev) => addDays(prev, n)), [])

  // ── バー位置ヘルパー ──
  const getBarPosStr = useCallback((startStr: string | null, endStr: string | null) => {
    if (!startStr) return null
    const pos = getBarPos(startStr, endStr ?? startStr, rangeStart, displayDays)
    if (!pos) return null
    return { left: `${pos.left}%`, width: `${pos.width}%` }
  }, [rangeStart, displayDays])

  // ── グループ化 ──
  const groups = useMemo(() => groupSchedulesByName(schedules, workTypeSortOrder), [schedules, workTypeSortOrder])

  // ── カスタムフック: ドラッグ作成 ──
  const drag = useGanttDrag({
    drawMode: isLocked ? "select" : effectiveDrawMode,
    onCreateSchedule: ({ identifier, workType, startDay, endDay }) => {
      const groupIdx = identifier as number
      const group = groups[groupIdx]
      if (group?.name) {
        onCreateSchedule(workType, group.name, dayIdxToStr(startDay, rangeStart), dayIdxToStr(endDay, rangeStart))
      } else if (promptGroupName) {
        const newName = prompt("作業内容の名前を入力してください", `作業${groups.length + 1}`)
        if (!newName?.trim()) return
        onCreateSchedule(workType, newName.trim(), dayIdxToStr(startDay, rangeStart), dayIdxToStr(endDay, rangeStart))
      } else {
        onCreateSchedule(workType, defaultGroupName ?? "", dayIdxToStr(startDay, rangeStart), dayIdxToStr(endDay, rangeStart))
      }
    },
  })

  // ── カスタムフック: ロングプレス移動 ──
  const move = useGanttMove({
    rangeStart,
    totalDays: displayDays,
    drawMode: isLocked ? "select" : effectiveDrawMode,
    barAreaSelector: "[data-shared-mini-bar-area]",
    onMoveSchedule: onUpdateDates,
    onClickSchedule: isLocked ? undefined : onClickSchedule
      ? (schedule) => onClickSchedule(schedule.id)
      : undefined,
  })

  // ── カスタムフック: エッジリサイズ ──
  const resize = useGanttResize({
    rangeStart,
    totalDays: displayDays,
    drawMode: isLocked ? "select" : effectiveDrawMode,
    barAreaSelector: "[data-shared-mini-bar-area]",
    onResizeSchedule: onUpdateDates,
    longPressTimerRef: move.longPressTimerRef,
  })

  return (
    <div className="space-y-2">
      {/* ミニツールバー */}
      <GanttToolbar
        variant="mini"
        drawMode={drawMode}
        effectiveDrawMode={effectiveDrawMode}
        rangeStart={rangeStart}
        displayDays={displayDays}
        isLocked={isLocked}
        workTypes={workTypes}
        wtConfigMap={wtConfigMap}
        onDrawModeChange={(m) => setDrawMode(m)}
        onShiftDays={shiftDays}
        onGoToToday={() => {
          const allDates = schedules.flatMap((s) =>
            [s.plannedStartDate, s.plannedEndDate].filter(Boolean) as string[]
          )
          if (allDates.length > 0) {
            const earliest = allDates.reduce((a, b) => (a < b ? a : b))
            setRangeStart(subDays(parseISO(earliest), 3))
          } else {
            setRangeStart(subDays(today, 3))
          }
        }}
        onCalendarOpen={onCalendarOpen}
      />

      {/* ガントチャート本体 */}
      <div
        className={`bg-white border rounded-lg overflow-hidden select-none ${
          !isLocked && effectiveDrawMode !== "select" ? "cursor-crosshair" : ""
        } ${isLocked ? "opacity-90" : ""}`}
        onMouseUp={isLocked ? undefined : drag.handleMouseUp}
        onMouseLeave={isLocked ? undefined : drag.handleMouseUp}
      >
        {/* 日付ヘッダー */}
        <GanttDateHeader
          days={days}
          cellWidthPct={cellWidthPct}
          leftColumnWidth={leftColumnWidth}
          leftColumnLabel="作業内容"
          variant="mini"
        />

        {/* 工程行 */}
        {schedules.length === 0 && effectiveDrawMode === "select" ? (
          <div className="text-center py-6 text-slate-400">
            <p className="text-xs">工程がまだ登録されていません</p>
            <p className="text-xs text-slate-500 mt-0.5">上のモード切替で工種を選択し、ドラッグで作成</p>
          </div>
        ) : (
          <>
            {groups.map((group, groupIdx) => {
              const groupLabel = group.name
                ?? (group.schedules.length === 1
                  ? getWtConfig(group.schedules[0].workType, wtConfigMap).label
                  : "")
              const allGroupDates = group.schedules.flatMap((s) =>
                [s.plannedStartDate, s.plannedEndDate, s.actualStartDate, s.actualEndDate].filter(Boolean) as string[]
              )
              const rowEarliest = allGroupDates.length > 0 ? allGroupDates.reduce((a, b) => (a < b ? a : b)) : null
              const rowLatest = allGroupDates.length > 0 ? allGroupDates.reduce((a, b) => (a > b ? a : b)) : null
              const rowInRange = rowEarliest && rowLatest
                ? !isAfter(parseISO(rowEarliest), rangeEnd) && !isBefore(parseISO(rowLatest), rangeStart)
                : false

              return (
                <div key={groupIdx} className="flex border-b border-slate-100 last:border-b-0">
                  {/* 作業内容ラベル + 工種バッジ */}
                  <div
                    className="flex-shrink-0 px-2 py-1 border-r border-slate-200 bg-slate-50"
                    style={{ width: leftColumnWidth }}
                  >
                    <div className="flex flex-col gap-0.5">
                      <button
                        className={`text-xs font-medium text-slate-700 truncate text-left ${
                          !isLocked && onClickSchedule
                            ? "hover:text-blue-600 hover:underline cursor-pointer"
                            : ""
                        }`}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (isLocked || !onClickSchedule) return
                          const firstSchedule = group.schedules[0]
                          if (firstSchedule) onClickSchedule(firstSchedule.id)
                        }}
                        disabled={isLocked || !onClickSchedule}
                        title={
                          isLocked
                            ? `${groupLabel}（ロック中）`
                            : onClickSchedule
                              ? "クリックで詳細を開く"
                              : groupLabel || "（名前なし）"
                        }
                      >
                        {groupLabel || "（名前なし）"}
                      </button>
                      <div className="flex items-center gap-0.5 flex-wrap">
                        {group.schedules.map((s) => (
                          <button
                            key={s.id}
                            className={`inline-flex items-center px-1 rounded text-xs font-medium ${
                              getWtConfig(s.workType, wtConfigMap).bg
                            } ${getWtConfig(s.workType, wtConfigMap).text} ${
                              !isLocked && onClickSchedule
                                ? "hover:brightness-90 hover:shadow-sm cursor-pointer"
                                : ""
                            } transition-all`}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (!isLocked && onClickSchedule) onClickSchedule(s.id)
                            }}
                            disabled={isLocked || !onClickSchedule}
                            title={
                              isLocked
                                ? `${getWtConfig(s.workType, wtConfigMap).label}（ロック中）`
                                : `${getWtConfig(s.workType, wtConfigMap).label}`
                            }
                          >
                            {getWtConfig(s.workType, wtConfigMap).short || getWtConfig(s.workType, wtConfigMap).label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {rowEarliest && rowLatest && (
                      <p className="text-xs text-slate-500 mt-0.5 leading-tight">
                        {format(parseISO(rowEarliest), "M/d")}〜{format(parseISO(rowLatest), "M/d")}
                        {!rowInRange && (
                          <button
                            className="text-amber-600 ml-0.5 hover:underline hover:text-amber-800 text-xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              setRangeStart(subDays(parseISO(rowEarliest), 3))
                            }}
                          >
                            →表示
                          </button>
                        )}
                      </p>
                    )}
                  </div>

                  {/* バー領域 */}
                  <div
                    data-shared-mini-bar-area
                    className="flex-1 relative"
                    style={{ height: 44 }}
                    onMouseDown={isLocked ? undefined : (e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      drag.handleMouseDown(groupIdx, Math.floor(((e.clientX - rect.left) / rect.width) * displayDays))
                    }}
                    onMouseMove={isLocked ? undefined : (e) => {
                      if (!drag.isDragging.current) return
                      const rect = e.currentTarget.getBoundingClientRect()
                      drag.handleMouseMove(Math.floor(((e.clientX - rect.left) / rect.width) * displayDays))
                    }}
                  >
                    <GanttBarAreaBackground days={days} totalDays={displayDays} rangeStart={rangeStart} />

                    {group.schedules.map((schedule) => {
                      const plannedPos = getBarPosStr(schedule.plannedStartDate, schedule.plannedEndDate)
                      const actualPos = getBarPosStr(schedule.actualStartDate, schedule.actualEndDate)
                      const cfg = getWtConfig(schedule.workType, wtConfigMap)

                      // 範囲外インジケータ
                      if (!plannedPos && !actualPos) {
                        const refDate = schedule.plannedStartDate ?? schedule.actualStartDate
                        const isAfterRange = refDate ? isAfter(parseISO(refDate), rangeEnd) : false
                        const dateLabel = refDate ? format(parseISO(refDate), "M/d") : ""
                        return (
                          <div
                            key={schedule.id}
                            className="absolute z-[5] flex items-center cursor-pointer hover:opacity-80"
                            style={{ top: 4, height: 20, ...(isAfterRange ? { right: 4 } : { left: 4 }) }}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (refDate) setRangeStart(subDays(parseISO(refDate), 3))
                              else if (!isLocked && onClickSchedule) onClickSchedule(schedule.id)
                            }}
                          >
                            <span className={`text-xs ${cfg.text} px-1.5 py-0.5 rounded ${cfg.bg} border ${cfg.border} flex items-center gap-0.5`}>
                              {!isAfterRange && <span>◀</span>}
                              {cfg.label} {dateLabel && `${dateLabel}〜`}
                              {isAfterRange && <span>▶</span>}
                            </span>
                          </div>
                        )
                      }

                      return (
                        <GanttBar
                          key={schedule.id}
                          schedule={schedule}
                          plannedPos={plannedPos}
                          actualPos={actualPos}
                          y={4}
                          isSelectMode={!isLocked && effectiveDrawMode === "select"}
                          moveState={move.moveState}
                          resizeState={resize.resizeState}
                          rangeStart={rangeStart}
                          totalDays={displayDays}
                          wtConfig={cfg}
                          onBarMouseDown={(s, e) => move.handleBarMouseDown(s, e)}
                          onBarMouseUp={(s, e) => move.handleBarMouseUp(s, e)}
                          onBarClick={(s, e) => {
                            e.stopPropagation()
                            if (!isLocked && onClickSchedule) onClickSchedule(s.id)
                          }}
                          onBarEdgeMouseDown={(s, edge, e) => resize.handleBarEdgeMouseDown(s, edge, e)}
                        />
                      )
                    })}

                    {/* ドラッグプレビュー */}
                    {(() => {
                      const preview = drag.getDragPreview(groupIdx)
                      if (!preview) return null
                      return (
                        <GanttDragPreview
                          startDay={preview.startDay}
                          endDay={preview.endDay}
                          totalDays={displayDays}
                          workType={drag.dragDrawModeRef.current}
                          wtConfig={getWtConfig(drag.dragDrawModeRef.current, wtConfigMap)}
                          y={4}
                        />
                      )
                    })()}
                  </div>
                </div>
              )
            })}

            {/* 新規追加行（ドラッグ作成用） */}
            {!isLocked && effectiveDrawMode !== "select" && (
              <div className="flex border-b border-slate-100">
                <div
                  className="flex-shrink-0 px-2 py-1 border-r border-slate-200 flex items-center"
                  style={{ width: leftColumnWidth }}
                >
                  <span className="text-xs text-slate-500">＋新しい作業内容</span>
                </div>
                <div
                  data-shared-mini-bar-area
                  className="flex-1 relative"
                  style={{ height: 36 }}
                  onMouseDown={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    drag.handleMouseDown(groups.length, Math.floor(((e.clientX - rect.left) / rect.width) * displayDays))
                  }}
                  onMouseMove={(e) => {
                    if (!drag.isDragging.current) return
                    const rect = e.currentTarget.getBoundingClientRect()
                    drag.handleMouseMove(Math.floor(((e.clientX - rect.left) / rect.width) * displayDays))
                  }}
                >
                  <GanttBarAreaBackground days={days} totalDays={displayDays} rangeStart={rangeStart} />
                  {(() => {
                    const preview = drag.getDragPreview(groups.length)
                    if (!preview) return null
                    return (
                      <GanttDragPreview
                        startDay={preview.startDay}
                        endDay={preview.endDay}
                        totalDays={displayDays}
                        workType={drag.dragDrawModeRef.current}
                        wtConfig={getWtConfig(drag.dragDrawModeRef.current, wtConfigMap)}
                        y={4}
                      />
                    )
                  })()}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-xs text-slate-500">
                      ドラッグして{getWtConfig(effectiveDrawMode, wtConfigMap).label}を追加
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 凡例 */}
      <div className="flex items-center gap-3 text-xs text-slate-600">
        {workTypes.map((wt) => {
          const wtCfg = getWtConfig(wt.code, wtConfigMap)
          return (
            <div key={wt.code} className="flex items-center gap-1">
              <span className={`inline-block w-3 h-2 rounded-sm ${wtCfg.planned} border ${wtCfg.border}`} />
              <span>予定</span>
              <span className={`inline-block w-3 h-2 rounded-sm ${wtCfg.actual}`} />
              <span>{wtCfg.label}</span>
            </div>
          )
        })}
        <span className="ml-auto">{schedules.length}件</span>
      </div>
    </div>
  )
}

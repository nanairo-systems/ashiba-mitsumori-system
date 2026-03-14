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
  /** 表示日数（デフォルト: 20） */
  displayDays?: number
  /** 編集ロック */
  isLocked?: boolean
  /** 工種マスター（未指定時は自動取得） */
  workTypes?: WorkTypeMaster[]
  /** 新規作成コールバック */
  onCreateSchedule: (workType: string, name: string, startDate: string, endDate: string, workContentId?: string) => void
  /** デフォルトの workContentId（ドラッグ作成時に使用） */
  defaultWorkContentId?: string | null
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
  /** 作業内容追加コールバック（ガントチャート内の＋ボタン用） */
  onAddWorkContent?: () => void
  /** 表示行数（デフォルト: 1。2を指定すると上段+下段で2×displayDays日分表示） */
  rows?: number
}

export function ScheduleMiniGantt({
  schedules,
  displayDays: displayDaysProp = 15,
  isLocked = false,
  workTypes: workTypesProp,
  onCreateSchedule,
  onUpdateDates,
  onClickSchedule,
  onCalendarOpen,
  leftColumnWidth = 110,
  promptGroupName = true,
  defaultGroupName = null,
  defaultWorkContentId = null,
  onAddWorkContent,
  rows = 1,
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
  const totalDays = displayDays * rows
  const rangeEnd = addDays(rangeStart, totalDays - 1)
  const days = useMemo(
    () => eachDayOfInterval({ start: rangeStart, end: rangeEnd }),
    [rangeStart, rangeEnd]
  )
  const cellWidthPct = 100 / displayDays

  // Per-row day arrays for multi-row rendering
  const rowDaysArray = useMemo(() => {
    const result: Date[][] = []
    for (let r = 0; r < rows; r++) {
      const rowStart = addDays(rangeStart, r * displayDays)
      const rowEnd = addDays(rowStart, displayDays - 1)
      result.push(eachDayOfInterval({ start: rowStart, end: rowEnd }))
    }
    return result
  }, [rangeStart, displayDays, rows])

  // ── ドローモード ──
  const [drawMode, setDrawMode] = useState<DrawMode>("select")
  const [heldKeyMode, setHeldKeyMode] = useState<DrawMode | null>(null)
  const [flashIndex, setFlashIndex] = useState(-1)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const num = parseInt(e.key, 10)
      if (isNaN(num)) return
      if (num === 0) {
        setDrawMode("select")
        setHeldKeyMode(null)
        setFlashIndex(0)
      } else if (num >= 1 && num <= 5 && workTypes[num - 1]) {
        setHeldKeyMode(workTypes[num - 1].code)
        setFlashIndex(num)
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const num = parseInt(e.key, 10)
      if (num >= 1 && num <= 5) setHeldKeyMode(null)
    }
    function onBlur() { setHeldKeyMode(null) }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("blur", onBlur)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("blur", onBlur)
    }
  }, [workTypes])

  useEffect(() => {
    if (flashIndex < 0) return
    const timer = setTimeout(() => setFlashIndex(-1), 500)
    return () => clearTimeout(timer)
  }, [flashIndex])

  const effectiveDrawMode: DrawMode = heldKeyMode ?? drawMode

  const shiftDays = useCallback((n: number) => setRangeStart((prev) => addDays(prev, n)), [])

  // ── バー位置ヘルパー（行ごと） ──
  const getBarPosForRow = useCallback((startStr: string | null, endStr: string | null, rowRangeStart: Date) => {
    if (!startStr) return null
    const pos = getBarPos(startStr, endStr ?? startStr, rowRangeStart, displayDays)
    if (!pos) return null
    return { left: `${pos.left}%`, width: `${pos.width}%` }
  }, [displayDays])
  // Legacy helper for hooks (uses full range)
  const getBarPosStr = useCallback((startStr: string | null, endStr: string | null) => {
    return getBarPosForRow(startStr, endStr, rangeStart)
  }, [getBarPosForRow, rangeStart])

  // ── グループ化 ──
  const groups = useMemo(() => groupSchedulesByName(schedules, workTypeSortOrder), [schedules, workTypeSortOrder])

  // ── カスタムフック: ドラッグ作成 ──
  const drag = useGanttDrag({
    drawMode: isLocked ? "select" : effectiveDrawMode,
    onCreateSchedule: ({ identifier, workType, startDay, endDay }) => {
      const groupIdx = identifier as number
      const group = groups[groupIdx]
      const startStr = dayIdxToStr(startDay, rangeStart)
      const endStr = dayIdxToStr(endDay, rangeStart)
      if (group?.name) {
        // 既存グループのworkContentIdを取得（scheduleのworkContentIdから）
        const wcId = group.schedules[0]?.workContentId ?? defaultWorkContentId ?? undefined
        onCreateSchedule(workType, group.name, startStr, endStr, wcId)
      } else if (promptGroupName) {
        const newName = prompt("作業内容の名前を入力してください", `作業${groups.length + 1}`)
        if (!newName?.trim()) return
        onCreateSchedule(workType, newName.trim(), startStr, endStr, defaultWorkContentId ?? undefined)
      } else {
        onCreateSchedule(workType, defaultGroupName ?? "", startStr, endStr, defaultWorkContentId ?? undefined)
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
        displayDays={totalDays}
        isLocked={isLocked}
        workTypes={workTypes}
        wtConfigMap={wtConfigMap}
        flashIndex={flashIndex}
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
        {rowDaysArray.map((rowDays, rowIdx) => {
          const rowRangeStart = addDays(rangeStart, rowIdx * displayDays)
          const rowRangeEnd = addDays(rowRangeStart, displayDays - 1)
          const isFirstRow = rowIdx === 0
          const isLastRow = rowIdx === rows - 1

          // Row-specific bar position helper
          const getRowBarPos = (startStr: string | null, endStr: string | null) =>
            getBarPosForRow(startStr, endStr, rowRangeStart)

          return (
            <div key={rowIdx} className={rowIdx > 0 ? "border-t-2 border-slate-200" : ""}>
              {/* 日付ヘッダー */}
              <GanttDateHeader
                days={rowDays}
                cellWidthPct={cellWidthPct}
                leftColumnWidth={leftColumnWidth}
                leftColumnLabel={isFirstRow ? "作業内容" : ""}
                variant="mini"
              />

              {/* 工程行 */}
              {schedules.length === 0 ? (
                <>
                  {isFirstRow && defaultGroupName && (
                    <div className="flex border-b border-slate-100">
                      <div
                        className="flex-shrink-0 px-2 border-r border-slate-200 bg-slate-50 flex items-center justify-center"
                        style={{ width: leftColumnWidth }}
                      >
                        <span className="text-sm font-bold text-slate-800 truncate text-center">{defaultGroupName}</span>
                      </div>
                      <div
                        data-shared-mini-bar-area
                        className="flex-1 relative"
                        style={{ height: 52 }}
                        onMouseDown={isLocked || effectiveDrawMode === "select" ? undefined : (e) => {
                          const rect = e.currentTarget.getBoundingClientRect()
                          drag.handleMouseDown(0, Math.floor(((e.clientX - rect.left) / rect.width) * displayDays) + rowIdx * displayDays)
                        }}
                        onMouseMove={isLocked || effectiveDrawMode === "select" ? undefined : (e) => {
                          if (!drag.isDragging.current) return
                          const rect = e.currentTarget.getBoundingClientRect()
                          drag.handleMouseMove(Math.floor(((e.clientX - rect.left) / rect.width) * displayDays) + rowIdx * displayDays)
                        }}
                      >
                        <GanttBarAreaBackground days={rowDays} totalDays={displayDays} rangeStart={rowRangeStart} />
                        {isFirstRow && (() => {
                          const preview = drag.getDragPreview(0)
                          if (!preview) return null
                          return (
                            <GanttDragPreview
                              startDay={preview.startDay}
                              endDay={preview.endDay}
                              totalDays={displayDays}
                              workType={drag.dragDrawModeRef.current}
                              wtConfig={getWtConfig(drag.dragDrawModeRef.current, wtConfigMap)}
                              y={6}
                            />
                          )
                        })()}
                        {isFirstRow && effectiveDrawMode === "select" && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-xs text-slate-400">工種を選択してドラッグで作成</span>
                          </div>
                        )}
                        {isFirstRow && effectiveDrawMode !== "select" && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-xs text-slate-500">
                              ドラッグして{getWtConfig(effectiveDrawMode, wtConfigMap).label}を追加
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {isFirstRow && !defaultGroupName && effectiveDrawMode === "select" && (
                    <div className="text-center py-6 text-slate-400">
                      <p className="text-xs">工事日程がまだ登録されていません</p>
                      <p className="text-xs text-slate-500 mt-0.5">上のモード切替で工種を選択し、ドラッグで作成</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {groups.map((group, groupIdx) => {
                    const groupLabel = group.name
                      ?? (group.schedules.length === 1
                        ? getWtConfig(group.schedules[0].workType, wtConfigMap).label
                        : "")

                    return (
                      <div key={groupIdx} className="flex border-b border-slate-100 last:border-b-0">
                        {/* 作業内容ラベル */}
                        <div
                          className="flex-shrink-0 px-2 border-r border-slate-200 bg-slate-50 flex items-center justify-center"
                          style={{ width: leftColumnWidth }}
                        >
                          {isFirstRow ? (
                            <button
                              className={`text-sm font-bold text-slate-800 truncate text-center ${
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
                              title={groupLabel || "（名前なし）"}
                            >
                              {groupLabel || "（名前なし）"}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">〃</span>
                          )}
                        </div>

                        {/* バー領域 */}
                        <div
                          data-shared-mini-bar-area
                          className="flex-1 relative"
                          style={{ height: 52 }}
                          onMouseDown={isLocked ? undefined : (e) => {
                            const rect = e.currentTarget.getBoundingClientRect()
                            drag.handleMouseDown(groupIdx, Math.floor(((e.clientX - rect.left) / rect.width) * displayDays) + rowIdx * displayDays)
                          }}
                          onMouseMove={isLocked ? undefined : (e) => {
                            if (!drag.isDragging.current) return
                            const rect = e.currentTarget.getBoundingClientRect()
                            drag.handleMouseMove(Math.floor(((e.clientX - rect.left) / rect.width) * displayDays) + rowIdx * displayDays)
                          }}
                        >
                          <GanttBarAreaBackground days={rowDays} totalDays={displayDays} rangeStart={rowRangeStart} />

                          {group.schedules.map((schedule) => {
                            const plannedPos = getRowBarPos(schedule.plannedStartDate, schedule.plannedEndDate)
                            const actualPos = getRowBarPos(schedule.actualStartDate, schedule.actualEndDate)
                            const cfg = getWtConfig(schedule.workType, wtConfigMap)

                            // 範囲外 — only show indicator on first row
                            if (!plannedPos && !actualPos) {
                              if (!isFirstRow) return null
                              const refDate = schedule.plannedStartDate ?? schedule.actualStartDate
                              const isAfterRange = refDate ? isAfter(parseISO(refDate), rangeEnd) : false
                              const dateLabel = refDate ? format(parseISO(refDate), "M/d") : ""
                              return (
                                <div
                                  key={schedule.id}
                                  className="absolute z-[5] flex items-center cursor-pointer hover:opacity-80"
                                  style={{ top: 6, height: 26, ...(isAfterRange ? { right: 4 } : { left: 4 }) }}
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
                                y={6}
                                isSelectMode={!isLocked && effectiveDrawMode === "select"}
                                moveState={move.moveState}
                                resizeState={resize.resizeState}
                                rangeStart={rowRangeStart}
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

                          {/* ドラッグプレビュー — only on first row */}
                          {isFirstRow && (() => {
                            const preview = drag.getDragPreview(groupIdx)
                            if (!preview) return null
                            return (
                              <GanttDragPreview
                                startDay={preview.startDay}
                                endDay={preview.endDay}
                                totalDays={displayDays}
                                workType={drag.dragDrawModeRef.current}
                                wtConfig={getWtConfig(drag.dragDrawModeRef.current, wtConfigMap)}
                                y={6}
                              />
                            )
                          })()}
                        </div>
                      </div>
                    )
                  })}

                  {/* 新規追加行 — only on first row */}
                  {isFirstRow && !isLocked && (
                    <div className="flex border-b border-slate-100">
                      <div
                        className="flex-shrink-0 px-2 py-1 border-r border-slate-200 flex items-center"
                        style={{ width: leftColumnWidth }}
                      >
                        <button
                          onClick={onAddWorkContent}
                          className={`text-xs text-slate-500 flex items-center gap-0.5 ${
                            onAddWorkContent ? "hover:text-blue-600 cursor-pointer" : "cursor-default"
                          }`}
                        >
                          <span className="text-sm leading-none">＋</span>新しい作業内容
                        </button>
                      </div>
                      {effectiveDrawMode !== "select" ? (
                        <div
                          data-shared-mini-bar-area
                          className="flex-1 relative"
                          style={{ height: 44 }}
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
                          <GanttBarAreaBackground days={rowDays} totalDays={displayDays} rangeStart={rowRangeStart} />
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
                                y={6}
                              />
                            )
                          })()}
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-xs text-slate-500">
                              ドラッグして{getWtConfig(effectiveDrawMode, wtConfigMap).label}を追加
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 relative border-l border-slate-100" style={{ height: 44 }}>
                          <GanttBarAreaBackground days={rowDays} totalDays={displayDays} rangeStart={rowRangeStart} />
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
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

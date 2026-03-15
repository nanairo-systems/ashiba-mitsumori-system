/**
 * [COMPONENT] 共有ミニガントチャート
 *
 * SiteOpsDialog と ContractDetail の両方で使用する共有モジュール。
 * GanttToolbar / GanttDateHeader / GanttBar / GanttBarArea の共通部品を利用。
 *
 * 機能:
 * - 14日×2段（28日表示）
 * - 工種別バー表示（予定＋実績）
 * - 重複バーのレーン分離（同日程の工程が重ならず操作可能）
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

/** 1段あたりの表示日数 */
const DAYS_PER_ROW = 14
/** バー1本分の高さ（予定28px） */
const BAR_HEIGHT = 28
/** レーン間の余白 */
const LANE_GAP = 8
/** バーの上マージン */
const BAR_TOP_MARGIN = 8

export interface ScheduleMiniGanttProps {
  schedules: ScheduleData[]
  /** 1段の表示日数（デフォルト: 14） */
  displayDays?: number
  isLocked?: boolean
  workTypes?: WorkTypeMaster[]
  onCreateSchedule: (workType: string, name: string, startDate: string, endDate: string, workContentId?: string) => void
  defaultWorkContentId?: string | null
  onUpdateDates: (scheduleId: string, startDate: string, endDate: string) => void
  onClickSchedule?: (scheduleId: string) => void
  onDeleteSchedule?: (scheduleId: string) => void
  onCalendarOpen?: () => void
  leftColumnWidth?: number
  promptGroupName?: boolean
  defaultGroupName?: string | null
}

/** レーン割り当て: すべてのバーを同一行に重ねて表示 */
function assignLanes(schedules: ScheduleData[]): Map<string, number> {
  const laneMap = new Map<string, number>()
  for (const s of schedules) {
    laneMap.set(s.id, 0)
  }
  return laneMap
}

/** レーン数を計算 */
function getMaxLane(laneMap: Map<string, number>): number {
  let max = 0
  for (const lane of laneMap.values()) {
    if (lane > max) max = lane
  }
  return laneMap.size > 0 ? max + 1 : 1
}

/** 行の高さを計算 */
function calcRowHeight(laneCount: number): number {
  return BAR_TOP_MARGIN + laneCount * (BAR_HEIGHT + LANE_GAP)
}

/** レーンインデックスからy位置を計算 */
function laneToY(laneIndex: number): number {
  return BAR_TOP_MARGIN + laneIndex * (BAR_HEIGHT + LANE_GAP)
}

export function ScheduleMiniGantt({
  schedules,
  displayDays: displayDaysProp = DAYS_PER_ROW,
  isLocked = false,
  workTypes: workTypesProp,
  onCreateSchedule,
  onUpdateDates,
  onClickSchedule,
  onDeleteSchedule,
  onCalendarOpen,
  leftColumnWidth = 110,
  promptGroupName = true,
  defaultGroupName = null,
  defaultWorkContentId = null,
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

  // ── 表示範囲（28日分: 上段14日 + 下段14日） ──
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

  // 上段
  const row1End = addDays(rangeStart, displayDays - 1)
  const row1Days = useMemo(
    () => eachDayOfInterval({ start: rangeStart, end: row1End }),
    [rangeStart, row1End]
  )
  // 下段
  const row2Start = addDays(rangeStart, displayDays)
  const row2End = addDays(rangeStart, displayDays * 2 - 1)
  const row2Days = useMemo(
    () => eachDayOfInterval({ start: row2Start, end: row2End }),
    [row2Start, row2End]
  )

  const cellWidthPct = 100 / displayDays

  // ── 選択中のスケジュール（削除ポップオーバー用） ──
  const [selectedBarId, setSelectedBarId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  // 28日単位でナビゲーション
  const shiftDays = useCallback((n: number) => setRangeStart((prev) => addDays(prev, n)), [])

  // ── バー位置ヘルパー（段ごとに計算） ──
  const getBarPosForRow = useCallback((startStr: string | null, endStr: string | null, rowRangeStart: Date) => {
    if (!startStr) return null
    const pos = getBarPos(startStr, endStr ?? startStr, rowRangeStart, displayDays)
    if (!pos) return null
    return { left: `${pos.left}%`, width: `${pos.width}%` }
  }, [displayDays])

  // ── グループ化 ──
  const groups = useMemo(() => groupSchedulesByName(schedules, workTypeSortOrder), [schedules, workTypeSortOrder])

  // ── レーン割り当て（グループごと） ──
  const groupLanes = useMemo(() => {
    return groups.map((group) => {
      const laneMap = assignLanes(group.schedules)
      const maxLane = getMaxLane(laneMap)
      return { laneMap, maxLane }
    })
  }, [groups])

  // ── カスタムフック: ドラッグ作成（統合・上下またぎ対応） ──
  // dayIdx は 0-27 の絶対インデックス（上段0-13 / 下段14-27）
  const drag = useGanttDrag({
    drawMode: isLocked ? "select" : effectiveDrawMode,
    onCreateSchedule: ({ identifier, workType, startDay, endDay }) => {
      const groupIdx = identifier as number
      const group = groups[groupIdx]
      const startStr = dayIdxToStr(startDay, rangeStart)
      const endStr = dayIdxToStr(endDay, rangeStart)
      if (group?.name) {
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

  // ── コンテナレベル mouseMove（上下またぎドラッグ対応） ──
  const handleGanttMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drag.isDragging.current || isLocked) return
    const container = e.currentTarget as HTMLElement
    const barAreas = container.querySelectorAll<HTMLElement>("[data-row-offset]")
    // カーソルがどの段のバーエリア内にあるか判定
    for (const area of barAreas) {
      const rect = area.getBoundingClientRect()
      if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
        const offset = parseInt(area.dataset.rowOffset || "0")
        const localDayIdx = Math.max(0, Math.min(displayDays - 1,
          Math.floor(((e.clientX - rect.left) / rect.width) * displayDays)))
        drag.handleMouseMove(localDayIdx + offset)
        return
      }
    }
    // ヘッダー上など段の間: Y位置から上段/下段を推定
    if (barAreas.length >= 2) {
      const firstRect = barAreas[0].getBoundingClientRect()
      const lastRect = barAreas[barAreas.length - 1].getBoundingClientRect()
      const midY = (firstRect.bottom + lastRect.top) / 2
      const offset = e.clientY > midY ? displayDays : 0
      const localDayIdx = Math.max(0, Math.min(displayDays - 1,
        Math.floor(((e.clientX - firstRect.left) / firstRect.width) * displayDays)))
      drag.handleMouseMove(localDayIdx + offset)
    }
  }, [drag, isLocked, displayDays])

  // ── カスタムフック: ロングプレス移動（上段） ──
  const move1 = useGanttMove({
    rangeStart,
    totalDays: displayDays,
    drawMode: isLocked ? "select" : effectiveDrawMode,
    barAreaSelector: "[data-shared-mini-bar-area]",
    onMoveSchedule: onUpdateDates,
    onClickSchedule: isLocked ? undefined : onClickSchedule
      ? (schedule) => onClickSchedule(schedule.id)
      : undefined,
  })

  // ── カスタムフック: ロングプレス移動（下段） ──
  const move2 = useGanttMove({
    rangeStart: row2Start,
    totalDays: displayDays,
    drawMode: isLocked ? "select" : effectiveDrawMode,
    barAreaSelector: "[data-shared-mini-bar-area]",
    onMoveSchedule: onUpdateDates,
    onClickSchedule: isLocked ? undefined : onClickSchedule
      ? (schedule) => onClickSchedule(schedule.id)
      : undefined,
  })

  // ── カスタムフック: エッジリサイズ（上段） ──
  const resize1 = useGanttResize({
    rangeStart,
    totalDays: displayDays,
    drawMode: isLocked ? "select" : effectiveDrawMode,
    barAreaSelector: "[data-shared-mini-bar-area]",
    onResizeSchedule: onUpdateDates,
    longPressTimerRef: move1.longPressTimerRef,
    onShiftRange: shiftDays,
  })

  // ── カスタムフック: エッジリサイズ（下段） ──
  const resize2 = useGanttResize({
    rangeStart: row2Start,
    totalDays: displayDays,
    drawMode: isLocked ? "select" : effectiveDrawMode,
    barAreaSelector: "[data-shared-mini-bar-area]",
    onResizeSchedule: onUpdateDates,
    longPressTimerRef: move2.longPressTimerRef,
    onShiftRange: shiftDays,
  })

  /** 段のバーエリアをレンダリング */
  function renderBarArea(
    rowRangeStart: Date,
    rowDays: Date[],
    rowOffset: number,
    move: ReturnType<typeof useGanttMove>,
    resize: ReturnType<typeof useGanttResize>,
    group: { name: string | null; schedules: ScheduleData[] },
    groupIdx: number,
    laneMap: Map<string, number>,
    maxLane: number,
  ) {
    const rowHeight = calcRowHeight(maxLane)
    const rowRangeEnd = addDays(rowRangeStart, displayDays - 1)

    return (
      <div
        data-shared-mini-bar-area
        data-row-offset={rowOffset}
        className="flex-1 relative"
        style={{ height: rowHeight }}
        onMouseDown={isLocked ? undefined : (e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const localDayIdx = Math.floor(((e.clientX - rect.left) / rect.width) * displayDays)
          drag.handleMouseDown(groupIdx, localDayIdx + rowOffset)
        }}
      >
        <GanttBarAreaBackground days={rowDays} totalDays={displayDays} rangeStart={rowRangeStart} />

        {group.schedules.map((schedule) => {
          const plannedPos = getBarPosForRow(schedule.plannedStartDate, schedule.plannedEndDate, rowRangeStart)
          const actualPos = getBarPosForRow(schedule.actualStartDate, schedule.actualEndDate, rowRangeStart)
          const cfg = getWtConfig(schedule.workType, wtConfigMap)
          const lane = laneMap.get(schedule.id) ?? 0
          const barY = laneToY(lane)

          // 範囲外インジケータ
          if (!plannedPos && !actualPos) {
            const refDate = schedule.plannedStartDate ?? schedule.actualStartDate
            if (!refDate) return null
            const refParsed = parseISO(refDate)
            const isAfterRange = isAfter(refParsed, rowRangeEnd)
            const isBeforeRange = isBefore(refParsed, rowRangeStart)
            // 上段でのみ範囲外表示（下段では表示しない）
            if (rowRangeStart !== rangeStart) return null
            if (!isAfterRange && !isBeforeRange) return null
            const dateLabel = format(refParsed, "M/d")
            return (
              <div
                key={schedule.id}
                className="absolute z-[5] flex items-center cursor-pointer hover:opacity-80"
                style={{ top: barY, height: 26, ...(isAfterRange ? { right: 4 } : { left: 4 }) }}
                onClick={(e) => {
                  e.stopPropagation()
                  setRangeStart(subDays(refParsed, 3))
                }}
              >
                <span className={`text-xs ${cfg.text} px-1.5 py-0.5 rounded ${cfg.bg} border ${cfg.border} flex items-center gap-0.5`}>
                  {!isAfterRange && <span>◀</span>}
                  {cfg.label} {dateLabel}〜
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
              y={barY}
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
                if (!isLocked && onDeleteSchedule) {
                  setSelectedBarId(prev => prev === s.id ? null : s.id)
                }
                if (!isLocked && onClickSchedule) onClickSchedule(s.id)
              }}
              isSelected={selectedBarId === schedule.id}
              onBarEdgeMouseDown={(s, edge, e) => resize.handleBarEdgeMouseDown(s, edge, e)}
              onDeleteClick={onDeleteSchedule ? (s) => {
                if (!confirm("この工程を削除しますか？")) return
                setDeleting(true)
                fetch(`/api/schedules/${s.id}`, { method: "DELETE" })
                  .then((r) => {
                    if (r.ok) { setSelectedBarId(null); onDeleteSchedule(s.id) }
                    else throw new Error()
                  })
                  .catch(() => { import("sonner").then(m => m.toast.error("削除に失敗しました")) })
                  .finally(() => setDeleting(false))
              } : undefined}
            />
          )
        })}

        {/* ドラッグプレビュー（絶対インデックスを段にクリップ） */}
        {(() => {
          const preview = drag.getDragPreview(groupIdx)
          if (!preview) return null
          const clampedStart = Math.max(0, preview.startDay - rowOffset)
          const clampedEnd = Math.min(displayDays - 1, preview.endDay - rowOffset)
          if (clampedStart > displayDays - 1 || clampedEnd < 0) return null
          return (
            <GanttDragPreview
              startDay={clampedStart}
              endDay={clampedEnd}
              totalDays={displayDays}
              workType={drag.dragDrawModeRef.current}
              wtConfig={getWtConfig(drag.dragDrawModeRef.current, wtConfigMap)}
              y={BAR_TOP_MARGIN}
            />
          )
        })()}
      </div>
    )
  }

  /** 空の行（スケジュール0件）をレンダリング */
  function renderEmptyRow(
    rowRangeStart: Date,
    rowDays: Date[],
    rowOffset: number,
    showLabel: boolean,
  ) {
    return (
      <div className="flex border-b border-slate-100">
        {showLabel ? (
          <div
            className="flex-shrink-0 px-2 border-r border-slate-200 bg-slate-50 flex items-center justify-center"
            style={{ width: leftColumnWidth }}
          >
            <span className="text-sm font-bold text-slate-800 truncate text-center">{defaultGroupName}</span>
          </div>
        ) : (
          <div className="flex-shrink-0 border-r border-slate-200 bg-slate-50" style={{ width: leftColumnWidth }} />
        )}
        <div
          data-shared-mini-bar-area
          data-row-offset={rowOffset}
          className="flex-1 relative"
          style={{ height: 52 }}
          onMouseDown={isLocked || effectiveDrawMode === "select" ? undefined : (e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const localDayIdx = Math.floor(((e.clientX - rect.left) / rect.width) * displayDays)
            drag.handleMouseDown(0, localDayIdx + rowOffset)
          }}
        >
          <GanttBarAreaBackground days={rowDays} totalDays={displayDays} rangeStart={rowRangeStart} />
          {(() => {
            const preview = drag.getDragPreview(0)
            if (!preview) return null
            const clampedStart = Math.max(0, preview.startDay - rowOffset)
            const clampedEnd = Math.min(displayDays - 1, preview.endDay - rowOffset)
            if (clampedStart > displayDays - 1 || clampedEnd < 0) return null
            return (
              <GanttDragPreview
                startDay={clampedStart}
                endDay={clampedEnd}
                totalDays={displayDays}
                workType={drag.dragDrawModeRef.current}
                wtConfig={getWtConfig(drag.dragDrawModeRef.current, wtConfigMap)}
                y={12}
              />
            )
          })()}
          {showLabel && effectiveDrawMode === "select" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-xs text-slate-400">工種を選択してドラッグで作成</span>
            </div>
          )}
          {showLabel && effectiveDrawMode !== "select" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-xs text-slate-500">
                ドラッグして{getWtConfig(effectiveDrawMode, wtConfigMap).label}を追加
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* ミニツールバー */}
      <GanttToolbar
        variant="mini"
        drawMode={drawMode}
        effectiveDrawMode={effectiveDrawMode}
        rangeStart={rangeStart}
        displayDays={displayDays * 2}
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
        onMouseMove={handleGanttMouseMove}
        onMouseUp={isLocked ? undefined : () => drag.handleMouseUp()}
        onMouseLeave={isLocked ? undefined : () => drag.handleMouseUp()}
      >
        {/* ══ 上段 ══ */}
        {/* 上段ヘッダー */}
        <GanttDateHeader
          days={row1Days}
          cellWidthPct={cellWidthPct}
          leftColumnWidth={leftColumnWidth}
          leftColumnLabel="作業内容"
          variant="mini"
        />

        {/* 上段 工程行 */}
        {schedules.length === 0 ? (
          <>
            {defaultGroupName && renderEmptyRow(rangeStart, row1Days, 0, true)}
            {!defaultGroupName && effectiveDrawMode === "select" && (
              <div className="text-center py-4 text-slate-400">
                <p className="text-xs">工事日程がまだ登録されていません</p>
                <p className="text-xs text-slate-500 mt-0.5">上のモード切替で工種を選択し、ドラッグで作成</p>
              </div>
            )}
          </>
        ) : (
          groups.map((group, groupIdx) => {
            const groupLabel = group.name
              ?? (group.schedules.length === 1
                ? getWtConfig(group.schedules[0].workType, wtConfigMap).label
                : "")
            const { laneMap, maxLane } = groupLanes[groupIdx]

            return (
              <div key={`row1-${groupIdx}`} className="flex border-b border-slate-100">
                <div
                  className="flex-shrink-0 px-2 border-r border-slate-200 bg-slate-50 flex items-center justify-center"
                  style={{ width: leftColumnWidth }}
                >
                  <button
                    className={`text-sm font-bold text-slate-800 truncate text-center ${
                      !isLocked && onClickSchedule ? "hover:text-blue-600 hover:underline cursor-pointer" : ""
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
                </div>
                {renderBarArea(rangeStart, row1Days, 0, move1, resize1, group, groupIdx, laneMap, maxLane)}
              </div>
            )
          })
        )}

        {/* ══ 下段 ══ */}
        {/* 下段ヘッダー */}
        <GanttDateHeader
          days={row2Days}
          cellWidthPct={cellWidthPct}
          leftColumnWidth={leftColumnWidth}
          leftColumnLabel=""
          variant="mini"
        />

        {/* 下段 工程行 */}
        {schedules.length === 0 ? (
          defaultGroupName && renderEmptyRow(row2Start, row2Days, displayDays, false)
        ) : (
          groups.map((group, groupIdx) => {
            const { laneMap, maxLane } = groupLanes[groupIdx]

            return (
              <div key={`row2-${groupIdx}`} className="flex border-b border-slate-100 last:border-b-0">
                <div
                  className="flex-shrink-0 px-2 border-r border-slate-200 bg-slate-50"
                  style={{ width: leftColumnWidth }}
                />
                {renderBarArea(row2Start, row2Days, displayDays, move2, resize2, group, groupIdx, laneMap, maxLane)}
              </div>
            )
          })
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

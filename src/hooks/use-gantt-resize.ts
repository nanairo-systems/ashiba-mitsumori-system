/**
 * [HOOK] ガントチャート エッジリサイズ
 *
 * バーの左端・右端をドラッグしてリサイズ。
 */
"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { differenceInDays, parseISO } from "date-fns"
import type { ScheduleData, GanttResizeState, DrawMode } from "@/components/schedules/schedule-types"
import { dayIdxToStr } from "@/components/schedules/schedule-utils"

interface UseGanttResizeOptions {
  rangeStart: Date
  totalDays: number
  drawMode: DrawMode
  barAreaSelector: string
  onResizeSchedule: (scheduleId: string, newStart: string, newEnd: string) => void
  /** ロングプレスタイマーの参照（move と共有して競合を防ぐ） */
  longPressTimerRef?: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
  /** リサイズ中に表示範囲を自動シフトするコールバック */
  onShiftRange?: (days: number) => void
}

export function useGanttResize({
  rangeStart,
  totalDays,
  drawMode,
  barAreaSelector,
  onResizeSchedule,
  longPressTimerRef: externalTimerRef,
  onShiftRange,
}: UseGanttResizeOptions) {
  const [resizeState, setResizeState] = useState<GanttResizeState | null>(null)
  const resizeStateRef = useRef(resizeState)
  const resizeDaysRef = useRef({ startDay: 0, endDay: 0 })
  resizeStateRef.current = resizeState
  if (resizeState) {
    resizeDaysRef.current.startDay = resizeState.startDay
    resizeDaysRef.current.endDay = resizeState.endDay
  }

  const handleBarEdgeMouseDown = useCallback((
    schedule: ScheduleData,
    edge: "left" | "right",
    e: React.MouseEvent,
    contractId?: string
  ) => {
    e.stopPropagation()
    e.preventDefault()
    if (drawMode !== "select" || !schedule.plannedStartDate) return
    const barArea = (e.currentTarget as HTMLElement).closest(barAreaSelector) as HTMLElement | null
    if (!barArea) return
    const rect = barArea.getBoundingClientRect()
    const startDay = Math.max(0, differenceInDays(parseISO(schedule.plannedStartDate), rangeStart))
    const endDay = schedule.plannedEndDate
      ? Math.min(totalDays - 1, differenceInDays(parseISO(schedule.plannedEndDate), rangeStart))
      : startDay

    // ロングプレスタイマーをキャンセル
    if (externalTimerRef?.current) {
      clearTimeout(externalTimerRef.current)
      externalTimerRef.current = null
    }

    setResizeState({
      schedule,
      contractId,
      edge,
      startDay,
      endDay,
      barAreaRect: rect,
    })
  }, [drawMode, barAreaSelector, totalDays, rangeStart, externalTimerRef])

  // 自動シフト用タイマー
  const autoShiftTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onShiftRangeRef = useRef(onShiftRange)
  onShiftRangeRef.current = onShiftRange

  // ドキュメントレベルのマウスイベント
  useEffect(() => {
    if (!resizeState) return
    function onMouseMove(ev: MouseEvent) {
      const r = resizeStateRef.current
      if (!r) return
      const rect = r.barAreaRect
      const rawDayIdx = Math.floor(((ev.clientX - rect.left) / rect.width) * totalDays)
      const dayIdx = Math.max(0, Math.min(totalDays - 1, rawDayIdx))

      if (r.edge === "left") {
        const startDay = Math.min(dayIdx, resizeDaysRef.current.endDay)
        resizeDaysRef.current.startDay = startDay
        setResizeState((prev) => prev ? { ...prev, startDay } : null)
      } else {
        const endDay = Math.max(dayIdx, resizeDaysRef.current.startDay)
        resizeDaysRef.current.endDay = endDay
        setResizeState((prev) => prev ? { ...prev, endDay } : null)
      }

      // 右端到達時の自動シフト
      if (r.edge === "right" && rawDayIdx >= totalDays - 1 && onShiftRangeRef.current) {
        if (!autoShiftTimerRef.current) {
          autoShiftTimerRef.current = setInterval(() => {
            onShiftRangeRef.current?.(2)
          }, 400)
        }
      } else if (r.edge === "left" && rawDayIdx <= 0 && onShiftRangeRef.current) {
        if (!autoShiftTimerRef.current) {
          autoShiftTimerRef.current = setInterval(() => {
            onShiftRangeRef.current?.(-2)
          }, 400)
        }
      } else {
        if (autoShiftTimerRef.current) {
          clearInterval(autoShiftTimerRef.current)
          autoShiftTimerRef.current = null
        }
      }
    }
    function onMouseUp() {
      if (autoShiftTimerRef.current) {
        clearInterval(autoShiftTimerRef.current)
        autoShiftTimerRef.current = null
      }
      const r = resizeStateRef.current
      const { startDay, endDay } = resizeDaysRef.current
      if (r) {
        onResizeSchedule(r.schedule.id, dayIdxToStr(startDay, rangeStart), dayIdxToStr(endDay, rangeStart))
      }
      setResizeState(null)
    }
    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
    return () => {
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!resizeState])

  return {
    resizeState,
    setResizeState,
    handleBarEdgeMouseDown,
  }
}

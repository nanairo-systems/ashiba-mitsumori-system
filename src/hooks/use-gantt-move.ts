/**
 * [HOOK] ガントチャート ロングプレス移動
 *
 * バーを400ms長押し → ドラッグで日付移動。
 * 掴んだ位置（grabOffset）がカーソルに追従する。
 */
"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { differenceInDays, parseISO } from "date-fns"
import type { ScheduleData, GanttMoveState, DrawMode } from "@/components/schedules/schedule-types"
import { dayIdxToStr } from "@/components/schedules/schedule-utils"

interface UseGanttMoveOptions {
  rangeStart: Date
  totalDays: number
  drawMode: DrawMode
  barAreaSelector: string
  onMoveSchedule: (scheduleId: string, newStart: string, newEnd: string) => void
  onClickSchedule?: (schedule: ScheduleData, e: React.MouseEvent) => void
}

export function useGanttMove({
  rangeStart,
  totalDays,
  drawMode,
  barAreaSelector,
  onMoveSchedule,
  onClickSchedule,
}: UseGanttMoveOptions) {
  const [moveState, setMoveState] = useState<GanttMoveState | null>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const moveStateRef = useRef(moveState)
  const moveStartDayRef = useRef(0)
  moveStateRef.current = moveState
  if (moveState) moveStartDayRef.current = moveState.moveStartDay

  const handleBarMouseDown = useCallback((
    schedule: ScheduleData,
    e: React.MouseEvent,
    contractId?: string
  ) => {
    e.stopPropagation()
    if (drawMode !== "select") return
    const barArea = (e.currentTarget as HTMLElement).closest(barAreaSelector) as HTMLElement | null
    if (!barArea || !schedule.plannedStartDate) return
    const rect = barArea.getBoundingClientRect()
    const span = schedule.plannedEndDate
      ? differenceInDays(parseISO(schedule.plannedEndDate), parseISO(schedule.plannedStartDate)) + 1
      : 1
    const clickDayIdx = Math.floor(((e.clientX - rect.left) / rect.width) * totalDays)
    const barStartIdx = Math.max(0, differenceInDays(parseISO(schedule.plannedStartDate), rangeStart))
    const grabOffset = Math.max(0, Math.min(clickDayIdx - barStartIdx, span - 1))
    const startIdx = Math.max(0, Math.min(clickDayIdx - grabOffset, totalDays - span))

    // schedule と e を保存しておき、短いクリックなら edit に渡す
    const savedSchedule = schedule
    const savedEvent = e

    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null
      setMoveState({
        schedule,
        contractId,
        span,
        moveStartDay: startIdx,
        grabOffset,
        barAreaRect: rect,
      })
    }, 400)

    // handleBarMouseUp 用にクロージャ外に保持
    ;(handleBarMouseDown as unknown as { _saved: unknown })._saved = { savedSchedule, savedEvent }
  }, [drawMode, barAreaSelector, totalDays, rangeStart])

  const handleBarMouseUp = useCallback((schedule: ScheduleData, e: React.MouseEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
      onClickSchedule?.(schedule, e)
    }
  }, [onClickSchedule])

  // ドキュメントレベルのマウスイベント
  useEffect(() => {
    if (!moveState) return
    function onMouseMove(ev: MouseEvent) {
      const m = moveStateRef.current
      if (!m) return
      const rect = m.barAreaRect
      const dayIdx = Math.floor(((ev.clientX - rect.left) / rect.width) * totalDays)
      const startIdx = Math.max(0, Math.min(dayIdx - m.grabOffset, totalDays - m.span))
      moveStartDayRef.current = startIdx
      setMoveState((prev) => prev ? { ...prev, moveStartDay: startIdx } : null)
    }
    function onMouseUp() {
      const m = moveStateRef.current
      const startDay = moveStartDayRef.current
      if (m) {
        const newStart = dayIdxToStr(startDay, rangeStart)
        const newEnd = dayIdxToStr(startDay + m.span - 1, rangeStart)
        onMoveSchedule(m.schedule.id, newStart, newEnd)
      }
      setMoveState(null)
    }
    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
    return () => {
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!moveState])

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }
    }
  }, [])

  return {
    moveState,
    setMoveState,
    longPressTimerRef,
    handleBarMouseDown,
    handleBarMouseUp,
  }
}

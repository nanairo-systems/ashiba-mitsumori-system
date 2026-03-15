/**
 * [HOOK] ガントチャート エッジリサイズ
 *
 * バーの左端・右端をドラッグしてリサイズ。
 * 端を表示範囲外まで伸ばすと自動スクロール対応。
 */
"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { differenceInDays, parseISO, addDays, format } from "date-fns"
import type { ScheduleData, GanttResizeState, DrawMode } from "@/components/schedules/schedule-types"

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

  // ref で最新値を追跡（クロージャ対策）
  const rangeStartRef = useRef(rangeStart)
  rangeStartRef.current = rangeStart

  // リサイズ中の絶対日付を追跡（rangeStart シフトに影響されない）
  const absoluteDatesRef = useRef({ startDate: "", endDate: "" })

  // 自動シフト用
  const autoShiftTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onShiftRangeRef = useRef(onShiftRange)
  onShiftRangeRef.current = onShiftRange

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

    // 絶対日付を保存
    absoluteDatesRef.current = {
      startDate: schedule.plannedStartDate,
      endDate: schedule.plannedEndDate ?? schedule.plannedStartDate,
    }

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

  // rangeStart が変わったらリサイズ中の startDay/endDay を再計算
  useEffect(() => {
    if (!resizeState) return
    const { startDate, endDate } = absoluteDatesRef.current
    if (!startDate) return

    const newStartDay = differenceInDays(parseISO(startDate), rangeStart)
    const newEndDay = differenceInDays(parseISO(endDate), rangeStart)

    resizeDaysRef.current.startDay = newStartDay
    resizeDaysRef.current.endDay = newEndDay

    // barAreaRect も更新
    const barArea = document.querySelector(barAreaSelector) as HTMLElement | null
    const newRect = barArea?.getBoundingClientRect()

    setResizeState((prev) => prev ? {
      ...prev,
      startDay: newStartDay,
      endDay: newEndDay,
      ...(newRect ? { barAreaRect: newRect } : {}),
    } : null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart])

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
        const clampedEnd = resizeDaysRef.current.endDay
        const startDay = Math.min(dayIdx, clampedEnd)
        resizeDaysRef.current.startDay = startDay
        absoluteDatesRef.current.startDate = format(addDays(rangeStartRef.current, startDay), "yyyy-MM-dd")
        setResizeState((prev) => prev ? { ...prev, startDay } : null)
      } else {
        const clampedStart = resizeDaysRef.current.startDay
        const endDay = Math.max(dayIdx, clampedStart)
        resizeDaysRef.current.endDay = endDay
        absoluteDatesRef.current.endDate = format(addDays(rangeStartRef.current, endDay), "yyyy-MM-dd")
        setResizeState((prev) => prev ? { ...prev, endDay } : null)
      }

      // 端到達時の自動シフト
      const shouldShiftRight = r.edge === "right" && rawDayIdx >= totalDays - 1
      const shouldShiftLeft = r.edge === "left" && rawDayIdx <= 0

      if ((shouldShiftRight || shouldShiftLeft) && onShiftRangeRef.current) {
        if (!autoShiftTimerRef.current) {
          const shiftAmount = shouldShiftRight ? 2 : -2
          autoShiftTimerRef.current = setInterval(() => {
            // 絶対日付を先に更新してからシフト
            if (shouldShiftRight) {
              const curEnd = parseISO(absoluteDatesRef.current.endDate)
              absoluteDatesRef.current.endDate = format(addDays(curEnd, 2), "yyyy-MM-dd")
            } else {
              const curStart = parseISO(absoluteDatesRef.current.startDate)
              absoluteDatesRef.current.startDate = format(addDays(curStart, -2), "yyyy-MM-dd")
            }
            onShiftRangeRef.current?.(shiftAmount)
          }, 500)
        }
      } else {
        if (autoShiftTimerRef.current) {
          clearInterval(autoShiftTimerRef.current)
          autoShiftTimerRef.current = null
        }
      }
    }

    function onMouseUp() {
      // 自動シフトタイマー停止
      if (autoShiftTimerRef.current) {
        clearInterval(autoShiftTimerRef.current)
        autoShiftTimerRef.current = null
      }
      const r = resizeStateRef.current
      if (r) {
        const { startDate, endDate } = absoluteDatesRef.current
        onResizeSchedule(r.schedule.id, startDate, endDate)
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

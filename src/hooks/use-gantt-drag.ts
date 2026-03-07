/**
 * [HOOK] ガントチャート ドラッグ作成
 *
 * バーエリア上でマウスドラッグして新しいスケジュールバーを作成する。
 */
"use client"

import { useState, useRef, useCallback } from "react"
import type { DrawMode, GanttDragInfo } from "@/components/schedules/schedule-types"
import type { ScheduleWorkType } from "@prisma/client"

interface UseGanttDragOptions {
  drawMode: DrawMode
  onCreateSchedule: (params: {
    identifier: string | number
    workType: ScheduleWorkType
    startDay: number
    endDay: number
  }) => void
}

export function useGanttDrag({ drawMode, onCreateSchedule }: UseGanttDragOptions) {
  const [dragInfo, _setDragInfo] = useState<GanttDragInfo | null>(null)
  const dragInfoRef = useRef<GanttDragInfo | null>(null)
  const setDragInfo = useCallback((val: GanttDragInfo | null | ((prev: GanttDragInfo | null) => GanttDragInfo | null)) => {
    if (typeof val === "function") {
      _setDragInfo((prev) => {
        const next = val(prev)
        dragInfoRef.current = next
        return next
      })
    } else {
      dragInfoRef.current = val
      _setDragInfo(val)
    }
  }, [])
  const isDragging = useRef(false)
  const dragDrawModeRef = useRef<ScheduleWorkType>("ASSEMBLY")

  const handleMouseDown = useCallback((identifier: string | number, dayIdx: number) => {
    if (drawMode === "select") return
    isDragging.current = true
    dragDrawModeRef.current = drawMode as ScheduleWorkType
    if (typeof identifier === "string") {
      setDragInfo({ contractId: identifier, startDay: dayIdx, endDay: dayIdx })
    } else {
      setDragInfo({ rowIdx: identifier, startDay: dayIdx, endDay: dayIdx })
    }
  }, [drawMode])

  const handleMouseMove = useCallback((dayIdx: number) => {
    if (!isDragging.current) return
    setDragInfo((prev) => prev ? { ...prev, endDay: dayIdx } : null)
  }, [])

  const handleMouseUp = useCallback(() => {
    if (!isDragging.current) {
      isDragging.current = false
      setDragInfo(null)
      return
    }
    isDragging.current = false
    // dragInfo を先に取得してからリセット（onCreateSchedule 内で prompt() 等を呼べるように）
    const prev = dragInfoRef.current
    setDragInfo(null)
    if (!prev) return
    const startDay = Math.min(prev.startDay, prev.endDay)
    const endDay = Math.max(prev.startDay, prev.endDay)
    const identifier = prev.contractId ?? prev.rowIdx ?? 0
    onCreateSchedule({
      identifier,
      workType: dragDrawModeRef.current,
      startDay,
      endDay,
    })
  }, [onCreateSchedule])

  const getDragPreview = useCallback((identifier: string | number) => {
    if (!dragInfo) return null
    const matchesContract = typeof identifier === "string" && dragInfo.contractId === identifier
    const matchesRow = typeof identifier === "number" && dragInfo.rowIdx === identifier
    if (!matchesContract && !matchesRow) return null
    const startDay = Math.min(dragInfo.startDay, dragInfo.endDay)
    const endDay = Math.max(dragInfo.startDay, dragInfo.endDay)
    return { startDay, endDay }
  }, [dragInfo])

  return {
    dragInfo,
    isDragging,
    dragDrawModeRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    getDragPreview,
  }
}

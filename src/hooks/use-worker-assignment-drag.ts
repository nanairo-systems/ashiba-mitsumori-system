/**
 * [HOOK] 人員配置 - ドラッグ&ドロップ
 *
 * @dnd-kit/core を使い、現場カード・職人カードの移動を管理する。
 * - PointerSensor（8px距離でドラッグ開始）
 * - 現場カード: 同日付内で別チームへ移動（全アサイン一括更新）
 * - 職人カード: 別チーム・別現場の詳細パネルへ移動
 * - エラー時はデータ再取得でロールバック
 */
"use client"

import { useState, useCallback } from "react"
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core"
import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { toast } from "sonner"
import type {
  DragItemData,
  DropTargetData,
  SiteCardDragData,
  WorkerCardDragData,
} from "@/components/worker-assignments/types"

export function useWorkerAssignmentDrag(onRefresh: () => void) {
  const [activeItem, setActiveItem] = useState<DragItemData | null>(null)
  const isDragging = activeItem !== null

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as DragItemData | undefined
    if (data) setActiveItem(data)
  }, [])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { over } = event
      const dragData = activeItem
      setActiveItem(null)

      if (!over || !dragData) return

      const dropData = over.data.current as DropTargetData | undefined
      if (!dropData) return

      try {
        if (dragData.type === "site-card" && dropData.type === "team-cell") {
          const d = dragData as SiteCardDragData
          // 同じチーム → 何もしない
          if (d.teamId === dropData.teamId) return
          // 異なる日付 → エラー
          if (d.dateKey !== dropData.dateKey) {
            toast.error("同じ日付内でのみ移動できます")
            return
          }
          // 全アサインのチームIDを更新
          const results = await Promise.all(
            d.assignmentIds.map((id) =>
              fetch(`/api/worker-assignments/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamId: dropData.teamId }),
              })
            )
          )
          if (results.some((r) => !r.ok)) throw new Error()
          toast.success("現場を移動しました")
          onRefresh()
        } else if (dragData.type === "worker-card" && dropData.type === "worker-zone") {
          const d = dragData as WorkerCardDragData
          // 同じ場所 → 何もしない
          if (d.teamId === dropData.teamId && d.scheduleId === dropData.scheduleId) return
          const res = await fetch(`/api/worker-assignments/${d.assignmentId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              teamId: dropData.teamId,
              scheduleId: dropData.scheduleId,
            }),
          })
          if (!res.ok) throw new Error()
          toast.success("職人を移動しました")
          onRefresh()
        }
      } catch {
        toast.error("移動に失敗しました")
        onRefresh() // ロールバック: データ再取得
      }
    },
    [activeItem, onRefresh]
  )

  const handleDragCancel = useCallback(() => {
    setActiveItem(null)
  }, [])

  return {
    sensors,
    activeItem,
    isDragging,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  }
}

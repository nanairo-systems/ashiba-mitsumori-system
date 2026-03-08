/**
 * [HOOK] 人員配置 - ドラッグ&ドロップ
 *
 * @dnd-kit/core を使い、現場カード・職人カードの移動を管理する。
 * - PointerSensor + TouchSensor（500ms長押しでドラッグ開始）
 * - 現場カード → 別チームの空セル: 移動（全アサイン更新）
 * - 現場カード → 別チームの現場カード: 入替（scheduleId スワップ）
 * - 職人カード → 別現場: ダイアログで「この日だけ/全日程」選択
 * - エラー時はデータ再取得でロールバック
 */
"use client"

import { useState, useCallback } from "react"
import type { DragStartEvent, DragEndEvent, DragOverEvent } from "@dnd-kit/core"
import { PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core"
import { toast } from "sonner"
import type {
  DragItemData,
  DropTargetData,
  SiteCardDragData,
  WorkerCardDragData,
  UnassignedBarDragData,
  SiteCardDropData,
  PendingWorkerMove,
} from "@/components/worker-assignments/types"

export function useWorkerAssignmentDrag(
  onRefresh: () => void,
  onExpandDates?: (dateKeys: string[]) => void,
) {
  const [activeItem, setActiveItem] = useState<DragItemData | null>(null)
  const [pendingWorkerMove, setPendingWorkerMove] = useState<PendingWorkerMove | null>(null)
  const [hoveredTeamId, setHoveredTeamId] = useState<string | null>(null)
  const isDragging = activeItem !== null

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 500,
        tolerance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 500,
        tolerance: 5,
      },
    })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as DragItemData | undefined
    if (data) setActiveItem(data)
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const dropData = event.over?.data.current as DropTargetData | undefined
    if (dropData?.type === "team-cell") {
      setHoveredTeamId(dropData.teamId)
    } else if (dropData?.type === "site-card-drop") {
      setHoveredTeamId(dropData.teamId)
    } else {
      setHoveredTeamId(null)
    }
  }, [])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { over } = event
      const dragData = activeItem
      setActiveItem(null)
      setHoveredTeamId(null)

      if (!over || !dragData) return

      const dropData = over.data.current as DropTargetData | undefined
      if (!dropData) return

      try {
        // ── 現場カード → チームセル（空エリア）: 移動 ──
        if (dragData.type === "site-card" && dropData.type === "team-cell") {
          const d = dragData as SiteCardDragData
          if (d.teamId === dropData.teamId) return
          if (d.dateKey !== dropData.dateKey) {
            toast.error("同じ日付内でのみ移動できます")
            return
          }
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
        }

        // ── 現場カード → 別チームの現場カード: スワップ ──
        else if (dragData.type === "site-card" && dropData.type === "site-card-drop") {
          const d = dragData as SiteCardDragData
          const drop = dropData as SiteCardDropData
          // 同チーム同スケジュールなら無視
          if (d.teamId === drop.teamId && d.scheduleId === drop.scheduleId) return
          // 同日付のみ
          if (d.dateKey !== drop.dateKey) {
            toast.error("同じ日付内でのみ入替できます")
            return
          }
          const res = await fetch("/api/worker-assignments/swap-sites", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              groupA: { assignmentIds: d.assignmentIds, scheduleId: d.scheduleId },
              groupB: { assignmentIds: drop.assignmentIds, scheduleId: drop.scheduleId },
            }),
          })
          if (!res.ok) throw new Error()
          toast.success("現場を入替しました")
          onRefresh()
        }

        // ── 未配置バー → チームセル: 配置作成（チーム行のどこにドロップしてもOK） ──
        else if (dragData.type === "unassigned-bar" && dropData.type === "team-cell") {
          const d = dragData as UnassignedBarDragData

          const res = await fetch("/api/worker-assignments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              scheduleId: d.scheduleId,
              teamId: dropData.teamId,
              assignedRole: "WORKER",
            }),
          })
          if (!res.ok) {
            const data = await res.json().catch(() => null)
            throw new Error(data?.error ?? "配置に失敗しました")
          }
          const label = d.scheduleName || d.projectName
          toast.success(
            d.plannedStartDate
              ? `「${label}」を配置しました（${d.formattedDateRange}）`
              : `「${label}」を配置しました`
          )
          // 配置した工程の日程に該当する日付を自動展開
          if (d.plannedStartDate && onExpandDates) {
            const start = new Date(d.plannedStartDate)
            const end = d.plannedEndDate ? new Date(d.plannedEndDate) : start
            const dateKeys: string[] = []
            const cur = new Date(start)
            cur.setHours(0, 0, 0, 0)
            const endDay = new Date(end)
            endDay.setHours(0, 0, 0, 0)
            while (cur <= endDay) {
              dateKeys.push(cur.toISOString().slice(0, 10))
              cur.setDate(cur.getDate() + 1)
            }
            onExpandDates(dateKeys)
          }
          onRefresh()
        }

        // ── 職人カード → 別現場のドロップゾーン ──
        else if (dragData.type === "worker-card" && dropData.type === "worker-zone") {
          const d = dragData as WorkerCardDragData
          // 同じ場所 → 何もしない
          if (d.teamId === dropData.teamId && d.scheduleId === dropData.scheduleId) return

          // 日付が異なる場合は警告
          if (d.dateKey !== dropData.dateKey) {
            const confirmed = window.confirm(
              "日付が異なります。移動しますか？\n" +
              `${d.dateKey} → ${dropData.dateKey}`
            )
            if (!confirmed) return
          }

          // ダイアログ表示のためpendingに保存
          setPendingWorkerMove({
            assignmentId: d.assignmentId,
            workerName: d.workerName,
            sourceTeamId: d.teamId,
            sourceScheduleId: d.scheduleId,
            targetTeamId: dropData.teamId,
            targetScheduleId: dropData.scheduleId,
            moveDate: d.dateKey,
            scheduleName: null,
            isMultiDay: d.isMultiDay,
          })
        }
      } catch {
        toast.error("移動に失敗しました")
        onRefresh()
      }
    },
    [activeItem, onRefresh]
  )

  /** ダイアログで選択後の確定処理 */
  const confirmWorkerMove = useCallback(
    async (moveType: "day-only" | "all") => {
      if (!pendingWorkerMove) return
      try {
        const res = await fetch("/api/worker-assignments/move-worker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignmentId: pendingWorkerMove.assignmentId,
            targetTeamId: pendingWorkerMove.targetTeamId,
            targetScheduleId: pendingWorkerMove.targetScheduleId,
            moveDate: pendingWorkerMove.moveDate,
            moveType,
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(data?.error ?? "移動に失敗しました")
        }
        toast.success(
          moveType === "day-only"
            ? "この日の配置を移動しました"
            : "職人を移動しました"
        )
        setPendingWorkerMove(null)
        onRefresh()
      } catch (err) {
        const msg = err instanceof Error ? err.message : "移動に失敗しました"
        toast.error(msg)
        setPendingWorkerMove(null)
        onRefresh()
      }
    },
    [pendingWorkerMove, onRefresh]
  )

  const cancelWorkerMove = useCallback(() => {
    setPendingWorkerMove(null)
  }, [])

  const handleDragCancel = useCallback(() => {
    setActiveItem(null)
    setHoveredTeamId(null)
  }, [])

  return {
    sensors,
    activeItem,
    isDragging,
    hoveredTeamId,
    pendingWorkerMove,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    confirmWorkerMove,
    cancelWorkerMove,
  }
}

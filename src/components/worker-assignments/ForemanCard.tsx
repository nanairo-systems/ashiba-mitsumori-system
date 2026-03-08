/**
 * [COMPONENT] 職長カード（長方形型）
 *
 * 職長を一般職人と完全に区別する長方形カード。
 * - 左ボーダー色 = 職種色（緑/黄/灰）
 * - 名前(最大4文字) + 「職長」ラベル
 * - クリックで職人に降格
 * - ホバーで×削除
 * - @dnd-kit でドラッグ可能
 */
"use client"

import { useState } from "react"
import { X, AlertTriangle } from "lucide-react"
import { useDraggable } from "@dnd-kit/core"
import { cn } from "@/lib/utils"
import type { WorkerCardDragData } from "./types"

/** 職種ごとの色定義 */
const FOREMAN_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  EMPLOYEE: { border: "#22c55e", bg: "#f0fdf4", text: "#166534" },
  INDEPENDENT: { border: "#eab308", bg: "#fefce8", text: "#854d0e" },
  SUBCONTRACTOR: { border: "#9ca3af", bg: "#f8fafc", text: "#475569" },
}

interface Props {
  assignmentId: string
  workerName: string
  workerType: string
  driverLicenseType: string
  accentColor: string
  teamId: string
  scheduleId: string
  dateKey: string
  isMultiDay: boolean
  isDuplicate?: boolean
  isDragging?: boolean
  onToggleRole: (assignmentId: string, newRole: "FOREMAN" | "WORKER") => Promise<void>
  onDelete: (assignmentId: string) => void
}

export function ForemanCard({
  assignmentId,
  workerName,
  workerType,
  driverLicenseType,
  accentColor,
  teamId,
  scheduleId,
  dateKey,
  isMultiDay,
  isDuplicate,
  isDragging: isGlobalDragging,
  onToggleRole,
  onDelete,
}: Props) {
  const [toggling, setToggling] = useState(false)
  const colors = FOREMAN_COLORS[workerType] ?? FOREMAN_COLORS.SUBCONTRACTOR
  const displayName = workerName.slice(0, 4)

  const dragData: WorkerCardDragData = {
    type: "worker-card",
    assignmentId,
    teamId,
    scheduleId,
    dateKey,
    workerName,
    workerType,
    driverLicenseType,
    assignedRole: "FOREMAN",
    accentColor,
    isMultiDay,
  }

  const { attributes, listeners, setNodeRef, isDragging: isSelfDragging } = useDraggable({
    id: `worker:${assignmentId}:${dateKey}`,
    data: dragData,
  })

  async function handleDemote() {
    if (toggling || isGlobalDragging) return
    setToggling(true)
    try {
      await onToggleRole(assignmentId, "WORKER")
    } finally {
      setToggling(false)
    }
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group relative flex flex-col justify-center rounded-lg px-2 py-1",
        "w-[80px] h-[44px]",
        isGlobalDragging ? "cursor-grab" : "cursor-pointer",
        toggling && "opacity-60 pointer-events-none",
        isSelfDragging && "opacity-30"
      )}
      style={{
        backgroundColor: colors.bg,
        borderLeft: `4px solid ${colors.border}`,
        borderTop: isMultiDay ? "2.5px solid #eab308" : `1px solid ${colors.border}40`,
        borderRight: isMultiDay ? "2.5px solid #eab308" : `1px solid ${colors.border}40`,
        borderBottom: isMultiDay ? "2.5px solid #eab308" : `1px solid ${colors.border}40`,
      }}
      onClick={handleDemote}
      title={`${workerName}（職長） - クリックで職人に降格`}
      {...listeners}
      {...attributes}
    >
      {/* 削除ボタン */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(assignmentId) }}
        className="absolute -top-1.5 -right-1.5 z-20 w-4.5 h-4.5 rounded-full bg-white border border-slate-200 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:border-red-400 transition-all shadow-sm"
        title="削除"
      >
        <X className="w-3 h-3 text-slate-400 group-hover:text-red-500" />
      </button>

      {/* 名前 */}
      <span
        className="text-[11px] font-bold leading-tight truncate"
        style={{ color: colors.text }}
      >
        {displayName}
      </span>

      {/* 職長ラベル */}
      <span className="text-[9px] font-semibold leading-tight text-amber-600">
        職長
      </span>

      {/* 重複配置警告 */}
      {isDuplicate && (
        <span
          className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-0.5 px-1 py-0.5 rounded bg-red-500 text-white text-[7px] font-bold leading-none shadow-sm whitespace-nowrap"
          title="この職人は同じ日に複数の現場に配置されています"
        >
          <AlertTriangle className="w-2.5 h-2.5" />
          重複
        </span>
      )}
    </div>
  )
}

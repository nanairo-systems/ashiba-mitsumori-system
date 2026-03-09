/**
 * [COMPONENT] 職人カード（ヘルメット型・簡素化版）
 *
 * ヘルメット形状。ドラッグ＆ドロップ対応。
 * - 自社社員: 緑ヘルメット（白文字）
 * - 一人親方: 黄ヘルメット（黒文字）
 * - 協力会社: 白ヘルメット（グレー枠・黒文字）
 * - バッジなし（種別・免許はダイアログのみ表示）
 * - 連結日程: 太いゴールド枠線
 * クリックで職長⇔職人切り替え。ホバーで×削除。
 * @dnd-kit でドラッグ可能（別チーム・別現場へ移動）。
 */
"use client"

import { useState } from "react"
import { X, AlertTriangle } from "lucide-react"
import { useDraggable } from "@dnd-kit/core"
import { cn } from "@/lib/utils"
import type { WorkerCardDragData } from "./types"

/** ヘルメット色定義（種別固定） */
const HELMET_COLORS: Record<string, {
  bg: string
  text: string
  brim: string
  border: string
}> = {
  EMPLOYEE: {
    bg: "#16a34a",
    text: "#ffffff",
    brim: "#16a34a",
    border: "none",
  },
  INDEPENDENT: {
    bg: "#ca8a04",
    text: "#1a1a1a",
    brim: "#ca8a04",
    border: "none",
  },
  SUBCONTRACTOR: {
    bg: "#ffffff",
    text: "#374151",
    brim: "#9ca3af",
    border: "1.5px solid #d1d5db",
  },
}

interface Props {
  assignmentId: string
  workerName: string
  workerType: string // EMPLOYEE | INDEPENDENT | SUBCONTRACTOR
  driverLicenseType: string // NONE | SMALL | MEDIUM | SEMI_LARGE | LARGE
  assignedRole: string // FOREMAN | WORKER
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

export function WorkerCard({
  assignmentId,
  workerName,
  workerType,
  driverLicenseType,
  assignedRole,
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
  const isForeman = assignedRole === "FOREMAN"
  const shortName = workerName.slice(0, 3)

  const colors = HELMET_COLORS[workerType] ?? HELMET_COLORS.SUBCONTRACTOR

  const dragData: WorkerCardDragData = {
    type: "worker-card",
    assignmentId,
    teamId,
    scheduleId,
    dateKey,
    workerName,
    workerType,
    driverLicenseType,
    assignedRole,
    accentColor,
    isMultiDay,
  }

  const { attributes, listeners, setNodeRef, isDragging: isSelfDragging } = useDraggable({
    id: `worker:${assignmentId}:${dateKey}`,
    data: dragData,
  })

  async function handleToggle() {
    if (toggling || isGlobalDragging) return
    setToggling(true)
    try {
      await onToggleRole(assignmentId, isForeman ? "WORKER" : "FOREMAN")
    } finally {
      setToggling(false)
    }
  }

  return (
    <div
      ref={setNodeRef}
      data-worker-card
      className={cn(
        "group relative inline-flex flex-col items-center",
        isGlobalDragging ? "cursor-grab" : "cursor-pointer",
        toggling && "opacity-60 pointer-events-none",
        isSelfDragging && "opacity-30"
      )}
      onClick={handleToggle}
      title={
        isGlobalDragging
          ? "ドラッグして別の現場へ移動"
          : `${workerName} - クリックで${isForeman ? "職人" : "職長"}に切替`
      }
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

      {/* ヘルメット本体 */}
      <div
        className="w-[48px] h-[28px] rounded-t-lg rounded-b-none flex items-center justify-center text-[10px] font-bold leading-none"
        style={{
          backgroundColor: colors.bg,
          color: colors.text,
          borderTop: isMultiDay ? "2.5px solid #eab308" : colors.border,
          borderLeft: isMultiDay ? "2.5px solid #eab308" : colors.border,
          borderRight: isMultiDay ? "2.5px solid #eab308" : colors.border,
          borderBottom: "none",
        }}
      >
        {shortName}
      </div>

      {/* つば（brim） */}
      <div
        className="w-[52px] h-[3px] rounded-sm"
        style={{
          backgroundColor: isMultiDay ? "#eab308" : colors.brim,
        }}
      />

      {/* 重複配置警告バッジ */}
      {isDuplicate && (
        <span
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 z-20 flex items-center gap-0.5 px-1 py-0.5 rounded bg-red-500 text-white text-[7px] font-bold leading-none shadow-sm whitespace-nowrap"
          title="この職人は同じ日に複数の現場に配置されています"
        >
          <AlertTriangle className="w-2.5 h-2.5" />
          重複
        </span>
      )}
    </div>
  )
}

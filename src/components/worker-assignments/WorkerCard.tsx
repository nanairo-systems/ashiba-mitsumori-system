/**
 * [COMPONENT] 職人カード
 *
 * コンパクト横長カード。ヘルメットアイコンで役割を視覚表示。
 * - 職長: ヘルメット上に2本線（━━）
 * - 職人: ヘルメット上に1本線（─）
 * クリックで職長⇔職人切り替え。右上×で削除。
 * @dnd-kit でドラッグ可能（別チーム・別現場へ移動）。
 */
"use client"

import { useState } from "react"
import { X, HardHat } from "lucide-react"
import { useDraggable } from "@dnd-kit/core"
import { cn } from "@/lib/utils"
import type { WorkerCardDragData } from "./types"

interface Props {
  assignmentId: string
  workerName: string
  workerType: string // EMPLOYEE | INDEPENDENT
  assignedRole: string // FOREMAN | WORKER
  accentColor: string
  teamId: string
  scheduleId: string
  isDragging?: boolean
  onToggleRole: (assignmentId: string, newRole: "FOREMAN" | "WORKER") => Promise<void>
  onDelete: (assignmentId: string) => void
}

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  EMPLOYEE: { label: "社員", className: "bg-blue-100 text-blue-700" },
  INDEPENDENT: { label: "一人親方", className: "bg-orange-100 text-orange-700" },
}

export function WorkerCard({
  assignmentId,
  workerName,
  workerType,
  assignedRole,
  accentColor,
  teamId,
  scheduleId,
  isDragging: isGlobalDragging,
  onToggleRole,
  onDelete,
}: Props) {
  const [toggling, setToggling] = useState(false)
  const isForeman = assignedRole === "FOREMAN"
  const badge = TYPE_BADGE[workerType] ?? { label: "外注", className: "bg-slate-100 text-slate-600" }

  const dragData: WorkerCardDragData = {
    type: "worker-card",
    assignmentId,
    teamId,
    scheduleId,
    workerName,
    workerType,
    assignedRole,
    accentColor,
  }

  const { attributes, listeners, setNodeRef, isDragging: isSelfDragging } = useDraggable({
    id: `worker:${assignmentId}`,
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
      className={cn(
        "group relative flex items-center gap-1.5 rounded-md px-2 py-1 border transition-all text-[10px]",
        isGlobalDragging ? "cursor-default" : "cursor-pointer",
        toggling && "opacity-60 pointer-events-none",
        isSelfDragging && "opacity-30"
      )}
      style={{
        borderColor: `${accentColor}40`,
        backgroundColor: `${accentColor}10`,
      }}
      onClick={handleToggle}
      title={isGlobalDragging ? undefined : `クリックで${isForeman ? "職人" : "職長"}に切替`}
      {...listeners}
      {...attributes}
    >
      {/* 削除ボタン */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(assignmentId) }}
        className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-white border border-slate-200 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:border-red-300 transition-all"
        title="削除"
      >
        <X className="w-2 h-2 text-slate-400 hover:text-red-500" />
      </button>

      {/* ヘルメットアイコン with 線 */}
      <div className="relative flex-shrink-0 w-5 h-5 flex items-center justify-center">
        {/* 役割線（ヘルメット上部） */}
        <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-px">
          <div
            className="h-[1.5px] rounded-full"
            style={{
              width: isForeman ? 10 : 6,
              backgroundColor: isForeman ? accentColor : `${accentColor}80`,
            }}
          />
          {isForeman && (
            <div
              className="h-[1.5px] w-[10px] rounded-full"
              style={{ backgroundColor: accentColor }}
            />
          )}
        </div>
        <HardHat
          className="w-3.5 h-3.5"
          style={{ color: isForeman ? accentColor : `${accentColor}90` }}
        />
      </div>

      {/* 名前 */}
      <span className="font-medium text-slate-800 truncate max-w-[60px]">
        {workerName}
      </span>

      {/* 種別バッジ */}
      <span className={cn("px-1 py-px rounded text-[8px] font-medium flex-shrink-0", badge.className)}>
        {badge.label}
      </span>
    </div>
  )
}

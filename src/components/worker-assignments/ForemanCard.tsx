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
import { AlertTriangle } from "lucide-react"
import { useDraggable } from "@dnd-kit/core"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { ConfirmDeletePopover } from "./ConfirmDeletePopover"
import type { WorkerCardDragData } from "./types"

/** 職種ごとの色定義（職長は太い輪郭で目立たせる） */
const FOREMAN_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  EMPLOYEE: { border: "#16a34a", bg: "#f0fdf4", text: "#14532d" },
  INDEPENDENT: { border: "#ca8a04", bg: "#fefce8", text: "#713f12" },
  SUBCONTRACTOR: { border: "#64748b", bg: "#f8fafc", text: "#1e293b" },
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
  const isMobile = useIsMobile()
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
      data-worker-card
      className={cn(
        "group relative flex items-center gap-1.5 rounded-md px-2 py-1.5",
        isMobile ? "w-full h-[44px]" : "w-full h-[32px]",
        isGlobalDragging ? "cursor-grab" : "cursor-pointer",
        toggling && "opacity-60 pointer-events-none",
        isSelfDragging && "opacity-30"
      )}
      style={{
        backgroundColor: colors.bg,
        border: isMultiDay
          ? `2.5px solid #eab308`
          : `2.5px solid ${colors.border}`,
        boxShadow: `inset 0 0 0 1px ${colors.border}40, 0 1px 3px ${colors.border}30`,
      }}
      onClick={handleDemote}
      title={`${workerName}（職長） - クリックで職人に降格`}
      {...listeners}
      {...attributes}
    >
      {/* 削除確認ポップオーバー（スマホでは常時表示） */}
      <div className={cn(
        "absolute -top-1.5 -right-1.5 z-20 transition-all",
        isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      )}>
        <ConfirmDeletePopover
          message={`「${workerName}」を削除しますか？`}
          onConfirm={() => onDelete(assignmentId)}
          triggerClassName={cn(
            "rounded-full bg-white border border-slate-200 flex items-center justify-center hover:bg-red-50 hover:border-red-400 transition-all shadow-sm",
            isMobile ? "w-7 h-7" : "w-4.5 h-4.5"
          )}
          iconClassName={cn(
            "text-slate-400 hover:text-red-500",
            isMobile ? "w-4 h-4" : "w-3 h-3"
          )}
        />
      </div>

      {/* 名前（太字で目立たせる） */}
      <span
        className="text-sm font-extrabold leading-none truncate"
        style={{ color: colors.text }}
      >
        {displayName}
      </span>

      {/* 重複配置警告 */}
      {isDuplicate && (
        <span
          className="ml-auto flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-500 text-white text-[9px] font-medium leading-none shadow-sm whitespace-nowrap flex-shrink-0"
          title="この職人は同じ日に複数の現場に配置されています"
        >
          <AlertTriangle className="w-2.5 h-2.5" />
          重複
        </span>
      )}
    </div>
  )
}

/**
 * [COMPONENT] 職人カード（四角型）
 *
 * 角張った四角カード。ドラッグ＆ドロップ対応。
 * - 自社社員: 緑（白文字）
 * - 一人親方: 黄（黒文字）
 * - 協力会社: 白（グレー枠・黒文字）
 * - 連結日程: 太いゴールド枠線
 * クリックで職長⇔職人切り替え。ホバーで×削除。
 * @dnd-kit でドラッグ可能（別チーム・別現場へ移動）。
 */
"use client"

import { useState } from "react"
import { AlertTriangle } from "lucide-react"
import { useDraggable } from "@dnd-kit/core"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { ConfirmDeletePopover } from "./ConfirmDeletePopover"
import type { WorkerCardDragData } from "./types"

/** カード色定義（種別固定） */
const CARD_COLORS: Record<string, {
  bg: string
  text: string
  border: string
}> = {
  EMPLOYEE: {
    bg: "#16a34a",
    text: "#ffffff",
    border: "#15803d",
  },
  INDEPENDENT: {
    bg: "#ca8a04",
    text: "#1a1a1a",
    border: "#a16207",
  },
  SUBCONTRACTOR: {
    bg: "#ffffff",
    text: "#374151",
    border: "#d1d5db",
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
  /** 重なりレイアウト時に境界線を表示する（INDEPENDENT以外） */
  showOutline?: boolean
  /** カードサイズ: "sm"=小, "md"=標準, "lg"=大 */
  size?: "sm" | "md" | "lg"
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
  showOutline,
  size,
  onToggleRole,
  onDelete,
}: Props) {
  const [toggling, setToggling] = useState(false)
  const isMobile = useIsMobile()
  const isForeman = assignedRole === "FOREMAN"
  const shortName = workerName.slice(0, 3)

  const colors = CARD_COLORS[workerType] ?? CARD_COLORS.SUBCONTRACTOR

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
        "group relative inline-flex items-center justify-center rounded-sm border-2 font-extrabold leading-none shadow-sm transition-all whitespace-nowrap overflow-hidden",
        isMobile ? "min-w-[72px] h-[38px] text-sm px-2"
          : size === "lg" ? "w-full h-[34px] text-sm px-2"
          : size === "sm" ? "w-full h-[26px] text-[10px] px-0.5"
          : "w-full h-[30px] text-xs px-1",
        isGlobalDragging ? "cursor-grab" : "cursor-pointer hover:shadow-md active:scale-95",
        toggling && "opacity-60 pointer-events-none",
        isSelfDragging && "opacity-30"
      )}
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        borderColor: isMultiDay ? "#eab308" : colors.border,
      }}
      onClick={handleToggle}
      title={
        isGlobalDragging
          ? "ドラッグして別の現場へ移動"
          : `${workerName} - クリックで${isForeman ? "職人" : "職長"}に切替`
      }
      {...listeners}
      {...attributes}
    >
      {/* 削除確認ポップオーバー（スマホでは常時表示、PCではホバー時のみ） */}
      <div className={cn(
        "absolute -top-1.5 -right-1.5 z-20 transition-all",
        isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      )}>
        <ConfirmDeletePopover
          message={`「${workerName}」を削除しますか？`}
          onConfirm={() => onDelete(assignmentId)}
          triggerClassName={cn(
            "rounded-sm bg-white border-2 border-slate-300 flex items-center justify-center hover:bg-red-50 hover:border-red-400 transition-all shadow-sm",
            isMobile ? "w-7 h-7" : "w-4.5 h-4.5"
          )}
          iconClassName={cn(
            "text-slate-400 hover:text-red-500",
            isMobile ? "w-4 h-4" : "w-3 h-3"
          )}
        />
      </div>

      {shortName}

      {/* 重複配置警告バッジ */}
      {isDuplicate && (
        <span
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 z-20 flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm bg-red-500 text-white text-[9px] font-bold leading-none shadow-sm whitespace-nowrap"
          title="この職人は同じ日に複数の現場に配置されています"
        >
          <AlertTriangle className="w-2.5 h-2.5" />
          重複
        </span>
      )}
    </div>
  )
}

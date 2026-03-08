/**
 * [COMPONENT] 職人カード（ヘルメット型）
 *
 * ヘルメット形状。ドラッグ＆ドロップ対応。
 * - 職長: 2本線、職人: 1本線（名前の下、つばの上）
 * - 自社社員: 緑ヘルメット（白文字）
 * - 一人親方: 黄ヘルメット（黒文字）
 * - 協力会社: 白ヘルメット（グレー枠・黒文字）
 * - 免許バッジ: 右上に表示（2t/4t/6t/MAX）
 * クリックで職長⇔職人切り替え。ホバーで×削除。
 * @dnd-kit でドラッグ可能（別チーム・別現場へ移動）。
 */
"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { useDraggable } from "@dnd-kit/core"
import { cn } from "@/lib/utils"
import type { WorkerCardDragData } from "./types"

/** ヘルメット色定義（種別固定） */
const HELMET_COLORS: Record<string, {
  bg: string
  fgBg: string
  text: string
  line: string
  brim: string
  border: string
}> = {
  EMPLOYEE: {
    bg: "#22c55e",
    fgBg: "#16a34a",
    text: "#ffffff",
    line: "rgba(255,255,255,0.7)",
    brim: "#16a34a",
    border: "none",
  },
  INDEPENDENT: {
    bg: "#eab308",
    fgBg: "#ca8a04",
    text: "#1a1a1a",
    line: "rgba(0,0,0,0.25)",
    brim: "#ca8a04",
    border: "none",
  },
  SUBCONTRACTOR: {
    bg: "#ffffff",
    fgBg: "#ffffff",
    text: "#374151",
    line: "rgba(0,0,0,0.15)",
    brim: "#9ca3af",
    border: "1.5px solid #d1d5db",
  },
}

/** 免許バッジラベル */
const LICENSE_LABELS: Record<string, string> = {
  NONE: "",
  SMALL: "2t",
  MEDIUM: "4t",
  SEMI_LARGE: "6t",
  LARGE: "MAX",
}

/** 種別バッジ */
const TYPE_BADGE: Record<string, { label: string; bg: string; text: string; border: string }> = {
  EMPLOYEE: { label: "社", bg: "#dcfce7", text: "#166534", border: "#86efac" },
  INDEPENDENT: { label: "親", bg: "#fef9c3", text: "#854d0e", border: "#fde047" },
  SUBCONTRACTOR: { label: "協", bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" },
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
  isDragging: isGlobalDragging,
  onToggleRole,
  onDelete,
}: Props) {
  const [toggling, setToggling] = useState(false)
  const isForeman = assignedRole === "FOREMAN"
  const shortName = workerName.slice(0, 2)

  const colors = HELMET_COLORS[workerType] ?? HELMET_COLORS.SUBCONTRACTOR
  const helmetBg = isForeman ? colors.bg : colors.fgBg
  const badge = TYPE_BADGE[workerType] ?? TYPE_BADGE.SUBCONTRACTOR
  const licenseLabel = LICENSE_LABELS[driverLicenseType] ?? ""

  const dragData: WorkerCardDragData = {
    type: "worker-card",
    assignmentId,
    teamId,
    scheduleId,
    dateKey,
    workerName,
    workerType,
    assignedRole,
    accentColor,
    isMultiDay,
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
        "group relative inline-flex flex-col items-center",
        isGlobalDragging ? "cursor-grab" : "cursor-pointer",
        toggling && "opacity-60 pointer-events-none",
        isSelfDragging && "opacity-30"
      )}
      onClick={handleToggle}
      title={
        isGlobalDragging
          ? "ドラッグして別の現場へ移動"
          : `${workerName}（${badge.label}${isForeman ? "・職長" : ""}） - クリックで${isForeman ? "職人" : "職長"}に切替`
      }
      {...listeners}
      {...attributes}
    >
      {/* 削除ボタン */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(assignmentId) }}
        className="absolute -top-1.5 -right-1.5 z-10 w-3.5 h-3.5 rounded-full bg-white border border-slate-200 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:border-red-300 transition-all"
        title="削除"
      >
        <X className="w-2 h-2 text-slate-400 hover:text-red-500" />
      </button>

      {/* 種別マーク（左上） */}
      <span
        className="absolute -top-1 -left-1 z-10 w-3.5 h-3.5 rounded-full text-[6px] font-bold flex items-center justify-center border"
        style={{
          backgroundColor: badge.bg,
          color: badge.text,
          borderColor: badge.border,
        }}
      >
        {badge.label}
      </span>

      {/* 免許バッジ（右上） */}
      {licenseLabel && (
        <span
          className="absolute -top-1.5 -right-1.5 z-[9] px-1 py-px rounded text-[5px] font-bold leading-none border group-hover:opacity-0 transition-opacity"
          style={{
            backgroundColor: "#1e40af",
            color: "#ffffff",
            borderColor: "#1e3a8a",
          }}
        >
          {licenseLabel}
        </span>
      )}

      {/* ヘルメット本体 */}
      <div
        className="w-9 h-[22px] rounded-t-lg rounded-b-none flex items-center justify-center text-[10px] font-bold leading-none"
        style={{
          backgroundColor: helmetBg,
          color: colors.text,
          border: colors.border,
          borderBottom: "none",
        }}
      >
        {shortName}
      </div>

      {/* 役割線（職長: 2本線、職人: 1本線）— 名前の下、つばの上 */}
      <div
        className="w-9 flex flex-col items-center gap-[0.5px] py-[1px]"
        style={{
          backgroundColor: helmetBg,
          borderLeft: colors.border,
          borderRight: colors.border,
        }}
      >
        <div
          className="h-[1.5px] rounded-full"
          style={{ width: isForeman ? 18 : 10, backgroundColor: colors.line }}
        />
        {isForeman && (
          <div
            className="h-[1.5px] w-[18px] rounded-full"
            style={{ backgroundColor: colors.line }}
          />
        )}
      </div>

      {/* つば（brim） */}
      <div
        className="w-10 h-[2.5px] rounded-sm"
        style={{ backgroundColor: colors.brim }}
      />
    </div>
  )
}

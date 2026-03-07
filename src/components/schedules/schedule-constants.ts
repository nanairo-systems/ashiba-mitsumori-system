/**
 * [CONSTANTS] 工期スケジュール共通定数
 */
import type { ScheduleWorkType, WorkTypeConfig } from "./schedule-types"

export const DISPLAY_DAYS_PRESETS = [30, 45, 60, 90] as const

export const WORK_TYPES: ScheduleWorkType[] = ["ASSEMBLY", "DISASSEMBLY", "REWORK"]

export const WT_CONFIG: Record<ScheduleWorkType, WorkTypeConfig> = {
  ASSEMBLY: {
    label: "組立", short: "組",
    planned: "bg-blue-200/80", actual: "bg-blue-500",
    text: "text-blue-700", bg: "bg-blue-50",
    border: "border-blue-300", cursor: "cursor-crosshair",
  },
  DISASSEMBLY: {
    label: "解体", short: "解",
    planned: "bg-amber-200/80", actual: "bg-amber-500",
    text: "text-amber-700", bg: "bg-amber-50",
    border: "border-amber-300", cursor: "cursor-crosshair",
  },
  REWORK: {
    label: "その他", short: "他",
    planned: "bg-slate-300/80", actual: "bg-slate-500",
    text: "text-slate-700", bg: "bg-slate-100",
    border: "border-slate-400", cursor: "cursor-crosshair",
  },
}

export const STORAGE_KEY_DISPLAY_DAYS = "gantt-display-days"

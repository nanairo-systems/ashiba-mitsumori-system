/**
 * [CONSTANTS] 工期スケジュール共通定数
 */
import type { WorkTypeMaster, WorkTypeConfig } from "./schedule-types"

export const DISPLAY_DAYS_PRESETS = [30, 45, 60, 90] as const

export const STORAGE_KEY_DISPLAY_DAYS = "gantt-display-days"

/**
 * カラーパレット（10色）
 * colorIndex → Tailwind クラスセット
 * ※ Tailwind CSS purge のため、全クラスを静的に列挙する
 */
export const COLOR_PALETTE: WorkTypeConfig[] = [
  // 0: blue
  {
    label: "", short: "",
    planned: "bg-blue-200/80", actual: "bg-blue-500",
    text: "text-blue-700", bg: "bg-blue-50",
    border: "border-blue-300", cursor: "cursor-crosshair",
  },
  // 1: amber
  {
    label: "", short: "",
    planned: "bg-amber-200/80", actual: "bg-amber-500",
    text: "text-amber-700", bg: "bg-amber-50",
    border: "border-amber-300", cursor: "cursor-crosshair",
  },
  // 2: slate
  {
    label: "", short: "",
    planned: "bg-slate-300/80", actual: "bg-slate-500",
    text: "text-slate-700", bg: "bg-slate-100",
    border: "border-slate-400", cursor: "cursor-crosshair",
  },
  // 3: green
  {
    label: "", short: "",
    planned: "bg-green-200/80", actual: "bg-green-500",
    text: "text-green-700", bg: "bg-green-50",
    border: "border-green-300", cursor: "cursor-crosshair",
  },
  // 4: purple
  {
    label: "", short: "",
    planned: "bg-purple-200/80", actual: "bg-purple-500",
    text: "text-purple-700", bg: "bg-purple-50",
    border: "border-purple-300", cursor: "cursor-crosshair",
  },
  // 5: red
  {
    label: "", short: "",
    planned: "bg-red-200/80", actual: "bg-red-500",
    text: "text-red-700", bg: "bg-red-50",
    border: "border-red-300", cursor: "cursor-crosshair",
  },
  // 6: cyan
  {
    label: "", short: "",
    planned: "bg-cyan-200/80", actual: "bg-cyan-500",
    text: "text-cyan-700", bg: "bg-cyan-50",
    border: "border-cyan-300", cursor: "cursor-crosshair",
  },
  // 7: pink
  {
    label: "", short: "",
    planned: "bg-pink-200/80", actual: "bg-pink-500",
    text: "text-pink-700", bg: "bg-pink-50",
    border: "border-pink-300", cursor: "cursor-crosshair",
  },
  // 8: orange
  {
    label: "", short: "",
    planned: "bg-orange-200/80", actual: "bg-orange-500",
    text: "text-orange-700", bg: "bg-orange-50",
    border: "border-orange-300", cursor: "cursor-crosshair",
  },
  // 9: teal
  {
    label: "", short: "",
    planned: "bg-teal-200/80", actual: "bg-teal-500",
    text: "text-teal-700", bg: "bg-teal-50",
    border: "border-teal-300", cursor: "cursor-crosshair",
  },
]

/** 不明な工種コードのフォールバック */
export const FALLBACK_WT_CONFIG: WorkTypeConfig = {
  label: "不明", short: "?",
  planned: "bg-gray-200/80", actual: "bg-gray-500",
  text: "text-gray-700", bg: "bg-gray-100",
  border: "border-gray-300", cursor: "cursor-crosshair",
}

/**
 * WorkTypeMaster → WorkTypeConfig を生成
 */
export function getWorkTypeConfig(wt: WorkTypeMaster): WorkTypeConfig {
  const palette = COLOR_PALETTE[wt.colorIndex % COLOR_PALETTE.length] ?? COLOR_PALETTE[0]
  return {
    ...palette,
    label: wt.label,
    short: wt.shortLabel,
  }
}

/**
 * WorkTypeMaster[] → code→WorkTypeConfig のマップを構築
 */
export function buildWtConfigMap(
  workTypes: WorkTypeMaster[]
): Map<string, WorkTypeConfig> {
  const map = new Map<string, WorkTypeConfig>()
  for (const wt of workTypes) {
    map.set(wt.code, getWorkTypeConfig(wt))
  }
  return map
}

/**
 * code から WorkTypeConfig を取得（フォールバック付き）
 */
export function getWtConfig(
  code: string,
  configMap: Map<string, WorkTypeConfig>
): WorkTypeConfig {
  return configMap.get(code) ?? FALLBACK_WT_CONFIG
}

/**
 * [CONSTANTS] 工期スケジュール共通定数
 */
import type { WorkTypeMaster, WorkTypeConfig } from "./schedule-types"

export const DISPLAY_DAYS_PRESETS = [10, 20, 30, 45, 60, 90] as const

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
    planned: "bg-blue-300", actual: "bg-blue-600",
    text: "text-blue-800", bg: "bg-blue-50",
    border: "border-blue-400", cursor: "cursor-crosshair",
  },
  // 1: amber
  {
    label: "", short: "",
    planned: "bg-amber-300", actual: "bg-amber-600",
    text: "text-amber-800", bg: "bg-amber-50",
    border: "border-amber-400", cursor: "cursor-crosshair",
  },
  // 2: slate
  {
    label: "", short: "",
    planned: "bg-slate-400", actual: "bg-slate-600",
    text: "text-slate-800", bg: "bg-slate-100",
    border: "border-slate-500", cursor: "cursor-crosshair",
  },
  // 3: green
  {
    label: "", short: "",
    planned: "bg-green-300", actual: "bg-green-600",
    text: "text-green-800", bg: "bg-green-50",
    border: "border-green-400", cursor: "cursor-crosshair",
  },
  // 4: purple
  {
    label: "", short: "",
    planned: "bg-purple-300", actual: "bg-purple-600",
    text: "text-purple-800", bg: "bg-purple-50",
    border: "border-purple-400", cursor: "cursor-crosshair",
  },
  // 5: red
  {
    label: "", short: "",
    planned: "bg-red-300", actual: "bg-red-600",
    text: "text-red-800", bg: "bg-red-50",
    border: "border-red-400", cursor: "cursor-crosshair",
  },
  // 6: cyan
  {
    label: "", short: "",
    planned: "bg-cyan-300", actual: "bg-cyan-600",
    text: "text-cyan-800", bg: "bg-cyan-50",
    border: "border-cyan-400", cursor: "cursor-crosshair",
  },
  // 7: pink
  {
    label: "", short: "",
    planned: "bg-pink-300", actual: "bg-pink-600",
    text: "text-pink-800", bg: "bg-pink-50",
    border: "border-pink-400", cursor: "cursor-crosshair",
  },
  // 8: orange
  {
    label: "", short: "",
    planned: "bg-orange-300", actual: "bg-orange-600",
    text: "text-orange-800", bg: "bg-orange-50",
    border: "border-orange-400", cursor: "cursor-crosshair",
  },
  // 9: teal
  {
    label: "", short: "",
    planned: "bg-teal-300", actual: "bg-teal-600",
    text: "text-teal-800", bg: "bg-teal-50",
    border: "border-teal-400", cursor: "cursor-crosshair",
  },
]

/** 不明な工種コードのフォールバック */
export const FALLBACK_WT_CONFIG: WorkTypeConfig = {
  label: "不明", short: "?",
  planned: "bg-gray-300", actual: "bg-gray-600",
  text: "text-gray-800", bg: "bg-gray-100",
  border: "border-gray-400", cursor: "cursor-crosshair",
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

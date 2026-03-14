/**
 * [COMPONENT] ドラッグオーバーレイバー（共通）
 *
 * 未配置バー・配置済み現場カードのドラッグ時に表示される
 * カーソル追従バー。日数に応じた幅で棒状に表示される。
 *
 * variant:
 *   "compact" — 従来の薄いバー（site-card ドラッグ用）
 *   "card"    — テーブルの現場カードと同じ大きさ（未配置バードラッグ用）
 *
 * grabDateKey を渡すと、掴んだ日付と工程開始日の差分から
 * オーバーレイを左にオフセットし、グリッドの日付位置と整合させる。
 */
"use client"

import { workTypeColor, workTypeLabel } from "./types"

const FALLBACK_COL_WIDTH = 80

export interface DragOverlayBarProps {
  /** 表示ラベル（現場名 or スケジュール名） */
  label: string
  /** 工種コード（ASSEMBLY / DISASSEMBLY 等） */
  workType: string
  /** 会社名 */
  companyName?: string
  /** 日付範囲テキスト（例: "3/7〜3/9"） */
  formattedDateRange: string
  /** バーのグラデーション色 */
  color: string
  /** 工程開始日 (YYYY-MM-DD or ISO) */
  plannedStartDate: string | null
  /** 工程終了日 (YYYY-MM-DD or ISO) */
  plannedEndDate: string | null
  /** 表示範囲の開始日 */
  rangeStart: Date
  /** 表示日数 */
  displayDays: number
  /** 掴んだ日付キー (YYYY-MM-DD)。指定するとオフセット補正する */
  grabDateKey?: string
  /** 実際のテーブル日付列幅（px）。指定するとグリッドと幅が一致する */
  dayColWidth?: number
  /** 表示バリアント */
  variant?: "compact" | "card"
}

/** ローカルタイムゾーンで YYYY-MM-DD を返す */
function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** 日数に応じたバー幅を計算（dayColWidth 使用） */
function calcBarWidth(
  plannedStartDate: string | null,
  plannedEndDate: string | null,
  rangeStart: Date,
  displayDays: number,
  colWidth: number,
): number {
  if (!plannedStartDate) return colWidth

  const startStr = plannedStartDate.slice(0, 10)
  const endStr = (plannedEndDate ?? plannedStartDate).slice(0, 10)

  const schedStart = new Date(startStr + "T00:00:00")
  const schedEnd = new Date(endStr + "T00:00:00")
  const rangeEnd = new Date(rangeStart)
  rangeEnd.setDate(rangeEnd.getDate() + displayDays - 1)

  // 表示範囲にクランプ
  const clampedStart = schedStart < rangeStart ? rangeStart : schedStart
  const clampedEnd = schedEnd > rangeEnd ? rangeEnd : schedEnd

  if (clampedStart > clampedEnd) return colWidth

  // 日数 × 列幅
  const dayCount = Math.round((clampedEnd.getTime() - clampedStart.getTime()) / 86400000) + 1
  const totalWidth = dayCount * colWidth

  // パディング分を引く
  return Math.max(totalWidth - 6, colWidth)
}

/**
 * 掴んだ日付と工程開始日の差分ピクセルを計算。
 */
function calcGrabOffset(
  plannedStartDate: string | null,
  grabDateKey: string | undefined,
  rangeStart: Date,
  colWidth: number,
): number {
  if (!grabDateKey || !plannedStartDate) return 0

  const startStr = plannedStartDate.slice(0, 10)
  if (grabDateKey <= startStr) return 0

  const rangeStartStr = toDateKey(rangeStart)
  const effectiveStart = startStr < rangeStartStr ? rangeStartStr : startStr

  if (grabDateKey <= effectiveStart) return 0

  // effectiveStart から grabDateKey までの日数 × 列幅
  const start = new Date(effectiveStart + "T00:00:00")
  const grab = new Date(grabDateKey + "T00:00:00")
  const dayCount = Math.round((grab.getTime() - start.getTime()) / 86400000)

  return dayCount * colWidth
}

export function DragOverlayBar({
  label,
  workType,
  companyName,
  formattedDateRange,
  color,
  plannedStartDate,
  plannedEndDate,
  rangeStart,
  displayDays,
  grabDateKey,
  dayColWidth,
  variant = "compact",
}: DragOverlayBarProps) {
  const colWidth = dayColWidth ?? FALLBACK_COL_WIDTH

  const barWidth = calcBarWidth(
    plannedStartDate,
    plannedEndDate,
    rangeStart,
    displayDays,
    colWidth,
  )

  const offsetX = calcGrabOffset(
    plannedStartDate,
    grabDateKey,
    rangeStart,
    colWidth,
  )

  // カードバリアント: テーブルの現場カードと同じ見た目（56px高、工種バッジ＋現場名＋会社名）
  if (variant === "card") {
    const wtColor = workTypeColor(workType)
    const wtLabel = workTypeLabel(workType)
    return (
      <div
        className="rounded-sm shadow-xl pointer-events-none overflow-hidden border-2"
        style={{
          width: barWidth,
          height: 56,
          background: `linear-gradient(${color}20, ${color}20), white`,
          borderColor: `${color}80`,
          borderLeftWidth: 5,
          borderLeftColor: color,
          transform: offsetX > 0 ? `translateX(-${offsetX}px)` : undefined,
        }}
      >
        <div className="flex items-center h-full gap-1.5 pr-2 overflow-hidden">
          {/* 工種バッジ */}
          <div
            className={`flex-shrink-0 flex items-center justify-center rounded-sm px-1.5 self-stretch font-extrabold text-[13px] min-w-[32px] ${wtColor.bg} ${wtColor.text}`}
          >
            {wtLabel}
          </div>
          {/* 現場名 + 会社名 */}
          <div className="min-w-0 flex-1 flex flex-col justify-center leading-tight">
            <div className="text-sm font-extrabold text-slate-800 truncate">
              {label}
            </div>
            {companyName && (
              <div className="text-xs text-slate-600 truncate">
                {companyName}
              </div>
            )}
            <div className="text-[10px] text-slate-400 truncate">
              {formattedDateRange}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // コンパクトバリアント（従来の薄いバー）
  const compactWtLabel = workTypeLabel(workType)
  return (
    <div
      className="rounded-sm flex items-center px-2 text-xs shadow-lg pointer-events-none overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
        width: barWidth,
        height: 20,
        transform: offsetX > 0 ? `translateX(-${offsetX}px)` : undefined,
      }}
    >
      <span className="font-semibold text-white truncate leading-none drop-shadow-sm">
        {label}
      </span>
      {barWidth > 140 && (
        <span className="text-xs text-white/60 truncate ml-1.5 flex-shrink-0 leading-none">
          {compactWtLabel}
        </span>
      )}
      {barWidth > 200 && (
        <span className="text-xs text-white/60 truncate ml-1.5 flex-shrink-0 leading-none">
          {formattedDateRange}
        </span>
      )}
    </div>
  )
}

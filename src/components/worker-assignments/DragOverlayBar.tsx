/**
 * [COMPONENT] ドラッグオーバーレイバー（共通）
 *
 * 未配置バー・配置済み現場カードのドラッグ時に表示される
 * カーソル追従バー。日数に応じた幅で棒状に表示される。
 * 両方のドラッグタイプで同じ見た目を提供するモジュール。
 *
 * grabDateKey を渡すと、掴んだ日付と工程開始日の差分から
 * オーバーレイを左にオフセットし、グリッドの日付位置と整合させる。
 */
"use client"

const COLLAPSED_WIDTH = 80
const EXPANDED_WIDTH = 200

export interface DragOverlayBarProps {
  /** 表示ラベル（現場名 or スケジュール名） */
  label: string
  /** 工種（ASSEMBLY / DISASSEMBLY 等） */
  workType: string
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
  /** 展開中の日付キー Set */
  expandedDateKeys?: Set<string>
  /** 掴んだ日付キー (YYYY-MM-DD)。指定するとオフセット補正する */
  grabDateKey?: string
}

/** ローカルタイムゾーンで YYYY-MM-DD を返す（toISOStringはUTC変換で日本時間だとずれるため） */
function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** 列幅を取得 */
function getColWidth(dateKey: string, expandedDateKeys?: Set<string>): number {
  return expandedDateKeys?.has(dateKey) ? EXPANDED_WIDTH : COLLAPSED_WIDTH
}

/** 日数に応じたバー幅を計算 */
function calcBarWidth(
  plannedStartDate: string | null,
  plannedEndDate: string | null,
  rangeStart: Date,
  displayDays: number,
  expandedDateKeys?: Set<string>,
): number {
  if (!plannedStartDate) return COLLAPSED_WIDTH

  const startStr = plannedStartDate.slice(0, 10)
  const endStr = (plannedEndDate ?? plannedStartDate).slice(0, 10)

  const schedStart = new Date(startStr + "T00:00:00")
  const schedEnd = new Date(endStr + "T00:00:00")
  const rangeEnd = new Date(rangeStart)
  rangeEnd.setDate(rangeEnd.getDate() + displayDays - 1)

  // 表示範囲にクランプ
  const clampedStart = schedStart < rangeStart ? rangeStart : schedStart
  const clampedEnd = schedEnd > rangeEnd ? rangeEnd : schedEnd

  if (clampedStart > clampedEnd) return COLLAPSED_WIDTH

  // 各日の列幅を合計
  let totalWidth = 0
  const cur = new Date(clampedStart)
  while (cur <= clampedEnd) {
    const dateKey = toDateKey(cur)
    totalWidth += getColWidth(dateKey, expandedDateKeys)
    cur.setDate(cur.getDate() + 1)
  }

  // パディング分を引く
  return Math.max(totalWidth - 6, COLLAPSED_WIDTH)
}

/**
 * 掴んだ日付と工程開始日の差分ピクセルを計算。
 * 掴んだ日付が工程開始日より後なら、バーを左にずらす。
 */
function calcGrabOffset(
  plannedStartDate: string | null,
  grabDateKey: string | undefined,
  rangeStart: Date,
  expandedDateKeys?: Set<string>,
): number {
  if (!grabDateKey || !plannedStartDate) return 0

  const startStr = plannedStartDate.slice(0, 10)
  if (grabDateKey <= startStr) return 0

  // rangeStart にクランプ
  const rangeStartStr = toDateKey(rangeStart)
  const effectiveStart = startStr < rangeStartStr ? rangeStartStr : startStr

  if (grabDateKey <= effectiveStart) return 0

  // effectiveStart から grabDateKey までの列幅を合計
  let offset = 0
  const cur = new Date(effectiveStart + "T00:00:00")
  const grabDate = new Date(grabDateKey + "T00:00:00")
  while (cur < grabDate) {
    const dk = toDateKey(cur)
    offset += getColWidth(dk, expandedDateKeys)
    cur.setDate(cur.getDate() + 1)
  }

  return offset
}

export function DragOverlayBar({
  label,
  workType,
  formattedDateRange,
  color,
  plannedStartDate,
  plannedEndDate,
  rangeStart,
  displayDays,
  expandedDateKeys,
  grabDateKey,
}: DragOverlayBarProps) {
  const barWidth = calcBarWidth(
    plannedStartDate,
    plannedEndDate,
    rangeStart,
    displayDays,
    expandedDateKeys,
  )

  const offsetX = calcGrabOffset(
    plannedStartDate,
    grabDateKey,
    rangeStart,
    expandedDateKeys,
  )

  return (
    <div
      className="rounded-[5px] flex items-center px-2 text-[10px] shadow-lg pointer-events-none overflow-hidden"
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
        <span className="text-[9px] text-white/60 truncate ml-1.5 flex-shrink-0 leading-none">
          {workType}
        </span>
      )}
      {barWidth > 200 && (
        <span className="text-[9px] text-white/60 truncate ml-1.5 flex-shrink-0 leading-none">
          {formattedDateRange}
        </span>
      )}
    </div>
  )
}

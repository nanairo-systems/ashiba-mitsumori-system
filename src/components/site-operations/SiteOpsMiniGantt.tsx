/**
 * [現操-06] ミニガントチャート
 *
 * 現場ダイアログ内で作業内容に紐づく工程をガントチャート形式で表示。
 * バーのドラッグ移動・エッジリサイズ・Ctrl/Shiftによる工種切替での新規作成に対応。
 *
 * 既存の ScheduleGantt と同じ操作性を維持しつつ、
 * ダイアログ内に収まるコンパクトな表示を実現する。
 */
"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { addDays, differenceInDays, format, parseISO, eachDayOfInterval, isWeekend, isToday } from "date-fns"
import { ja } from "date-fns/locale"
import { Plus, Loader2, ChevronLeft, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { ScheduleData } from "@/components/worker-assignments/types"

// ── 工種カラー定義 ──
const WORK_TYPE_COLORS: Record<string, { planned: string; actual: string; label: string; border: string }> = {
  ASSEMBLY:    { planned: "bg-blue-300/80",   actual: "bg-blue-500",   label: "組立", border: "border-blue-400" },
  DISASSEMBLY: { planned: "bg-orange-300/80", actual: "bg-orange-500", label: "解体", border: "border-orange-400" },
  REWORK:      { planned: "bg-slate-300/80",  actual: "bg-slate-500",  label: "その他", border: "border-slate-400" },
}

const FALLBACK_COLOR = { planned: "bg-gray-300/80", actual: "bg-gray-500", label: "不明", border: "border-gray-400" }

function getColor(workType: string) {
  return WORK_TYPE_COLORS[workType] ?? FALLBACK_COLOR
}

// ── ユーティリティ ──
function toDateStr(d: Date): string {
  return format(d, "yyyy-MM-dd")
}

function getBarPosition(
  startStr: string | null, endStr: string | null,
  rangeStart: Date, totalDays: number
): { left: number; width: number } | null {
  if (!startStr || !endStr) return null
  const s = parseISO(startStr)
  const e = parseISO(endStr)
  const startIdx = differenceInDays(s, rangeStart)
  const endIdx = differenceInDays(e, rangeStart)
  if (endIdx < 0 || startIdx >= totalDays) return null
  const clampedStart = Math.max(0, startIdx)
  const clampedEnd = Math.min(totalDays - 1, endIdx)
  const cellW = 100 / totalDays
  return { left: clampedStart * cellW, width: (clampedEnd - clampedStart + 1) * cellW }
}

// ── 型定義 ──
interface Props {
  schedules: ScheduleData[]
  projectId: string
  groupName?: string | null
  onUpdated?: () => void
}

type DragAction =
  | { type: "move"; scheduleId: string; span: number; grabOffset: number; startDay: number }
  | { type: "resize"; scheduleId: string; edge: "left" | "right"; startDay: number; endDay: number }
  | { type: "create"; workType: string; startDay: number; endDay: number }

// ── コンポーネント ──
export function SiteOpsMiniGantt({ schedules, projectId, groupName, onUpdated }: Props) {
  const DISPLAY_DAYS = 14
  const ROW_HEIGHT = 28
  const HEADER_HEIGHT = 32

  // 表示開始日（デフォルト: 最も早い予定日の3日前 or 今日）
  const [rangeStart, setRangeStart] = useState<Date>(() => {
    const earliest = schedules.reduce<Date | null>((min, s) => {
      if (!s.plannedStartDate) return min
      const d = parseISO(s.plannedStartDate)
      return !min || d < min ? d : min
    }, null)
    return addDays(earliest ?? new Date(), -2)
  })

  const days = useMemo(() =>
    eachDayOfInterval({ start: rangeStart, end: addDays(rangeStart, DISPLAY_DAYS - 1) }),
    [rangeStart]
  )

  const areaRef = useRef<HTMLDivElement>(null)

  // ドラッグ状態
  const [dragAction, setDragAction] = useState<DragAction | null>(null)
  const [saving, setSaving] = useState(false)

  // Ctrl/Shift でドローモード切替
  const [heldKey, setHeldKey] = useState<"shift" | "ctrl" | null>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Shift") setHeldKey("shift")
      else if (e.key === "Control" || e.key === "Meta") setHeldKey("ctrl")
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === "Shift" || e.key === "Control" || e.key === "Meta") setHeldKey(null)
    }
    function onBlur() { setHeldKey(null) }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("blur", onBlur)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("blur", onBlur)
    }
  }, [])

  // マウス位置 → 日インデックス
  const getDayIdx = useCallback((clientX: number) => {
    if (!areaRef.current) return 0
    const rect = areaRef.current.getBoundingClientRect()
    const pct = (clientX - rect.left) / rect.width
    return Math.max(0, Math.min(DISPLAY_DAYS - 1, Math.floor(pct * DISPLAY_DAYS)))
  }, [])

  // ナビゲーション
  function scrollLeft() { setRangeStart(prev => addDays(prev, -7)) }
  function scrollRight() { setRangeStart(prev => addDays(prev, 7)) }
  function goToday() {
    const earliest = schedules.reduce<Date | null>((min, s) => {
      if (!s.plannedStartDate) return min
      const d = parseISO(s.plannedStartDate)
      return !min || d < min ? d : min
    }, null)
    setRangeStart(addDays(earliest ?? new Date(), -2))
  }

  // ── ドラッグ: バー移動 ──
  const startMove = useCallback((e: React.MouseEvent, s: ScheduleData) => {
    if (!s.plannedStartDate || !s.plannedEndDate) return
    e.preventDefault()
    const barStart = differenceInDays(parseISO(s.plannedStartDate), rangeStart)
    const barEnd = differenceInDays(parseISO(s.plannedEndDate), rangeStart)
    const span = barEnd - barStart + 1
    const clickDay = getDayIdx(e.clientX)
    const grabOffset = Math.max(0, Math.min(clickDay - barStart, span - 1))
    setDragAction({ type: "move", scheduleId: s.id, span, grabOffset, startDay: barStart })
  }, [rangeStart, getDayIdx])

  // ── ドラッグ: エッジリサイズ ──
  const startResize = useCallback((e: React.MouseEvent, s: ScheduleData, edge: "left" | "right") => {
    if (!s.plannedStartDate || !s.plannedEndDate) return
    e.preventDefault()
    e.stopPropagation()
    const startDay = differenceInDays(parseISO(s.plannedStartDate), rangeStart)
    const endDay = differenceInDays(parseISO(s.plannedEndDate), rangeStart)
    setDragAction({ type: "resize", scheduleId: s.id, edge, startDay, endDay })
  }, [rangeStart])

  // ── ドラッグ: 新規作成 ──
  const startCreate = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const dayIdx = getDayIdx(e.clientX)
    // Ctrl=組立, Shift=解体, デフォルト=組立
    const workType = heldKey === "shift" ? "DISASSEMBLY" : "ASSEMBLY"
    setDragAction({ type: "create", workType, startDay: dayIdx, endDay: dayIdx })
  }, [getDayIdx, heldKey])

  // ── マウスムーブ（ドキュメントレベル） ──
  useEffect(() => {
    if (!dragAction) return

    function onMouseMove(e: MouseEvent) {
      const dayIdx = getDayIdx(e.clientX)
      setDragAction(prev => {
        if (!prev) return null
        if (prev.type === "move") {
          const newStart = dayIdx - prev.grabOffset
          return { ...prev, startDay: newStart }
        }
        if (prev.type === "resize") {
          if (prev.edge === "left") {
            return { ...prev, startDay: Math.min(dayIdx, prev.endDay) }
          } else {
            return { ...prev, endDay: Math.max(dayIdx, prev.startDay) }
          }
        }
        if (prev.type === "create") {
          return { ...prev, endDay: dayIdx }
        }
        return prev
      })
    }

    async function onMouseUp() {
      if (!dragAction) return
      const action = dragAction
      setDragAction(null)

      if (action.type === "move") {
        const s = schedules.find(x => x.id === action.scheduleId)
        if (!s?.plannedStartDate || !s?.plannedEndDate) return
        const newStart = toDateStr(addDays(rangeStart, action.startDay))
        const newEnd = toDateStr(addDays(rangeStart, action.startDay + action.span - 1))
        if (newStart === s.plannedStartDate.slice(0, 10) && newEnd === s.plannedEndDate.slice(0, 10)) return
        setSaving(true)
        try {
          const res = await fetch(`/api/schedules/${action.scheduleId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plannedStartDate: newStart, plannedEndDate: newEnd }),
          })
          if (!res.ok) throw new Error()
          toast.success("日程を移動しました")
          onUpdated?.()
        } catch { toast.error("更新に失敗しました") }
        finally { setSaving(false) }
      }

      if (action.type === "resize") {
        const s = schedules.find(x => x.id === action.scheduleId)
        if (!s) return
        const newStart = toDateStr(addDays(rangeStart, action.startDay))
        const newEnd = toDateStr(addDays(rangeStart, action.endDay))
        setSaving(true)
        try {
          const res = await fetch(`/api/schedules/${action.scheduleId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plannedStartDate: newStart, plannedEndDate: newEnd }),
          })
          if (!res.ok) throw new Error()
          toast.success("日程を変更しました")
          onUpdated?.()
        } catch { toast.error("更新に失敗しました") }
        finally { setSaving(false) }
      }

      if (action.type === "create") {
        const s = Math.min(action.startDay, action.endDay)
        const e = Math.max(action.startDay, action.endDay)
        const newStart = toDateStr(addDays(rangeStart, s))
        const newEnd = toDateStr(addDays(rangeStart, e))
        setSaving(true)
        try {
          const res = await fetch("/api/schedules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId,
              workType: action.workType,
              name: groupName || null,
              plannedStartDate: newStart,
              plannedEndDate: newEnd,
            }),
          })
          if (!res.ok) throw new Error()
          toast.success("工程を追加しました")
          onUpdated?.()
        } catch { toast.error("追加に失敗しました") }
        finally { setSaving(false) }
      }
    }

    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
    return () => {
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
    }
  }, [dragAction, schedules, rangeStart, projectId, groupName, getDayIdx, onUpdated])

  // ソート
  const sorted = [...schedules].sort((a, b) => {
    const aDate = a.plannedStartDate ?? ""
    const bDate = b.plannedStartDate ?? ""
    return aDate.localeCompare(bDate)
  })

  const chartHeight = Math.max(ROW_HEIGHT * 2, sorted.length * ROW_HEIGHT + ROW_HEIGHT)

  return (
    <div className="space-y-2">
      {/* ツールバー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button onClick={scrollLeft} className="w-6 h-6 rounded flex items-center justify-center hover:bg-slate-200 text-slate-500 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={goToday} className="text-xs text-slate-600 hover:text-blue-600 px-2 py-0.5 rounded hover:bg-blue-50 transition-colors font-medium">
            初期位置
          </button>
          <button onClick={scrollRight} className="w-6 h-6 rounded flex items-center justify-center hover:bg-slate-200 text-slate-500 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          {saving && <Loader2 className="w-3 h-3 animate-spin" />}
          <span>
            <kbd className="px-1 py-0.5 bg-slate-100 rounded text-slate-500 font-mono">ドラッグ</kbd> 新規追加
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-slate-100 rounded text-slate-500 font-mono">Shift</kbd> 解体
          </span>
        </div>
      </div>

      {/* ガントチャート本体 */}
      <div className="border border-slate-200 rounded-lg overflow-hidden select-none">
        {/* 日付ヘッダー */}
        <div className="flex border-b border-slate-200 bg-slate-50" style={{ height: HEADER_HEIGHT }}>
          {days.map((d, i) => {
            const isWe = isWeekend(d)
            const isTd = isToday(d)
            return (
              <div
                key={i}
                className={cn(
                  "flex-1 text-center text-xs border-r border-slate-100 flex flex-col justify-center leading-tight",
                  isWe && "bg-red-50/50",
                  isTd && "bg-blue-50 font-bold"
                )}
              >
                <span className={cn("text-slate-400", isTd && "text-blue-600")}>
                  {format(d, "M/d")}
                </span>
                <span className={cn(
                  "text-slate-300",
                  isWe && "text-red-400",
                  isTd && "text-blue-500"
                )}>
                  {format(d, "E", { locale: ja })}
                </span>
              </div>
            )
          })}
        </div>

        {/* バーエリア */}
        <div
          ref={areaRef}
          className={cn(
            "relative",
            dragAction?.type === "create" ? "cursor-crosshair" : "cursor-default"
          )}
          style={{ height: chartHeight }}
          onMouseDown={(e) => {
            // バー上でなければ新規作成ドラッグ開始
            if ((e.target as HTMLElement).closest("[data-bar]")) return
            startCreate(e)
          }}
        >
          {/* 背景グリッド + 今日線 */}
          {days.map((d, i) => {
            const isWe = isWeekend(d)
            const isTd = isToday(d)
            const cellW = 100 / DISPLAY_DAYS
            return (
              <div
                key={i}
                className={cn(
                  "absolute top-0 bottom-0 border-r border-slate-100",
                  isWe && "bg-red-50/30"
                )}
                style={{ left: `${i * cellW}%`, width: `${cellW}%` }}
              >
                {isTd && (
                  <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-blue-400/60 -translate-x-1/2" />
                )}
              </div>
            )
          })}

          {/* 既存バー */}
          {sorted.map((s, idx) => {
            const y = idx * ROW_HEIGHT + 2
            const color = getColor(s.workType)

            // 移動/リサイズ中のバーはゴーストで表示
            if (dragAction && (dragAction.type === "move" || dragAction.type === "resize") &&
                ((dragAction.type === "move" && dragAction.scheduleId === s.id) ||
                 (dragAction.type === "resize" && dragAction.scheduleId === s.id))) {
              // ゴーストバー
              let ghostLeft: number, ghostWidth: number
              if (dragAction.type === "move") {
                const cellW = 100 / DISPLAY_DAYS
                ghostLeft = dragAction.startDay * cellW
                ghostWidth = dragAction.span * cellW
              } else {
                const cellW = 100 / DISPLAY_DAYS
                ghostLeft = dragAction.startDay * cellW
                ghostWidth = (dragAction.endDay - dragAction.startDay + 1) * cellW
              }
              const ghostBorder = dragAction.type === "move" ? "border-blue-500" : "border-amber-500"
              const ghostStart = toDateStr(addDays(rangeStart, dragAction.type === "move" ? dragAction.startDay : dragAction.startDay))
              const ghostEnd = toDateStr(addDays(rangeStart, dragAction.type === "move" ? dragAction.startDay + dragAction.span - 1 : dragAction.endDay))

              return (
                <div
                  key={s.id}
                  data-bar
                  className={cn("absolute rounded border-2 flex items-center px-1.5 text-xs font-medium opacity-80", ghostBorder, color.planned)}
                  style={{
                    left: `${ghostLeft}%`,
                    width: `${Math.max(ghostWidth, 100 / DISPLAY_DAYS)}%`,
                    top: y,
                    height: ROW_HEIGHT - 4,
                  }}
                >
                  <span className="truncate text-slate-700">
                    {color.label} {format(parseISO(ghostStart), "M/d")}〜{format(parseISO(ghostEnd), "M/d")}
                  </span>
                </div>
              )
            }

            // 通常バー
            const pos = getBarPosition(s.plannedStartDate, s.plannedEndDate, rangeStart, DISPLAY_DAYS)
            if (!pos) return null

            return (
              <div
                key={s.id}
                data-bar
                className={cn(
                  "absolute rounded flex items-center group/bar transition-shadow hover:shadow-md",
                  color.planned
                )}
                style={{
                  left: `${pos.left}%`,
                  width: `${pos.width}%`,
                  top: y,
                  height: ROW_HEIGHT - 4,
                  cursor: "grab",
                }}
                onMouseDown={(e) => startMove(e, s)}
              >
                {/* 左リサイズハンドル */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 hover:bg-blue-400/40 rounded-l transition-opacity z-10"
                  onMouseDown={(e) => startResize(e, s, "left")}
                />

                {/* バーラベル */}
                <div className="flex items-center gap-1 px-1.5 overflow-hidden flex-1 min-w-0">
                  <span className="text-xs font-bold text-slate-700 truncate">
                    {color.label}
                  </span>
                  {pos.width > 100 / DISPLAY_DAYS * 2 && (
                    <span className="text-xs text-slate-500 truncate">
                      {s.plannedStartDate && format(parseISO(s.plannedStartDate), "M/d")}〜
                      {s.plannedEndDate && format(parseISO(s.plannedEndDate), "M/d")}
                    </span>
                  )}
                </div>

                {/* 右リサイズハンドル */}
                <div
                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 hover:bg-blue-400/40 rounded-r transition-opacity z-10"
                  onMouseDown={(e) => startResize(e, s, "right")}
                />

                {/* 実績バー（下に重ねて表示） */}
                {s.actualStartDate && s.actualEndDate && (() => {
                  const actualPos = getBarPosition(s.actualStartDate, s.actualEndDate, rangeStart, DISPLAY_DAYS)
                  if (!actualPos) return null
                  const relLeft = actualPos.left - pos.left
                  return (
                    <div
                      className={cn("absolute rounded-sm", color.actual)}
                      style={{
                        left: `${(relLeft / pos.width) * 100}%`,
                        width: `${(actualPos.width / pos.width) * 100}%`,
                        bottom: 1,
                        height: 3,
                      }}
                    />
                  )
                })()}
              </div>
            )
          })}

          {/* ドラッグ作成プレビュー */}
          {dragAction?.type === "create" && (() => {
            const s = Math.min(dragAction.startDay, dragAction.endDay)
            const e = Math.max(dragAction.startDay, dragAction.endDay)
            const cellW = 100 / DISPLAY_DAYS
            const color = getColor(dragAction.workType)
            return (
              <div
                className={cn("absolute rounded border-2 border-dashed opacity-60", color.planned, color.border)}
                style={{
                  left: `${s * cellW}%`,
                  width: `${(e - s + 1) * cellW}%`,
                  top: sorted.length * ROW_HEIGHT + 2,
                  height: ROW_HEIGHT - 4,
                }}
              >
                <div className="flex items-center px-1.5 h-full">
                  <span className="text-xs font-bold text-slate-600 truncate">
                    {color.label} {format(addDays(rangeStart, s), "M/d")}〜{format(addDays(rangeStart, e), "M/d")}
                  </span>
                </div>
              </div>
            )
          })()}

          {/* 空の場合のプレースホルダー */}
          {sorted.length === 0 && !dragAction && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
              ドラッグして工程を追加（Shift: 解体）
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

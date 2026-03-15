/**
 * [現操-04] 全工程 日程・種別一覧セクション
 *
 * 左側: カレンダー（工程期間をバー表示）
 * 右側: 工程カード（2列、追加・編集・削除対応）
 */
"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Loader2, Plus, Trash2, Check, X, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  format, addDays as addDaysFn, parseISO, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, addMonths, subMonths, isWithinInterval, isToday, isSameDay,
} from "date-fns"
import { ja } from "date-fns/locale"
import type { ScheduleData } from "@/components/schedules/schedule-types"

interface WorkTypeMaster {
  id: string; code: string; label: string; shortLabel: string
  colorIndex: number; sortOrder: number; isActive: boolean
}

const WORK_TYPE_STYLES: Record<string, { label: string; bg: string; text: string; border: string; dotColor: string; barClass: string }> = {
  ASSEMBLY:    { label: "組立", bg: "bg-blue-100",   text: "text-blue-700",  border: "border-blue-300",  dotColor: "bg-blue-500", barClass: "bg-blue-400/70" },
  DISASSEMBLY: { label: "解体", bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-300", dotColor: "bg-orange-500", barClass: "bg-orange-400/70" },
  REWORK:      { label: "その他", bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-300", dotColor: "bg-slate-500", barClass: "bg-slate-400/70" },
}

/** 工種ごとのカレンダーハイライト色 */
const CAL_HIGHLIGHT: Record<string, { bg: string; hover: string }> = {
  ASSEMBLY:    { bg: "bg-blue-500",   hover: "hover:bg-blue-100" },
  DISASSEMBLY: { bg: "bg-orange-500", hover: "hover:bg-orange-100" },
  REWORK:      { bg: "bg-slate-500",  hover: "hover:bg-slate-200" },
}
const CAL_HIGHLIGHT_DEFAULT = { bg: "bg-blue-500", hover: "hover:bg-slate-100" }

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"]

function toInputDate(dateStr: string | null): string {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function calcDays(start: string | null, end: string | null): number | null {
  if (!start || !end) return null
  const s = new Date(start); const e = new Date(end)
  s.setHours(0, 0, 0, 0); e.setHours(0, 0, 0, 0)
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1
  return diff > 0 ? diff : null
}

/** 日数プリセット */
const DAY_PRESETS = [1, 2, 3, 4, 5, 6, 7] as const

function endDateFromDays(startDate: string, days: number): string {
  if (!startDate) return ""
  return format(addDaysFn(parseISO(startDate), days - 1), "yyyy-MM-dd")
}

interface Props {
  activeScheduleId: string
  siblings: ScheduleData[]
  projectId: string
  contractId?: string
  groupName?: string | null
  workContentId?: string
  onUpdated?: () => void
}

interface EditState {
  scheduleId: string; startDate: string; endDate: string; workType: string
}

/** バーセグメント: 各週の行でのバー描画情報 */
interface BarSegment {
  weekRow: number      // 何行目（0始まり）
  startCol: number     // 開始列（0-6）
  endCol: number       // 終了列（0-6）
  isStart: boolean     // バーの開始端か
  isEnd: boolean       // バーの終了端か
  schedule: ScheduleData
}

/** カレンダー入力モード */
type CalInputMode = "idle" | "picking-start" | "picking-end"

// ── カレンダーコンポーネント（クリック入力対応） ──
function ScheduleCalendar({ currentMonth, schedules, getWorkTypeInfo, onMonthChange, onDateClick, inputMode, inputStartDate, inputEndDate, inputWorkType, isSelectMode, onBarClick }: {
  currentMonth: Date
  schedules: ScheduleData[]
  getWorkTypeInfo: (code: string) => typeof WORK_TYPE_STYLES.ASSEMBLY
  onMonthChange: (d: Date) => void
  /** 日付クリック時のコールバック */
  onDateClick?: (dateStr: string) => void
  /** 入力モード */
  inputMode?: CalInputMode
  /** 入力中の開始日 */
  inputStartDate?: string
  /** 入力中の終了日 */
  inputEndDate?: string
  /** 入力中の工種コード（ハイライト色を切替） */
  inputWorkType?: string
  /** 選択モード（0番）かどうか */
  isSelectMode?: boolean
  /** 選択モード時にバーをクリックしたときのコールバック */
  onBarClick?: (scheduleId: string) => void
}) {
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startDow = getDay(monthStart) // 0=Sun

  const isInputActive = inputMode === "picking-start" || inputMode === "picking-end"
  const hl = inputWorkType ? (CAL_HIGHLIGHT[inputWorkType] ?? CAL_HIGHLIGHT_DEFAULT) : CAL_HIGHLIGHT_DEFAULT

  // 入力中の日付パース
  const inputStartD = inputStartDate ? parseISO(inputStartDate) : null
  const inputEndD = inputEndDate ? parseISO(inputEndDate) : null

  // 全セル（空セル含む）を週ごとにまとめる
  const weeks = useMemo(() => {
    const cells: (Date | null)[] = []
    for (let i = 0; i < startDow; i++) cells.push(null)
    daysInMonth.forEach((d) => cells.push(d))
    while (cells.length % 7 !== 0) cells.push(null)
    const result: (Date | null)[][] = []
    for (let i = 0; i < cells.length; i += 7) {
      result.push(cells.slice(i, i + 7))
    }
    return result
  }, [daysInMonth, startDow])

  // バーセグメント計算
  const barSegments = useMemo(() => {
    const segments: BarSegment[] = []
    schedules.forEach((s) => {
      if (!s.plannedStartDate || !s.plannedEndDate) return
      const sStart = parseISO(s.plannedStartDate)
      const sEnd = parseISO(s.plannedEndDate)
      sStart.setHours(0, 0, 0, 0); sEnd.setHours(0, 0, 0, 0)

      weeks.forEach((week, weekIdx) => {
        let firstCol = -1
        let lastCol = -1
        week.forEach((day, col) => {
          if (!day) return
          if (isWithinInterval(day, { start: sStart, end: sEnd })) {
            if (firstCol === -1) firstCol = col
            lastCol = col
          }
        })
        if (firstCol === -1) return
        segments.push({
          weekRow: weekIdx,
          startCol: firstCol,
          endCol: lastCol,
          isStart: week[firstCol] != null && isSameDay(week[firstCol]!, sStart),
          isEnd: week[lastCol] != null && isSameDay(week[lastCol]!, sEnd),
          schedule: s,
        })
      })
    })
    return segments
  }, [schedules, weeks])

  // 各週のバー数
  const barsByWeek = useMemo(() => {
    const map = new Map<number, BarSegment[]>()
    barSegments.forEach((seg) => {
      const list = map.get(seg.weekRow) || []
      list.push(seg)
      map.set(seg.weekRow, list)
    })
    return map
  }, [barSegments])

  return (
    <div className="w-full">
      {/* 月ナビ */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => onMonthChange(subMonths(currentMonth, 1))} className="p-1 rounded-sm hover:bg-slate-100 text-slate-400 hover:text-slate-600">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-extrabold text-slate-700">
          {format(currentMonth, "yyyy年M月", { locale: ja })}
        </span>
        <button onClick={() => onMonthChange(addMonths(currentMonth, 1))} className="p-1 rounded-sm hover:bg-slate-100 text-slate-400 hover:text-slate-600">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 gap-0 border-b border-slate-200 mb-0.5">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} className={cn(
            "text-center text-xs font-extrabold py-1",
            i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-slate-500"
          )}>
            {label}
          </div>
        ))}
      </div>

      {/* 日付グリッド（週ごと） */}
      {weeks.map((week, weekIdx) => {
        const weekBars = barsByWeek.get(weekIdx) || []
        return (
          <div key={weekIdx} className="relative">
            {/* 日付行 */}
            <div className="grid grid-cols-7 gap-0">
              {week.map((day, col) => {
                if (!day) return <div key={col} className="h-[34px]" />
                const dow = getDay(day)
                const isTd = isToday(day)
                const dateStr = format(day, "yyyy-MM-dd")

                // 入力中のハイライト
                const isInputStart = inputStartD && isSameDay(day, inputStartD)
                const isInputEnd = inputEndD && isSameDay(day, inputEndD)
                const isInputRange = inputStartD && inputEndD && isWithinInterval(day, { start: inputStartD, end: inputEndD }) && !isInputStart && !isInputEnd

                return (
                  <button
                    key={col}
                    type="button"
                    onClick={() => onDateClick?.(dateStr)}
                    className={cn(
                      "h-[34px] flex items-start justify-center pt-1 text-xs relative transition-all",
                      isInputActive && `cursor-pointer ${hl.hover} active:scale-90`,
                      isSelectMode && "cursor-pointer hover:bg-slate-50",
                      !isInputActive && !isSelectMode && "cursor-default",
                      // 入力中ハイライト（工種色）
                      isInputStart && `${hl.bg} text-white`,
                      isInputEnd && `${hl.bg} text-white`,
                      isInputRange && `${hl.bg} text-white`,
                      // 通常の色（入力ハイライトがない場合）
                      !isInputStart && !isInputEnd && !isInputRange && isTd && "font-bold text-blue-700",
                      !isInputStart && !isInputEnd && !isInputRange && !isTd && dow === 0 && "text-red-400",
                      !isInputStart && !isInputEnd && !isInputRange && !isTd && dow === 6 && "text-blue-400",
                      !isInputStart && !isInputEnd && !isInputRange && !isTd && dow !== 0 && dow !== 6 && "text-slate-600",
                    )}
                  >
                    {isTd && !isInputStart && !isInputEnd ? (
                      <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[11px] font-bold">{day.getDate()}</span>
                    ) : (
                      <span className={cn("text-[12px]", (isInputStart || isInputEnd) && "font-extrabold")}>{day.getDate()}</span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* バーオーバーレイ */}
            {weekBars.map((seg, segIdx) => {
              const info = getWorkTypeInfo(seg.schedule.workType)
              const left = `${(seg.startCol / 7) * 100}%`
              const width = `${((seg.endCol - seg.startCol + 1) / 7) * 100}%`
              const topOffset = 22 + segIdx * 10
              const clickable = isSelectMode && onBarClick
              return (
                <div
                  key={`${seg.schedule.id}-${segIdx}`}
                  className={cn(
                    "absolute h-[7px] z-10",
                    info.barClass,
                    seg.isStart && "rounded-l-sm",
                    seg.isEnd && "rounded-r-sm",
                    clickable
                      ? "pointer-events-auto cursor-pointer hover:ring-2 hover:ring-blue-400 hover:ring-offset-1 transition-all h-[10px]"
                      : "pointer-events-none",
                  )}
                  style={{ left, width, top: topOffset }}
                  title={`${info.label}: ${seg.schedule.plannedStartDate ? format(parseISO(seg.schedule.plannedStartDate), "M/d") : "?"} 〜 ${seg.schedule.plannedEndDate ? format(parseISO(seg.schedule.plannedEndDate), "M/d") : "?"}`}
                  onClick={clickable ? (e) => { e.stopPropagation(); onBarClick(seg.schedule.id) } : undefined}
                />
              )
            })}

            {/* バー分の余白 */}
            {weekBars.length > 0 && (
              <div style={{ height: Math.max(0, (weekBars.length - 1) * 10 + 4) }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── メインコンポーネント ──
export function SiteOpsDateSection({ activeScheduleId, siblings, projectId, contractId, groupName, workContentId, onUpdated }: Props) {
  const [workTypes, setWorkTypes] = useState<WorkTypeMaster[]>([])
  useEffect(() => {
    fetch("/api/schedule-work-types").then((r) => r.ok ? r.json() : []).then(setWorkTypes).catch(() => {})
  }, [])

  const [editing, setEditing] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newWorkType, setNewWorkType] = useState("")
  const [newStartDate, setNewStartDate] = useState("")
  const [newEndDate, setNewEndDate] = useState("")
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // 全体表示かどうか（groupNameがundefinedの場合は全体表示）
  const isAllView = groupName === undefined

  // カレンダー直接入力モード
  const [calInputMode, setCalInputMode] = useState<CalInputMode>("idle")
  const [calInputWorkType, setCalInputWorkType] = useState("")
  const [calInputStartDate, setCalInputStartDate] = useState("")
  const [calInputEndDate, setCalInputEndDate] = useState("")
  const [calInputSaving, setCalInputSaving] = useState(false)

  const [calMonth, setCalMonth] = useState<Date>(() => {
    const firstDate = siblings.find((s) => s.plannedStartDate)?.plannedStartDate
    if (firstDate) return startOfMonth(parseISO(firstDate))
    return startOfMonth(new Date())
  })

  const getWorkTypeInfo = useCallback((code: string) => {
    const fromMaster = workTypes.find((wt) => wt.code === code)
    if (fromMaster) {
      const fallback = WORK_TYPE_STYLES[code] ?? WORK_TYPE_STYLES.REWORK
      return { ...fallback, label: fromMaster.label }
    }
    return WORK_TYPE_STYLES[code] ?? WORK_TYPE_STYLES.REWORK
  }, [workTypes])

  const workTypeOptions = workTypes.length > 0
    ? workTypes.filter((wt) => wt.isActive).map((wt) => ({ code: wt.code, label: wt.label }))
    : Object.entries(WORK_TYPE_STYLES).map(([code, { label }]) => ({ code, label }))

  function startEdit(s: ScheduleData) {
    setEditing({ scheduleId: s.id, startDate: toInputDate(s.plannedStartDate), endDate: toInputDate(s.plannedEndDate), workType: s.workType })
  }
  function cancelEdit() { setEditing(null) }

  async function saveEdit() {
    if (!editing) return
    const original = siblings.find((s) => s.id === editing.scheduleId)
    if (!original) return
    const hasChanges =
      editing.startDate !== toInputDate(original.plannedStartDate) ||
      editing.endDate !== toInputDate(original.plannedEndDate) ||
      editing.workType !== original.workType
    if (!hasChanges) { setEditing(null); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/schedules/${editing.scheduleId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plannedStartDate: editing.startDate || null, plannedEndDate: editing.endDate || null, workType: editing.workType }),
      })
      if (!res.ok) throw new Error()
      toast.success("工事日程を更新しました"); setEditing(null); onUpdated?.()
    } catch { toast.error("更新に失敗しました") } finally { setSaving(false) }
  }

  async function handleAdd() {
    if (!newWorkType || !newStartDate || !newEndDate) { toast.error("作業種別と日程を入力してください"); return }
    setAdding(true)
    try {
      const bodyData = { projectId, workType: newWorkType, workContentId: workContentId || undefined, contractId: contractId || undefined, name: groupName || null, plannedStartDate: newStartDate, plannedEndDate: newEndDate }
      const res = await fetch("/api/schedules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyData) })
      if (!res.ok) { const data = await res.json().catch(() => null); throw new Error(data?.error ?? "追加に失敗しました") }
      toast.success("工事日程を追加しました"); setShowAddForm(false); setNewWorkType(""); setNewStartDate(""); setNewEndDate(""); onUpdated?.()
    } catch (err) { toast.error(err instanceof Error ? err.message : "追加に失敗しました") } finally { setAdding(false) }
  }

  // カレンダー日付クリック
  function handleCalDateClick(dateStr: string) {
    // 選択モード（0番）の場合：クリックした日付に該当する工程があれば編集モードに遷移
    if (!calInputWorkType) {
      const clickedDate = parseISO(dateStr)
      const matchingSchedule = siblings.find((s) => {
        if (!s.plannedStartDate || !s.plannedEndDate) return false
        const sStart = parseISO(s.plannedStartDate)
        const sEnd = parseISO(s.plannedEndDate)
        sStart.setHours(0, 0, 0, 0); sEnd.setHours(0, 0, 0, 0)
        return isWithinInterval(clickedDate, { start: sStart, end: sEnd })
      })
      if (matchingSchedule) {
        startEdit(matchingSchedule)
      }
      return
    }

    // 未選択 → 1タップで開始日=終了日セット（1日工程としてすぐ登録可能）
    if (calInputMode === "idle" || !calInputStartDate) {
      setCalInputMode("picking-end")
      setCalInputStartDate(dateStr)
      setCalInputEndDate(dateStr)
      return
    }

    // 同じ終了日をもう一度タップ → 全解除（白紙に戻す）
    if (dateStr === calInputEndDate) {
      setCalInputMode("idle")
      setCalInputStartDate("")
      setCalInputEndDate("")
      return
    }

    // 終了日より先 → 伸ばす
    if (dateStr > calInputEndDate) {
      setCalInputEndDate(dateStr)
      return
    }

    // 開始日より前 → 開始日を前にずらす
    if (dateStr < calInputStartDate) {
      setCalInputStartDate(dateStr)
      return
    }

    // 開始日〜終了日の間 → 終了日を縮める
    setCalInputEndDate(dateStr)
  }

  // カレンダーから工事日程を追加
  async function handleCalInputSubmit() {
    if (!calInputStartDate || !calInputEndDate || !calInputWorkType) {
      toast.error("工種と日程を設定してください")
      return
    }
    setCalInputSaving(true)
    try {
      const bodyData = { projectId, workType: calInputWorkType, workContentId: workContentId || undefined, contractId: contractId || undefined, name: groupName || null, plannedStartDate: calInputStartDate, plannedEndDate: calInputEndDate }
      const res = await fetch("/api/schedules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyData) })
      if (!res.ok) { const data = await res.json().catch(() => null); throw new Error(data?.error ?? "追加に失敗しました") }
      toast.success("工事日程を追加しました")
      setCalInputMode("idle")
      setCalInputStartDate("")
      setCalInputEndDate("")
      onUpdated?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "追加に失敗しました")
    } finally {
      setCalInputSaving(false)
    }
  }

  // カレンダー入力キャンセル
  function handleCalInputCancel() {
    setCalInputMode("idle")
    setCalInputStartDate("")
    setCalInputEndDate("")
  }

  async function handleDelete(scheduleId: string) {
    const target = siblings.find((s) => s.id === scheduleId)
    const label = target?.name ?? getWorkTypeInfo(target?.workType ?? "").label
    if (!window.confirm(`「${label}」を削除しますか？\nこの操作は取り消せません。`)) return
    setDeletingId(scheduleId)
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success(`「${label}」を削除しました`); onUpdated?.()
    } catch { toast.error("削除に失敗しました") } finally { setDeletingId(null) }
  }

  const sorted = [...siblings].sort((a, b) => {
    const aIdx = workTypeOptions.findIndex((o) => o.code === a.workType)
    const bIdx = workTypeOptions.findIndex((o) => o.code === b.workType)
    if (aIdx !== bIdx) return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx)
    return (a.plannedStartDate ?? "").localeCompare(b.plannedStartDate ?? "")
  })

  // 数字キーで工種切替（長押し動作：押している間だけ有効、離すと0番に戻る）
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const num = parseInt(e.key, 10)
      if (num === 0) {
        setCalInputWorkType("")
        handleCalInputCancel()
      } else if (num >= 1 && num <= workTypeOptions.length) {
        setCalInputWorkType(workTypeOptions[num - 1].code)
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const num = parseInt(e.key, 10)
      if (num >= 1 && num <= workTypeOptions.length) {
        setCalInputWorkType("")
      }
    }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
    }
  }, [workTypeOptions])

  return (
    <div className="space-y-3">
      {/* ── 上: 工種選択ボタン（0=選択、1～N=工種・数字キー対応）── 全体表示時は非表示 */}
      {!isAllView && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-slate-600 mr-0.5">モード:</span>
          {/* 0: 選択ボタン（クリックで選択モードに戻る） */}
          <button
            onClick={() => { setCalInputWorkType(""); handleCalInputCancel() }}
            className={cn(
              "text-xs font-bold h-7 px-2 rounded-sm border transition-all active:scale-95 inline-flex items-center gap-1",
              !calInputWorkType
                ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
            )}
          >
            選択
            <kbd className={cn(
              "text-[9px] min-w-[16px] text-center px-0.5 py-px rounded font-mono",
              !calInputWorkType ? "bg-white/20 text-white/80" : "bg-slate-100 text-slate-500 border border-slate-200"
            )}>0</kbd>
          </button>
          {/* 1～N: 工種ボタン（クリック→モード固定 / 長押し→押している間だけ有効） */}
          {workTypeOptions.map((opt, idx) => {
            const style = WORK_TYPE_STYLES[opt.code] ?? WORK_TYPE_STYLES.REWORK
            const isActive = calInputWorkType === opt.code
            const keyNum = idx + 1
            return (
              <button
                key={opt.code}
                onClick={() => setCalInputWorkType(calInputWorkType === opt.code ? "" : opt.code)}
                onMouseDown={(e) => { e.preventDefault(); setCalInputWorkType(opt.code) }}
                onMouseUp={() => setCalInputWorkType("")}
                onMouseLeave={() => { if (isActive) setCalInputWorkType("") }}
                onTouchStart={() => setCalInputWorkType(opt.code)}
                onTouchEnd={() => setCalInputWorkType("")}
                className={cn(
                  "text-xs font-bold h-7 px-2 rounded-sm border transition-all active:scale-95 inline-flex items-center gap-1 select-none",
                  isActive
                    ? `${style.dotColor} text-white shadow-sm`
                    : `bg-white ${style.text} border-current`
                )}
              >
                <span className={cn("inline-block w-2.5 h-2.5 rounded-sm", isActive ? "bg-white/80" : style.dotColor)} />
                {opt.label}
                <kbd className={cn(
                  "text-[9px] min-w-[16px] text-center px-0.5 py-px rounded font-mono",
                  isActive ? "bg-white/20 text-white/80" : "bg-slate-100 text-slate-500 border border-slate-200"
                )}>{keyNum}</kbd>
              </button>
            )
          })}
        </div>
      )}

      {/* ── 下: カレンダー（左） + 工程カード（右） ── */}
      <div className="flex gap-3 items-start">
        {/* カレンダー */}
        <div className="w-[55%] flex-shrink-0">
          <div className="border-2 rounded-sm p-3 bg-white border-slate-300 space-y-2">
          <ScheduleCalendar
          currentMonth={calMonth}
          schedules={siblings}
          getWorkTypeInfo={getWorkTypeInfo}
          onMonthChange={setCalMonth}
          onDateClick={isAllView ? undefined : handleCalDateClick}
          inputMode={isAllView ? undefined : calInputMode}
          inputStartDate={isAllView ? undefined : calInputStartDate}
          inputEndDate={isAllView ? undefined : calInputEndDate}
          inputWorkType={isAllView ? undefined : calInputWorkType}
          isSelectMode={!isAllView && !calInputWorkType}
          onBarClick={!isAllView && !calInputWorkType ? (scheduleId) => {
            const s = siblings.find((sc) => sc.id === scheduleId)
            if (s) startEdit(s)
          } : undefined}
        />

        {/* 入力中の情報 + アクション（全体表示時は非表示） */}
        {!isAllView && (calInputStartDate || calInputMode !== "idle") && (
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-500" />
                <span className="font-bold text-slate-600">
                  {calInputStartDate ? format(parseISO(calInputStartDate), "M/d(E)", { locale: ja }) : "―"}
                </span>
              </div>
              <span className="text-slate-300 font-bold">〜</span>
              <div className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-500" />
                <span className="font-bold text-slate-600">
                  {calInputEndDate ? format(parseISO(calInputEndDate), "M/d(E)", { locale: ja }) : "―"}
                </span>
              </div>
              {calcDays(calInputStartDate, calInputEndDate) != null && (
                <span className="font-bold text-slate-400 text-[10px]">({calcDays(calInputStartDate, calInputEndDate)}日)</span>
              )}
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={handleCalInputCancel}
                className="flex-1 h-7 rounded-sm text-xs font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 active:scale-95 transition-all"
              >
                取消
              </button>
              <button
                onClick={handleCalInputSubmit}
                disabled={calInputSaving || !calInputStartDate || !calInputEndDate}
                className="flex-1 h-7 rounded-sm text-xs font-bold bg-blue-500 text-white hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
              >
                {calInputSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                追加
              </button>
            </div>
            <p className="text-[10px] text-slate-400 font-bold text-center">
              {!calInputStartDate ? "開始日をタップ" : !calInputEndDate ? "終了日をタップ" : "追加ボタンで工事日程を作成"}
            </p>
          </div>
        )}

        {/* アイドル時のヒント（全体表示時は非表示） */}
        {!isAllView && calInputMode === "idle" && !calInputStartDate && (
          <p className="text-[10px] text-slate-400 font-bold text-center pt-1">
            {!calInputWorkType
              ? "工程バーをタップして編集 / 工種を選択して追加"
              : "カレンダーをタップして工程追加"
            }
          </p>
        )}

        {/* 凡例 */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-x-3 gap-y-1">
          {workTypeOptions.map((opt) => {
            const style = WORK_TYPE_STYLES[opt.code] ?? WORK_TYPE_STYLES.REWORK
            return (
              <div key={opt.code} className="flex items-center gap-1.5 text-xs text-slate-500">
                <div className={cn("w-4 h-2 rounded-sm", style.barClass)} />
                <span>{opt.label}</span>
              </div>
            )
          })}
        </div>
          </div>{/* カレンダー枠 end */}
        </div>{/* カレンダーカラム end */}

        {/* ── 右: 工程カード（縦1列・狭め） ── */}
        <div className="flex-1 min-w-0">
          <div className="space-y-2">
          {sorted.map((s) => {
            const wtInfo = getWorkTypeInfo(s.workType)
            const isActive = s.id === activeScheduleId
            const isEditing = editing?.scheduleId === s.id
            const days = calcDays(s.plannedStartDate, s.plannedEndDate)
            const isDeleting = deletingId === s.id

            if (isEditing && editing) {
              return (
                <div key={s.id} className="rounded-sm border-2 border-blue-300 bg-blue-50/30 p-3 space-y-2.5">
                  <div>
                    <Label className="text-xs text-slate-500 font-semibold mb-1 block">作業種別</Label>
                    <div className="flex gap-1.5 flex-wrap">
                      {workTypeOptions.map((opt) => {
                        const style = WORK_TYPE_STYLES[opt.code] ?? WORK_TYPE_STYLES.REWORK
                        return (
                          <button key={opt.code} onClick={() => setEditing({ ...editing, workType: opt.code })}
                            className={cn("text-sm font-medium px-3 py-1.5 rounded-md border transition-all",
                              editing.workType === opt.code
                                ? `${style.bg} ${style.text} ${style.border} ring-1 ring-blue-400`
                                : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"
                            )}
                          >{opt.label}</button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <Label className="text-xs text-slate-500 font-semibold mb-1 block">開始</Label>
                        <Input type="date" className="h-9 md:h-8 text-sm" value={editing.startDate} onChange={(e) => { setEditing({ ...editing, startDate: e.target.value }); if (e.target.value) setCalMonth(startOfMonth(parseISO(e.target.value))) }} />
                      </div>
                      <span className="text-sm text-slate-300 mt-5">〜</span>
                      <div className="flex-1 min-w-0">
                        <Label className="text-xs text-slate-500 font-semibold mb-1 block">終了</Label>
                        <Input type="date" className="h-9 md:h-8 text-sm" value={editing.endDate} onChange={(e) => setEditing({ ...editing, endDate: e.target.value })} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-slate-500">日数:</span>
                      {DAY_PRESETS.map((d) => {
                        const currentDays = calcDays(editing.startDate, editing.endDate)
                        return (
                          <button key={d}
                            onClick={() => { if (editing.startDate) setEditing({ ...editing, endDate: endDateFromDays(editing.startDate, d) }) }}
                            disabled={!editing.startDate}
                            className={cn("h-8 min-w-[36px] px-2 rounded text-sm font-medium border transition-all",
                              currentDays === d ? "bg-blue-500 text-white border-blue-500 shadow-sm"
                                : editing.startDate ? "bg-white text-slate-500 border-slate-200 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50"
                                : "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed"
                            )}
                          >{d}日</button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="h-8 text-sm text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDelete(editing.scheduleId)} disabled={saving || deletingId === editing.scheduleId}>
                      {deletingId === editing.scheduleId ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}削除
                    </Button>
                    <div className="flex-1" />
                    <Button variant="ghost" size="sm" className="h-8 text-sm" onClick={cancelEdit} disabled={saving}><X className="w-3.5 h-3.5 mr-1" />キャンセル</Button>
                    <Button size="sm" className="h-8 text-sm" onClick={saveEdit} disabled={saving}>
                      {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}保存
                    </Button>
                  </div>
                </div>
              )
            }

            return (
              <div
                key={s.id}
                className={cn(
                  "group relative rounded-sm border p-3 transition-all cursor-pointer hover:shadow-sm",
                  isActive ? "border-blue-200 bg-blue-50/40 hover:bg-blue-50/60" : "border-slate-200 bg-white hover:bg-slate-50"
                )}
                onClick={() => startEdit(s)}
                title="クリックで編集"
              >
                {isAllView && s.name && (
                  <div className="text-xs font-bold text-slate-500 mb-1 truncate">{s.name}</div>
                )}
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={cn("text-xs font-bold px-2 py-0.5 rounded-md border", wtInfo.bg, wtInfo.text, wtInfo.border)}>
                    {wtInfo.label}
                  </span>
                  {s.actualEndDate ? (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 font-semibold ml-auto">完工</span>
                  ) : s.actualStartDate ? (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-semibold ml-auto">着工</span>
                  ) : null}
                </div>
                <div className="text-sm text-slate-600">
                  {s.plannedStartDate ? format(parseISO(s.plannedStartDate), "M/d(E)", { locale: ja }) : "未定"}
                  <span className="text-slate-300 mx-1">〜</span>
                  {s.plannedEndDate ? format(parseISO(s.plannedEndDate), "M/d(E)", { locale: ja }) : "未定"}
                  {days != null && <span className="text-slate-400 ml-1.5 text-xs">({days}日間)</span>}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(s.id) }}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-300 hover:text-red-500 hover:border-red-300 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                  disabled={isDeleting}
                >
                  {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                </button>
              </div>
            )
          })}
        {/* 追加（全体表示時は非表示） */}
        {isAllView ? null : showAddForm ? (
          <div className="rounded-sm border-2 border-dashed border-green-300 bg-green-50/20 p-3 space-y-2.5">
            <div className="text-sm font-semibold text-green-700 flex items-center gap-1.5">
              <Plus className="w-4 h-4" />工事日程を追加
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-1 block">作業種別</Label>
              <div className="flex gap-1.5 flex-wrap">
                {workTypeOptions.map((opt) => {
                  const style = WORK_TYPE_STYLES[opt.code] ?? WORK_TYPE_STYLES.REWORK
                  return (
                    <button key={opt.code} onClick={() => setNewWorkType(opt.code)}
                      className={cn("text-sm font-medium px-3 py-1.5 rounded-md border transition-all",
                        newWorkType === opt.code
                          ? `${style.bg} ${style.text} ${style.border} ring-1 ring-green-400`
                          : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"
                      )}
                    >{opt.label}</button>
                  )
                })}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <Label className="text-xs text-slate-500 font-semibold mb-1 block">開始</Label>
                  <Input type="date" className="h-9 md:h-8 text-sm" value={newStartDate} onChange={(e) => { setNewStartDate(e.target.value); if (e.target.value) setCalMonth(startOfMonth(parseISO(e.target.value))) }} />
                </div>
                <span className="text-sm text-slate-300 mt-5">〜</span>
                <div className="flex-1 min-w-0">
                  <Label className="text-xs text-slate-500 font-semibold mb-1 block">終了</Label>
                  <Input type="date" className="h-9 md:h-8 text-sm" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-slate-600">日数:</span>
                {DAY_PRESETS.map((d) => {
                  const currentDays = calcDays(newStartDate, newEndDate)
                  return (
                    <button key={d}
                      onClick={() => { if (newStartDate) setNewEndDate(endDateFromDays(newStartDate, d)) }}
                      disabled={!newStartDate}
                      className={cn("h-8 min-w-[36px] px-2 rounded text-sm font-medium border transition-all",
                        currentDays === d ? "bg-green-500 text-white border-green-500 shadow-sm"
                          : newStartDate ? "bg-white text-slate-500 border-slate-200 hover:border-green-400 hover:text-green-600 hover:bg-green-50"
                          : "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed"
                      )}
                    >{d}日</button>
                  )
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="h-8 text-sm" onClick={() => setShowAddForm(false)} disabled={adding}>キャンセル</Button>
              <Button size="sm" className="h-8 text-sm bg-green-600 hover:bg-green-700" onClick={handleAdd} disabled={adding || !newWorkType}>
                {adding ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1" />}追加
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full rounded-sm border-2 border-dashed border-slate-200 py-3 text-sm text-slate-400 hover:text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />工事日程を追加
          </button>
        )}
        </div>{/* space-y-2 end */}
        </div>{/* 右カラム end */}
      </div>{/* flex row end */}
    </div>

  )
}

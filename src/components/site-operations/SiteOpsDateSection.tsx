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
import type { ScheduleData } from "@/components/worker-assignments/types"

interface WorkTypeMaster {
  id: string; code: string; label: string; shortLabel: string
  colorIndex: number; sortOrder: number; isActive: boolean
}

const WORK_TYPE_STYLES: Record<string, { label: string; bg: string; text: string; border: string; dotColor: string; barClass: string }> = {
  ASSEMBLY:    { label: "組立", bg: "bg-blue-100",   text: "text-blue-700",  border: "border-blue-300",  dotColor: "bg-blue-500", barClass: "bg-blue-400/70" },
  DISASSEMBLY: { label: "解体", bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-300", dotColor: "bg-orange-500", barClass: "bg-orange-400/70" },
  REWORK:      { label: "その他", bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-300", dotColor: "bg-slate-500", barClass: "bg-slate-400/70" },
}

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

const DAY_PRESETS = [1, 2, 3, 5, 7] as const

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

// ── カレンダーコンポーネント ──
function ScheduleCalendar({ currentMonth, schedules, getWorkTypeInfo, onMonthChange }: {
  currentMonth: Date
  schedules: ScheduleData[]
  getWorkTypeInfo: (code: string) => typeof WORK_TYPE_STYLES.ASSEMBLY
  onMonthChange: (d: Date) => void
}) {
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startDow = getDay(monthStart) // 0=Sun

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
        // この週に含まれる日を調べる
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

  // 各週のバー数（レイアン用）
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
        <button onClick={() => onMonthChange(subMonths(currentMonth, 1))} className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-bold text-slate-700">
          {format(currentMonth, "yyyy年M月", { locale: ja })}
        </span>
        <button onClick={() => onMonthChange(addMonths(currentMonth, 1))} className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-7 gap-0 border-b border-slate-200 mb-0.5">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} className={cn(
            "text-center text-xs font-semibold py-1",
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
                return (
                  <div
                    key={col}
                    className={cn(
                      "h-[34px] flex items-start justify-center pt-1 text-xs relative",
                      isTd && "font-bold text-blue-700",
                      !isTd && dow === 0 && "text-red-400",
                      !isTd && dow === 6 && "text-blue-400",
                      !isTd && dow !== 0 && dow !== 6 && "text-slate-600",
                    )}
                  >
                    {isTd ? (
                      <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[11px] font-bold">{day.getDate()}</span>
                    ) : (
                      <span className="text-[12px]">{day.getDate()}</span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* バーオーバーレイ */}
            {weekBars.map((seg, segIdx) => {
              const info = getWorkTypeInfo(seg.schedule.workType)
              const left = `${(seg.startCol / 7) * 100}%`
              const width = `${((seg.endCol - seg.startCol + 1) / 7) * 100}%`
              // 複数バーの場合は下にずらす
              const topOffset = 22 + segIdx * 10
              return (
                <div
                  key={`${seg.schedule.id}-${segIdx}`}
                  className={cn(
                    "absolute h-[7px] z-10",
                    info.barClass,
                    seg.isStart && "rounded-l-full",
                    seg.isEnd && "rounded-r-full",
                    !seg.isStart && !seg.isEnd && "",
                  )}
                  style={{ left, width, top: topOffset }}
                  title={`${info.label}: ${seg.schedule.plannedStartDate ? format(parseISO(seg.schedule.plannedStartDate), "M/d") : "?"} 〜 ${seg.schedule.plannedEndDate ? format(parseISO(seg.schedule.plannedEndDate), "M/d") : "?"}`}
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
export function SiteOpsDateSection({ activeScheduleId, siblings, projectId, contractId, groupName, onUpdated }: Props) {
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
      toast.success("工程を更新しました"); setEditing(null); onUpdated?.()
    } catch { toast.error("更新に失敗しました") } finally { setSaving(false) }
  }

  async function handleAdd() {
    if (!newWorkType || !newStartDate || !newEndDate) { toast.error("作業種別と日程を入力してください"); return }
    setAdding(true)
    try {
      const url = contractId ? `/api/contracts/${contractId}/schedules` : "/api/schedules"
      const bodyData = contractId
        ? { workType: newWorkType, name: groupName || null, plannedStartDate: newStartDate, plannedEndDate: newEndDate }
        : { projectId, workType: newWorkType, name: groupName || null, plannedStartDate: newStartDate, plannedEndDate: newEndDate }
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodyData) })
      if (!res.ok) { const data = await res.json().catch(() => null); throw new Error(data?.error ?? "追加に失敗しました") }
      toast.success("工程を追加しました"); setShowAddForm(false); setNewWorkType(""); setNewStartDate(""); setNewEndDate(""); onUpdated?.()
    } catch (err) { toast.error(err instanceof Error ? err.message : "追加に失敗しました") } finally { setAdding(false) }
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

  return (
    <div className="flex gap-4">
      {/* ── 左: カレンダー ── */}
      <div className="w-[240px] flex-shrink-0 border rounded-lg p-3 bg-white">
        <ScheduleCalendar
          currentMonth={calMonth}
          schedules={siblings}
          getWorkTypeInfo={getWorkTypeInfo}
          onMonthChange={setCalMonth}
        />
        {/* 凡例 */}
        <div className="mt-3 pt-2 border-t border-slate-100 flex flex-wrap gap-x-3 gap-y-1">
          {workTypeOptions.map((opt) => {
            const style = WORK_TYPE_STYLES[opt.code] ?? WORK_TYPE_STYLES.REWORK
            return (
              <div key={opt.code} className="flex items-center gap-1.5 text-xs text-slate-500">
                <div className={cn("w-4 h-2 rounded-full", style.barClass)} />
                <span>{opt.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 右: 工程カード ── */}
      <div className="flex-1 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {sorted.map((s) => {
            const wtInfo = getWorkTypeInfo(s.workType)
            const isActive = s.id === activeScheduleId
            const isEditing = editing?.scheduleId === s.id
            const days = calcDays(s.plannedStartDate, s.plannedEndDate)
            const isDeleting = deletingId === s.id

            if (isEditing && editing) {
              return (
                <div key={s.id} className="col-span-2 rounded-lg border-2 border-blue-300 bg-blue-50/30 p-3 space-y-2.5">
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
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Label className="text-xs text-slate-500 font-semibold mb-1 block">開始</Label>
                        <Input type="date" className="h-8 text-sm" value={editing.startDate} onChange={(e) => setEditing({ ...editing, startDate: e.target.value })} />
                      </div>
                      <span className="text-sm text-slate-300 pb-2">〜</span>
                      <div className="flex-1">
                        <Label className="text-xs text-slate-500 font-semibold mb-1 block">終了</Label>
                        <Input type="date" className="h-8 text-sm" value={editing.endDate} onChange={(e) => setEditing({ ...editing, endDate: e.target.value })} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
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
                  "group relative rounded-lg border p-3 transition-all cursor-pointer hover:shadow-sm",
                  isActive ? "border-blue-200 bg-blue-50/40 hover:bg-blue-50/60" : "border-slate-200 bg-white hover:bg-slate-50"
                )}
                onClick={() => startEdit(s)}
                title="クリックで編集"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={cn("text-sm font-bold px-2.5 py-1 rounded-md border", wtInfo.bg, wtInfo.text, wtInfo.border)}>
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
        </div>

        {/* 追加 */}
        {showAddForm ? (
          <div className="rounded-lg border-2 border-dashed border-green-300 bg-green-50/20 p-3 space-y-2.5">
            <div className="text-sm font-semibold text-green-700 flex items-center gap-1.5">
              <Plus className="w-4 h-4" />工程を追加
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
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label className="text-xs text-slate-500 font-semibold mb-1 block">開始日</Label>
                  <Input type="date" className="h-8 text-sm" value={newStartDate} onChange={(e) => setNewStartDate(e.target.value)} />
                </div>
                <span className="text-sm text-slate-300 pb-2">〜</span>
                <div className="flex-1">
                  <Label className="text-xs text-slate-500 font-semibold mb-1 block">終了日</Label>
                  <Input type="date" className="h-8 text-sm" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-1.5">
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
            className="w-full rounded-lg border-2 border-dashed border-slate-200 py-3 text-sm text-slate-400 hover:text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />工程を追加
          </button>
        )}
      </div>
    </div>
  )
}

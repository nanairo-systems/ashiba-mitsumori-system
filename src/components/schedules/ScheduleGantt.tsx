/**
 * [COMPONENT] 工期管理ガントチャート - ScheduleGantt
 *
 * 表示日数を調整可能なインタラクティブなガントチャート。
 * - 開始日を自由に変更可能（日単位・週単位でスクロール）
 * - ドラッグ操作でバーを作成
 * - 既存バーをクリックして編集・削除
 */
"use client"

import { useState, useMemo, useRef, useCallback, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  CalendarDays,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Search,
  Trash2,
  X,
  GripVertical,
  MousePointerClick,
  Pencil,
  Users,
  CircleDot,
  AlertCircle,
} from "lucide-react"
import { toast } from "sonner"
import {
  format,
  eachDayOfInterval,
  isToday,
  isWeekend,
  parseISO,
  isBefore,
  isAfter,
  differenceInDays,
  addDays,
  subDays,
  startOfWeek,
  getDate,
  isSameMonth,
} from "date-fns"
import { ja } from "date-fns/locale"
import type { ContractStatus, ScheduleWorkType } from "@prisma/client"

// ─── 型定義 ────────────────────────────────────────────

interface ScheduleData {
  id: string
  contractId: string
  workType: ScheduleWorkType
  plannedStartDate: string | null
  plannedEndDate: string | null
  actualStartDate: string | null
  actualEndDate: string | null
  workersCount: number | null
  notes: string | null
}

interface ContractData {
  id: string
  contractNumber: string | null
  status: ContractStatus
  startDate: string | null
  endDate: string | null
  project: { id: string; name: string; companyName: string }
  schedules: ScheduleData[]
}

interface Props {
  contracts: ContractData[]
  currentUser: { id: string; name: string }
  focusContractId?: string
}

// ─── 定数 ──────────────────────────────────────────────

const DISPLAY_DAYS_PRESETS = [30, 45, 60, 90] as const

const WORK_TYPES: ScheduleWorkType[] = ["ASSEMBLY", "DISASSEMBLY", "REWORK"]

const WT_CONFIG: Record<ScheduleWorkType, {
  label: string; short: string
  planned: string; actual: string; text: string; bg: string; border: string; cursor: string
}> = {
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

type DrawMode = "select" | ScheduleWorkType

// ─── メインコンポーネント ───────────────────────────────

const STORAGE_KEY_DISPLAY_DAYS = "gantt-display-days"

export function ScheduleGantt({ contracts, currentUser, focusContractId }: Props) {
  const router = useRouter()
  const today = new Date()
  const [rangeStart, setRangeStart] = useState(() => subDays(today, 7))
  const [search, setSearch] = useState("")
  const [drawMode, setDrawMode] = useState<DrawMode>("select")
  const [displayDays, setDisplayDays] = useState(45)

  // Shift → 解体, Ctrl/Meta → 組立 のキーボードショートカット
  const [heldKey, setHeldKey] = useState<"shift" | "ctrl" | null>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === "Shift") setHeldKey("shift")
      else if (e.key === "Control" || e.key === "Meta") setHeldKey("ctrl")
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === "Shift" && heldKey === "shift") setHeldKey(null)
      else if ((e.key === "Control" || e.key === "Meta") && heldKey === "ctrl") setHeldKey(null)
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
  }, [heldKey])

  const effectiveDrawMode: DrawMode = heldKey === "shift" ? "DISASSEMBLY" : heldKey === "ctrl" ? "ASSEMBLY" : drawMode

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY_DISPLAY_DAYS)
    const n = saved ? parseInt(saved, 10) : NaN
    if (!isNaN(n) && n >= 7 && n <= 365) setDisplayDays(n)
  }, [])

  function setDisplayDaysWithStorage(days: number) {
    setDisplayDays(days)
    localStorage.setItem(STORAGE_KEY_DISPLAY_DAYS, String(days))
  }

  // ドラッグ作成用
  const [dragInfo, setDragInfo] = useState<{
    contractId: string
    startDay: number
    endDay: number
  } | null>(null)
  const isDragging = useRef(false)

  // バー長押しドラッグで移動（掴んだ位置がついてくる）
  const [moveState, setMoveState] = useState<{
    schedule: ScheduleData
    contractId: string
    span: number
    moveStartDay: number
    grabOffset: number // クリック位置がバー左端から何日目か
    barAreaRect: DOMRect
  } | null>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressScheduleRef = useRef<{ schedule: ScheduleData; e: React.MouseEvent } | null>(null)

  // バー左右の縁ドラッグでリサイズ
  const [resizeState, setResizeState] = useState<{
    schedule: ScheduleData
    contractId: string
    edge: "left" | "right"
    startDay: number
    endDay: number
    barAreaRect: DOMRect
  } | null>(null)
  const resizeStateRef = useRef(resizeState)
  const resizeDaysRef = useRef({ startDay: 0, endDay: 0 })
  resizeStateRef.current = resizeState
  if (resizeState) {
    resizeDaysRef.current.startDay = resizeState.startDay
    resizeDaysRef.current.endDay = resizeState.endDay
  }

  // 編集ポップオーバー
  const [editSchedule, setEditSchedule] = useState<ScheduleData | null>(null)
  const [editPlannedStart, setEditPlannedStart] = useState("")
  const [editPlannedEnd, setEditPlannedEnd] = useState("")
  const [editActualStart, setEditActualStart] = useState("")
  const [editActualEnd, setEditActualEnd] = useState("")
  const [editWorkers, setEditWorkers] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const rangeEnd = addDays(rangeStart, displayDays - 1)
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd })
  const totalDays = displayDays

  // ナビゲーション
  const shiftDays = useCallback((n: number) => setRangeStart((prev) => addDays(prev, n)), [])
  const goToToday = () => setRangeStart(subDays(today, 7))

  // 長押しリピート：押し続けると加速しながら連続移動
  const repeatRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; interval: ReturnType<typeof setInterval> | null }>({ timer: null, interval: null })
  const accelRef = useRef(1)

  const startRepeat = useCallback((n: number) => {
    accelRef.current = 1
    shiftDays(n)
    repeatRef.current.timer = setTimeout(() => {
      repeatRef.current.interval = setInterval(() => {
        accelRef.current = Math.min(accelRef.current + 0.3, 7)
        shiftDays(n > 0 ? Math.round(accelRef.current) : -Math.round(accelRef.current))
      }, 80)
    }, 400)
  }, [shiftDays])

  const stopRepeat = useCallback(() => {
    if (repeatRef.current.timer) { clearTimeout(repeatRef.current.timer); repeatRef.current.timer = null }
    if (repeatRef.current.interval) { clearInterval(repeatRef.current.interval); repeatRef.current.interval = null }
    accelRef.current = 1
  }, [])

  useEffect(() => {
    return () => stopRepeat()
  }, [stopRepeat])

  // フォーカス契約がある場合はその契約のみ対象に
  const targetContracts = useMemo(() => {
    if (focusContractId) {
      const found = contracts.find((c) => c.id === focusContractId)
      return found ? [found] : contracts
    }
    return contracts
  }, [contracts, focusContractId])

  // フィルター（検索のみ、日付範囲では絞らない → 行を固定）
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return targetContracts
    return targetContracts.filter((c) =>
      c.project.name.toLowerCase().includes(q) || c.project.companyName.toLowerCase().includes(q)
    )
  }, [targetContracts, search])

  // バー描画ヘルパー
  const getBarPos = useCallback((startStr: string | null, endStr: string | null) => {
    if (!startStr) return null
    const start = parseISO(startStr)
    const end = endStr ? parseISO(endStr) : start
    const barStart = isBefore(start, rangeStart) ? rangeStart : start
    const barEnd = isAfter(end, rangeEnd) ? rangeEnd : end
    if (isAfter(barStart, rangeEnd) || isBefore(barEnd, rangeStart)) return null
    const startIdx = differenceInDays(barStart, rangeStart)
    const span = differenceInDays(barEnd, barStart) + 1
    return {
      left: `${(startIdx / totalDays) * 100}%`,
      width: `${(Math.max(span, 1) / totalDays) * 100}%`,
    }
  }, [rangeStart, rangeEnd, totalDays])

  function dayIdxToStr(idx: number) {
    const d = addDays(rangeStart, Math.max(0, Math.min(idx, totalDays - 1)))
    return format(d, "yyyy-MM-dd")
  }

  // ドラッグ操作
  function handleMouseDown(contractId: string, dayIdx: number) {
    if (effectiveDrawMode === "select") return
    isDragging.current = true
    dragDrawModeRef.current = effectiveDrawMode as ScheduleWorkType
    setDragInfo({ contractId, startDay: dayIdx, endDay: dayIdx })
    setEditSchedule(null)
  }

  function handleMouseMove(dayIdx: number) {
    if (!isDragging.current || !dragInfo) return
    setDragInfo((prev) => prev ? { ...prev, endDay: dayIdx } : null)
  }

  // ドラッグ開始時のモードを記録（キーリリースしてもドラッグ中の工種を維持）
  const dragDrawModeRef = useRef<ScheduleWorkType>("ASSEMBLY")

  function handleMouseUp() {
    if (!isDragging.current || !dragInfo) {
      isDragging.current = false
      setDragInfo(null)
      return
    }
    isDragging.current = false
    const startDay = Math.min(dragInfo.startDay, dragInfo.endDay)
    const endDay = Math.max(dragInfo.startDay, dragInfo.endDay)
    createSchedule(dragInfo.contractId, dragDrawModeRef.current, dayIdxToStr(startDay), dayIdxToStr(endDay))
    setDragInfo(null)
  }

  async function createSchedule(contractId: string, workType: ScheduleWorkType, startDate: string, endDate: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/contracts/${contractId}/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workType, plannedStartDate: startDate, plannedEndDate: endDate }),
      })
      if (!res.ok) throw new Error()
      toast.success(`${WT_CONFIG[workType].label}を追加しました`)
      router.refresh()
    } catch {
      toast.error("追加に失敗しました")
    } finally {
      setSaving(false)
    }
  }

  // バー長押し→ドラッグで日付変更
  function handleBarMouseDown(schedule: ScheduleData, contractId: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (effectiveDrawMode !== "select") return
    const barArea = (e.currentTarget as HTMLElement).closest("[data-bar-area]") as HTMLElement | null
    if (!barArea || !schedule.plannedStartDate) return
    const rect = barArea.getBoundingClientRect()
    const span = schedule.plannedEndDate && schedule.plannedStartDate
      ? differenceInDays(parseISO(schedule.plannedEndDate), parseISO(schedule.plannedStartDate)) + 1
      : 1
    const clickDayIdx = Math.floor(((e.clientX - rect.left) / rect.width) * totalDays)
    const barStartIdx = schedule.plannedStartDate
      ? Math.max(0, differenceInDays(parseISO(schedule.plannedStartDate), rangeStart))
      : clickDayIdx
    const grabOffset = Math.max(0, Math.min(clickDayIdx - barStartIdx, span - 1))
    const startIdx = Math.max(0, Math.min(clickDayIdx - grabOffset, totalDays - span))

    longPressScheduleRef.current = { schedule, e }
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null
      setEditSchedule(null)
      setMoveState({
        schedule,
        contractId,
        span,
        moveStartDay: startIdx,
        grabOffset,
        barAreaRect: rect,
      })
    }, 400)
  }

  function handleBarMouseUp(schedule: ScheduleData, e: React.MouseEvent) {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
      longPressScheduleRef.current = null
      handleBarClick(schedule, e)
      return
    }
  }

  // バー左端・右端ドラッグでリサイズ
  function handleBarEdgeMouseDown(schedule: ScheduleData, contractId: string, edge: "left" | "right", e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    if (effectiveDrawMode !== "select" || !schedule.plannedStartDate) return
    const barArea = (e.currentTarget as HTMLElement).closest("[data-bar-area]") as HTMLElement | null
    if (!barArea) return
    const rect = barArea.getBoundingClientRect()
    const startDay = Math.max(0, differenceInDays(parseISO(schedule.plannedStartDate), rangeStart))
    const endDay = schedule.plannedEndDate
      ? Math.min(totalDays - 1, differenceInDays(parseISO(schedule.plannedEndDate), rangeStart))
      : startDay
    longPressTimerRef.current && clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = null
    setResizeState({
      schedule,
      contractId,
      edge,
      startDay,
      endDay,
      barAreaRect: rect,
    })
  }

  async function resizeScheduleApi(scheduleId: string, newStart: string, newEnd: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plannedStartDate: newStart, plannedEndDate: newEnd }),
      })
      if (!res.ok) throw new Error()
      toast.success("日付を更新しました")
      setResizeState(null)
      router.refresh()
    } catch {
      toast.error("更新に失敗しました")
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!resizeState) return
    function onMouseMove(e: MouseEvent) {
      const r = resizeStateRef.current
      if (!r) return
      const rect = r.barAreaRect
      const dayIdx = Math.max(0, Math.min(totalDays - 1, Math.floor(((e.clientX - rect.left) / rect.width) * totalDays)))
      if (r.edge === "left") {
        const startDay = Math.min(dayIdx, resizeDaysRef.current.endDay)
        resizeDaysRef.current.startDay = startDay
        setResizeState((prev) => prev ? { ...prev, startDay } : null)
      } else {
        const endDay = Math.max(dayIdx, resizeDaysRef.current.startDay)
        resizeDaysRef.current.endDay = endDay
        setResizeState((prev) => prev ? { ...prev, endDay } : null)
      }
    }
    function onMouseUp() {
      const r = resizeStateRef.current
      const { startDay, endDay } = resizeDaysRef.current
      if (r) {
        resizeScheduleApi(r.schedule.id, dayIdxToStr(startDay), dayIdxToStr(endDay))
      }
    }
    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
    return () => {
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
    }
  }, [!!resizeState])

  async function moveScheduleApi(scheduleId: string, newStart: string, newEnd: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plannedStartDate: newStart, plannedEndDate: newEnd }),
      })
      if (!res.ok) throw new Error()
      toast.success("日付を更新しました")
      setMoveState(null)
      router.refresh()
    } catch {
      toast.error("更新に失敗しました")
    } finally {
      setSaving(false)
    }
  }

  const moveStateRef = useRef(moveState)
  const moveStartDayRef = useRef(0)
  moveStateRef.current = moveState
  if (moveState) moveStartDayRef.current = moveState.moveStartDay

  useEffect(() => {
    if (!moveState) return
    function onMouseMove(e: MouseEvent) {
      const m = moveStateRef.current
      if (!m) return
      const rect = m.barAreaRect
      const dayIdx = Math.floor(((e.clientX - rect.left) / rect.width) * totalDays)
      const startIdx = Math.max(0, Math.min(dayIdx - m.grabOffset, totalDays - m.span))
      moveStartDayRef.current = startIdx
      setMoveState((prev) => prev ? { ...prev, moveStartDay: startIdx } : null)
    }
    function onMouseUp() {
      const m = moveStateRef.current
      const startDay = moveStartDayRef.current
      if (m) {
        const newStart = dayIdxToStr(startDay)
        const newEnd = dayIdxToStr(startDay + m.span - 1)
        moveScheduleApi(m.schedule.id, newStart, newEnd)
      }
    }
    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
    return () => {
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
    }
  }, [!!moveState])

  function handleBarClick(schedule: ScheduleData, e: React.MouseEvent) {
    e.stopPropagation()
    if (effectiveDrawMode !== "select") return
    setEditSchedule(schedule)
    setEditPlannedStart(schedule.plannedStartDate?.slice(0, 10) ?? "")
    setEditPlannedEnd(schedule.plannedEndDate?.slice(0, 10) ?? "")
    setEditActualStart(schedule.actualStartDate?.slice(0, 10) ?? "")
    setEditActualEnd(schedule.actualEndDate?.slice(0, 10) ?? "")
    setEditWorkers(schedule.workersCount?.toString() ?? "")
    setEditNotes(schedule.notes ?? "")
  }

  async function handleUpdate() {
    if (!editSchedule) return
    setSaving(true)
    try {
      const res = await fetch(`/api/schedules/${editSchedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plannedStartDate: editPlannedStart || null,
          plannedEndDate: editPlannedEnd || null,
          actualStartDate: editActualStart || null,
          actualEndDate: editActualEnd || null,
          workersCount: editWorkers ? parseInt(editWorkers) : null,
          notes: editNotes.trim() || null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success("更新しました")
      setEditSchedule(null)
      router.refresh()
    } catch {
      toast.error("更新に失敗しました")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editSchedule) return
    if (!confirm("この工程を削除しますか？")) return
    const res = await fetch(`/api/schedules/${editSchedule.id}`, { method: "DELETE" })
    if (res.ok) {
      toast.success("削除しました")
      setEditSchedule(null)
      router.refresh()
    } else {
      toast.error("削除に失敗しました")
    }
  }

  function getDragPreview(contractId: string) {
    if (!dragInfo || dragInfo.contractId !== contractId) return null
    const startDay = Math.min(dragInfo.startDay, dragInfo.endDay)
    const endDay = Math.max(dragInfo.startDay, dragInfo.endDay)
    const span = endDay - startDay + 1
    return {
      left: `${(startDay / totalDays) * 100}%`,
      width: `${(span / totalDays) * 100}%`,
    }
  }

  // 各日セルの幅を固定: 100% / totalDays
  const cellWidthPct = 100 / totalDays

  return (
    <div className="space-y-4" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      {/* フォーカス中バナー */}
      {focusContractId && filtered.length > 0 && (
        <div className="flex items-center justify-between gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm">
          <span className="text-blue-700">
            契約詳細から遷移しました — <strong>{filtered[0]?.project.name}</strong> の工程を編集しています
          </span>
          <Link href="/schedules">
            <Button variant="outline" size="sm" className="text-xs h-7">
              全件表示へ戻る
            </Button>
          </Link>
        </div>
      )}

      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-blue-600" />
            工期管理
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            ドラッグで工程を作成 — {currentUser.name} さん
            <span className="text-slate-400 ml-2 text-xs">（Ctrl＝組立 / Shift＝解体）</span>
          </p>
        </div>
      </div>

      {/* ツールバー（折り返し無し・2行固定） */}
      <div className="bg-white border rounded-xl p-2.5 space-y-2">
        {/* 1行目: モード + 矢印 + 日付範囲 */}
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-xs text-slate-500 font-medium flex-shrink-0">モード:</span>
          <Button size="sm" variant={effectiveDrawMode === "select" ? "default" : "outline"} onClick={() => setDrawMode("select")} className="text-xs gap-1.5 h-8 flex-shrink-0">
            <MousePointerClick className="w-3.5 h-3.5" />選択
          </Button>
          <div className="w-px h-6 bg-slate-200 flex-shrink-0" />
          {WORK_TYPES.map((wt) => {
            const cfg = WT_CONFIG[wt]
            const isActive = effectiveDrawMode === wt
            const shortcutLabel = wt === "ASSEMBLY" ? "Ctrl" : wt === "DISASSEMBLY" ? "Shift" : null
            return (
              <Button key={wt} size="sm" variant={isActive ? "default" : "outline"} onClick={() => setDrawMode(drawMode === wt ? "select" : wt)} className={`text-xs gap-1 h-8 flex-shrink-0 ${isActive ? "" : `${cfg.text} border-current`}`}>
                <span className={`inline-block w-3 h-3 rounded-sm ${isActive ? "bg-white/80" : cfg.actual}`} />{cfg.label}
                {shortcutLabel && <span className={`text-[9px] ml-0.5 ${isActive ? "text-white/70" : "text-slate-400"}`}>{shortcutLabel}</span>}
              </Button>
            )
          })}
          <div className="w-px h-6 bg-slate-200 flex-shrink-0" />
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onMouseDown={() => startRepeat(-7)} onMouseUp={stopRepeat} onMouseLeave={stopRepeat} onTouchStart={() => startRepeat(-7)} onTouchEnd={stopRepeat}><ChevronsLeft className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onMouseDown={() => startRepeat(-1)} onMouseUp={stopRepeat} onMouseLeave={stopRepeat} onTouchStart={() => startRepeat(-1)} onTouchEnd={stopRepeat}><ChevronLeft className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onMouseDown={() => startRepeat(1)} onMouseUp={stopRepeat} onMouseLeave={stopRepeat} onTouchStart={() => startRepeat(1)} onTouchEnd={stopRepeat}><ChevronRight className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onMouseDown={() => startRepeat(7)} onMouseUp={stopRepeat} onMouseLeave={stopRepeat} onTouchStart={() => startRepeat(7)} onTouchEnd={stopRepeat}><ChevronsRight className="w-4 h-4" /></Button>
          </div>
          <span className="text-xs text-slate-500 flex-shrink-0 ml-1">
            {format(rangeStart, "M/d")} 〜 {format(rangeEnd, "M/d")}
            <span className="text-slate-400 ml-1">（{displayDays}日）</span>
          </span>
        </div>
        {/* 2行目: 表示日数 + 開始日 + 今日 + 検索 */}
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <span className="text-[10px] text-slate-400">幅:</span>
            {DISPLAY_DAYS_PRESETS.map((d) => (
              <Button key={d} variant={displayDays === d ? "default" : "ghost"} size="sm" className="h-6 px-1.5 text-[10px] flex-shrink-0" onClick={() => setDisplayDaysWithStorage(d)}>{d}日</Button>
            ))}
          </div>
          <div className="w-px h-5 bg-slate-200 flex-shrink-0" />
          <Input type="date" value={format(rangeStart, "yyyy-MM-dd")} onChange={(e) => { if (e.target.value) setRangeStart(parseISO(e.target.value)) }} className="h-7 text-xs w-[130px] flex-shrink-0" />
          <Button variant="ghost" size="sm" className="text-xs h-7 px-2 flex-shrink-0" onClick={goToToday}>今日</Button>
          <div className="w-px h-5 bg-slate-200 flex-shrink-0" />
          <div className="relative w-44 flex-shrink-0 ml-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input placeholder="検索" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-7 text-xs" />
          </div>
        </div>
      </div>

      {/* ガントチャート */}
      <div className={`bg-white border rounded-xl overflow-hidden select-none ${effectiveDrawMode !== "select" ? WT_CONFIG[effectiveDrawMode as ScheduleWorkType].cursor : ""}`}>
        {/* 日付ヘッダー（固定幅セル） */}
        <div className="flex border-b border-slate-300 sticky top-0 z-20 bg-white">
          <div className="w-[220px] flex-shrink-0 px-3 py-1 bg-slate-50 border-r border-slate-200 text-xs font-medium text-slate-500 flex items-center">
            案件名
          </div>
          <div className="flex-1 flex">
            {days.map((day, i) => {
              const isWe = isWeekend(day)
              const isTd = isToday(day)
              const d = getDate(day)
              const isFirstOfMonth = d === 1
              const monthLabel = isFirstOfMonth ? format(day, "M月", { locale: ja }) : null
              return (
                <div
                  key={i}
                  style={{ width: `${cellWidthPct}%` }}
                  className={`flex-shrink-0 text-center py-1 text-[10px] leading-tight border-r border-slate-100 last:border-r-0 ${
                    isTd ? "bg-blue-100 font-bold text-blue-700" :
                    isWe ? "bg-red-50/50 text-red-400" :
                    "text-slate-400"
                  } ${isFirstOfMonth ? "border-l-2 border-l-slate-300" : ""}`}
                >
                  {monthLabel && <div className="text-[8px] font-bold text-slate-600 -mb-0.5">{monthLabel}</div>}
                  <div className="font-medium">{d}</div>
                  <div className="text-[8px]">{format(day, "E", { locale: ja })}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 案件行 */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">表示する案件がありません</p>
          </div>
        ) : (
          filtered.map((contract) => {
            const preview = getDragPreview(contract.id)
            const hasSchedules = contract.schedules.length > 0
            let scheduleDateRange: { earliest: Date; latest: Date } | null = null
            if (hasSchedules) {
              const allDates = contract.schedules.flatMap((s) =>
                [s.plannedStartDate, s.plannedEndDate, s.actualStartDate, s.actualEndDate].filter(Boolean) as string[]
              )
              if (allDates.length > 0) {
                const earliest = allDates.reduce((a, b) => (a < b ? a : b))
                const latest = allDates.reduce((a, b) => (a > b ? a : b))
                scheduleDateRange = { earliest: parseISO(earliest), latest: parseISO(latest) }
              }
            }
            const inRange = scheduleDateRange
              ? !isAfter(scheduleDateRange.earliest, rangeEnd) && !isBefore(scheduleDateRange.latest, rangeStart)
              : false
            return (
              <div key={contract.id} className="flex border-b border-slate-100 last:border-b-0 group/row">
                {/* 案件名 */}
                <div className={`w-[220px] flex-shrink-0 px-3 py-2 border-r border-slate-200 transition-colors ${
                  hasSchedules ? (inRange ? "bg-blue-50/60 border-l-2 border-l-blue-400" : "bg-amber-50/40 border-l-2 border-l-amber-300") : "bg-slate-50/50"
                } hover:bg-slate-100/50`}>
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/contracts/${contract.id}`}
                      className="text-xs font-medium text-slate-800 hover:text-blue-600 hover:underline truncate flex-1 min-w-0"
                    >
                      {contract.project.name}
                    </Link>
                    {hasSchedules ? (
                      inRange ? (
                        <CircleDot className="w-3 h-3 text-blue-500 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-3 h-3 text-amber-500 flex-shrink-0" />
                      )
                    ) : (
                      <span className="text-[9px] text-slate-300 flex-shrink-0">工程なし</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 truncate block">{contract.project.companyName}</span>
                  {hasSchedules ? (
                    <>
                      <div className="flex flex-wrap gap-0.5 mt-1">
                        {contract.schedules.map((s) => (
                          <span key={s.id} className={`inline-block px-1 py-0 rounded text-[8px] font-medium ${WT_CONFIG[s.workType].bg} ${WT_CONFIG[s.workType].text}`}>
                            {WT_CONFIG[s.workType].short}
                            {s.workersCount && <span className="ml-0.5">{s.workersCount}人</span>}
                          </span>
                        ))}
                      </div>
                      {scheduleDateRange && (
                        <p className="text-[9px] text-slate-500 mt-0.5">
                          {format(scheduleDateRange.earliest, "M/d")} 〜 {format(scheduleDateRange.latest, "M/d")}
                          {!inRange && (
                            <button
                              className="text-amber-600 ml-0.5 hover:underline hover:text-amber-800"
                              onClick={(e) => { e.stopPropagation(); e.preventDefault(); setRangeStart(subDays(scheduleDateRange.earliest, 3)) }}
                            >
                              （範囲外 →表示）
                            </button>
                          )}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-[9px] text-slate-300 mt-0.5">ドラッグで追加</p>
                  )}
                </div>

                {/* バー領域 */}
                <div
                  data-bar-area
                  data-contract-id={contract.id}
                  className="flex-1 relative"
                  style={{ height: 48 }}
                  onMouseDown={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const x = e.clientX - rect.left
                    const dayIdx = Math.floor((x / rect.width) * totalDays)
                    handleMouseDown(contract.id, dayIdx)
                  }}
                  onMouseMove={(e) => {
                    if (!isDragging.current) return
                    const rect = e.currentTarget.getBoundingClientRect()
                    const x = e.clientX - rect.left
                    const dayIdx = Math.floor((x / rect.width) * totalDays)
                    handleMouseMove(dayIdx)
                  }}
                >
                  {/* 今日の線 */}
                  {(() => {
                    const todayIdx = differenceInDays(today, rangeStart)
                    if (todayIdx < 0 || todayIdx >= totalDays) return null
                    const left = ((todayIdx + 0.5) / totalDays) * 100
                    return <div className="absolute top-0 bottom-0 w-px bg-red-400/60 z-10 pointer-events-none" style={{ left: `${left}%` }} />
                  })()}

                  {/* 土日背景 */}
                  {days.map((day, i) => {
                    if (!isWeekend(day)) return null
                    return (
                      <div
                        key={`bg-${i}`}
                        className="absolute top-0 bottom-0 bg-red-50/20 pointer-events-none"
                        style={{ left: `${(i / totalDays) * 100}%`, width: `${(1 / totalDays) * 100}%` }}
                      />
                    )
                  })}

                  {/* 月境界線 */}
                  {days.map((day, i) => {
                    if (getDate(day) !== 1 || i === 0) return null
                    return (
                      <div
                        key={`ml-${i}`}
                        className="absolute top-0 bottom-0 w-px bg-slate-300/60 pointer-events-none z-[1]"
                        style={{ left: `${(i / totalDays) * 100}%` }}
                      />
                    )
                  })}

                  {/* 既存バー */}
                  {contract.schedules.map((schedule, si) => {
                    const cfg = WT_CONFIG[schedule.workType]
                    const isMoving = moveState?.schedule.id === schedule.id && moveState?.contractId === contract.id
                    const isResizing = resizeState?.schedule.id === schedule.id && resizeState?.contractId === contract.id
                    const plannedPos = getBarPos(schedule.plannedStartDate, schedule.plannedEndDate)
                    const actualPos = getBarPos(schedule.actualStartDate, schedule.actualEndDate)
                    const y = 4

                    return (
                      <div key={schedule.id}>
                        {plannedPos && !isMoving && !isResizing && (
                          <div
                            className={`absolute rounded-md ${cfg.planned} border ${cfg.border} z-[5] group/bar transition-shadow ${effectiveDrawMode === "select" ? "cursor-grab hover:shadow-md hover:brightness-95 active:cursor-grabbing" : "pointer-events-none"}`}
                            style={{ ...plannedPos, top: y, height: 22 }}
                            onMouseDown={(e) => handleBarMouseDown(schedule, contract.id, e)}
                            onMouseUp={(e) => handleBarMouseUp(schedule, e)}
                          >
                            {effectiveDrawMode === "select" && (
                              <>
                                <div
                                  className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize z-10 rounded-l-md hover:bg-white/30"
                                  style={{ borderLeft: "2px solid transparent" }}
                                  onMouseDown={(e) => handleBarEdgeMouseDown(schedule, contract.id, "left", e)}
                                />
                                <div
                                  className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize z-10 rounded-r-md hover:bg-white/30"
                                  style={{ borderRight: "2px solid transparent" }}
                                  onMouseDown={(e) => handleBarEdgeMouseDown(schedule, contract.id, "right", e)}
                                />
                              </>
                            )}
                            <div className="flex items-center h-full px-1.5 overflow-hidden">
                              <span className={`text-[10px] font-bold ${cfg.text} whitespace-nowrap`}>{cfg.label}</span>
                              {schedule.plannedStartDate && (
                                <span className="text-[8px] text-slate-500 ml-1 whitespace-nowrap">
                                  {format(parseISO(schedule.plannedStartDate), "M/d")}
                                  {schedule.plannedEndDate && `-${format(parseISO(schedule.plannedEndDate), "M/d")}`}
                                </span>
                              )}
                              {schedule.workersCount && (
                                <span className={`text-[8px] ml-auto ${cfg.text} opacity-70 whitespace-nowrap`}>{schedule.workersCount}人</span>
                              )}
                            </div>
                          </div>
                        )}
                        {isMoving && moveState && (
                          <div
                            className={`absolute rounded-md ${cfg.planned} border-2 border-blue-500 shadow-lg z-[15] cursor-grabbing opacity-95`}
                            style={{
                              left: `${(moveState.moveStartDay / totalDays) * 100}%`,
                              width: `${(moveState.span / totalDays) * 100}%`,
                              top: y,
                              height: 22,
                            }}
                          >
                            <div className="flex items-center h-full px-1.5 overflow-hidden">
                              <span className={`text-[10px] font-bold ${cfg.text} whitespace-nowrap`}>{cfg.label}</span>
                              <span className="text-[8px] text-slate-500 ml-1 whitespace-nowrap">
                                {format(addDays(rangeStart, moveState.moveStartDay), "M/d")}
                                {moveState.span > 1 && `-${format(addDays(rangeStart, moveState.moveStartDay + moveState.span - 1), "M/d")}`}
                              </span>
                              {schedule.workersCount && (
                                <span className={`text-[8px] ml-auto ${cfg.text} opacity-70 whitespace-nowrap`}>{schedule.workersCount}人</span>
                              )}
                            </div>
                          </div>
                        )}
                        {isResizing && resizeState && (
                          <div
                            className={`absolute rounded-md ${cfg.planned} border-2 border-amber-500 shadow-lg z-[15] opacity-95`}
                            style={{
                              left: `${(resizeState.startDay / totalDays) * 100}%`,
                              width: `${((resizeState.endDay - resizeState.startDay + 1) / totalDays) * 100}%`,
                              top: y,
                              height: 22,
                            }}
                          >
                            <div className="flex items-center h-full px-1.5 overflow-hidden">
                              <span className={`text-[10px] font-bold ${cfg.text} whitespace-nowrap`}>{cfg.label}</span>
                              <span className="text-[8px] text-slate-500 ml-1 whitespace-nowrap">
                                {format(addDays(rangeStart, resizeState.startDay), "M/d")}-{format(addDays(rangeStart, resizeState.endDay), "M/d")}
                              </span>
                              {schedule.workersCount && (
                                <span className={`text-[8px] ml-auto ${cfg.text} opacity-70 whitespace-nowrap`}>{schedule.workersCount}人</span>
                              )}
                            </div>
                          </div>
                        )}
                        {actualPos && !isMoving && !isResizing && (
                          <div
                            className={`absolute rounded-md ${cfg.actual} z-[6] ${effectiveDrawMode === "select" ? "cursor-pointer hover:brightness-110" : "pointer-events-none"}`}
                            style={{ ...actualPos, top: 26, height: 14 }}
                            onClick={(e) => handleBarClick(schedule, e)}
                            title={`${cfg.label}（実績）`}
                          >
                            <div className="flex items-center h-full px-1 overflow-hidden">
                              <span className="text-[8px] text-white font-medium whitespace-nowrap">実績</span>
                            </div>
                          </div>
                        )}
                        {!plannedPos && !actualPos && (() => {
                          const refDate = schedule.plannedStartDate ?? schedule.actualStartDate
                          const isAfterRange = refDate ? isAfter(parseISO(refDate), rangeEnd) : false
                          const dateLabel = refDate ? format(parseISO(refDate), "M/d") : ""
                          return (
                            <div
                              className={`absolute z-[5] flex items-center cursor-pointer hover:opacity-80`}
                              style={{ top: y, height: 22, ...(isAfterRange ? { right: 4 } : { left: 4 }) }}
                              onClick={(e) => {
                                e.stopPropagation()
                                if (refDate) {
                                  setRangeStart(subDays(parseISO(refDate), 3))
                                } else {
                                  handleBarClick(schedule, e)
                                }
                              }}
                            >
                              <span className={`text-[9px] ${cfg.text} px-1.5 py-0.5 rounded ${cfg.bg} border ${cfg.border} flex items-center gap-1`}>
                                {!isAfterRange && <span>◀</span>}
                                {cfg.label} {dateLabel && `${dateLabel}〜`}
                                {isAfterRange && <span>▶</span>}
                              </span>
                            </div>
                          )
                        })()}
                      </div>
                    )
                  })}

                  {/* ドラッグプレビュー */}
                  {preview && (() => {
                    const previewWt = isDragging.current ? dragDrawModeRef.current : (effectiveDrawMode !== "select" ? effectiveDrawMode as ScheduleWorkType : "ASSEMBLY")
                    return (
                      <div
                        className={`absolute rounded-md ${WT_CONFIG[previewWt].actual} opacity-40 z-[15] pointer-events-none`}
                        style={{ ...preview, top: 4, height: 22 }}
                      >
                        <div className="flex items-center h-full px-1.5">
                          <span className="text-[10px] text-white font-bold">{WT_CONFIG[previewWt].label}</span>
                        </div>
                      </div>
                    )
                  })()}

                  {effectiveDrawMode !== "select" && contract.schedules.length === 0 && !preview && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="text-[10px] text-slate-300 flex items-center gap-1">
                        <GripVertical className="w-3 h-3" />
                        ドラッグして{WT_CONFIG[effectiveDrawMode as ScheduleWorkType].label}を追加
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* 凡例 */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-4">
          <span className="font-medium">凡例:</span>
          {WORK_TYPES.map((wt) => {
            const cfg = WT_CONFIG[wt]
            return (
              <div key={wt} className="flex items-center gap-1.5">
                <span className={`inline-block w-5 h-2.5 rounded-sm ${cfg.planned} border ${cfg.border}`} />
                <span>{cfg.label}（予定）</span>
                <span className={`inline-block w-5 h-2.5 rounded-sm ${cfg.actual}`} />
                <span>（実績）</span>
              </div>
            )
          })}
        </div>
        <span>{filtered.length} 件</span>
      </div>

      {/* 編集ポップオーバー */}
      {editSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setEditSchedule(null)}>
          <div
            className="bg-white rounded-xl shadow-2xl border border-slate-200 w-[340px] p-4 space-y-3 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`inline-block w-3 h-3 rounded-sm ${WT_CONFIG[editSchedule.workType].actual}`} />
                <span className="text-sm font-bold text-slate-800">{WT_CONFIG[editSchedule.workType].label}</span>
                <Pencil className="w-3 h-3 text-slate-400" />
              </div>
              <button onClick={() => setEditSchedule(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-slate-500">予定期間</Label>
              <div className="flex items-center gap-2">
                <Input type="date" value={editPlannedStart} onChange={(e) => setEditPlannedStart(e.target.value)} className="h-8 text-xs" />
                <span className="text-xs text-slate-400">〜</span>
                <Input type="date" value={editPlannedEnd} onChange={(e) => setEditPlannedEnd(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-slate-500">実績期間</Label>
              <div className="flex items-center gap-2">
                <Input type="date" value={editActualStart} onChange={(e) => setEditActualStart(e.target.value)} className="h-8 text-xs" />
                <span className="text-xs text-slate-400">〜</span>
                <Input type="date" value={editActualEnd} onChange={(e) => setEditActualEnd(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>

            <div className="flex gap-3">
              <div className="space-y-1 flex-1">
                <Label className="text-xs text-slate-500 flex items-center gap-1"><Users className="w-3 h-3" />人数</Label>
                <Input type="number" min={1} value={editWorkers} onChange={(e) => setEditWorkers(e.target.value)} className="h-8 text-xs" placeholder="—" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-slate-500">備考</Label>
              <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} className="text-xs" placeholder="メモ" />
            </div>

            <div className="flex items-center justify-between pt-1">
              <Button variant="ghost" size="sm" className="text-xs text-red-600 hover:bg-red-50 gap-1 h-7" onClick={handleDelete}>
                <Trash2 className="w-3 h-3" />削除
              </Button>
              <Button size="sm" className="text-xs h-7" onClick={handleUpdate} disabled={saving}>
                {saving ? "保存中..." : "更新"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

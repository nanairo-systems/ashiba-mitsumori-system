/**
 * [COMPONENT] 人員配置管理 - メインビュー
 *
 * データ取得・ローディング・エラー処理を含むメインコンポーネント。
 * 班ビュー（14日間表示）を提供する。
 * 展開セルでの現場カード表示・追加・削除機能を統合。
 *
 * ビュー描画は WorkerAssignmentViewDesktop / WorkerAssignmentViewMobile に委譲。
 */
"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { DndContext, DragOverlay, pointerWithin } from "@dnd-kit/core"
import { useWorkerAssignmentDrag } from "@/hooks/use-worker-assignment-drag"
import { useIsMobile } from "@/hooks/use-mobile"
import { WorkerAssignmentHeader, type HeaderStats } from "./WorkerAssignmentHeader"
import { MoveWorkerDialog } from "./MoveWorkerDialog"
import { CopyWorkersDialog, type CopyableWorkerInfo } from "./CopyWorkersDialog"
import { SiteOpsDialog } from "@/components/site-operations/SiteOpsDialog"
import { DragOverlayBar } from "./DragOverlayBar"
import { EMPTY_OVERFLOW, type OverflowData } from "./OverflowIndicator"
import type { ViewMode, TeamData, AssignmentData, ScheduleData, DragItemData, PendingWorkerMove } from "./types"
import { workTypeLabel } from "./types"
import { format, addDays, eachDayOfInterval } from "date-fns"
import { WorkerAssignmentViewDesktop } from "./WorkerAssignmentViewDesktop"
import { WorkerAssignmentViewMobile } from "./WorkerAssignmentViewMobile"
import type { useSensors } from "@dnd-kit/core"

const DEFAULT_displayDays = 7
/** 1日あたりの最小列幅（px）。画面が狭い場合はこの幅を維持して表示日数を減らす */
const MIN_COL_WIDTH = 160
/** 班ビュー左カラム幅 */
const TEAM_LEFT_COL_WIDTH = 160

// ── ドラッグオーバーレイ用（WorkerCard/ForemanCardと同じ見た目） ──

const OVERLAY_CARD_COLORS: Record<string, {
  bg: string; text: string; border: string
}> = {
  EMPLOYEE: { bg: "#16a34a", text: "#ffffff", border: "#15803d" },
  INDEPENDENT: { bg: "#ca8a04", text: "#1a1a1a", border: "#a16207" },
  SUBCONTRACTOR: { bg: "#ffffff", text: "#374151", border: "#d1d5db" },
}

const OVERLAY_FOREMAN_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  EMPLOYEE: { border: "#22c55e", bg: "#f0fdf4", text: "#166534" },
  INDEPENDENT: { border: "#eab308", bg: "#fefce8", text: "#854d0e" },
  SUBCONTRACTOR: { border: "#9ca3af", bg: "#f8fafc", text: "#475569" },
}

/** 四角カードオーバーレイ（一般職人用） */
function WorkerCardOverlay({
  workerName, workerType, isMultiDay,
}: {
  workerName: string; workerType: string; driverLicenseType: string; assignedRole: string; isMultiDay: boolean
}) {
  const colors = OVERLAY_CARD_COLORS[workerType] ?? OVERLAY_CARD_COLORS.SUBCONTRACTOR
  const shortName = workerName.slice(0, 3)

  return (
    <div
      className="inline-flex items-center justify-center rounded-sm border-2 font-extrabold text-[10px] leading-none pointer-events-none min-w-[48px] h-[28px] px-1.5"
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        borderColor: isMultiDay ? "#eab308" : colors.border,
        filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.25))",
      }}
    >
      {shortName}
    </div>
  )
}

/** 横型オーバーレイ（職長用） */
function ForemanCardOverlay({
  workerName, workerType, isMultiDay,
}: {
  workerName: string; workerType: string; isMultiDay: boolean
}) {
  const colors = OVERLAY_FOREMAN_COLORS[workerType] ?? OVERLAY_FOREMAN_COLORS.SUBCONTRACTOR
  const displayName = workerName.slice(0, 4)

  return (
    <div
      className="flex items-center gap-1.5 rounded-sm px-2 py-1.5 w-[160px] h-[32px] pointer-events-none border-2"
      style={{
        backgroundColor: colors.bg,
        borderColor: isMultiDay ? "#eab308" : colors.border,
        filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.25))",
      }}
    >
      <span className="text-xs font-bold leading-none px-1.5 py-0.5 rounded-sm bg-amber-500 text-white flex-shrink-0">職長</span>
      <span className="text-sm font-extrabold leading-none truncate" style={{ color: colors.text }}>{displayName}</span>
    </div>
  )
}

// ─── ViewProps インターフェース ──────────────────────────

export interface WorkerAssignmentViewProps {
  // Stats
  headerStats?: HeaderStats
  selectedDate: string | null
  onSelectDate: (dateKey: string) => void
  // State
  viewMode: ViewMode
  displayDays: number
  rangeStart: Date
  teams: TeamData[]
  assignments: AssignmentData[]
  schedules: ScheduleData[]
  overflow: OverflowData
  effectiveDisplayDays: number
  days: Date[]

  // Computed
  collapsedDates: Set<string>
  datesWithAssignments: Set<string>
  expandedDateKeys: Set<string>
  unassignedSchedules: ScheduleData[]
  unassignedByDate: Map<string, number>

  // Refs
  mainContainerRef: React.RefObject<HTMLDivElement | null>
  barScrollRef: React.MutableRefObject<HTMLDivElement | null>
  tableScrollRef: React.MutableRefObject<HTMLDivElement | null>

  // DnD
  sensors: ReturnType<typeof useSensors>
  activeItem: DragItemData | null
  isDragging: boolean
  hoveredTeamId: string | null
  pendingWorkerMove: PendingWorkerMove | null

  // Handlers
  onViewModeChange: (mode: ViewMode) => void
  onRangeStartChange: (date: Date | ((prev: Date) => Date)) => void
  onDisplayDaysChange: (days: number) => void
  onAddClick: (teamId: string, date: Date) => void
  onDeleteAssignment: (assignmentId: string) => void
  onBulkDeleteTeamSchedule: (assignmentIds: string[]) => void
  onMoveTeamSchedule: (assignmentIds: string[], newTeamId: string) => void
  onRefresh: () => void
  onToggleDate: (dateKey: string) => void
  onAddScheduleClick: () => void
  onCreateSplitTeam: (scheduleId: string, currentTeamId: string, dateKey: string) => void
  onSiteOpsClick: (schedule: ScheduleData) => void
  onTeamColorChange: (teamId: string, color: string) => void

  // Scroll sync
  onBarScroll: () => void
  onTableScroll: () => void

  // DnD handlers
  handleDragStart: (event: import("@dnd-kit/core").DragStartEvent) => void
  handleDragOver: (event: import("@dnd-kit/core").DragOverEvent) => void
  handleDragEnd: (event: import("@dnd-kit/core").DragEndEvent) => void
  handleDragCancel: () => void
  confirmWorkerMove: (moveType: "day-only" | "all") => Promise<void>
  cancelWorkerMove: () => void

  // Dialogs
  dialogOpen: boolean
  dialogTarget: { teamId: string; date: Date } | null
  dialogTeam: TeamData | null
  setDialogOpen: (v: boolean) => void
  onAddAssignment: (scheduleId: string) => Promise<void>
  loadingSchedules: boolean
  scheduleDialogOpen: boolean
  setScheduleDialogOpen: (v: boolean) => void
  scheduleDialogInitialDate: Date | null
  scheduleDialogInitialTeamId: string | null
  handleAddScheduleFromCell: (teamId: string, date: Date) => void
  siteOpsOpen: boolean
  setSiteOpsOpen: (v: boolean) => void
  siteOpsSchedule: ScheduleData | null
  copyDialogState: {
    open: boolean
    targetScheduleId: string
    targetTeamId: string
    targetLabel: string
    dateKey: string
    isMultiDay: boolean
    workers: CopyableWorkerInfo[]
  }
  setCopyDialogState: React.Dispatch<React.SetStateAction<{
    open: boolean
    targetScheduleId: string
    targetTeamId: string
    targetLabel: string
    dateKey: string
    isMultiDay: boolean
    workers: CopyableWorkerInfo[]
  }>>
  onCopyConfirm: (workerIds: string[], assignedDate: string | null) => Promise<void>
  fetchData: (showLoader?: boolean) => Promise<void>
}

export function WorkerAssignmentView() {
  const isMobile = useIsMobile()
  const router = useRouter()
  const [viewMode, setViewModeRaw] = useState<ViewMode>("team")
  const [displayDays, setDisplayDays] = useState(DEFAULT_displayDays)

  // 現場ビューでは1日ビューを無効化（自動で4日に切り替え）
  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeRaw(mode)
    if (mode === "site") {
      setDisplayDays((prev) => (prev === 1 ? 4 : prev))
    }
  }, [])
  const [rangeStart, setRangeStart] = useState<Date>(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [teams, setTeams] = useState<TeamData[]>([])
  const [assignments, setAssignments] = useState<AssignmentData[]>([])
  const [schedules, setSchedules] = useState<ScheduleData[]>([])
  const [overflow, setOverflow] = useState<OverflowData>(EMPTY_OVERFLOW)
  const [loading, setLoading] = useState(true)
  const [loadingSchedules, setLoadingSchedules] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 選択中の日付（サマリーカードの集計対象）
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const handleSelectDate = useCallback((dateKey: string) => {
    setSelectedDate((prev) => prev === dateKey ? null : dateKey)
  }, [])

  // 既存工程選択ダイアログ用の状態
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogTarget, setDialogTarget] = useState<{ teamId: string; date: Date } | null>(null)

  // 職人コピー提案ダイアログ用の状態
  const [copyDialogState, setCopyDialogState] = useState<{
    open: boolean
    targetScheduleId: string
    targetTeamId: string
    targetLabel: string
    dateKey: string
    isMultiDay: boolean
    workers: CopyableWorkerInfo[]
  }>({ open: false, targetScheduleId: "", targetTeamId: "", targetLabel: "", dateKey: "", isMultiDay: false, workers: [] })

  // 新規現場（工事日程）追加ダイアログ用の状態
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const [scheduleDialogInitialDate, setScheduleDialogInitialDate] = useState<Date | null>(null)
  const [scheduleDialogInitialTeamId, setScheduleDialogInitialTeamId] = useState<string | null>(null)

  // FABメニュー
  const [fabOpen, setFabOpen] = useState(false)

  // SiteOps（現場操作）ダイアログ用の状態
  const [siteOpsOpen, setSiteOpsOpen] = useState(false)
  const [siteOpsSchedule, setSiteOpsSchedule] = useState<ScheduleData | null>(null)

  // コンテナ幅を計測して表示日数を自動調整
  const mainContainerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const el = mainContainerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 画面幅に応じて表示可能な最大日数を計算（最小列幅を保証）
  const effectiveDisplayDays = useMemo(() => {
    if (containerWidth <= 0) return displayDays
    const leftCol = viewMode === "team" ? TEAM_LEFT_COL_WIDTH : 0
    const availableWidth = containerWidth - leftCol
    const maxDays = Math.max(1, Math.floor(availableWidth / MIN_COL_WIDTH))
    return Math.min(displayDays, maxDays)
  }, [containerWidth, displayDays, viewMode])

  const rangeEnd = useMemo(() => addDays(rangeStart, effectiveDisplayDays - 1), [rangeStart, effectiveDisplayDays])

  // 親コンテナの max-w-7xl を解除して全幅表示にする
  useEffect(() => {
    const el = document.getElementById("app-content")
    if (el) {
      el.style.maxWidth = "none"
      el.style.paddingLeft = "12px"
      el.style.paddingRight = "12px"
    }
    return () => {
      if (el) {
        el.style.maxWidth = ""
        el.style.paddingLeft = ""
        el.style.paddingRight = ""
      }
    }
  }, [])

  const fetchData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true)
    setError(null)
    try {
      const startDate = format(rangeStart, "yyyy-MM-dd")
      const endDate = format(rangeEnd, "yyyy-MM-dd")

      const [teamsRes, assignmentsRes, schedulesRes] = await Promise.all([
        fetch("/api/teams?isActive=true"),
        fetch(`/api/worker-assignments?startDate=${startDate}&endDate=${endDate}`),
        fetch("/api/schedules"),
      ])

      if (!teamsRes.ok) throw new Error("班データの取得に失敗しました")
      if (!assignmentsRes.ok) throw new Error("人員配置データの取得に失敗しました")

      const [teamsData, assignmentsData, schedulesData] = await Promise.all([
        teamsRes.json(),
        assignmentsRes.json(),
        schedulesRes.ok ? schedulesRes.json() : [],
      ])

      setTeams(teamsData)
      // APIレスポンス: { assignments, overflow }
      if (assignmentsData.assignments && assignmentsData.overflow) {
        setAssignments(assignmentsData.assignments)
        setOverflow(assignmentsData.overflow)
      } else {
        // 後方互換: 配列が直接返ってくる場合
        setAssignments(assignmentsData)
      }
      setSchedules(schedulesData)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "データの取得に失敗しました"
      setError(msg)
      toast.error(msg)
    } finally {
      if (showLoader) setLoading(false)
    }
  }, [rangeStart, rangeEnd])

  // 詳細パネルからのリフレッシュ（ローディング表示なし）
  const refreshData = useCallback(() => {
    fetchData(false)
  }, [fetchData])

  const fetchSchedules = useCallback(async () => {
    setLoadingSchedules(true)
    try {
      const res = await fetch("/api/schedules")
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSchedules(data)
    } catch {
      toast.error("工事日程データの取得に失敗しました")
    } finally {
      setLoadingSchedules(false)
    }
  }, [])

  // rangeStart変更時にデバウンスしてfetch（長押しナビ対策）
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitialLoad = useRef(true)
  useEffect(() => {
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)
    fetchTimerRef.current = setTimeout(() => {
      // 初回のみスケルトン表示、以降はバックグラウンドフェッチ
      const showLoader = isInitialLoad.current
      isInitialLoad.current = false
      fetchData(showLoader)
    }, 300)
    return () => {
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)
    }
  }, [fetchData])

  const handleRangeStartChange = useCallback((dateOrFn: Date | ((prev: Date) => Date)) => {
    setRangeStart((prev) => {
      if (typeof dateOrFn === "function") return dateOrFn(prev)
      return dateOrFn
    })
  }, [])

  // 既存工程選択ダイアログを開く（セルの「+現場を追加」から）
  const handleAddClick = useCallback((teamId: string, date: Date) => {
    setDialogTarget({ teamId, date })
    setDialogOpen(true)
    fetchSchedules()
  }, [fetchSchedules])

  // ヘッダーから新規現場追加ダイアログを開く
  const handleAddScheduleClick = useCallback(() => {
    setScheduleDialogInitialDate(null)
    setScheduleDialogInitialTeamId(null)
    setScheduleDialogOpen(true)
  }, [])

  // セルから新規現場追加ダイアログを開く（日付・班を初期値にセット）
  const handleAddScheduleFromCell = useCallback((teamId: string, date: Date) => {
    setScheduleDialogInitialDate(date)
    setScheduleDialogInitialTeamId(teamId)
    setScheduleDialogOpen(true)
  }, [])

  // SiteOps（現場操作）ダイアログを開く
  const handleSiteOpsClick = useCallback((schedule: ScheduleData) => {
    setSiteOpsSchedule(schedule)
    setSiteOpsOpen(true)
  }, [])

  // 人員配置を追加
  const handleAddAssignment = useCallback(async (scheduleId: string) => {
    if (!dialogTarget) return
    try {
      const res = await fetch("/api/worker-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId,
          teamId: dialogTarget.teamId,
          assignedRole: "WORKER",
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? "追加に失敗しました")
      }
      toast.success("現場を追加しました")

      // ── 同じ班・同じ日の他現場に職人がいれば、コピー提案 ──
      const sameTeamDateWorkers = assignments.filter((a) => {
        if (a.teamId !== dialogTarget.teamId) return false
        if (!a.workerId || !a.worker) return false
        return isDateInScheduleRange(dialogTarget.date, a)
      })
      if (sameTeamDateWorkers.length > 0) {
        // 重複除去してコピー可能リスト作成
        const seen = new Set<string>()
        const copyWorkers: CopyableWorkerInfo[] = []
        for (const a of sameTeamDateWorkers) {
          if (seen.has(a.workerId!)) continue
          seen.add(a.workerId!)
          const sourceSched = a.schedule
          copyWorkers.push({
            workerId: a.workerId!,
            workerName: a.worker!.name,
            workerType: a.worker!.workerType,
            driverLicenseType: a.worker!.driverLicenseType,
            assignedRole: a.assignedRole,
            sourceName: sourceSched.name ?? sourceSched.project.name,
          })
        }
        // 追加先の工程名を取得
        const targetSched = schedules.find((s) => s.id === scheduleId)
        const targetLabel = targetSched?.name ?? targetSched?.project.name ?? "新規現場"
        // 複数日スケジュールかどうか判定
        const targetIsMultiDay = (() => {
          if (!targetSched?.plannedStartDate || !targetSched?.plannedEndDate) return false
          const s = new Date(targetSched.plannedStartDate)
          const e = new Date(targetSched.plannedEndDate)
          s.setHours(0, 0, 0, 0)
          e.setHours(0, 0, 0, 0)
          return e.getTime() > s.getTime()
        })()
        const targetDateKey = format(dialogTarget.date, "yyyy-MM-dd")
        setCopyDialogState({
          open: true,
          targetScheduleId: scheduleId,
          targetTeamId: dialogTarget.teamId,
          targetLabel,
          dateKey: targetDateKey,
          isMultiDay: targetIsMultiDay,
          workers: copyWorkers,
        })
      }

      fetchData()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "追加に失敗しました"
      toast.error(msg)
      throw err
    }
  }, [dialogTarget, fetchData, assignments, schedules])

  // 班分割（上限到達時に空き班に同じ現場を追加）
  const handleCreateSplitTeam = useCallback(async (scheduleId: string, currentTeamId: string, dateKey: string) => {
    // この現場を既に持っている班を検出
    const usedTeamIds = new Set(
      assignments
        .filter((a) => a.scheduleId === scheduleId)
        .map((a) => a.teamId)
    )
    // 使われていないアクティブな班を探す
    const availableTeam = teams.find((t) => !usedTeamIds.has(t.id) && t.isActive)

    if (!availableTeam) {
      toast.error("空いている班がありません。先に新しい班を作成してください。")
      return
    }

    const ok = window.confirm(
      `「${availableTeam.name}」にこの現場を追加し、職人を配置しますか？`
    )
    if (!ok) return

    try {
      const res = await fetch("/api/worker-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId,
          teamId: availableTeam.id,
          assignedRole: "WORKER",
        }),
      })
      if (!res.ok) throw new Error()
      toast.success(`「${availableTeam.name}」に現場を追加しました。職人を追加してください。`)
      refreshData()
    } catch {
      toast.error("班への追加に失敗しました")
    }
  }, [assignments, teams, refreshData])

  // 人員配置を削除
  const handleDeleteAssignment = useCallback(async (assignmentId: string) => {
    try {
      const res = await fetch(`/api/worker-assignments/${assignmentId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error()
      toast.success("配置を削除しました")
      fetchData()
    } catch {
      toast.error("削除に失敗しました")
    }
  }, [fetchData])

  // 班×現場の全配置を一括削除
  const handleBulkDeleteTeamSchedule = useCallback(async (assignmentIds: string[]) => {
    try {
      await Promise.all(
        assignmentIds.map((id) =>
          fetch(`/api/worker-assignments/${id}`, { method: "DELETE" })
        )
      )
      toast.success("配置を削除しました")
      fetchData()
    } catch {
      toast.error("削除に失敗しました")
    }
  }, [fetchData])

  // 班×現場の全配置を別の班に移動
  const handleMoveTeamSchedule = useCallback(async (assignmentIds: string[], newTeamId: string) => {
    try {
      await Promise.all(
        assignmentIds.map((id) =>
          fetch(`/api/worker-assignments/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ teamId: newTeamId }),
          })
        )
      )
      const newTeam = teams.find((t) => t.id === newTeamId)
      toast.success(`「${newTeam?.name ?? "別の班"}」に移動しました`)
      fetchData()
    } catch {
      toast.error("移動に失敗しました")
    }
  }, [fetchData, teams])

  // 班の色を変更
  const handleTeamColorChange = useCallback(async (teamId: string, color: string) => {
    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colorCode: color }),
      })
      if (!res.ok) throw new Error()
      fetchData()
    } catch {
      toast.error("色の変更に失敗しました")
    }
  }, [fetchData])

  // ── 日付列の展開・折りたたみ（テーブルとバーで共有） ──
  // 日付の折りたたみは無効化（常に全展開）
  const [collapsedDates] = useState<Set<string>>(new Set())

  /** 配置後に該当日付を自動展開するコールバック（折りたたみ無効化済み） */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const expandDates = useCallback((_dateKeys: string[]) => {}, [])

  // DnD フック
  const {
    sensors,
    activeItem,
    isDragging,
    hoveredTeamId,
    pendingWorkerMove,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    confirmWorkerMove,
    cancelWorkerMove,
  } = useWorkerAssignmentDrag(refreshData, expandDates)

  const days = useMemo(
    () => eachDayOfInterval({ start: rangeStart, end: addDays(rangeStart, effectiveDisplayDays - 1) }),
    [rangeStart, effectiveDisplayDays]
  )

  /** 指定日にアサインが存在するか判定 */
  function isDateInScheduleRange(date: Date, assignment: AssignmentData): boolean {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    if (assignment.assignedDate) {
      const ad = new Date(assignment.assignedDate)
      ad.setHours(0, 0, 0, 0)
      return d.getTime() === ad.getTime()
    }
    const start = assignment.schedule.plannedStartDate
      ? new Date(assignment.schedule.plannedStartDate)
      : null
    const end = assignment.schedule.plannedEndDate
      ? new Date(assignment.schedule.plannedEndDate)
      : null
    if (!start) return false
    const endDate = end ?? start
    const s = new Date(start); s.setHours(0, 0, 0, 0)
    const e = new Date(endDate); e.setHours(0, 0, 0, 0)
    if (d < s || d > e) return false
    if (assignment.excludedDates?.length) {
      for (const excl of assignment.excludedDates) {
        const ed = new Date(excl); ed.setHours(0, 0, 0, 0)
        if (d.getTime() === ed.getTime()) return false
      }
    }
    return true
  }

  const datesWithAssignments = useMemo(() => {
    const set = new Set<string>()
    for (const day of days) {
      const dateKey = format(day, "yyyy-MM-dd")
      if (assignments.some((a) => isDateInScheduleRange(day, a))) {
        set.add(dateKey)
      }
    }
    return set
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, assignments])

  // 日付の折りたたみは無効化済み（全日付を常に展開表示）

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const toggleDate = useCallback((_dateKey: string) => {}, [])

  /** 展開中の日付キー（datesWithAssignments に含まれ、かつ折りたたまれていない） */
  const expandedDateKeys = useMemo(() => {
    const set = new Set<string>()
    for (const dk of datesWithAssignments) {
      if (!collapsedDates.has(dk)) set.add(dk)
    }
    return set
  }, [datesWithAssignments, collapsedDates])

  // ── 横スクロール連動 ──
  const barScrollRef = useRef<HTMLDivElement | null>(null)
  const tableScrollRef = useRef<HTMLDivElement | null>(null)
  const isSyncing = useRef(false)

  const handleBarScroll = useCallback(() => {
    if (isSyncing.current) return
    isSyncing.current = true
    if (barScrollRef.current && tableScrollRef.current) {
      tableScrollRef.current.scrollLeft = barScrollRef.current.scrollLeft
    }
    isSyncing.current = false
  }, [])

  const handleTableScroll = useCallback(() => {
    if (isSyncing.current) return
    isSyncing.current = true
    if (tableScrollRef.current && barScrollRef.current) {
      barScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft
    }
    isSyncing.current = false
  }, [])

  // 未配置の工程（WorkerAssignment が 0 件）
  const unassignedSchedules = useMemo(
    () => schedules.filter((s) => s._count?.workerAssignments === 0),
    [schedules]
  )

  // 日付ごとの未配置工程数（日付ヘッダー表示用）
  // NOTE: DB日付はUTC文字列なので、文字列スライスで比較する（TZ変換によるズレ防止）
  const unassignedByDate = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of unassignedSchedules) {
      if (!s.plannedStartDate) continue
      const startStr = typeof s.plannedStartDate === "string"
        ? s.plannedStartDate.slice(0, 10)
        : new Date(s.plannedStartDate).toISOString().slice(0, 10)
      const endStr = s.plannedEndDate
        ? (typeof s.plannedEndDate === "string"
            ? s.plannedEndDate.slice(0, 10)
            : new Date(s.plannedEndDate).toISOString().slice(0, 10))
        : startStr
      // YYYY-MM-DD 文字列で日付をインクリメント
      const d = new Date(startStr + "T00:00:00Z")
      const endD = new Date(endStr + "T00:00:00Z")
      while (d <= endD) {
        const key = d.toISOString().slice(0, 10)
        map.set(key, (map.get(key) ?? 0) + 1)
        d.setUTCDate(d.getUTCDate() + 1)
      }
    }
    return map
  }, [unassignedSchedules])

  // ── サマリー統計（選択日 or 全日付範囲で計算） ──
  const headerStats = useMemo<HeaderStats>(() => {
    const activeTeamIds = new Set<string>()
    const assignedWorkerIds = new Set<string>()
    const activeSiteIds = new Set<string>()

    // 全職人ID（日付範囲問わず、全アサインメントから取得）
    const allWorkerIds = new Set<string>()
    for (const a of assignments) {
      if (a.workerId) allWorkerIds.add(a.workerId)
    }

    // 選択日がある場合はその1日、ない場合は全日付範囲
    const targetDays = selectedDate
      ? [new Date(selectedDate + "T00:00:00")]
      : days

    for (const a of assignments) {
      const hasDateInRange = targetDays.some((day) => isDateInScheduleRange(day, a))
      if (!hasDateInRange) continue

      activeTeamIds.add(a.teamId)
      if (a.workerId) assignedWorkerIds.add(a.workerId)
      activeSiteIds.add(a.scheduleId)
    }

    const totalWorkers = allWorkerIds.size
    const assigned = assignedWorkerIds.size
    const unassigned = Math.max(0, totalWorkers - assigned)

    return {
      activeTeams: activeTeamIds.size,
      totalWorkers,
      assignedWorkers: assigned,
      unassignedWorkers: unassigned,
      activeSites: activeSiteIds.size,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments, days, selectedDate])

  const dialogTeam = dialogTarget
    ? teams.find((t) => t.id === dialogTarget.teamId) ?? null
    : null

  // ── コピー確定ハンドラ ──
  const handleCopyConfirm = useCallback(async (workerIds: string[], assignedDate: string | null) => {
    const res = await fetch("/api/worker-assignments/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduleId: copyDialogState.targetScheduleId,
        teamId: copyDialogState.targetTeamId,
        workerIds,
        assignedDate,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      throw new Error(data?.error ?? "コピーに失敗しました")
    }
    toast.success(`${workerIds.length}名の職人をコピーしました`)
    refreshData()
  }, [copyDialogState.targetScheduleId, copyDialogState.targetTeamId, refreshData])

  // ── ViewProps 構築 ──
  const viewProps: WorkerAssignmentViewProps = {
    // Stats
    headerStats,
    selectedDate,
    onSelectDate: handleSelectDate,
    // State
    viewMode,
    displayDays,
    rangeStart,
    teams,
    assignments,
    schedules,
    overflow,
    effectiveDisplayDays,
    days,

    // Computed
    collapsedDates,
    datesWithAssignments,
    expandedDateKeys,
    unassignedSchedules,
    unassignedByDate,

    // Refs
    mainContainerRef,
    barScrollRef,
    tableScrollRef,

    // DnD
    sensors,
    activeItem,
    isDragging,
    hoveredTeamId,
    pendingWorkerMove,

    // Handlers
    onViewModeChange: setViewMode,
    onRangeStartChange: handleRangeStartChange,
    onDisplayDaysChange: setDisplayDays,
    onAddClick: handleAddClick,
    onDeleteAssignment: handleDeleteAssignment,
    onBulkDeleteTeamSchedule: handleBulkDeleteTeamSchedule,
    onMoveTeamSchedule: handleMoveTeamSchedule,
    onRefresh: refreshData,
    onToggleDate: toggleDate,
    onAddScheduleClick: handleAddScheduleClick,
    onCreateSplitTeam: handleCreateSplitTeam,
    onSiteOpsClick: handleSiteOpsClick,
    onTeamColorChange: handleTeamColorChange,

    // Scroll sync
    onBarScroll: handleBarScroll,
    onTableScroll: handleTableScroll,

    // DnD handlers
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    confirmWorkerMove,
    cancelWorkerMove,

    // Dialogs
    dialogOpen,
    dialogTarget,
    dialogTeam,
    setDialogOpen,
    onAddAssignment: handleAddAssignment,
    loadingSchedules,
    scheduleDialogOpen,
    setScheduleDialogOpen,
    scheduleDialogInitialDate,
    scheduleDialogInitialTeamId,
    handleAddScheduleFromCell,
    siteOpsOpen,
    setSiteOpsOpen,
    siteOpsSchedule,
    copyDialogState,
    setCopyDialogState,
    onCopyConfirm: handleCopyConfirm,
    fetchData,
  }

  // ── Loading / Error は共有（DnD 不要） ──

  if (loading) {
    return (
      <div className="space-y-4">
        <WorkerAssignmentHeader
          viewMode={viewMode}
          rangeStart={rangeStart}
          displayDays={displayDays}
          onViewModeChange={setViewMode}
          onRangeStartChange={handleRangeStartChange}
          onDisplayDaysChange={setDisplayDays}
          onAddScheduleClick={handleAddScheduleClick}
          stats={headerStats}
        />
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            {/* ヘッダーSkeleton */}
            <div className="flex border-b border-slate-200">
              <div className="flex-shrink-0 px-3 py-3" style={{ width: 200 }}>
                <Skeleton className="h-4 w-20" />
              </div>
              {Array.from({ length: displayDays }).map((_, i) => (
                <div key={i} className="flex-1 min-w-[80px] px-2 py-2">
                  <Skeleton className="h-3 w-8 mx-auto mb-1" />
                  <Skeleton className="h-4 w-4 mx-auto" />
                </div>
              ))}
            </div>
            {/* 行Skeleton */}
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex border-b border-slate-100">
                <div className="flex-shrink-0 px-3 py-3" style={{ width: 200 }}>
                  <Skeleton className="h-4 w-28 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
                {Array.from({ length: displayDays }).map((_, j) => (
                  <div key={j} className="flex-1 min-w-[80px] px-2 py-3">
                    <Skeleton className="h-6 w-full rounded" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <WorkerAssignmentHeader
          viewMode={viewMode}
          rangeStart={rangeStart}
          displayDays={displayDays}
          onViewModeChange={setViewMode}
          onRangeStartChange={handleRangeStartChange}
          onDisplayDaysChange={setDisplayDays}
          onAddScheduleClick={handleAddScheduleClick}
          stats={headerStats}
        />
        <div className="flex items-center justify-center py-20 bg-white border rounded-xl">
          <div className="flex flex-col items-center gap-2 text-red-500">
            <AlertCircle className="w-6 h-6" />
            <span className="text-sm">{error}</span>
            <button
              onClick={() => fetchData()}
              className="text-xs text-blue-600 hover:underline mt-1"
            >
              再試行
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      autoScroll={{
        threshold: { x: 0.15, y: 0.15 },
        acceleration: 8,
        interval: 5,
      }}
    >
      {isMobile ? (
        <WorkerAssignmentViewMobile {...viewProps} />
      ) : (
        <WorkerAssignmentViewDesktop {...viewProps} />
      )}

      {/* DragOverlay: ドラッグ中にカーソルに追従する要素 */}
      <DragOverlay dropAnimation={null} style={{ willChange: "transform" }}>
        {activeItem?.type === "site-card" && (
          <DragOverlayBar
            label={activeItem.scheduleName || activeItem.projectName}
            workType={workTypeLabel(activeItem.workType)}
            formattedDateRange={activeItem.formattedDateRange}
            color={activeItem.teamColor}
            plannedStartDate={activeItem.plannedStartDate}
            plannedEndDate={activeItem.plannedEndDate}
            rangeStart={rangeStart}
            displayDays={effectiveDisplayDays}
            expandedDateKeys={expandedDateKeys}
            grabDateKey={activeItem.dateKey}
          />
        )}
        {activeItem?.type === "worker-card" && (
          activeItem.assignedRole === "FOREMAN" ? (
            <ForemanCardOverlay
              workerName={activeItem.workerName}
              workerType={activeItem.workerType}
              isMultiDay={activeItem.isMultiDay}
            />
          ) : (
            <WorkerCardOverlay
              workerName={activeItem.workerName}
              workerType={activeItem.workerType}
              driverLicenseType={activeItem.driverLicenseType}
              assignedRole={activeItem.assignedRole}
              isMultiDay={activeItem.isMultiDay}
            />
          )
        )}
        {activeItem?.type === "unassigned-bar" && (
          <DragOverlayBar
            label={activeItem.scheduleName || activeItem.projectName}
            workType={workTypeLabel(activeItem.workType)}
            formattedDateRange={activeItem.formattedDateRange}
            color={activeItem.barColor}
            plannedStartDate={activeItem.plannedStartDate}
            plannedEndDate={activeItem.plannedEndDate}
            rangeStart={rangeStart}
            displayDays={effectiveDisplayDays}
            expandedDateKeys={expandedDateKeys}
          />
        )}
      </DragOverlay>

      {/* 職人移動ダイアログ */}
      <MoveWorkerDialog
        move={pendingWorkerMove}
        onConfirm={confirmWorkerMove}
        onCancel={cancelWorkerMove}
      />

      {/* 職人コピー提案ダイアログ（現場追加後の自動提案） */}
      <CopyWorkersDialog
        open={copyDialogState.open}
        onClose={() => setCopyDialogState((prev) => ({ ...prev, open: false }))}
        onConfirm={handleCopyConfirm}
        workers={copyDialogState.workers}
        targetLabel={copyDialogState.targetLabel}
        dateKey={copyDialogState.dateKey}
        isMultiDay={copyDialogState.isMultiDay}
      />

      {/* SiteOps-01: 現場操作ダイアログ */}
      <SiteOpsDialog
        open={siteOpsOpen}
        onClose={() => setSiteOpsOpen(false)}
        schedule={siteOpsSchedule}
        onUpdated={refreshData}
      />

      {/* 新規作成フローティングボタン */}
      <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-2 relative">
        <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">WA-6</span>
        {fabOpen && (
          <>
            <button
              onClick={() => { setFabOpen(false); router.push("/estimates/new") }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg text-sm font-medium transition-all active:scale-95"
            >
              見積から作成（見積→工事日程）
            </button>
            <button
              onClick={() => { setFabOpen(false); handleAddScheduleClick() }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-lg text-sm font-medium transition-all active:scale-95"
            >
              工事日程のみ追加
            </button>
          </>
        )}
        <button
          onClick={() => setFabOpen(!fabOpen)}
          className={cn(
            "w-16 h-16 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center active:scale-95",
            fabOpen && "bg-slate-600 hover:bg-slate-700"
          )}
          title="新規作成"
        >
          <Plus className={cn("w-8 h-8 transition-transform duration-200", fabOpen && "rotate-45")} />
        </button>
      </div>
      {fabOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setFabOpen(false)} />
      )}
    </DndContext>
  )
}

/**
 * [COMPONENT] 人員配置管理 - メインビュー
 *
 * データ取得・ローディング・エラー処理を含むメインコンポーネント。
 * 班ビュー（14日間表示）を提供する。
 * 展開セルでの現場カード表示・追加・削除機能を統合。
 */
"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { AlertCircle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { DndContext, DragOverlay, pointerWithin } from "@dnd-kit/core"
import { useWorkerAssignmentDrag } from "@/hooks/use-worker-assignment-drag"
import { WorkerAssignmentHeader } from "./WorkerAssignmentHeader"
import { WorkerAssignmentTable } from "./WorkerAssignmentTable"
import { SiteViewTable } from "./SiteViewTable"
import { AddAssignmentDialog } from "./AddAssignmentDialog"
import { AddScheduleDialog } from "./AddScheduleDialog"
import { UnassignedSchedulesBar } from "./UnassignedSchedulesBar"
import { MoveWorkerDialog } from "./MoveWorkerDialog"
import { CopyWorkersDialog, type CopyableWorkerInfo } from "./CopyWorkersDialog"
import { DragOverlayBar } from "./DragOverlayBar"
import type { ViewMode, TeamData, AssignmentData, ScheduleData } from "./types"
import { format, addDays, eachDayOfInterval } from "date-fns"

const DISPLAY_DAYS = 14

// ── ドラッグオーバーレイ用（WorkerCard/ForemanCardと同じ見た目） ──

const OVERLAY_HELMET_COLORS: Record<string, {
  bg: string; text: string; brim: string; border: string
}> = {
  EMPLOYEE: { bg: "#16a34a", text: "#ffffff", brim: "#16a34a", border: "none" },
  INDEPENDENT: { bg: "#ca8a04", text: "#1a1a1a", brim: "#ca8a04", border: "none" },
  SUBCONTRACTOR: { bg: "#ffffff", text: "#374151", brim: "#9ca3af", border: "1.5px solid #d1d5db" },
}

const OVERLAY_FOREMAN_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  EMPLOYEE: { border: "#22c55e", bg: "#f0fdf4", text: "#166534" },
  INDEPENDENT: { border: "#eab308", bg: "#fefce8", text: "#854d0e" },
  SUBCONTRACTOR: { border: "#9ca3af", bg: "#f8fafc", text: "#475569" },
}

/** ヘルメット型オーバーレイ（一般職人用） */
function WorkerCardOverlay({
  workerName, workerType, isMultiDay,
}: {
  workerName: string; workerType: string; driverLicenseType: string; assignedRole: string; isMultiDay: boolean
}) {
  const colors = OVERLAY_HELMET_COLORS[workerType] ?? OVERLAY_HELMET_COLORS.SUBCONTRACTOR
  const shortName = workerName.slice(0, 3)

  return (
    <div className="relative inline-flex flex-col items-center pointer-events-none" style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.25))" }}>
      {/* ヘルメット本体 */}
      <div
        className="w-[52px] h-[30px] rounded-t-lg rounded-b-none flex items-center justify-center text-[11px] font-bold leading-none"
        style={{
          backgroundColor: colors.bg, color: colors.text,
          borderTop: isMultiDay ? "2.5px solid #eab308" : colors.border,
          borderLeft: isMultiDay ? "2.5px solid #eab308" : colors.border,
          borderRight: isMultiDay ? "2.5px solid #eab308" : colors.border,
          borderBottom: "none",
        }}
      >
        {shortName}
      </div>

      {/* つば */}
      <div
        className="w-[56px] h-[3px] rounded-sm"
        style={{ backgroundColor: isMultiDay ? "#eab308" : colors.brim }}
      />
    </div>
  )
}

/** 長方形オーバーレイ（職長用） */
function ForemanCardOverlay({
  workerName, workerType, isMultiDay,
}: {
  workerName: string; workerType: string; isMultiDay: boolean
}) {
  const colors = OVERLAY_FOREMAN_COLORS[workerType] ?? OVERLAY_FOREMAN_COLORS.SUBCONTRACTOR
  const displayName = workerName.slice(0, 4)

  return (
    <div
      className="flex flex-col justify-center rounded-lg px-2 py-1 w-[80px] h-[44px] pointer-events-none"
      style={{
        backgroundColor: colors.bg,
        borderLeft: `4px solid ${colors.border}`,
        borderTop: isMultiDay ? "2.5px solid #eab308" : `1px solid ${colors.border}40`,
        borderRight: isMultiDay ? "2.5px solid #eab308" : `1px solid ${colors.border}40`,
        borderBottom: isMultiDay ? "2.5px solid #eab308" : `1px solid ${colors.border}40`,
        filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.25))",
      }}
    >
      <span className="text-[11px] font-bold leading-tight truncate" style={{ color: colors.text }}>{displayName}</span>
      <span className="text-[9px] font-semibold leading-tight text-amber-600">職長</span>
    </div>
  )
}

export function WorkerAssignmentView() {
  const [viewMode, setViewMode] = useState<ViewMode>("team")
  const [rangeStart, setRangeStart] = useState<Date>(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [teams, setTeams] = useState<TeamData[]>([])
  const [assignments, setAssignments] = useState<AssignmentData[]>([])
  const [schedules, setSchedules] = useState<ScheduleData[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingSchedules, setLoadingSchedules] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  // 新規現場（工程）追加ダイアログ用の状態
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const [scheduleDialogInitialDate, setScheduleDialogInitialDate] = useState<Date | null>(null)
  const [scheduleDialogInitialTeamId, setScheduleDialogInitialTeamId] = useState<string | null>(null)

  const rangeEnd = useMemo(() => addDays(rangeStart, DISPLAY_DAYS - 1), [rangeStart])

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
      setAssignments(assignmentsData)
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
      toast.error("工程データの取得に失敗しました")
    } finally {
      setLoadingSchedules(false)
    }
  }, [])

  // rangeStart変更時にデバウンスしてfetch（長押しナビ対策）
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    // 初回は即時、以降は300msデバウンス
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)
    fetchTimerRef.current = setTimeout(() => {
      fetchData()
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
            sourceName: sourceSched.name ?? sourceSched.contract.project.name,
          })
        }
        // 追加先の工程名を取得
        const targetSched = schedules.find((s) => s.id === scheduleId)
        const targetLabel = targetSched?.name ?? targetSched?.contract.project.name ?? "新規現場"
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

  // ── 日付列の展開・折りたたみ（テーブルとバーで共有） ──
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set())

  /** 配置後に該当日付を自動展開するコールバック */
  const expandDates = useCallback((dateKeys: string[]) => {
    setCollapsedDates((prev) => {
      const next = new Set(prev)
      for (const dk of dateKeys) next.delete(dk)
      return next
    })
  }, [])

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
    () => eachDayOfInterval({ start: rangeStart, end: addDays(rangeStart, DISPLAY_DAYS - 1) }),
    [rangeStart]
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

  const toggleDate = useCallback(
    (dateKey: string) => {
      if (isDragging) return
      setCollapsedDates((prev) => {
        const next = new Set(prev)
        if (next.has(dateKey)) next.delete(dateKey)
        else next.add(dateKey)
        return next
      })
    },
    [isDragging]
  )

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

  const dialogTeam = dialogTarget
    ? teams.find((t) => t.id === dialogTarget.teamId) ?? null
    : null

  if (loading) {
    return (
      <div className="space-y-4">
        <WorkerAssignmentHeader
          viewMode={viewMode}
          rangeStart={rangeStart}
          displayDays={DISPLAY_DAYS}
          onViewModeChange={setViewMode}
          onRangeStartChange={handleRangeStartChange}
          onAddScheduleClick={handleAddScheduleClick}
        />
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            {/* ヘッダーSkeleton */}
            <div className="flex border-b border-slate-200">
              <div className="flex-shrink-0 px-3 py-3" style={{ width: 200 }}>
                <Skeleton className="h-4 w-20" />
              </div>
              {Array.from({ length: 7 }).map((_, i) => (
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
                {Array.from({ length: 7 }).map((_, j) => (
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
          displayDays={DISPLAY_DAYS}
          onViewModeChange={setViewMode}
          onRangeStartChange={handleRangeStartChange}
          onAddScheduleClick={handleAddScheduleClick}
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
      <div className="space-y-4">
        <WorkerAssignmentHeader
          viewMode={viewMode}
          rangeStart={rangeStart}
          displayDays={DISPLAY_DAYS}
          onViewModeChange={setViewMode}
          onRangeStartChange={handleRangeStartChange}
          onAddScheduleClick={handleAddScheduleClick}
        />

        {/* 未配置工程バー */}
        <UnassignedSchedulesBar
          schedules={unassignedSchedules}
          rangeStart={rangeStart}
          displayDays={DISPLAY_DAYS}
          expandedDateKeys={expandedDateKeys}
          leftColWidth={viewMode === "site" ? 220 : 160}
          scrollRef={barScrollRef}
          onScroll={handleBarScroll}
        />

        {viewMode === "team" && (
          <WorkerAssignmentTable
            teams={teams}
            assignments={assignments}
            rangeStart={rangeStart}
            displayDays={DISPLAY_DAYS}
            onAddClick={handleAddClick}
            onDeleteAssignment={handleDeleteAssignment}
            onRefresh={refreshData}
            activeItem={activeItem}
            isDragging={isDragging}
            hoveredTeamId={hoveredTeamId}
            collapsedDates={collapsedDates}
            datesWithAssignments={datesWithAssignments}
            onToggleDate={toggleDate}
            scrollRef={tableScrollRef}
            onScroll={handleTableScroll}
          />
        )}

        {viewMode === "site" && (
          <SiteViewTable
            teams={teams}
            assignments={assignments}
            rangeStart={rangeStart}
            displayDays={DISPLAY_DAYS}
            onDeleteAssignment={handleDeleteAssignment}
            onRefresh={refreshData}
            activeItem={activeItem}
            isDragging={isDragging}
            hoveredTeamId={hoveredTeamId}
            collapsedDates={collapsedDates}
            datesWithAssignments={datesWithAssignments}
            onToggleDate={toggleDate}
            scrollRef={tableScrollRef}
            onScroll={handleTableScroll}
          />
        )}

        {/* フッター情報 */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span className="font-medium">凡例:</span>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded bg-blue-50 border border-blue-200" />
              <span>今日</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded bg-slate-50 border border-slate-200" />
              <span>土日</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded bg-blue-100 border border-blue-200" />
              <span>展開中</span>
            </div>
          </div>
          <span>{teams.length} 班 ・ {assignments.length} 件の配置</span>
        </div>

        {/* 既存工程選択ダイアログ */}
        {dialogTarget && dialogTeam && (
          <AddAssignmentDialog
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            onSubmit={handleAddAssignment}
            targetDate={dialogTarget.date}
            targetTeam={dialogTeam}
            schedules={schedules}
            loadingSchedules={loadingSchedules}
            onNewScheduleClick={() => {
              setDialogOpen(false)
              handleAddScheduleFromCell(dialogTarget.teamId, dialogTarget.date)
            }}
          />
        )}

        {/* 新規現場（工程）追加ダイアログ */}
        <AddScheduleDialog
          open={scheduleDialogOpen}
          onClose={() => setScheduleDialogOpen(false)}
          onComplete={() => fetchData()}
          teams={teams}
          initialDate={scheduleDialogInitialDate}
          initialTeamId={scheduleDialogInitialTeamId}
        />
      </div>

      {/* DragOverlay: ドラッグ中にカーソルに追従する要素 */}
      <DragOverlay dropAnimation={null} style={{ willChange: "transform" }}>
        {activeItem?.type === "site-card" && (
          <DragOverlayBar
            label={activeItem.scheduleName || activeItem.projectName}
            workType={activeItem.workType}
            formattedDateRange={activeItem.formattedDateRange}
            color={activeItem.teamColor}
            plannedStartDate={activeItem.plannedStartDate}
            plannedEndDate={activeItem.plannedEndDate}
            rangeStart={rangeStart}
            displayDays={DISPLAY_DAYS}
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
            workType={activeItem.workType}
            formattedDateRange={activeItem.formattedDateRange}
            color={activeItem.barColor}
            plannedStartDate={activeItem.plannedStartDate}
            plannedEndDate={activeItem.plannedEndDate}
            rangeStart={rangeStart}
            displayDays={DISPLAY_DAYS}
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
        onConfirm={async (workerIds, assignedDate) => {
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
        }}
        workers={copyDialogState.workers}
        targetLabel={copyDialogState.targetLabel}
        dateKey={copyDialogState.dateKey}
        isMultiDay={copyDialogState.isMultiDay}
      />
    </DndContext>
  )
}

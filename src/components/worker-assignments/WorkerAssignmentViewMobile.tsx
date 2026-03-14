/**
 * [COMPONENT] 人員配置管理 - モバイルビュー
 *
 * WorkerAssignmentView.tsx から分離されたモバイル専用の表示コンポーネント。
 * 全ての状態管理・ロジックは WorkerAssignmentView.tsx に残り、props 経由で受け取る。
 *
 * 特徴:
 * - 1日表示（翌日の配置がメインユースケース）
 * - 横スワイプで日送り
 * - チーム→現場→作業員 の縦リスト型レイアウト
 * - タッチしやすい大きめのUI
 */
"use client"

import { useRef, useCallback, useMemo, useState } from "react"
import { format, isToday, isTomorrow, isWeekend, addDays, parse } from "date-fns"
import { ja } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Plus, Users, Truck, MapPin, Wrench, X, ArrowRight, UserPlus, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { WorkerAssignmentViewProps } from "./WorkerAssignmentView"
import type { AssignmentData, ScheduleData, TeamData, WorkerData, VehicleData, WorkerBusyInfo } from "./types"
import { workTypeLabel, workTypeColor } from "./types"
import { AddAssignmentDialog } from "./AddAssignmentDialog"
import { AddScheduleDialog } from "./AddScheduleDialog"
import { AddWorkerDialog } from "./AddWorkerDialog"
import { AddVehicleDialog } from "./AddVehicleDialog"

/** タップ選択中の職人情報 */
interface SelectedWorker {
  assignmentId: string
  workerName: string
  teamId: string
  scheduleId: string
  isMultiDay: boolean
}

// ── ヘルパー ──────────────────────────────────────────

/** 指定日にアサインが存在するか */
function isDateInRange(date: Date, a: AssignmentData): boolean {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  if (a.assignedDate) {
    const ad = new Date(a.assignedDate)
    ad.setHours(0, 0, 0, 0)
    return d.getTime() === ad.getTime()
  }
  const start = a.schedule.plannedStartDate ? new Date(a.schedule.plannedStartDate) : null
  const end = a.schedule.plannedEndDate ? new Date(a.schedule.plannedEndDate) : null
  if (!start) return false
  const endDate = end ?? start
  const s = new Date(start); s.setHours(0, 0, 0, 0)
  const e = new Date(endDate); e.setHours(0, 0, 0, 0)
  if (d < s || d > e) return false
  if (a.excludedDates?.length) {
    for (const excl of a.excludedDates) {
      const ed = new Date(excl); ed.setHours(0, 0, 0, 0)
      if (d.getTime() === ed.getTime()) return false
    }
  }
  return true
}

/** 日付のラベル（「今日」「明日」付き） */
function dateLabel(date: Date): string {
  const dayStr = format(date, "M月d日(E)", { locale: ja })
  if (isToday(date)) return `${dayStr} 今日`
  if (isTomorrow(date)) return `${dayStr} 明日`
  return dayStr
}

// ── ヘルメットカラー（WorkerCard と同じ） ──────────────

const HELMET_COLORS: Record<string, { bg: string; text: string }> = {
  EMPLOYEE:      { bg: "#16a34a", text: "#ffffff" },
  INDEPENDENT:   { bg: "#ca8a04", text: "#1a1a1a" },
  SUBCONTRACTOR: { bg: "#ffffff", text: "#374151" },
}

// ── コンポーネント ────────────────────────────────────

export function WorkerAssignmentViewMobile(props: WorkerAssignmentViewProps) {
  const {
    rangeStart,
    teams,
    assignments,
    onRangeStartChange,
    onAddClick,
    onDeleteAssignment,
    onAddScheduleClick,
    onSiteOpsClick,
    onRefresh,
    // DnD (for move)
    confirmWorkerMove,
    cancelWorkerMove,
    pendingWorkerMove,
    // Dialogs
    dialogOpen,
    dialogTarget,
    dialogTeam,
    setDialogOpen,
    onAddAssignment,
    loadingSchedules,
    schedules,
    scheduleDialogOpen,
    setScheduleDialogOpen,
    scheduleDialogInitialDate,
    scheduleDialogInitialTeamId,
    handleAddScheduleFromCell,
    headerStats,
  } = props

  // タップ配置: 選択中の職人
  const [selectedWorker, setSelectedWorker] = useState<SelectedWorker | null>(null)

  // 職人をタップで選択
  const handleSelectWorker = useCallback((worker: SelectedWorker) => {
    setSelectedWorker((prev) => {
      // 同じ職人をもう一度タップ → 選択解除
      if (prev?.assignmentId === worker.assignmentId) return null
      return worker
    })
  }, [])

  // 移動先の現場をタップ
  const handleTapDestination = useCallback(async (targetTeamId: string, targetScheduleId: string) => {
    if (!selectedWorker) return
    // 同じ場所なら無視
    if (selectedWorker.teamId === targetTeamId && selectedWorker.scheduleId === targetScheduleId) {
      toast.info("同じ現場です")
      return
    }

    const dateKey = format(rangeStart, "yyyy-MM-dd")

    // 移動実行（MoveWorkerDialog経由）
    // pendingWorkerMove を使って既存のダイアログフローに乗せる
    // use-worker-assignment-drag の setPendingWorkerMove に相当する処理
    // 直接 API コール（単日移動の場合）
    if (!selectedWorker.isMultiDay) {
      try {
        const res = await fetch("/api/worker-assignments/move-worker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignmentId: selectedWorker.assignmentId,
            targetTeamId,
            targetScheduleId,
            moveDate: dateKey,
            moveType: "all",
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => null)
          if (data?.code === "WORKER_LIMIT_EXCEEDED") {
            toast.error("移動先の上限（9名）に達しています")
          } else {
            toast.error(data?.error ?? "移動に失敗しました")
          }
          setSelectedWorker(null)
          return
        }
        toast.success(`${selectedWorker.workerName}を移動しました`)
        setSelectedWorker(null)
        onRefresh()
      } catch {
        toast.error("移動に失敗しました")
        setSelectedWorker(null)
        onRefresh()
      }
    } else {
      // 複数日の場合: 「この日だけ/全日程」選択が必要
      // MoveWorkerDialog を直接表示させるため、手動で state 設定は不可能（親のhookが管理）
      // → 直接API呼び出しでシンプルに「この日だけ移動」
      try {
        const res = await fetch("/api/worker-assignments/move-worker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignmentId: selectedWorker.assignmentId,
            targetTeamId,
            targetScheduleId,
            moveDate: dateKey,
            moveType: "day-only",
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => null)
          if (data?.code === "WORKER_LIMIT_EXCEEDED") {
            toast.error("移動先の上限（9名）に達しています")
          } else {
            toast.error(data?.error ?? "移動に失敗しました")
          }
          setSelectedWorker(null)
          return
        }
        toast.success(`${selectedWorker.workerName}のこの日の配置を移動しました`)
        setSelectedWorker(null)
        onRefresh()
      } catch {
        toast.error("移動に失敗しました")
        setSelectedWorker(null)
        onRefresh()
      }
    }
  }, [selectedWorker, rangeStart, onRefresh])

  // 選択解除
  const handleCancelSelection = useCallback(() => {
    setSelectedWorker(null)
  }, [])

  // カレンダー日付選択用
  const dateInputRef = useRef<HTMLInputElement>(null)

  // スワイプ検知用
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    const deltaY = e.changedTouches[0].clientY - touchStartY.current
    // 横方向の移動が縦より大きく、50px以上の場合のみ日送り
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        // 右スワイプ → 前日へ
        onRangeStartChange((prev: Date) => addDays(prev, -1))
      } else {
        // 左スワイプ → 翌日へ
        onRangeStartChange((prev: Date) => addDays(prev, 1))
      }
    }
  }, [onRangeStartChange])

  // 表示中の日付（1日表示）
  const currentDate = rangeStart

  // 当日の職人→配置済現場マップ (workerId → { siteNames })
  const workerBusyInfoMap = useMemo(() => {
    const map = new Map<string, WorkerBusyInfo>()
    const dayAssignments = assignments.filter((a) => isDateInRange(currentDate, a))
    for (const a of dayAssignments) {
      if (a.workerId && a.worker) {
        const siteName = a.schedule.name || a.schedule.project.name
        const existing = map.get(a.workerId)
        if (existing) {
          existing.siteNames.push(siteName)
        } else {
          map.set(a.workerId, { siteNames: [siteName] })
        }
      }
    }
    return map
  }, [assignments, currentDate])

  // 当日の車両→班マップ (vehicleId → { teamId, teamName })
  const vehicleTeamMap = useMemo(() => {
    const map = new Map<string, { teamId: string; teamName: string }>()
    const dayAssignments = assignments.filter((a) => isDateInRange(currentDate, a))
    for (const a of dayAssignments) {
      if (a.vehicleId && a.vehicle) {
        map.set(a.vehicleId, { teamId: a.teamId, teamName: a.team.name })
      }
    }
    return map
  }, [assignments, currentDate])

  // この日の配置データをチーム×現場でグループ化
  const teamSiteGroups = useMemo(() => {
    const dayAssignments = assignments.filter((a) => isDateInRange(currentDate, a))

    // チームごとにグループ化
    const teamMap = new Map<string, {
      team: TeamData
      sites: Map<string, {
        schedule: ScheduleData
        workers: AssignmentData[]
        vehicles: AssignmentData[]
        assignmentIds: string[]
      }>
    }>()

    for (const a of dayAssignments) {
      if (!teamMap.has(a.teamId)) {
        teamMap.set(a.teamId, { team: a.team, sites: new Map() })
      }
      const teamGroup = teamMap.get(a.teamId)!
      if (!teamGroup.sites.has(a.scheduleId)) {
        teamGroup.sites.set(a.scheduleId, {
          schedule: a.schedule,
          workers: [],
          vehicles: [],
          assignmentIds: [],
        })
      }
      const siteGroup = teamGroup.sites.get(a.scheduleId)!
      siteGroup.assignmentIds.push(a.id)
      if (a.workerId && a.worker) {
        siteGroup.workers.push(a)
      }
      if (a.vehicleId && a.vehicle) {
        siteGroup.vehicles.push(a)
      }
    }

    // チームの並び順でソート
    const sorted = teams
      .filter((t) => teamMap.has(t.id))
      .map((t) => ({
        team: t,
        sites: Array.from(teamMap.get(t.id)!.sites.values()),
      }))

    // 配置のないチームも表示（空のセクション）
    const emptyTeams = teams
      .filter((t) => t.isActive && !teamMap.has(t.id))
      .map((t) => ({ team: t, sites: [] as typeof sorted[0]["sites"] }))

    return [...sorted, ...emptyTeams]
  }, [assignments, currentDate, teams])

  return (
    <div
      ref={props.mainContainerRef}
      className="space-y-3 pb-4 overflow-x-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* サマリーバッジ */}
      {headerStats && (
        <div className="flex items-stretch gap-1 px-1">
          <div className="flex-1 rounded-sm border-2 border-blue-300 bg-blue-50 py-1 text-center">
            <div className="text-[10px] font-extrabold text-blue-600 tracking-wide">稼働班</div>
            <div className="text-lg font-black tabular-nums text-blue-700 leading-none">{headerStats.activeTeams}</div>
          </div>
          <div className="flex-1 rounded-sm border-2 border-slate-300 bg-slate-50 py-1 text-center">
            <div className="text-[10px] font-extrabold text-slate-500 tracking-wide">総作業員</div>
            <div className="text-lg font-black tabular-nums text-slate-700 leading-none">{headerStats.totalWorkers}</div>
          </div>
          <div className="flex-1 rounded-sm border-2 border-green-300 bg-green-50 py-1 text-center">
            <div className="text-[10px] font-extrabold text-green-600 tracking-wide">配置済</div>
            <div className="text-lg font-black tabular-nums text-green-700 leading-none">{headerStats.assignedWorkers}</div>
          </div>
          <div className="flex-1 rounded-sm border-2 border-amber-300 bg-amber-50 py-1 text-center">
            <div className="text-[10px] font-extrabold text-amber-600 tracking-wide">未配置</div>
            <div className="text-lg font-black tabular-nums text-amber-700 leading-none">{headerStats.unassignedWorkers}</div>
          </div>
          <div className="flex-1 rounded-sm border-2 border-purple-300 bg-purple-50 py-1 text-center">
            <div className="text-[10px] font-extrabold text-purple-600 tracking-wide">稼働現場</div>
            <div className="text-lg font-black tabular-nums text-purple-700 leading-none">{headerStats.activeSites}</div>
          </div>
        </div>
      )}

      {/* 日付ヘッダー（大きく表示 + スワイプ矢印 + カレンダー日付選択） */}
      <div className={cn(
        "flex items-center justify-between px-2 py-3 rounded-xl",
        isToday(currentDate) ? "bg-blue-50 border border-blue-200" :
        isWeekend(currentDate) ? "bg-slate-50 border border-slate-200" :
        "bg-white border border-slate-200"
      )}>
        <Button
          variant="ghost"
          size="sm"
          className="h-10 w-10"
          onClick={() => onRangeStartChange((prev: Date) => addDays(prev, -1))}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="text-center flex-1">
          <p className="text-lg font-bold text-slate-900">
            {dateLabel(currentDate)}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            ← スワイプで日送り →
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-10 w-10"
          onClick={() => onRangeStartChange((prev: Date) => addDays(prev, 1))}
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
        {/* カレンダー日付選択 */}
        <div className="relative h-14 w-14 flex-shrink-0">
          {/* アイコン（pointer-events-none でタッチを input に通す） */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <CalendarDays style={{ width: 40, height: 40 }} className="text-slate-600" />
          </div>
          {/* 全面タップ可能な input */}
          <input
            ref={dateInputRef}
            type="date"
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            value={format(currentDate, "yyyy-MM-dd")}
            onChange={(e) => {
              if (e.target.value) {
                const picked = parse(e.target.value, "yyyy-MM-dd", new Date())
                picked.setHours(0, 0, 0, 0)
                onRangeStartChange(picked)
              }
            }}
          />
        </div>
      </div>

      {/* チーム別 縦リスト */}
      {teamSiteGroups.length === 0 ? (
        <div className="flex items-center justify-center py-16 bg-white border rounded-xl">
          <div className="text-center text-slate-400">
            <Users className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm">この日の配置はありません</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {teamSiteGroups.map(({ team, sites }) => (
            <TeamSection
              key={team.id}
              team={team}
              sites={sites}
              currentDate={currentDate}
              onAddClick={onAddClick}
              onDeleteAssignment={onDeleteAssignment}
              onSiteOpsClick={onSiteOpsClick}
              onAddScheduleFromCell={handleAddScheduleFromCell}
              selectedWorker={selectedWorker}
              onSelectWorker={handleSelectWorker}
              onTapDestination={handleTapDestination}
              onRefresh={onRefresh}
              vehicleTeamMap={vehicleTeamMap}
              workerBusyInfoMap={workerBusyInfoMap}
            />
          ))}
        </div>
      )}

      {/* 選択中バー（画面下部に固定表示） */}
      {selectedWorker && (
        <div className="fixed bottom-16 left-0 right-0 z-50 px-3 pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center gap-3 px-4 py-3 bg-blue-600 text-white rounded-xl shadow-lg">
            <ArrowRight className="w-5 h-5 flex-shrink-0 animate-pulse" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">
                {selectedWorker.workerName}を選択中
              </p>
              <p className="text-xs text-blue-200">
                移動先の現場をタップしてください
              </p>
            </div>
            <button
              onClick={handleCancelSelection}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 hover:bg-blue-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ダイアログ */}
      {dialogTarget && dialogTeam && (
        <AddAssignmentDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSubmit={onAddAssignment}
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

      <AddScheduleDialog
        open={scheduleDialogOpen}
        onClose={() => setScheduleDialogOpen(false)}
        onComplete={() => onRefresh()}
        teams={teams}
        initialDate={scheduleDialogInitialDate}
        initialTeamId={scheduleDialogInitialTeamId}
      />
    </div>
  )
}

// ── チームセクション ────────────────────────────────

function TeamSection({
  team,
  sites,
  currentDate,
  onAddClick,
  onDeleteAssignment,
  onSiteOpsClick,
  onAddScheduleFromCell,
  selectedWorker,
  onSelectWorker,
  onTapDestination,
  onRefresh,
  vehicleTeamMap,
  workerBusyInfoMap,
}: {
  team: TeamData
  sites: {
    schedule: ScheduleData
    workers: AssignmentData[]
    vehicles: AssignmentData[]
    assignmentIds: string[]
  }[]
  currentDate: Date
  onAddClick: (teamId: string, date: Date) => void
  onDeleteAssignment: (assignmentId: string) => void
  onSiteOpsClick: (schedule: ScheduleData) => void
  onAddScheduleFromCell: (teamId: string, date: Date) => void
  selectedWorker: SelectedWorker | null
  onSelectWorker: (worker: SelectedWorker) => void
  onTapDestination: (targetTeamId: string, targetScheduleId: string) => void
  onRefresh: () => void
  vehicleTeamMap: Map<string, { teamId: string; teamName: string }>
  workerBusyInfoMap: Map<string, WorkerBusyInfo>
}) {
  const teamColor = team.colorCode || "#6366f1"

  return (
    <div
      className="border rounded-xl overflow-hidden"
      style={{ background: `linear-gradient(90deg, ${teamColor}18 0%, ${teamColor}08 60%, #ffffff 100%)` }}
    >
      {/* チーム名ヘッダー */}
      <div
        className="flex items-center gap-2 px-3 py-2.5"
        style={{
          borderLeft: `4px solid ${teamColor}`,
          background: `linear-gradient(90deg, ${teamColor}50 0%, ${teamColor}30 50%, ${teamColor}10 100%)`,
        }}
      >
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: teamColor }}
        />
        <span className="font-bold text-[1.3125rem] text-slate-900">{team.name}</span>
        <span className="text-xs font-semibold text-slate-700 ml-auto">
          {sites.length > 0 ? `${sites.length}現場` : "配置なし"}
        </span>
      </div>

      {/* 現場カード一覧 */}
      {sites.length > 0 ? (
        <div className="divide-y divide-slate-100">
          {sites.map((site) => (
            <SiteCard
              key={site.schedule.id}
              site={site}
              teamId={team.id}
              teamColor={teamColor}
              currentDate={currentDate}
              onDeleteAssignment={onDeleteAssignment}
              onSiteOpsClick={onSiteOpsClick}
              selectedWorker={selectedWorker}
              onSelectWorker={onSelectWorker}
              onTapDestination={onTapDestination}
              onRefresh={onRefresh}
              vehicleTeamMap={vehicleTeamMap}
              workerBusyInfoMap={workerBusyInfoMap}
            />
          ))}
        </div>
      ) : (
        <div className="px-3 py-4 text-center text-xs text-slate-400">
          配置がありません
        </div>
      )}

      {/* ＋現場を追加ボタン */}
      <div className="px-3 py-2 border-t border-slate-100">
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-10 flex-1 text-xs text-slate-500 bg-white border border-dashed border-slate-300 rounded-lg"
            onClick={() => onAddClick(team.id, currentDate)}
          >
            <Plus className="w-4 h-4 mr-1" />
            既存の現場を追加
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-10 flex-1 text-xs text-blue-600 bg-white border border-dashed border-blue-300 rounded-lg"
            onClick={() => onAddScheduleFromCell(team.id, currentDate)}
          >
            <Plus className="w-4 h-4 mr-1" />
            新規現場
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── 現場カード ──────────────────────────────────────

function SiteCard({
  site,
  teamId,
  teamColor,
  currentDate,
  onDeleteAssignment,
  onSiteOpsClick,
  selectedWorker,
  onSelectWorker,
  onTapDestination,
  onRefresh,
  vehicleTeamMap,
  workerBusyInfoMap,
}: {
  site: {
    schedule: ScheduleData
    workers: AssignmentData[]
    vehicles: AssignmentData[]
    assignmentIds: string[]
  }
  teamId: string
  teamColor: string
  currentDate: Date
  onDeleteAssignment: (assignmentId: string) => void
  onSiteOpsClick: (schedule: ScheduleData) => void
  selectedWorker: SelectedWorker | null
  onSelectWorker: (worker: SelectedWorker) => void
  onTapDestination: (targetTeamId: string, targetScheduleId: string) => void
  onRefresh: () => void
  vehicleTeamMap: Map<string, { teamId: string; teamName: string }>
  workerBusyInfoMap: Map<string, WorkerBusyInfo>
}) {
  const { schedule, workers, vehicles } = site
  const wtColor = workTypeColor(schedule.workType)
  const siteName = schedule.name || schedule.project.name
  const companyName = schedule.project.branch.company.name
  const address = schedule.project.address
  const dateKey = format(currentDate, "yyyy-MM-dd")

  // 職長と一般職人を分ける
  const foremen = workers.filter((w) => w.assignedRole === "FOREMAN")
  const regularWorkers = workers.filter((w) => w.assignedRole !== "FOREMAN")

  // この現場が移動先として有効かどうか
  const isValidDestination = selectedWorker !== null &&
    !(selectedWorker.teamId === teamId && selectedWorker.scheduleId === schedule.id)

  // 複数日かどうか
  const scheduleIsMultiDay = !!(
    schedule.plannedStartDate &&
    schedule.plannedEndDate &&
    schedule.plannedStartDate !== schedule.plannedEndDate
  )

  // 日付範囲ラベル
  const dateRangeLabel = useMemo(() => {
    if (!schedule.plannedStartDate) return ""
    const s = new Date(schedule.plannedStartDate)
    const label = `${s.getMonth() + 1}/${s.getDate()}`
    if (!schedule.plannedEndDate || schedule.plannedStartDate === schedule.plannedEndDate) return label
    const e = new Date(schedule.plannedEndDate)
    return `${label}〜${e.getMonth() + 1}/${e.getDate()}`
  }, [schedule.plannedStartDate, schedule.plannedEndDate])

  // ── 職人追加ダイアログ ──
  const [workerDialogOpen, setWorkerDialogOpen] = useState(false)
  const [workerList, setWorkerList] = useState<WorkerData[]>([])
  const [loadingWorkers, setLoadingWorkers] = useState(false)
  const [addAsForeman, setAddAsForeman] = useState(false)

  const assignedWorkerIds = useMemo(
    () => new Set(workers.map((a) => a.workerId).filter(Boolean) as string[]),
    [workers]
  )

  const fetchWorkers = useCallback(async () => {
    setLoadingWorkers(true)
    try {
      const res = await fetch("/api/workers")
      if (!res.ok) throw new Error()
      setWorkerList(await res.json())
    } catch {
      toast.error("職人データの取得に失敗しました")
    } finally {
      setLoadingWorkers(false)
    }
  }, [])

  const openWorkerDialog = useCallback((e: React.MouseEvent, asForeman = false) => {
    e.stopPropagation()
    setAddAsForeman(asForeman)
    setWorkerDialogOpen(true)
    fetchWorkers()
  }, [fetchWorkers])

  const handleAddWorkers = useCallback(async (workerIds: string[], assignedDate: string | null) => {
    try {
      const res = await fetch("/api/worker-assignments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId: schedule.id, teamId, workerIds, assignedDate }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? "追加に失敗しました")
      }
      const created = await res.json()

      // 職長として追加する場合: 最初の1名を職長に自動切替
      if (addAsForeman && Array.isArray(created) && created.length > 0) {
        const firstId = created[0].id
        try {
          await fetch(`/api/worker-assignments/${firstId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assignedRole: "FOREMAN" }),
          })
          toast.success("職長を配置しました")
        } catch {
          toast.success(`${workerIds.length}名を追加しました（職長切替に失敗）`)
        }
      } else {
        toast.success(`${workerIds.length}名の職人を追加しました`)
      }
      onRefresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "追加に失敗しました"
      toast.error(msg)
      throw err
    }
  }, [schedule.id, teamId, onRefresh, addAsForeman])

  // ── 職長⇔職人切替 ──
  const handleToggleRole = useCallback(async (assignmentId: string, newRole: "FOREMAN" | "WORKER") => {
    try {
      const res = await fetch(`/api/worker-assignments/${assignmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedRole: newRole }),
      })
      if (!res.ok) throw new Error()
      toast.success(newRole === "FOREMAN" ? "職長に変更しました" : "職人に変更しました")
      onRefresh()
    } catch {
      toast.error("役割の切替に失敗しました")
    }
  }, [onRefresh])

  // ── 車両追加ダイアログ ──
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false)
  const [vehicleList, setVehicleList] = useState<VehicleData[]>([])
  const [loadingVehicles, setLoadingVehicles] = useState(false)

  const assignedVehicleIds = useMemo(
    () => new Set(vehicles.map((a) => a.vehicleId).filter(Boolean) as string[]),
    [vehicles]
  )

  // 他班が使用中の車両マップ（自班を除く） vehicleId → 班名
  const otherTeamVehicleMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const [vehicleId, info] of vehicleTeamMap) {
      if (info.teamId !== teamId) {
        map.set(vehicleId, info.teamName)
      }
    }
    return map
  }, [vehicleTeamMap, teamId])

  const fetchVehicles = useCallback(async () => {
    setLoadingVehicles(true)
    try {
      const res = await fetch("/api/vehicles?isActive=true")
      if (!res.ok) throw new Error()
      setVehicleList(await res.json())
    } catch {
      toast.error("車両データの取得に失敗しました")
    } finally {
      setLoadingVehicles(false)
    }
  }, [])

  const openVehicleDialog = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setVehicleDialogOpen(true)
    fetchVehicles()
  }, [fetchVehicles])

  const handleAddVehicle = useCallback(async (vehicleId: string, assignedDate: string | null) => {
    try {
      const res = await fetch("/api/worker-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId: schedule.id,
          teamId,
          vehicleId,
          assignedRole: "WORKER",
          assignedDate,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? "追加に失敗しました")
      }
      toast.success("車両を追加しました")
      setVehicleDialogOpen(false)
      onRefresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "追加に失敗しました"
      toast.error(msg)
    }
  }, [schedule.id, teamId, onRefresh])

  return (
    <div
      className={cn(
        "px-3 py-3 transition-all",
        isValidDestination && "bg-blue-50/50 border-l-4 border-l-blue-400 cursor-pointer",
      )}
      onClick={isValidDestination ? () => onTapDestination(teamId, schedule.id) : undefined}
    >
      {/* 移動先ヒント */}
      {isValidDestination && (
        <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 bg-blue-100 rounded-lg text-xs text-blue-700 font-medium">
          <ArrowRight className="w-3.5 h-3.5" />
          ここに移動
        </div>
      )}

      {/* 現場名 + 工種バッジ */}
      <button
        className="w-full text-left"
        onClick={(e) => {
          if (isValidDestination) { e.stopPropagation(); return }
          onSiteOpsClick(schedule)
        }}
      >
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className={cn(
                "inline-flex items-center px-1.5 py-0.5 rounded text-[13px] font-bold flex-shrink-0",
                wtColor.bg, wtColor.text
              )}>
                {workTypeLabel(schedule.workType)}
              </span>
              <span className="text-[1.05rem] font-bold text-slate-900 truncate">
                {siteName}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="truncate">{companyName}</span>
            </div>
            {address && (
              <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{address}</span>
              </div>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0 mt-1" />
        </div>
      </button>

      {/* 作業員一覧 */}
      <div className="mt-2 space-y-1.5">
        {/* 職長 */}
        {foremen.map((a) => (
          <WorkerBadge
            key={a.id}
            assignment={a}
            isForeman
            teamId={teamId}
            scheduleId={schedule.id}
            isMultiDay={scheduleIsMultiDay}
            isSelected={selectedWorker?.assignmentId === a.id}
            onSelect={onSelectWorker}
            onDelete={onDeleteAssignment}

          />
        ))}
        {foremen.length === 0 && !selectedWorker && (
          <div className="flex items-center gap-2 pl-1">
            <span className="text-xs font-semibold text-red-500">職長未配置</span>
            <button
              onClick={(e) => openWorkerDialog(e, true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded border border-red-400 text-xs text-red-500 bg-white active:bg-red-50 transition-colors"
            >
              <UserPlus className="w-3 h-3" />
              職長追加
            </button>
          </div>
        )}
        {foremen.length === 0 && selectedWorker && (
          <div className="flex items-center gap-2 pl-1">
            <span className="text-xs font-semibold text-red-500">職長未配置</span>
            <button
              onClick={(e) => openWorkerDialog(e, true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded border border-red-400 text-xs text-red-500 bg-white active:bg-red-50 transition-colors"
            >
              <UserPlus className="w-3 h-3" />
              職長追加
            </button>
          </div>
        )}

        {/* 一般職人 */}
        {regularWorkers.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {regularWorkers.map((a) => (
              <WorkerBadge
                key={a.id}
                assignment={a}
                teamId={teamId}
                scheduleId={schedule.id}
                isMultiDay={scheduleIsMultiDay}
                isSelected={selectedWorker?.assignmentId === a.id}
                onSelect={onSelectWorker}
                onDelete={onDeleteAssignment}
    
              />
            ))}
          </div>
        )}

        {/* 車両 */}
        {vehicles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {vehicles.map((a) => (
              <div
                key={a.id}
                className="inline-flex items-center gap-1 px-2 py-1.5 bg-slate-50 rounded-md text-xs text-slate-600 border border-slate-200"
              >
                <Truck className="w-3.5 h-3.5 text-slate-400" />
                <span>{a.vehicle?.licensePlate}</span>
                {!selectedWorker && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteAssignment(a.id) }}
                    className="ml-0.5 w-4 h-4 flex items-center justify-center rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 追加ボタン（職長・職人・車両） */}
        {!selectedWorker && (
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              onClick={(e) => openWorkerDialog(e)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-slate-300 text-xs text-slate-500 bg-white active:bg-slate-50 transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              職人追加
            </button>
            <button
              onClick={openVehicleDialog}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-slate-300 text-xs text-slate-500 bg-white active:bg-slate-50 transition-colors"
            >
              <Truck className="w-3.5 h-3.5" />
              車両追加
            </button>
          </div>
        )}
      </div>

      {/* 職人追加ダイアログ */}
      <AddWorkerDialog
        open={workerDialogOpen}
        onClose={() => setWorkerDialogOpen(false)}
        onSubmit={handleAddWorkers}
        workers={workerList}
        loadingWorkers={loadingWorkers}
        assignedWorkerIds={assignedWorkerIds}
        busyWorkerInfoMap={workerBusyInfoMap}
        isMultiDay={scheduleIsMultiDay}
        dateKey={dateKey}
        dateRangeLabel={dateRangeLabel}
        currentWorkerCount={workers.length}
        dialogTitle={addAsForeman ? "職長を追加" : undefined}
        foremanOnly={addAsForeman}
        onWorkersChanged={fetchWorkers}
      />

      {/* 車両追加ダイアログ */}
      <AddVehicleDialog
        open={vehicleDialogOpen}
        onClose={() => setVehicleDialogOpen(false)}
        onSelect={handleAddVehicle}
        vehicles={vehicleList}
        loading={loadingVehicles}
        assignedVehicleIds={assignedVehicleIds}
        isMultiDay={scheduleIsMultiDay}
        dateKey={dateKey}
        vehicleTeamMap={otherTeamVehicleMap}
      />
    </div>
  )
}

// ── 作業員バッジ（スマホ向け拡大版） ──────────────

function WorkerBadge({
  assignment,
  isForeman,
  teamId,
  scheduleId,
  isMultiDay,
  isSelected,
  onSelect,
  onDelete,
}: {
  assignment: AssignmentData
  isForeman?: boolean
  teamId: string
  scheduleId: string
  isMultiDay: boolean
  isSelected?: boolean
  onSelect: (worker: SelectedWorker) => void
  onDelete: (id: string) => void
}) {
  const worker = assignment.worker
  if (!worker) return null

  const colors = HELMET_COLORS[worker.workerType] ?? HELMET_COLORS.SUBCONTRACTOR
  const isSubcontractor = worker.workerType === "SUBCONTRACTOR"

  const handleTap = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect({
      assignmentId: assignment.id,
      workerName: worker.name,
      teamId,
      scheduleId,
      isMultiDay,
    })
  }

  if (isForeman) {
    // 職長: 横長バッジ（大きめ）
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-all",
          isSelected
            ? "bg-blue-100 border-blue-400 ring-2 ring-blue-300"
            : "bg-amber-50 border-amber-200"
        )}
        onClick={handleTap}
      >
        <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-amber-500 text-white flex-shrink-0">
          職長
        </span>
        <span className="text-sm font-bold text-amber-900">{worker.name}</span>
        {isSelected && (
          <span className="ml-auto text-xs text-blue-600 font-medium">選択中</span>
        )}
      </div>
    )
  }

  // 一般職人: コンパクトバッジ（スマホ向け拡大）
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all",
        isSelected && "ring-2 ring-blue-400 bg-blue-50"
      )}
      style={{
        backgroundColor: isSelected ? undefined : (isSubcontractor ? "#f8fafc" : `${colors.bg}15`),
        border: isSelected ? "2px solid #3b82f6" : (isSubcontractor ? "1px solid #e2e8f0" : `1px solid ${colors.bg}40`),
        color: colors.text === "#ffffff" ? colors.bg : colors.text,
      }}
      onClick={handleTap}
    >
      {/* ミニヘルメット */}
      <div
        className="w-4 h-3 rounded-t-sm"
        style={{ backgroundColor: colors.bg }}
      />
      <span>{worker.name}</span>
    </div>
  )
}

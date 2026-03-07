/**
 * [COMPONENT] 人員配置管理 - メインビュー
 *
 * データ取得・ローディング・エラー処理を含むメインコンポーネント。
 * 班ビュー（14日間表示）を提供する。
 * 展開セルでの現場カード表示・追加・削除機能を統合。
 */
"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Loader2, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { WorkerAssignmentHeader } from "./WorkerAssignmentHeader"
import { WorkerAssignmentTable } from "./WorkerAssignmentTable"
import { AddAssignmentDialog } from "./AddAssignmentDialog"
import type { ViewMode, TeamData, AssignmentData, ScheduleData } from "./types"
import { format, addDays } from "date-fns"

const DISPLAY_DAYS = 14

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

  // ダイアログ用の状態
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogTarget, setDialogTarget] = useState<{ teamId: string; date: Date } | null>(null)

  const rangeEnd = useMemo(() => addDays(rangeStart, DISPLAY_DAYS - 1), [rangeStart])

  const fetchData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true)
    setError(null)
    try {
      const startDate = format(rangeStart, "yyyy-MM-dd")
      const endDate = format(rangeEnd, "yyyy-MM-dd")

      const [teamsRes, assignmentsRes] = await Promise.all([
        fetch("/api/teams?isActive=true"),
        fetch(`/api/worker-assignments?startDate=${startDate}&endDate=${endDate}`),
      ])

      if (!teamsRes.ok) throw new Error("班データの取得に失敗しました")
      if (!assignmentsRes.ok) throw new Error("人員配置データの取得に失敗しました")

      const [teamsData, assignmentsData] = await Promise.all([
        teamsRes.json(),
        assignmentsRes.json(),
      ])

      setTeams(teamsData)
      setAssignments(assignmentsData)
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

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRangeStartChange = useCallback((dateOrFn: Date | ((prev: Date) => Date)) => {
    setRangeStart((prev) => {
      if (typeof dateOrFn === "function") return dateOrFn(prev)
      return dateOrFn
    })
  }, [])

  // 現場追加ダイアログを開く
  const handleAddClick = useCallback((teamId: string, date: Date) => {
    setDialogTarget({ teamId, date })
    setDialogOpen(true)
    fetchSchedules()
  }, [fetchSchedules])

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
      fetchData()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "追加に失敗しました"
      toast.error(msg)
      throw err
    }
  }, [dialogTarget, fetchData])

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
        />
        <div className="flex items-center justify-center py-20 bg-white border rounded-xl">
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">データを読み込んでいます...</span>
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
    <div className="space-y-4">
      <WorkerAssignmentHeader
        viewMode={viewMode}
        rangeStart={rangeStart}
        displayDays={DISPLAY_DAYS}
        onViewModeChange={setViewMode}
        onRangeStartChange={handleRangeStartChange}
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

      {/* 現場追加ダイアログ */}
      {dialogTarget && dialogTeam && (
        <AddAssignmentDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSubmit={handleAddAssignment}
          targetDate={dialogTarget.date}
          targetTeam={dialogTeam}
          schedules={schedules}
          loadingSchedules={loadingSchedules}
        />
      )}
    </div>
  )
}

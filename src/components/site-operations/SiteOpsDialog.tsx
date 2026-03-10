/**
 * [COMPONENT] 現場操作ダイアログ（共通モジュール）
 *
 * 構造:
 * - 現場名（プロジェクト名）
 * - 現場情報（SiteOpsInfoSection）
 * - 作業内容切替（schedule.name 単位のタブ — 複数作業内容がある場合のみ表示）
 * - 着工・完工（SiteOpsStatusSection）
 * - 全工程日程（SiteOpsDateSection — 選択中の作業内容内のスケジュールのみ）
 * - 写真添付（SiteOpsPhotoSection）
 *
 * 使用方法（2パターン）:
 * 1. schedule オブジェクトを渡す
 *   <SiteOpsDialog open={open} onClose={close} schedule={scheduleData} onUpdated={refresh} />
 * 2. scheduleId だけ渡す
 *   <SiteOpsDialog open={open} onClose={close} scheduleId={id} onUpdated={refresh} />
 */
"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ClipboardList, X, Loader2 } from "lucide-react"
import { SiteOpsInfoSection } from "./SiteOpsInfoSection"
import { SiteOpsStatusSection } from "./SiteOpsStatusSection"
import { SiteOpsDateSection } from "./SiteOpsDateSection"
import { SiteOpsPhotoSection } from "./SiteOpsPhotoSection"
import { cn } from "@/lib/utils"
import type { ScheduleData } from "@/components/worker-assignments/types"

/** 作業種別のスタイル */
const WORK_TYPE_BADGE: Record<string, { label: string; className: string }> = {
  ASSEMBLY: { label: "組立", className: "bg-blue-100 text-blue-700 border-blue-300" },
  DISASSEMBLY: { label: "解体", className: "bg-orange-100 text-orange-700 border-orange-300" },
  REWORK: { label: "その他", className: "bg-slate-100 text-slate-600 border-slate-300" },
}

/** 作業内容（schedule.name）単位のグループ */
interface WorkContentGroup {
  /** グループ名（schedule.name — nullの場合は工種ラベル） */
  name: string
  /** このグループに属するスケジュール */
  schedules: ScheduleData[]
}

/** siblingsをschedule.name単位でグループ化 */
function groupByWorkContent(siblings: ScheduleData[]): WorkContentGroup[] {
  const namedMap = new Map<string, ScheduleData[]>()
  const unnamed: ScheduleData[] = []

  for (const s of siblings) {
    if (s.name) {
      if (!namedMap.has(s.name)) namedMap.set(s.name, [])
      namedMap.get(s.name)!.push(s)
    } else {
      unnamed.push(s)
    }
  }

  const groups: WorkContentGroup[] = []

  // 名前ありグループ（名前順）
  const sortedNames = [...namedMap.keys()].sort()
  for (const name of sortedNames) {
    groups.push({ name, schedules: namedMap.get(name)! })
  }

  // 名前なしは個別にグループ化
  for (const s of unnamed) {
    const label = (WORK_TYPE_BADGE[s.workType] ?? WORK_TYPE_BADGE.REWORK).label
    groups.push({ name: label, schedules: [s] })
  }

  return groups
}

interface SiteOpsDialogProps {
  open: boolean
  onClose: () => void
  schedule?: ScheduleData | null
  scheduleId?: string | null
  onUpdated?: () => void
}

export function SiteOpsDialog({ open, onClose, schedule: scheduleProp, scheduleId: scheduleIdProp, onUpdated }: SiteOpsDialogProps) {
  const [fetchedSchedule, setFetchedSchedule] = useState<ScheduleData | null>(null)
  const [loadingSchedule, setLoadingSchedule] = useState(false)
  const schedule = scheduleProp ?? fetchedSchedule

  // 同一プロジェクトの全工程
  const [siblings, setSiblings] = useState<ScheduleData[]>([])
  const [loadingSiblings, setLoadingSiblings] = useState(false)
  // 選択中の作業内容名
  const [activeGroupName, setActiveGroupName] = useState<string | null>(null)
  // 現在表示中の工程ID
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null)

  // scheduleId のみの場合: APIから取得
  useEffect(() => {
    if (!open || scheduleProp || !scheduleIdProp) return
    setLoadingSchedule(true)
    fetch(`/api/schedules?scheduleId=${scheduleIdProp}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: ScheduleData[]) => {
        if (data.length > 0) setFetchedSchedule(data[0])
      })
      .catch(() => {})
      .finally(() => setLoadingSchedule(false))
  }, [open, scheduleProp, scheduleIdProp])

  // プロジェクトIDが変わったら兄弟工程を取得
  const projectId = schedule?.contract.project.id
  const fetchSiblings = useCallback(async (projId: string, initialSchedule: ScheduleData) => {
    setLoadingSiblings(true)
    try {
      const res = await fetch(`/api/schedules?projectId=${projId}`)
      if (!res.ok) throw new Error()
      const data: ScheduleData[] = await res.json()
      if (data.length > 0) {
        setSiblings(data)
      } else {
        setSiblings([initialSchedule])
      }
    } catch {
      setSiblings([initialSchedule])
    } finally {
      setLoadingSiblings(false)
    }
  }, [])

  useEffect(() => {
    if (open && schedule && projectId) {
      setActiveScheduleId(schedule.id)
      // 初期の作業内容グループ名を設定
      const initialGroupName = schedule.name
        ?? (WORK_TYPE_BADGE[schedule.workType] ?? WORK_TYPE_BADGE.REWORK).label
      setActiveGroupName(initialGroupName)
      setSiblings([schedule])
      fetchSiblings(projectId, schedule)
    }
    if (!open) {
      setSiblings([])
      setActiveScheduleId(null)
      setActiveGroupName(null)
      setFetchedSchedule(null)
    }
  }, [open, schedule, projectId, fetchSiblings])

  // 作業内容グループ
  const workContentGroups = useMemo(() => groupByWorkContent(siblings), [siblings])

  // 選択中の作業内容グループ
  const activeGroup = workContentGroups.find((g) => g.name === activeGroupName)
    ?? workContentGroups.find((g) => g.schedules.some((s) => s.id === activeScheduleId))
    ?? workContentGroups[0]
    ?? null

  // 選択中グループ内のスケジュール
  const activeGroupSchedules = activeGroup?.schedules ?? []

  // 現在表示するスケジュール
  const activeSchedule = schedule
    ? (activeGroupSchedules.find((s) => s.id === activeScheduleId)
      ?? activeGroupSchedules[0]
      ?? siblings.find((s) => s.id === activeScheduleId)
      ?? siblings[0]
      ?? schedule)
    : null

  const siteName = activeSchedule?.contract.project.name ?? "読み込み中..."

  // 作業内容タブを切り替え
  function handleGroupChange(groupName: string) {
    setActiveGroupName(groupName)
    const group = workContentGroups.find((g) => g.name === groupName)
    if (group && group.schedules.length > 0) {
      setActiveScheduleId(group.schedules[0].id)
    }
  }

  // 更新後: 兄弟リストを再取得 + 親に通知
  const handleUpdated = () => {
    if (projectId && schedule) {
      fetchSiblings(projectId, schedule)
    }
    onUpdated?.()
  }

  const showLoading = loadingSchedule && !schedule

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-0 gap-0">
        {/* ヘッダー: 現場名 */}
        <DialogHeader className="px-5 pt-5 pb-3 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            <span className="truncate">{siteName}</span>
          </DialogTitle>
        </DialogHeader>

        {showLoading ? (
          <div className="px-5 pb-5 space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : activeSchedule ? (
          <>
            <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
              {/* 現場情報 */}
              <SiteOpsInfoSection schedule={activeSchedule} onUpdated={handleUpdated} />

              <Separator />

              {/* 作業内容切替（2件以上の場合のみ表示） */}
              {workContentGroups.length > 1 && (
                <div>
                  <div className="text-xs font-semibold text-slate-500 mb-2">作業内容</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {workContentGroups.map((group) => {
                      const isActive = group.name === activeGroup?.name
                      const allCompleted = group.schedules.every((s) => s.actualEndDate)
                      const someStarted = group.schedules.some((s) => s.actualStartDate)
                      // 工種ラベル一覧
                      const workTypeLabels = group.schedules.map((s) =>
                        (WORK_TYPE_BADGE[s.workType] ?? WORK_TYPE_BADGE.REWORK).label
                      )
                      const uniqueLabels = [...new Set(workTypeLabels)]

                      return (
                        <button
                          key={group.name}
                          onClick={() => handleGroupChange(group.name)}
                          className={cn(
                            "text-xs font-medium px-3 py-2 rounded-lg border transition-all flex flex-col items-start gap-0.5",
                            isActive
                              ? "bg-blue-50 text-blue-700 border-blue-300 ring-2 ring-offset-1 ring-blue-400 shadow-sm"
                              : "bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                          )}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold">{group.name}</span>
                            {allCompleted ? (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-green-50 text-green-600 border-green-200">完工</Badge>
                            ) : someStarted ? (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-amber-50 text-amber-600 border-amber-200">作業中</Badge>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1">
                            {uniqueLabels.map((label) => {
                              const code = Object.entries(WORK_TYPE_BADGE).find(([, v]) => v.label === label)?.[0] ?? "REWORK"
                              const badge = WORK_TYPE_BADGE[code] ?? WORK_TYPE_BADGE.REWORK
                              return (
                                <span key={label} className={cn("text-[9px] font-medium px-1.5 py-0 rounded", badge.className)}>
                                  {label}
                                </span>
                              )
                            })}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  {loadingSiblings && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>読み込み中...</span>
                    </div>
                  )}
                  <Separator className="mt-4" />
                </div>
              )}

              {/* 着工・完工 */}
              <SiteOpsStatusSection
                key={`status-${activeSchedule.id}`}
                scheduleId={activeSchedule.id}
                actualStartDate={activeSchedule.actualStartDate}
                actualEndDate={activeSchedule.actualEndDate}
                onUpdated={handleUpdated}
              />

              <Separator />

              {/* 全工程日程（選択中の作業内容内のスケジュールのみ） */}
              <SiteOpsDateSection
                key={`date-${activeGroup?.name ?? projectId}`}
                activeScheduleId={activeSchedule.id}
                siblings={activeGroupSchedules}
                projectId={projectId!}
                onUpdated={handleUpdated}
              />

              <Separator />

              {/* 写真添付 */}
              <SiteOpsPhotoSection />
            </div>
          </>
        ) : (
          <div className="px-5 pb-5 text-center text-sm text-slate-400 py-8">
            データが見つかりませんでした
          </div>
        )}

        {/* フッター */}
        <div className="flex-shrink-0 border-t px-5 py-3 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="w-3.5 h-3.5 mr-1.5" />
            閉じる
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

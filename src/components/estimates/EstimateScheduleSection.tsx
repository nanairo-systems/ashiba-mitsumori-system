/**
 * [COMPONENT] 見積詳細内の工程セクション
 *
 * プロジェクトIDからスケジュールを取得し、ScheduleMiniGanttで表示する。
 * 工程の追加・日付変更もここから可能。
 */
"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, Plus, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { ScheduleMiniGantt } from "@/components/schedules/ScheduleMiniGantt"
import type { ScheduleData } from "@/components/schedules/schedule-types"
import { buildWtConfigMap, getWtConfig } from "@/components/schedules/schedule-constants"

interface Props {
  projectId: string
  isMobile: boolean
}

export function EstimateScheduleSection({ projectId, isMobile }: Props) {
  const router = useRouter()
  const [schedules, setSchedules] = useState<ScheduleData[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch(`/api/schedules?projectId=${projectId}`)
      if (!res.ok) return
      const data = await res.json()
      setSchedules(
        data.map((s: Record<string, unknown>) => ({
          id: s.id,
          contractId: s.contractId,
          workType: s.workType,
          name: s.name ?? null,
          plannedStartDate: s.plannedStartDate ?? null,
          plannedEndDate: s.plannedEndDate ?? null,
          actualStartDate: s.actualStartDate ?? null,
          actualEndDate: s.actualEndDate ?? null,
          workersCount: s.workersCount ?? null,
          notes: s.notes ?? null,
        }))
      )
    } catch {}
    finally { setLoading(false) }
  }, [projectId])

  useEffect(() => { fetchSchedules() }, [fetchSchedules])

  const handleCreateSchedule = useCallback(async (workType: string, _name: string, startDate: string, endDate: string) => {
    setSaving(true)
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          workType,
          plannedStartDate: startDate,
          plannedEndDate: endDate,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success("工事日程を追加しました")
      fetchSchedules()
      router.refresh()
    } catch { toast.error("追加に失敗しました") }
    finally { setSaving(false) }
  }, [projectId, fetchSchedules, router])

  const handleUpdateDates = useCallback(async (scheduleId: string, newStart: string, newEnd: string) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plannedStartDate: newStart, plannedEndDate: newEnd }),
      })
      if (!res.ok) throw new Error()
      toast.success("日付を更新しました")
      fetchSchedules()
      router.refresh()
    } catch { toast.error("更新に失敗しました") }
    finally { setSaving(false) }
  }, [fetchSchedules, router])

  if (loading) {
    return (
      <div className={`${isMobile ? "mx-4" : "mx-6"} bg-white rounded-sm border-2 border-slate-200 p-5`}>
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">工事日程を読み込み中...</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`${isMobile ? "mx-4" : "mx-6"} bg-white rounded-sm border-2 border-slate-200`}>
      <div className="px-5 py-3 border-b border-slate-200">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-blue-600" />
          工事日程
          {schedules.length > 0 && (
            <span className="text-xs font-normal text-slate-400">({schedules.length}件)</span>
          )}
        </h3>
      </div>
      <div className="p-4">
        {schedules.length > 0 ? (
          <ScheduleMiniGantt
            schedules={schedules}
            displayDays={15}
            isLocked={false}
            onCreateSchedule={handleCreateSchedule}
            onUpdateDates={handleUpdateDates}
          />
        ) : (
          <div className="text-center py-6 text-slate-400">
            <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">工事日程がまだありません</p>
            <p className="text-xs mt-1">ガントチャート上でドラッグして工事日程を追加できます</p>
          </div>
        )}
      </div>
    </div>
  )
}

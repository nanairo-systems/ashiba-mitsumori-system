/**
 * [COMPONENT] 職人別スケジュール確認ダイアログ
 *
 * 指定職人の月間カレンダーを表示。
 * 各日にアサインされた現場を班カラーのタグで表示。
 */
"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from "date-fns"
import { ja } from "date-fns/locale"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface Props {
  open: boolean
  onClose: () => void
  workerId: string
  workerName: string
}

interface ScheduleAssignment {
  id: string
  scheduleId: string
  teamId: string
  team: {
    id: string
    name: string
    colorCode: string | null
  }
  schedule: {
    id: string
    name: string | null
    workType: string
    plannedStartDate: string | null
    plannedEndDate: string | null
    project: {
      name: string
      address: string | null
    }
    contract?: {
      id: string
    }
  }
}

const DOW_HEADERS = ["日", "月", "火", "水", "木", "金", "土"]

export function WorkerScheduleDialog({ open, onClose, workerId, workerName }: Props) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [assignments, setAssignments] = useState<ScheduleAssignment[]>([])
  const [loading, setLoading] = useState(false)

  const fetchSchedules = useCallback(async () => {
    if (!workerId) return
    setLoading(true)
    try {
      const year = currentMonth.getFullYear()
      const month = currentMonth.getMonth() + 1
      const res = await fetch(`/api/workers/${workerId}/schedules?year=${year}&month=${month}`)
      if (!res.ok) throw new Error("取得に失敗しました")
      const data = await res.json()
      setAssignments(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "スケジュールの取得に失敗しました")
    } finally {
      setLoading(false)
    }
  }, [workerId, currentMonth])

  useEffect(() => {
    if (open) fetchSchedules()
  }, [open, fetchSchedules])

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  // カレンダーグリッドの日付を取得（月の開始週の日曜〜終了週の土曜）
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
    return eachDayOfInterval({ start: calStart, end: calEnd })
  }, [currentMonth])

  // 日付 → その日のアサイン一覧
  const dayAssignmentMap = useMemo(() => {
    const map = new Map<string, ScheduleAssignment[]>()
    for (const a of assignments) {
      const start = a.schedule.plannedStartDate ? new Date(a.schedule.plannedStartDate) : null
      const end = a.schedule.plannedEndDate ? new Date(a.schedule.plannedEndDate) : start
      if (!start) continue
      start.setHours(0, 0, 0, 0)
      if (end) end.setHours(0, 0, 0, 0)

      for (const day of calendarDays) {
        const d = new Date(day)
        d.setHours(0, 0, 0, 0)
        if (d >= start && d <= (end ?? start)) {
          const key = format(d, "yyyy-MM-dd")
          if (!map.has(key)) map.set(key, [])
          map.get(key)!.push(a)
        }
      }
    }
    return map
  }, [assignments, calendarDays])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{workerName}さんのスケジュール</DialogTitle>
        </DialogHeader>

        {/* 月ナビゲーション */}
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-lg font-bold text-slate-800 min-w-[120px] text-center">
            {format(currentMonth, "yyyy年M月", { locale: ja })}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* カレンダー */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="grid grid-cols-7 gap-1">
                {Array.from({ length: 7 }).map((_, j) => (
                  <Skeleton key={j} className="h-16 rounded" />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div>
            {/* 曜日ヘッダー */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DOW_HEADERS.map((d, i) => (
                <div
                  key={d}
                  className={cn(
                    "text-center text-xs font-medium py-1",
                    i === 0 && "text-red-500",
                    i === 6 && "text-blue-500",
                    i > 0 && i < 6 && "text-slate-500"
                  )}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* 日付グリッド */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day) => {
                const dateKey = format(day, "yyyy-MM-dd")
                const dayAssigns = dayAssignmentMap.get(dateKey) ?? []
                const isCurrentMonth = isSameMonth(day, currentMonth)
                const isToday = isSameDay(day, today)
                const dow = day.getDay()

                return (
                  <div
                    key={dateKey}
                    className={cn(
                      "min-h-[60px] p-1 rounded border text-xs",
                      !isCurrentMonth && "opacity-30",
                      isToday && "border-blue-400 bg-blue-50/50",
                      !isToday && dow === 0 && "bg-red-50/30",
                      !isToday && dow === 6 && "bg-blue-50/30",
                      !isToday && dow !== 0 && dow !== 6 && "border-slate-100"
                    )}
                  >
                    <div
                      className={cn(
                        "text-xs font-medium mb-0.5",
                        isToday && "text-blue-600 font-bold",
                        !isToday && dow === 0 && "text-red-500",
                        !isToday && dow === 6 && "text-blue-500",
                        !isToday && dow !== 0 && dow !== 6 && "text-slate-600"
                      )}
                    >
                      {format(day, "d")}
                    </div>
                    <div className="space-y-0.5">
                      {dayAssigns.map((a) => (
                        <div
                          key={a.id}
                          className="text-[9px] leading-tight px-1 py-0.5 rounded truncate"
                          style={{
                            backgroundColor: `${a.team.colorCode ?? "#94a3b8"}20`,
                            color: a.team.colorCode ?? "#94a3b8",
                          }}
                          title={`${a.schedule.name ?? a.schedule.project.name} (${a.team.name})`}
                        >
                          {a.schedule.name ?? a.schedule.project.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 凡例 */}
        {!loading && assignments.length > 0 && (
          <div className="border-t pt-3 mt-2">
            <div className="text-xs text-slate-500 font-medium mb-1.5">配置中の現場</div>
            <div className="space-y-1">
              {(() => {
                const seen = new Set<string>()
                return assignments
                  .filter((a) => {
                    if (seen.has(a.scheduleId)) return false
                    seen.add(a.scheduleId)
                    return true
                  })
                  .map((a) => (
                    <div key={a.scheduleId} className="flex items-center gap-2 text-xs">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: a.team.colorCode ?? "#94a3b8" }}
                      />
                      <span className="text-slate-700 truncate">
                        {a.schedule.name ?? a.schedule.project.name}
                      </span>
                      <span className="text-slate-400 flex-shrink-0">
                        ({a.team.name})
                      </span>
                    </div>
                  ))
              })()}
            </div>
          </div>
        )}

        {!loading && assignments.length === 0 && (
          <div className="text-center py-4 text-slate-400 text-sm">
            この月のスケジュールはありません
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

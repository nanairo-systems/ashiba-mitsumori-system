/**
 * [COMPONENT] 人員配置管理 - ヘッダー
 *
 * ビュー切り替え・表示期間ナビゲーション・今日ボタン
 */
"use client"

import { useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Users, Building2, ChevronLeft, ChevronRight, CalendarDays, Plus } from "lucide-react"
import { format, addDays } from "date-fns"
import { ja } from "date-fns/locale"
import { cn } from "@/lib/utils"
import type { ViewMode } from "./types"

interface Props {
  viewMode: ViewMode
  rangeStart: Date
  displayDays: number
  onViewModeChange: (mode: ViewMode) => void
  onRangeStartChange: (date: Date | ((prev: Date) => Date)) => void
  onAddScheduleClick?: () => void
}

export function WorkerAssignmentHeader({
  viewMode,
  rangeStart,
  displayDays,
  onViewModeChange,
  onRangeStartChange,
  onAddScheduleClick,
}: Props) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const rangeEnd = addDays(rangeStart, displayDays - 1)

  const shiftDays = useCallback(
    (n: number) => onRangeStartChange(addDays(rangeStart, n)),
    [rangeStart, onRangeStartChange]
  )

  const goToToday = useCallback(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    onRangeStartChange(today)
  }, [onRangeStartChange])

  const startContinuousShift = useCallback(
    (n: number) => {
      intervalRef.current = setInterval(() => {
        onRangeStartChange((prev: Date) => addDays(prev, n))
      }, 150)
    },
    [onRangeStartChange]
  )

  const stopContinuousShift = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const rangeLabel = `${format(rangeStart, "yyyy年M月d日", { locale: ja })}〜${format(rangeEnd, "M月d日", { locale: ja })}`

  return (
    <div className="space-y-3">
      {/* タイトル行 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            人員配置管理
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            班ごとの作業員配置を管理します
          </p>
        </div>
        {onAddScheduleClick && (
          <Button onClick={onAddScheduleClick} size="sm" className="h-9">
            <Plus className="w-4 h-4 mr-1.5" />
            現場を追加
          </Button>
        )}
      </div>

      {/* ツールバー */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* ビュー切り替え */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 px-3 text-xs font-medium rounded-md",
              viewMode === "team"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
            onClick={() => onViewModeChange("team")}
          >
            <Users className="w-3.5 h-3.5 mr-1.5" />
            班ビュー
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 px-3 text-xs font-medium rounded-md",
              viewMode === "site"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
            onClick={() => onViewModeChange("site")}
          >
            <Building2 className="w-3.5 h-3.5 mr-1.5" />
            現場ビュー
          </Button>
        </div>

        {/* 期間ナビゲーション */}
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-slate-800">
            {format(rangeStart, "yyyy年M月", { locale: ja })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2"
              onClick={() => shiftDays(-1)}
              onMouseDown={() => startContinuousShift(-1)}
              onMouseUp={stopContinuousShift}
              onMouseLeave={stopContinuousShift}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <span className="text-xs text-slate-500 min-w-[180px] text-center">
              {rangeLabel}
            </span>

          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2"
            onClick={() => shiftDays(1)}
            onMouseDown={() => startContinuousShift(1)}
            onMouseUp={stopContinuousShift}
            onMouseLeave={stopContinuousShift}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={goToToday}
          >
            <CalendarDays className="w-3.5 h-3.5 mr-1" />
            今日
          </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

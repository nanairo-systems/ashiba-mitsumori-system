/**
 * [COMPONENT] 人員配置管理 - ヘッダー
 *
 * ビュー切り替え・表示期間ナビゲーション（1日単位/1週間単位）・今日ボタン
 * デスクトップ/モバイル共通。Tailwind md: で表示を分岐する。
 */
"use client"

import { useCallback, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Users, Building2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CalendarDays, Plus } from "lucide-react"
import { format, addDays } from "date-fns"
import { ja } from "date-fns/locale"
import { cn } from "@/lib/utils"
import type { ViewMode } from "./types"

const DISPLAY_DAYS_OPTIONS = [4, 7, 14, 21] as const

interface Props {
  viewMode: ViewMode
  rangeStart: Date
  displayDays: number
  onViewModeChange: (mode: ViewMode) => void
  onRangeStartChange: (date: Date | ((prev: Date) => Date)) => void
  onDisplayDaysChange?: (days: number) => void
  onAddScheduleClick?: () => void
}

export function WorkerAssignmentHeader({
  viewMode,
  rangeStart,
  displayDays,
  onViewModeChange,
  onRangeStartChange,
  onDisplayDaysChange,
  onAddScheduleClick,
}: Props) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isLongPress = useRef(false)
  const rangeEnd = addDays(rangeStart, displayDays - 1)

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // アンマウント時にタイマーを確実にクリア
  useEffect(() => {
    return () => clearAllTimers()
  }, [clearAllTimers])

  /** n日分シフト（長押し中はスキップ） */
  const shiftByDays = useCallback(
    (n: number) => {
      if (isLongPress.current) return
      onRangeStartChange((prev: Date) => addDays(prev, n))
    },
    [onRangeStartChange]
  )

  const goToToday = useCallback(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    onRangeStartChange(today)
  }, [onRangeStartChange])

  const stopContinuousShift = useCallback(() => {
    clearAllTimers()
    setTimeout(() => { isLongPress.current = false }, 0)
  }, [clearAllTimers])

  /** 長押しで連続シフト（n日単位） */
  const startContinuousShift = useCallback(
    (n: number) => {
      clearAllTimers()
      isLongPress.current = false
      timeoutRef.current = setTimeout(() => {
        isLongPress.current = true
        // 最初の1回を即座に発火
        onRangeStartChange((prev: Date) => addDays(prev, n))
        intervalRef.current = setInterval(() => {
          onRangeStartChange((prev: Date) => addDays(prev, n))
        }, 400) // ゆっくりめの連続移動
      }, 400) // 400ms以上押し続けたら長押し扱い
    },
    [onRangeStartChange, clearAllTimers]
  )

  const rangeLabel = `${format(rangeStart, "M/d", { locale: ja })}〜${format(rangeEnd, "M/d", { locale: ja })}`

  return (
    <div className="space-y-2 md:space-y-3">
      {/* タイトル行 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg md:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
            人員配置管理
          </h1>
          <p className="hidden md:block text-sm text-slate-500 mt-1">
            班ごとの作業員配置を管理します
          </p>
        </div>
        {onAddScheduleClick && (
          <Button onClick={onAddScheduleClick} size="sm" className="h-9">
            <Plus className="w-4 h-4 md:mr-1.5" />
            <span className="hidden md:inline">現場を追加</span>
          </Button>
        )}
      </div>

      {/* ツールバー（スマホでは非表示 — モバイルは独自の日付ヘッダーを使用） */}
      <div className="hidden md:flex flex-wrap items-center gap-2 md:gap-3">
        {/* 左: ビュー切り替え */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-9 px-2.5 md:h-8 md:px-3 text-xs font-medium rounded-md",
              viewMode === "team"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
            onClick={() => onViewModeChange("team")}
          >
            <Users className="w-3.5 h-3.5 md:mr-1.5" />
            <span className="hidden md:inline">班ビュー</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-9 px-2.5 md:h-8 md:px-3 text-xs font-medium rounded-md",
              viewMode === "site"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
            onClick={() => onViewModeChange("site")}
          >
            <Building2 className="w-3.5 h-3.5 md:mr-1.5" />
            <span className="hidden md:inline">現場ビュー</span>
          </Button>
        </div>

        {/* 期間ナビゲーション */}
        <div className="flex items-center gap-1 md:gap-1.5 whitespace-nowrap">
          <span className="text-xs md:text-sm font-bold text-slate-800">
            {format(rangeStart, "yyyy年M月", { locale: ja })}
          </span>

          {/* 1週間戻る（スマホでは非表示） */}
            <Button
              variant="outline"
              size="sm"
              className="hidden md:inline-flex h-8 px-1.5"
              title="1週間戻る"
              onClick={() => shiftByDays(-7)}
              onMouseDown={() => startContinuousShift(-7)}
              onMouseUp={stopContinuousShift}
              onMouseLeave={stopContinuousShift}
            >
              <ChevronsLeft className="w-4 h-4" />
            </Button>

            {/* 1日戻る */}
            <Button
              variant="outline"
              size="sm"
              className="h-10 w-10 md:h-8 md:w-auto md:px-1.5"
              title="1日戻る"
              onClick={() => shiftByDays(-1)}
              onMouseDown={() => startContinuousShift(-1)}
              onMouseUp={stopContinuousShift}
              onMouseLeave={stopContinuousShift}
              onTouchStart={() => startContinuousShift(-1)}
              onTouchEnd={stopContinuousShift}
            >
              <ChevronLeft className="w-5 h-5 md:w-4 md:h-4" />
            </Button>

          <span className="text-xs text-slate-500 min-w-[80px] text-center">
            {rangeLabel}
          </span>

          {/* 1日進む */}
          <Button
            variant="outline"
            size="sm"
            className="h-10 w-10 md:h-8 md:w-auto md:px-1.5"
            title="1日進む"
            onClick={() => shiftByDays(1)}
            onMouseDown={() => startContinuousShift(1)}
            onMouseUp={stopContinuousShift}
            onMouseLeave={stopContinuousShift}
            onTouchStart={() => startContinuousShift(1)}
            onTouchEnd={stopContinuousShift}
          >
            <ChevronRight className="w-5 h-5 md:w-4 md:h-4" />
          </Button>

          {/* 1週間進む（スマホでは非表示） */}
          <Button
            variant="outline"
            size="sm"
            className="hidden md:inline-flex h-8 px-1.5"
            title="1週間進む"
            onClick={() => shiftByDays(7)}
            onMouseDown={() => startContinuousShift(7)}
            onMouseUp={stopContinuousShift}
            onMouseLeave={stopContinuousShift}
          >
            <ChevronsRight className="w-4 h-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-10 md:h-8 px-2.5 md:px-2 text-xs"
            onClick={goToToday}
          >
            <CalendarDays className="w-4 h-4 md:w-3.5 md:h-3.5 md:mr-1" />
            <span className="hidden md:inline">今日</span>
          </Button>
        </div>

        {/* 表示日数切り替え（スマホでは非表示 — モバイルは1日表示固定） */}
        {onDisplayDaysChange && (
          <div className="hidden md:flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 flex-shrink-0">
            {DISPLAY_DAYS_OPTIONS.map((d) => (
              <Button
                key={d}
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2.5 text-xs font-medium rounded-md",
                  displayDays === d
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
                onClick={() => onDisplayDaysChange(d)}
              >
                {d}日
              </Button>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

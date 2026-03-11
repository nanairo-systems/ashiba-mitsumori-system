/**
 * [COMPONENT] 人員配置管理 - ヘッダー
 *
 * ビュー切り替え・表示期間ナビゲーション（1日単位/1週間単位）・今日ボタン
 * デスクトップ/モバイル共通。Tailwind md: で表示を分岐する。
 */
"use client"

import { useCallback, useEffect, useRef } from "react"
import { Users, Building2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CalendarDays, Plus } from "lucide-react"
import { format, addDays } from "date-fns"
import { ja } from "date-fns/locale"
import { cn } from "@/lib/utils"
import type { ViewMode } from "./types"

const DISPLAY_DAYS_OPTIONS = [4, 7, 14, 21] as const

export interface HeaderStats {
  activeTeams: number
  totalWorkers: number
  assignedWorkers: number
  unassignedWorkers: number
  activeSites: number
}

interface Props {
  viewMode: ViewMode
  rangeStart: Date
  displayDays: number
  onViewModeChange: (mode: ViewMode) => void
  onRangeStartChange: (date: Date | ((prev: Date) => Date)) => void
  onDisplayDaysChange?: (days: number) => void
  onAddScheduleClick?: () => void
  stats?: HeaderStats
  selectedDate?: string | null
}

export function WorkerAssignmentHeader({
  viewMode,
  rangeStart,
  displayDays,
  onViewModeChange,
  onRangeStartChange,
  onDisplayDaysChange,
  onAddScheduleClick,
  stats,
  selectedDate,
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
          <h1 className="text-lg md:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
            人員配置管理
          </h1>
          <p className="hidden md:block text-sm font-bold text-slate-500 mt-1">
            班ごとの作業員配置を管理します
          </p>
        </div>
        {onAddScheduleClick && (
          <button
            onClick={onAddScheduleClick}
            className="h-10 px-4 rounded-sm border-2 border-blue-600 bg-blue-600 text-white font-bold text-sm flex items-center gap-1.5 hover:bg-blue-700 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden md:inline">現場を追加</span>
          </button>
        )}
      </div>

      {/* ツールバー（スマホでは非表示 — モバイルは独自の日付ヘッダーを使用） */}
      <div className="hidden md:flex flex-wrap items-center gap-2 md:gap-3">
        {/* 左: ビュー切り替え */}
        <div className="flex items-center gap-0.5 bg-slate-100 rounded-sm border-2 border-slate-200 p-0.5 flex-shrink-0">
          <button
            className={cn(
              "h-9 px-3 text-xs font-bold rounded-sm flex items-center gap-1.5 transition-all active:scale-95",
              viewMode === "team"
                ? "bg-white text-slate-900 border-2 border-slate-300 shadow-sm"
                : "text-slate-500 hover:text-slate-700 border-2 border-transparent"
            )}
            onClick={() => onViewModeChange("team")}
          >
            <Users className="w-3.5 h-3.5" />
            班ビュー
          </button>
          <button
            className={cn(
              "h-9 px-3 text-xs font-bold rounded-sm flex items-center gap-1.5 transition-all active:scale-95",
              viewMode === "site"
                ? "bg-white text-slate-900 border-2 border-slate-300 shadow-sm"
                : "text-slate-500 hover:text-slate-700 border-2 border-transparent"
            )}
            onClick={() => onViewModeChange("site")}
          >
            <Building2 className="w-3.5 h-3.5" />
            現場ビュー
          </button>
        </div>

        {/* 期間ナビゲーション */}
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-sm font-extrabold text-slate-800">
            {format(rangeStart, "yyyy年M月", { locale: ja })}
          </span>

          {/* 1週間戻る */}
          <button
            className="hidden md:inline-flex h-9 w-9 items-center justify-center rounded-sm border-2 border-slate-300 bg-white text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
            title="1週間戻る"
            onClick={() => shiftByDays(-7)}
            onMouseDown={() => startContinuousShift(-7)}
            onMouseUp={stopContinuousShift}
            onMouseLeave={stopContinuousShift}
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>

          {/* 1日戻る */}
          <button
            className="h-10 w-10 md:h-9 md:w-9 inline-flex items-center justify-center rounded-sm border-2 border-slate-300 bg-white text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
            title="1日戻る"
            onClick={() => shiftByDays(-1)}
            onMouseDown={() => startContinuousShift(-1)}
            onMouseUp={stopContinuousShift}
            onMouseLeave={stopContinuousShift}
            onTouchStart={() => startContinuousShift(-1)}
            onTouchEnd={stopContinuousShift}
          >
            <ChevronLeft className="w-5 h-5 md:w-4 md:h-4" />
          </button>

          <span className="text-xs font-bold text-slate-500 min-w-[80px] text-center">
            {rangeLabel}
          </span>

          {/* 1日進む */}
          <button
            className="h-10 w-10 md:h-9 md:w-9 inline-flex items-center justify-center rounded-sm border-2 border-slate-300 bg-white text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
            title="1日進む"
            onClick={() => shiftByDays(1)}
            onMouseDown={() => startContinuousShift(1)}
            onMouseUp={stopContinuousShift}
            onMouseLeave={stopContinuousShift}
            onTouchStart={() => startContinuousShift(1)}
            onTouchEnd={stopContinuousShift}
          >
            <ChevronRight className="w-5 h-5 md:w-4 md:h-4" />
          </button>

          {/* 1週間進む */}
          <button
            className="hidden md:inline-flex h-9 w-9 items-center justify-center rounded-sm border-2 border-slate-300 bg-white text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
            title="1週間進む"
            onClick={() => shiftByDays(7)}
            onMouseDown={() => startContinuousShift(7)}
            onMouseUp={stopContinuousShift}
            onMouseLeave={stopContinuousShift}
          >
            <ChevronsRight className="w-4 h-4" />
          </button>

          <button
            className="h-10 md:h-9 px-3 rounded-sm border-2 border-slate-300 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50 active:scale-95 transition-all inline-flex items-center gap-1.5"
            onClick={goToToday}
          >
            <CalendarDays className="w-4 h-4 md:w-3.5 md:h-3.5" />
            <span className="hidden md:inline">今日</span>
          </button>
        </div>

        {/* 表示日数切り替え */}
        {onDisplayDaysChange && (
          <div className="hidden md:flex items-center gap-0.5 bg-slate-100 rounded-sm border-2 border-slate-200 p-0.5 flex-shrink-0">
            {DISPLAY_DAYS_OPTIONS.map((d) => (
              <button
                key={d}
                className={cn(
                  "h-8 px-3 text-xs font-bold rounded-sm transition-all active:scale-95",
                  displayDays === d
                    ? "bg-white text-slate-900 border-2 border-slate-300 shadow-sm"
                    : "text-slate-500 hover:text-slate-700 border-2 border-transparent"
                )}
                onClick={() => onDisplayDaysChange(d)}
              >
                {d}日
              </button>
            ))}
          </div>
        )}

        {/* サマリーカード（デスクトップのみ） */}
        {stats && (
          <div className="hidden md:flex items-stretch gap-2.5 ml-auto flex-shrink-0">
            {/* 選択日ラベル */}
            {selectedDate && (
              <div className="rounded-sm border-2 border-orange-400 bg-orange-50 px-4 py-2 min-w-[90px] text-center flex flex-col justify-center">
                <div className="text-[10px] font-extrabold text-orange-500 tracking-wide">選択日</div>
                <div className="text-lg font-black text-orange-700 leading-none mt-1">
                  {format(new Date(selectedDate + "T00:00:00"), "M/d", { locale: ja })}
                </div>
              </div>
            )}
            <div className="rounded-sm border-2 border-blue-300 bg-blue-50 px-5 py-2 min-w-[100px] text-center flex flex-col justify-center">
              <div className="text-xs font-extrabold text-blue-600 tracking-wide">稼働班</div>
              <div className="text-3xl font-black tabular-nums text-blue-700 leading-none mt-1">{stats.activeTeams}</div>
            </div>
            <div className="rounded-sm border-2 border-slate-300 bg-slate-50 px-5 py-2 min-w-[100px] text-center flex flex-col justify-center">
              <div className="text-xs font-extrabold text-slate-500 tracking-wide">総作業員</div>
              <div className="text-3xl font-black tabular-nums text-slate-700 leading-none mt-1">{stats.totalWorkers}</div>
            </div>
            <div className="rounded-sm border-2 border-green-300 bg-green-50 px-5 py-2 min-w-[100px] text-center flex flex-col justify-center">
              <div className="text-xs font-extrabold text-green-600 tracking-wide">配置済</div>
              <div className="text-3xl font-black tabular-nums text-green-700 leading-none mt-1">{stats.assignedWorkers}</div>
            </div>
            <div className="rounded-sm border-2 border-amber-300 bg-amber-50 px-5 py-2 min-w-[100px] text-center flex flex-col justify-center">
              <div className="text-xs font-extrabold text-amber-600 tracking-wide">未配置</div>
              <div className="text-3xl font-black tabular-nums text-amber-700 leading-none mt-1">{stats.unassignedWorkers}</div>
            </div>
            <div className="rounded-sm border-2 border-purple-300 bg-purple-50 px-5 py-2 min-w-[100px] text-center flex flex-col justify-center">
              <div className="text-xs font-extrabold text-purple-600 tracking-wide">稼働現場</div>
              <div className="text-3xl font-black tabular-nums text-purple-700 leading-none mt-1">{stats.activeSites}</div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

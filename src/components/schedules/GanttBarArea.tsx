/**
 * [COMPONENT] ガントチャート バー配置エリア
 *
 * 背景レイヤー（今日線、週末、月境界）とバーを配置する領域。
 * ドラッグプレビューも表示。
 */
"use client"

import React from "react"
import { isWeekend, getDate, differenceInDays } from "date-fns"
import type { WorkTypeConfig } from "./schedule-types"
import { FALLBACK_WT_CONFIG } from "./schedule-constants"

interface GanttBarAreaBackgroundProps {
  days: Date[]
  totalDays: number
  rangeStart: Date
}

/** 背景レイヤー: 今日線・週末・月境界 */
export function GanttBarAreaBackground({ days, totalDays, rangeStart }: GanttBarAreaBackgroundProps) {
  const today = new Date()
  const todayIdx = differenceInDays(today, rangeStart)

  return (
    <>
      {/* 今日の線 */}
      {todayIdx >= 0 && todayIdx < totalDays && (
        <div
          className="absolute top-0 bottom-0 w-px bg-red-400/60 z-10 pointer-events-none"
          style={{ left: `${((todayIdx + 0.5) / totalDays) * 100}%` }}
        />
      )}

      {/* 土日背景 */}
      {days.map((day, i) => {
        if (!isWeekend(day)) return null
        return (
          <div
            key={`bg-${i}`}
            className="absolute top-0 bottom-0 bg-red-50/20 pointer-events-none"
            style={{ left: `${(i / totalDays) * 100}%`, width: `${(1 / totalDays) * 100}%` }}
          />
        )
      })}

      {/* 月境界線 */}
      {days.map((day, i) => {
        if (getDate(day) !== 1 || i === 0) return null
        return (
          <div
            key={`ml-${i}`}
            className="absolute top-0 bottom-0 w-px bg-slate-300/60 pointer-events-none z-[1]"
            style={{ left: `${(i / totalDays) * 100}%` }}
          />
        )
      })}
    </>
  )
}

interface GanttDragPreviewProps {
  startDay: number
  endDay: number
  totalDays: number
  workType: string
  wtConfig?: WorkTypeConfig
  y?: number
}

/** ドラッグ作成中のプレビューバー */
export function GanttDragPreview({ startDay, endDay, totalDays, workType, wtConfig, y = 4 }: GanttDragPreviewProps) {
  const span = endDay - startDay + 1
  const cfg = wtConfig ?? FALLBACK_WT_CONFIG
  return (
    <div
      className={`absolute rounded-md ${cfg.actual} opacity-40 z-[15] pointer-events-none`}
      style={{
        left: `${(startDay / totalDays) * 100}%`,
        width: `${(span / totalDays) * 100}%`,
        top: y,
        height: 22,
      }}
    >
      <div className="flex items-center h-full px-1.5">
        <span className="text-[10px] text-white font-bold">{cfg.label}</span>
      </div>
    </div>
  )
}

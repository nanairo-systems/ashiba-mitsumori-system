/**
 * [COMPONENT] ガントチャート バー描画
 *
 * 予定バー（半透明）+ 実績バー（濃色）を描画。
 * リサイズハンドル、移動中/リサイズ中のゴースト表示を含む。
 */
"use client"

import React from "react"
import { format, parseISO, addDays } from "date-fns"
import type { ScheduleData, DrawMode, GanttMoveState, GanttResizeState, WorkTypeConfig } from "./schedule-types"
import { FALLBACK_WT_CONFIG } from "./schedule-constants"

interface GanttBarProps {
  schedule: ScheduleData
  plannedPos: { left: string; width: string } | null
  actualPos: { left: string; width: string } | null
  y: number
  isSelectMode: boolean
  moveState: GanttMoveState | null
  resizeState: GanttResizeState | null
  rangeStart: Date
  totalDays: number
  contractId?: string
  wtConfig?: WorkTypeConfig
  onBarMouseDown: (schedule: ScheduleData, e: React.MouseEvent, contractId?: string) => void
  onBarMouseUp: (schedule: ScheduleData, e: React.MouseEvent) => void
  onBarClick: (schedule: ScheduleData, e: React.MouseEvent) => void
  onBarEdgeMouseDown: (schedule: ScheduleData, edge: "left" | "right", e: React.MouseEvent, contractId?: string) => void
}

export function GanttBar({
  schedule,
  plannedPos,
  actualPos,
  y,
  isSelectMode,
  moveState,
  resizeState,
  rangeStart,
  totalDays,
  contractId,
  wtConfig,
  onBarMouseDown,
  onBarMouseUp,
  onBarClick,
  onBarEdgeMouseDown,
}: GanttBarProps) {
  const cfg = wtConfig ?? FALLBACK_WT_CONFIG
  const isMoving = moveState?.schedule.id === schedule.id && (!contractId || moveState?.contractId === contractId)
  const isResizing = resizeState?.schedule.id === schedule.id && (!contractId || resizeState?.contractId === contractId)

  return (
    <>
      {/* 予定バー */}
      {plannedPos && !isMoving && !isResizing && (
        <div
          className={`absolute rounded-md ${cfg.planned} border ${cfg.border} z-[5] group/bar transition-shadow ${isSelectMode ? "cursor-grab hover:shadow-md hover:brightness-95 active:cursor-grabbing" : "pointer-events-none"}`}
          style={{ ...plannedPos, top: y, height: 22 }}
          onMouseDown={(e) => onBarMouseDown(schedule, e, contractId)}
          onMouseUp={(e) => onBarMouseUp(schedule, e)}
        >
          {isSelectMode && (
            <>
              <div
                className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize z-10 rounded-l-md hover:bg-white/30"
                style={{ borderLeft: "2px solid transparent" }}
                onMouseDown={(e) => onBarEdgeMouseDown(schedule, "left", e, contractId)}
              />
              <div
                className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize z-10 rounded-r-md hover:bg-white/30"
                style={{ borderRight: "2px solid transparent" }}
                onMouseDown={(e) => onBarEdgeMouseDown(schedule, "right", e, contractId)}
              />
            </>
          )}
          <div className="flex items-center h-full px-1.5 overflow-hidden">
            <span className={`text-xs font-bold ${cfg.text} whitespace-nowrap`}>{cfg.label}</span>
            {schedule.name && (
              <span className={`text-xs ${cfg.text} opacity-80 ml-1 truncate`}>{schedule.name}</span>
            )}
            {schedule.plannedStartDate && (
              <span className="text-[9px] text-slate-600 ml-1 whitespace-nowrap">
                {format(parseISO(schedule.plannedStartDate), "M/d")}
                {schedule.plannedEndDate && `-${format(parseISO(schedule.plannedEndDate), "M/d")}`}
              </span>
            )}
            {schedule.workersCount && (
              <span className={`text-[9px] ml-auto ${cfg.text} opacity-70 whitespace-nowrap`}>{schedule.workersCount}人</span>
            )}
          </div>
        </div>
      )}

      {/* 移動中ゴースト */}
      {isMoving && moveState && (
        <div
          className={`absolute rounded-md ${cfg.planned} border-2 border-blue-500 shadow-lg z-[15] cursor-grabbing opacity-95`}
          style={{
            left: `${(moveState.moveStartDay / totalDays) * 100}%`,
            width: `${(moveState.span / totalDays) * 100}%`,
            top: y,
            height: 22,
          }}
        >
          <div className="flex items-center h-full px-1.5 overflow-hidden">
            <span className={`text-xs font-bold ${cfg.text} whitespace-nowrap`}>{cfg.label}</span>
            <span className="text-[9px] text-slate-600 ml-1 whitespace-nowrap">
              {format(addDays(rangeStart, moveState.moveStartDay), "M/d")}
              {moveState.span > 1 && `-${format(addDays(rangeStart, moveState.moveStartDay + moveState.span - 1), "M/d")}`}
            </span>
            {schedule.workersCount && (
              <span className={`text-[9px] ml-auto ${cfg.text} opacity-70 whitespace-nowrap`}>{schedule.workersCount}人</span>
            )}
          </div>
        </div>
      )}

      {/* リサイズ中ゴースト */}
      {isResizing && resizeState && (
        <div
          className={`absolute rounded-md ${cfg.planned} border-2 border-amber-500 shadow-lg z-[15] opacity-95`}
          style={{
            left: `${(resizeState.startDay / totalDays) * 100}%`,
            width: `${((resizeState.endDay - resizeState.startDay + 1) / totalDays) * 100}%`,
            top: y,
            height: 22,
          }}
        >
          <div className="flex items-center h-full px-1.5 overflow-hidden">
            <span className={`text-xs font-bold ${cfg.text} whitespace-nowrap`}>{cfg.label}</span>
            <span className="text-[9px] text-slate-600 ml-1 whitespace-nowrap">
              {format(addDays(rangeStart, resizeState.startDay), "M/d")}-{format(addDays(rangeStart, resizeState.endDay), "M/d")}
            </span>
            {schedule.workersCount && (
              <span className={`text-[9px] ml-auto ${cfg.text} opacity-70 whitespace-nowrap`}>{schedule.workersCount}人</span>
            )}
          </div>
        </div>
      )}

      {/* 実績バー */}
      {actualPos && !isMoving && !isResizing && (
        <div
          className={`absolute rounded-md ${cfg.actual} z-[6] ${isSelectMode ? "cursor-pointer hover:brightness-110" : "pointer-events-none"}`}
          style={{ ...actualPos, top: y + 22, height: 14 }}
          onClick={(e) => onBarClick(schedule, e)}
          title={`${cfg.label}（実績）`}
        >
          <div className="flex items-center h-full px-1 overflow-hidden">
            <span className="text-[9px] text-white font-medium whitespace-nowrap">実績</span>
          </div>
        </div>
      )}
    </>
  )
}

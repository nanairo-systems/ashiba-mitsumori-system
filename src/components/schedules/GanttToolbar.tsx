/**
 * [COMPONENT] ガントチャート ツールバー
 *
 * モード切替・ナビゲーション・表示日数・検索。
 * variant: "full" (ScheduleGantt), "mini" (ContractDetail) で表示を切り替え。
 */
"use client"

import { useCallback, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight,
  MousePointerClick, Search,
} from "lucide-react"
import { format, parseISO, addDays } from "date-fns"
import type { DrawMode, ScheduleWorkType } from "./schedule-types"
import { WT_CONFIG, WORK_TYPES, DISPLAY_DAYS_PRESETS } from "./schedule-constants"

interface GanttToolbarProps {
  variant?: "full" | "mini"
  drawMode: DrawMode
  effectiveDrawMode: DrawMode
  rangeStart: Date
  displayDays: number
  isLocked?: boolean
  search?: string
  onDrawModeChange: (mode: DrawMode) => void
  onShiftDays: (n: number) => void
  onGoToToday: () => void
  onDisplayDaysChange?: (days: number) => void
  onRangeStartChange?: (date: Date) => void
  onSearchChange?: (q: string) => void
}

export function GanttToolbar({
  variant = "full",
  drawMode,
  effectiveDrawMode,
  rangeStart,
  displayDays,
  isLocked = false,
  search,
  onDrawModeChange,
  onShiftDays,
  onGoToToday,
  onDisplayDaysChange,
  onRangeStartChange,
  onSearchChange,
}: GanttToolbarProps) {
  const isMini = variant === "mini"
  const rangeEnd = addDays(rangeStart, displayDays - 1)

  // 長押しリピート
  const repeatRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; interval: ReturnType<typeof setInterval> | null }>({ timer: null, interval: null })
  const accelRef = useRef(1)

  const startRepeat = useCallback((n: number) => {
    accelRef.current = 1
    onShiftDays(n)
    repeatRef.current.timer = setTimeout(() => {
      repeatRef.current.interval = setInterval(() => {
        accelRef.current = Math.min(accelRef.current + 0.3, 7)
        onShiftDays(n > 0 ? Math.round(accelRef.current) : -Math.round(accelRef.current))
      }, 80)
    }, 400)
  }, [onShiftDays])

  const stopRepeat = useCallback(() => {
    if (repeatRef.current.timer) { clearTimeout(repeatRef.current.timer); repeatRef.current.timer = null }
    if (repeatRef.current.interval) { clearInterval(repeatRef.current.interval); repeatRef.current.interval = null }
    accelRef.current = 1
  }, [])

  useEffect(() => () => stopRepeat(), [stopRepeat])

  if (isMini) {
    return (
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        {!isLocked && (
          <>
            <span className="text-[10px] text-slate-400 mr-0.5">モード:</span>
            <Button size="sm" variant={effectiveDrawMode === "select" ? "default" : "outline"} onClick={() => onDrawModeChange("select")} className="text-[10px] h-6 px-2 gap-1">選択</Button>
            {WORK_TYPES.map((wt) => {
              const cfg = WT_CONFIG[wt]
              const isActive = effectiveDrawMode === wt
              const shortcutLabel = wt === "ASSEMBLY" ? "Ctrl" : wt === "DISASSEMBLY" ? "Shift" : null
              return (
                <Button key={wt} size="sm" variant={isActive ? "default" : "outline"} onClick={() => onDrawModeChange(drawMode === wt ? "select" : wt)}
                  className={`text-[10px] h-6 px-2 gap-1 ${isActive ? "" : `${cfg.text} border-current`}`}
                >
                  <span className={`inline-block w-2.5 h-2.5 rounded-sm ${isActive ? "bg-white/80" : cfg.actual}`} />{cfg.label}
                  {shortcutLabel && <span className={`text-[8px] ml-0.5 ${isActive ? "text-white/70" : "text-slate-400"}`}>{shortcutLabel}</span>}
                </Button>
              )
            })}
            <div className="w-px h-4 bg-slate-200" />
          </>
        )}
        <div className="flex items-center gap-0.5">
          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onMouseDown={() => startRepeat(-7)} onMouseUp={stopRepeat} onMouseLeave={stopRepeat}>
            <ChevronsLeft className="w-3 h-3" />
          </Button>
          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onMouseDown={() => startRepeat(-1)} onMouseUp={stopRepeat} onMouseLeave={stopRepeat}>
            <ChevronLeft className="w-3 h-3" />
          </Button>
          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onMouseDown={() => startRepeat(1)} onMouseUp={stopRepeat} onMouseLeave={stopRepeat}>
            <ChevronRight className="w-3 h-3" />
          </Button>
          <Button variant="outline" size="sm" className="h-6 w-6 p-0" onMouseDown={() => startRepeat(7)} onMouseUp={stopRepeat} onMouseLeave={stopRepeat}>
            <ChevronsRight className="w-3 h-3" />
          </Button>
        </div>
        <Button variant="ghost" size="sm" className="text-[10px] h-6 px-1.5" onClick={onGoToToday}>今日</Button>
        <span className="text-[10px] text-slate-400 ml-auto">{format(rangeStart, "M/d")} 〜 {format(rangeEnd, "M/d")}（{displayDays}日）</span>
      </div>
    )
  }

  // Full variant (ScheduleGantt)
  return (
    <div className="bg-white border rounded-xl p-2.5 space-y-2">
      {/* 1行目: モード + 矢印 + 日付範囲 */}
      <div className="flex items-center gap-2 overflow-hidden">
        <span className="text-xs text-slate-500 font-medium flex-shrink-0">モード:</span>
        <Button size="sm" variant={effectiveDrawMode === "select" ? "default" : "outline"} onClick={() => onDrawModeChange("select")} className="text-xs gap-1.5 h-8 flex-shrink-0">
          <MousePointerClick className="w-3.5 h-3.5" />選択
        </Button>
        <div className="w-px h-6 bg-slate-200 flex-shrink-0" />
        {WORK_TYPES.map((wt) => {
          const cfg = WT_CONFIG[wt]
          const isActive = effectiveDrawMode === wt
          const shortcutLabel = wt === "ASSEMBLY" ? "Ctrl" : wt === "DISASSEMBLY" ? "Shift" : null
          return (
            <Button key={wt} size="sm" variant={isActive ? "default" : "outline"} onClick={() => onDrawModeChange(drawMode === wt ? "select" : wt)} className={`text-xs gap-1 h-8 flex-shrink-0 ${isActive ? "" : `${cfg.text} border-current`}`}>
              <span className={`inline-block w-3 h-3 rounded-sm ${isActive ? "bg-white/80" : cfg.actual}`} />{cfg.label}
              {shortcutLabel && <span className={`text-[9px] ml-0.5 ${isActive ? "text-white/70" : "text-slate-400"}`}>{shortcutLabel}</span>}
            </Button>
          )
        })}
        <div className="w-px h-6 bg-slate-200 flex-shrink-0" />
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onMouseDown={() => startRepeat(-7)} onMouseUp={stopRepeat} onMouseLeave={stopRepeat} onTouchStart={() => startRepeat(-7)} onTouchEnd={stopRepeat}><ChevronsLeft className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onMouseDown={() => startRepeat(-1)} onMouseUp={stopRepeat} onMouseLeave={stopRepeat} onTouchStart={() => startRepeat(-1)} onTouchEnd={stopRepeat}><ChevronLeft className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onMouseDown={() => startRepeat(1)} onMouseUp={stopRepeat} onMouseLeave={stopRepeat} onTouchStart={() => startRepeat(1)} onTouchEnd={stopRepeat}><ChevronRight className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onMouseDown={() => startRepeat(7)} onMouseUp={stopRepeat} onMouseLeave={stopRepeat} onTouchStart={() => startRepeat(7)} onTouchEnd={stopRepeat}><ChevronsRight className="w-4 h-4" /></Button>
        </div>
        <span className="text-xs text-slate-500 flex-shrink-0 ml-1">
          {format(rangeStart, "M/d")} 〜 {format(rangeEnd, "M/d")}
          <span className="text-slate-400 ml-1">（{displayDays}日）</span>
        </span>
      </div>
      {/* 2行目: 表示日数 + 開始日 + 今日 + 検索 */}
      <div className="flex items-center gap-2 overflow-hidden">
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <span className="text-[10px] text-slate-400">幅:</span>
          {DISPLAY_DAYS_PRESETS.map((d) => (
            <Button key={d} variant={displayDays === d ? "default" : "ghost"} size="sm" className="h-6 px-1.5 text-[10px] flex-shrink-0" onClick={() => onDisplayDaysChange?.(d)}>{d}日</Button>
          ))}
        </div>
        <div className="w-px h-5 bg-slate-200 flex-shrink-0" />
        <Input
          type="date"
          value={format(rangeStart, "yyyy-MM-dd")}
          onChange={(e) => { if (e.target.value) onRangeStartChange?.(parseISO(e.target.value)) }}
          className="h-7 text-xs w-[130px] flex-shrink-0"
        />
        <Button variant="ghost" size="sm" className="text-xs h-7 px-2 flex-shrink-0" onClick={onGoToToday}>今日</Button>
        {onSearchChange !== undefined && (
          <>
            <div className="w-px h-5 bg-slate-200 flex-shrink-0" />
            <div className="relative w-44 flex-shrink-0 ml-auto">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input placeholder="検索" value={search ?? ""} onChange={(e) => onSearchChange(e.target.value)} className="pl-8 h-7 text-xs" />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

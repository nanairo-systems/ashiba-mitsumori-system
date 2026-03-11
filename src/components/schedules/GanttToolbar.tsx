/**
 * [COMPONENT] ガントチャート ツールバー
 *
 * モード切替・ナビゲーション・表示日数・検索。
 * variant: "full" (ScheduleGantt), "mini" (ContractDetail) で表示を切り替え。
 *
 * 数字キーでモード切替: 0=選択, 1〜=工種順
 */
"use client"

import { useCallback, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight,
  MousePointerClick, Search, CalendarDays,
} from "lucide-react"
import { format, parseISO, addDays } from "date-fns"
import type { DrawMode, WorkTypeMaster } from "./schedule-types"
import type { WorkTypeConfig } from "./schedule-types"
import { DISPLAY_DAYS_PRESETS } from "./schedule-constants"

interface GanttToolbarProps {
  variant?: "full" | "mini"
  drawMode: DrawMode
  effectiveDrawMode: DrawMode
  rangeStart: Date
  displayDays: number
  isLocked?: boolean
  search?: string
  workTypes: WorkTypeMaster[]
  wtConfigMap: Map<string, WorkTypeConfig>
  /** 点滅中のモードインデックス（-1 = なし, 0 = 選択, 1〜 = 工種） */
  flashIndex?: number
  onDrawModeChange: (mode: DrawMode) => void
  onShiftDays: (n: number) => void
  onGoToToday: () => void
  onDisplayDaysChange?: (days: number) => void
  onRangeStartChange?: (date: Date) => void
  onSearchChange?: (q: string) => void
  onCalendarOpen?: () => void
}

/** 数字キーバッジ */
function KeyBadge({ num, isActive, size = "sm" }: { num: number; isActive: boolean; size?: "sm" | "md" }) {
  const textSize = size === "sm" ? "text-[9px]" : "text-[10px]"
  return (
    <kbd className={`${textSize} min-w-[16px] text-center px-0.5 py-px rounded font-mono ${
      isActive ? "bg-white/20 text-white/80" : "bg-slate-100 text-slate-500 border border-slate-200"
    }`}>{num}</kbd>
  )
}

export function GanttToolbar({
  variant = "full",
  drawMode,
  effectiveDrawMode,
  rangeStart,
  displayDays,
  isLocked = false,
  search,
  workTypes,
  wtConfigMap,
  flashIndex = -1,
  onDrawModeChange,
  onShiftDays,
  onGoToToday,
  onDisplayDaysChange,
  onRangeStartChange,
  onSearchChange,
  onCalendarOpen,
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

  // 点滅アニメーション用クラス
  const flashClass = "animate-[gantt-flash_0.4s_ease-out]"

  if (isMini) {
    return (
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        {!isLocked && (
          <>
            <span className="text-xs text-slate-600 mr-0.5">モード:</span>
            <Button
              size="sm"
              variant={effectiveDrawMode === "select" ? "default" : "outline"}
              onClick={() => onDrawModeChange("select")}
              className={`text-xs h-7 px-2 gap-1 ${flashIndex === 0 ? flashClass : ""}`}
            >
              選択
              <KeyBadge num={0} isActive={effectiveDrawMode === "select"} />
            </Button>
            {workTypes.map((wt, idx) => {
              const cfg = wtConfigMap.get(wt.code)
              if (!cfg) return null
              const isActive = effectiveDrawMode === wt.code
              const keyNum = idx + 1
              return (
                <Button
                  key={wt.code}
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  onClick={() => onDrawModeChange(drawMode === wt.code ? "select" : wt.code)}
                  className={`text-xs h-7 px-2 gap-1 ${isActive ? "" : `${cfg.text} border-current`} ${flashIndex === keyNum ? flashClass : ""}`}
                >
                  <span className={`inline-block w-2.5 h-2.5 rounded-sm ${isActive ? "bg-white/80" : cfg.actual}`} />{cfg.label}
                  <KeyBadge num={keyNum} isActive={isActive} />
                </Button>
              )
            })}
            <div className="w-px h-4 bg-slate-200" />
          </>
        )}
        <div className="flex items-center gap-0.5">
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onMouseDown={() => startRepeat(-7)} onMouseUp={stopRepeat} onMouseLeave={stopRepeat}>
            <ChevronsLeft className="w-3 h-3" />
          </Button>
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onMouseDown={() => startRepeat(-1)} onMouseUp={stopRepeat} onMouseLeave={stopRepeat}>
            <ChevronLeft className="w-3 h-3" />
          </Button>
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onMouseDown={() => startRepeat(1)} onMouseUp={stopRepeat} onMouseLeave={stopRepeat}>
            <ChevronRight className="w-3 h-3" />
          </Button>
          <Button variant="outline" size="sm" className="h-7 w-7 p-0" onMouseDown={() => startRepeat(7)} onMouseUp={stopRepeat} onMouseLeave={stopRepeat}>
            <ChevronsRight className="w-3 h-3" />
          </Button>
        </div>
        <Button variant="ghost" size="sm" className="text-xs h-7 px-1.5" onClick={onGoToToday}>今日</Button>
        {onCalendarOpen && (
          <>
            <div className="w-px h-4 bg-slate-200" />
            <Button variant="ghost" size="sm" className="text-xs h-7 px-1.5 gap-1 text-blue-600 hover:text-blue-700" onClick={onCalendarOpen}>
              <CalendarDays className="w-3 h-3" />カレンダー
            </Button>
          </>
        )}
        <span className="text-xs text-slate-600 ml-auto">{format(rangeStart, "M/d")} 〜 {format(rangeEnd, "M/d")}（{displayDays}日）</span>
      </div>
    )
  }

  // Full variant (ScheduleGantt)
  return (
    <div className="bg-white border rounded-xl p-2.5 space-y-2">
      {/* 1行目: モード + 矢印 + 日付範囲 */}
      <div className="flex items-center gap-2 overflow-hidden">
        <span className="text-xs text-slate-500 font-medium flex-shrink-0">モード:</span>
        <Button
          size="sm"
          variant={effectiveDrawMode === "select" ? "default" : "outline"}
          onClick={() => onDrawModeChange("select")}
          className={`text-xs gap-1.5 h-8 flex-shrink-0 ${flashIndex === 0 ? flashClass : ""}`}
        >
          <MousePointerClick className="w-3.5 h-3.5" />選択
          <KeyBadge num={0} isActive={effectiveDrawMode === "select"} size="md" />
        </Button>
        <div className="w-px h-6 bg-slate-200 flex-shrink-0" />
        {workTypes.map((wt, idx) => {
          const cfg = wtConfigMap.get(wt.code)
          if (!cfg) return null
          const isActive = effectiveDrawMode === wt.code
          const keyNum = idx + 1
          return (
            <Button
              key={wt.code}
              size="sm"
              variant={isActive ? "default" : "outline"}
              onClick={() => onDrawModeChange(drawMode === wt.code ? "select" : wt.code)}
              className={`text-xs gap-1 h-8 flex-shrink-0 ${isActive ? "" : `${cfg.text} border-current`} ${flashIndex === keyNum ? flashClass : ""}`}
            >
              <span className={`inline-block w-3 h-3 rounded-sm ${isActive ? "bg-white/80" : cfg.actual}`} />{cfg.label}
              <KeyBadge num={keyNum} isActive={isActive} size="md" />
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
          <span className="text-slate-600 ml-1">（{displayDays}日）</span>
        </span>
      </div>
      {/* 2行目: 表示日数 + 開始日 + 今日 + 検索 + カレンダー */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <span className="text-xs text-slate-600">幅:</span>
          {DISPLAY_DAYS_PRESETS.map((d) => (
            <Button key={d} variant={displayDays === d ? "default" : "ghost"} size="sm" className="h-7 px-1.5 text-xs flex-shrink-0" onClick={() => onDisplayDaysChange?.(d)}>{d}日</Button>
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
            <div className="relative w-44 flex-shrink-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input placeholder="検索" value={search ?? ""} onChange={(e) => onSearchChange(e.target.value)} className="pl-8 h-7 text-xs" />
            </div>
          </>
        )}
        {onCalendarOpen && (
          <>
            <div className="w-px h-5 bg-slate-200 flex-shrink-0" />
            <Button variant="outline" size="sm" className="text-xs h-7 gap-1.5 flex-shrink-0 text-blue-600 border-blue-200 hover:bg-blue-50" onClick={onCalendarOpen}>
              <CalendarDays className="w-3.5 h-3.5" />
              カレンダーで追加
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * [COMPONENT] 画面外工程インジケーター（左右共通）
 *
 * カレンダー表示範囲の外にある工程をホバーリストで表示。
 * 各項目をクリックするとその工程の日付に遷移。
 * 班ビュー・現場ビューの両方で使用。
 */
"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { format } from "date-fns"
import { ja } from "date-fns/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { subDays, parseISO } from "date-fns"
import { workTypeLabel } from "./types"

// ── 共通型 ──

export interface OverflowItem {
  id: string
  name: string | null
  plannedStartDate: string | null
  plannedEndDate: string | null
  workType: string
  contract: { project: { name: string } }
}

export interface OverflowData {
  left: { count: number; items: OverflowItem[] }
  right: { count: number; items: OverflowItem[] }
}

export const EMPTY_OVERFLOW: OverflowData = {
  left: { count: 0, items: [] },
  right: { count: 0, items: [] },
}

// ── ユーティリティ ──

export function formatDateRange(start: string | null, end: string | null) {
  if (!start) return "日程未定"
  const s = format(new Date(start), "M/d", { locale: ja })
  const e = end ? format(new Date(end), "M/d", { locale: ja }) : s
  return `${s}〜${e}`
}

export function navigateToScheduleDate(
  dateStr: string | null,
  onRangeStartChange: (date: Date) => void
) {
  if (!dateStr) return
  const d = subDays(parseISO(dateStr), 2)
  onRangeStartChange(d)
}

// ── コンポーネント ──

interface OverflowIndicatorProps {
  side: "left" | "right"
  count: number
  items: OverflowItem[]
  onNavigate: (date: Date) => void
}

export function OverflowIndicator({ side, count, items, onNavigate }: OverflowIndicatorProps) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  if (count <= 0) return null

  const isLeft = side === "left"

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  const handleMouseEnter = () => {
    clearCloseTimer()
    setOpen(true)
  }

  const handleMouseLeave = () => {
    clearCloseTimer()
    closeTimer.current = setTimeout(() => setOpen(false), 300)
  }

  const handleItemClick = (plannedStartDate: string | null) => {
    setOpen(false)
    navigateToScheduleDate(plannedStartDate, onNavigate)
  }

  return (
    <div
      className={`absolute ${isLeft ? "left-0" : "right-0"} top-12 z-30 pointer-events-none`}
    >
      <div
        ref={containerRef}
        className={`pointer-events-auto mt-2 ${isLeft ? "ml-1" : "mr-1"} relative`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button
          className={`flex items-center gap-1 px-2.5 py-2 ${
            isLeft ? "rounded-r-lg" : "rounded-l-lg"
          } bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors`}
        >
          {isLeft && <ChevronLeft className="w-4 h-4" />}
          <div className="text-xs font-bold">{count}件</div>
          {!isLeft && <ChevronRight className="w-4 h-4" />}
        </button>

        {/* ホバーで表示されるリスト */}
        {open && (
          <div
            className={`absolute ${isLeft ? "left-0" : "right-0"} z-40`}
            style={{ top: "100%", paddingTop: 4 }}
          >
            <div className="bg-white border border-slate-200 rounded-lg shadow-xl py-1 min-w-[280px] max-h-[320px] overflow-y-auto">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 border-b border-slate-100">
                {isLeft ? "手前の現場" : "この先の現場"}（{count}件）
              </div>
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.plannedStartDate)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors flex items-start gap-2 border-b border-slate-50 last:border-b-0"
                >
                  {isLeft && (
                    <ChevronLeft className="w-3.5 h-3.5 text-slate-300 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-slate-800 truncate">
                      {item.name ?? item.contract.project.name}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-400">
                        {formatDateRange(item.plannedStartDate, item.plannedEndDate)}
                      </span>
                      <span className="text-[9px] px-1 rounded bg-slate-100 text-slate-500">
                        {workTypeLabel(item.workType)}
                      </span>
                    </div>
                  </div>
                  {!isLeft && (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 mt-0.5 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

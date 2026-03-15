/**
 * [COMPONENT] 工程表示モード切替（リスト/ガント）
 *
 * 商談一覧・契約一覧の工程セクションで共通使用
 */
"use client"

import { List, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ScheduleViewToggleProps {
  viewMode: "list" | "gantt"
  onViewModeChange: (mode: "list" | "gantt") => void
}

export function ScheduleViewToggle({ viewMode, onViewModeChange }: ScheduleViewToggleProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onViewModeChange("list")}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm font-bold transition-all active:scale-95",
          viewMode === "list"
            ? "bg-blue-500 text-white shadow-lg shadow-blue-200"
            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
        )}
      >
        <List className="w-3.5 h-3.5" />
        リスト
      </button>
      <button
        onClick={() => onViewModeChange("gantt")}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm font-bold transition-all active:scale-95",
          viewMode === "gantt"
            ? "bg-blue-500 text-white shadow-lg shadow-blue-200"
            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
        )}
      >
        <BarChart3 className="w-3.5 h-3.5" />
        ガント
      </button>
    </div>
  )
}

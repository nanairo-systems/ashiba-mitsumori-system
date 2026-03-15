/**
 * [COMPONENT] リスト表示用の工程追加フォーム
 *
 * 商談一覧・契約一覧の工程セクション（リストモード）で共通使用
 */
"use client"

import { useState } from "react"
import { Plus, CalendarDays, X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const WORK_TYPE_OPTIONS: { code: string; label: string; className: string }[] = [
  { code: "ASSEMBLY", label: "組立", className: "bg-blue-100 text-blue-700 border-blue-300" },
  { code: "DISASSEMBLY", label: "解体", className: "bg-orange-100 text-orange-700 border-orange-300" },
  { code: "REWORK", label: "その他", className: "bg-slate-100 text-slate-600 border-slate-300" },
]

interface ListScheduleAdderProps {
  projectId: string
  workContentId?: string
  contractId?: string
  groupName?: string
  onCreated: () => void
}

export function ListScheduleAdder({ projectId, workContentId, contractId, groupName, onCreated }: ListScheduleAdderProps) {
  const [open, setOpen] = useState(false)
  const [workType, setWorkType] = useState("ASSEMBLY")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!startDate || !endDate) {
      toast.error("開始日と終了日を入力してください")
      return
    }
    if (new Date(endDate) < new Date(startDate)) {
      toast.error("終了日は開始日以降にしてください")
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          ...(workContentId ? { workContentId } : {}),
          ...(contractId ? { contractId } : {}),
          workType,
          name: groupName || null,
          plannedStartDate: startDate,
          plannedEndDate: endDate,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success("工事日程を追加しました")
      setOpen(false)
      setStartDate("")
      setEndDate("")
      onCreated()
    } catch {
      toast.error("追加に失敗しました")
    } finally {
      setCreating(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50/50 text-blue-600 font-bold text-sm hover:bg-blue-100 hover:border-blue-400 active:scale-[0.98] transition-all"
      >
        <Plus className="w-4 h-4" />
        工事日程を追加
      </button>
    )
  }

  return (
    <div className="mt-3 rounded-lg border-2 border-blue-300 bg-blue-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-extrabold text-blue-800 flex items-center gap-1.5">
          <CalendarDays className="w-4 h-4" />
          工事日程を追加
        </h4>
        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 工種選択 */}
      <div>
        <label className="text-xs font-bold text-slate-600 mb-1.5 block">工種</label>
        <div className="flex gap-1.5">
          {WORK_TYPE_OPTIONS.map((wt) => (
            <button
              key={wt.code}
              type="button"
              onClick={() => setWorkType(wt.code)}
              className={cn(
                "flex-1 py-2 rounded-md text-xs font-bold border-2 transition-all active:scale-95",
                workType === wt.code
                  ? `${wt.className} border-current shadow-sm`
                  : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
              )}
            >
              {wt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 日付選択 */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-bold text-slate-600 mb-1 block">開始日 <span className="text-red-500">*</span></label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value)
              if (!endDate || new Date(e.target.value) > new Date(endDate)) {
                setEndDate(e.target.value)
              }
            }}
            className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-md focus:outline-none focus:border-blue-400 bg-white"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600 mb-1 block">終了日 <span className="text-red-500">*</span></label>
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-md focus:outline-none focus:border-blue-400 bg-white"
          />
        </div>
      </div>

      {/* 作成ボタン */}
      <button
        type="button"
        onClick={handleCreate}
        disabled={creating || !startDate || !endDate}
        className="w-full py-2.5 rounded-lg text-sm font-extrabold bg-blue-500 text-white hover:bg-blue-600 active:scale-[0.98] transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {creating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin inline" /> : <Plus className="w-4 h-4 mr-1.5 inline" />}
        {creating ? "作成中..." : "追加する"}
      </button>
    </div>
  )
}

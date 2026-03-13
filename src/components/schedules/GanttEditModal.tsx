/**
 * [COMPONENT] ガントチャート 編集モーダル
 *
 * スケジュールの予定/実績期間・人数・備考を編集するモーダル。
 * ScheduleGantt と ContractDetail の両方で使用。
 */
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Pencil, Trash2, X, Users } from "lucide-react"
import { toast } from "sonner"
import type { ScheduleData, WorkTypeConfig } from "./schedule-types"
import { FALLBACK_WT_CONFIG } from "./schedule-constants"

interface GanttEditModalProps {
  schedule: ScheduleData
  wtConfig?: WorkTypeConfig
  onClose: () => void
  onUpdated: () => void
}

export function GanttEditModal({ schedule, wtConfig, onClose, onUpdated }: GanttEditModalProps) {
  const [editPlannedStart, setEditPlannedStart] = useState(schedule.plannedStartDate?.slice(0, 10) ?? "")
  const [editPlannedEnd, setEditPlannedEnd] = useState(schedule.plannedEndDate?.slice(0, 10) ?? "")
  const [editActualStart, setEditActualStart] = useState(schedule.actualStartDate?.slice(0, 10) ?? "")
  const [editActualEnd, setEditActualEnd] = useState(schedule.actualEndDate?.slice(0, 10) ?? "")
  const [editWorkers, setEditWorkers] = useState(schedule.workersCount?.toString() ?? "")
  const [editNotes, setEditNotes] = useState(schedule.notes ?? "")
  const [saving, setSaving] = useState(false)

  // スケジュールが変わったら値をリセット
  useEffect(() => {
    setEditPlannedStart(schedule.plannedStartDate?.slice(0, 10) ?? "")
    setEditPlannedEnd(schedule.plannedEndDate?.slice(0, 10) ?? "")
    setEditActualStart(schedule.actualStartDate?.slice(0, 10) ?? "")
    setEditActualEnd(schedule.actualEndDate?.slice(0, 10) ?? "")
    setEditWorkers(schedule.workersCount?.toString() ?? "")
    setEditNotes(schedule.notes ?? "")
  }, [schedule])

  async function handleUpdate() {
    setSaving(true)
    try {
      const res = await fetch(`/api/schedules/${schedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plannedStartDate: editPlannedStart || null,
          plannedEndDate: editPlannedEnd || null,
          actualStartDate: editActualStart || null,
          actualEndDate: editActualEnd || null,
          workersCount: editWorkers ? parseInt(editWorkers) : null,
          notes: editNotes.trim() || null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success("更新しました")
      onClose()
      onUpdated()
    } catch {
      toast.error("更新に失敗しました")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm("この工事日程を削除しますか？")) return
    const res = await fetch(`/api/schedules/${schedule.id}`, { method: "DELETE" })
    if (res.ok) {
      toast.success("削除しました")
      onClose()
      onUpdated()
    } else {
      toast.error("削除に失敗しました")
    }
  }

  const cfg = wtConfig ?? FALLBACK_WT_CONFIG

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-[340px] p-4 space-y-3 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`inline-block w-3 h-3 rounded-sm ${cfg.actual}`} />
            <span className="text-sm font-bold text-slate-800">{cfg.label}</span>
            {schedule.name && (
              <span className="text-xs text-slate-400">({schedule.name})</span>
            )}
            <Pencil className="w-3 h-3 text-slate-400" />
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-slate-500">予定期間</Label>
          <div className="flex items-center gap-2">
            <div className="flex-1 space-y-1">
              <span className="text-xs text-slate-400">開始</span>
              <Input type="date" value={editPlannedStart} onChange={(e) => setEditPlannedStart(e.target.value)} className="h-8 text-xs" />
            </div>
            <span className="text-xs text-slate-400 pt-5">〜</span>
            <div className="flex-1 space-y-1">
              <span className="text-xs text-slate-400">終了</span>
              <Input type="date" value={editPlannedEnd} onChange={(e) => setEditPlannedEnd(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-slate-500">実績期間</Label>
          <div className="flex items-center gap-2">
            <div className="flex-1 space-y-1">
              <span className="text-xs text-slate-400">実績開始日</span>
              <Input type="date" value={editActualStart} onChange={(e) => setEditActualStart(e.target.value)} className="h-8 text-xs" />
            </div>
            <span className="text-xs text-slate-400 pt-5">〜</span>
            <div className="flex-1 space-y-1">
              <span className="text-xs text-slate-400">実績終了日</span>
              <Input type="date" value={editActualEnd} onChange={(e) => setEditActualEnd(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="space-y-1 flex-1">
            <Label className="text-xs text-slate-500 flex items-center gap-1"><Users className="w-3 h-3" />人数</Label>
            <Input type="number" min={1} value={editWorkers} onChange={(e) => setEditWorkers(e.target.value)} className="h-8 text-xs" placeholder="—" />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-slate-500">備考</Label>
          <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} className="text-xs" placeholder="メモ" />
        </div>

        <div className="flex items-center justify-between pt-1">
          <Button variant="ghost" size="sm" className="text-xs text-red-600 hover:bg-red-50 gap-1 h-7" onClick={handleDelete}>
            <Trash2 className="w-3 h-3" />削除
          </Button>
          <Button size="sm" className="text-xs h-7" onClick={handleUpdate} disabled={saving}>
            {saving ? "保存中..." : "更新"}
          </Button>
        </div>
      </div>
    </div>
  )
}

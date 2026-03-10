/**
 * [COMPONENT] 工程 作成/編集ダイアログ - ScheduleFormDialog
 *
 * カレンダーからの工程作成・既存工程の編集に使用する共通ダイアログ。
 * schedule prop が未指定 → 新規作成、指定あり → 編集。
 */
"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import type { ScheduleData, WorkTypeMaster } from "./schedule-types"

interface Props {
  open: boolean
  onClose: () => void
  contractId: string
  workTypes: WorkTypeMaster[]
  initialDate?: string
  schedule?: ScheduleData
  onSaved: () => void
  onDeleted?: () => void
}

export function ScheduleFormDialog({
  open,
  onClose,
  contractId,
  workTypes,
  initialDate,
  schedule,
  onSaved,
  onDeleted,
}: Props) {
  const isEdit = !!schedule
  const defaultWorkType = schedule?.workType ?? workTypes[0]?.code ?? ""

  const [workType, setWorkType] = useState(defaultWorkType)
  const [name, setName] = useState(schedule?.name ?? "")
  const [plannedStart, setPlannedStart] = useState(
    schedule?.plannedStartDate?.slice(0, 10) ?? initialDate ?? ""
  )
  const [plannedEnd, setPlannedEnd] = useState(
    schedule?.plannedEndDate?.slice(0, 10) ?? initialDate ?? ""
  )
  const [workersCount, setWorkersCount] = useState(
    schedule?.workersCount?.toString() ?? ""
  )
  const [notes, setNotes] = useState(schedule?.notes ?? "")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSave() {
    if (!workType) {
      toast.error("工種を選択してください")
      return
    }
    if (!plannedStart || !plannedEnd) {
      toast.error("予定期間を入力してください")
      return
    }
    if (plannedStart > plannedEnd) {
      toast.error("終了日は開始日以降を指定してください")
      return
    }

    setSaving(true)
    try {
      if (isEdit) {
        const res = await fetch(`/api/schedules/${schedule!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workType,
            name: name.trim() || null,
            plannedStartDate: plannedStart,
            plannedEndDate: plannedEnd,
            workersCount: workersCount ? parseInt(workersCount) : null,
            notes: notes.trim() || null,
          }),
        })
        if (!res.ok) throw new Error()
        toast.success("工程を更新しました")
      } else {
        const res = await fetch(`/api/contracts/${contractId}/schedules`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workType,
            name: name.trim() || null,
            plannedStartDate: plannedStart,
            plannedEndDate: plannedEnd,
            workersCount: workersCount ? parseInt(workersCount) : null,
            notes: notes.trim() || null,
          }),
        })
        if (!res.ok) throw new Error()
        toast.success("工程を追加しました")
      }
      onSaved()
      onClose()
    } catch {
      toast.error("保存に失敗しました")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!schedule) return
    if (!confirm("この工程を削除しますか？")) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/schedules/${schedule.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("工程を削除しました")
      onDeleted?.()
      onClose()
    } catch {
      toast.error("削除に失敗しました")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "工程を編集" : "工程を追加"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 工種 */}
          <div className="space-y-1.5">
            <Label>
              工種 <span className="text-red-500">*</span>
            </Label>
            <Select value={workType} onValueChange={setWorkType}>
              <SelectTrigger>
                <SelectValue placeholder="工種を選択" />
              </SelectTrigger>
              <SelectContent>
                {workTypes.map((wt) => (
                  <SelectItem key={wt.code} value={wt.code}>
                    {wt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 作業内容名 */}
          <div className="space-y-1.5">
            <Label>作業内容名</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 第1棟 組立工事"
              maxLength={100}
            />
          </div>

          {/* 予定期間 */}
          <div className="space-y-1.5">
            <Label>
              予定期間 <span className="text-red-500">*</span>
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={plannedStart}
                onChange={(e) => {
                  setPlannedStart(e.target.value)
                  if (!plannedEnd || e.target.value > plannedEnd) {
                    setPlannedEnd(e.target.value)
                  }
                }}
                className="flex-1"
              />
              <span className="text-slate-600 text-sm flex-shrink-0">〜</span>
              <Input
                type="date"
                value={plannedEnd}
                min={plannedStart}
                onChange={(e) => setPlannedEnd(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>

          {/* 予定人数 */}
          <div className="space-y-1.5">
            <Label>予定人数</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={workersCount}
                onChange={(e) => setWorkersCount(e.target.value)}
                placeholder="人数"
                min={1}
                className="w-28"
              />
              <span className="text-sm text-slate-500">名</span>
            </div>
          </div>

          {/* 備考 */}
          <div className="space-y-1.5">
            <Label>備考</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="メモ・備考"
              maxLength={500}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex-row justify-between">
          <div>
            {isEdit && (
              <Button
                variant="ghost"
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={handleDelete}
                disabled={deleting || saving}
              >
                {deleting ? "削除中..." : "削除"}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

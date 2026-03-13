/**
 * [COMPONENT] 工程グループ 詳細モーダル
 *
 * 行ヘッダーの作業内容セルをクリックすると開くモーダル。
 * - 作業名の変更
 * - 工事内容（メモ）の入力
 * - 工程別の予定日程（開始日・終了日）の編集
 */
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ClipboardList, X } from "lucide-react"
import { toast } from "sonner"
import type { ScheduleGroup, WorkTypeConfig } from "./schedule-types"

interface GroupDetailModalProps {
  contractId: string
  group: ScheduleGroup
  wtConfigMap: Map<string, WorkTypeConfig>
  onClose: () => void
  onUpdated: () => void
}

export function GroupDetailModal({
  group,
  wtConfigMap,
  onClose,
  onUpdated,
}: GroupDetailModalProps) {
  const [groupName, setGroupName] = useState(group.name ?? "")
  const [workContent, setWorkContent] = useState(group.schedules[0]?.notes ?? "")
  const [scheduleDates, setScheduleDates] = useState<Record<string, { start: string; end: string }>>(
    () =>
      Object.fromEntries(
        group.schedules.map((s) => [
          s.id,
          {
            start: s.plannedStartDate?.slice(0, 10) ?? "",
            end: s.plannedEndDate?.slice(0, 10) ?? "",
          },
        ])
      )
  )
  const [saving, setSaving] = useState(false)

  function updateDate(id: string, field: "start" | "end", value: string) {
    setScheduleDates((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const patches: Promise<Response>[] = []

      const nameChanged = groupName.trim() !== (group.name ?? "")
      const contentChanged = workContent !== (group.schedules[0]?.notes ?? "")

      // 名前・工事内容は全スケジュールに適用
      for (const s of group.schedules) {
        const body: Record<string, unknown> = {}
        if (nameChanged) body.name = groupName.trim() || null
        if (contentChanged) body.notes = workContent.trim() || null

        // 日程変更チェック
        const orig = { start: s.plannedStartDate?.slice(0, 10) ?? "", end: s.plannedEndDate?.slice(0, 10) ?? "" }
        const curr = scheduleDates[s.id]
        if (curr.start !== orig.start) body.plannedStartDate = curr.start || null
        if (curr.end !== orig.end) body.plannedEndDate = curr.end || null

        if (Object.keys(body).length > 0) {
          patches.push(
            fetch(`/api/schedules/${s.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            })
          )
        }
      }

      if (patches.length === 0) {
        onClose()
        return
      }

      const results = await Promise.all(patches)
      if (results.some((r) => !r.ok)) throw new Error()

      toast.success("保存しました")
      onUpdated()
    } catch {
      toast.error("保存に失敗しました")
    } finally {
      setSaving(false)
    }
  }

  // FALLBACK_WT_CONFIG と同じ形
  const fallbackConfig: WorkTypeConfig = {
    label: "不明",
    short: "?",
    planned: "bg-slate-400",
    actual: "bg-slate-500",
    text: "text-slate-700",
    bg: "bg-slate-100",
    border: "border-slate-300",
    cursor: "cursor-pointer",
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-[400px] p-5 space-y-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-bold text-slate-800">作業詳細</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 作業名 */}
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-500">作業名</Label>
          <Input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="作業名を入力"
            className="h-8 text-sm"
            maxLength={100}
          />
        </div>

        {/* 工事内容 */}
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-500">工事内容</Label>
          <Textarea
            value={workContent}
            onChange={(e) => setWorkContent(e.target.value)}
            rows={3}
            className="text-sm resize-none"
            placeholder="工事の詳細・注意事項など"
            maxLength={500}
          />
          <p className="text-xs text-slate-600 text-right">{workContent.length}/500</p>
        </div>

        {/* 工程別日程 */}
        {group.schedules.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-slate-500">工事日程（予定）</Label>
            <div className="space-y-2">
              {group.schedules.map((s) => {
                const cfg = wtConfigMap.get(s.workType) ?? fallbackConfig
                const dates = scheduleDates[s.id]
                return (
                  <div key={s.id} className="flex items-center gap-2">
                    {/* 工種ラベル */}
                    <span
                      className={`inline-flex items-center justify-center w-12 px-1 py-0.5 rounded text-xs font-medium flex-shrink-0 ${cfg.bg} ${cfg.text}`}
                    >
                      {cfg.short}
                    </span>
                    {/* 日程 */}
                    <Input
                      type="date"
                      value={dates.start}
                      onChange={(e) => updateDate(s.id, "start", e.target.value)}
                      className="h-7 text-xs flex-1"
                    />
                    <span className="text-xs text-slate-600 flex-shrink-0">〜</span>
                    <Input
                      type="date"
                      value={dates.end}
                      onChange={(e) => updateDate(s.id, "end", e.target.value)}
                      className="h-7 text-xs flex-1"
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* アクション */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" className="text-xs h-8" onClick={onClose}>
            キャンセル
          </Button>
          <Button size="sm" className="text-xs h-8" onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>
    </div>
  )
}

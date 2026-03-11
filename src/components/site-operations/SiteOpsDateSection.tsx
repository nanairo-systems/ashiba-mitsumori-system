/**
 * [現操-04] 全工程 日程・種別一覧セクション
 *
 * 同一プロジェクトの全工程を一覧表示し、各工程の日程・作業種別を
 * インライン編集可能にする。新規工程の追加もここから行える。
 */
"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2, Save, Plus, Trash2, Check, X, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { format, addDays as addDaysFn, parseISO } from "date-fns"
import type { ScheduleData } from "@/components/worker-assignments/types"

/** 作業種別マスター型 */
interface WorkTypeMaster {
  id: string
  code: string
  label: string
  shortLabel: string
  colorIndex: number
  sortOrder: number
  isActive: boolean
}

/** 作業種別のスタイル（マスター取得失敗時のフォールバック） */
const WORK_TYPE_STYLES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  ASSEMBLY: { label: "組立", bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300" },
  DISASSEMBLY: { label: "解体", bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-300" },
  REWORK: { label: "その他", bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-300" },
}

function toInputDate(dateStr: string | null): string {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return "未定"
  return format(new Date(dateStr), "M/d")
}

function calcDays(start: string | null, end: string | null): number | null {
  if (!start || !end) return null
  const s = new Date(start)
  const e = new Date(end)
  s.setHours(0, 0, 0, 0)
  e.setHours(0, 0, 0, 0)
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1
  return diff > 0 ? diff : null
}

/** 日数プリセット */
const DAY_PRESETS = [1, 2, 3, 5, 7] as const

/** 開始日 + 日数 → 終了日（yyyy-MM-dd） */
function endDateFromDays(startDate: string, days: number): string {
  if (!startDate) return ""
  const d = addDaysFn(parseISO(startDate), days - 1)
  return format(d, "yyyy-MM-dd")
}

interface Props {
  /** 現在選択中の工程ID */
  activeScheduleId: string
  /** 同一プロジェクトの全工程 */
  siblings: ScheduleData[]
  /** プロジェクトID（新規追加用） */
  projectId: string
  /** 作業内容グループ名（新規工程に自動継承） */
  groupName?: string | null
  onUpdated?: () => void
}

/** 編集中の状態 */
interface EditState {
  scheduleId: string
  startDate: string
  endDate: string
  workType: string
}

export function SiteOpsDateSection({ activeScheduleId, siblings, projectId, groupName, onUpdated }: Props) {
  // 作業種別マスターをAPIから取得
  const [workTypes, setWorkTypes] = useState<WorkTypeMaster[]>([])
  useEffect(() => {
    fetch("/api/schedule-work-types")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setWorkTypes(data))
      .catch(() => {})
  }, [])

  // 編集中の工程
  const [editing, setEditing] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)

  // 新規追加フォーム
  const [showAddForm, setShowAddForm] = useState(false)
  const [newWorkType, setNewWorkType] = useState("")
  const [newStartDate, setNewStartDate] = useState("")
  const [newEndDate, setNewEndDate] = useState("")
  const [adding, setAdding] = useState(false)

  // 削除中
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // 作業種別の表示情報
  const getWorkTypeInfo = useCallback((code: string) => {
    const fromMaster = workTypes.find((wt) => wt.code === code)
    if (fromMaster) {
      const fallback = WORK_TYPE_STYLES[code] ?? WORK_TYPE_STYLES.REWORK
      return { ...fallback, label: fromMaster.label }
    }
    return WORK_TYPE_STYLES[code] ?? WORK_TYPE_STYLES.REWORK
  }, [workTypes])

  // 表示用: マスターデータがあればそこから、なければフォールバック
  const workTypeOptions = workTypes.length > 0
    ? workTypes.filter((wt) => wt.isActive).map((wt) => ({ code: wt.code, label: wt.label }))
    : Object.entries(WORK_TYPE_STYLES).map(([code, { label }]) => ({ code, label }))

  // 編集開始
  function startEdit(s: ScheduleData) {
    setEditing({
      scheduleId: s.id,
      startDate: toInputDate(s.plannedStartDate),
      endDate: toInputDate(s.plannedEndDate),
      workType: s.workType,
    })
  }

  // 編集キャンセル
  function cancelEdit() {
    setEditing(null)
  }

  // 編集保存
  async function saveEdit() {
    if (!editing) return
    const original = siblings.find((s) => s.id === editing.scheduleId)
    if (!original) return

    const hasChanges =
      editing.startDate !== toInputDate(original.plannedStartDate) ||
      editing.endDate !== toInputDate(original.plannedEndDate) ||
      editing.workType !== original.workType

    if (!hasChanges) {
      setEditing(null)
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/schedules/${editing.scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plannedStartDate: editing.startDate || null,
          plannedEndDate: editing.endDate || null,
          workType: editing.workType,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success("工程を更新しました")
      setEditing(null)
      onUpdated?.()
    } catch {
      toast.error("更新に失敗しました")
    } finally {
      setSaving(false)
    }
  }

  // 新規追加
  async function handleAdd() {
    if (!newWorkType || !newStartDate || !newEndDate) {
      toast.error("作業種別と日程を入力してください")
      return
    }
    setAdding(true)
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          workType: newWorkType,
          name: groupName || null,
          plannedStartDate: newStartDate,
          plannedEndDate: newEndDate,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? "追加に失敗しました")
      }
      toast.success("工程を追加しました")
      setShowAddForm(false)
      setNewWorkType("")
      setNewStartDate("")
      setNewEndDate("")
      onUpdated?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "追加に失敗しました"
      toast.error(msg)
    } finally {
      setAdding(false)
    }
  }

  // 削除
  async function handleDelete(scheduleId: string) {
    const target = siblings.find((s) => s.id === scheduleId)
    const label = target?.name ?? getWorkTypeInfo(target?.workType ?? "").label
    const ok = window.confirm(`「${label}」を削除しますか？\nこの操作は取り消せません。`)
    if (!ok) return

    setDeletingId(scheduleId)
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success(`「${label}」を削除しました`)
      onUpdated?.()
    } catch {
      toast.error("削除に失敗しました")
    } finally {
      setDeletingId(null)
    }
  }

  // ソート: sortOrder(workType) → plannedStartDate
  const sorted = [...siblings].sort((a, b) => {
    const aIdx = workTypeOptions.findIndex((o) => o.code === a.workType)
    const bIdx = workTypeOptions.findIndex((o) => o.code === b.workType)
    if (aIdx !== bIdx) return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx)
    const aDate = a.plannedStartDate ?? ""
    const bDate = b.plannedStartDate ?? ""
    return aDate.localeCompare(bDate)
  })

  return (
    <div className="space-y-2">
      {/* 工程一覧（横並び） */}
      <div className="flex gap-1.5 flex-wrap">
        {sorted.map((s) => {
          const wtInfo = getWorkTypeInfo(s.workType)
          const isActive = s.id === activeScheduleId
          const isEditing = editing?.scheduleId === s.id
          const days = calcDays(s.plannedStartDate, s.plannedEndDate)
          const isDeleting = deletingId === s.id

          if (isEditing && editing) {
            // 編集モード
            return (
              <div
                key={s.id}
                className="rounded-lg border-2 border-blue-300 bg-blue-50/30 p-2.5 space-y-2"
              >
                {/* 作業種別選択 */}
                <div>
                  <Label className="text-xs text-slate-500 font-semibold mb-1 block">作業種別</Label>
                  <div className="flex gap-1 flex-wrap">
                    {workTypeOptions.map((opt) => {
                      const style = WORK_TYPE_STYLES[opt.code] ?? WORK_TYPE_STYLES.REWORK
                      const isSelected = editing.workType === opt.code
                      return (
                        <button
                          key={opt.code}
                          onClick={() => setEditing({ ...editing, workType: opt.code })}
                          className={cn(
                            "text-xs font-medium px-2 py-1 rounded-md border transition-all",
                            isSelected
                              ? `${style.bg} ${style.text} ${style.border} ring-1 ring-blue-400`
                              : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"
                          )}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 日程入力 */}
                <div className="space-y-1.5">
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label className="text-xs text-slate-500 font-semibold mb-0.5 block">開始</Label>
                      <Input
                        type="date"
                        className="h-7 text-xs"
                        value={editing.startDate}
                        onChange={(e) => setEditing({ ...editing, startDate: e.target.value })}
                      />
                    </div>
                    <span className="text-xs text-slate-300 pb-1.5">〜</span>
                    <div className="flex-1">
                      <Label className="text-xs text-slate-500 font-semibold mb-0.5 block">終了</Label>
                      <Input
                        type="date"
                        className="h-7 text-xs"
                        value={editing.endDate}
                        onChange={(e) => setEditing({ ...editing, endDate: e.target.value })}
                      />
                    </div>
                  </div>
                  {/* 日数プリセットボタン */}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-500 mr-0.5">日数:</span>
                    {DAY_PRESETS.map((d) => {
                      const currentDays = calcDays(editing.startDate, editing.endDate)
                      const isMatch = currentDays === d
                      return (
                        <button
                          key={d}
                          onClick={() => {
                            if (editing.startDate) {
                              setEditing({ ...editing, endDate: endDateFromDays(editing.startDate, d) })
                            }
                          }}
                          disabled={!editing.startDate}
                          className={cn(
                            "h-7 min-w-[32px] px-1.5 rounded text-xs font-medium border transition-all",
                            isMatch
                              ? "bg-blue-500 text-white border-blue-500 shadow-sm"
                              : editing.startDate
                              ? "bg-white text-slate-500 border-slate-200 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50"
                              : "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed"
                          )}
                        >
                          {d}日
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 削除/保存/キャンセル */}
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDelete(editing.scheduleId)}
                    disabled={saving || deletingId === editing.scheduleId}
                  >
                    {deletingId === editing.scheduleId
                      ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      : <Trash2 className="w-3 h-3 mr-1" />}
                    削除
                  </Button>
                  <div className="flex-1" />
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={cancelEdit} disabled={saving}>
                    <X className="w-3 h-3 mr-1" />キャンセル
                  </Button>
                  <Button size="sm" className="h-7 text-xs" onClick={saveEdit} disabled={saving}>
                    {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                    保存
                  </Button>
                </div>
              </div>
            )
          }

          // 表示モード（コンパクトカード — 横2〜3個並び）
          return (
            <div
              key={s.id}
              className={cn(
                "group relative rounded-lg border p-2.5 transition-all cursor-pointer hover:bg-slate-50 min-w-[140px] flex-1 basis-[calc(33.333%-0.375rem)] max-w-[calc(50%-0.375rem)]",
                isActive
                  ? "border-blue-200 bg-blue-50/40"
                  : "border-slate-200 bg-white"
              )}
              onClick={() => startEdit(s)}
              title="クリックで編集"
            >
              {/* 1行目: バッジ + ステータス */}
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "text-xs font-bold px-2 py-0.5 rounded-md border flex-shrink-0",
                  wtInfo.bg, wtInfo.text, wtInfo.border
                )}>
                  {wtInfo.label}
                </span>
                {s.actualEndDate ? (
                  <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 bg-green-50 text-green-700 border-green-200 font-semibold ml-auto flex-shrink-0">完工</Badge>
                ) : s.actualStartDate ? (
                  <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 bg-amber-50 text-amber-700 border-amber-200 font-semibold ml-auto flex-shrink-0">着工</Badge>
                ) : null}
              </div>

              {/* 2行目: 日程 + 日数 */}
              <div className="mt-1.5 text-xs text-slate-600">
                <span>{formatDateShort(s.plannedStartDate)} 〜 {formatDateShort(s.plannedEndDate)}</span>
                {days && <span className="text-slate-400 ml-1">({days}日)</span>}
              </div>

              {/* 削除ボタン（ホバー時） */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(s.id)
                }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-300 hover:text-red-500 hover:border-red-300 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                title="工程を削除"
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Trash2 className="w-2.5 h-2.5" />}
              </button>
            </div>
          )
        })}
      </div>

      {/* 新規追加フォーム */}
      {showAddForm ? (
        <div className="rounded-lg border-2 border-dashed border-green-300 bg-green-50/20 p-2.5 space-y-2">
          <div className="text-xs font-semibold text-green-700 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            工程を追加
          </div>

          {/* 作業種別 */}
          <div>
            <Label className="text-xs text-slate-600 mb-1 block">作業種別</Label>
            <div className="flex gap-1 flex-wrap">
              {workTypeOptions.map((opt) => {
                const style = WORK_TYPE_STYLES[opt.code] ?? WORK_TYPE_STYLES.REWORK
                const isSelected = newWorkType === opt.code
                return (
                  <button
                    key={opt.code}
                    onClick={() => setNewWorkType(opt.code)}
                    className={cn(
                      "text-xs font-medium px-2 py-1 rounded-md border transition-all",
                      isSelected
                        ? `${style.bg} ${style.text} ${style.border} ring-1 ring-green-400`
                        : "bg-white text-slate-400 border-slate-200 hover:border-slate-400"
                    )}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 日程 */}
          <div className="space-y-1.5">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-xs text-slate-500 font-semibold mb-0.5 block">開始日</Label>
                <Input
                  type="date"
                  className="h-7 text-xs"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                />
              </div>
              <span className="text-xs text-slate-300 pb-1.5">〜</span>
              <div className="flex-1">
                <Label className="text-xs text-slate-500 font-semibold mb-0.5 block">終了日</Label>
                <Input
                  type="date"
                  className="h-7 text-xs"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                />
              </div>
            </div>
            {/* 日数プリセットボタン */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-600 mr-0.5">日数:</span>
              {DAY_PRESETS.map((d) => {
                const currentDays = calcDays(newStartDate, newEndDate)
                const isMatch = currentDays === d
                return (
                  <button
                    key={d}
                    onClick={() => {
                      if (newStartDate) {
                        setNewEndDate(endDateFromDays(newStartDate, d))
                      }
                    }}
                    disabled={!newStartDate}
                    className={cn(
                      "h-7 min-w-[32px] px-1.5 rounded text-xs font-medium border transition-all",
                      isMatch
                        ? "bg-green-500 text-white border-green-500 shadow-sm"
                        : newStartDate
                        ? "bg-white text-slate-500 border-slate-200 hover:border-green-400 hover:text-green-600 hover:bg-green-50"
                        : "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed"
                    )}
                  >
                    {d}日
                  </button>
                )
              })}
            </div>
          </div>

          {/* ボタン */}
          <div className="flex justify-end gap-1.5">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowAddForm(false)} disabled={adding}>
              キャンセル
            </Button>
            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={handleAdd} disabled={adding || !newWorkType}>
              {adding ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
              追加
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="min-w-[140px] flex-1 basis-[calc(33.333%-0.375rem)] max-w-[calc(50%-0.375rem)] rounded-lg border-2 border-dashed border-slate-200 py-3 text-xs text-slate-400 hover:text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition-all flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          工程を追加
        </button>
      )}
    </div>
  )
}

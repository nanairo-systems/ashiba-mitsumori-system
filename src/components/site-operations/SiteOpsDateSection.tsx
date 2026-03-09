/**
 * [現操-04] 工程日程・作業種別変更セクション
 *
 * 予定開始日・終了日の編集と作業種別（組立/解体/その他）の変更・保存。
 * 他ページからも再利用可能なモジュール。
 */
"use client"

import { useState, useEffect } from "react"
import { CalendarCog, Loader2, Save, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

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
const WORK_TYPE_STYLES: Record<string, { label: string; className: string }> = {
  ASSEMBLY: { label: "組立", className: "bg-blue-100 text-blue-700 border-blue-300" },
  DISASSEMBLY: { label: "解体", className: "bg-orange-100 text-orange-700 border-orange-300" },
  REWORK: { label: "その他", className: "bg-slate-100 text-slate-600 border-slate-300" },
}

function toInputDate(dateStr: string | null): string {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

interface Props {
  scheduleId: string
  plannedStartDate: string | null
  plannedEndDate: string | null
  workType: string
  onUpdated?: () => void
}

export function SiteOpsDateSection({ scheduleId, plannedStartDate, plannedEndDate, workType, onUpdated }: Props) {
  const [startDate, setStartDate] = useState(toInputDate(plannedStartDate))
  const [endDate, setEndDate] = useState(toInputDate(plannedEndDate))
  const [selectedWorkType, setSelectedWorkType] = useState(workType)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // 作業種別マスターをAPIから取得
  const [workTypes, setWorkTypes] = useState<WorkTypeMaster[]>([])
  useEffect(() => {
    fetch("/api/schedule-work-types")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setWorkTypes(data))
      .catch(() => {})
  }, [])

  const hasChanges =
    startDate !== toInputDate(plannedStartDate) ||
    endDate !== toInputDate(plannedEndDate) ||
    selectedWorkType !== workType

  const workTypeChanged = selectedWorkType !== workType

  // 作業種別の表示名を取得
  function getWorkTypeLabel(code: string): string {
    const fromMaster = workTypes.find((wt) => wt.code === code)
    if (fromMaster) return fromMaster.label
    return WORK_TYPE_STYLES[code]?.label ?? code
  }

  // 保存ボタンクリック → 作業種別変更がある場合は確認ダイアログ表示
  function handleSaveClick() {
    if (workTypeChanged) {
      setConfirmOpen(true)
    } else {
      executeSave()
    }
  }

  // 実際の保存処理
  async function executeSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plannedStartDate: startDate || null,
          plannedEndDate: endDate || null,
          workType: selectedWorkType,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success("日程・種別を変更しました")
      onUpdated?.()
    } catch {
      toast.error("変更に失敗しました")
    } finally {
      setSaving(false)
    }
  }

  // 表示用: マスターデータがあればそこから、なければフォールバック
  const workTypeOptions = workTypes.length > 0
    ? workTypes.filter((wt) => wt.isActive).map((wt) => ({
        code: wt.code,
        label: wt.label,
      }))
    : Object.entries(WORK_TYPE_STYLES).map(([code, { label }]) => ({ code, label }))

  return (
    <div className="space-y-3">
      {/* セクションヘッダー */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
        <CalendarCog className="w-3.5 h-3.5" />
        <span>現操-04 日程・種別</span>
      </div>

      {/* 作業種別ボタン */}
      <div>
        <Label className="text-xs text-slate-500 mb-1.5 block">作業種別</Label>
        <div className="flex gap-1.5">
          {workTypeOptions.map((opt) => {
            const style = WORK_TYPE_STYLES[opt.code] ?? WORK_TYPE_STYLES.REWORK
            const isActive = selectedWorkType === opt.code
            return (
              <button
                key={opt.code}
                onClick={() => setSelectedWorkType(opt.code)}
                className={cn(
                  "text-xs font-medium px-3 py-1.5 rounded-md border transition-all",
                  isActive
                    ? `${style.className} ring-2 ring-offset-1 ring-blue-400`
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 日程入力 */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Label className="text-xs text-slate-500 mb-1 block">開始日</Label>
          <Input
            type="date"
            className="h-8 text-xs"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <span className="text-xs text-slate-400 pb-2">〜</span>
        <div className="flex-1">
          <Label className="text-xs text-slate-500 mb-1 block">終了日</Label>
          <Input
            type="date"
            className="h-8 text-xs"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          className="h-8"
          onClick={handleSaveClick}
          disabled={!hasChanges || saving}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
          保存
        </Button>
      </div>

      {/* 作業種別変更の確認ダイアログ */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              作業種別の変更確認
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              作業種別を「<span className="font-semibold text-slate-700">{getWorkTypeLabel(workType)}</span>」から「<span className="font-semibold text-slate-700">{getWorkTypeLabel(selectedWorkType)}</span>」に変更します。
              <br />
              本当に変更してもよろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={executeSave}>
              変更する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

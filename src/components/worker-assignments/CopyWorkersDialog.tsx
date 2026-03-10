/**
 * [COMPONENT] 職人コピーダイアログ
 *
 * 同じ班・同じ日の他現場からの職人一括コピー。
 * チェックボックスで選択し、一括追加する。
 * - 現場追加時の自動提案
 * - 既存現場カードの「コピー」ボタンから起動
 */
"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, CalendarDays, Calendar, Copy } from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { ja } from "date-fns/locale"
import { HelmetBadge } from "./HelmetBadge"

export interface CopyableWorkerInfo {
  workerId: string
  workerName: string
  workerType: string
  driverLicenseType: string
  assignedRole: string
  sourceName: string // コピー元の現場名
}

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: (workerIds: string[], assignedDate: string | null) => Promise<void>
  workers: CopyableWorkerInfo[]
  targetLabel: string
  /** 現在表示中の日付キー（YYYY-MM-DD） */
  dateKey?: string
  /** コピー先の現場が複数日スケジュールか */
  isMultiDay?: boolean
}

export function CopyWorkersDialog({
  open,
  onClose,
  onConfirm,
  workers,
  targetLabel,
  dateKey,
  isMultiDay,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  // 「この日だけ」(true) / 「全日程」(false) - デフォルトは「この日だけ」
  const [thisDayOnly, setThisDayOnly] = useState(true)

  // ダイアログが開いたら全選択＋日付モードリセット
  useEffect(() => {
    if (open) {
      setSelected(new Set(workers.map((w) => w.workerId)))
      setThisDayOnly(true)
    }
  }, [open, workers])

  function toggleWorker(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === workers.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(workers.map((w) => w.workerId)))
    }
  }

  async function handleConfirm() {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    setSubmitting(true)
    try {
      const assignedDate = (isMultiDay && thisDayOnly && dateKey) ? dateKey : null
      await onConfirm(ids, assignedDate)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  // 日付表示用ラベル
  const dateLabel = dateKey
    ? format(new Date(dateKey + "T00:00:00"), "M/d（E）", { locale: ja })
    : ""

  // コピー元の現場名一覧（重複除去）
  const sourceNames = [...new Set(workers.map((w) => w.sourceName))]

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Copy className="w-5 h-5 text-amber-600" />
            職人をコピー
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-slate-600">
            「<span className="font-semibold text-slate-800">{sourceNames.join("・")}</span>」の職人を
            「<span className="font-semibold text-slate-800">{targetLabel}</span>」にコピーします
          </p>

          {/* 複数日スケジュールの場合: 日付範囲切替 */}
          {isMultiDay && dateKey && (
            <div className="flex gap-2">
              <button
                onClick={() => setThisDayOnly(true)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs border-2 transition-all font-medium",
                  thisDayOnly
                    ? "bg-blue-50 border-blue-400 text-blue-700 shadow-sm"
                    : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                <Calendar className="w-4 h-4" />
                {dateLabel}のみ
              </button>
              <button
                onClick={() => setThisDayOnly(false)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs border-2 transition-all font-medium",
                  !thisDayOnly
                    ? "bg-blue-50 border-blue-400 text-blue-700 shadow-sm"
                    : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                <CalendarDays className="w-4 h-4" />
                全日程
              </button>
            </div>
          )}

          {/* 全選択/解除 + カウント */}
          <div className="flex items-center justify-between">
            <button
              onClick={toggleAll}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              {selected.size === workers.length ? "全解除" : "全選択"}
            </button>
            <span className="text-xs text-slate-500 font-medium">
              {selected.size}/{workers.length}名選択
            </span>
          </div>

          {/* 職人一覧 */}
          <div className="space-y-1 max-h-[280px] overflow-y-auto border-2 rounded-lg p-1">
            {workers.map((w) => (
              <label
                key={w.workerId}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors",
                  selected.has(w.workerId)
                    ? "bg-blue-50"
                    : "hover:bg-slate-50"
                )}
              >
                <input
                  type="checkbox"
                  checked={selected.has(w.workerId)}
                  onChange={() => toggleWorker(w.workerId)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600"
                />
                <HelmetBadge
                  name={w.workerName}
                  isForeman={w.assignedRole === "FOREMAN"}
                  workerType={w.workerType}
                  driverLicenseType={w.driverLicenseType}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-slate-800">{w.workerName}</span>
                  <div className="text-xs text-slate-600">{w.sourceName}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            スキップ
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selected.size === 0 || submitting}
            className="min-w-[120px]"
          >
            {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            {selected.size}名をコピー
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

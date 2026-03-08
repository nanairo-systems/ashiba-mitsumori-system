/**
 * [COMPONENT] 職人追加ダイアログ
 *
 * 職人マスタから複数選択して一括アサインする。
 * - 検索ボックスで名前絞り込み
 * - チェックボックスで複数選択
 * - 既にアサイン済みの職人はグレーアウト
 * - assignedRole は worker.defaultRole を初期値に使用
 */
"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, Search, HardHat, CalendarDays, CalendarCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import type { WorkerData } from "./types"

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (workerIds: string[], assignedDate: string | null) => Promise<void>
  workers: WorkerData[]
  loadingWorkers: boolean
  assignedWorkerIds: Set<string>
  /** 複数日の工程かどうか */
  isMultiDay: boolean
  /** 現在の日付カラム (yyyy-MM-dd) */
  dateKey: string
  /** 表示用の日付範囲ラベル (例: "3/10〜3/13") */
  dateRangeLabel: string
}

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  EMPLOYEE: { label: "社員", className: "bg-green-100 text-green-700" },
  INDEPENDENT: { label: "一人親方", className: "bg-yellow-100 text-yellow-700" },
  SUBCONTRACTOR: { label: "協力会社", className: "bg-slate-100 text-slate-600" },
}

const LICENSE_LABELS: Record<string, string> = {
  NONE: "",
  SMALL: "2t",
  MEDIUM: "4t",
  SEMI_LARGE: "6t",
  LARGE: "MAX",
}

const ROLE_LABEL: Record<string, string> = {
  FOREMAN: "職長",
  WORKER: "職人",
}

export function AddWorkerDialog({
  open,
  onClose,
  onSubmit,
  workers,
  loadingWorkers,
  assignedWorkerIds,
  isMultiDay,
  dateKey,
  dateRangeLabel,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [assignMode, setAssignMode] = useState<"all" | "day-only" | null>(null)

  useEffect(() => {
    if (open) {
      setSelected(new Set())
      setSearch("")
      setAssignMode(null)
    }
  }, [open])

  const filtered = useMemo(() => {
    if (!search.trim()) return workers
    const q = search.trim().toLowerCase()
    return workers.filter(
      (w) => w.name.toLowerCase().includes(q) || (w.furigana?.toLowerCase().includes(q))
    )
  }, [workers, search])

  function toggleWorker(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // dateKey "2026-03-10" → "3/10" 形式の表示用ラベル
  const dateDayLabel = (() => {
    const parts = dateKey.split("-")
    return `${Number(parts[1])}/${Number(parts[2])}`
  })()

  async function handleSubmit() {
    if (selected.size === 0) return
    if (isMultiDay && assignMode === null) return

    // assignedDate: null = 全日程、dateKey = この日だけ
    const assignedDate = isMultiDay
      ? (assignMode === "day-only" ? dateKey : null)
      : dateKey // 単日スケジュールは自動的にその日

    setSubmitting(true)
    try {
      await onSubmit(Array.from(selected), assignedDate)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>職人を追加</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 overflow-y-auto flex-1 min-h-0">
          {/* 検索ボックス */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="名前で検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
            />
          </div>

          {/* 職人リスト */}
          {loadingWorkers ? (
            <div className="flex items-center gap-2 py-8 justify-center text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">職人を読み込んでいます...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-slate-400 py-8 text-center">
              {search ? "該当する職人がいません" : "職人が登録されていません"}
            </div>
          ) : (
            <div className="max-h-[320px] overflow-y-auto border rounded-lg divide-y divide-slate-100">
              {filtered.map((w) => {
                const isAssigned = assignedWorkerIds.has(w.id)
                const isChecked = selected.has(w.id)
                const badge = TYPE_BADGE[w.workerType] ?? { label: "協力", className: "bg-slate-100 text-slate-600" }
                const isForeman = w.defaultRole === "FOREMAN"

                return (
                  <label
                    key={w.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors",
                      isAssigned
                        ? "opacity-40 cursor-not-allowed bg-slate-50"
                        : isChecked
                          ? "bg-blue-50"
                          : "hover:bg-slate-50"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isAssigned}
                      onChange={() => !isAssigned && toggleWorker(w.id)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-200"
                    />

                    {/* ヘルメットアイコン */}
                    <div className="relative flex-shrink-0 w-5 h-5 flex items-center justify-center">
                      <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-px">
                        <div
                          className="h-[1.5px] rounded-full bg-slate-400"
                          style={{ width: isForeman ? 10 : 6 }}
                        />
                        {isForeman && (
                          <div className="h-[1.5px] w-[10px] rounded-full bg-slate-400" />
                        )}
                      </div>
                      <HardHat className="w-4 h-4 text-slate-500" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">{w.name}</span>
                        <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", badge.className)}>
                          {badge.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        <span>{ROLE_LABEL[w.defaultRole] ?? w.defaultRole}</span>
                        {LICENSE_LABELS[w.driverLicenseType] && (
                          <span className="px-1 py-px rounded bg-blue-800 text-white text-[8px] font-bold">
                            {LICENSE_LABELS[w.driverLicenseType]}
                          </span>
                        )}
                        {isAssigned && <span>・ アサイン済み</span>}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          )}

          {selected.size > 0 && (
            <div className="text-xs text-blue-600 font-medium">
              {selected.size}名を選択中
            </div>
          )}

          {/* 配置期間の選択（複数日スケジュールのみ） */}
          {isMultiDay && (
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <div className="text-xs font-medium text-slate-600">
                配置期間を選択してください
                <span className="text-red-500 ml-0.5">*</span>
              </div>

              {/* 全ての日程に配置 */}
              <button
                type="button"
                onClick={() => setAssignMode("all")}
                className={cn(
                  "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors",
                  assignMode === "all"
                    ? "bg-blue-50 border-blue-400 ring-1 ring-blue-400"
                    : "hover:bg-slate-50 border-slate-200"
                )}
              >
                <CalendarDays className={cn(
                  "w-5 h-5 mt-0.5 flex-shrink-0",
                  assignMode === "all" ? "text-blue-600" : "text-slate-400"
                )} />
                <div>
                  <div className={cn(
                    "text-sm font-medium",
                    assignMode === "all" ? "text-blue-700" : "text-slate-800"
                  )}>
                    全ての日程に配置
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {dateRangeLabel} の全日程
                  </div>
                </div>
              </button>

              {/* この日だけ配置 */}
              <button
                type="button"
                onClick={() => setAssignMode("day-only")}
                className={cn(
                  "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors",
                  assignMode === "day-only"
                    ? "bg-blue-50 border-blue-400 ring-1 ring-blue-400"
                    : "hover:bg-slate-50 border-slate-200"
                )}
              >
                <CalendarCheck className={cn(
                  "w-5 h-5 mt-0.5 flex-shrink-0",
                  assignMode === "day-only" ? "text-blue-600" : "text-slate-400"
                )} />
                <div>
                  <div className={cn(
                    "text-sm font-medium",
                    assignMode === "day-only" ? "text-blue-700" : "text-slate-800"
                  )}>
                    {dateDayLabel} だけ配置
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    この日のみ
                  </div>
                </div>
              </button>

              {/* 未選択時の警告 */}
              {assignMode === null && selected.size > 0 && (
                <div className="text-[10px] text-red-500">
                  どちらかを選択してください
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            キャンセル
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={selected.size === 0 || (isMultiDay && assignMode === null) || submitting}
          >
            {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            追加する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

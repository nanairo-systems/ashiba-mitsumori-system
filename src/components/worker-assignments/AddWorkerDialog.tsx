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
import { Loader2, Search, CalendarDays, CalendarCheck, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { HelmetBadge } from "./HelmetBadge"
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
  EMPLOYEE: { label: "社員", className: "bg-green-100 text-green-700 border border-green-200" },
  INDEPENDENT: { label: "一人親方", className: "bg-yellow-100 text-yellow-700 border border-yellow-200" },
  SUBCONTRACTOR: { label: "協力会社", className: "bg-slate-100 text-slate-600 border border-slate-200" },
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Users className="w-5 h-5 text-blue-600" />
            職人を追加
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 overflow-y-auto flex-1 min-h-0">
          {/* 検索ボックス */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="名前で検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-sm border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
            />
          </div>

          {/* 選択中の人数表示 */}
          {selected.size > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                {selected.size}
              </div>
              <span className="text-sm text-blue-700 font-medium">名を選択中</span>
            </div>
          )}

          {/* 職人リスト */}
          {loadingWorkers ? (
            <div className="flex items-center gap-2 py-8 justify-center text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">職人を読み込んでいます...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-slate-400 py-8 text-center">
              {search ? "該当する職人がいません" : "職人が登録されていません"}
            </div>
          ) : (
            <div className="max-h-[320px] overflow-y-auto border-2 rounded-lg divide-y divide-slate-100">
              {filtered.map((w) => {
                const isAssigned = assignedWorkerIds.has(w.id)
                const isChecked = selected.has(w.id)
                const badge = TYPE_BADGE[w.workerType] ?? { label: "協力", className: "bg-slate-100 text-slate-600" }
                const isForeman = w.defaultRole === "FOREMAN"

                return (
                  <label
                    key={w.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors",
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
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-200"
                    />

                    {/* ヘルメットバッジ */}
                    <HelmetBadge
                      name={w.name}
                      isForeman={isForeman}
                      workerType={w.workerType}
                      driverLicenseType={w.driverLicenseType}
                      size="md"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">{w.name}</span>
                        <span className={cn("px-1.5 py-0.5 rounded text-[11px] font-medium", badge.className)}>
                          {badge.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span>{ROLE_LABEL[w.defaultRole] ?? w.defaultRole}</span>
                        {LICENSE_LABELS[w.driverLicenseType] && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-800 text-white text-[9px] font-bold">
                            {LICENSE_LABELS[w.driverLicenseType]}
                          </span>
                        )}
                        {isAssigned && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-500 text-[10px]">
                            アサイン済み
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          )}

          {/* 配置期間の選択（複数日スケジュールのみ） */}
          {isMultiDay && (
            <div className="space-y-2 pt-3 border-t-2 border-slate-200">
              <div className="text-sm font-semibold text-slate-700">
                配置期間を選択
                <span className="text-red-500 ml-0.5">*</span>
              </div>

              {/* 全ての日程に配置 */}
              <button
                type="button"
                onClick={() => setAssignMode("all")}
                className={cn(
                  "w-full flex items-start gap-3 px-4 py-3 rounded-lg border-2 text-left transition-all",
                  assignMode === "all"
                    ? "bg-blue-50 border-blue-400 ring-1 ring-blue-400 shadow-sm"
                    : "hover:bg-slate-50 border-slate-200"
                )}
              >
                <CalendarDays className={cn(
                  "w-5 h-5 mt-0.5 flex-shrink-0",
                  assignMode === "all" ? "text-blue-600" : "text-slate-400"
                )} />
                <div>
                  <div className={cn(
                    "text-sm font-semibold",
                    assignMode === "all" ? "text-blue-700" : "text-slate-800"
                  )}>
                    全ての日程に配置
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {dateRangeLabel} の全日程
                  </div>
                </div>
              </button>

              {/* この日だけ配置 */}
              <button
                type="button"
                onClick={() => setAssignMode("day-only")}
                className={cn(
                  "w-full flex items-start gap-3 px-4 py-3 rounded-lg border-2 text-left transition-all",
                  assignMode === "day-only"
                    ? "bg-blue-50 border-blue-400 ring-1 ring-blue-400 shadow-sm"
                    : "hover:bg-slate-50 border-slate-200"
                )}
              >
                <CalendarCheck className={cn(
                  "w-5 h-5 mt-0.5 flex-shrink-0",
                  assignMode === "day-only" ? "text-blue-600" : "text-slate-400"
                )} />
                <div>
                  <div className={cn(
                    "text-sm font-semibold",
                    assignMode === "day-only" ? "text-blue-700" : "text-slate-800"
                  )}>
                    {dateDayLabel} だけ配置
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    この日のみ
                  </div>
                </div>
              </button>

              {/* 未選択時の警告 */}
              {assignMode === null && selected.size > 0 && (
                <div className="text-xs text-red-500 font-medium px-1">
                  どちらかを選択してください
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            キャンセル
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selected.size === 0 || (isMultiDay && assignMode === null) || submitting}
            className="min-w-[120px]"
          >
            {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            {selected.size > 0 ? `${selected.size}名を追加` : "追加する"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

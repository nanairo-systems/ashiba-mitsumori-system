/**
 * [COMPONENT] 職人追加ダイアログ
 *
 * 職人マスタから複数選択して一括アサインする。
 * - 検索ボックスで名前絞り込み
 * - チェックボックスで複数選択
 * - 既にアサイン済みの職人はグレーアウト
 * - 配置状況（未配置/配置済/アサイン済）をバッジで表示
 * - 配置先の現場名を表示
 * - 会社名（協力会社の場合）を表示
 * - ソート: 社員→一人親方→協力会社、未配置優先
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
import type { WorkerData, WorkerBusyInfo } from "./types"
import { MAX_TOTAL_PER_SITE } from "./types"

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
  /** 他現場からの推奨職人ID（ダイアログ開封時に事前選択） */
  suggestedWorkerIds?: string[]
  /** 現在アサイン済みの職人数（職長含む） */
  currentWorkerCount?: number
  /** 「新しい班を作成」ボタン押下時 */
  onCreateSplitTeam?: () => void
  /** この日の職人ごとの配置情報 (workerId → WorkerBusyInfo) */
  busyWorkerInfoMap?: Map<string, WorkerBusyInfo>
}

const TYPE_BADGE: Record<string, { label: string; className: string; order: number }> = {
  EMPLOYEE: { label: "社員", className: "bg-green-100 text-green-700 border border-green-200", order: 0 },
  INDEPENDENT: { label: "一人親方", className: "bg-yellow-100 text-yellow-700 border border-yellow-200", order: 1 },
  SUBCONTRACTOR: { label: "協力会社", className: "bg-slate-100 text-slate-600 border border-slate-200", order: 2 },
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
  suggestedWorkerIds,
  currentWorkerCount = 0,
  onCreateSplitTeam,
  busyWorkerInfoMap,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [assignMode, setAssignMode] = useState<"all" | "day-only" | null>(null)

  useEffect(() => {
    if (open) {
      // 他現場からの推奨職人を事前選択（アサイン済みを除外）
      const initial = (suggestedWorkerIds ?? []).filter((id) => !assignedWorkerIds.has(id))
      setSelected(new Set(initial))
      setSearch("")
      setAssignMode(null)
    }
  }, [open])

  const suggestedSet = useMemo(() => new Set(suggestedWorkerIds ?? []), [suggestedWorkerIds])

  // 残り枠の計算
  const remainingSlots = MAX_TOTAL_PER_SITE - currentWorkerCount
  const isAtLimit = remainingSlots <= 0
  const canSelectMore = !isAtLimit && selected.size < remainingSlots

  const infoMap = useMemo(() => busyWorkerInfoMap ?? new Map<string, WorkerBusyInfo>(), [busyWorkerInfoMap])

  const filtered = useMemo(() => {
    let list = workers
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (w) => w.name.toLowerCase().includes(q)
          || (w.furigana?.toLowerCase().includes(q))
          || (w.subcontractors?.name?.toLowerCase().includes(q))
      )
    }
    // ソート: アサイン済み→最後、未配置→上位、社員→一人親方→協力会社
    return [...list].sort((a, b) => {
      // 1. この現場にアサイン済み → 最後
      const aAssigned = assignedWorkerIds.has(a.id) ? 1 : 0
      const bAssigned = assignedWorkerIds.has(b.id) ? 1 : 0
      if (aAssigned !== bAssigned) return aAssigned - bAssigned
      // 2. 未配置（どこにも配置なし）→ 上位
      if (busyWorkerInfoMap) {
        const aIdle = !infoMap.has(a.id) ? 0 : 1
        const bIdle = !infoMap.has(b.id) ? 0 : 1
        if (aIdle !== bIdle) return aIdle - bIdle
      }
      // 3. 種別順: 社員(0) → 一人親方(1) → 協力会社(2)
      const aTypeOrder = TYPE_BADGE[a.workerType]?.order ?? 9
      const bTypeOrder = TYPE_BADGE[b.workerType]?.order ?? 9
      if (aTypeOrder !== bTypeOrder) return aTypeOrder - bTypeOrder
      // 4. 推奨職人 → 上位
      const aSuggested = suggestedSet.has(a.id) ? 0 : 1
      const bSuggested = suggestedSet.has(b.id) ? 0 : 1
      return aSuggested - bSuggested
    })
  }, [workers, search, suggestedSet, assignedWorkerIds, busyWorkerInfoMap, infoMap])

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

  /** 会社名を取得（協力会社は下請け名、一人親方はそのまま、社員は空） */
  function getCompanyLabel(w: WorkerData): string | null {
    if (w.workerType === "SUBCONTRACTOR" && w.subcontractors?.name) {
      return w.subcontractors.name
    }
    return null
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
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
              placeholder="名前・会社名で検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-sm border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
            />
          </div>

          {/* 上限警告 */}
          {isAtLimit && (
            <div className="space-y-2 px-3 py-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-red-600">⚠️ 上限{MAX_TOTAL_PER_SITE}名に達しています</span>
              </div>
              <p className="text-xs text-red-500">
                この現場にはこれ以上職人を追加できません。新しい班に分割してください。
              </p>
              {onCreateSplitTeam && (
                <button
                  type="button"
                  onClick={() => {
                    onCreateSplitTeam()
                    onClose()
                  }}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-colors"
                >
                  🔀 新しい班を作成しますか？
                </button>
              )}
            </div>
          )}

          {/* 推奨情報 + 選択中の人数表示 */}
          {suggestedSet.size > 0 && selected.size > 0 && !isAtLimit && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
              <span className="text-xs text-amber-700">
                💡 他現場から<span className="font-bold">{suggestedSet.size}名</span>を自動選択済み
              </span>
            </div>
          )}
          {selected.size > 0 && !isAtLimit && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                {selected.size}
              </div>
              <span className="text-sm text-blue-700 font-medium">
                名を選択中
                {remainingSlots < MAX_TOTAL_PER_SITE && (
                  <span className="text-blue-500 ml-1">（残り{remainingSlots - selected.size}枠）</span>
                )}
              </span>
            </div>
          )}

          {/* 配置状況サマリー */}
          {busyWorkerInfoMap && !isAtLimit && !loadingWorkers && (() => {
            const idleCount = workers.filter(
              (w) => !infoMap.has(w.id) && !assignedWorkerIds.has(w.id)
            ).length
            return idleCount > 0 ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
                <span className="text-xs text-orange-700">
                  ⚠ <span className="font-bold">{idleCount}名</span>が未配置です（{dateDayLabel}）
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                <span className="text-xs text-green-700">
                  ✓ 全員配置済みです（{dateDayLabel}）
                </span>
              </div>
            )
          })()}

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
            <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1">
              {filtered.map((w) => {
                const isAssigned = assignedWorkerIds.has(w.id)
                const isChecked = selected.has(w.id)
                const isSuggested = suggestedSet.has(w.id)
                const badge = TYPE_BADGE[w.workerType] ?? { label: "協力", className: "bg-slate-100 text-slate-600", order: 9 }
                const isForeman = w.defaultRole === "FOREMAN"
                const busyInfo = busyWorkerInfoMap ? infoMap.get(w.id) : undefined
                const isBusy = busyWorkerInfoMap ? !!busyInfo : undefined
                const isIdle = busyWorkerInfoMap ? !busyInfo && !isAssigned : undefined
                const companyLabel = getCompanyLabel(w)

                // 選択できないかどうか: アサイン済み、上限到達、または枠満杯で未選択
                const isDisabled = isAssigned || isAtLimit || (!isChecked && !canSelectMore)

                return (
                  <label
                    key={w.id}
                    className={cn(
                      "flex items-center gap-4 px-4 py-3 cursor-pointer transition-all rounded-lg border-2",
                      isDisabled
                        ? "opacity-40 cursor-not-allowed bg-slate-50 border-slate-200"
                        : isChecked
                          ? "bg-blue-50 border-blue-400 shadow-sm"
                          : isIdle
                            ? "bg-orange-50/40 border-orange-200 hover:border-orange-300 hover:bg-orange-50"
                            : isSuggested
                              ? "bg-amber-50/50 border-amber-200 hover:border-amber-300"
                              : "border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isDisabled}
                      onChange={() => !isDisabled && toggleWorker(w.id)}
                      className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-200 flex-shrink-0"
                    />

                    {/* ヘルメットバッジ */}
                    <HelmetBadge
                      name={w.name}
                      isForeman={isForeman}
                      workerType={w.workerType}
                      driverLicenseType={w.driverLicenseType}
                      size="md"
                    />

                    {/* 名前・種別・会社名・役割 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-slate-800 truncate">{w.name}</span>
                        <span className={cn("px-2 py-0.5 rounded text-xs font-medium flex-shrink-0", badge.className)}>
                          {badge.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500 font-medium">{ROLE_LABEL[w.defaultRole] ?? w.defaultRole}</span>
                        {LICENSE_LABELS[w.driverLicenseType] && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-800 text-white text-[10px] font-bold flex-shrink-0">
                            {LICENSE_LABELS[w.driverLicenseType]}
                          </span>
                        )}
                        {companyLabel && (
                          <span className="text-xs text-slate-400 truncate max-w-[160px]" title={companyLabel}>
                            {companyLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 配置状況（右端・大きめ） */}
                    <div className="flex-shrink-0 text-right min-w-[110px]">
                      {isAssigned ? (
                        <span className="inline-flex items-center px-3 py-2 rounded-lg bg-slate-200 text-slate-500 text-xs font-bold">
                          アサイン済
                        </span>
                      ) : isIdle ? (
                        <span className="inline-flex items-center px-3 py-2 rounded-lg bg-orange-500 text-white text-xs font-bold shadow-sm">
                          未配置
                        </span>
                      ) : isBusy && busyInfo ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold">
                            配置済
                          </span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[110px] leading-tight" title={busyInfo.siteNames.join(", ")}>
                            {busyInfo.siteNames[0]}{busyInfo.siteNames.length > 1 ? ` 他${busyInfo.siteNames.length - 1}件` : ""}
                          </span>
                        </div>
                      ) : null}
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
            disabled={selected.size === 0 || (isMultiDay && assignMode === null) || submitting || isAtLimit}
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

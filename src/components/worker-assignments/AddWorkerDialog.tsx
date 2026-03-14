/**
 * [COMPONENT] 職人追加ダイアログ
 *
 * 職人マスタから複数選択して一括アサインする。
 * - 検索ボックスで名前絞り込み
 * - カードタップで複数選択 → まとめて追加
 * - 既にアサイン済みの職人はグレーアウト
 * - 配置状況（未配置/配置済/アサイン済）をバッジで表示
 * - 会社名（協力会社の場合）を表示
 * - ソート: 社員→一人親方→協力会社、未配置優先
 */
"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { ResponsiveDialog } from "./ResponsiveDialog"
import { Button } from "@/components/ui/button"
import { Loader2, Search, CalendarDays, CalendarCheck, Users, EyeOff, Eye, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
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
  /** ダイアログのタイトル（デフォルト: "職人を追加"） */
  dialogTitle?: string
  /** 職長のみ表示するフィルター */
  foremanOnly?: boolean
  /** 職人の非表示切替後のコールバック */
  onWorkersChanged?: () => void
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
  dialogTitle,
  foremanOnly,
  onWorkersChanged,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [assignMode, setAssignMode] = useState<"all" | "day-only" | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  const [togglingCategory, setTogglingCategory] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      const initial = (suggestedWorkerIds ?? []).filter((id) => !assignedWorkerIds.has(id))
      setSelected(new Set(initial))
      setSearch("")
      setAssignMode(null)
    }
  }, [open])

  const suggestedSet = useMemo(() => new Set(suggestedWorkerIds ?? []), [suggestedWorkerIds])

  const remainingSlots = MAX_TOTAL_PER_SITE - currentWorkerCount
  const isAtLimit = remainingSlots <= 0
  const canSelectMore = !isAtLimit && selected.size < remainingSlots

  const infoMap = useMemo(() => busyWorkerInfoMap ?? new Map<string, WorkerBusyInfo>(), [busyWorkerInfoMap])

  const changeCategory = useCallback(async (workerId: string, newCategory: "MAIN" | "SUB" | "HIDDEN") => {
    setTogglingCategory(workerId)
    try {
      const isActive = newCategory !== "HIDDEN"
      const res = await fetch(`/api/workers/${workerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerCategory: newCategory, isActive }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? `HTTP ${res.status}`)
      }
      const labels = { MAIN: "メイン", SUB: "サブ", HIDDEN: "非表示" }
      toast.success(`${labels[newCategory]}に変更しました`)
      onWorkersChanged?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "不明なエラー"
      toast.error(`更新に失敗しました: ${msg}`)
    } finally {
      setTogglingCategory(null)
    }
  }, [onWorkersChanged])

  const hiddenCount = useMemo(() => {
    return workers.filter((w) => (w.workerCategory ?? "MAIN") === "HIDDEN").length
  }, [workers])

  const filtered = useMemo(() => {
    let list = workers
    if (!showHidden) {
      list = list.filter((w) => (w.workerCategory ?? "MAIN") !== "HIDDEN")
    }
    if (foremanOnly) {
      list = list.filter((w) => w.defaultRole === "FOREMAN")
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (w) => w.name.toLowerCase().includes(q)
          || (w.furigana?.toLowerCase().includes(q))
          || (w.subcontractors?.name?.toLowerCase().includes(q))
      )
    }
    const catOrder: Record<string, number> = { MAIN: 0, SUB: 1, HIDDEN: 2 }
    return [...list].sort((a, b) => {
      // 1. カテゴリ順: MAIN → SUB → HIDDEN
      const aCat = catOrder[a.workerCategory ?? "MAIN"] ?? 0
      const bCat = catOrder[b.workerCategory ?? "MAIN"] ?? 0
      if (aCat !== bCat) return aCat - bCat
      // 2. この現場にアサイン済み → 最後
      const aAssigned = assignedWorkerIds.has(a.id) ? 1 : 0
      const bAssigned = assignedWorkerIds.has(b.id) ? 1 : 0
      if (aAssigned !== bAssigned) return aAssigned - bAssigned
      // 3. 未配置 → 上位
      if (busyWorkerInfoMap) {
        const aIdle = !infoMap.has(a.id) ? 0 : 1
        const bIdle = !infoMap.has(b.id) ? 0 : 1
        if (aIdle !== bIdle) return aIdle - bIdle
      }
      // 4. 種別順: 社員 → 一人親方 → 協力会社
      const aTypeOrder = TYPE_BADGE[a.workerType]?.order ?? 9
      const bTypeOrder = TYPE_BADGE[b.workerType]?.order ?? 9
      if (aTypeOrder !== bTypeOrder) return aTypeOrder - bTypeOrder
      // 5. 推奨職人 → 上位
      const aSuggested = suggestedSet.has(a.id) ? 0 : 1
      const bSuggested = suggestedSet.has(b.id) ? 0 : 1
      return aSuggested - bSuggested
    })
  }, [workers, search, suggestedSet, assignedWorkerIds, busyWorkerInfoMap, infoMap, foremanOnly, showHidden])

  function toggleWorker(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const dateDayLabel = (() => {
    const parts = dateKey.split("-")
    return `${Number(parts[1])}/${Number(parts[2])}`
  })()

  async function handleSubmit() {
    if (selected.size === 0) return
    if (isMultiDay && assignMode === null) return

    const assignedDate = isMultiDay
      ? (assignMode === "day-only" ? dateKey : null)
      : dateKey

    setSubmitting(true)
    try {
      await onSubmit(Array.from(selected), assignedDate)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  /** 選択中の職人名リスト */
  const selectedNames = useMemo(() => {
    return workers.filter((w) => selected.has(w.id)).map((w) => w.name)
  }, [workers, selected])

  const footerContent = (
    <div className="w-full space-y-2">
      {/* 選択中の職人一覧 */}
      {selected.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-sm px-3 py-2">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span className="text-sm font-bold text-blue-700">{selected.size}名を選択中</span>
            {remainingSlots < MAX_TOTAL_PER_SITE && (
              <span className="text-xs text-blue-500">（残り{remainingSlots - selected.size}枠）</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {selectedNames.map((name) => (
              <span key={name} className="inline-flex px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
      {/* ボタン行 */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={onClose} disabled={submitting} className="flex-1 md:flex-none text-sm">
          キャンセル
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={selected.size === 0 || (isMultiDay && assignMode === null) || submitting || isAtLimit}
          className="min-w-[140px] flex-1 md:flex-none text-sm font-bold"
        >
          {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
          {selected.size > 0 ? `${selected.size}名を追加する` : "職人を選択してください"}
        </Button>
      </div>
    </div>
  )

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={
        <span className="flex items-center gap-2 text-base">
          <Users className="w-5 h-5 text-blue-600" />
          {dialogTitle ?? "職人を追加"}
        </span>
      }
      footer={footerContent}
      className="sm:max-w-[940px] max-h-[90vh] flex flex-col"
    >
        <div className="space-y-3 py-2 overflow-y-auto flex-1 min-h-0">
          {/* 検索ボックス */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="名前・会社名で検索..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm border-2 rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
              />
            </div>
            {hiddenCount > 0 && (
              <button
                onClick={() => setShowHidden(!showHidden)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2.5 rounded-sm border-2 text-sm font-bold transition-all active:scale-95 whitespace-nowrap",
                  showHidden
                    ? "bg-slate-700 text-white border-slate-700"
                    : "bg-white text-slate-500 border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                )}
              >
                {showHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                非表示
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-xs font-extrabold leading-none",
                  showHidden ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                )}>
                  {hiddenCount}
                </span>
              </button>
            )}
          </div>

          {/* 配置期間の選択（複数日スケジュールのみ） */}
          {isMultiDay && (
            <div className="space-y-2 pb-2 border-b-2 border-slate-200">
              <div className="text-sm font-bold text-slate-700">
                配置期間を選択
                <span className="text-red-500 ml-0.5">*</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAssignMode("all")}
                  className={cn(
                    "flex items-center gap-2 px-3 py-3 rounded-sm border-2 text-left transition-all",
                    assignMode === "all"
                      ? "bg-blue-50 border-blue-400 ring-1 ring-blue-400 shadow-sm"
                      : selected.size > 0 && assignMode === null
                        ? "border-red-300 bg-red-50/50 hover:border-red-400 animate-pulse"
                        : "hover:bg-slate-50 border-slate-200"
                  )}
                >
                  <CalendarDays className={cn(
                    "w-5 h-5 flex-shrink-0",
                    assignMode === "all" ? "text-blue-600" : "text-slate-400"
                  )} />
                  <div>
                    <div className={cn(
                      "text-sm font-bold",
                      assignMode === "all" ? "text-blue-700" : "text-slate-800"
                    )}>
                      全日程
                    </div>
                    <div className="text-xs text-slate-500">
                      {dateRangeLabel}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAssignMode("day-only")}
                  className={cn(
                    "flex items-center gap-2 px-3 py-3 rounded-sm border-2 text-left transition-all",
                    assignMode === "day-only"
                      ? "bg-blue-50 border-blue-400 ring-1 ring-blue-400 shadow-sm"
                      : selected.size > 0 && assignMode === null
                        ? "border-red-300 bg-red-50/50 hover:border-red-400 animate-pulse"
                        : "hover:bg-slate-50 border-slate-200"
                  )}
                >
                  <CalendarCheck className={cn(
                    "w-5 h-5 flex-shrink-0",
                    assignMode === "day-only" ? "text-blue-600" : "text-slate-400"
                  )} />
                  <div>
                    <div className={cn(
                      "text-sm font-bold",
                      assignMode === "day-only" ? "text-blue-700" : "text-slate-800"
                    )}>
                      {dateDayLabel} だけ
                    </div>
                    <div className="text-xs text-slate-500">
                      この日のみ
                    </div>
                  </div>
                </button>
              </div>

              {assignMode === null && selected.size > 0 && (
                <div className="text-sm text-red-500 font-medium px-1">
                  どちらかを選択してください
                </div>
              )}
            </div>
          )}

          {/* 上限警告 */}
          {isAtLimit && (
            <div className="space-y-2 px-3 py-3 bg-red-50 border border-red-200 rounded-sm">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-red-600">上限{MAX_TOTAL_PER_SITE}名に達しています</span>
              </div>
              <p className="text-sm text-red-500">
                この現場にはこれ以上職人を追加できません。新しい班に分割してください。
              </p>
              {onCreateSplitTeam && (
                <button
                  type="button"
                  onClick={() => {
                    onCreateSplitTeam()
                    onClose()
                  }}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-sm bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-colors"
                >
                  新しい班を作成しますか？
                </button>
              )}
            </div>
          )}

          {/* 推奨情報 */}
          {suggestedSet.size > 0 && selected.size > 0 && !isAtLimit && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-sm">
              <span className="text-sm text-amber-700">
                他現場から<span className="font-bold">{suggestedSet.size}名</span>を自動選択済み
              </span>
            </div>
          )}

          {/* 配置状況サマリー */}
          {busyWorkerInfoMap && !isAtLimit && !loadingWorkers && (() => {
            const idleCount = workers.filter(
              (w) => !infoMap.has(w.id) && !assignedWorkerIds.has(w.id)
            ).length
            return idleCount > 0 ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-sm">
                <span className="text-sm text-orange-700">
                  <span className="font-bold">{idleCount}名</span>が未配置です（{dateDayLabel}）
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-sm">
                <span className="text-sm text-green-700">
                  全員配置済みです（{dateDayLabel}）
                </span>
              </div>
            )
          })()}

          {/* 職人グリッド */}
          {loadingWorkers ? (
            <div className="flex items-center gap-2 py-8 justify-center text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">職人を読み込んでいます...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-base text-slate-400 py-8 text-center">
              {search ? "該当する職人がいません" : "職人が登録されていません"}
            </div>
          ) : (() => {
            const mainWorkers = filtered.filter((w) => (w.workerCategory ?? "MAIN") === "MAIN")
            const subWorkers = filtered.filter((w) => (w.workerCategory ?? "MAIN") === "SUB")
            const hiddenWorkers = filtered.filter((w) => (w.workerCategory ?? "MAIN") === "HIDDEN")

            const SECTION_STYLES: Record<string, { label: string; border: string; bg: string; text: string }> = {
              MAIN: { label: "メイン", border: "border-blue-400", bg: "bg-blue-500", text: "text-white" },
              SUB: { label: "サブ", border: "border-amber-400", bg: "bg-amber-500", text: "text-white" },
              HIDDEN: { label: "非表示", border: "border-slate-300", bg: "bg-slate-400", text: "text-white" },
            }

            function renderCard(w: WorkerData) {
              const isAssigned = assignedWorkerIds.has(w.id)
              const isChecked = selected.has(w.id)
              const isSuggested = suggestedSet.has(w.id)
              const badge = TYPE_BADGE[w.workerType] ?? { label: "協力", className: "bg-slate-100 text-slate-600", order: 9 }
              const isForeman = w.defaultRole === "FOREMAN"
              const busyInfo = busyWorkerInfoMap ? infoMap.get(w.id) : undefined
              const isBusy = busyWorkerInfoMap ? !!busyInfo : undefined
              const isIdle = busyWorkerInfoMap ? !busyInfo && !isAssigned : undefined
              const category = (w.workerCategory as "MAIN" | "SUB" | "HIDDEN") ?? "MAIN"
              const isHidden = category === "HIDDEN"
              const isDisabled = isAssigned || isAtLimit || (!isChecked && !canSelectMore) || isHidden
              const typeBg = w.workerType === "EMPLOYEE" ? "bg-green-500" : w.workerType === "INDEPENDENT" ? "bg-yellow-500" : "bg-slate-400"

              return (
                <div key={w.id} className="relative group/card pb-5">
                  <label
                    className={cn(
                      "relative flex flex-col items-center justify-center cursor-pointer transition-all rounded-sm border-2 p-1.5 aspect-[3/2] active:scale-95",
                      isHidden
                        ? "opacity-40 bg-slate-100 border-slate-300 border-dashed"
                        : isDisabled
                          ? "opacity-30 cursor-not-allowed bg-slate-50 border-slate-200"
                          : isChecked
                            ? "bg-blue-50 border-blue-500 shadow-md ring-2 ring-blue-300"
                            : isIdle
                              ? "bg-orange-50 border-orange-300 hover:border-orange-400"
                              : isSuggested
                                ? "bg-amber-50 border-amber-300 hover:border-amber-400"
                                : "bg-white border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isDisabled}
                      onChange={() => !isDisabled && toggleWorker(w.id)}
                      className="sr-only"
                    />
                    {isChecked && (
                      <div className="absolute top-1 right-1 w-5 h-5 rounded-sm bg-blue-500 flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </div>
                    )}
                    {isHidden && (
                      <div className="absolute top-1 left-1">
                        <EyeOff className="w-4 h-4 text-slate-400" />
                      </div>
                    )}
                    <div className={cn("absolute top-0 left-0 right-0 h-1 rounded-t-sm", isHidden ? "bg-slate-300" : typeBg)} />
                    <span className={cn("text-sm font-extrabold leading-tight text-center truncate w-full mt-1", isHidden ? "text-slate-400" : "text-slate-800")}>
                      {w.name.length > 5 ? w.name.slice(0, 5) : w.name}
                    </span>
                    <div className="flex items-center gap-1 mt-1">
                      <span className={cn("px-1.5 py-0.5 rounded-sm text-[11px] font-bold", badge.className)}>
                        {badge.label}
                      </span>
                      {isForeman && (
                        <span className="px-1.5 py-0.5 rounded-sm text-[11px] font-bold bg-amber-100 text-amber-700 border border-amber-200">長</span>
                      )}
                    </div>
                    <div className="mt-1">
                      {isHidden ? (
                        <span className="text-xs font-bold text-slate-400">非表示</span>
                      ) : isAssigned ? (
                        <span className="text-xs font-bold text-slate-400">アサイン済</span>
                      ) : isIdle ? (
                        <span className="text-xs font-bold text-orange-600">未配置</span>
                      ) : isBusy ? (
                        <span className="text-xs font-bold text-emerald-600">配置済</span>
                      ) : null}
                    </div>
                  </label>
                  {/* カテゴリ切替ボタン（ホバー時表示・30px） */}
                  <div
                    className="absolute -bottom-0 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover/card:opacity-100 z-10 transition-opacity"
                    style={{ pointerEvents: "auto" }}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
                  >
                    {togglingCategory === w.id ? (
                      <div className="w-[30px] h-[30px] rounded-sm bg-white border-2 border-slate-200 shadow-md flex items-center justify-center">
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      </div>
                    ) : (
                      (["MAIN", "SUB", "HIDDEN"] as const).map((cat) => {
                        const catLabels = { MAIN: "M", SUB: "S", HIDDEN: "H" }
                        const isCurrent = category === cat
                        return (
                          <button
                            type="button"
                            key={cat}
                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              if (!isCurrent) changeCategory(w.id, cat)
                            }}
                            className={cn(
                              "w-[30px] h-[30px] flex items-center justify-center text-xs font-extrabold border-2 transition-all shadow-md rounded-sm",
                              isCurrent
                                ? cat === "MAIN" ? "bg-blue-500 text-white border-blue-500"
                                : cat === "SUB" ? "bg-amber-500 text-white border-amber-500"
                                : "bg-slate-500 text-white border-slate-500"
                                : "bg-white text-slate-400 border-slate-200 hover:bg-slate-100 hover:border-slate-400"
                            )}
                          >
                            {catLabels[cat]}
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            }

            function renderSection(key: string, workers: WorkerData[]) {
              if (workers.length === 0) return null
              const style = SECTION_STYLES[key]
              return (
                <div key={key}>
                  <div className={cn("flex items-center gap-2 mb-2 px-1 border-l-4", style.border)}>
                    <span className={cn("px-2 py-0.5 rounded-sm text-xs font-extrabold", style.bg, style.text)}>
                      {style.label}
                    </span>
                    <span className="text-xs text-slate-400 font-bold">{workers.length}名</span>
                  </div>
                  <div className="min-h-[150px] mb-3">
                    <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1.5">
                      {workers.map(renderCard)}
                    </div>
                  </div>
                </div>
              )
            }

            return (
              <div className="max-h-[420px] overflow-y-auto pr-1">
                {renderSection("MAIN", mainWorkers)}
                {renderSection("SUB", subWorkers)}
                {showHidden && renderSection("HIDDEN", hiddenWorkers)}
              </div>
            )
          })()}

        </div>

    </ResponsiveDialog>
  )
}

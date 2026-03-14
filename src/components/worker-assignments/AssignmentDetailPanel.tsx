/**
 * [COMPONENT] 人員配置 - 現場カード詳細パネル
 *
 * 現場カードクリックで下にスライド展開。
 * - 現場名・工期（再掲）
 * - 担当車両セクション（追加/削除）
 * - 職人セクション（カード一覧/追加ダイアログ/削除）
 * - 職人カードのドロップゾーン（@dnd-kit）
 */
"use client"

import { useState, useCallback, useMemo } from "react"
// lucide-react icons removed (Plus no longer needed)
import { useDroppable } from "@dnd-kit/core"
import { toast } from "sonner"
import { cn, formatDateRange } from "@/lib/utils"
import { WorkerCard } from "./WorkerCard"
import { ForemanCard } from "./ForemanCard"
import { AddWorkerDialog } from "./AddWorkerDialog"
import type { AssignmentData, WorkerData, WorkerZoneDropData, WorkerBusyInfo } from "./types"

/** 他現場からコピー可能な職人情報 */
export interface CopyableSourceInfo {
  scheduleId: string
  scheduleName: string | null
  projectName: string
  workers: {
    workerId: string
    workerName: string
    workerType: string
    driverLicenseType: string
    assignedRole: string
  }[]
}

interface Props {
  /** この現場(schedule)に対する、同じteamの全アサイン */
  assignments: AssignmentData[]
  scheduleName: string | null
  projectName: string
  plannedStartDate: string | null
  plannedEndDate: string | null
  teamId: string
  scheduleId: string
  dateKey: string
  accentColor: string
  onRefresh: () => void
  isDragging?: boolean
  /** 同じ日に複数現場に配置されている職人ID一覧 */
  duplicateWorkerIds?: Set<string>
  /** 同じ班・同じ日の他現場のコピー可能な職人 */
  copyableSources?: CopyableSourceInfo[]
  /** 「新しい班を作成」コールバック */
  onCreateSplitTeam?: () => void
  /** この日の職人ごとの配置情報 (workerId → WorkerBusyInfo) */
  busyWorkerInfoMap?: Map<string, WorkerBusyInfo>
  /** コンパクト表示（14日ビュー用: 職人は人数のみ、職長はそのまま） */
  compact?: boolean
  /** 拡大表示（1日ビュー用: ボタン・エリアを大きく表示） */
  expanded?: boolean
  /** 表示モード: "all"=全部, "foreman-only"=職長のみ, "workers-only"=職人のみ */
  renderMode?: "all" | "foreman-only" | "workers-only"
  /** 表示日数（職人カードサイズ調整用） */
  displayDays?: number
  /** ドラッグ中のアイテムタイプ（worker-card以外のときドロップゾーンを無効化） */
  activeDragType?: string
}

export function AssignmentDetailPanel({
  assignments,
  scheduleName,
  projectName,
  plannedStartDate,
  plannedEndDate,
  teamId,
  scheduleId,
  dateKey,
  accentColor,
  onRefresh,
  isDragging: isGlobalDragging,
  duplicateWorkerIds,
  copyableSources,
  onCreateSplitTeam,
  busyWorkerInfoMap,
  compact = false,
  expanded = false,
  renderMode = "all",
  displayDays,
  activeDragType,
}: Props) {
  const [workers, setWorkers] = useState<WorkerData[]>([])
  const [loadingWorkers, setLoadingWorkers] = useState(false)
  const [workerDialogOpen, setWorkerDialogOpen] = useState(false)
  const [addingForeman, setAddingForeman] = useState(false)

  // スケジュールが複数日かどうか
  const isMultiDay = (() => {
    if (!plannedStartDate) return false
    if (!plannedEndDate) return false
    const s = new Date(plannedStartDate)
    const e = new Date(plannedEndDate)
    s.setHours(0, 0, 0, 0)
    e.setHours(0, 0, 0, 0)
    return e.getTime() > s.getTime()
  })()

  // この現場にアサインされた職人
  const workerAssignments = assignments.filter((a) => a.workerId)
  const assignedWorkerIds = new Set(workerAssignments.map((a) => a.workerId).filter(Boolean) as string[])

  const fetchWorkers = useCallback(async () => {
    setLoadingWorkers(true)
    try {
      const res = await fetch("/api/workers")
      if (!res.ok) throw new Error()
      setWorkers(await res.json())
    } catch {
      toast.error("職人データの取得に失敗しました")
    } finally {
      setLoadingWorkers(false)
    }
  }, [])

  // 職人ダイアログを開く
  function openWorkerDialog(forForeman = false) {
    setAddingForeman(forForeman)
    setWorkerDialogOpen(true)
    fetchWorkers()
  }

  // 推奨職人ID（他現場から）
  const suggestedWorkerIds = useMemo(() => {
    const ids = (copyableSources ?? []).flatMap((src) =>
      src.workers
        .filter((w) => !assignedWorkerIds.has(w.workerId))
        .map((w) => w.workerId)
    )
    // 重複除去
    return [...new Set(ids)]
  }, [copyableSources, assignedWorkerIds])

  // 職人一括追加（他現場への追加確認付き）
  async function handleAddWorkers(workerIds: string[], assignedDate: string | null) {
    const forceRole = addingForeman ? "FOREMAN" as const : undefined
    try {
      const res = await fetch("/api/worker-assignments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId, teamId, workerIds, assignedDate, forceRole }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? "追加に失敗しました")
      }
      toast.success(`${workerIds.length}名の職人を追加しました`)
      onRefresh()

      // 他現場が存在する場合、追加確認
      const otherSites = (copyableSources ?? []).filter((s) => s.scheduleId !== scheduleId)
      if (otherSites.length > 0) {
        for (const site of otherSites) {
          const siteName = site.scheduleName ?? site.projectName
          // この現場に既にいる職人を除外
          const existingIds = new Set(site.workers.map((w) => w.workerId))
          const newWorkerIds = workerIds.filter((id) => !existingIds.has(id))
          if (newWorkerIds.length === 0) continue

          const ok = window.confirm(
            `追加した職人のうち${newWorkerIds.length}名を「${siteName}」にも追加しますか？`
          )
          if (ok) {
            try {
              const addRes = await fetch("/api/worker-assignments/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  scheduleId: site.scheduleId,
                  teamId,
                  workerIds: newWorkerIds,
                  assignedDate,
                }),
              })
              if (!addRes.ok) throw new Error()
              toast.success(`「${siteName}」にも${newWorkerIds.length}名を追加しました`)
            } catch {
              toast.error(`「${siteName}」への追加に失敗しました`)
            }
          }
        }
        onRefresh()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "追加に失敗しました"
      toast.error(msg)
      throw err
    }
  }

  // 職長⇔職人切替
  async function handleToggleRole(assignmentId: string, newRole: "FOREMAN" | "WORKER") {
    try {
      const res = await fetch(`/api/worker-assignments/${assignmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedRole: newRole }),
      })
      if (!res.ok) throw new Error()
      toast.success(newRole === "FOREMAN" ? "職長に変更しました" : "職人に変更しました")
      onRefresh()
    } catch {
      toast.error("役割の切替に失敗しました")
    }
  }

  // アサイン削除（確認はカード側の ConfirmDeletePopover で実施済み）
  async function handleDeleteAssignment(assignmentId: string) {
    const target = assignments.find((a) => a.id === assignmentId)
    const label = target?.worker?.name ?? target?.vehicle?.name ?? ""

    try {
      const res = await fetch(`/api/worker-assignments/${assignmentId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success(`${label || "配置"}を削除しました`)
      onRefresh()
    } catch {
      toast.error("削除に失敗しました")
    }
  }

  // 職人ドロップゾーン（@dnd-kit）
  const workerZoneData: WorkerZoneDropData = {
    type: "worker-zone",
    teamId,
    scheduleId,
    dateKey,
  }
  // worker-card ドラッグ時のみドロップ可能（site-card / unassigned-bar では無効化）
  const isWorkerDrag = activeDragType === "worker-card"
  const { isOver: isWorkerZoneOver, setNodeRef: setWorkerZoneRef } = useDroppable({
    id: `worker-zone:${teamId}:${scheduleId}:${dateKey}`,
    data: workerZoneData,
    disabled: isGlobalDragging && !isWorkerDrag,
  })
  const showWorkerDropHighlight = isWorkerZoneOver && isGlobalDragging && isWorkerDrag

  // 職長と一般職人を分離
  const foremanAssignment = workerAssignments.find((a) => a.assignedRole === "FOREMAN" && a.worker)
  const regularWorkers = workerAssignments.filter((a) => a.id !== foremanAssignment?.id && a.worker)

  return (
    <div
      className={cn(
        "animate-in slide-in-from-top-2 duration-200",
        renderMode === "all" && "border-t mt-0.5 pt-1 space-y-1",
      )}
      style={renderMode === "all" ? { borderColor: `${accentColor}30` } : undefined}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 職人セクション（枠付きドロップゾーン） */}
      <div
        ref={setWorkerZoneRef}
        className={cn(
          "rounded-sm transition-all",
          renderMode !== "all" ? "p-0" : expanded ? "p-0.5 min-h-[60px]" : "p-0.5 min-h-[40px]",
          showWorkerDropHighlight && "ring-2 ring-blue-400 bg-blue-50/50"
        )}
      >
        <div className={expanded ? "space-y-1.5" : "space-y-1"}>
          {/* 職長スロット */}
          {renderMode !== "workers-only" && (
          <>
          {foremanAssignment && foremanAssignment.worker ? (
            <ForemanCard
              assignmentId={foremanAssignment.id}
              workerName={foremanAssignment.worker.name}
              workerType={foremanAssignment.worker.workerType}
              driverLicenseType={foremanAssignment.worker.driverLicenseType}
              accentColor={accentColor}
              teamId={teamId}
              scheduleId={scheduleId}
              dateKey={dateKey}
              isMultiDay={isMultiDay && !foremanAssignment.assignedDate && !(foremanAssignment.excludedDates?.length > 0)}
              isDuplicate={!!foremanAssignment.workerId && !!duplicateWorkerIds?.has(foremanAssignment.workerId)}
              isDragging={isGlobalDragging}
              onToggleRole={handleToggleRole}
              onDelete={handleDeleteAssignment}
            />
          ) : (
            <button
              className={cn(
                "w-full rounded-sm border-2 border-dashed border-amber-300 flex items-center justify-center gap-1.5 cursor-pointer hover:border-amber-400 hover:bg-amber-50/50 transition-all",
                expanded ? "h-[44px]" : "h-[32px]"
              )}
              onClick={() => openWorkerDialog(true)}
              title="職長を追加"
            >
              <span className={cn("font-bold text-amber-500", expanded ? "text-sm" : "text-xs")}>+ 職長を追加</span>
            </button>
          )}
          </>
          )}

          {/* 一般職人エリア */}
          {renderMode === "foreman-only" ? null : compact ? (
            /* コンパクト表示: 人数のみ */
            <div
              className="h-[28px] rounded-md border border-slate-200 flex items-center justify-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 transition-all"
              onClick={() => openWorkerDialog()}
              title="クリックで職人を追加"
            >
              {regularWorkers.length === 0 ? (
                <span className="text-xs text-slate-600">職人</span>
              ) : (
                <span className="text-sm font-bold text-slate-600">{regularWorkers.length}名</span>
              )}
            </div>
          ) : (
            /* 通常表示: カード一覧 */
            <div
              className={cn(
                "rounded-sm border-2 border-dashed cursor-pointer transition-all",
                renderMode === "workers-only"
                  ? "min-h-[36px]"
                  : expanded ? "min-h-[100px]" : "min-h-[72px]",
                regularWorkers.length === 0
                  ? "border-amber-300 hover:border-amber-400 hover:bg-amber-50/50 flex items-center justify-center"
                  : cn("border-amber-200 hover:border-amber-300", expanded ? "p-1" : "p-1")
              )}
              onClick={(e) => {
                // カード上でなければ追加ダイアログを開く
                const target = e.target as HTMLElement
                if (target.closest("[data-worker-card]")) return
                openWorkerDialog()
              }}
              title="クリックで職人を追加"
            >
              {regularWorkers.length === 0 ? (
                <span className={cn("font-bold text-amber-500", expanded ? "text-sm" : "text-sm")}>+ 職人を追加</span>
              ) : (
                <div className={cn(
                  "grid gap-1",
                  displayDays == null || displayDays <= 1 ? "grid-cols-5"
                    : displayDays <= 4 ? "grid-cols-4"
                    : "grid-cols-3"
                )}>
                  {regularWorkers.map((a) => (
                    a.worker && (
                      <div key={a.id}>
                        <WorkerCard
                          assignmentId={a.id}
                          workerName={a.worker.name}
                          workerType={a.worker.workerType}
                          driverLicenseType={a.worker.driverLicenseType}
                          assignedRole={a.assignedRole}
                          accentColor={accentColor}
                          teamId={teamId}
                          scheduleId={scheduleId}
                          dateKey={dateKey}
                          isMultiDay={isMultiDay && !a.assignedDate && !(a.excludedDates?.length > 0)}
                          isDuplicate={!!a.workerId && !!duplicateWorkerIds?.has(a.workerId)}
                          isDragging={isGlobalDragging}
                          onToggleRole={handleToggleRole}
                          onDelete={handleDeleteAssignment}
                          showOutline
                          size={displayDays != null && displayDays <= 1 ? "lg" : displayDays != null && displayDays >= 7 ? "sm" : "md"}
                        />
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* 職人追加ダイアログ（他現場からの推奨を事前選択） */}
      <AddWorkerDialog
        open={workerDialogOpen}
        onClose={() => setWorkerDialogOpen(false)}
        onSubmit={handleAddWorkers}
        workers={workers}
        loadingWorkers={loadingWorkers}
        assignedWorkerIds={assignedWorkerIds}
        isMultiDay={isMultiDay}
        dateKey={dateKey}
        dateRangeLabel={formatDateRange(plannedStartDate, plannedEndDate)}
        suggestedWorkerIds={suggestedWorkerIds}
        currentWorkerCount={workerAssignments.length}
        onCreateSplitTeam={onCreateSplitTeam}
        busyWorkerInfoMap={busyWorkerInfoMap}
        foremanOnly={addingForeman}
        dialogTitle={addingForeman ? "職長を選択" : undefined}
        onWorkersChanged={fetchWorkers}
      />
    </div>
  )
}

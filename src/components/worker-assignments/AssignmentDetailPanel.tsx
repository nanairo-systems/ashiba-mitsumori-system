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

import { useState, useCallback } from "react"
import { Plus, Copy } from "lucide-react"
import { useDroppable } from "@dnd-kit/core"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { ja } from "date-fns/locale"
import { WorkerCard } from "./WorkerCard"
import { ForemanCard } from "./ForemanCard"
import { AddWorkerDialog } from "./AddWorkerDialog"
import { CopyWorkersDialog, type CopyableWorkerInfo } from "./CopyWorkersDialog"
import type { AssignmentData, WorkerData, WorkerZoneDropData } from "./types"

/** 他現場からコピー可能な職人情報 */
export interface CopyableSourceInfo {
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
}: Props) {
  const [workers, setWorkers] = useState<WorkerData[]>([])
  const [loadingWorkers, setLoadingWorkers] = useState(false)
  const [workerDialogOpen, setWorkerDialogOpen] = useState(false)
  const [copyDialogOpen, setCopyDialogOpen] = useState(false)

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
      const res = await fetch("/api/workers?isActive=true")
      if (!res.ok) throw new Error()
      setWorkers(await res.json())
    } catch {
      toast.error("職人データの取得に失敗しました")
    } finally {
      setLoadingWorkers(false)
    }
  }, [])

  // 職人ダイアログを開く
  function openWorkerDialog() {
    setWorkerDialogOpen(true)
    fetchWorkers()
  }

  // 職人一括追加
  async function handleAddWorkers(workerIds: string[], assignedDate: string | null) {
    try {
      const res = await fetch("/api/worker-assignments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId, teamId, workerIds, assignedDate }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? "追加に失敗しました")
      }
      toast.success(`${workerIds.length}名の職人を追加しました`)
      onRefresh()
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

  // アサイン削除（確認アラート付き）
  async function handleDeleteAssignment(assignmentId: string) {
    // 対象の名前を取得
    const target = assignments.find((a) => a.id === assignmentId)
    const label = target?.worker?.name ?? target?.vehicle?.name ?? ""
    const ok = window.confirm(`${label ? `「${label}」を` : ""}この配置から削除しますか？`)
    if (!ok) return

    try {
      const res = await fetch(`/api/worker-assignments/${assignmentId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success(`${label || "配置"}を削除しました`)
      onRefresh()
    } catch {
      toast.error("削除に失敗しました")
    }
  }

  function formatDateRange(start: string | null, end: string | null) {
    if (!start) return "日程未定"
    const s = format(new Date(start), "M/d", { locale: ja })
    const e = end ? format(new Date(end), "M/d", { locale: ja }) : s
    return `${s}〜${e}`
  }

  // 職人ドロップゾーン（@dnd-kit）
  const workerZoneData: WorkerZoneDropData = {
    type: "worker-zone",
    teamId,
    scheduleId,
    dateKey,
  }
  const { isOver: isWorkerZoneOver, setNodeRef: setWorkerZoneRef } = useDroppable({
    id: `worker-zone:${teamId}:${scheduleId}:${dateKey}`,
    data: workerZoneData,
  })
  const showWorkerDropHighlight = isWorkerZoneOver && isGlobalDragging

  // コピー可能な職人（既にアサイン済みの職人を除外）
  const copyableWorkers: CopyableWorkerInfo[] = (copyableSources ?? []).flatMap((src) =>
    src.workers
      .filter((w) => !assignedWorkerIds.has(w.workerId))
      .map((w) => ({
        ...w,
        sourceName: src.scheduleName ?? src.projectName,
      }))
  )
  // 重複除去
  const uniqueCopyableWorkers = copyableWorkers.filter(
    (w, i, arr) => arr.findIndex((x) => x.workerId === w.workerId) === i
  )

  // 職長と一般職人を分離
  const foremanAssignment = workerAssignments.find((a) => a.assignedRole === "FOREMAN" && a.worker)
  const regularWorkers = workerAssignments.filter((a) => a.id !== foremanAssignment?.id && a.worker)

  return (
    <div
      className="border-t mt-1 pt-2 space-y-2 animate-in slide-in-from-top-2 duration-200"
      style={{ borderColor: `${accentColor}30` }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 職人セクション（枠付きドロップゾーン） */}
      <div
        ref={setWorkerZoneRef}
        className={cn(
          "border border-slate-200 rounded-lg p-2 min-h-[56px] transition-all",
          showWorkerDropHighlight && "ring-2 ring-blue-400 bg-blue-50/50 border-blue-300"
        )}
      >
        <div className="flex items-start gap-2.5">
          {/* 職長スロット（左上固定） */}
          <div className="flex-shrink-0">
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
              <div
                className="w-[80px] h-[44px] rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:border-amber-400 hover:bg-amber-50/50 transition-all"
                onClick={openWorkerDialog}
                title="職長を設定"
              >
                <span className="text-[10px] text-slate-400 font-medium">職長を設定</span>
              </div>
            )}
          </div>

          {/* 一般職人グリッド */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-end gap-1.5">
              {regularWorkers.map((a) => (
                a.worker && (
                  <WorkerCard
                    key={a.id}
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
                  />
                )
              ))}
              {/* 追加ボタン（グリッド末尾） */}
              <button
                onClick={openWorkerDialog}
                className="w-[52px] h-[33px] rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all"
                title="職人を追加"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* コピーボタン（右下） */}
        {uniqueCopyableWorkers.length > 0 && (
          <div className="mt-1.5 flex justify-end">
            <button
              onClick={() => setCopyDialogOpen(true)}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-amber-300 bg-amber-50 text-[10px] text-amber-600 hover:text-amber-700 hover:border-amber-500 hover:bg-amber-100 transition-all font-medium"
              title="他の現場から職人をコピー"
            >
              <Copy className="w-3 h-3" />
              <span>コピー（{uniqueCopyableWorkers.length}名）</span>
            </button>
          </div>
        )}
      </div>

      {/* 職人追加ダイアログ */}
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
      />

      {/* 他現場からコピーダイアログ */}
      <CopyWorkersDialog
        open={copyDialogOpen}
        onClose={() => setCopyDialogOpen(false)}
        onConfirm={async (workerIds, assignedDate) => {
          await handleAddWorkers(workerIds, assignedDate)
        }}
        workers={uniqueCopyableWorkers}
        targetLabel={scheduleName ?? projectName}
        dateKey={dateKey}
        isMultiDay={isMultiDay}
      />
    </div>
  )
}

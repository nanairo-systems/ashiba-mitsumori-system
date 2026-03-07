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
import { Plus, Truck } from "lucide-react"
import { useDroppable } from "@dnd-kit/core"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { ja } from "date-fns/locale"
import { WorkerCard } from "./WorkerCard"
import { VehicleCard } from "./VehicleCard"
import { AddWorkerDialog } from "./AddWorkerDialog"
import type { AssignmentData, WorkerData, VehicleData, WorkerZoneDropData } from "./types"

interface Props {
  /** この現場(schedule)に対する、同じteamの全アサイン */
  assignments: AssignmentData[]
  scheduleName: string | null
  projectName: string
  plannedStartDate: string | null
  plannedEndDate: string | null
  teamId: string
  scheduleId: string
  accentColor: string
  onRefresh: () => void
  isDragging?: boolean
}

export function AssignmentDetailPanel({
  assignments,
  scheduleName,
  projectName,
  plannedStartDate,
  plannedEndDate,
  teamId,
  scheduleId,
  accentColor,
  onRefresh,
  isDragging: isGlobalDragging,
}: Props) {
  const [workers, setWorkers] = useState<WorkerData[]>([])
  const [vehicles, setVehicles] = useState<VehicleData[]>([])
  const [loadingWorkers, setLoadingWorkers] = useState(false)
  const [loadingVehicles, setLoadingVehicles] = useState(false)
  const [workerDialogOpen, setWorkerDialogOpen] = useState(false)
  const [vehicleDropdownOpen, setVehicleDropdownOpen] = useState(false)

  // この現場にアサインされた職人・車両
  const workerAssignments = assignments.filter((a) => a.workerId)
  const vehicleAssignments = assignments.filter((a) => a.vehicleId)
  const assignedWorkerIds = new Set(workerAssignments.map((a) => a.workerId).filter(Boolean) as string[])
  const assignedVehicleIds = new Set(vehicleAssignments.map((a) => a.vehicleId).filter(Boolean) as string[])

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

  const fetchVehicles = useCallback(async () => {
    setLoadingVehicles(true)
    try {
      const res = await fetch("/api/vehicles?isActive=true")
      if (!res.ok) throw new Error()
      setVehicles(await res.json())
    } catch {
      toast.error("車両データの取得に失敗しました")
    } finally {
      setLoadingVehicles(false)
    }
  }, [])

  // 職人ダイアログを開く
  function openWorkerDialog() {
    setWorkerDialogOpen(true)
    fetchWorkers()
  }

  // 車両ドロップダウンを開く
  function openVehicleDropdown() {
    setVehicleDropdownOpen(true)
    fetchVehicles()
  }

  // 職人一括追加
  async function handleAddWorkers(workerIds: string[]) {
    try {
      const res = await fetch("/api/worker-assignments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId, teamId, workerIds }),
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

  // 車両追加
  async function handleAddVehicle(vehicleId: string) {
    try {
      const res = await fetch("/api/worker-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId, teamId, vehicleId, assignedRole: "WORKER" }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? "追加に失敗しました")
      }
      toast.success("車両を追加しました")
      setVehicleDropdownOpen(false)
      onRefresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "追加に失敗しました"
      toast.error(msg)
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
      onRefresh()
    } catch {
      toast.error("役割の切替に失敗しました")
    }
  }

  // アサイン削除
  async function handleDeleteAssignment(assignmentId: string) {
    try {
      const res = await fetch(`/api/worker-assignments/${assignmentId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success("削除しました")
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
  }
  const { isOver: isWorkerZoneOver, setNodeRef: setWorkerZoneRef } = useDroppable({
    id: `worker-zone:${teamId}:${scheduleId}`,
    data: workerZoneData,
  })
  const showWorkerDropHighlight = isWorkerZoneOver && isGlobalDragging

  const availableVehicles = vehicles.filter((v) => !assignedVehicleIds.has(v.id))

  return (
    <div
      className="border-t mt-1 pt-2 space-y-2 animate-in slide-in-from-top-2 duration-200"
      style={{ borderColor: `${accentColor}30` }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* ヘッダー: 現場名・工期 */}
      <div className="flex items-center gap-2 text-[10px]">
        <span className="font-semibold text-slate-700 truncate">
          {scheduleName ?? projectName}
        </span>
        <span className="text-slate-400">
          {formatDateRange(plannedStartDate, plannedEndDate)}
        </span>
      </div>

      {/* 車両セクション */}
      <div className="space-y-1">
        <div className="flex items-center gap-1 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
          <Truck className="w-3 h-3" />
          車両
        </div>
        <div className="flex flex-wrap gap-1">
          {vehicleAssignments.map((a) => (
            a.vehicle && (
              <VehicleCard
                key={a.id}
                vehicleId={a.id}
                vehicleName={a.vehicle.name}
                licensePlate={a.vehicle.licensePlate}
                accentColor={accentColor}
                onDelete={handleDeleteAssignment}
              />
            )
          ))}
          {/* 車両追加 */}
          <div className="relative">
            <button
              onClick={openVehicleDropdown}
              className="flex items-center gap-0.5 px-1.5 py-1 rounded-md border border-dashed border-slate-300 text-[9px] text-slate-400 hover:text-blue-500 hover:border-blue-300 transition-colors"
            >
              <Plus className="w-3 h-3" />
              車両を追加
            </button>
            {vehicleDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setVehicleDropdownOpen(false)} />
                <div className="absolute top-full left-0 mt-1 z-20 bg-white rounded-lg border shadow-lg min-w-[180px] max-h-[200px] overflow-y-auto">
                  {loadingVehicles ? (
                    <div className="px-3 py-2 text-xs text-slate-400">読み込み中...</div>
                  ) : availableVehicles.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-400">追加可能な車両がありません</div>
                  ) : (
                    availableVehicles.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => handleAddVehicle(v.id)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition-colors flex items-center gap-2"
                      >
                        <Truck className="w-3 h-3 text-slate-400" />
                        <span className="font-medium text-slate-700">{v.name}</span>
                        <span className="text-slate-400">{v.licensePlate}</span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 職人セクション（ドロップゾーン） */}
      <div className="space-y-1">
        <div className="flex items-center gap-1 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
          <span>👷</span>
          職人
        </div>
        <div
          ref={setWorkerZoneRef}
          className={cn(
            "flex flex-wrap gap-1 transition-all",
            showWorkerDropHighlight && "ring-2 ring-blue-400 rounded-md p-1"
          )}
        >
          {workerAssignments.map((a) => (
            a.worker && (
              <WorkerCard
                key={a.id}
                assignmentId={a.id}
                workerName={a.worker.name}
                workerType={a.worker.workerType}
                assignedRole={a.assignedRole}
                accentColor={accentColor}
                teamId={teamId}
                scheduleId={scheduleId}
                isDragging={isGlobalDragging}
                onToggleRole={handleToggleRole}
                onDelete={handleDeleteAssignment}
              />
            )
          ))}
          {/* 職人追加ボタン */}
          <button
            onClick={openWorkerDialog}
            className="flex items-center gap-0.5 px-1.5 py-1 rounded-md border border-dashed border-slate-300 text-[9px] text-slate-400 hover:text-blue-500 hover:border-blue-300 transition-colors"
          >
            <Plus className="w-3 h-3" />
            職人を追加
          </button>
        </div>
      </div>

      {/* 職人追加ダイアログ */}
      <AddWorkerDialog
        open={workerDialogOpen}
        onClose={() => setWorkerDialogOpen(false)}
        onSubmit={handleAddWorkers}
        workers={workers}
        loadingWorkers={loadingWorkers}
        assignedWorkerIds={assignedWorkerIds}
      />
    </div>
  )
}

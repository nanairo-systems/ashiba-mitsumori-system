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
import { AddVehicleDialog } from "./AddVehicleDialog"
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
  dateKey: string
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
  dateKey,
  accentColor,
  onRefresh,
  isDragging: isGlobalDragging,
}: Props) {
  const [workers, setWorkers] = useState<WorkerData[]>([])
  const [vehicles, setVehicles] = useState<VehicleData[]>([])
  const [loadingWorkers, setLoadingWorkers] = useState(false)
  const [loadingVehicles, setLoadingVehicles] = useState(false)
  const [workerDialogOpen, setWorkerDialogOpen] = useState(false)
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false)

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

  // 車両ダイアログを開く
  function openVehicleDialog() {
    setVehicleDialogOpen(true)
    fetchVehicles()
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
      setVehicleDialogOpen(false)
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
    dateKey,
  }
  const { isOver: isWorkerZoneOver, setNodeRef: setWorkerZoneRef } = useDroppable({
    id: `worker-zone:${teamId}:${scheduleId}:${dateKey}`,
    data: workerZoneData,
  })
  const showWorkerDropHighlight = isWorkerZoneOver && isGlobalDragging

  return (
    <div
      className="border-t mt-0.5 pt-1 space-y-1 animate-in slide-in-from-top-2 duration-200"
      style={{ borderColor: `${accentColor}30` }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 車両セクション（コンパクト：ラベル+ボタン一体化） */}
      <div className="flex flex-wrap items-center gap-1">
        <button
          onClick={openVehicleDialog}
          className="flex items-center gap-0.5 px-1 py-0.5 rounded border border-dashed border-slate-300 text-[9px] text-slate-400 hover:text-blue-500 hover:border-blue-300 transition-colors"
        >
          <Truck className="w-3 h-3" />
          <Plus className="w-2.5 h-2.5" />
        </button>
        {vehicleAssignments.map((a) => (
          a.vehicle && (
            <VehicleCard
              key={a.id}
              vehicleId={a.id}
              vehicleName={a.vehicle.name}
              licensePlate={a.vehicle.licensePlate}
              vehicleType={a.vehicle.vehicleType}
              capacity={a.vehicle.capacity}
              inspectionDate={a.vehicle.inspectionDate}
              accentColor={accentColor}
              onDelete={handleDeleteAssignment}
            />
          )
        ))}
      </div>

      {/* 職人セクション（コンパクト：ドロップゾーン） */}
      <div
        ref={setWorkerZoneRef}
        className={cn(
          "flex flex-wrap items-end gap-1 transition-all",
          showWorkerDropHighlight && "ring-2 ring-blue-400 rounded-md p-1"
        )}
      >
        <button
          onClick={openWorkerDialog}
          className="flex items-center gap-0.5 px-1 py-0.5 rounded border border-dashed border-slate-300 text-[9px] text-slate-400 hover:text-blue-500 hover:border-blue-300 transition-colors"
        >
          <span className="text-[8px]">👷</span>
          <Plus className="w-2.5 h-2.5" />
        </button>
        {workerAssignments.map((a) => (
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
              isDragging={isGlobalDragging}
              onToggleRole={handleToggleRole}
              onDelete={handleDeleteAssignment}
            />
          )
        ))}
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

      {/* 車両選択ダイアログ */}
      <AddVehicleDialog
        open={vehicleDialogOpen}
        onClose={() => setVehicleDialogOpen(false)}
        onSelect={handleAddVehicle}
        vehicles={vehicles}
        loading={loadingVehicles}
        assignedVehicleIds={assignedVehicleIds}
      />
    </div>
  )
}

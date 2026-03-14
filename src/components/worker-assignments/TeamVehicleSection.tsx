/**
 * [COMPONENT] 班レベルの車両セクション
 *
 * 班×日付ごとに1箇所だけ表示される車両管理エリア。
 * - 車両未登録: トラック型追加ボタン
 * - 車両登録済み: VehicleCardクリックで変更
 * - AddVehicleDialog で車両選択
 * - 期間選択（この日だけ / 全日程）対応
 */
"use client"

import { useState, useCallback } from "react"
import { Plus, Truck } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { VehicleCard } from "./VehicleCard"
import { AddVehicleDialog } from "./AddVehicleDialog"
import type { AssignmentData, VehicleData } from "./types"

interface Props {
  /** この班-日付の車両アサインメント */
  vehicleAssignments: AssignmentData[]
  teamId: string
  dateKey: string
  /** 車両アサインメント作成時に使う scheduleId（最初の現場） */
  hostScheduleId: string
  /** ホスト現場の日程（期間選択の判定用） */
  hostScheduleDates: { start: string | null; end: string | null }
  accentColor: string
  onRefresh: () => void
  /** 同日に複数チームで使用中の車両ID */
  duplicateVehicleIds?: Set<string>
  /** 拡大表示（1日ビュー用） */
  expanded?: boolean
}

export function TeamVehicleSection({
  vehicleAssignments,
  teamId,
  dateKey,
  hostScheduleId,
  hostScheduleDates,
  accentColor,
  onRefresh,
  duplicateVehicleIds,
  expanded = false,
}: Props) {
  const [vehicles, setVehicles] = useState<VehicleData[]>([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  // スケジュールが複数日かどうか
  const isMultiDay = (() => {
    if (!hostScheduleDates.start || !hostScheduleDates.end) return false
    const s = new Date(hostScheduleDates.start)
    const e = new Date(hostScheduleDates.end)
    s.setHours(0, 0, 0, 0)
    e.setHours(0, 0, 0, 0)
    return e.getTime() > s.getTime()
  })()

  const assignedVehicleIds = new Set(
    vehicleAssignments.map((a) => a.vehicleId).filter(Boolean) as string[]
  )

  const fetchVehicles = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/vehicles?isActive=true")
      if (!res.ok) throw new Error()
      setVehicles(await res.json())
    } catch {
      toast.error("車両データの取得に失敗しました")
    } finally {
      setLoading(false)
    }
  }, [])

  function openDialog() {
    setDialogOpen(true)
    fetchVehicles()
  }

  async function handleAddVehicle(vehicleId: string, assignedDate: string | null) {
    try {
      // 既存の車両割当があれば先に削除（変更の場合）
      for (const va of vehicleAssignments) {
        await fetch(`/api/worker-assignments/${va.id}`, { method: "DELETE" })
      }
      const res = await fetch("/api/worker-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId: hostScheduleId,
          teamId,
          vehicleId,
          assignedRole: "WORKER",
          assignedDate,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? "追加に失敗しました")
      }
      toast.success(vehicleAssignments.length > 0 ? "車両を変更しました" : "車両を追加しました")
      setDialogOpen(false)
      onRefresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "追加に失敗しました"
      toast.error(msg)
    }
  }

  // 車両削除（確認はカード側の ConfirmDeletePopover で実施済み）
  async function handleDeleteVehicle(assignmentId: string) {
    const target = vehicleAssignments.find((a) => a.id === assignmentId)
    const label = target?.vehicle?.name ?? "車両"

    try {
      const res = await fetch(`/api/worker-assignments/${assignmentId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success(`${label}を削除しました`)
      onRefresh()
    } catch {
      toast.error("削除に失敗しました")
    }
  }

  return (
    <div className="my-0.5">
      {vehicleAssignments.length === 0 ? (
        <button
          onClick={openDialog}
          className={cn(
            "w-full flex items-center justify-center gap-1.5 px-2 rounded-md border-2 border-dashed border-slate-300 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all",
            expanded ? "text-sm text-slate-500 font-bold" : "text-xs text-slate-600"
          )}
          style={{ height: expanded ? 44 : 28 }}
          title="車両を追加"
        >
          <Truck className={expanded ? "w-5 h-5" : "w-4 h-4"} />
          {expanded ? <span>+ 車両を追加</span> : <Plus className="w-3 h-3" />}
        </button>
      ) : (
        <div className="space-y-1">
          {vehicleAssignments.map((a) =>
            a.vehicle ? (
              <VehicleCard
                key={a.id}
                vehicleId={a.id}
                vehicleName={a.vehicle.name}
                licensePlate={a.vehicle.licensePlate}
                vehicleType={a.vehicle.vehicleType}
                capacity={a.vehicle.capacity}
                inspectionDate={a.vehicle.inspectionDate}
                accentColor={accentColor}
                isDuplicate={!!a.vehicleId && !!duplicateVehicleIds?.has(a.vehicleId)}
                onDelete={handleDeleteVehicle}
                onChangeVehicle={openDialog}
                compact
              />
            ) : null
          )}
        </div>
      )}

      <AddVehicleDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSelect={handleAddVehicle}
        vehicles={vehicles}
        loading={loading}
        assignedVehicleIds={assignedVehicleIds}
        isMultiDay={isMultiDay}
        dateKey={dateKey}
      />
    </div>
  )
}

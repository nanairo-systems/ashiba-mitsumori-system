/**
 * [COMPONENT] 車両選択ダイアログ
 *
 * アクティブな車両一覧を表示し、1台を選択して割り当てる。
 * - 車両名・ナンバー・車種・積載量・車検期限を表示
 * - 車検期限30日以内は赤字で警告表示
 * - 既にアサイン済みの車両はグレーアウト
 * - ラジオボタンで1台選択
 */
"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Truck, AlertTriangle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { VehicleData } from "./types"

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (vehicleId: string) => void
  vehicles: VehicleData[]
  loading: boolean
  assignedVehicleIds: Set<string>
}

export function AddVehicleDialog({
  open,
  onClose,
  onSelect,
  vehicles,
  loading,
  assignedVehicleIds,
}: Props) {
  const [selectedId, setSelectedId] = useState<string>("")

  function handleOpenChange(o: boolean) {
    if (!o) {
      setSelectedId("")
      onClose()
    }
  }

  function handleSubmit() {
    if (!selectedId) return
    onSelect(selectedId)
    setSelectedId("")
  }

  const now = new Date()

  function getInspectionInfo(inspectionDate: string | null) {
    if (!inspectionDate) return { warning: false, label: "未設定" }
    const d = new Date(inspectionDate)
    const daysLeft = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return {
      warning: daysLeft <= 30,
      label: `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`,
      daysLeft,
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-600" />
            車両を割り当て
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            読み込み中...
          </div>
        ) : vehicles.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-400">
            アクティブな車両がありません
          </div>
        ) : (
          <div className="border rounded-lg divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
            {vehicles.map((v) => {
              const isAssigned = assignedVehicleIds.has(v.id)
              const inspection = getInspectionInfo(v.inspectionDate)
              const isSelected = selectedId === v.id

              return (
                <label
                  key={v.id}
                  className={cn(
                    "flex items-start gap-3 px-3 py-2.5 transition-colors",
                    isAssigned
                      ? "opacity-40 cursor-not-allowed"
                      : isSelected
                      ? "bg-blue-50 cursor-pointer"
                      : "hover:bg-slate-50 cursor-pointer"
                  )}
                >
                  <input
                    type="radio"
                    name="vehicle"
                    checked={isSelected}
                    disabled={isAssigned}
                    onChange={() => setSelectedId(v.id)}
                    className="mt-1 text-blue-600 focus:ring-blue-200"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Truck className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-slate-800">{v.name}</span>
                      <span className="text-xs text-slate-400">{v.licensePlate}</span>
                      {isAssigned && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">
                          割当済
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 pl-5">
                      {v.vehicleType && <span>{v.vehicleType}</span>}
                      {v.capacity && <span>積載: {v.capacity}</span>}
                    </div>
                    <div className={cn(
                      "flex items-center gap-1 mt-0.5 text-xs pl-5",
                      inspection.warning ? "text-red-600 font-medium" : "text-slate-400"
                    )}>
                      {inspection.warning && <AlertTriangle className="w-3 h-3" />}
                      車検期限：{inspection.label}
                      {inspection.warning && inspection.daysLeft !== undefined && (
                        <span>（{inspection.daysLeft}日後）</span>
                      )}
                    </div>
                  </div>
                </label>
              )
            })}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            キャンセル
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedId}
            className="flex-1"
          >
            割り当てる
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

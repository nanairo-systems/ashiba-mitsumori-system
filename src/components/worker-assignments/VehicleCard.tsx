/**
 * [COMPONENT] 車両カード
 *
 * Truckアイコン・車両名・ナンバープレート・車種・積載量・削除ボタン
 * 車検期限が30日以内の場合は赤いボーダーと警告アイコンを表示
 */
"use client"

import { Truck, X, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  vehicleId: string
  vehicleName: string
  licensePlate: string
  vehicleType?: string | null
  capacity?: string | null
  inspectionDate?: string | null
  accentColor: string
  onDelete: (vehicleId: string) => void
}

export function VehicleCard({
  vehicleId,
  vehicleName,
  licensePlate,
  vehicleType,
  capacity,
  inspectionDate,
  accentColor,
  onDelete,
}: Props) {
  // 車検期限チェック
  const now = new Date()
  let inspectionWarning = false
  let inspectionLabel = ""

  if (inspectionDate) {
    const d = new Date(inspectionDate)
    const daysUntilInspection = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    inspectionWarning = daysUntilInspection <= 30
    inspectionLabel = `${d.getMonth() + 1}月${d.getDate()}日`
  }

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-0.5 rounded-md px-2 py-1 border text-[10px]",
        inspectionWarning && "border-red-400 bg-red-50"
      )}
      style={
        inspectionWarning
          ? undefined
          : {
              borderColor: `${accentColor}40`,
              backgroundColor: `${accentColor}10`,
            }
      }
    >
      {/* 削除ボタン */}
      <button
        onClick={() => onDelete(vehicleId)}
        className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-white border border-slate-200 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:border-red-300 transition-all"
        title="削除"
      >
        <X className="w-2 h-2 text-slate-400 hover:text-red-500" />
      </button>

      {/* 1行目: アイコン + 車両名 + ナンバー */}
      <div className="flex items-center gap-1.5">
        <Truck
          className="w-3.5 h-3.5 flex-shrink-0"
          style={{ color: inspectionWarning ? "#ef4444" : accentColor }}
        />
        <span className="font-medium text-slate-800 truncate max-w-[60px]">{vehicleName}</span>
        <span className="text-[8px] text-slate-400 truncate">{licensePlate}</span>
      </div>

      {/* 2行目: 車種・積載量 */}
      {(vehicleType || capacity) && (
        <div className="flex items-center gap-1.5 pl-5 text-[8px] text-slate-400">
          {vehicleType && <span>{vehicleType}</span>}
          {vehicleType && capacity && <span>/</span>}
          {capacity && <span>{capacity}</span>}
        </div>
      )}

      {/* 3行目: 車検期限警告 */}
      {inspectionWarning && (
        <div className="flex items-center gap-1 pl-5 text-[8px] text-red-600 font-medium">
          <AlertTriangle className="w-2.5 h-2.5" />
          車検期限：{inspectionLabel}
        </div>
      )}
    </div>
  )
}

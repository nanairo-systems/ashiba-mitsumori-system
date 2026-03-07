/**
 * [COMPONENT] 車両カード
 *
 * Truckアイコン・車両名・ナンバープレート・削除ボタン
 */
"use client"

import { Truck, X } from "lucide-react"

interface Props {
  vehicleId: string
  vehicleName: string
  licensePlate: string
  accentColor: string
  onDelete: (vehicleId: string) => void
}

export function VehicleCard({
  vehicleId,
  vehicleName,
  licensePlate,
  accentColor,
  onDelete,
}: Props) {
  return (
    <div
      className="group relative flex items-center gap-1.5 rounded-md px-2 py-1 border text-[10px]"
      style={{
        borderColor: `${accentColor}40`,
        backgroundColor: `${accentColor}10`,
      }}
    >
      {/* 削除ボタン */}
      <button
        onClick={() => onDelete(vehicleId)}
        className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-white border border-slate-200 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:border-red-300 transition-all"
        title="削除"
      >
        <X className="w-2 h-2 text-slate-400 hover:text-red-500" />
      </button>

      <Truck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accentColor }} />
      <span className="font-medium text-slate-800 truncate max-w-[60px]">{vehicleName}</span>
      <span className="text-[8px] text-slate-400 truncate">{licensePlate}</span>
    </div>
  )
}

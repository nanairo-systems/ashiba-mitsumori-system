/**
 * [COMPONENT] 車両カード
 *
 * Truckアイコン・車両名・ナンバープレート・車種・積載量・削除ボタン
 * 車検期限が30日以内の場合は赤いボーダーと警告アイコンを表示
 */
"use client"

import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { ConfirmDeletePopover } from "./ConfirmDeletePopover"

interface Props {
  vehicleId: string
  vehicleName: string
  licensePlate: string
  vehicleType?: string | null
  capacity?: string | null
  inspectionDate?: string | null
  accentColor: string
  isDuplicate?: boolean
  onDelete: (vehicleId: string) => void
  /** カードクリックで車両変更ダイアログを開く */
  onChangeVehicle?: () => void
  /** コンパクト表示（車検期限非表示） */
  compact?: boolean
}

/** トラックアイコン固定色 */
const TRUCK_COLOR = "#2563eb"

export function VehicleCard({
  vehicleId,
  vehicleName,
  licensePlate,
  vehicleType,
  capacity,
  inspectionDate,
  accentColor,
  isDuplicate,
  onDelete,
  onChangeVehicle,
  compact,
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

  const truckColor = inspectionWarning && !compact ? "#ef4444" : TRUCK_COLOR

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-0.5 rounded-sm px-2.5 py-1.5 border-2 text-xs shadow-sm",
        inspectionWarning && !compact && "border-red-400 bg-red-50",
        onChangeVehicle && "cursor-pointer hover:shadow-md transition-shadow"
      )}
      style={
        inspectionWarning && !compact
          ? undefined
          : {
              borderColor: "#93b4f1",
              backgroundColor: "#eef4fd",
            }
      }
      onClick={onChangeVehicle}
      title={onChangeVehicle ? "クリックで車両を変更" : undefined}
    >
      {/* 削除確認ポップオーバー */}
      <div className="absolute -top-1.5 -right-1.5 z-20 opacity-0 group-hover:opacity-100 transition-all">
        <ConfirmDeletePopover
          message={`「${vehicleName}」を削除しますか？`}
          onConfirm={() => onDelete(vehicleId)}
          triggerClassName="w-5 h-5 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center hover:bg-red-50 hover:border-red-400 transition-all shadow-sm"
          iconClassName="w-3 h-3 text-slate-400 hover:text-red-500"
        />
      </div>

      {/* 1行目: トラック型アイコン + 車両名 + ナンバー */}
      <div className="flex items-center gap-1.5">
        <svg className="w-5 h-4 flex-shrink-0" viewBox="0 0 24 18" fill="none">
          {/* 荷台 */}
          <rect x="0" y="2" width="14" height="11" rx="1.5" fill={truckColor} opacity="0.2" stroke={truckColor} strokeWidth="1.5" />
          {/* キャビン */}
          <path d="M14 6 L14 13 L22 13 L22 9.5 L19 6 Z" fill={truckColor} opacity="0.35" stroke={truckColor} strokeWidth="1.5" strokeLinejoin="round" />
          {/* フロントガラス */}
          <path d="M15.5 7 L18 7 L20.5 10 L15.5 10 Z" fill="white" opacity="0.8" />
          {/* タイヤ */}
          <circle cx="5" cy="15" r="2.5" fill={truckColor} />
          <circle cx="5" cy="15" r="1" fill="white" />
          <circle cx="19" cy="15" r="2.5" fill={truckColor} />
          <circle cx="19" cy="15" r="1" fill="white" />
        </svg>
        <span className="font-semibold text-slate-800 truncate max-w-[80px]">{vehicleName}</span>
        <span className="text-xs text-slate-600 truncate">{licensePlate}</span>
      </div>

      {/* 2行目: 車種・積載量（compact時は非表示） */}
      {!compact && (vehicleType || capacity) && (
        <div className="flex items-center gap-1.5 pl-5.5 text-xs text-slate-500">
          {vehicleType && <span>{vehicleType}</span>}
          {vehicleType && capacity && <span>/</span>}
          {capacity && <span>{capacity}</span>}
        </div>
      )}

      {/* 3行目: 車検期限警告（compact時は非表示） */}
      {!compact && inspectionWarning && (
        <div className="flex items-center gap-1 pl-5.5 text-xs text-red-600 font-semibold">
          <AlertTriangle className="w-3 h-3" />
          車検期限：{inspectionLabel}
        </div>
      )}

      {/* 重複配置警告 */}
      {isDuplicate && (
        <div className="flex items-center gap-1 pl-5.5 text-xs text-orange-600 font-semibold">
          <AlertTriangle className="w-3 h-3" />
          同日に他現場でも使用中
        </div>
      )}
    </div>
  )
}

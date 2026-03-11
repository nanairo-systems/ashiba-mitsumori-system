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
import { ResponsiveDialog } from "./ResponsiveDialog"
import { Button } from "@/components/ui/button"
import { Truck, AlertTriangle, Loader2, CheckCircle2, Calendar, CalendarDays } from "lucide-react"
import { cn } from "@/lib/utils"
import type { VehicleData } from "./types"

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (vehicleId: string, assignedDate: string | null) => void
  vehicles: VehicleData[]
  loading: boolean
  assignedVehicleIds: Set<string>
  /** 複数日スケジュールかどうか */
  isMultiDay?: boolean
  /** 現在の日付キー (YYYY-MM-DD) */
  dateKey?: string
}

export function AddVehicleDialog({
  open,
  onClose,
  onSelect,
  vehicles,
  loading,
  assignedVehicleIds,
  isMultiDay,
  dateKey,
}: Props) {
  const [selectedId, setSelectedId] = useState<string>("")
  const [thisDayOnly, setThisDayOnly] = useState(true)

  // 日付ラベル (3/10 形式)
  const dateLabel = dateKey
    ? `${new Date(dateKey + "T00:00:00").getMonth() + 1}/${new Date(dateKey + "T00:00:00").getDate()}`
    : ""

  function handleOpenChange(o: boolean) {
    if (!o) {
      setSelectedId("")
      setThisDayOnly(true)
      onClose()
    }
  }

  function handleSubmit() {
    if (!selectedId) return
    if (isMultiDay && !dateKey) return
    const assignedDate = (isMultiDay && thisDayOnly && dateKey) ? dateKey : null
    onSelect(selectedId, assignedDate)
    setSelectedId("")
    setThisDayOnly(true)
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

  const footerContent = (
    <>
      <Button variant="outline" onClick={onClose} className="flex-1 md:flex-none">
        キャンセル
      </Button>
      <Button
        onClick={handleSubmit}
        disabled={!selectedId}
        className="min-w-[120px] flex-1 md:flex-none"
      >
        割り当てる
      </Button>
    </>
  )

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={
        <span className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-blue-600" />
          車両を割り当て
        </span>
      }
      footer={footerContent}
      className="sm:max-w-lg max-h-[85vh] flex flex-col"
    >
        <div className="flex-1 min-h-0 overflow-y-auto py-2 space-y-3">
          {/* 期間選択トグル（複数日スケジュールの場合） */}
          {isMultiDay && dateKey && (
            <div className="flex gap-2 px-1">
              <button
                type="button"
                onClick={() => setThisDayOnly(true)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs border-2 transition-all font-medium",
                  thisDayOnly
                    ? "bg-blue-50 border-blue-400 text-blue-700 shadow-sm"
                    : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                <Calendar className="w-4 h-4" />
                {dateLabel}のみ
              </button>
              <button
                type="button"
                onClick={() => setThisDayOnly(false)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs border-2 transition-all font-medium",
                  !thisDayOnly
                    ? "bg-blue-50 border-blue-400 text-blue-700 shadow-sm"
                    : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                <CalendarDays className="w-4 h-4" />
                全日程
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <span className="text-sm">読み込み中...</span>
            </div>
          ) : vehicles.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-400">
              アクティブな車両がありません
            </div>
          ) : (
            <div className="border-2 rounded-lg divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
              {vehicles.map((v) => {
                const isAssigned = assignedVehicleIds.has(v.id)
                const inspection = getInspectionInfo(v.inspectionDate)
                const isSelected = selectedId === v.id

                return (
                  <label
                    key={v.id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 transition-all",
                      isAssigned
                        ? "opacity-40 cursor-not-allowed"
                        : isSelected
                        ? "bg-blue-50 cursor-pointer"
                        : "hover:bg-slate-50 cursor-pointer"
                    )}
                  >
                    <div className="mt-1">
                      {isSelected ? (
                        <CheckCircle2 className="w-5 h-5 text-blue-600" />
                      ) : (
                        <input
                          type="radio"
                          name="vehicle"
                          checked={isSelected}
                          disabled={isAssigned}
                          onChange={() => setSelectedId(v.id)}
                          className="w-4 h-4 mt-0.5 text-blue-600 focus:ring-blue-200"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Truck className={cn(
                          "w-4 h-4 flex-shrink-0",
                          isSelected ? "text-blue-600" : "text-slate-400"
                        )} />
                        <span className="text-sm font-semibold text-slate-800">{v.name}</span>
                        <span className="text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                          {v.licensePlate}
                        </span>
                        {isAssigned && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-slate-200 text-slate-500">
                            割当済
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 pl-6">
                        {v.vehicleType && (
                          <span className="bg-slate-50 px-1.5 py-0.5 rounded">{v.vehicleType}</span>
                        )}
                        {v.capacity && (
                          <span className="bg-slate-50 px-1.5 py-0.5 rounded">積載: {v.capacity}</span>
                        )}
                      </div>
                      <div className={cn(
                        "flex items-center gap-1.5 mt-1 text-xs pl-6",
                        inspection.warning ? "text-red-600 font-semibold" : "text-slate-600"
                      )}>
                        {inspection.warning && <AlertTriangle className="w-3.5 h-3.5" />}
                        車検期限：{inspection.label}
                        {inspection.warning && inspection.daysLeft !== undefined && (
                          <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-xs font-bold">
                            残り{inspection.daysLeft}日
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </div>

    </ResponsiveDialog>
  )
}

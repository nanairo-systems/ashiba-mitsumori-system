/**
 * [COMPONENT] 人員配置管理 - 現場追加ダイアログ
 *
 * 工程一覧から選択して、指定日付・班に人員配置を追加する。
 */
"use client"

import { useState, useEffect } from "react"
import { ResponsiveDialog } from "./ResponsiveDialog"
import { Button } from "@/components/ui/button"
import { Loader2, Plus } from "lucide-react"
import { format } from "date-fns"
import { ja } from "date-fns/locale"
import { formatDateRange } from "@/lib/utils"
import type { ScheduleData, TeamData } from "./types"

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (scheduleId: string) => Promise<void>
  targetDate: Date
  targetTeam: TeamData
  schedules: ScheduleData[]
  loadingSchedules: boolean
  onNewScheduleClick?: () => void
}

export function AddAssignmentDialog({
  open,
  onClose,
  onSubmit,
  targetDate,
  targetTeam,
  schedules,
  loadingSchedules,
  onNewScheduleClick,
}: Props) {
  const [selectedScheduleId, setSelectedScheduleId] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) setSelectedScheduleId("")
  }, [open])

  async function handleSubmit() {
    if (!selectedScheduleId) return
    setSubmitting(true)
    try {
      await onSubmit(selectedScheduleId)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  function formatAmount(amount: string) {
    const n = Number(amount)
    if (isNaN(n)) return ""
    return `¥${n.toLocaleString()}`
  }

  const footerContent = (
    <>
      <Button variant="outline" size="sm" onClick={onClose} disabled={submitting} className="flex-1 md:flex-none">
        キャンセル
      </Button>
      <Button
        size="sm"
        onClick={handleSubmit}
        disabled={!selectedScheduleId || submitting}
        className="flex-1 md:flex-none"
      >
        {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
        追加
      </Button>
    </>
  )

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="現場を追加"
      footer={footerContent}
      className="sm:max-w-md"
    >
        <div className="space-y-4 py-2">
          {/* 対象情報 */}
          <div className="flex items-center gap-3 text-sm bg-slate-50 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: targetTeam.colorCode ?? "#94a3b8" }}
              />
              <span className="font-medium text-slate-700">{targetTeam.name}</span>
            </div>
            <span className="text-slate-400">|</span>
            <span className="text-slate-600">
              {format(targetDate, "yyyy年M月d日(E)", { locale: ja })}
            </span>
          </div>

          {/* 工程選択 */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">
              工事日程を選択
            </label>
            {loadingSchedules ? (
              <div className="flex items-center gap-2 py-4 justify-center text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">工事日程を読み込んでいます...</span>
              </div>
            ) : schedules.length === 0 ? (
              <div className="text-sm text-slate-600 py-4 text-center">
                選択可能な工事日程がありません
              </div>
            ) : (
              <div className="max-h-[300px] overflow-y-auto border rounded-lg divide-y divide-slate-100">
                {schedules.map((s) => {
                  const isSelected = selectedScheduleId === s.id
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedScheduleId(s.id)}
                      className={`w-full text-left px-3 py-2.5 transition-colors ${
                        isSelected
                          ? "bg-blue-50 border-l-2 border-l-blue-500"
                          : "hover:bg-slate-50 border-l-2 border-l-transparent"
                      }`}
                    >
                      <div className="text-sm font-medium text-slate-800">
                        {s.project.name}
                        {s.name && (
                          <span className="text-slate-500 font-normal ml-1">/ {s.name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-500">
                          {formatDateRange(s.plannedStartDate, s.plannedEndDate)}
                        </span>
                        <span className="text-xs text-slate-600">
                          {formatAmount(s.contract?.totalAmount ?? "0")}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* 新しい現場を作成するリンク */}
            {onNewScheduleClick && (
              <button
                onClick={onNewScheduleClick}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 mt-2 rounded-lg border border-dashed border-slate-300 text-sm text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                新しい現場を作成
              </button>
            )}
          </div>
        </div>

    </ResponsiveDialog>
  )
}

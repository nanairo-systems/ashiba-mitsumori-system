/**
 * [現操-01] 現場操作ダイアログ（メインモジュール）
 *
 * 現場情報確認・着工/完工操作・日程変更・作業種別変更・写真添付を
 * 1つのダイアログに統合。同一プロジェクトの複数工程をタブで切替可能。
 * 他ページからも再利用可能。
 *
 * 使用例:
 *   <SiteOpsDialog
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     schedule={scheduleData}
 *     onUpdated={() => refreshData()}
 *   />
 */
"use client"

import { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ClipboardList, X, Loader2 } from "lucide-react"
import { SiteOpsInfoSection } from "./SiteOpsInfoSection"
import { SiteOpsStatusSection } from "./SiteOpsStatusSection"
import { SiteOpsDateSection } from "./SiteOpsDateSection"
import { SiteOpsPhotoSection } from "./SiteOpsPhotoSection"
import { cn } from "@/lib/utils"
import type { ScheduleData } from "@/components/worker-assignments/types"

/** 作業種別のスタイル */
const WORK_TYPE_BADGE: Record<string, { label: string; className: string }> = {
  ASSEMBLY: { label: "組立", className: "bg-blue-100 text-blue-700 border-blue-300" },
  DISASSEMBLY: { label: "解体", className: "bg-orange-100 text-orange-700 border-orange-300" },
  REWORK: { label: "その他", className: "bg-slate-100 text-slate-600 border-slate-300" },
}

interface SiteOpsDialogProps {
  open: boolean
  onClose: () => void
  /** スケジュールデータ（呼び出し元が既に持っているデータを渡す） */
  schedule: ScheduleData | null
  /** 更新後に呼び出し元のデータをリフレッシュするコールバック */
  onUpdated?: () => void
}

export function SiteOpsDialog({ open, onClose, schedule, onUpdated }: SiteOpsDialogProps) {
  // 同一プロジェクトの全工程
  const [siblings, setSiblings] = useState<ScheduleData[]>([])
  const [loadingSiblings, setLoadingSiblings] = useState(false)
  // 現在表示中の工程ID
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null)

  // プロジェクトIDが変わったら兄弟工程を取得
  const projectId = schedule?.contract.project.id
  const fetchSiblings = useCallback(async (projId: string, initialSchedule: ScheduleData) => {
    setLoadingSiblings(true)
    try {
      const res = await fetch(`/api/schedules?projectId=${projId}`)
      if (!res.ok) throw new Error()
      const data: ScheduleData[] = await res.json()
      if (data.length > 0) {
        setSiblings(data)
      } else {
        // APIから取得できない場合は渡されたスケジュール単体を使う
        setSiblings([initialSchedule])
      }
    } catch {
      setSiblings([initialSchedule])
    } finally {
      setLoadingSiblings(false)
    }
  }, [])

  useEffect(() => {
    if (open && schedule && projectId) {
      setActiveScheduleId(schedule.id)
      // 初回は渡されたスケジュールを即表示、バックグラウンドで兄弟を取得
      setSiblings([schedule])
      fetchSiblings(projectId, schedule)
    }
    if (!open) {
      setSiblings([])
      setActiveScheduleId(null)
    }
  }, [open, schedule, projectId, fetchSiblings])

  if (!schedule) return null

  // 現在表示するスケジュール（兄弟リストから選択）
  const activeSchedule = siblings.find((s) => s.id === activeScheduleId) ?? siblings[0] ?? schedule
  const siteName = activeSchedule.contract.project.name

  // 更新後: 兄弟リストを再取得 + 親に通知
  const handleUpdated = () => {
    if (projectId && schedule) {
      fetchSiblings(projectId, schedule)
    }
    onUpdated?.()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-0 gap-0">
        {/* ヘッダー */}
        <DialogHeader className="px-5 pt-5 pb-3 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            <span className="truncate">{siteName}</span>
            <span className="ml-auto text-[10px] text-slate-400 font-normal">現操-01</span>
          </DialogTitle>
        </DialogHeader>

        {/* 工程タブ（2件以上の場合のみ表示） */}
        {siblings.length > 1 && (
          <div className="px-5 pb-2 flex-shrink-0">
            <div className="flex gap-1.5 flex-wrap">
              {siblings.map((s) => {
                const isActive = s.id === activeScheduleId
                const badgeInfo = WORK_TYPE_BADGE[s.workType] ?? WORK_TYPE_BADGE.REWORK
                const displayName = s.name ?? badgeInfo.label
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveScheduleId(s.id)}
                    className={cn(
                      "text-xs font-medium px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5",
                      isActive
                        ? `${badgeInfo.className} ring-2 ring-offset-1 ring-blue-400 shadow-sm`
                        : "bg-white text-slate-500 border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                    )}
                  >
                    <span>{displayName}</span>
                    {s.actualEndDate ? (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-green-50 text-green-600 border-green-200">完工</Badge>
                    ) : s.actualStartDate ? (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-amber-50 text-amber-600 border-amber-200">作業中</Badge>
                    ) : null}
                  </button>
                )
              })}
            </div>
            {loadingSiblings && (
              <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>工程を読み込み中...</span>
              </div>
            )}
          </div>
        )}

        {siblings.length > 1 && <Separator />}

        {/* スクロール可能なコンテンツ */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
          {/* 現操-03: 現場情報 */}
          <SiteOpsInfoSection schedule={activeSchedule} />

          <Separator />

          {/* 現操-02: 着工・完工 */}
          <SiteOpsStatusSection
            key={`status-${activeSchedule.id}`}
            scheduleId={activeSchedule.id}
            actualStartDate={activeSchedule.actualStartDate}
            actualEndDate={activeSchedule.actualEndDate}
            onUpdated={handleUpdated}
          />

          <Separator />

          {/* 現操-04: 日程・種別変更 */}
          <SiteOpsDateSection
            key={`date-${activeSchedule.id}`}
            scheduleId={activeSchedule.id}
            plannedStartDate={activeSchedule.plannedStartDate}
            plannedEndDate={activeSchedule.plannedEndDate}
            workType={activeSchedule.workType}
            onUpdated={handleUpdated}
          />

          <Separator />

          {/* 現操-05: 写真添付 */}
          <SiteOpsPhotoSection />
        </div>

        {/* フッター */}
        <div className="flex-shrink-0 border-t px-5 py-3 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="w-3.5 h-3.5 mr-1.5" />
            閉じる
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

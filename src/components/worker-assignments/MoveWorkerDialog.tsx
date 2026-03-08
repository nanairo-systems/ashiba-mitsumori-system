/**
 * [COMPONENT] 職人移動ダイアログ
 *
 * 職人をドロップしたとき、移動方法を選択:
 * - 「この日だけ移動」: その日だけ別現場に配置
 * - 「全日程から外す」: 元の現場から完全に外して移動
 */
"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, CalendarDays, CalendarX2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PendingWorkerMove } from "./types"

interface Props {
  move: PendingWorkerMove | null
  onConfirm: (moveType: "day-only" | "all") => Promise<void>
  onCancel: () => void
}

export function MoveWorkerDialog({ move, onConfirm, onCancel }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [selected, setSelected] = useState<"day-only" | "all" | null>(null)

  if (!move) return null

  async function handleConfirm(type: "day-only" | "all") {
    setSubmitting(true)
    setSelected(type)
    try {
      await onConfirm(type)
    } finally {
      setSubmitting(false)
      setSelected(null)
    }
  }

  const dateLabel = move.moveDate.replace(/^\d{4}-/, "").replace("-", "/")

  return (
    <Dialog open={!!move} onOpenChange={(o) => !o && !submitting && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">職人を移動</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="text-sm text-slate-600">
            <span className="font-medium text-slate-800">{move.workerName}</span>
            {" を移動します。"}
          </div>

          {move.isMultiDay && (
            <div className="text-xs text-amber-600 bg-amber-50 rounded-md px-3 py-2">
              この職人は複数日の現場に配置されています。
              移動方法を選択してください。
            </div>
          )}

          <div className="space-y-2">
            {/* この日だけ移動 */}
            {move.isMultiDay && (
              <button
                onClick={() => handleConfirm("day-only")}
                disabled={submitting}
                className={cn(
                  "w-full flex items-start gap-3 px-3 py-3 rounded-lg border text-left transition-colors",
                  "hover:bg-blue-50 hover:border-blue-300",
                  submitting && "opacity-50 cursor-not-allowed"
                )}
              >
                <CalendarDays className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-slate-800">
                    {selected === "day-only" && submitting && (
                      <Loader2 className="w-3.5 h-3.5 inline mr-1 animate-spin" />
                    )}
                    {dateLabel} だけ移動
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    他の日は元の現場に残ります
                  </div>
                </div>
              </button>
            )}

            {/* 全日程から外す */}
            <button
              onClick={() => handleConfirm("all")}
              disabled={submitting}
              className={cn(
                "w-full flex items-start gap-3 px-3 py-3 rounded-lg border text-left transition-colors",
                "hover:bg-orange-50 hover:border-orange-300",
                submitting && "opacity-50 cursor-not-allowed"
              )}
            >
              <CalendarX2 className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-slate-800">
                  {selected === "all" && submitting && (
                    <Loader2 className="w-3.5 h-3.5 inline mr-1 animate-spin" />
                  )}
                  {move.isMultiDay ? "全日程から外して移動" : "移動する"}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {move.isMultiDay
                    ? "元の現場から完全に外します"
                    : "この職人を別の現場に移動します"}
                </div>
              </div>
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel} disabled={submitting}>
            キャンセル
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

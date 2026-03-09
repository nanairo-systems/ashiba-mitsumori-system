/**
 * [現操-02] 着工・完工操作セクション
 *
 * 現場の作業ステータス管理。着工/完工ボタンと取り消し操作。
 * 他ページからも再利用可能なモジュール。
 */
"use client"

import { useState } from "react"
import { Play, CheckCircle2, Undo2, Loader2, HardHat } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type WorkStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED"

const STATUS_CONFIG: Record<WorkStatus, { label: string; className: string }> = {
  NOT_STARTED: { label: "未着工", className: "bg-slate-100 text-slate-600 border-slate-300" },
  IN_PROGRESS: { label: "作業中", className: "bg-amber-100 text-amber-700 border-amber-300" },
  COMPLETED: { label: "完工済", className: "bg-green-100 text-green-700 border-green-300" },
}

function deriveStatus(actualStart: string | null, actualEnd: string | null): WorkStatus {
  if (actualEnd) return "COMPLETED"
  if (actualStart) return "IN_PROGRESS"
  return "NOT_STARTED"
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

interface Props {
  scheduleId: string
  actualStartDate: string | null
  actualEndDate: string | null
  onUpdated?: () => void
}

export function SiteOpsStatusSection({ scheduleId, actualStartDate, actualEndDate, onUpdated }: Props) {
  const [saving, setSaving] = useState<string | null>(null)
  const [localStart, setLocalStart] = useState(actualStartDate)
  const [localEnd, setLocalEnd] = useState(actualEndDate)

  const status = deriveStatus(localStart, localEnd)
  const config = STATUS_CONFIG[status]

  async function patchSchedule(data: Record<string, string | null>, actionLabel: string) {
    setSaving(actionLabel)
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      // ローカルステート更新
      if ("actualStartDate" in data) setLocalStart(data.actualStartDate)
      if ("actualEndDate" in data) setLocalEnd(data.actualEndDate)
      toast.success(`${actionLabel}しました`)
      onUpdated?.()
    } catch {
      toast.error(`${actionLabel}に失敗しました`)
    } finally {
      setSaving(null)
    }
  }

  const handleStart = () => patchSchedule({ actualStartDate: todayStr() }, "着工")
  const handleComplete = () => patchSchedule({ actualEndDate: todayStr() }, "完工")
  const handleUndoStart = () => patchSchedule({ actualStartDate: null, actualEndDate: null }, "着工取消")
  const handleUndoComplete = () => patchSchedule({ actualEndDate: null }, "完工取消")

  return (
    <div className="space-y-3">
      {/* セクションヘッダー */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
        <HardHat className="w-3.5 h-3.5" />
        <span>現操-02 着工・完工</span>
      </div>

      {/* ステータスバッジ */}
      <div className="flex items-center gap-3">
        <Badge className={cn("text-xs px-2 py-1 border", config.className)}>
          {config.label}
        </Badge>
        {localStart && (
          <span className="text-xs text-slate-500">
            着工: {formatDate(localStart)}
          </span>
        )}
        {localEnd && (
          <span className="text-xs text-slate-500">
            完工: {formatDate(localEnd)}
          </span>
        )}
      </div>

      {/* 操作ボタン */}
      <div className="flex items-center gap-2 flex-wrap">
        {status === "NOT_STARTED" && (
          <Button
            size="sm"
            className="h-8 bg-amber-500 hover:bg-amber-600 text-white"
            onClick={handleStart}
            disabled={!!saving}
          >
            {saving === "着工" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Play className="w-3.5 h-3.5 mr-1.5" />}
            着工する
          </Button>
        )}

        {status === "IN_PROGRESS" && (
          <>
            <Button
              size="sm"
              className="h-8 bg-green-600 hover:bg-green-700 text-white"
              onClick={handleComplete}
              disabled={!!saving}
            >
              {saving === "完工" ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
              完工する
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-slate-500"
              onClick={handleUndoStart}
              disabled={!!saving}
            >
              <Undo2 className="w-3 h-3 mr-1" />
              着工取消
            </Button>
          </>
        )}

        {status === "COMPLETED" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-slate-500"
            onClick={handleUndoComplete}
            disabled={!!saving}
          >
            <Undo2 className="w-3 h-3 mr-1" />
            完工取消
          </Button>
        )}
      </div>
    </div>
  )
}

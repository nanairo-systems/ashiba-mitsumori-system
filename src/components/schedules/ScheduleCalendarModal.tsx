/**
 * [COMPONENT] 工程カレンダー モーダル - ScheduleCalendarModal
 *
 * 月次カレンダーを大きなダイアログで表示する共通モーダルコンテナ。
 * - 工程画面（ScheduleGantt）と契約詳細（ContractDetail）の両方から呼び出せる
 * - contracts が1件 → 固定表示、複数 → セレクトで選択
 * - 日付クリック → ScheduleFormDialog（工程追加）
 * - 工程バークリック → ScheduleFormDialog（工程編集）
 */
"use client"

import { useState, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react"
import { useRouter } from "next/navigation"
import type { ContractData, ScheduleData, WorkTypeMaster } from "./schedule-types"
import { ScheduleCalendar } from "./ScheduleCalendar"
import { ScheduleFormDialog } from "./ScheduleFormDialog"

interface Props {
  open: boolean
  onClose: () => void
  contracts: ContractData[]
  workTypes: WorkTypeMaster[]
  defaultContractId?: string
  onScheduleChanged: () => void
}

export function ScheduleCalendarModal({
  open,
  onClose,
  contracts,
  workTypes,
  defaultContractId,
  onScheduleChanged,
}: Props) {
  const router = useRouter()
  const today = new Date()

  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedContractId, setSelectedContractId] = useState(
    defaultContractId ?? contracts[0]?.id ?? ""
  )
  const [createOpen, setCreateOpen] = useState(false)
  const [createDate, setCreateDate] = useState("")
  const [editSchedule, setEditSchedule] = useState<ScheduleData | null>(null)

  const selectedContract = useMemo(
    () => contracts.find((c) => c.id === selectedContractId),
    [contracts, selectedContractId]
  )

  function prevMonth() {
    if (month === 0) {
      setYear((y) => y - 1)
      setMonth(11)
    } else {
      setMonth((m) => m - 1)
    }
  }

  function nextMonth() {
    if (month === 11) {
      setYear((y) => y + 1)
      setMonth(0)
    } else {
      setMonth((m) => m + 1)
    }
  }

  function handleDateClick(dateStr: string) {
    if (!selectedContractId) return
    setCreateDate(dateStr)
    setCreateOpen(true)
  }

  function handleScheduleClick(schedule: ScheduleData) {
    setEditSchedule(schedule)
  }

  function handleSaved() {
    onScheduleChanged()
    router.refresh()
  }

  const contractLabel = selectedContract
    ? `${selectedContract.project.name}（${selectedContract.project.companyName}）`
    : "案件を選択してください"

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-4xl w-full p-0 gap-0 overflow-hidden max-h-[92vh]">
          {/* ヘッダー */}
          <DialogHeader className="px-5 pt-4 pb-3 border-b bg-white">
            <div className="flex items-center gap-3">
              <DialogTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="w-5 h-5 text-blue-500" />
                工程カレンダー
              </DialogTitle>

              {/* 案件選択 or 案件名表示 */}
              {contracts.length > 1 ? (
                <Select
                  value={selectedContractId}
                  onValueChange={setSelectedContractId}
                >
                  <SelectTrigger className="flex-1 max-w-xs h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {contracts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.project.name}（{c.project.companyName}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-sm text-slate-600 truncate">{contractLabel}</span>
              )}
            </div>

            {/* 月ナビゲーション */}
            <div className="flex items-center gap-1.5 mt-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={prevMonth}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-semibold min-w-[6rem] text-center">
                {year}年{month + 1}月
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={nextMonth}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2"
                onClick={() => {
                  setYear(today.getFullYear())
                  setMonth(today.getMonth())
                }}
              >
                今月
              </Button>
              <span className="ml-auto text-[11px] text-slate-400">
                日付をクリックして工程を追加
              </span>
            </div>
          </DialogHeader>

          {/* カレンダー本体 */}
          <div className="overflow-y-auto px-4 pb-4 pt-3">
            {selectedContractId ? (
              <ScheduleCalendar
                year={year}
                month={month}
                schedules={selectedContract?.schedules ?? []}
                workTypes={workTypes}
                onDateClick={handleDateClick}
                onScheduleClick={handleScheduleClick}
              />
            ) : (
              <div className="text-center text-slate-400 py-12 text-sm">
                案件を選択してください
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 工程追加ダイアログ */}
      {createOpen && selectedContractId && (
        <ScheduleFormDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          contractId={selectedContractId}
          workTypes={workTypes}
          initialDate={createDate}
          onSaved={handleSaved}
        />
      )}

      {/* 工程編集ダイアログ */}
      {editSchedule && selectedContractId && (
        <ScheduleFormDialog
          open={!!editSchedule}
          onClose={() => setEditSchedule(null)}
          contractId={selectedContractId}
          workTypes={workTypes}
          schedule={editSchedule}
          onSaved={handleSaved}
          onDeleted={handleSaved}
        />
      )}
    </>
  )
}

/**
 * [COMPONENT] 工程情報入力フォーム（共有モジュール）
 *
 * 工事名・作業内容・組み立て日/解体日・契約金額を入力するフォーム。
 * 使用先:
 *   - AddScheduleDialog (人員配置 → 現場追加)
 *   - NewEstimateForm (新規見積作成 → Step4 工程追加)
 */
"use client"

import { useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ScheduleEntryFormProps {
  workType: string
  onWorkTypeChange: (v: string) => void
  scheduleName: string
  onScheduleNameChange: (v: string) => void
  startDate: string
  onStartDateChange: (v: string) => void
  endDate: string
  onEndDateChange: (v: string) => void
  contractAmount?: string
  onContractAmountChange?: (v: string) => void
  /** 契約金額欄を非表示にする */
  hideContractAmount?: boolean
}

export function ScheduleEntryForm({
  workType,
  onWorkTypeChange,
  scheduleName,
  onScheduleNameChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  contractAmount = "",
  onContractAmountChange,
  hideContractAmount = false,
}: ScheduleEntryFormProps) {
  const taxIncludedAmount = useMemo(() => {
    const amount = Number(contractAmount)
    if (!contractAmount || isNaN(amount)) return null
    return Math.floor(amount * 1.1)
  }, [contractAmount])

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>
          工事名 <span className="text-red-500">*</span>
        </Label>
        <Input
          placeholder="例：足場仮設工事"
          value={workType}
          onChange={(e) => onWorkTypeChange(e.target.value)}
          autoFocus
          className="text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label>作業内容（任意）</Label>
        <Input
          placeholder="例：外壁塗装用足場"
          value={scheduleName}
          onChange={(e) => onScheduleNameChange(e.target.value)}
          className="text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>
            組み立て日 <span className="text-red-500">*</span>
          </Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label>
            解体日 <span className="text-red-500">*</span>
          </Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="text-sm"
          />
        </div>
      </div>

      {!hideContractAmount && (
        <div className="space-y-2">
          <Label>契約金額・税抜（任意）</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">¥</span>
            <Input
              type="number"
              placeholder="0"
              value={contractAmount}
              onChange={(e) => onContractAmountChange?.(e.target.value)}
              className="text-sm pl-7"
              min={0}
            />
          </div>
          {taxIncludedAmount !== null && (
            <p className="text-xs text-slate-500">
              税込金額: <span className="font-medium">¥{taxIncludedAmount.toLocaleString()}</span>
              <span className="text-slate-600 ml-1">（税率10%）</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}

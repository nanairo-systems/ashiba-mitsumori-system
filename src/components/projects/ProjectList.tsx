/**
 * [COMPONENT] 商談一覧 - ProjectList
 *
 * 会社ごとにグループ化して現場を表示する。
 * 1現場につき複数見積に対応。現場をヘッダー行とし、見積をサブ行で表示する。
 *
 * 状況表示ルール:
 *   見積サブ行 → 各見積の状況
 *   現場ヘッダー → 合計金額 + 見積件数バッジ
 */
"use client"

import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { formatDate, formatCurrency, formatCompanyPaymentTerms } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Plus,
  Search,
  Archive,
  MoreHorizontal,
  Eye,
  FileText,
  HandshakeIcon,
  ChevronDown,
  ChevronRight,
  Building2,
  FilePlus2,
  CheckSquare,
  Square,
  Tag,
  User2,
  X,
  MapPin,
  Calendar,
} from "lucide-react"
import { toast } from "sonner"
import { Loader2 as LoaderIcon, CalendarClock, BookOpen } from "lucide-react"
import { EstimateDetail } from "@/components/estimates/EstimateDetail"
import { ProjectDetail } from "@/components/projects/ProjectDetail"
import type { EstimateStatus, EstimateType } from "@prisma/client"

// ─── 型定義 ────────────────────────────────────────────

interface EstimateRow {
  id: string
  title: string | null
  estimateType: EstimateType
  status: EstimateStatus
  confirmedAt: Date | null
  createdAt: Date
  user: { id: string; name: string }
  totalAmount: number
}

interface Project {
  id: string
  shortId: string
  name: string
  address: string | null
  isArchived: boolean
  createdAt: Date
  updatedAt: Date
  branch: {
    name: string
    company: {
      id: string
      name: string
      paymentClosingDay: number | null
      paymentMonthOffset: number
      paymentPayDay: number | null
      paymentNetDays: number | null
    }
  }
  contact: { name: string } | null
  estimates: EstimateRow[]
}

interface Props {
  projects: Project[]
  currentUser: { id: string; name: string }
}

// ─── 定数 ──────────────────────────────────────────────

const EST_STATUS_LABEL: Record<EstimateStatus, string> = {
  DRAFT: "下書き",
  CONFIRMED: "確定済",
  SENT: "送付済",
  OLD: "旧版",
}

// フィルタータグ用の短縮ラベル（2文字）
const EST_STATUS_SHORT: Record<EstimateStatus, string> = {
  DRAFT: "下書",
  CONFIRMED: "確定",
  SENT: "送付",
  OLD: "旧版",
}

const EST_STATUS_STYLE: Record<EstimateStatus, string> = {
  DRAFT: "bg-amber-500 text-white",
  CONFIRMED: "bg-blue-500 text-white",
  SENT: "bg-emerald-500 text-white",
  OLD: "bg-orange-400 text-white",
}

// 追加見積ラベル
const EST_TYPE_STYLE: Record<EstimateType, { label: string; className: string } | null> = {
  INITIAL: null, // 表示なし
  ADDITIONAL: { label: "追加", className: "bg-amber-100 text-amber-700 border border-amber-300" },
}

// ─── 契約処理ダイアログ ────────────────────────────────

interface ContractDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  project: Project
  estimate: EstimateRow
  onContracted: () => void
}

const PAYMENT_TYPE_OPTIONS = [
  { value: "FULL", label: "一括支払い", description: "完工後に一括で請求" },
  { value: "TWO_PHASE", label: "2回払い（組立・解体）", description: "組立完了時と解体完了時の2回" },
  { value: "PROGRESS", label: "出来高払い", description: "進捗に応じて都度請求" },
] as const

function ContractDialog({ open, onOpenChange, project, estimate, onContracted }: ContractDialogProps) {
  const origTotal = estimate.totalAmount
  const origTaxExcluded = Math.round(origTotal / 1.1)
  const origTax = origTotal - origTaxExcluded

  const companyPaymentTerms = formatCompanyPaymentTerms({
    paymentClosingDay: project.branch.company.paymentClosingDay,
    paymentMonthOffset: project.branch.company.paymentMonthOffset,
    paymentPayDay: project.branch.company.paymentPayDay,
    paymentNetDays: project.branch.company.paymentNetDays,
  })

  const today = new Date().toISOString().slice(0, 10)
  const [contractDate, setContractDate] = useState(today)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)

  // 金額調整（双方向: 値引き ↔ 税抜金額）
  const [discountStr, setDiscountStr] = useState("0")
  const [taxExclStr, setTaxExclStr] = useState(String(origTaxExcluded))
  const [lastEdited, setLastEdited] = useState<"discount" | "amount">("discount")

  // 支払サイクル
  const [paymentType, setPaymentType] = useState<"FULL" | "TWO_PHASE" | "PROGRESS">("FULL")

  const discount = Math.max(0, parseInt(discountStr, 10) || 0)

  // 最終金額の計算
  const finalTaxExcluded = lastEdited === "amount"
    ? Math.max(0, parseInt(taxExclStr, 10) || 0)
    : origTaxExcluded - discount
  const finalTax = Math.floor(finalTaxExcluded * 0.1)
  const finalTotal = finalTaxExcluded + finalTax
  const effectiveDiscount = origTaxExcluded - finalTaxExcluded

  async function handleSubmit() {
    if (!contractDate) { toast.error("契約日を入力してください"); return }
    if (finalTaxExcluded <= 0) { toast.error("契約金額が0以下です"); return }
    setLoading(true)
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          estimateId: estimate.id,
          contractAmount: origTaxExcluded,
          taxAmount: origTax,
          totalAmount: origTotal,
          discountAmount: effectiveDiscount,
          adjustedAmount: effectiveDiscount > 0 ? finalTaxExcluded : null,
          adjustedTotal: effectiveDiscount > 0 ? finalTotal : null,
          paymentType,
          contractDate,
          startDate: startDate || null,
          endDate: endDate || null,
          paymentTerms: companyPaymentTerms || null,
          note: note || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "契約処理に失敗しました")
      }
      toast.success("契約処理が完了しました")
      onOpenChange(false)
      onContracted()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "エラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  const estLabel = estimate.title ?? EST_STATUS_LABEL[estimate.status]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandshakeIcon className="w-5 h-5 text-green-600" />
            契約処理
          </DialogTitle>
          <DialogDescription>
            {project.branch.company.name} / {project.name}
            {estimate.title && ` — ${estLabel}`}
          </DialogDescription>
        </DialogHeader>

        {/* 見積金額 */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1 text-sm">
          <div className="flex justify-between text-slate-500">
            <span>見積 税抜金額</span>
            <span className="font-mono">¥{formatCurrency(origTaxExcluded)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>消費税（10%）</span>
            <span className="font-mono">¥{formatCurrency(origTax)}</span>
          </div>
          <div className="flex justify-between font-medium text-slate-700 pt-1 border-t border-slate-200">
            <span>見積金額（税込）</span>
            <span className="font-mono">¥{formatCurrency(origTotal)}</span>
          </div>
        </div>

        {/* 金額調整 */}
        <div className="space-y-3 border border-slate-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">金額調整</p>
          <p className="text-xs text-slate-400">値引き額か税抜金額のどちらかを変更すると、もう一方が自動で調整されます</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">値引き額（税抜）</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">¥</span>
                <Input
                  type="number"
                  min={0}
                  value={lastEdited === "discount" ? discountStr : String(effectiveDiscount)}
                  onChange={(e) => {
                    setDiscountStr(e.target.value)
                    setLastEdited("discount")
                  }}
                  onFocus={() => {
                    if (lastEdited !== "discount") {
                      setDiscountStr(String(effectiveDiscount))
                      setLastEdited("discount")
                    }
                  }}
                  className="pl-7 text-sm font-mono"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">契約金額（税抜）</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">¥</span>
                <Input
                  type="number"
                  min={0}
                  value={lastEdited === "amount" ? taxExclStr : String(finalTaxExcluded)}
                  onChange={(e) => {
                    setTaxExclStr(e.target.value)
                    setLastEdited("amount")
                  }}
                  onFocus={() => {
                    if (lastEdited !== "amount") {
                      setTaxExclStr(String(finalTaxExcluded))
                      setLastEdited("amount")
                    }
                  }}
                  className="pl-7 text-sm font-mono"
                />
              </div>
            </div>
          </div>

          {/* 契約金額プレビュー */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1 text-sm">
            {effectiveDiscount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>値引き</span>
                <span className="font-mono">-¥{formatCurrency(effectiveDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>契約 税抜金額</span>
              <span className="font-mono">¥{formatCurrency(finalTaxExcluded)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>消費税（10%）</span>
              <span className="font-mono">¥{formatCurrency(finalTax)}</span>
            </div>
            <div className="flex justify-between font-bold text-green-800 pt-1 border-t border-green-200">
              <span>契約金額（税込）</span>
              <span className="font-mono text-base">¥{formatCurrency(finalTotal)}</span>
            </div>
          </div>
        </div>

        {/* 支払サイクル */}
        <div className="space-y-2 border border-slate-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">支払サイクル</p>
          <div className="space-y-1.5">
            {PAYMENT_TYPE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  paymentType === opt.value
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="paymentType"
                  value={opt.value}
                  checked={paymentType === opt.value}
                  onChange={() => setPaymentType(opt.value)}
                  className="accent-blue-600 mt-0.5"
                />
                <div>
                  <p className={`text-sm font-medium ${paymentType === opt.value ? "text-blue-800" : "text-slate-700"}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-slate-400">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* 契約情報 */}
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">契約日 <span className="text-red-500">*</span></Label>
            <Input type="date" value={contractDate} onChange={(e) => setContractDate(e.target.value)} className="text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">着工予定日</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">完工予定日</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">備考</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="特記事項があれば入力" rows={2} className="text-sm resize-none" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>キャンセル</Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-green-600 hover:bg-green-700">
            <HandshakeIcon className="w-4 h-4 mr-2" />
            {loading ? "処理中..." : "契約を確定する"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── 一括契約処理ダイアログ ───────────────────────────────

interface BulkContractItem {
  estimateId: string
  estimateName: string
  projectId: string
  projectName: string
  companyName: string
  totalAmount: number
}

interface BulkContractDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  items: BulkContractItem[]
  onCompleted: () => void
}

type PaymentTypeValue = "FULL" | "TWO_PHASE" | "PROGRESS"
const PAYMENT_TYPE_SHORT: Record<PaymentTypeValue, string> = {
  FULL: "一括",
  TWO_PHASE: "2回払い",
  PROGRESS: "出来高",
}

interface BulkItemOverride {
  discountStr: string
  taxExclStr: string
  lastEdited: "discount" | "amount"
  paymentType: PaymentTypeValue
}

function BulkContractDialog({ open, onOpenChange, items, onCompleted }: BulkContractDialogProps) {
  const today = new Date().toISOString().slice(0, 10)
  const [contractDate, setContractDate] = useState(today)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)

  // 個別設定
  const [overrides, setOverrides] = useState<Record<string, BulkItemOverride>>({})

  function getOverride(estimateId: string, item?: BulkContractItem): BulkItemOverride {
    const origTaxExcl = item ? Math.round(item.totalAmount / 1.1) : 0
    return overrides[estimateId] ?? { discountStr: "0", taxExclStr: String(origTaxExcl), lastEdited: "discount", paymentType: "FULL" }
  }

  function updateOverride(estimateId: string, patch: Partial<BulkItemOverride>) {
    setOverrides((prev) => {
      const current = prev[estimateId] ?? { discountStr: "0", taxExclStr: "0", lastEdited: "discount" as const, paymentType: "FULL" as PaymentTypeValue }
      return { ...prev, [estimateId]: { ...current, ...patch } }
    })
  }

  function calcItemFinal(item: BulkContractItem) {
    const ovr = getOverride(item.estimateId, item)
    const origTaxExcluded = Math.round(item.totalAmount / 1.1)
    let adjusted: number
    if (ovr.lastEdited === "amount") {
      adjusted = Math.max(0, parseInt(ovr.taxExclStr, 10) || 0)
    } else {
      const discount = Math.max(0, parseInt(ovr.discountStr, 10) || 0)
      adjusted = origTaxExcluded - discount
    }
    const tax = Math.floor(adjusted * 0.1)
    const effectiveDiscount = origTaxExcluded - adjusted
    return { adjusted, tax, total: adjusted + tax, discount: effectiveDiscount }
  }

  const grandTotal = items.reduce((s, i) => s + calcItemFinal(i).total, 0)

  async function handleSubmit() {
    if (!contractDate) { toast.error("契約日を入力してください"); return }
    setLoading(true)
    try {
      const overridesPayload = items.map((item) => {
        const ovr = getOverride(item.estimateId)
        const { adjusted, total, discount } = calcItemFinal(item)
        return {
          estimateId: item.estimateId,
          discountAmount: discount,
          adjustedAmount: discount > 0 ? adjusted : null,
          adjustedTotal: discount > 0 ? total : null,
          paymentType: ovr.paymentType,
        }
      })

      const res = await fetch("/api/contracts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimateIds: items.map((i) => i.estimateId),
          overrides: overridesPayload,
          contractDate,
          startDate: startDate || null,
          endDate: endDate || null,
          note: note || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "契約処理に失敗しました")
      }
      const data = await res.json()
      toast.success(`${data.count}件の契約処理が完了しました`)
      onOpenChange(false)
      onCompleted()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "エラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandshakeIcon className="w-5 h-5 text-green-600" />
            一括契約処理
          </DialogTitle>
          <DialogDescription>
            {items.length}件の見積をまとめて契約処理します。
          </DialogDescription>
        </DialogHeader>

        {/* 対象見積一覧（全件展開） */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          {items.map((item, idx) => {
            const ovr = getOverride(item.estimateId, item)
            const { adjusted, total, discount, tax } = calcItemFinal(item)
            const origTaxExcl = Math.round(item.totalAmount / 1.1)

            return (
              <div key={item.estimateId} className={`${idx > 0 ? "border-t border-slate-200" : ""}`}>
                {/* 見積ヘッダー */}
                <div className="px-4 py-2.5 bg-slate-50/80 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{item.estimateName}</p>
                    <p className="text-xs text-slate-400 truncate">{item.companyName} / {item.projectName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-400">見積金額（税抜）</p>
                    <p className="font-mono text-sm text-slate-600">¥{formatCurrency(origTaxExcl)}</p>
                  </div>
                </div>

                {/* 金額調整・支払サイクル */}
                <div className="px-4 py-3 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">値引き額（税抜）</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">¥</span>
                        <Input
                          type="number"
                          min={0}
                          value={ovr.lastEdited === "discount" ? ovr.discountStr : String(discount)}
                          onChange={(e) => updateOverride(item.estimateId, { discountStr: e.target.value, lastEdited: "discount" })}
                          onFocus={() => {
                            if (ovr.lastEdited !== "discount") {
                              updateOverride(item.estimateId, { discountStr: String(discount), lastEdited: "discount" })
                            }
                          }}
                          className="pl-7 text-sm font-mono"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">契約金額（税抜）</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">¥</span>
                        <Input
                          type="number"
                          min={0}
                          value={ovr.lastEdited === "amount" ? ovr.taxExclStr : String(adjusted)}
                          onChange={(e) => updateOverride(item.estimateId, { taxExclStr: e.target.value, lastEdited: "amount" })}
                          onFocus={() => {
                            if (ovr.lastEdited !== "amount") {
                              updateOverride(item.estimateId, { taxExclStr: String(adjusted), lastEdited: "amount" })
                            }
                          }}
                          className="pl-7 text-sm font-mono"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">支払サイクル</Label>
                      <select
                        value={ovr.paymentType}
                        onChange={(e) => updateOverride(item.estimateId, { paymentType: e.target.value as PaymentTypeValue })}
                        className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm bg-white"
                      >
                        {PAYMENT_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 契約金額プレビュー */}
                  <div className={`rounded-lg p-2.5 text-sm space-y-0.5 ${discount > 0 ? "bg-green-50 border border-green-200" : "bg-slate-50 border border-slate-200"}`}>
                    {discount > 0 && (
                      <div className="flex justify-between text-red-600 text-xs">
                        <span>値引き</span>
                        <span className="font-mono">-¥{formatCurrency(discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-500 text-xs">
                      <span>消費税（10%）</span>
                      <span className="font-mono">¥{formatCurrency(tax)}</span>
                    </div>
                    <div className={`flex justify-between font-semibold pt-0.5 ${discount > 0 ? "text-green-800" : "text-slate-800"}`}>
                      <span>契約金額（税込）</span>
                      <span className="font-mono">¥{formatCurrency(total)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {/* 合計行 */}
          <div className="flex justify-between items-center px-4 py-2.5 bg-slate-100 border-t-2 border-slate-300">
            <span className="font-semibold text-sm text-slate-700">合計 {items.length}件（税込）</span>
            <span className="font-mono text-base font-bold text-green-700">¥{formatCurrency(grandTotal)}</span>
          </div>
        </div>

        {/* 共通契約情報 */}
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">契約日 <span className="text-red-500">*</span></Label>
            <Input type="date" value={contractDate} onChange={(e) => setContractDate(e.target.value)} className="text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">着工予定日</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">完工予定日</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">備考</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="特記事項があれば入力" rows={2} className="text-sm resize-none" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>キャンセル</Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-green-600 hover:bg-green-700">
            <HandshakeIcon className="w-4 h-4 mr-2" />
            {loading ? "処理中..." : `${items.length}件を一括契約する`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── 会社登録ダイアログ ────────────────────────────────

const COMPANY_TYPE_OPTIONS = [
  { label: "株式会社",             value: "株式会社" },
  { label: "有限会社",             value: "有限会社" },
  { label: "合同会社",             value: "合同会社" },
  { label: "合資会社",             value: "合資会社" },
  { label: "合名会社",             value: "合名会社" },
  { label: "一般社団法人",         value: "一般社団法人" },
  { label: "一般財団法人",         value: "一般財団法人" },
  { label: "社会福祉法人",         value: "社会福祉法人" },
  { label: "特定非営利活動法人",   value: "特定非営利活動法人" },
  { label: "医療法人",             value: "医療法人" },
  { label: "学校法人",             value: "学校法人" },
  { label: "農業協同組合",         value: "農業協同組合" },
  { label: "生活協同組合",         value: "生活協同組合" },
  { label: "個人・屋号",           value: "" },
] as const

type TypePosition = "前" | "後"

interface CreateCompanyDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}

function CreateCompanyDialog({ open, onOpenChange, onCreated }: CreateCompanyDialogProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [companyType, setCompanyType] = useState("株式会社")
  const [typePosition, setTypePosition] = useState<TypePosition>("前")
  const [companyName, setCompanyName] = useState("")
  const [companyFurigana, setCompanyFurigana] = useState("")
  const [companyPhone, setCompanyPhone] = useState("")
  const [furiganaManuallyEdited, setFuriganaManuallyEdited] = useState(false)
  const [companyErrors, setCompanyErrors] = useState<{ name?: string; furigana?: string; phone?: string }>({})
  const committedFuriganaRef = useRef("")
  const pendingHiraganaRef = useRef("")
  const furiganaComposingRef = useRef(false)

  const [useNetDays, setUseNetDays] = useState(false)
  const [paymentClosingDay, setPaymentClosingDay] = useState<string>("末")
  const [paymentMonthOffset, setPaymentMonthOffset] = useState<string>("1")
  const [paymentPayDay, setPaymentPayDay] = useState<string>("末")
  const [paymentNetDays, setPaymentNetDays] = useState<string>("45")

  function resetForm() {
    setCompanyType("株式会社")
    setTypePosition("前")
    setCompanyName("")
    setCompanyFurigana("")
    setCompanyPhone("")
    setFuriganaManuallyEdited(false)
    setCompanyErrors({})
    committedFuriganaRef.current = ""
    pendingHiraganaRef.current = ""
    setUseNetDays(false)
    setPaymentClosingDay("末")
    setPaymentMonthOffset("1")
    setPaymentPayDay("末")
    setPaymentNetDays("45")
  }

  function getFullCompanyName(): string {
    const name = companyName.trim()
    if (!companyType) return name
    return typePosition === "前" ? `${companyType}${name}` : `${name}${companyType}`
  }

  function toHiraganaOnly(text: string): string {
    const kata2hira = text.replace(/[\u30A1-\u30F6]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0x60)
    )
    return kata2hira.replace(/[^\u3041-\u3096\u309D\u309E\u30FC\s]/g, "")
  }

  function handleNameCompositionUpdate(e: React.CompositionEvent<HTMLInputElement>) {
    if (!furiganaManuallyEdited) {
      const hira = toHiraganaOnly(e.data)
      if (hira) {
        pendingHiraganaRef.current = hira
        setCompanyFurigana(committedFuriganaRef.current + hira)
      }
    }
  }

  function handleNameCompositionEnd() {
    if (!furiganaManuallyEdited) {
      committedFuriganaRef.current += pendingHiraganaRef.current
      pendingHiraganaRef.current = ""
    }
  }

  function handleNameChange(value: string) {
    setCompanyName(value)
    if (companyErrors.name) setCompanyErrors((p) => ({ ...p, name: undefined }))
    if (!furiganaManuallyEdited && !value) {
      committedFuriganaRef.current = ""
      pendingHiraganaRef.current = ""
      setCompanyFurigana("")
    }
  }

  function handlePhoneChange(value: string) {
    const cleaned = value.replace(/[^\d-]/g, "")
    setCompanyPhone(cleaned)
    if (cleaned && companyErrors.phone) setCompanyErrors((p) => ({ ...p, phone: undefined }))
  }

  function handlePhoneBlur() {
    if (!companyPhone.trim()) return
    const digits = companyPhone.replace(/\D/g, "")
    let formatted = companyPhone
    if (digits.length === 10) {
      if (/^(03|06|04|05)/.test(digits)) {
        formatted = `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`
      } else {
        formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
      }
    } else if (digits.length === 11) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
    }
    setCompanyPhone(formatted)
  }

  function handleFuriganaChange(value: string) {
    if (furiganaComposingRef.current) {
      setCompanyFurigana(value)
      return
    }
    const hiraganaOnly = toHiraganaOnly(value)
    setCompanyFurigana(hiraganaOnly)
    setFuriganaManuallyEdited(true)
    committedFuriganaRef.current = hiraganaOnly
    if (companyErrors.furigana) setCompanyErrors((p) => ({ ...p, furigana: undefined }))
  }

  function handleFuriganaCompositionEnd(e: React.CompositionEvent<HTMLInputElement>) {
    furiganaComposingRef.current = false
    const hiraganaOnly = toHiraganaOnly(e.currentTarget.value)
    setCompanyFurigana(hiraganaOnly)
    setFuriganaManuallyEdited(true)
    committedFuriganaRef.current = hiraganaOnly
    if (companyErrors.furigana) setCompanyErrors((p) => ({ ...p, furigana: undefined }))
  }

  function validateCompanyForm(): boolean {
    const errors: { name?: string; furigana?: string; phone?: string } = {}
    if (!companyName.trim()) {
      errors.name = "会社名（法人種別以降の名前）は必須項目です"
    } else if (getFullCompanyName().length > 100) {
      errors.name = "会社名は100文字以内で入力してください"
    }
    if (companyFurigana.trim() && !/^[\u3041-\u3096\u309D\u309E\u30FC\s]+$/.test(companyFurigana.trim())) {
      errors.furigana = "ふりがなはひらがなのみ入力できます（例：かぶしきかいしゃ）"
    }
    if (companyPhone.trim() && !/^0\d{1,4}-\d{1,4}-\d{4}$/.test(companyPhone.trim())) {
      errors.phone = "電話番号の形式が正しくありません（例：03-1234-5678）"
    }
    setCompanyErrors(errors)
    return Object.keys(errors).length === 0
  }

  function buildPaymentPayload() {
    if (useNetDays) {
      const net = parseInt(paymentNetDays, 10)
      return {
        paymentClosingDay: paymentClosingDay === "末" ? null : parseInt(paymentClosingDay, 10),
        paymentMonthOffset: 1,
        paymentPayDay: null,
        paymentNetDays: isNaN(net) ? null : net,
      }
    }
    return {
      paymentClosingDay: paymentClosingDay === "末" ? null : parseInt(paymentClosingDay, 10),
      paymentMonthOffset: parseInt(paymentMonthOffset, 10) || 1,
      paymentPayDay: paymentPayDay === "末" ? null : parseInt(paymentPayDay, 10),
      paymentNetDays: null,
    }
  }

  async function handleSave(goToProject = false) {
    if (!validateCompanyForm()) return
    setLoading(true)
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: getFullCompanyName(),
          furigana: companyFurigana.trim() || null,
          phone: companyPhone.trim() || null,
          ...buildPaymentPayload(),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(typeof data.error === "string" ? data.error : "登録に失敗しました")
      }
      const created = await res.json()
      toast.success("会社を登録しました")
      onOpenChange(false)
      resetForm()
      if (goToProject) {
        router.push(`/projects/new?companyId=${created.id}`)
      } else {
        onCreated()
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "エラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  function handleClose(v: boolean) {
    if (!v) resetForm()
    onOpenChange(v)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>会社を新規登録</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* 法人種別 */}
          <div className="space-y-1.5">
            <Label>法人種別</Label>
            <select
              value={companyType}
              onChange={(e) => setCompanyType(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-white"
            >
              {COMPANY_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.value ? t.label : "個人・屋号（種別なし）"}
                </option>
              ))}
            </select>
            {companyType && (
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-slate-500">位置：</span>
                <div className="flex rounded-md border border-slate-200 overflow-hidden h-7">
                  <button
                    type="button"
                    onClick={() => setTypePosition("前")}
                    className={`px-3 text-xs font-medium transition-colors ${
                      typePosition === "前" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    前（{companyType}○○）
                  </button>
                  <button
                    type="button"
                    onClick={() => setTypePosition("後")}
                    className={`px-3 text-xs font-medium border-l border-slate-200 transition-colors ${
                      typePosition === "後" ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    後（○○{companyType}）
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 会社名 */}
          <div className="space-y-1.5">
            <Label>
              {companyType
                ? <>{`会社名（${companyType}以降）`} <span className="text-red-500">*</span></>
                : <>屋号・氏名 <span className="text-red-500">*</span></>}
            </Label>
            <Input
              value={companyName}
              onChange={(e) => handleNameChange(e.target.value)}
              onCompositionUpdate={handleNameCompositionUpdate}
              onCompositionEnd={handleNameCompositionEnd}
              placeholder={companyType ? "例：○○建設" : "例：山田 太郎 / 山田電気工事"}
              className={companyErrors.name ? "border-red-400 focus-visible:ring-red-400" : ""}
            />
            {companyErrors.name && (
              <p className="text-xs text-red-500 flex items-center gap-1">⚠ {companyErrors.name}</p>
            )}
            {companyName.trim() && (
              <div className="flex items-center gap-2 mt-1 px-3 py-1.5 bg-blue-50 rounded-md border border-blue-100">
                <span className="text-xs text-blue-400">登録名：</span>
                <span className="text-sm font-semibold text-blue-800">{getFullCompanyName()}</span>
              </div>
            )}
          </div>

          {/* ふりがな */}
          <div className="space-y-1.5">
            <Label>
              ふりがな
              <span className="text-xs text-slate-400 ml-2">
                {furiganaManuallyEdited ? "（手動入力）" : "（会社名を入力すると自動で入ります）"}
              </span>
            </Label>
            <Input
              value={companyFurigana}
              onChange={(e) => handleFuriganaChange(e.target.value)}
              onCompositionStart={() => { furiganaComposingRef.current = true }}
              onCompositionEnd={handleFuriganaCompositionEnd}
              onFocus={() => { if (companyFurigana) setFuriganaManuallyEdited(true) }}
              placeholder="例：やまだけんせつ"
              className={companyErrors.furigana ? "border-red-400 focus-visible:ring-red-400" : ""}
            />
            {companyErrors.furigana ? (
              <p className="text-xs text-red-500 flex items-center gap-1">⚠ {companyErrors.furigana}</p>
            ) : (
              <p className="text-xs text-slate-400">ひらがなのみ入力できます</p>
            )}
          </div>

          {/* 電話番号 */}
          <div className="space-y-1.5">
            <Label>代表電話番号</Label>
            <Input
              value={companyPhone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              onBlur={handlePhoneBlur}
              placeholder="03-1234-5678 または 090-1234-5678"
              inputMode="tel"
              className={companyErrors.phone ? "border-red-400 focus-visible:ring-red-400" : ""}
            />
            {companyErrors.phone ? (
              <p className="text-xs text-red-500 flex items-center gap-1">⚠ {companyErrors.phone}</p>
            ) : (
              <p className="text-xs text-slate-400">形式：03-1234-5678 / 090-1234-5678（数字とハイフンのみ）</p>
            )}
          </div>

          {/* 支払条件 */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <CalendarClock className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">支払条件</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">締め日</Label>
                <select
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  value={paymentClosingDay}
                  onChange={(e) => setPaymentClosingDay(e.target.value)}
                >
                  <option value="末">末日</option>
                  <option value="10">10日</option>
                  <option value="15">15日</option>
                  <option value="20">20日</option>
                  <option value="25">25日</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">支払方式</Label>
                <div className="flex rounded-md border border-slate-200 overflow-hidden h-[38px]">
                  <button
                    type="button"
                    onClick={() => setUseNetDays(false)}
                    className={`flex-1 text-xs font-medium transition-colors ${
                      !useNetDays ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    月次指定
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseNetDays(true)}
                    className={`flex-1 text-xs font-medium border-l border-slate-200 transition-colors ${
                      useNetDays ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    日数払い
                  </button>
                </div>
              </div>
            </div>
            {!useNetDays && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">支払月</Label>
                  <select
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                    value={paymentMonthOffset}
                    onChange={(e) => setPaymentMonthOffset(e.target.value)}
                  >
                    <option value="1">翌月</option>
                    <option value="2">翌々月</option>
                    <option value="3">翌々々月（3ヶ月後）</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">支払日</Label>
                  <select
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                    value={paymentPayDay}
                    onChange={(e) => setPaymentPayDay(e.target.value)}
                  >
                    <option value="末">末日</option>
                    <option value="5">5日</option>
                    <option value="10">10日</option>
                    <option value="15">15日</option>
                    <option value="20">20日</option>
                    <option value="25">25日</option>
                  </select>
                </div>
              </div>
            )}
            {useNetDays && (
              <div className="mt-3 space-y-1.5">
                <Label className="text-xs text-slate-500">締め後○日払い</Label>
                <div className="flex items-center gap-2">
                  <select
                    className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                    value={["30","45","60","90"].includes(paymentNetDays) ? paymentNetDays : "custom"}
                    onChange={(e) => { if (e.target.value !== "custom") setPaymentNetDays(e.target.value) }}
                  >
                    <option value="30">30日</option>
                    <option value="45">45日</option>
                    <option value="60">60日</option>
                    <option value="90">90日</option>
                    <option value="custom">その他</option>
                  </select>
                  <Input
                    type="number"
                    min={1}
                    value={paymentNetDays}
                    onChange={(e) => setPaymentNetDays(e.target.value)}
                    className="w-24 text-sm"
                  />
                  <span className="text-sm text-slate-500">日後</span>
                </div>
              </div>
            )}
            <div className="mt-3 px-3 py-2 rounded-md bg-slate-50 border border-slate-200">
              <span className="text-xs text-slate-500">設定内容：</span>
              <span className="text-sm font-medium text-slate-800 ml-2">
                {formatCompanyPaymentTerms({
                  paymentClosingDay: paymentClosingDay === "末" ? null : parseInt(paymentClosingDay, 10),
                  paymentMonthOffset: parseInt(paymentMonthOffset, 10) || 1,
                  paymentPayDay: paymentPayDay === "末" ? null : parseInt(paymentPayDay, 10),
                  paymentNetDays: useNetDays ? (parseInt(paymentNetDays, 10) || null) : null,
                })}
              </span>
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => handleClose(false)} className="sm:mr-auto">
            キャンセル
          </Button>
          <Button variant="outline" onClick={() => handleSave(false)} disabled={loading}>
            {loading && <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />}
            登録する
          </Button>
          <Button onClick={() => handleSave(true)} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white">
            {loading && <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />}
            登録して商談を作成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── メインコンポーネント ───────────────────────────────

export function ProjectList({ projects, currentUser }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [showArchived, setShowArchived] = useState(false)
  // タグフィルター
  const [selectedStatuses, setSelectedStatuses] = useState<Set<EstimateStatus>>(new Set())
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  // 展開状態: デフォルトで全現場を展開
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set())
  const [collapsedCompanies, setCollapsedCompanies] = useState<Set<string>>(new Set())
  const [contractTarget, setContractTarget] = useState<{
    project: Project
    estimate: EstimateRow
  } | null>(null)
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false)

  // ── Split View 状態（3カラム対応） ─────────────────────────
  // 見積パネル（3番目）
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null)
  const [estimateData, setEstimateData] = useState<{
    estimate: Parameters<typeof EstimateDetail>[0]["estimate"]
    taxRate: number
    units: { id: string; name: string }[]
    contacts: { id: string; name: string; phone: string; email: string }[]
  } | null>(null)
  const [estimateLoading, setEstimateLoading] = useState(false)

  // 現場パネル（2番目）
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [projectDetailData, setProjectDetailData] = useState<any | null>(null)
  const [projectLoading, setProjectLoading] = useState(false)

  // パネル折りたたみ状態
  const [listCollapsed, setListCollapsed] = useState(false)
  const [projectCollapsed, setProjectCollapsed] = useState(false)

  const hasProjectPanel = !!selectedProjectId
  const hasEstimatePanel = !!selectedEstimateId
  const hasPanel = hasProjectPanel || hasEstimatePanel

  // レイアウト制御: パネル展開時にフル幅にする
  useEffect(() => {
    const el = document.getElementById("app-content")
    if (!el) return
    if (hasPanel) {
      el.classList.remove("max-w-7xl", "mx-auto", "px-6")
      el.classList.add("px-2")
    } else {
      el.classList.remove("px-2")
      el.classList.add("max-w-7xl", "mx-auto", "px-6")
    }
    return () => {
      el.classList.remove("px-2")
      el.classList.add("max-w-7xl", "mx-auto", "px-6")
    }
  }, [hasPanel])

  // 編集中ガード
  const [isEstimateEditing, setIsEstimateEditing] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false)

  function guardedAction(action: () => void) {
    if (isEstimateEditing) {
      setPendingAction(() => action)
      setUnsavedDialogOpen(true)
    } else {
      action()
    }
  }
  function confirmDiscard() {
    setIsEstimateEditing(false)
    setUnsavedDialogOpen(false)
    pendingAction?.()
    setPendingAction(null)
  }
  function cancelDiscard() {
    setUnsavedDialogOpen(false)
    setPendingAction(null)
  }

  function closeEstimatePanel() {
    guardedAction(() => {
      setSelectedEstimateId(null)
      setEstimateData(null)
      setListCollapsed(false)
    })
  }

  function closeProjectPanel() {
    guardedAction(() => {
      setSelectedProjectId(null)
      setProjectDetailData(null)
      setSelectedEstimateId(null)
      setEstimateData(null)
      setProjectCollapsed(false)
    })
  }

  function closeAllPanels() {
    guardedAction(() => {
      setSelectedEstimateId(null)
      setEstimateData(null)
      setSelectedProjectId(null)
      setProjectDetailData(null)
      setListCollapsed(false)
      setProjectCollapsed(false)
    })
  }

  // 見積データを非同期で取得（現場パネルは維持、一覧は自動折りたたみ）
  const openEstimateFromProject = useCallback(async (estimateId: string) => {
    if (estimateId === selectedEstimateId) return
    setListCollapsed(true)
    setSelectedEstimateId(estimateId)
    setEstimateLoading(true)
    setEstimateData(null)
    try {
      const res = await fetch(`/api/estimates/${estimateId}`)
      if (!res.ok) throw new Error("取得失敗")
      const data = await res.json()
      setEstimateData(data)
    } catch {
      toast.error("見積データの取得に失敗しました")
      setSelectedEstimateId(null)
    } finally {
      setEstimateLoading(false)
    }
  }, [selectedEstimateId])

  // 一覧から直接見積を開く（現場パネルなし）
  const openEstimateDirect = useCallback(async (estimateId: string) => {
    if (estimateId === selectedEstimateId && !hasProjectPanel) return
    setSelectedProjectId(null)
    setProjectDetailData(null)
    setProjectCollapsed(false)
    setSelectedEstimateId(estimateId)
    setEstimateLoading(true)
    setEstimateData(null)
    try {
      const res = await fetch(`/api/estimates/${estimateId}`)
      if (!res.ok) throw new Error("取得失敗")
      const data = await res.json()
      setEstimateData(data)
    } catch {
      toast.error("見積データの取得に失敗しました")
      setSelectedEstimateId(null)
    } finally {
      setEstimateLoading(false)
    }
  }, [selectedEstimateId, hasProjectPanel])

  const refreshEstimate = useCallback(async () => {
    if (!selectedEstimateId) return
    router.refresh()
    try {
      const [estRes] = await Promise.all([
        fetch(`/api/estimates/${selectedEstimateId}`),
        selectedProjectId ? fetch(`/api/projects/${selectedProjectId}`).then(r => r.json()).then(d => setProjectDetailData(d)).catch(() => {}) : Promise.resolve(),
      ])
      if (!estRes.ok) throw new Error("取得失敗")
      const data = await estRes.json()
      setEstimateData(data)
    } catch {
      toast.error("見積データの再取得に失敗しました")
    }
  }, [selectedEstimateId, selectedProjectId, router])

  // 現場データを非同期で取得
  const openProject = useCallback(async (projectId: string) => {
    if (projectId === selectedProjectId) return
    setSelectedProjectId(projectId)
    setSelectedEstimateId(null)
    setEstimateData(null)
    setProjectCollapsed(false)
    setProjectLoading(true)
    setProjectDetailData(null)
    try {
      const res = await fetch(`/api/projects/${projectId}`)
      if (!res.ok) throw new Error("取得失敗")
      const data = await res.json()
      setProjectDetailData(data)
    } catch {
      toast.error("現場データの取得に失敗しました")
      setSelectedProjectId(null)
    } finally {
      setProjectLoading(false)
    }
  }, [selectedProjectId])

  const refreshProject = useCallback(async () => {
    if (!selectedProjectId) return
    router.refresh()
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}`)
      if (!res.ok) throw new Error("取得失敗")
      const data = await res.json()
      setProjectDetailData(data)
    } catch {
      toast.error("現場データの再取得に失敗しました")
    }
  }, [selectedProjectId, router])

  function handleSelectEstimate(estimateId: string) {
    guardedAction(() => openEstimateDirect(estimateId))
  }

  function handleSelectProject(projectId: string) {
    guardedAction(() => openProject(projectId))
  }

  function handleCloseEstimate() {
    closeEstimatePanel()
  }

  // ── 複数チェック・一括契約 ──────────────────────────────
  const [checkedEstimateIds, setCheckedEstimateIds] = useState<Set<string>>(new Set())
  const [bulkContractOpen, setBulkContractOpen] = useState(false)

  /** チェック可能な見積（CONFIRMED/SENT → 契約処理対象） */
  function isCheckable(est: EstimateRow): boolean {
    return est.status === "CONFIRMED" || est.status === "SENT"
  }

  function toggleCheck(estimateId: string) {
    setCheckedEstimateIds((prev) => {
      const next = new Set(prev)
      if (next.has(estimateId)) { next.delete(estimateId) } else { next.add(estimateId) }
      return next
    })
  }

  // allCheckableIds は filtered 依存なので後で定義（filtered の後に移動）

  /** チェック済み見積の BulkContractItem 一覧 */
  const checkedItems = useMemo((): BulkContractItem[] => {
    const result: BulkContractItem[] = []
    for (const p of projects) {
      for (const est of p.estimates) {
        if (!checkedEstimateIds.has(est.id)) continue
        const displayName = est.title
          ?? (p.estimates.length === 1 ? "見積" : `見積 ${p.estimates.indexOf(est) + 1}`)
        result.push({
          estimateId: est.id,
          estimateName: displayName,
          projectId: p.id,
          projectName: p.name,
          companyName: p.branch.company.name,
          totalAmount: est.totalAmount,
        })
      }
    }
    return result
  }, [checkedEstimateIds, projects])

  // フィルタータグ用：全プロジェクトからユニーク担当者を収集
  const allUsers = useMemo(() => {
    const map = new Map<string, string>() // id → name
    for (const p of projects) {
      for (const est of p.estimates) {
        if (!map.has(est.user.id)) map.set(est.user.id, est.user.name)
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [projects])

  // タグトグル
  function toggleStatus(s: EstimateStatus) {
    setSelectedStatuses((prev) => {
      const next = new Set(prev)
      if (next.has(s)) { next.delete(s) } else { next.add(s) }
      return next
    })
  }
  function toggleUser(userId: string) {
    setSelectedUsers((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) { next.delete(userId) } else { next.add(userId) }
      return next
    })
  }

  const filtered = projects
    .filter((p) => {
      const q = search.toLowerCase()
      const matchSearch =
        q === "" ||
        p.branch.company.name.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.contact?.name.toLowerCase().includes(q) ?? false)
      const matchArchive = showArchived ? p.isArchived : !p.isArchived
      if (!matchSearch || !matchArchive) return false

      // 状況・担当者フィルター: 現場内の見積が1件以上マッチすれば現場を表示
      return p.estimates.some((est) => {
        const okStatus = selectedStatuses.size === 0 || selectedStatuses.has(est.status)
        const okUser = selectedUsers.size === 0 || selectedUsers.has(est.user.id)
        return okStatus && okUser
      })
    })
    .map((p) => {
      // フィルターが有効な場合、見積サブ行もフィルター済みのみ表示
      const visibleEstimates =
        selectedStatuses.size === 0 && selectedUsers.size === 0
          ? p.estimates
          : p.estimates.filter((est) => {
              const okStatus = selectedStatuses.size === 0 || selectedStatuses.has(est.status)
              const okUser = selectedUsers.size === 0 || selectedUsers.has(est.user.id)
              return okStatus && okUser
            })
      return { ...p, estimates: visibleEstimates }
    })

  // 会社別グループ化
  const grouped = useMemo(() => {
    const map = new Map<string, { companyId: string; companyName: string; projects: Project[] }>()
    for (const p of filtered) {
      const key = p.branch.company.id
      if (!map.has(key)) {
        map.set(key, { companyId: key, companyName: p.branch.company.name, projects: [] })
      }
      map.get(key)!.projects.push(p)
    }
    return Array.from(map.values())
  }, [filtered])

  /** 全チェック可能な見積 ID（現在 filtered に表示中のもの） */
  const allCheckableIds = useMemo(() => {
    const ids: string[] = []
    for (const p of filtered) {
      for (const est of p.estimates) {
        if (isCheckable(est)) ids.push(est.id)
      }
    }
    return ids
  }, [filtered])

  function toggleCompany(companyId: string) {
    setCollapsedCompanies((prev) => {
      const next = new Set(prev)
      if (next.has(companyId)) { next.delete(companyId) } else { next.add(companyId) }
      return next
    })
  }

  function toggleProject(projectId: string) {
    setCollapsedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) { next.delete(projectId) } else { next.add(projectId) }
      return next
    })
  }

  async function handleArchive(projectId: string) {
    if (!confirm("この現場を失注としてアーカイブしますか？")) return
    const res = await fetch(`/api/projects/${projectId}/archive`, { method: "PATCH" })
    if (res.ok) {
      toast.success("アーカイブしました")
      router.refresh()
    } else {
      toast.error("失敗しました")
    }
  }

  // ── 見積サブ行 ────────────────────────────────────────
  function EstimateSubRow({
    est,
    project,
    isLast,
    estimateIndex,
  }: {
    est: EstimateRow
    project: Project
    isLast: boolean
    estimateIndex: number
  }) {
    const typeTag = EST_TYPE_STYLE[est.estimateType]
    const displayName = est.title
      ?? (project.estimates.length === 1 ? null : `見積 ${estimateIndex + 1}`)
    const checkable = isCheckable(est)
    const isChecked = checkedEstimateIds.has(est.id)
    const isSelected = selectedEstimateId === est.id

    if (hasPanel) {
      return (
        <div
          className={`flex items-center gap-1.5 px-2 py-2 text-sm cursor-pointer hover:bg-blue-50/40 transition-colors ${
            !isLast ? "border-b border-slate-100" : ""
          } ${isChecked ? "bg-green-50/60" : ""} ${isSelected ? "bg-blue-100/70 ring-1 ring-inset ring-blue-300" : ""}`}
          onClick={() => handleSelectEstimate(est.id)}
        >
          <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
            {checkable ? (
              <button
                onClick={() => toggleCheck(est.id)}
                className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${isChecked ? "text-green-600" : "text-slate-300 hover:text-slate-500"}`}
              >
                {isChecked ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <div className="w-4" />
            )}
          </div>
          <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${EST_STATUS_STYLE[est.status]}`}>
            {EST_STATUS_SHORT[est.status]}
          </span>
          <div className="min-w-0 flex-1 truncate">
            <span className="text-xs text-slate-700">{displayName ?? "（無題）"}</span>
          </div>
          <span className="shrink-0 font-mono text-xs font-semibold text-slate-700">¥{formatCurrency(est.totalAmount)}</span>
          <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => handleSelectEstimate(est.id)}>
                  <FileText className="w-4 h-4 mr-2" />
                  見積を開く
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {(est.status === "CONFIRMED" || est.status === "SENT") ? (
                  <DropdownMenuItem
                    onClick={() => setContractTarget({ project, estimate: est })}
                    className="flex items-center gap-2 text-green-700 focus:text-green-700 focus:bg-green-50"
                  >
                    <HandshakeIcon className="w-4 h-4" />
                    契約処理
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem disabled className="flex items-center gap-2 text-slate-400">
                    <HandshakeIcon className="w-4 h-4" />
                    契約処理（確定後に可）
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )
    }

    return (
      <div
        className={`grid grid-cols-[2.5rem_5rem_2.5fr_0.8fr_1.2fr_0.9fr_2.5rem] gap-x-2 pl-10 pr-4 py-2.5 items-center text-sm hover:bg-blue-50/30 transition-colors cursor-pointer ${
          !isLast ? "border-b border-slate-100" : ""
        } ${isChecked ? "bg-green-50/60" : ""} ${isSelected ? "bg-blue-50 ring-1 ring-inset ring-blue-300" : ""}`}
        onClick={() => handleSelectEstimate(est.id)}
      >
        {/* チェックボックス / ツリー線 */}
        <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          {checkable ? (
            <button
              onClick={() => toggleCheck(est.id)}
              className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                isChecked
                  ? "text-green-600 hover:text-green-700"
                  : "text-slate-300 hover:text-slate-500"
              }`}
              title={isChecked ? "チェックを外す" : "契約処理に追加"}
            >
              {isChecked
                ? <CheckSquare className="w-4.5 h-4.5" />
                : <Square className="w-4.5 h-4.5" />
              }
            </button>
          ) : (
            <div className="w-px h-3 bg-slate-300 mx-auto" />
          )}
        </div>

        {/* 状況 */}
        <div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${EST_STATUS_STYLE[est.status]}`}>
            {EST_STATUS_LABEL[est.status]}
          </span>
        </div>

        {/* 見積名 */}
        <div className="min-w-0 flex items-center gap-2 overflow-hidden">
          <div className="group inline-flex items-center gap-1.5 min-w-0 overflow-hidden">
            <FileText className="w-3.5 h-3.5 shrink-0 text-blue-400 group-hover:text-blue-600 transition-colors" />
            <span className="truncate text-sm text-slate-600 group-hover:text-blue-600 transition-colors">
              {displayName ?? "（無題）"}
            </span>
            <ChevronRight className="w-3 h-3 shrink-0 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
          </div>
          {typeTag && (
            <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${typeTag.className}`}>
              {typeTag.label}
            </span>
          )}
        </div>

        {/* 見積確定日 */}
        <div className="text-slate-500">
          {est.confirmedAt
            ? formatDate(est.confirmedAt, "M/d")
            : <span className="text-slate-300">—</span>}
        </div>

        {/* 金額 */}
        <div className="font-mono font-semibold text-slate-800">
          ¥{formatCurrency(est.totalAmount)}
        </div>

        {/* 担当者 */}
        <div className="text-slate-600 truncate">
          {est.user.name}
        </div>

        {/* 三点メニュー */}
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => handleSelectEstimate(est.id)}>
                <FileText className="w-4 h-4 mr-2" />
                見積を開く
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {(est.status === "CONFIRMED" || est.status === "SENT") ? (
                <DropdownMenuItem
                  onClick={() => setContractTarget({ project, estimate: est })}
                  className="flex items-center gap-2 text-green-700 focus:text-green-700 focus:bg-green-50"
                >
                  <HandshakeIcon className="w-4 h-4" />
                  契約処理
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem disabled className="flex items-center gap-2 text-slate-400">
                  <HandshakeIcon className="w-4 h-4" />
                  契約処理（確定後に可）
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-0">
    {/* ── パネル1：一覧（折りたたみ対応） ── */}
    {listCollapsed ? (
      <button
        onClick={() => setListCollapsed(false)}
        className="w-8 shrink-0 border-r border-slate-300 bg-amber-50/80 hover:bg-amber-100 transition-colors flex flex-col items-center justify-center max-h-[calc(100vh-4rem)] cursor-pointer group relative"
        title="一覧を展開"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-amber-400/60" />
        <BookOpen className="w-3.5 h-3.5 text-amber-600 group-hover:text-amber-700 mb-1" />
        <span className="text-[10px] text-amber-700/70 group-hover:text-amber-800 font-semibold [writing-mode:vertical-rl] tracking-wider select-none">一覧</span>
      </button>
    ) : (
    <div className={`space-y-4 transition-all duration-300 ${hasPanel ? `${hasEstimatePanel && hasProjectPanel ? "w-[280px]" : "w-[340px]"} shrink-0 overflow-y-auto max-h-[calc(100vh-4rem)] pr-2` : "flex-1 space-y-6"}`}>
      {/* ヘッダー */}
      <div className={hasPanel ? "flex items-center justify-between gap-2" : "flex items-center justify-between"}>
        <div className="flex items-center gap-2">
          {hasPanel && (
            <button onClick={() => setListCollapsed(true)} className="p-1 rounded hover:bg-amber-100 text-amber-500 hover:text-amber-700 transition-colors" title="一覧を折りたたむ">
              <BookOpen className="w-4 h-4" />
            </button>
          )}
          <div>
            <h1 className={`${hasPanel ? "text-lg" : "text-2xl"} font-bold text-slate-900`}>商談一覧</h1>
            {!hasPanel && (
              <p className="text-sm text-slate-500 mt-1">
                こんにちは、{currentUser.name} さん
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!hasPanel && (
            <Button variant="outline" onClick={() => setCompanyDialogOpen(true)}>
              <Building2 className="w-4 h-4 mr-2" />
              会社を追加
            </Button>
          )}
          <Button size={hasPanel ? "sm" : "default"} onClick={() => guardedAction(() => router.push("/projects/new"))}>
            <Plus className="w-4 h-4 mr-1" />
            {hasPanel ? "新規" : "新規現場作成"}
          </Button>
        </div>
      </div>

      {/* 検索・フィルター */}
      <div className="space-y-2">
        {/* 検索バー */}
        <div className="flex items-center gap-2">
          <div className={`relative flex-1 ${hasPanel ? "" : "max-w-sm"}`}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder={hasPanel ? "検索" : "会社名・現場名・担当者で検索"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`pl-9 ${hasPanel ? "h-8 text-sm" : ""}`}
            />
          </div>
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
          >
            <Archive className="w-4 h-4" />
            {!hasPanel && <span className="ml-2">{showArchived ? "失注を隠す" : "失注を表示"}</span>}
          </Button>
        </div>

        {/* タグフィルター */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 py-1">

          {/* ── 状況グループ ── */}
          <div className="flex items-center gap-1">
            {!hasPanel && (
              <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-200 text-slate-600">
                <Tag className="w-3.5 h-3.5" />
                <span className="text-xs font-bold tracking-wide leading-none">状況</span>
              </div>
            )}
            {(["DRAFT", "CONFIRMED", "SENT"] as EstimateStatus[]).map((s) => {
              const active = selectedStatuses.has(s)
              const baseStyle = EST_STATUS_STYLE[s]
              return (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  title={EST_STATUS_LABEL[s]}
                  className={`px-2 py-1 rounded-md text-xs font-bold transition-all select-none flex items-center justify-center leading-none ${
                    active
                      ? `${baseStyle} ring-2 ring-offset-1 ring-current shadow-md`
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {EST_STATUS_SHORT[s]}
                </button>
              )
            })}
          </div>

          {/* 区切り */}
          {!hasPanel && <div className="w-px h-6 bg-slate-200 hidden sm:block" />}

          {/* ── 担当者グループ ── */}
          {allUsers.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {!hasPanel && (
                <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-200 text-slate-600">
                  <User2 className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold tracking-wide leading-none">担当</span>
                </div>
              )}
              {allUsers.map(({ id, name }) => {
                const active = selectedUsers.has(id)
                const short = name.slice(0, 2)
                return (
                  <button
                    key={id}
                    onClick={() => toggleUser(id)}
                    title={name}
                    className={`px-2 py-1 rounded-md text-xs font-bold transition-all select-none flex items-center justify-center leading-none ${
                      active
                        ? "bg-indigo-500 text-white ring-2 ring-offset-1 ring-indigo-400 shadow-md"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {short}
                  </button>
                )
              })}
            </div>
          )}

          {/* リセット（選択中のときのみ） */}
          {(selectedStatuses.size > 0 || selectedUsers.size > 0) && (
            <button
              onClick={() => { setSelectedStatuses(new Set()); setSelectedUsers(new Set()) }}
              className="flex items-center gap-0.5 text-xs text-slate-400 hover:text-slate-700 transition-colors"
              title="絞り込みをリセット"
            >
              <X className="w-3.5 h-3.5" />
              <span className="text-xs">解除</span>
            </button>
          )}
        </div>
      </div>

      {/* 一覧 */}
      {grouped.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-slate-400">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          現場が見つかりません
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ companyId, companyName, projects: companyProjects }) => {
            const isCompanyCollapsed = collapsedCompanies.has(companyId)
            const totalEstimates = companyProjects.reduce((s, p) => s + p.estimates.length, 0)

            return (
              <div key={companyId} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* 会社名ヘッダー */}
                <button
                  onClick={() => toggleCompany(companyId)}
                  className={`w-full flex items-center gap-2 ${hasPanel ? "px-3 py-2" : "px-4 py-3"} bg-slate-800 text-white text-left hover:bg-slate-700 transition-colors`}
                >
                  {isCompanyCollapsed ? (
                    <ChevronRight className={`${hasPanel ? "w-3.5 h-3.5" : "w-4 h-4"} flex-shrink-0`} />
                  ) : (
                    <ChevronDown className={`${hasPanel ? "w-3.5 h-3.5" : "w-4 h-4"} flex-shrink-0`} />
                  )}
                  <Building2 className={`${hasPanel ? "w-3.5 h-3.5" : "w-4 h-4"} flex-shrink-0 text-slate-300`} />
                  <span className={`${hasPanel ? "text-sm" : ""} font-semibold truncate`}>{companyName}</span>
                  <span className="ml-auto text-xs text-slate-400 font-normal shrink-0">
                    {companyProjects.length}現場 / {totalEstimates}件
                  </span>
                </button>

                {/* カラムヘッダー */}
                {!isCompanyCollapsed && (
                  <div>
                    {/* 各現場 */}
                    {companyProjects.map((project, pIdx) => {
                      const isProjectCollapsed = collapsedProjects.has(project.id)
                      const isLastProject = pIdx === companyProjects.length - 1

                      return (
                        <div
                          key={project.id}
                          className={!isLastProject ? "border-b border-slate-200" : ""}
                        >
                          {/* 現場ヘッダー行 */}
                          <div className={`flex items-center gap-2 ${hasPanel ? "px-3 py-2" : "px-4 py-3 gap-3"} bg-slate-50/70 hover:bg-slate-100/80 transition-colors`}>
                            {/* 展開ボタン */}
                            <div className="flex-shrink-0">
                              {project.estimates.length > 0 ? (
                                <button
                                  onClick={() => toggleProject(project.id)}
                                  title={isProjectCollapsed ? "見積を表示" : "見積を隠す"}
                                  className={`${hasPanel ? "w-5 h-5" : "w-6 h-6"} rounded flex items-center justify-center transition-colors ${
                                    isProjectCollapsed
                                      ? "bg-slate-200 text-slate-600 hover:bg-blue-500 hover:text-white"
                                      : "bg-blue-500 text-white hover:bg-blue-600"
                                  }`}
                                >
                                  {isProjectCollapsed ? (
                                    <ChevronRight className={`${hasPanel ? "w-3 h-3" : "w-3.5 h-3.5"}`} />
                                  ) : (
                                    <ChevronDown className={`${hasPanel ? "w-3 h-3" : "w-3.5 h-3.5"}`} />
                                  )}
                                </button>
                              ) : <div className={hasPanel ? "w-5" : "w-6"} />}
                            </div>

                            {/* 現場名 */}
                            <div className="min-w-0 flex-1 flex items-center gap-2">
                              <button
                                onClick={() => handleSelectProject(project.id)}
                                className="group inline-flex items-center gap-1 min-w-0"
                              >
                                <span className={`font-bold group-hover:text-blue-600 transition-colors truncate ${hasPanel ? "text-xs" : "text-sm"} ${selectedProjectId === project.id ? "text-blue-600" : "text-slate-800"}`}>
                                  {project.name}
                                </span>
                                <ChevronRight className="w-3 h-3 shrink-0 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                              </button>
                              {!hasPanel && project.branch.name !== "本社" && (
                                <span className="text-xs text-slate-400 shrink-0 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {project.branch.name}
                                </span>
                              )}
                            </div>

                            {/* 住所・担当・日付 — パネル展開時は非表示 */}
                            {!hasPanel && (
                              <>
                                {project.address ? (
                                  <div className="hidden md:flex items-center gap-1 text-xs text-slate-500 min-w-0 shrink">
                                    <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                                    <span className="truncate">{project.address}</span>
                                  </div>
                                ) : (
                                  <div className="hidden md:flex items-center gap-1 text-xs text-amber-600 shrink-0">
                                    <MapPin className="w-3 h-3 shrink-0 text-amber-500" />
                                    <span className="font-medium">住所未設定</span>
                                  </div>
                                )}
                                <div className="hidden sm:flex items-center gap-1 text-xs text-slate-500 shrink-0">
                                  <User2 className="w-3 h-3 text-slate-400" />
                                  <span>{project.contact?.name ?? "—"}</span>
                                </div>
                                <div className="hidden sm:flex items-center gap-1 text-xs text-slate-500 shrink-0">
                                  <Calendar className="w-3 h-3 text-slate-400" />
                                  <span>{formatDate(project.createdAt, "M/d")}</span>
                                </div>
                              </>
                            )}

                            {/* 見積件数バッジ */}
                            <button
                              onClick={() => toggleProject(project.id)}
                              className={`shrink-0 ${hasPanel ? "" : "ml-auto"} inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 font-medium hover:bg-blue-200 transition-colors`}
                            >
                              <FileText className="w-3 h-3" />
                              {project.estimates.length}件
                            </button>

                            {/* 三点メニュー（現場レベル） */}
                            <div className="flex-shrink-0">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem
                                    onClick={() => handleSelectProject(project.id)}
                                    className="flex items-center gap-2"
                                  >
                                    <Eye className="w-4 h-4" />
                                    現場詳細を開く
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleSelectProject(project.id)}
                                    className="flex items-center gap-2"
                                  >
                                    <FilePlus2 className="w-4 h-4" />
                                    新規見積を追加
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => guardedAction(() => handleArchive(project.id))}
                                    className="flex items-center gap-2 text-orange-600 focus:text-orange-600 focus:bg-orange-50"
                                  >
                                    <Archive className="w-4 h-4" />
                                    失注としてアーカイブ
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>

                          {/* 見積サブ行（展開時） */}
                          {!isProjectCollapsed && project.estimates.length > 0 && (
                            <div className="bg-white">
                              {/* 見積カラムヘッダー */}
                              {!hasPanel && (
                                <div className="grid grid-cols-[2.5rem_5rem_2.5fr_0.8fr_1.2fr_0.9fr_2.5rem] gap-x-2 pl-10 pr-4 py-1.5 bg-slate-100/60 border-y border-slate-100 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                                  <span />
                                  <span>状況</span>
                                  <span>見積名</span>
                                  <span>確定日</span>
                                  <span>金額（税込）</span>
                                  <span>担当者</span>
                                  <span />
                                </div>
                              )}
                              {project.estimates.map((est, eIdx) => (
                                <EstimateSubRow
                                  key={est.id}
                                  est={est}
                                  project={project}
                                  isLast={eIdx === project.estimates.length - 1}
                                  estimateIndex={eIdx}
                                />
                              ))}
                            </div>
                          )}

                          {/* 見積なしの場合 */}
                          {!isProjectCollapsed && project.estimates.length === 0 && (
                            <div className="pl-10 pr-4 py-3 border-t border-dashed border-slate-200 bg-slate-50/50">
                              <button
                                onClick={() => guardedAction(() => router.push(`/projects/${project.id}?newEstimate=1`))}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-50 border border-blue-200 text-sm text-blue-600 font-medium hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors"
                              >
                                <FilePlus2 className="w-4 h-4" />
                                最初の見積を作成する
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs text-slate-400 text-right">
        {filtered.length} 件表示
      </p>

      {/* 契約処理ダイアログ（単件） */}
      {contractTarget && (
        <ContractDialog
          open={true}
          onOpenChange={(v) => { if (!v) setContractTarget(null) }}
          project={contractTarget.project}
          estimate={contractTarget.estimate}
          onContracted={() => {
            setContractTarget(null)
            router.refresh()
          }}
        />
      )}

      {/* 一括契約処理ダイアログ */}
      <BulkContractDialog
        open={bulkContractOpen}
        onOpenChange={setBulkContractOpen}
        items={checkedItems}
        onCompleted={() => {
          setCheckedEstimateIds(new Set())
          router.refresh()
        }}
      />

      {/* 会社新規登録ダイアログ */}
      <CreateCompanyDialog
        open={companyDialogOpen}
        onOpenChange={setCompanyDialogOpen}
        onCreated={() => router.refresh()}
      />

      {/* フローティング一括操作バー */}
      {checkedEstimateIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900 text-white px-5 py-3 rounded-full shadow-2xl shadow-slate-900/40 border border-slate-700 animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-green-400" />
            <span className="text-sm font-semibold">
              {checkedEstimateIds.size}件の見積を選択中
            </span>
          </div>
          <div className="w-px h-5 bg-slate-700" />
          <button
            onClick={() => {
              const newSet = new Set(allCheckableIds)
              setCheckedEstimateIds(newSet)
            }}
            className="text-xs text-slate-300 hover:text-white transition-colors"
          >
            全選択
          </button>
          <button
            onClick={() => setCheckedEstimateIds(new Set())}
            className="text-xs text-slate-300 hover:text-white transition-colors"
          >
            解除
          </button>
          <Button
            size="sm"
            onClick={() => setBulkContractOpen(true)}
            className="bg-green-500 hover:bg-green-400 text-white h-8 px-4 rounded-full font-semibold"
          >
            <HandshakeIcon className="w-3.5 h-3.5 mr-1.5" />
            一括契約処理
          </Button>
        </div>
      )}
    </div>
    )}

    {/* ── パネル2：現場詳細（折りたたみ対応） ── */}
    {hasProjectPanel && (
      projectCollapsed ? (
        <button
          onClick={() => setProjectCollapsed(false)}
          className="w-8 shrink-0 border-l border-slate-300 bg-blue-50/80 hover:bg-blue-100 transition-colors flex flex-col items-center justify-center max-h-[calc(100vh-4rem)] cursor-pointer group relative"
          title="現場詳細を展開"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-400/60" />
          <BookOpen className="w-3.5 h-3.5 text-blue-600 group-hover:text-blue-700 mb-1" />
          <span className="text-[10px] text-blue-700/70 group-hover:text-blue-800 font-semibold [writing-mode:vertical-rl] tracking-wider select-none truncate max-h-32">{projectDetailData?.project?.name ?? "現場"}</span>
        </button>
      ) : (
        <div className={`border-l border-slate-200 bg-white shadow-sm relative ${hasEstimatePanel ? "w-[400px] shrink-0" : "flex-1 min-w-0"}`}>
          <div className="max-h-[calc(100vh-4rem)] overflow-y-auto px-3 pb-6">
            {!projectDetailData ? (
              <div className="flex items-center justify-center py-32">
                <LoaderIcon className="w-6 h-6 animate-spin text-slate-400" />
                <span className="ml-2 text-slate-500">読み込み中...</span>
              </div>
            ) : (
              <>
                {hasEstimatePanel && (
                  <div className="flex justify-end pt-2 pb-1">
                    <button onClick={() => setProjectCollapsed(true)} className="p-1 rounded hover:bg-blue-100 text-blue-500 hover:text-blue-700 transition-colors" title="現場詳細を折りたたむ">
                      <BookOpen className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <ProjectDetail
                  key={selectedProjectId}
                  project={projectDetailData.project}
                  templates={projectDetailData.templates}
                  currentUser={projectDetailData.currentUser}
                  contacts={projectDetailData.contacts}
                  units={projectDetailData.units}
                  taxRate={projectDetailData.taxRate}
                  embedded
                  compact={hasEstimatePanel}
                  activeEstimateId={selectedEstimateId}
                  onClose={closeProjectPanel}
                  onRefresh={refreshProject}
                  onSelectEstimate={(id) => guardedAction(() => openEstimateFromProject(id))}
                />
              </>
            )}
          </div>
          {projectLoading && projectDetailData && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10 pointer-events-none">
              <LoaderIcon className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          )}
        </div>
      )
    )}

    {/* ── パネル3：見積詳細 ── */}
    {hasEstimatePanel && (
      <div className="flex-1 min-w-0 border-l border-slate-200 bg-white shadow-sm relative">
        <div className="max-h-[calc(100vh-4rem)] overflow-y-auto px-3 pb-6">
          {!estimateData ? (
            <div className="flex items-center justify-center py-32">
              <LoaderIcon className="w-6 h-6 animate-spin text-slate-400" />
              <span className="ml-2 text-slate-500">読み込み中...</span>
            </div>
          ) : (
            <EstimateDetail
              key={selectedEstimateId}
              estimate={estimateData.estimate}
              taxRate={estimateData.taxRate}
              units={estimateData.units}
              currentUser={currentUser}
              contacts={estimateData.contacts}
              embedded
              onClose={handleCloseEstimate}
              onNavigateEstimate={(id) => guardedAction(() => openEstimateFromProject(id))}
              onEditingChange={setIsEstimateEditing}
              onRefresh={refreshEstimate}
            />
          )}
        </div>
        {estimateLoading && estimateData && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10 pointer-events-none">
            <LoaderIcon className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        )}
      </div>
    )}

    {/* 未保存確認ダイアログ */}
    <Dialog open={unsavedDialogOpen} onOpenChange={(v) => { if (!v) cancelDiscard() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>編集内容が保存されていません</DialogTitle>
          <DialogDescription>
            保存せずに移動すると、編集内容が失われます。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={cancelDiscard}>
            戻る
          </Button>
          <Button variant="destructive" onClick={confirmDiscard}>
            保存せず移動
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </div>
  )
}

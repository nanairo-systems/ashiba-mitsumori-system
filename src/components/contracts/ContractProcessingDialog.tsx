/**
 * [COMPONENT] 契約処理ダイアログ - ContractProcessingDialog
 *
 * 商談一覧（ProjectList）と現場詳細（ProjectDetail）の両方から使用する
 * 共通の契約処理ダイアログコンポーネント。
 *
 * 2つのモード:
 *   individual   — 見積ごとに個別の契約を作成（値引き・支払を個別設定可能）
 *   consolidated — 複数見積を1つの名前付き契約にまとめる
 *
 * items.length === 1 かつ individual の場合はシンプルな単一契約 UI を表示。
 */
"use client"

import { useState, useMemo, useEffect } from "react"
import { formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { HandshakeIcon, ChevronRight, ChevronDown } from "lucide-react"
import { toast } from "sonner"
import { useIsMobile } from "@/hooks/use-mobile"

import type {
  ContractProcessingDialogProps,
  ContractEstimateItem,
  EstimateOverride,
  PaymentType,
} from "./contract-types"
import { PAYMENT_TYPE_OPTIONS, PAYMENT_TYPE_SHORT } from "./contract-constants"
import { calcAdjustedAmount } from "./contract-calc"

// ─── ヘルパー ────────────────────────────────────────────

const today = () => new Date().toISOString().slice(0, 10)

function getOverride(
  overrides: Record<string, EstimateOverride>,
  item: ContractEstimateItem
): EstimateOverride {
  return (
    overrides[item.estimateId] ?? {
      discountStr: "0",
      taxExclStr: String(item.taxExcludedAmount),
      lastEdited: "discount" as const,
      paymentType: "FULL" as PaymentType,
    }
  )
}

function calcFinal(item: ContractEstimateItem, ovr: EstimateOverride) {
  return calcAdjustedAmount({
    originalTaxExcluded: item.taxExcludedAmount,
    discountStr: ovr.discountStr,
    taxExclStr: ovr.taxExclStr,
    lastEdited: ovr.lastEdited,
    taxRate: item.taxRate,
  })
}

// ─── メインコンポーネント ─────────────────────────────────

export function ContractProcessingDialog({
  open,
  onOpenChange,
  items,
  mode,
  onCompleted,
}: ContractProcessingDialogProps) {
  const isMobile = useIsMobile()

  // ── 共通状態 ────────────────────────────────────
  const [contractDate, setContractDate] = useState(today)
  const [paymentTerms, setPaymentTerms] = useState("")
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)

  // ── individual 用状態 ───────────────────────────
  const [overrides, setOverrides] = useState<Record<string, EstimateOverride>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // ── consolidated 用状態 ─────────────────────────
  const [contractName, setContractName] = useState("")
  const [contractAmountStr, setContractAmountStr] = useState("")
  const [paymentType, setPaymentType] = useState<PaymentType>("FULL")

  // items が変わったら consolidated のデフォルト値を設定
  useEffect(() => {
    if (mode === "consolidated" && items.length > 0) {
      setContractName(items[0].projectName)
      setContractAmountStr(
        String(items.reduce((s, i) => s + i.taxExcludedAmount, 0))
      )
    }
  }, [items, mode])

  // ダイアログが閉じたらリセット
  useEffect(() => {
    if (!open) {
      setOverrides({})
      setExpandedId(null)
      setContractName("")
      setContractAmountStr("")
      setPaymentType("FULL")
      setNote("")
      setPaymentTerms("")
      setContractDate(today())
    }
  }, [open])

  // ── override ヘルパー ─────────────────────────────
  function updateOverride(estimateId: string, patch: Partial<EstimateOverride>) {
    setOverrides((prev) => {
      const curr = prev[estimateId] ?? {
        discountStr: "0",
        taxExclStr: "0",
        lastEdited: "discount" as const,
        paymentType: "FULL" as PaymentType,
      }
      return { ...prev, [estimateId]: { ...curr, ...patch } }
    })
  }

  // ── consolidated 計算 ─────────────────────────────
  const estimateSubtotal = useMemo(
    () => items.reduce((s, i) => s + i.taxExcludedAmount, 0),
    [items]
  )

  const consolidatedAmount = Math.max(0, parseInt(contractAmountStr, 10) || 0)
  const consolidatedTaxRate = items[0]?.taxRate ?? 0.1
  const consolidatedTax = Math.floor(consolidatedAmount * consolidatedTaxRate)
  const consolidatedTotal = consolidatedAmount + consolidatedTax
  const consolidatedDiff = consolidatedAmount - estimateSubtotal

  // ── individual 合計 ───────────────────────────────
  const individualGrandTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const ovr = getOverride(overrides, item)
      return sum + calcFinal(item, ovr).total
    }, 0)
  }, [items, overrides])

  // ── 送信 ──────────────────────────────────────────

  async function handleSubmit() {
    if (!contractDate) {
      toast.error("契約日を入力してください")
      return
    }

    if (mode === "consolidated") {
      if (!contractName.trim()) {
        toast.error("契約名を入力してください")
        return
      }
      if (consolidatedAmount <= 0) {
        toast.error("契約金額が0以下です")
        return
      }
    }

    setLoading(true)
    try {
      if (mode === "individual") {
        // 個別モード
        const overridesList = items.map((item) => {
          const ovr = getOverride(overrides, item)
          const result = calcFinal(item, ovr)
          return {
            estimateId: item.estimateId,
            discountAmount: result.discount,
            adjustedAmount: result.discount > 0 ? result.adjustedTaxExcluded : null,
            adjustedTotal: result.discount > 0 ? result.total : null,
            paymentType: ovr.paymentType,
          }
        })

        const res = await fetch("/api/contracts/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "individual",
            estimateIds: items.map((i) => i.estimateId),
            overrides: overridesList,
            contractDate,
            paymentTerms: paymentTerms || null,
            note: note || null,
          }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error ?? "契約処理に失敗しました")
        }
        const data = await res.json()
        toast.success(
          items.length === 1
            ? "契約処理が完了しました"
            : `${data.count}件の契約処理が完了しました`
        )
      } else {
        // 統合モード
        const res = await fetch("/api/contracts/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "consolidated",
            name: contractName.trim(),
            estimateIds: items.map((i) => i.estimateId),
            contractAmount: consolidatedAmount,
            paymentType,
            contractDate,
            note: note || null,
          }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error ?? "契約処理に失敗しました")
        }
        toast.success(`一括契約「${contractName.trim()}」が作成されました`)
      }

      onOpenChange(false)
      onCompleted()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "エラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  // ── UI ─────────────────────────────────────────────

  const isSingle = mode === "individual" && items.length === 1
  const singleItem = isSingle ? items[0] : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${
          isMobile ? "max-w-[95vw] p-4" : mode === "consolidated" || items.length > 1 ? "max-w-2xl" : "max-w-lg"
        } max-h-[90vh] overflow-y-auto`}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandshakeIcon className={`${isMobile ? "w-4 h-4" : "w-5 h-5"} text-green-600`} />
            {isSingle ? "契約処理" : "一括契約処理"}
          </DialogTitle>
          <DialogDescription className={isMobile ? "text-xs" : ""}>
            {isSingle && singleItem
              ? `${singleItem.companyName} / ${singleItem.projectName}${singleItem.estimateName ? ` — ${singleItem.estimateName}` : ""}`
              : mode === "consolidated"
              ? `${items.length}件の見積を1つの契約にまとめます。`
              : isMobile
              ? "各行タップで値引き・支払設定。税抜で入力。"
              : "各行をクリックして値引き・支払サイクルを設定できます。金額は税抜で入力してください。"}
          </DialogDescription>
        </DialogHeader>

        {/* ─── individual: 単一見積 ─────────────────── */}
        {isSingle && singleItem && (
          <SingleEstimateSection
            item={singleItem}
            override={getOverride(overrides, singleItem)}
            onUpdateOverride={(patch) => updateOverride(singleItem.estimateId, patch)}
            isMobile={isMobile}
          />
        )}

        {/* ─── individual: 複数見積 ─────────────────── */}
        {mode === "individual" && items.length > 1 && (
          <MultiEstimateSection
            items={items}
            overrides={overrides}
            expandedId={expandedId}
            onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
            onUpdateOverride={updateOverride}
            grandTotal={individualGrandTotal}
            isMobile={isMobile}
          />
        )}

        {/* ─── consolidated ────────────────────────── */}
        {mode === "consolidated" && (
          <ConsolidatedSection
            items={items}
            contractName={contractName}
            onContractNameChange={setContractName}
            contractAmountStr={contractAmountStr}
            onContractAmountChange={setContractAmountStr}
            paymentType={paymentType}
            onPaymentTypeChange={setPaymentType}
            estimateSubtotal={estimateSubtotal}
            consolidatedAmount={consolidatedAmount}
            consolidatedTax={consolidatedTax}
            consolidatedTotal={consolidatedTotal}
            consolidatedDiff={consolidatedDiff}
            consolidatedTaxRate={consolidatedTaxRate}
            isMobile={isMobile}
          />
        )}

        {/* ─── 共通フィールド ──────────────────────── */}
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">
              契約日 <span className="text-red-500">*</span>
            </Label>
            <Input
              type="date"
              value={contractDate}
              onChange={(e) => setContractDate(e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">支払条件</Label>
            <Input
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              placeholder="例: 月末締め翌月末払い"
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">備考</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="特記事項があれば入力"
              rows={2}
              className="text-sm resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            キャンセル
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700"
          >
            <HandshakeIcon className="w-4 h-4 mr-2" />
            {loading
              ? "処理中..."
              : isSingle
              ? "契約を確定する"
              : mode === "consolidated"
              ? "一括契約を作成する"
              : `${items.length}件を契約する`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════════════════════
// サブコンポーネント
// ═══════════════════════════════════════════════════════

// ─── 単一見積（individual + items=1） ────────────────

function SingleEstimateSection({
  item,
  override,
  onUpdateOverride,
  isMobile,
}: {
  item: ContractEstimateItem
  override: EstimateOverride
  onUpdateOverride: (patch: Partial<EstimateOverride>) => void
  isMobile: boolean
}) {
  const result = calcFinal(item, override)
  const origTax = Math.floor(item.taxExcludedAmount * item.taxRate)
  const origTotal = item.taxExcludedAmount + origTax
  const taxPercent = Math.round(item.taxRate * 100)

  return (
    <>
      {/* 見積金額 */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1 text-sm">
        <div className="flex justify-between text-slate-500">
          <span>見積 税抜金額</span>
          <span className="font-mono">¥{formatCurrency(item.taxExcludedAmount)}</span>
        </div>
        <div className="flex justify-between text-slate-500">
          <span>消費税（{taxPercent}%）</span>
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
        <p className="text-xs text-slate-600">
          値引き額か税抜金額のどちらかを変更すると、もう一方が自動で調整されます
        </p>

        <div className={`grid ${isMobile ? "grid-cols-1" : "grid-cols-2"} gap-3`}>
          <div className="space-y-1">
            <Label className="text-xs">値引き額（税抜）</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">¥</span>
              <Input
                type="number"
                min={0}
                value={override.lastEdited === "discount" ? override.discountStr : String(result.discount)}
                onChange={(e) => onUpdateOverride({ discountStr: e.target.value, lastEdited: "discount" })}
                onFocus={() => {
                  if (override.lastEdited !== "discount") {
                    onUpdateOverride({ discountStr: String(result.discount), lastEdited: "discount" })
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
                value={override.lastEdited === "amount" ? override.taxExclStr : String(result.adjustedTaxExcluded)}
                onChange={(e) => onUpdateOverride({ taxExclStr: e.target.value, lastEdited: "amount" })}
                onFocus={() => {
                  if (override.lastEdited !== "amount") {
                    onUpdateOverride({ taxExclStr: String(result.adjustedTaxExcluded), lastEdited: "amount" })
                  }
                }}
                className="pl-7 text-sm font-mono"
              />
            </div>
          </div>
        </div>

        {/* 契約金額プレビュー */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1 text-sm">
          {result.discount > 0 && (
            <div className="flex justify-between text-red-600">
              <span>値引き</span>
              <span className="font-mono">-¥{formatCurrency(result.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-600">
            <span>契約 税抜金額</span>
            <span className="font-mono">¥{formatCurrency(result.adjustedTaxExcluded)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>消費税（{taxPercent}%）</span>
            <span className="font-mono">¥{formatCurrency(result.tax)}</span>
          </div>
          <div className="flex justify-between font-bold text-green-800 pt-1 border-t border-green-200">
            <span>契約金額（税込）</span>
            <span className="font-mono text-base">¥{formatCurrency(result.total)}</span>
          </div>
        </div>
      </div>

      {/* 支払サイクル */}
      <PaymentTypeRadioSection
        value={override.paymentType}
        onChange={(v) => onUpdateOverride({ paymentType: v })}
      />
    </>
  )
}

// ─── 複数見積 individual ──────────────────────────────

function MultiEstimateSection({
  items,
  overrides,
  expandedId,
  onToggleExpand,
  onUpdateOverride,
  grandTotal,
  isMobile,
}: {
  items: ContractEstimateItem[]
  overrides: Record<string, EstimateOverride>
  expandedId: string | null
  onToggleExpand: (id: string) => void
  onUpdateOverride: (estimateId: string, patch: Partial<EstimateOverride>) => void
  grandTotal: number
  isMobile: boolean
}) {
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* ヘッダー（デスクトップ） */}
      {!isMobile && (
        <div className="grid grid-cols-[2fr_1fr_0.7fr_1fr] gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wide">
          <span>見積</span>
          <span className="text-right">見積金額（税抜）</span>
          <span className="text-center">支払</span>
          <span className="text-right">契約金額（税込）</span>
        </div>
      )}

      {items.map((item, idx) => {
        const ovr = getOverride(overrides, item)
        const result = calcFinal(item, ovr)
        const isExpanded = expandedId === item.estimateId
        const hasAdjustment = result.discount > 0 || ovr.paymentType !== "FULL"

        return (
          <div key={item.estimateId} className={isExpanded ? "bg-blue-50/40" : ""}>
            {isMobile ? (
              <button
                type="button"
                onClick={() => onToggleExpand(item.estimateId)}
                className={`w-full px-3 py-2.5 text-left border-b border-slate-100 last:border-0 hover:bg-blue-50/30 transition-colors ${hasAdjustment ? "bg-amber-50/40" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm text-slate-800 truncate flex items-center gap-1 flex-1 min-w-0">
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-blue-500" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-400" />}
                    {item.estimateName}
                  </p>
                  <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${ovr.paymentType === "FULL" ? "text-slate-500" : "bg-blue-100 text-blue-700 font-medium"}`}>
                    {PAYMENT_TYPE_SHORT[ovr.paymentType]}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1 ml-5">
                  <span className="font-mono text-xs text-slate-600">見積 ¥{formatCurrency(item.taxExcludedAmount)}</span>
                  <span className={`font-mono text-sm font-semibold ${result.discount > 0 ? "text-green-700" : "text-slate-800"}`}>
                    ¥{formatCurrency(result.total)}
                    {result.discount > 0 && (
                      <span className="text-xs text-red-500 font-normal ml-1">
                        (-¥{formatCurrency(result.discount)})
                      </span>
                    )}
                  </span>
                </div>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onToggleExpand(item.estimateId)}
                className={`w-full grid grid-cols-[2fr_1fr_0.7fr_1fr] gap-2 px-3 py-2.5 text-sm items-center text-left border-b border-slate-100 last:border-0 hover:bg-blue-50/30 transition-colors ${hasAdjustment ? "bg-amber-50/40" : ""}`}
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate flex items-center gap-1">
                    {isExpanded ? <ChevronDown className="w-3 h-3 shrink-0 text-blue-500" /> : <ChevronRight className="w-3 h-3 shrink-0 text-slate-400" />}
                    {item.estimateName}
                  </p>
                  {item.estimateNumber && (
                    <p className="text-xs text-slate-600 font-mono ml-4">{item.estimateNumber}</p>
                  )}
                </div>
                <span className="font-mono text-right text-slate-500 text-xs">
                  ¥{formatCurrency(item.taxExcludedAmount)}
                </span>
                <span className={`text-center text-xs px-1.5 py-0.5 rounded ${ovr.paymentType === "FULL" ? "text-slate-500" : "bg-blue-100 text-blue-700 font-medium"}`}>
                  {PAYMENT_TYPE_SHORT[ovr.paymentType]}
                </span>
                <span className={`font-mono text-right font-semibold ${result.discount > 0 ? "text-green-700" : "text-slate-800"}`}>
                  ¥{formatCurrency(result.total)}
                  {result.discount > 0 && (
                    <span className="block text-xs text-red-500 font-normal">
                      -¥{formatCurrency(result.discount)}
                    </span>
                  )}
                </span>
              </button>
            )}

            {/* 展開エリア */}
            {isExpanded && (
              <ExpandedOverrideEditor
                item={item}
                override={ovr}
                onUpdateOverride={(patch) => onUpdateOverride(item.estimateId, patch)}
                isMobile={isMobile}
              />
            )}
          </div>
        )
      })}

      {/* 合計行 */}
      <div className="flex justify-between px-3 py-2 bg-slate-50 border-t border-slate-200 font-bold text-sm">
        <span>合計 {items.length}件</span>
        <span className="font-mono text-green-700">¥{formatCurrency(grandTotal)}</span>
      </div>
    </div>
  )
}

// ─── 展開オーバーライド編集 ──────────────────────────

function ExpandedOverrideEditor({
  item,
  override,
  onUpdateOverride,
  isMobile,
}: {
  item: ContractEstimateItem
  override: EstimateOverride
  onUpdateOverride: (patch: Partial<EstimateOverride>) => void
  isMobile: boolean
}) {
  const result = calcFinal(item, override)

  return (
    <div className={`${isMobile ? "px-3 py-2.5" : "px-4 py-3"} border-b border-slate-200 bg-blue-50/20 space-y-3`}>
      <div className={`grid ${isMobile ? "grid-cols-1 gap-2" : "grid-cols-3 gap-3"}`}>
        <div className="space-y-1">
          <Label className="text-xs">値引き額（税抜）</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">¥</span>
            <Input
              type="number"
              min={0}
              value={override.lastEdited === "discount" ? override.discountStr : String(result.discount)}
              onChange={(e) => onUpdateOverride({ discountStr: e.target.value, lastEdited: "discount" })}
              onFocus={() => {
                if (override.lastEdited !== "discount") {
                  onUpdateOverride({ discountStr: String(result.discount), lastEdited: "discount" })
                }
              }}
              className="pl-7 text-sm font-mono bg-white"
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
              value={override.lastEdited === "amount" ? override.taxExclStr : String(result.adjustedTaxExcluded)}
              onChange={(e) => onUpdateOverride({ taxExclStr: e.target.value, lastEdited: "amount" })}
              onFocus={() => {
                if (override.lastEdited !== "amount") {
                  onUpdateOverride({ taxExclStr: String(result.adjustedTaxExcluded), lastEdited: "amount" })
                }
              }}
              className="pl-7 text-sm font-mono bg-white"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">支払サイクル</Label>
          <select
            value={override.paymentType}
            onChange={(e) => onUpdateOverride({ paymentType: e.target.value as PaymentType })}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-white"
          >
            {PAYMENT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {result.discount > 0 && (
        <div className={`flex items-center ${isMobile ? "gap-2 flex-wrap" : "gap-4"} text-xs bg-green-50 border border-green-200 rounded px-3 py-1.5`}>
          <span className="text-red-600">値引き -¥{formatCurrency(result.discount)}</span>
          <span className="text-slate-400">→</span>
          <span className="text-green-700 font-semibold">契約金額 ¥{formatCurrency(result.total)}（税込）</span>
        </div>
      )}
    </div>
  )
}

// ─── consolidated セクション ──────────────────────────

function ConsolidatedSection({
  items,
  contractName,
  onContractNameChange,
  contractAmountStr,
  onContractAmountChange,
  paymentType,
  onPaymentTypeChange,
  estimateSubtotal,
  consolidatedAmount,
  consolidatedTax,
  consolidatedTotal,
  consolidatedDiff,
  consolidatedTaxRate,
  isMobile,
}: {
  items: ContractEstimateItem[]
  contractName: string
  onContractNameChange: (v: string) => void
  contractAmountStr: string
  onContractAmountChange: (v: string) => void
  paymentType: PaymentType
  onPaymentTypeChange: (v: PaymentType) => void
  estimateSubtotal: number
  consolidatedAmount: number
  consolidatedTax: number
  consolidatedTotal: number
  consolidatedDiff: number
  consolidatedTaxRate: number
  isMobile: boolean
}) {
  const taxPercent = Math.round(consolidatedTaxRate * 100)

  return (
    <>
      {/* 契約名 */}
      <div className="space-y-1">
        <Label className="text-xs">
          契約名（現場名） <span className="text-red-500">*</span>
        </Label>
        <Input
          value={contractName}
          onChange={(e) => onContractNameChange(e.target.value)}
          placeholder="例: ○○ビル新築工事"
          className="text-sm"
        />
      </div>

      {/* 対象見積一覧（読み取り専用） */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            対象見積（{items.length}件）
          </p>
        </div>
        {items.map((item, idx) => (
          <div
            key={item.estimateId}
            className={`px-4 py-2.5 flex items-center gap-3 ${idx > 0 ? "border-t border-slate-100" : ""}`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{item.estimateName}</p>
              <p className="text-xs text-slate-600 truncate">
                {item.companyName} / {item.projectName}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-mono text-sm text-slate-600">
                ¥{formatCurrency(item.taxExcludedAmount)}
              </p>
              <p className="text-xs text-slate-600">税抜</p>
            </div>
          </div>
        ))}
        <div className="flex justify-between items-center px-4 py-2.5 bg-slate-100 border-t border-slate-300">
          <span className="text-sm text-slate-600">見積合計（税抜）</span>
          <span className="font-mono text-sm font-semibold text-slate-700">
            ¥{formatCurrency(estimateSubtotal)}
          </span>
        </div>
      </div>

      {/* 契約金額入力 */}
      <div className="space-y-3 border border-slate-200 rounded-lg p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">契約金額</p>
        <div className="space-y-1">
          <Label className="text-xs">契約金額（税抜）</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">¥</span>
            <Input
              type="number"
              min={0}
              value={contractAmountStr}
              onChange={(e) => onContractAmountChange(e.target.value)}
              className="pl-7 text-sm font-mono"
              placeholder="0"
            />
          </div>
        </div>

        <div
          className={`rounded-lg p-3 space-y-1 text-sm ${
            consolidatedDiff !== 0
              ? "bg-green-50 border border-green-200"
              : "bg-slate-50 border border-slate-200"
          }`}
        >
          {consolidatedDiff < 0 && (
            <div className="flex justify-between text-red-600 text-xs">
              <span>値引き</span>
              <span className="font-mono">-¥{formatCurrency(Math.abs(consolidatedDiff))}</span>
            </div>
          )}
          {consolidatedDiff > 0 && (
            <div className="flex justify-between text-blue-600 text-xs">
              <span>増額</span>
              <span className="font-mono">+¥{formatCurrency(consolidatedDiff)}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-600">
            <span>消費税（{taxPercent}%）</span>
            <span className="font-mono">¥{formatCurrency(consolidatedTax)}</span>
          </div>
          <div
            className={`flex justify-between font-bold pt-1 border-t ${
              consolidatedDiff !== 0
                ? "border-green-200 text-green-800"
                : "border-slate-200 text-slate-800"
            }`}
          >
            <span>契約金額（税込）</span>
            <span className="font-mono text-base">¥{formatCurrency(consolidatedTotal)}</span>
          </div>
        </div>
      </div>

      {/* 支払サイクル */}
      <PaymentTypeRadioSection
        value={paymentType}
        onChange={onPaymentTypeChange}
      />
    </>
  )
}

// ─── 支払サイクルラジオ ───────────────────────────────

function PaymentTypeRadioSection({
  value,
  onChange,
}: {
  value: PaymentType
  onChange: (v: PaymentType) => void
}) {
  return (
    <div className="space-y-2 border border-slate-200 rounded-lg p-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">支払サイクル</p>
      <div className="space-y-1.5">
        {PAYMENT_TYPE_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
              value === opt.value
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <input
              type="radio"
              name={`paymentType-${opt.value}`}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="accent-blue-600 mt-0.5"
            />
            <div>
              <p className={`text-sm font-medium ${value === opt.value ? "text-blue-800" : "text-slate-700"}`}>
                {opt.label}
              </p>
              <p className="text-xs text-slate-600">{opt.description}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

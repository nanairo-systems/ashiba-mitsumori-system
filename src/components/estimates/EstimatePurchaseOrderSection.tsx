/**
 * [COMPONENT] 見積り 発注情報セクション - EstimatePurchaseOrderSection
 *
 * 見積り詳細ページに表示する発注管理カード。
 * - 未設定: 「発注を設定する」CTA
 * - 設定済み: 発注先・金額・ステータス・備考を表示 + アクションボタン
 * - ダイアログ: 発注先選択・発注金額・消費税率・備考の入力
 */
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { Truck, Pencil, Trash2, CheckCircle2, PackageCheck, ChevronUp, ChevronDown, Printer } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface PurchaseOrder {
  id: string
  subcontractorId: string
  subcontractorName: string
  orderAmount: number
  taxRate: number
  note: string | null
  status: "DRAFT" | "ORDERED" | "COMPLETED"
  orderedAt: Date | null
}

interface Subcontractor {
  id: string
  name: string
}

interface Props {
  estimateId: string
  initialOrder: PurchaseOrder | null
  estimateStatus: "DRAFT" | "CONFIRMED" | "SENT" | "OLD"
  /** 見積金額（税抜・値引後） */
  estimateSubtotal?: number
  /** 見積金額（税込） */
  estimateTotal?: number
}

const statusConfig = {
  DRAFT: { label: "未発注", className: "bg-slate-100 text-slate-600" },
  ORDERED: { label: "発注済", className: "bg-blue-100 text-blue-700" },
  COMPLETED: { label: "完了", className: "bg-green-100 text-green-700" },
}

const TAX_RATES = [
  { value: "10", label: "10%" },
  { value: "8", label: "8%" },
  { value: "0", label: "0%" },
]

export function EstimatePurchaseOrderSection({ estimateId, initialOrder, estimateStatus, estimateSubtotal, estimateTotal }: Props) {
  const router = useRouter()
  const [order, setOrder] = useState<PurchaseOrder | null>(initialOrder)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([])
  const [loadingSubs, setLoadingSubs] = useState(false)

  // フォーム
  const [subcontractorId, setSubcontractorId] = useState("")
  const [orderAmount, setOrderAmount] = useState("")
  const [taxRate, setTaxRate] = useState("10")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  /** 入力モード: "exclude" = 税抜入力, "include" = 税込入力 */
  const [inputMode, setInputMode] = useState<"exclude" | "include">("exclude")

  // 計算値（入力は千円単位 → 実際の金額に変換）
  const inputNum = parseFloat(orderAmount.replace(/,/g, "")) || 0
  const taxRateNum = parseInt(taxRate)

  // 税抜入力 → amountNum = 入力値 × 1000
  // 税込入力 → 合計から税抜金額を逆算
  const amountNum = inputMode === "exclude"
    ? inputNum * 1000
    : Math.round((inputNum * 1000) / (1 + taxRateNum / 100))
  const taxAmount = inputMode === "exclude"
    ? Math.floor(amountNum * taxRateNum / 100)
    : inputNum * 1000 - amountNum
  const totalAmount = amountNum + taxAmount

  useEffect(() => {
    if (!dialogOpen) return
    setLoadingSubs(true)
    fetch("/api/subcontractors")
      .then((r) => r.json())
      .then((data) => setSubcontractors(data ?? []))
      .catch(() => toast.error("業者一覧の取得に失敗しました"))
      .finally(() => setLoadingSubs(false))
  }, [dialogOpen])

  function openDialog() {
    setSubcontractorId(order?.subcontractorId ?? "")
    setOrderAmount(order ? String(order.orderAmount / 1000) : "")
    setTaxRate(order ? String(order.taxRate) : "10")
    setNote(order?.note ?? "")
    setInputMode("exclude")
    setDialogOpen(true)
  }

  async function handleSave(): Promise<boolean> {
    if (!subcontractorId) { toast.error("発注先を選択してください"); return false }
    if (!inputNum || inputNum <= 0) { toast.error("発注金額を入力してください"); return false }

    setSaving(true)
    try {
      const res = await fetch(`/api/estimates/${estimateId}/purchase-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subcontractorId,
          orderAmount: amountNum,
          taxRate: taxRateNum,
          note: note.trim() || null,
        }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setOrder(updated)
      toast.success(order ? "発注情報を更新しました" : "発注情報を設定しました")
      setDialogOpen(false)
      router.refresh()
      return true
    } catch {
      toast.error("保存に失敗しました")
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm("発注情報を削除しますか？")) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/estimates/${estimateId}/purchase-order`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setOrder(null)
      toast.success("発注情報を削除しました")
      router.refresh()
    } catch {
      toast.error("削除に失敗しました")
    } finally {
      setDeleting(false)
    }
  }

  async function handleStatusUpdate(newStatus: "ORDERED" | "COMPLETED") {
    setStatusUpdating(true)
    try {
      const res = await fetch(`/api/estimates/${estimateId}/purchase-order`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setOrder(updated)
      toast.success(newStatus === "ORDERED" ? "発注を確定しました" : "発注を完了しました")
      router.refresh()
    } catch {
      toast.error("ステータス更新に失敗しました")
    } finally {
      setStatusUpdating(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm text-slate-700">
            <Truck className="w-4 h-4 text-slate-400" />
            発注情報
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!order ? (
            /* 未設定状態 */
            <div className="flex items-center justify-between py-2">
              <p className="text-sm text-slate-400">下請け業者への発注が未設定です</p>
              <Button size="sm" variant="outline" onClick={openDialog}>
                <Truck className="w-3.5 h-3.5 mr-1.5" />
                発注を設定する
              </Button>
            </div>
          ) : (
            /* 設定済み状態 */
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">発注先</p>
                  <p className="font-medium">{order.subcontractorName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">ステータス</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[order.status].className}`}>
                    {statusConfig[order.status].label}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">発注金額（税抜）</p>
                  <p className="font-mono font-semibold">¥{formatCurrency(order.orderAmount)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">消費税（{order.taxRate}%）/ 合計</p>
                  <p className="font-mono text-slate-600">
                    ¥{formatCurrency(Math.floor(order.orderAmount * order.taxRate / 100))}
                    <span className="mx-1 text-slate-300">/</span>
                    ¥{formatCurrency(order.orderAmount + Math.floor(order.orderAmount * order.taxRate / 100))}
                  </p>
                </div>
              </div>
              {order.note && (
                <p className="text-xs text-slate-500 bg-slate-50 rounded px-3 py-2 whitespace-pre-wrap">{order.note}</p>
              )}

              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openDialog}
                  className="text-xs h-7"
                >
                  <Pencil className="w-3 h-3 mr-1" />
                  編集
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(`/estimates/${estimateId}/purchase-order/print`, "_blank")}
                  className="text-xs h-7"
                >
                  <Printer className="w-3 h-3 mr-1" />
                  発注書
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-xs h-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  削除
                </Button>
                <div className="ml-auto flex gap-2">
                  {order.status === "DRAFT" && (
                    <Button
                      size="sm"
                      onClick={() => handleStatusUpdate("ORDERED")}
                      disabled={statusUpdating}
                      className="text-xs h-7 bg-blue-600 hover:bg-blue-700"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                      発注確定
                    </Button>
                  )}
                  {order.status === "ORDERED" && (
                    <Button
                      size="sm"
                      onClick={() => handleStatusUpdate("COMPLETED")}
                      disabled={statusUpdating}
                      className="text-xs h-7 bg-green-600 hover:bg-green-700"
                    >
                      <PackageCheck className="w-3.5 h-3.5 mr-1.5" />
                      発注完了
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 発注設定ダイアログ */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-4 h-4" />
              {order ? "発注情報を編集" : "発注を設定する"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* 発注先 */}
            <div className="space-y-1.5">
              <Label>発注先 <span className="text-red-500">*</span></Label>
              <Select value={subcontractorId} onValueChange={setSubcontractorId} disabled={loadingSubs}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingSubs ? "読み込み中..." : "業者を選択"} />
                </SelectTrigger>
                <SelectContent>
                  {subcontractors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 入力モード切替 + 消費税率 */}
            <div className="flex items-center gap-3">
              <div className="flex rounded-md border border-slate-200 overflow-hidden text-xs">
                <button
                  type="button"
                  className={`px-3 py-1.5 transition-colors ${inputMode === "exclude" ? "bg-blue-600 text-white font-semibold" : "bg-white text-slate-500 hover:bg-slate-50"}`}
                  onClick={() => {
                    if (inputMode === "include" && inputNum > 0) {
                      // 税込 → 税抜に変換
                      const excl = Math.round((inputNum * 1000) / (1 + taxRateNum / 100))
                      setOrderAmount(String(excl / 1000))
                    }
                    setInputMode("exclude")
                  }}
                >
                  税抜
                </button>
                <button
                  type="button"
                  className={`px-3 py-1.5 transition-colors ${inputMode === "include" ? "bg-blue-600 text-white font-semibold" : "bg-white text-slate-500 hover:bg-slate-50"}`}
                  onClick={() => {
                    if (inputMode === "exclude" && inputNum > 0) {
                      // 税抜 → 税込に変換
                      const incl = inputNum * 1000 + Math.floor(inputNum * 1000 * taxRateNum / 100)
                      setOrderAmount(String(incl / 1000))
                    }
                    setInputMode("include")
                  }}
                >
                  税込
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-slate-500 whitespace-nowrap">税率</Label>
                <Select value={taxRate} onValueChange={(v) => {
                  setTaxRate(v)
                  // 税込モードの場合、税率変更しても入力値は据え置き（逆算結果が変わるだけ）
                }}>
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAX_RATES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 発注金額 */}
            <div className="space-y-1.5">
              <Label>
                {inputMode === "exclude" ? "発注金額（税抜）" : "発注金額（税込）"}
                <span className="text-red-500 ml-0.5">*</span>
              </Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={orderAmount}
                  onChange={(e) => setOrderAmount(e.target.value)}
                  placeholder="0"
                  min={0}
                  step={1}
                  className="flex-1"
                />
                <span className="text-sm text-slate-500 flex-shrink-0 font-mono">,000円</span>
              </div>
            </div>

            {/* 自動計算 */}
            {amountNum > 0 && (
              <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
                <div className={`flex justify-between ${inputMode === "include" ? "text-slate-700 font-medium" : "text-slate-500"}`}>
                  <span>発注金額（税抜）</span>
                  <span className="font-mono">¥{formatCurrency(amountNum)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>消費税（{taxRate}%）</span>
                  <span className="font-mono">¥{formatCurrency(taxAmount)}</span>
                </div>
                <div className="flex justify-between font-semibold border-t border-slate-200 pt-1 mt-1">
                  <span>合計金額（税込）</span>
                  <span className="font-mono">¥{formatCurrency(totalAmount)}</span>
                </div>
              </div>
            )}

            {/* 粗利から逆算 */}
            {estimateSubtotal != null && estimateSubtotal > 0 && (() => {
              const grossProfit = estimateSubtotal - amountNum
              const grossMargin = estimateSubtotal > 0
                ? Math.round((grossProfit / estimateSubtotal) * 100)
                : 0
              const isNegative = grossProfit < 0

              // 粗利額を入力 → 発注金額を逆算（千円単位）
              const handleProfitChange = (value: string) => {
                const profitNum = parseFloat(value.replace(/,/g, "")) || 0
                const newAmount = estimateSubtotal - profitNum * 1000
                if (newAmount >= 0) {
                  setInputMode("exclude")
                  setOrderAmount(String(newAmount / 1000))
                }
              }

              // 粗利率を入力 → 発注金額を逆算（千円単位）
              const handleMarginChange = (value: string) => {
                const marginNum = parseFloat(value) || 0
                const newAmount = Math.round(estimateSubtotal * (1 - marginNum / 100))
                if (newAmount >= 0) {
                  setInputMode("exclude")
                  setOrderAmount(String(newAmount / 1000))
                }
              }

              return (
                <div className={`rounded-lg p-3 text-sm space-y-2 ${isNegative ? "bg-red-50 border border-red-200" : "bg-blue-50 border border-blue-200"}`}>
                  <div className="flex justify-between text-slate-600">
                    <span>見積金額（税抜）</span>
                    <span className="font-mono">¥{formatCurrency(estimateSubtotal)}</span>
                  </div>
                  {amountNum > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>発注金額（税抜）</span>
                      <span className="font-mono">¥{formatCurrency(amountNum)}</span>
                    </div>
                  )}
                  <div className={`border-t pt-2 mt-1 space-y-2 ${isNegative ? "border-red-200" : "border-blue-200"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-semibold whitespace-nowrap ${isNegative ? "text-red-600" : "text-blue-700"}`}>粗利額</span>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={amountNum > 0 ? String(grossProfit / 1000) : ""}
                          onChange={(e) => handleProfitChange(e.target.value)}
                          placeholder="0"
                          step={1}
                          className="w-28 h-7 text-right font-mono text-sm"
                        />
                        <span className="text-xs text-slate-500 whitespace-nowrap font-mono">,000円</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-semibold whitespace-nowrap ${isNegative ? "text-red-600" : "text-blue-700"}`}>粗利率</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const base = amountNum > 0 ? grossMargin : 20
                            handleMarginChange(String(base - 1))
                          }}
                          className="flex items-center justify-center w-8 h-8 rounded-md border border-slate-300 bg-white hover:bg-slate-100 active:bg-slate-200 transition-colors"
                        >
                          <ChevronDown className="w-4 h-4 text-slate-600" />
                        </button>
                        <Input
                          type="number"
                          value={amountNum > 0 ? String(grossMargin) : ""}
                          onChange={(e) => handleMarginChange(e.target.value)}
                          placeholder="20"
                          step={1}
                          className="w-20 h-8 text-center font-mono text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const base = amountNum > 0 ? grossMargin : 20
                            handleMarginChange(String(base + 1))
                          }}
                          className="flex items-center justify-center w-8 h-8 rounded-md border border-slate-300 bg-white hover:bg-slate-100 active:bg-slate-200 transition-colors"
                        >
                          <ChevronUp className="w-4 h-4 text-slate-600" />
                        </button>
                        <span className="text-xs text-slate-500 font-mono">%</span>
                      </div>
                    </div>
                  </div>
                  {isNegative && amountNum > 0 && (
                    <p className="text-xs text-red-500 font-medium">⚠ 粗利がマイナスです</p>
                  )}
                </div>
              )
            })()}

            {/* 備考 */}
            <div className="space-y-1.5">
              <Label>備考</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="特記事項・条件など"
                maxLength={500}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={saving} variant="outline">
              {saving ? "保存中..." : "保存"}
            </Button>
            <Button
              onClick={async () => {
                const success = await handleSave()
                if (success) {
                  window.open(`/estimates/${estimateId}/purchase-order/print`, "_blank")
                }
              }}
              disabled={saving}
              className="gap-1.5"
            >
              <Printer className="w-4 h-4" />
              {saving ? "保存中..." : "保存して発注書発行"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

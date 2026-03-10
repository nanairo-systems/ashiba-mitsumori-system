/**
 * [COMPONENT] 入金管理一覧 - PaymentList
 *
 * 請求に対する入金状況を一覧表示。
 * 未入金・一部入金のハイライト、期限超過アラート、CSVエクスポートに対応。
 */
"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { formatDate, formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Wallet,
  Plus,
  Loader2,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Building2,
  MoreHorizontal,
  Trash2,
  Receipt,
  ArrowRight,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { format, parseISO, differenceInDays } from "date-fns"
import { ja } from "date-fns/locale"
import type { InvoiceType, InvoiceStatus } from "@prisma/client"

// ─── 型定義 ────────────────────────────────────────────

interface PaymentData {
  id: string
  paymentDate: string
  paymentAmount: number
  transferFee: number
  discountAmount: number
  notes: string | null
}

interface InvoiceWithPayments {
  id: string
  invoiceNumber: string | null
  invoiceType: InvoiceType
  amount: number
  taxAmount: number
  totalAmount: number
  invoiceDate: string
  dueDate: string | null
  status: InvoiceStatus
  paidAmount: number
  notes: string | null
  companyId: string
  companyName: string
  projectName: string
  contractNumber: string | null
  contractId: string
  payments: PaymentData[]
}

interface Props {
  invoices: InvoiceWithPayments[]
  currentUser: { id: string; name: string }
}

// ─── 定数 ──────────────────────────────────────────────

const TYPE_LABEL: Record<InvoiceType, string> = {
  FULL: "一括", ASSEMBLY: "組立分", DISASSEMBLY: "解体分", PROGRESS: "出来高",
}
const STATUS_LABEL: Record<InvoiceStatus, string> = {
  DRAFT: "下書き", SENT: "送付済", PAID: "入金済", PARTIAL_PAID: "一部入金",
}
const STATUS_STYLE: Record<InvoiceStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600 border-slate-200",
  SENT: "bg-blue-50 text-blue-700 border-blue-200",
  PAID: "bg-green-50 text-green-700 border-green-200",
  PARTIAL_PAID: "bg-amber-50 text-amber-700 border-amber-200",
}

type FilterType = "ALL" | "OVERDUE" | "UNPAID" | "PARTIAL" | "PAID"

// ─── メインコンポーネント ───────────────────────────────

export function PaymentList({ invoices, currentUser }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FilterType>("ALL")
  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [targetInvoice, setTargetInvoice] = useState<InvoiceWithPayments | null>(null)

  // 入金登録フォーム
  const [payDate, setPayDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [payAmount, setPayAmount] = useState("")
  const [payFee, setPayFee] = useState("")
  const [payDiscount, setPayDiscount] = useState("")
  const [payNotes, setPayNotes] = useState("")

  const now = new Date()

  // フィルタリング
  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (search) {
        const q = search.toLowerCase()
        if (!inv.companyName.toLowerCase().includes(q) &&
            !inv.projectName.toLowerCase().includes(q) &&
            !(inv.invoiceNumber?.toLowerCase().includes(q) ?? false)) return false
      }
      const isOverdue = inv.dueDate && parseISO(inv.dueDate) < now && inv.status !== "PAID"
      switch (filter) {
        case "OVERDUE": return !!isOverdue
        case "UNPAID": return inv.status === "SENT"
        case "PARTIAL": return inv.status === "PARTIAL_PAID"
        case "PAID": return inv.status === "PAID"
        default: return true
      }
    })
  }, [invoices, search, filter, now])

  // 集計
  const summary = useMemo(() => {
    const totalInvoiced = invoices.reduce((s, i) => s + i.totalAmount, 0)
    const totalPaidAmount = invoices.reduce((s, i) => {
      const paid = i.payments.reduce((ps, p) => ps + p.paymentAmount, 0)
      return s + paid
    }, 0)
    const totalFees = invoices.reduce((s, i) => {
      return s + i.payments.reduce((ps, p) => ps + p.transferFee, 0)
    }, 0)
    const totalDiscounts = invoices.reduce((s, i) => {
      return s + i.payments.reduce((ps, p) => ps + p.discountAmount, 0)
    }, 0)
    const overdueCount = invoices.filter(
      (i) => i.dueDate && parseISO(i.dueDate) < now && i.status !== "PAID"
    ).length
    return { totalInvoiced, totalPaidAmount, totalFees, totalDiscounts, overdueCount }
  }, [invoices, now])

  function openPayment(inv: InvoiceWithPayments) {
    setTargetInvoice(inv)
    setPayDate(format(new Date(), "yyyy-MM-dd"))
    const totalSettled = inv.payments.reduce(
      (s, p) => s + p.paymentAmount + p.transferFee + p.discountAmount, 0
    )
    const remaining = inv.totalAmount - totalSettled
    setPayAmount(remaining > 0 ? String(remaining) : "")
    setPayFee("")
    setPayDiscount("")
    setPayNotes("")
    setAddOpen(true)
  }

  // 差額の自動計算
  const diffInfo = useMemo(() => {
    if (!targetInvoice || !payAmount) return null
    const totalSettled = targetInvoice.payments.reduce(
      (s, p) => s + p.paymentAmount + p.transferFee + p.discountAmount, 0
    )
    const remaining = targetInvoice.totalAmount - totalSettled
    const amt = parseFloat(payAmount) || 0
    const fee = parseFloat(payFee) || 0
    const discount = parseFloat(payDiscount) || 0
    const diff = remaining - amt - fee - discount
    return { remaining, diff }
  }, [targetInvoice, payAmount, payFee, payDiscount])

  async function handleCreate() {
    if (!targetInvoice) return
    if (!payAmount) { toast.error("入金額を入力してください"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: targetInvoice.id,
          paymentDate: payDate,
          paymentAmount: parseFloat(payAmount),
          transferFee: parseFloat(payFee) || 0,
          discountAmount: parseFloat(payDiscount) || 0,
          notes: payNotes.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || "登録に失敗しました")
      }
      toast.success("入金を登録しました")
      setAddOpen(false)
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "エラーが発生しました")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeletePayment(paymentId: string) {
    if (!confirm("この入金を削除しますか？")) return
    const res = await fetch(`/api/payments/${paymentId}`, { method: "DELETE" })
    if (res.ok) { toast.success("削除しました"); router.refresh() }
    else toast.error("削除に失敗しました")
  }

  function handleCsvExport() {
    const url = "/api/payments/export"
    window.open(url, "_blank")
  }

  function getSettledTotal(inv: InvoiceWithPayments) {
    return inv.payments.reduce((s, p) => s + p.paymentAmount + p.transferFee + p.discountAmount, 0)
  }

  function getOverdueDays(inv: InvoiceWithPayments) {
    if (!inv.dueDate || inv.status === "PAID") return 0
    const d = differenceInDays(now, parseISO(inv.dueDate))
    return d > 0 ? d : 0
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Wallet className="w-6 h-6 text-emerald-600" />
            入金管理
          </h1>
          <p className="text-sm text-slate-500 mt-1">請求に対する入金状況を管理 — こんにちは、{currentUser.name} さん</p>
        </div>
        <Button variant="outline" onClick={handleCsvExport} className="gap-1.5 text-sm">
          <Download className="w-4 h-4" />
          CSVエクスポート
        </Button>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-5 gap-3">
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-3">
            <p className="text-xs text-slate-500 mb-1">請求合計</p>
            <p className="text-lg font-bold font-mono text-slate-700">¥{formatCurrency(summary.totalInvoiced)}</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-3">
            <p className="text-xs text-green-600 mb-1">入金済</p>
            <p className="text-lg font-bold font-mono text-green-700">¥{formatCurrency(summary.totalPaidAmount)}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-3">
            <p className="text-xs text-amber-600 mb-1">振込手数料計</p>
            <p className="text-lg font-bold font-mono text-amber-700">¥{formatCurrency(summary.totalFees)}</p>
          </CardContent>
        </Card>
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="p-3">
            <p className="text-xs text-purple-600 mb-1">値引き計</p>
            <p className="text-lg font-bold font-mono text-purple-700">¥{formatCurrency(summary.totalDiscounts)}</p>
          </CardContent>
        </Card>
        {summary.overdueCount > 0 ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-3">
              <p className="text-xs text-red-600 mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />期限超過</p>
              <p className="text-lg font-bold font-mono text-red-700">{summary.overdueCount} 件</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="p-3">
              <p className="text-xs text-emerald-600 mb-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />期限超過</p>
              <p className="text-lg font-bold font-mono text-emerald-700">なし</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* フィルター */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="会社名・現場名で検索" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
        </div>
        <div className="flex gap-1">
          {([
            { key: "ALL", label: "すべて" },
            { key: "OVERDUE", label: "期限超過", color: "text-red-600" },
            { key: "UNPAID", label: "未入金" },
            { key: "PARTIAL", label: "一部入金" },
            { key: "PAID", label: "入金済" },
          ] as const).map(({ key, label }) => (
            <Button key={key} size="sm" variant={filter === key ? "default" : "outline"} onClick={() => setFilter(key)} className="text-xs h-8">
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* 一覧 */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border py-16 text-center text-slate-400">
          <Wallet className="w-10 h-10 mx-auto mb-3 opacity-30" />
          該当する請求はありません
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((inv) => {
            const settledTotal = getSettledTotal(inv)
            const remaining = inv.totalAmount - settledTotal
            const progress = inv.totalAmount > 0 ? Math.min((settledTotal / inv.totalAmount) * 100, 100) : 0
            const overdueDays = getOverdueDays(inv)
            const isOverdue = overdueDays > 0

            return (
              <div key={inv.id} className={`bg-white rounded-xl border overflow-hidden transition-colors ${isOverdue ? "border-red-300 bg-red-50/20" : ""}`}>
                <div className="px-4 py-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLE[inv.status]}`}>
                          {STATUS_LABEL[inv.status]}
                        </span>
                        <span className="text-xs text-slate-500">{TYPE_LABEL[inv.invoiceType]}</span>
                        {inv.invoiceNumber && <span className="text-xs font-mono text-slate-400">{inv.invoiceNumber}</span>}
                        {isOverdue && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            {overdueDays}日超過
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-slate-800 truncate">
                        <span className="text-slate-500">{inv.companyName}</span>
                        <span className="mx-1.5 text-slate-300">/</span>
                        {inv.projectName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {inv.status !== "PAID" && (
                        <Button size="sm" className="text-xs gap-1 h-7" onClick={() => openPayment(inv)}>
                          <Plus className="w-3 h-3" />
                          入金登録
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem asChild>
                            <Link href={`/contracts/${inv.contractId}`} className="gap-2"><Receipt className="w-4 h-4" />契約詳細</Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* 金額・プログレス */}
                  <div className="flex items-center gap-4 text-sm mb-2">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-600">請求額:</span>
                      <span className="font-mono font-semibold">¥{formatCurrency(inv.totalAmount)}</span>
                    </div>
                    <ArrowRight className="w-3 h-3 text-slate-300" />
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-600">入金済:</span>
                      <span className="font-mono font-semibold text-green-700">¥{formatCurrency(settledTotal)}</span>
                    </div>
                    {remaining > 0 && (
                      <>
                        <ArrowRight className="w-3 h-3 text-slate-300" />
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-600">残額:</span>
                          <span className={`font-mono font-semibold ${isOverdue ? "text-red-700" : "text-amber-700"}`}>¥{formatCurrency(remaining)}</span>
                        </div>
                      </>
                    )}
                    <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
                      <span>請求日: {formatDate(inv.invoiceDate, "MM/dd")}</span>
                      {inv.dueDate && <span>期限: {formatDate(inv.dueDate, "MM/dd")}</span>}
                    </div>
                  </div>

                  {/* プログレスバー */}
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${progress >= 100 ? "bg-green-500" : isOverdue ? "bg-red-400" : "bg-blue-400"}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  {/* 入金履歴 */}
                  {inv.payments.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <p className="text-xs text-slate-600 mb-1">入金履歴</p>
                      <div className="space-y-1">
                        {inv.payments.map((p) => (
                          <div key={p.id} className="flex items-center gap-3 text-xs">
                            <span className="text-slate-500 w-[70px]">{formatDate(p.paymentDate, "yyyy/MM/dd")}</span>
                            <span className="font-mono font-medium text-green-700">¥{formatCurrency(p.paymentAmount)}</span>
                            {p.transferFee > 0 && <span className="text-slate-400">手数料: ¥{formatCurrency(p.transferFee)}</span>}
                            {p.discountAmount > 0 && <span className="text-slate-400">値引: ¥{formatCurrency(p.discountAmount)}</span>}
                            {p.notes && <span className="text-slate-400 truncate max-w-[200px]">{p.notes}</span>}
                            <button onClick={() => handleDeletePayment(p.id)} className="ml-auto text-slate-300 hover:text-red-500">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 入金登録ダイアログ */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-600" />入金登録</DialogTitle>
            <DialogDescription>
              {targetInvoice && (
                <span>
                  {targetInvoice.companyName} / {targetInvoice.projectName}
                  {targetInvoice.invoiceNumber && <span className="ml-1 font-mono text-xs">({targetInvoice.invoiceNumber})</span>}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {targetInvoice && (
            <div className="space-y-4">
              {/* 請求情報 */}
              <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">請求額（税込）</span>
                  <span className="font-mono font-semibold">¥{formatCurrency(targetInvoice.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">入金済合計</span>
                  <span className="font-mono text-green-700">¥{formatCurrency(getSettledTotal(targetInvoice))}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1">
                  <span className="text-slate-700 font-medium">残額</span>
                  <span className="font-mono font-bold text-amber-700">¥{formatCurrency(Math.max(0, targetInvoice.totalAmount - getSettledTotal(targetInvoice)))}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>入金日 <span className="text-red-500">*</span></Label>
                  <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>入金額 <span className="text-red-500">*</span></Label>
                  <Input type="number" min={0} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="例: 1033560" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>振込手数料</Label>
                  <Input type="number" min={0} value={payFee} onChange={(e) => setPayFee(e.target.value)} placeholder="例: 440" />
                </div>
                <div className="space-y-1.5">
                  <Label>値引き額</Label>
                  <Input type="number" min={0} value={payDiscount} onChange={(e) => setPayDiscount(e.target.value)} placeholder="0" />
                </div>
              </div>

              {/* 差額自動計算 */}
              {diffInfo && (
                <div className={`rounded-lg p-3 text-sm ${diffInfo.diff === 0 ? "bg-green-50 text-green-700" : diffInfo.diff > 0 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                  <div className="flex justify-between">
                    <span>残額に対する差額</span>
                    <span className="font-mono font-bold">
                      {diffInfo.diff === 0 ? "¥0（ピッタリ）" : diffInfo.diff > 0 ? `¥${formatCurrency(diffInfo.diff)}（不足）` : `¥${formatCurrency(Math.abs(diffInfo.diff))}（超過）`}
                    </span>
                  </div>
                  {diffInfo.diff > 0 && !payFee && !payDiscount && (
                    <p className="text-xs mt-1 opacity-75">差額を「振込手数料」または「値引き」に入力すると、請求が入金済になります</p>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label>備考</Label>
                <Textarea value={payNotes} onChange={(e) => setPayNotes(e.target.value)} rows={2} placeholder="手数料差額の説明など" />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>キャンセル</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />登録中...</> : "入金を登録"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

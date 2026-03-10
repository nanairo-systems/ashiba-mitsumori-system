/**
 * [COMPONENT] 支払管理一覧 - SubcontractorPaymentList
 *
 * 下請け業者ごとの支払い一覧。期限アラート・月別サマリーに対応。
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Truck,
  Plus,
  Loader2,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building2,
  MoreHorizontal,
  Trash2,
  Receipt,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { format, parseISO, differenceInDays, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns"
import { ja } from "date-fns/locale"
import type { SubcontractorPaymentStatus } from "@prisma/client"

// ─── 型定義 ────────────────────────────────────────────

interface PaymentData {
  id: string
  contractId: string
  subcontractorId: string
  orderAmount: number
  taxAmount: number
  totalAmount: number
  closingDate: string | null
  paymentDueDate: string | null
  paymentDate: string | null
  paymentAmount: number | null
  status: SubcontractorPaymentStatus
  notes: string | null
  subcontractor: { id: string; name: string; representative: string | null; phone: string | null }
  contract: { id: string; contractNumber: string | null; projectName: string; companyName: string }
}

interface ContractOption {
  id: string
  contractNumber: string | null
  projectName: string
  companyName: string
  taxRate: number
  works: {
    id: string
    subcontractorId: string | null
    subcontractorName: string | null
    orderAmount: number
    orderTaxAmount: number
    orderTotalAmount: number
  }[]
}

interface Props {
  payments: PaymentData[]
  contracts: ContractOption[]
  subcontractors: { id: string; name: string }[]
  currentUser: { id: string; name: string }
}

// ─── 定数 ──────────────────────────────────────────────

const STATUS_LABEL: Record<SubcontractorPaymentStatus, string> = {
  PENDING: "未処理", SCHEDULED: "支払予定", PAID: "支払済",
}
const STATUS_STYLE: Record<SubcontractorPaymentStatus, string> = {
  PENDING: "bg-slate-100 text-slate-600 border-slate-200",
  SCHEDULED: "bg-blue-50 text-blue-700 border-blue-200",
  PAID: "bg-green-50 text-green-700 border-green-200",
}

type FilterType = "ALL" | "OVERDUE" | "PENDING" | "SCHEDULED" | "PAID"

// ─── メインコンポーネント ───────────────────────────────

export function SubcontractorPaymentList({ payments, contracts, subcontractors, currentUser }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FilterType>("ALL")
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // 新規作成フォーム
  const [newContractId, setNewContractId] = useState("")
  const [newWorkId, setNewWorkId] = useState("")
  const [newClosingDate, setNewClosingDate] = useState("")
  const [newDueDate, setNewDueDate] = useState("")
  const [newNotes, setNewNotes] = useState("")

  const now = new Date()

  // フィルタリング
  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (search) {
        const q = search.toLowerCase()
        if (!p.subcontractor.name.toLowerCase().includes(q) &&
            !p.contract.projectName.toLowerCase().includes(q) &&
            !p.contract.companyName.toLowerCase().includes(q)) return false
      }
      const isOverdue = p.paymentDueDate && parseISO(p.paymentDueDate) < now && p.status !== "PAID"
      switch (filter) {
        case "OVERDUE": return !!isOverdue
        case "PENDING": return p.status === "PENDING"
        case "SCHEDULED": return p.status === "SCHEDULED"
        case "PAID": return p.status === "PAID"
        default: return true
      }
    })
  }, [payments, search, filter, now])

  // 業者別グループ化
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; payments: PaymentData[] }>()
    for (const p of filtered) {
      const key = p.subcontractorId
      if (!map.has(key)) map.set(key, { name: p.subcontractor.name, payments: [] })
      map.get(key)!.payments.push(p)
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "ja"))
  }, [filtered])

  // 月別サマリー
  const monthlySummary = useMemo(() => {
    const mStart = startOfMonth(currentMonth)
    const mEnd = endOfMonth(currentMonth)
    const monthPayments = payments.filter((p) => {
      if (!p.paymentDueDate) return false
      const d = parseISO(p.paymentDueDate)
      return d >= mStart && d <= mEnd
    })
    const total = monthPayments.reduce((s, p) => s + p.totalAmount, 0)
    const paid = monthPayments.filter((p) => p.status === "PAID").reduce((s, p) => s + (p.paymentAmount ?? p.totalAmount), 0)
    const pending = monthPayments.filter((p) => p.status !== "PAID").reduce((s, p) => s + p.totalAmount, 0)
    return { total, paid, pending, count: monthPayments.length }
  }, [payments, currentMonth])

  // 集計
  const summary = useMemo(() => {
    const total = payments.reduce((s, p) => s + p.totalAmount, 0)
    const paidTotal = payments.filter((p) => p.status === "PAID").reduce((s, p) => s + (p.paymentAmount ?? p.totalAmount), 0)
    const overdueCount = payments.filter(
      (p) => p.paymentDueDate && parseISO(p.paymentDueDate) < now && p.status !== "PAID"
    ).length
    return { total, paidTotal, overdueCount }
  }, [payments, now])

  const selectedContract = contracts.find((c) => c.id === newContractId)
  const selectedWork = selectedContract?.works.find((w) => w.id === newWorkId)

  async function handleCreate() {
    if (!newContractId || !newWorkId) { toast.error("契約と外注工事を選択してください"); return }
    if (!selectedWork?.subcontractorId) { toast.error("外注先情報がありません"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/subcontractor-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId: newContractId,
          subcontractorId: selectedWork.subcontractorId,
          orderAmount: selectedWork.orderAmount,
          taxAmount: selectedWork.orderTaxAmount,
          totalAmount: selectedWork.orderTotalAmount,
          closingDate: newClosingDate || null,
          paymentDueDate: newDueDate || null,
          notes: newNotes.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || "作成に失敗しました")
      }
      toast.success("支払いを登録しました")
      setAddOpen(false)
      resetForm()
      router.refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "エラーが発生しました")
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    setNewContractId("")
    setNewWorkId("")
    setNewClosingDate("")
    setNewDueDate("")
    setNewNotes("")
  }

  async function handleStatusUpdate(paymentId: string, status: SubcontractorPaymentStatus, paymentDate?: string) {
    const label = STATUS_LABEL[status]
    if (!confirm(`ステータスを「${label}」に変更しますか？`)) return
    const body: Record<string, unknown> = { status }
    if (status === "PAID") {
      body.paymentDate = paymentDate ?? new Date().toISOString().slice(0, 10)
    }
    const res = await fetch(`/api/subcontractor-payments/${paymentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (res.ok) { toast.success(`${label}に更新しました`); router.refresh() }
    else toast.error("更新に失敗しました")
  }

  async function handleDelete(paymentId: string) {
    if (!confirm("この支払いを削除しますか？")) return
    const res = await fetch(`/api/subcontractor-payments/${paymentId}`, { method: "DELETE" })
    if (res.ok) { toast.success("削除しました"); router.refresh() }
    else toast.error("削除に失敗しました")
  }

  function getOverdueDays(p: PaymentData) {
    if (!p.paymentDueDate || p.status === "PAID") return 0
    const d = differenceInDays(now, parseISO(p.paymentDueDate))
    return d > 0 ? d : 0
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Truck className="w-6 h-6 text-orange-600" />
            支払管理
          </h1>
          <p className="text-sm text-slate-500 mt-1">下請け業者への支払い管理 — こんにちは、{currentUser.name} さん</p>
        </div>
        <Button className="gap-1.5" onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4" />
          新規支払い登録
        </Button>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-slate-200 bg-slate-50">
          <CardContent className="p-3">
            <p className="text-xs text-slate-500 mb-1">支払い総額</p>
            <p className="text-lg font-bold font-mono text-slate-700">¥{formatCurrency(summary.total)}</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-3">
            <p className="text-xs text-green-600 mb-1">支払済</p>
            <p className="text-lg font-bold font-mono text-green-700">¥{formatCurrency(summary.paidTotal)}</p>
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

      {/* 月別サマリー */}
      <Card className="border-orange-200 bg-orange-50/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-semibold text-slate-700">月別支払予定</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setCurrentMonth((m) => subMonths(m, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-bold text-slate-800 w-[120px] text-center">
                {format(currentMonth, "yyyy年 M月", { locale: ja })}
              </span>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="text-xs ml-1" onClick={() => setCurrentMonth(new Date())}>今月</Button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div><p className="text-xs text-slate-600">対象件数</p><p className="text-sm font-bold">{monthlySummary.count} 件</p></div>
            <div><p className="text-xs text-slate-600">予定合計</p><p className="text-sm font-bold font-mono">¥{formatCurrency(monthlySummary.total)}</p></div>
            <div><p className="text-xs text-slate-600">支払済</p><p className="text-sm font-bold font-mono text-green-700">¥{formatCurrency(monthlySummary.paid)}</p></div>
            <div><p className="text-xs text-slate-600">未払い</p><p className="text-sm font-bold font-mono text-amber-700">¥{formatCurrency(monthlySummary.pending)}</p></div>
          </div>
        </CardContent>
      </Card>

      {/* フィルター */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="業者名・現場名で検索" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
        </div>
        <div className="flex gap-1">
          {([
            { key: "ALL", label: "すべて" },
            { key: "OVERDUE", label: "期限超過" },
            { key: "PENDING", label: "未処理" },
            { key: "SCHEDULED", label: "支払予定" },
            { key: "PAID", label: "支払済" },
          ] as const).map(({ key, label }) => (
            <Button key={key} size="sm" variant={filter === key ? "default" : "outline"} onClick={() => setFilter(key)} className="text-xs h-8">
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* 業者別一覧 */}
      {grouped.length === 0 ? (
        <div className="bg-white rounded-xl border py-16 text-center text-slate-400">
          <Truck className="w-10 h-10 mx-auto mb-3 opacity-30" />
          該当する支払いはありません
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ name, payments: subPayments }) => {
            const subTotal = subPayments.reduce((s, p) => s + p.totalAmount, 0)
            const subPaid = subPayments.filter((p) => p.status === "PAID").reduce((s, p) => s + (p.paymentAmount ?? p.totalAmount), 0)
            return (
              <div key={name} className="bg-white rounded-xl border overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white">
                  <Truck className="w-4 h-4 text-orange-300" />
                  <span className="font-semibold text-sm">{name}</span>
                  <span className="ml-auto text-xs text-slate-300">
                    {subPayments.length}件 / 合計 ¥{formatCurrency(subTotal)} / 支払済 ¥{formatCurrency(subPaid)}
                  </span>
                </div>
                <div>
                  <div className="grid grid-cols-[1.5fr_1fr_0.7fr_0.8fr_1fr_0.7fr_0.7fr_2.5rem] gap-x-2 px-4 py-1.5 bg-slate-50 border-b text-xs font-medium text-slate-400">
                    <span>現場名 / 契約番号</span>
                    <span>元請</span>
                    <span>状況</span>
                    <span className="text-right">支払額（税込）</span>
                    <span>締め日</span>
                    <span>支払期日</span>
                    <span>支払日</span>
                    <span />
                  </div>
                  {subPayments.map((p) => {
                    const overdueDays = getOverdueDays(p)
                    const isOverdue = overdueDays > 0
                    return (
                      <div key={p.id} className={`grid grid-cols-[1.5fr_1fr_0.7fr_0.8fr_1fr_0.7fr_0.7fr_2.5rem] gap-x-2 px-4 py-2.5 items-center border-b border-slate-50 hover:bg-blue-50/30 ${isOverdue ? "bg-red-50/30" : ""}`}>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{p.contract.projectName}</p>
                          {p.contract.contractNumber && <p className="text-xs text-slate-600 font-mono">{p.contract.contractNumber}</p>}
                        </div>
                        <div className="text-xs text-slate-600 truncate">{p.contract.companyName}</div>
                        <div>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLE[p.status]}`}>
                            {STATUS_LABEL[p.status]}
                          </span>
                          {isOverdue && (
                            <span className="ml-1 inline-flex items-center gap-0.5 text-xs text-red-600">
                              <AlertTriangle className="w-2.5 h-2.5" />{overdueDays}日
                            </span>
                          )}
                        </div>
                        <div className="text-right font-mono text-sm font-semibold text-slate-800">¥{formatCurrency(p.totalAmount)}</div>
                        <div className="text-xs text-slate-500">{p.closingDate ? formatDate(p.closingDate, "yyyy/MM/dd") : "—"}</div>
                        <div className="text-xs text-slate-500">{p.paymentDueDate ? formatDate(p.paymentDueDate, "MM/dd") : "—"}</div>
                        <div className="text-xs text-slate-500">{p.paymentDate ? formatDate(p.paymentDate, "MM/dd") : "—"}</div>
                        <div className="flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem asChild>
                                <Link href={`/contracts/${p.contractId}`} className="gap-2"><Receipt className="w-4 h-4" />契約詳細</Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {p.status === "PENDING" && (
                                <DropdownMenuItem onClick={() => handleStatusUpdate(p.id, "SCHEDULED")} className="gap-2 text-blue-700">
                                  <Clock className="w-4 h-4" />支払予定にする
                                </DropdownMenuItem>
                              )}
                              {(p.status === "PENDING" || p.status === "SCHEDULED") && (
                                <DropdownMenuItem onClick={() => handleStatusUpdate(p.id, "PAID")} className="gap-2 text-green-700">
                                  <CheckCircle2 className="w-4 h-4" />支払済にする
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDelete(p.id)} className="gap-2 text-red-600">
                                <Trash2 className="w-4 h-4" />削除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 新規支払い登録ダイアログ */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="w-4 h-4" />支払いを登録</DialogTitle>
            <DialogDescription>外注工事の支払い情報を登録します。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>対象契約 <span className="text-red-500">*</span></Label>
              <Select value={newContractId} onValueChange={(v) => { setNewContractId(v); setNewWorkId("") }}>
                <SelectTrigger><SelectValue placeholder="契約を選択" /></SelectTrigger>
                <SelectContent>
                  {contracts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.companyName} / {c.projectName}
                      {c.contractNumber && <span className="text-slate-400 ml-2 text-xs">({c.contractNumber})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedContract && (
              <div className="space-y-1.5">
                <Label>外注工事 <span className="text-red-500">*</span></Label>
                <Select value={newWorkId} onValueChange={setNewWorkId}>
                  <SelectTrigger><SelectValue placeholder="外注工事を選択" /></SelectTrigger>
                  <SelectContent>
                    {selectedContract.works.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.subcontractorName ?? "外注先未設定"} — ¥{formatCurrency(w.orderTotalAmount)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedWork && (
                  <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1 mt-2">
                    <div className="flex justify-between"><span className="text-slate-500">発注金額（税抜）</span><span className="font-mono">¥{formatCurrency(selectedWork.orderAmount)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">消費税</span><span className="font-mono">¥{formatCurrency(selectedWork.orderTaxAmount)}</span></div>
                    <div className="flex justify-between border-t pt-1"><span className="font-medium">合計（税込）</span><span className="font-mono font-bold">¥{formatCurrency(selectedWork.orderTotalAmount)}</span></div>
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>締め日</Label>
                <Input type="date" value={newClosingDate} onChange={(e) => setNewClosingDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>支払期日</Label>
                <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>備考</Label>
              <Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>キャンセル</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />登録中...</> : "登録する"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

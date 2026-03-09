/**
 * [COMPONENT] 経理 - 外注費一覧・入力
 *
 * テーブル表示・フィルター・新規登録ダイアログ（2段階確認）・ステータス変更・合計表示
 */
"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Plus, FileText } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { ExportButton } from "./ExportButton"

interface InvoiceRow {
  id: string
  vendorId: string
  companyId: string
  departmentId: string
  storeId: string | null
  billingYearMonth: string
  amount: number
  closingType: string
  paymentDueDate: string | null
  paymentDate: string | null
  status: string
  pdfUrl: string | null
  note: string | null
  vendor: { id: string; name: string }
  company: { id: string; name: string }
  department: { id: string; name: string }
  store: { id: string; name: string } | null
}

interface Props {
  initialInvoices: InvoiceRow[]
  companies: { id: string; name: string }[]
  departments: { id: string; name: string; company: { id: string; name: string } }[]
  stores: { id: string; name: string; department: { id: string; name: string } }[]
  vendors: { id: string; name: string; closingType: string; companyId: string }[]
}

export function SubcontractorInvoiceList({
  initialInvoices, companies, departments, stores, vendors,
}: Props) {
  const router = useRouter()
  const [invoices, setInvoices] = useState(initialInvoices)
  const [companyFilter, setCompanyFilter] = useState<string>("all")
  const [departmentFilter, setDepartmentFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [yearMonthFilter, setYearMonthFilter] = useState<string>("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmStep, setConfirmStep] = useState(0) // 0=入力, 1=確認

  const [form, setForm] = useState({
    companyId: "",
    vendorId: "",
    departmentId: "",
    storeId: "",
    billingYearMonth: "",
    amount: "",
    closingType: "MONTH_END",
    note: "",
  })

  // フィルター済み一覧
  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (companyFilter !== "all" && inv.companyId !== companyFilter) return false
      if (departmentFilter !== "all" && inv.departmentId !== departmentFilter) return false
      if (statusFilter !== "all" && inv.status !== statusFilter) return false
      if (yearMonthFilter) {
        const ym = new Date(inv.billingYearMonth)
        const filterYm = new Date(yearMonthFilter + "-01")
        if (ym.getFullYear() !== filterYm.getFullYear() || ym.getMonth() !== filterYm.getMonth()) return false
      }
      return true
    })
  }, [invoices, companyFilter, departmentFilter, statusFilter, yearMonthFilter])

  // 合計金額
  const totalAmount = useMemo(() => {
    return filtered.reduce((sum, inv) => sum + inv.amount, 0)
  }, [filtered])

  // 会社フィルターに連動した部門
  const filteredDepartments = useMemo(() => {
    if (companyFilter === "all") return departments
    return departments.filter((d) => d.company.id === companyFilter)
  }, [departments, companyFilter])

  // フォーム用：会社選択に連動
  const formVendors = useMemo(() => {
    if (!form.companyId) return vendors
    return vendors.filter((v) => v.companyId === form.companyId)
  }, [vendors, form.companyId])

  const formDepartments = useMemo(() => {
    if (!form.companyId) return departments
    return departments.filter((d) => d.company.id === form.companyId)
  }, [departments, form.companyId])

  const formStores = useMemo(() => {
    if (!form.departmentId) return stores
    return stores.filter((s) => s.department.id === form.departmentId)
  }, [stores, form.departmentId])

  // 会社名でカラー判定
  function getCompanyColor(name: string) {
    if (name.includes("七色")) return { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200" }
    if (name.includes("南施工")) return { bg: "bg-green-50", text: "text-green-600", border: "border-green-200" }
    return { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" }
  }

  // 取引先選択時に支払区分を自動入力
  function handleVendorChange(vendorId: string) {
    const v = vendors.find((x) => x.id === vendorId)
    setForm({
      ...form,
      vendorId,
      closingType: v?.closingType ?? "MONTH_END",
    })
  }

  async function handleCreate() {
    if (confirmStep === 0) {
      if (!form.companyId || !form.vendorId || !form.departmentId || !form.billingYearMonth || !form.amount) {
        toast.error("必須項目を入力してください")
        return
      }
      setConfirmStep(1)
      return
    }

    // 2段階確認後の登録
    try {
      const res = await fetch("/api/accounting/subcontractor-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: form.companyId,
          vendorId: form.vendorId,
          departmentId: form.departmentId,
          storeId: form.storeId || null,
          billingYearMonth: form.billingYearMonth + "-01",
          amount: parseFloat(form.amount),
          closingType: form.closingType,
          note: form.note || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "登録に失敗しました")
        return
      }
      toast.success("外注費を登録しました")
      setDialogOpen(false)
      setConfirmStep(0)
      setForm({
        companyId: "", vendorId: "", departmentId: "", storeId: "",
        billingYearMonth: "", amount: "", closingType: "MONTH_END", note: "",
      })
      router.refresh()
    } catch {
      toast.error("通信エラーが発生しました")
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    try {
      const res = await fetch(`/api/accounting/subcontractor-invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          paymentDate: newStatus === "PAID" ? new Date().toISOString() : null,
        }),
      })
      if (!res.ok) {
        toast.error("更新に失敗しました")
        return
      }
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === id
            ? { ...inv, status: newStatus, paymentDate: newStatus === "PAID" ? new Date().toISOString() : null }
            : inv
        )
      )
      toast.success(newStatus === "PAID" ? "支払済みに変更しました" : "未払いに変更しました")
    } catch {
      toast.error("通信エラーが発生しました")
    }
  }

  const formatYearMonth = (d: string) => {
    const date = new Date(d)
    return `${date.getFullYear()}年${date.getMonth() + 1}月`
  }

  const formatCurrency = (n: number) => `¥${n.toLocaleString()}`

  const closingTypeLabel = (t: string) => t === "MONTH_END" ? "月末" : "15日"

  // ダイアログ内の選択中会社名
  const selectedCompanyName = companies.find((c) => c.id === form.companyId)?.name ?? ""
  const companyColor = getCompanyColor(selectedCompanyName)

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">外注費管理</h1>
          <p className="text-sm text-slate-500 mt-0.5">{filtered.length}件</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setConfirmStep(0) }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" />
              新規登録
            </Button>
          </DialogTrigger>
          <DialogContent className={cn("max-w-lg", form.companyId && companyColor.bg)}>
            <DialogHeader>
              <DialogTitle>
                {confirmStep === 0 ? "外注費 新規登録" : "登録内容の確認"}
              </DialogTitle>
            </DialogHeader>

            {confirmStep === 0 ? (
              <div className="space-y-4 py-2">
                <div>
                  <Label className="text-xs font-semibold text-red-600">会社区分 *</Label>
                  <Select value={form.companyId} onValueChange={(v) => setForm({ ...form, companyId: v, vendorId: "", departmentId: "", storeId: "" })}>
                    <SelectTrigger><SelectValue placeholder="選択してください" /></SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-red-600">取引先 *</Label>
                  <Select value={form.vendorId} onValueChange={handleVendorChange}>
                    <SelectTrigger><SelectValue placeholder="選択してください" /></SelectTrigger>
                    <SelectContent>
                      {formVendors.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-red-600">部門 *</Label>
                  <Select value={form.departmentId} onValueChange={(v) => setForm({ ...form, departmentId: v, storeId: "" })}>
                    <SelectTrigger><SelectValue placeholder="選択してください" /></SelectTrigger>
                    <SelectContent>
                      {formDepartments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">店舗（任意）</Label>
                  <Select value={form.storeId} onValueChange={(v) => setForm({ ...form, storeId: v })}>
                    <SelectTrigger><SelectValue placeholder="選択（任意）" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">なし</SelectItem>
                      {formStores.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-red-600">請求年月 *</Label>
                    <Input type="month" value={form.billingYearMonth} onChange={(e) => setForm({ ...form, billingYearMonth: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-red-600">金額（税込） *</Label>
                    <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">支払区分</Label>
                  <Select value={form.closingType} onValueChange={(v) => setForm({ ...form, closingType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MONTH_END">月末締め</SelectItem>
                      <SelectItem value="DAY_15">15日締め</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">備考</Label>
                  <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
                  <Button onClick={handleCreate}>確認へ</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-2">
                <div className={cn("rounded-lg border p-4 space-y-2", companyColor.border)}>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-slate-500">会社区分:</span> <span className="font-medium">{selectedCompanyName}</span></div>
                    <div><span className="text-slate-500">取引先:</span> <span className="font-medium">{vendors.find((v) => v.id === form.vendorId)?.name}</span></div>
                    <div><span className="text-slate-500">部門:</span> <span className="font-medium">{departments.find((d) => d.id === form.departmentId)?.name}</span></div>
                    <div><span className="text-slate-500">店舗:</span> <span className="font-medium">{stores.find((s) => s.id === form.storeId)?.name || "なし"}</span></div>
                    <div><span className="text-slate-500">請求年月:</span> <span className="font-medium">{form.billingYearMonth}</span></div>
                    <div><span className="text-slate-500">支払区分:</span> <span className="font-medium">{closingTypeLabel(form.closingType)}</span></div>
                  </div>
                  <div className="pt-2 border-t">
                    <p className="text-lg font-bold text-center">{formatCurrency(parseFloat(form.amount || "0"))}</p>
                  </div>
                  {form.note && <p className="text-xs text-slate-500">備考: {form.note}</p>}
                </div>
                <p className="text-sm text-center text-slate-600 font-medium">上記の内容で登録してよろしいですか？</p>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setConfirmStep(0)}>戻る</Button>
                  <Button onClick={handleCreate}>登録する</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* フィルター */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={companyFilter} onValueChange={(v) => { setCompanyFilter(v); setDepartmentFilter("all") }}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="会社区分" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全て</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="部門" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全て</SelectItem>
            {filteredDepartments.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="ステータス" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全て</SelectItem>
            <SelectItem value="PENDING">未払い</SelectItem>
            <SelectItem value="PAID">支払済</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="month"
          value={yearMonthFilter}
          onChange={(e) => setYearMonthFilter(e.target.value)}
          className="w-full sm:w-44"
          placeholder="年月で絞り込み"
        />
      </div>

      {/* CSV出力ボタン */}
      <div className="flex justify-end">
        <ExportButton yearMonth={yearMonthFilter} companyId={companyFilter} />
      </div>

      {/* テーブル */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="font-semibold">取引先</TableHead>
              <TableHead className="font-semibold hidden sm:table-cell">会社</TableHead>
              <TableHead className="font-semibold hidden md:table-cell">部門</TableHead>
              <TableHead className="font-semibold">請求年月</TableHead>
              <TableHead className="font-semibold text-right">金額</TableHead>
              <TableHead className="font-semibold hidden sm:table-cell">締め</TableHead>
              <TableHead className="font-semibold">ステータス</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  データがありません
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((inv) => {
                const color = getCompanyColor(inv.company.name)
                return (
                  <TableRow key={inv.id} className={cn("transition-colors", color.bg)}>
                    <TableCell>
                      <p className="font-medium text-slate-800">{inv.vendor.name}</p>
                      <p className="text-xs text-slate-400 sm:hidden">{inv.company.name}</p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className={cn("text-xs", color.text, color.border)}>{inv.company.name}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-slate-600">{inv.department.name}</TableCell>
                    <TableCell className="text-sm">{formatYearMonth(inv.billingYearMonth)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(inv.amount)}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-slate-500">{closingTypeLabel(inv.closingType)}</TableCell>
                    <TableCell>
                      <Select
                        value={inv.status}
                        onValueChange={(v) => handleStatusChange(inv.id, v)}
                      >
                        <SelectTrigger className={cn(
                          "h-7 w-24 text-xs border-0",
                          inv.status === "PAID"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        )}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PENDING">未払い</SelectItem>
                          <SelectItem value="PAID">支払済</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* 合計金額 */}
      {filtered.length > 0 && (
        <div className="flex justify-end">
          <div className="rounded-lg border bg-white px-6 py-3 shadow-sm">
            <p className="text-xs text-slate-500">合計金額</p>
            <p className="text-xl font-bold text-slate-800">{formatCurrency(totalAmount)}</p>
          </div>
        </div>
      )}
    </div>
  )
}

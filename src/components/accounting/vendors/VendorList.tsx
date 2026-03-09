/**
 * [COMPONENT] 経理 - 取引先一覧
 *
 * テーブル表示・検索・フィルター・新規登録ダイアログ
 */
"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, Search } from "lucide-react"
import { toast } from "sonner"

interface VendorRow {
  id: string
  name: string
  furigana: string | null
  phone: string | null
  closingType: string
  hasInvoiceRegistration: boolean
  isActive: boolean
  isSuspended: boolean
  companyId: string
  company: { id: string; name: string }
  departments: { department: { id: string; name: string } }[]
}

interface Props {
  initialVendors: VendorRow[]
  companies: { id: string; name: string }[]
  departments: { id: string; name: string; company: { id: string; name: string } }[]
}

export function VendorList({ initialVendors, companies, departments }: Props) {
  const router = useRouter()
  const [vendors, setVendors] = useState(initialVendors)
  const [search, setSearch] = useState("")
  const [companyFilter, setCompanyFilter] = useState<string>("all")
  const [departmentFilter, setDepartmentFilter] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)

  // 新規登録フォーム
  const [form, setForm] = useState({
    name: "",
    companyId: "",
    closingType: "MONTH_END",
    furigana: "",
    representativeName: "",
    phone: "",
    email: "",
    address: "",
    bankName: "",
    branchName: "",
    accountType: "",
    accountNumber: "",
    accountHolder: "",
    hasInvoiceRegistration: false,
    invoiceNumber: "",
  })

  // フィルター済み一覧
  const filtered = useMemo(() => {
    return vendors.filter((v) => {
      if (search) {
        const q = search.toLowerCase()
        if (!v.name.toLowerCase().includes(q) && !(v.furigana?.toLowerCase().includes(q))) return false
      }
      if (companyFilter !== "all" && v.companyId !== companyFilter) return false
      if (departmentFilter !== "all") {
        if (!v.departments.some((d) => d.department.id === departmentFilter)) return false
      }
      return true
    })
  }, [vendors, search, companyFilter, departmentFilter])

  // 部門フィルター（会社でさらに絞り込み）
  const filteredDepartments = useMemo(() => {
    if (companyFilter === "all") return departments
    return departments.filter((d) => d.company.id === companyFilter)
  }, [departments, companyFilter])

  async function handleCreate() {
    if (!form.name || !form.companyId) {
      toast.error("会社名と会社区分は必須です")
      return
    }
    try {
      const res = await fetch("/api/accounting/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          accountType: form.accountType || null,
          hasInvoiceRegistration: form.hasInvoiceRegistration,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "登録に失敗しました")
        return
      }
      toast.success("取引先を登録しました")
      setDialogOpen(false)
      setForm({
        name: "", companyId: "", closingType: "MONTH_END", furigana: "",
        representativeName: "", phone: "", email: "", address: "",
        bankName: "", branchName: "", accountType: "", accountNumber: "",
        accountHolder: "", hasInvoiceRegistration: false, invoiceNumber: "",
      })
      router.refresh()
    } catch {
      toast.error("通信エラーが発生しました")
    }
  }

  const closingTypeLabel = (t: string) => t === "MONTH_END" ? "月末締め" : "15日締め"

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">取引先管理</h1>
          <p className="text-sm text-slate-500 mt-0.5">{filtered.length}件の取引先</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" />
              新規登録
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>取引先 新規登録</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* 必須項目 */}
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-semibold text-red-600">会社名 *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例: ○○建設株式会社" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-red-600">会社区分 *</Label>
                  <Select value={form.companyId} onValueChange={(v) => setForm({ ...form, companyId: v })}>
                    <SelectTrigger><SelectValue placeholder="選択してください" /></SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold">支払区分</Label>
                  <Select value={form.closingType} onValueChange={(v) => setForm({ ...form, closingType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MONTH_END">月末締め</SelectItem>
                      <SelectItem value="DAY_15">15日締め</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 任意項目 */}
              <div className="border-t pt-3 space-y-3">
                <p className="text-xs font-semibold text-slate-500">任意項目</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">ふりがな</Label>
                    <Input value={form.furigana} onChange={(e) => setForm({ ...form, furigana: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">代表者名</Label>
                    <Input value={form.representativeName} onChange={(e) => setForm({ ...form, representativeName: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">電話番号</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">メール</Label>
                    <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">住所</Label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">銀行名</Label>
                    <Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">支店名</Label>
                    <Input value={form.branchName} onChange={(e) => setForm({ ...form, branchName: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">口座種別</Label>
                    <Select value={form.accountType} onValueChange={(v) => setForm({ ...form, accountType: v })}>
                      <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ORDINARY">普通</SelectItem>
                        <SelectItem value="CURRENT">当座</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">口座番号</Label>
                    <Input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">口座名義</Label>
                    <Input value={form.accountHolder} onChange={(e) => setForm({ ...form, accountHolder: e.target.value })} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.hasInvoiceRegistration}
                      onChange={(e) => setForm({ ...form, hasInvoiceRegistration: e.target.checked })}
                      className="rounded border-slate-300"
                    />
                    インボイス登録あり
                  </label>
                </div>
                {form.hasInvoiceRegistration && (
                  <div>
                    <Label className="text-xs">インボイス番号</Label>
                    <Input value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} placeholder="T1234567890123" />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
                <Button onClick={handleCreate}>登録</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* フィルター */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="会社名・ふりがなで検索..."
            className="pl-9"
          />
        </div>
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
      </div>

      {/* テーブル */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="font-semibold">会社名</TableHead>
              <TableHead className="font-semibold hidden sm:table-cell">ふりがな</TableHead>
              <TableHead className="font-semibold hidden md:table-cell">電話</TableHead>
              <TableHead className="font-semibold">支払区分</TableHead>
              <TableHead className="font-semibold hidden sm:table-cell">インボイス</TableHead>
              <TableHead className="font-semibold">ステータス</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                  取引先が見つかりません
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((v) => (
                <TableRow
                  key={v.id}
                  className="cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => router.push(`/accounting/vendors/${v.id}`)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium text-slate-800">{v.name}</p>
                      <p className="text-xs text-slate-400">{v.company.name}</p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-slate-500 text-sm">{v.furigana || "-"}</TableCell>
                  <TableCell className="hidden md:table-cell text-slate-500 text-sm">{v.phone || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{closingTypeLabel(v.closingType)}</Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {v.hasInvoiceRegistration ? (
                      <Badge className="bg-green-100 text-green-700 text-xs">登録済</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-slate-400">未登録</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {v.isSuspended ? (
                      <Badge className="bg-red-100 text-red-700 text-xs">停止中</Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-700 text-xs">有効</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

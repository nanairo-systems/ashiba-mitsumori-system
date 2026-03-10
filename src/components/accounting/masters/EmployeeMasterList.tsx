/**
 * [COMPONENT] 経理 - 社員マスタ管理
 *
 * 社員一覧テーブル・新規登録・編集・無効化・削除
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
import { Plus, Pencil, Ban, RotateCcw, Loader2, Trash2, AlertTriangle, Search } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { CompanyRow, DepartmentRow, StoreRow } from "./MasterTabs"

export interface EmployeeRow {
  id: string
  name: string
  departmentId: string | null
  storeId: string | null
  phone: string | null
  email: string | null
  position: string | null
  note: string | null
  isActive: boolean
  department: {
    id: string
    name: string
    company: { id: string; name: string; colorCode: string | null }
  } | null
  store: { id: string; name: string } | null
}

interface Props {
  initialEmployees: EmployeeRow[]
  companies: CompanyRow[]
  departments: DepartmentRow[]
  stores: StoreRow[]
  userRole: "ADMIN" | "STAFF" | "DEVELOPER"
}

export function EmployeeMasterList({
  initialEmployees,
  companies,
  departments,
  stores,
  userRole,
}: Props) {
  const router = useRouter()
  const [employees, setEmployees] = useState(initialEmployees)
  const [companyFilter, setCompanyFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<EmployeeRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<EmployeeRow | null>(null)
  const [deleteConfirmName, setDeleteConfirmName] = useState("")
  const [deleteLoading, setDeleteLoading] = useState(false)
  const isDeveloper = userRole === "DEVELOPER"

  const [form, setForm] = useState({
    name: "",
    departmentId: "",
    storeId: "",
    phone: "",
    email: "",
    position: "",
    note: "",
  })

  // 会社フィルター連動の部門リスト
  const filteredDepartments = useMemo(() => {
    if (companyFilter === "all") return departments
    return departments.filter((d) => d.companyId === companyFilter)
  }, [departments, companyFilter])

  // フォーム用: 選択中の部門に連動した店舗リスト
  const formStores = useMemo(() => {
    if (!form.departmentId) return []
    return stores.filter((s) => s.departmentId === form.departmentId)
  }, [stores, form.departmentId])

  // フィルター済み社員
  const filtered = useMemo(() => {
    return employees.filter((e) => {
      if (companyFilter !== "all") {
        if (!e.department || e.department.company.id !== companyFilter) return false
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const match =
          e.name.toLowerCase().includes(q) ||
          (e.position?.toLowerCase().includes(q)) ||
          (e.phone?.includes(q)) ||
          (e.email?.toLowerCase().includes(q))
        if (!match) return false
      }
      return true
    })
  }, [employees, companyFilter, searchQuery])

  function openCreate() {
    setEditTarget(null)
    setForm({ name: "", departmentId: "", storeId: "", phone: "", email: "", position: "", note: "" })
    setDialogOpen(true)
  }

  function openEdit(emp: EmployeeRow) {
    setEditTarget(emp)
    setForm({
      name: emp.name,
      departmentId: emp.departmentId ?? "",
      storeId: emp.storeId ?? "",
      phone: emp.phone ?? "",
      email: emp.email ?? "",
      position: emp.position ?? "",
      note: emp.note ?? "",
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("氏名は必須です")
      return
    }

    setLoading(true)
    try {
      const payload = {
        name: form.name.trim(),
        departmentId: form.departmentId || null,
        storeId: form.storeId || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        position: form.position.trim() || null,
        note: form.note.trim() || undefined,
      }

      if (editTarget) {
        const res = await fetch(`/api/accounting/employees/${editTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const err = await res.json()
          toast.error(err.error || "更新に失敗しました")
          return
        }
        const updated = await res.json()
        setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
        toast.success("社員情報を更新しました")
      } else {
        const res = await fetch("/api/accounting/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const err = await res.json()
          toast.error(err.error || "登録に失敗しました")
          return
        }
        const created = await res.json()
        setEmployees((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
        toast.success("社員を登録しました")
      }
      setDialogOpen(false)
    } catch {
      toast.error("通信エラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleActive(emp: EmployeeRow) {
    try {
      const res = await fetch(`/api/accounting/employees/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !emp.isActive }),
      })
      if (!res.ok) {
        toast.error("更新に失敗しました")
        return
      }
      setEmployees((prev) =>
        prev.map((e) => (e.id === emp.id ? { ...e, isActive: !emp.isActive } : e))
      )
      toast.success(emp.isActive ? "無効化しました" : "有効化しました")
    } catch {
      toast.error("通信エラーが発生しました")
    }
  }

  async function handleDelete() {
    if (!deleteTarget || deleteConfirmName !== deleteTarget.name) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/accounting/employees/${deleteTarget.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "削除に失敗しました")
        return
      }
      setEmployees((prev) => prev.filter((e) => e.id !== deleteTarget.id))
      toast.success(`「${deleteTarget.name}」を削除しました`)
      setDeleteTarget(null)
      setDeleteConfirmName("")
    } catch {
      toast.error("通信エラーが発生しました")
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* 削除確認ダイアログ */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteConfirmName("") } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              社員の完全削除
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
              <p className="text-sm font-bold text-red-700">この操作は取り消せません</p>
              <p className="text-sm text-red-600">
                「<strong>{deleteTarget?.name}</strong>」を完全に削除します。
              </p>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600">
                確認のため社員名「{deleteTarget?.name}」を入力してください
              </Label>
              <Input
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder={deleteTarget?.name}
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteConfirmName("") }}>
                キャンセル
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteLoading || deleteConfirmName !== deleteTarget?.name}
              >
                {deleteLoading && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                完全に削除する
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* フィルター */}
      <div className="flex items-center gap-3 flex-wrap">
        <Label className="text-sm font-medium whitespace-nowrap">会社</Label>
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="会社を選択" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全て</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <div className="flex items-center gap-2">
                  {c.colorCode && (
                    <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: c.colorCode }} />
                  )}
                  {c.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="名前・役職・電話で検索"
            className="pl-8 w-56"
          />
        </div>
      </div>

      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{filtered.length}件</p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5" onClick={openCreate}>
              <Plus className="w-4 h-4" />
              新規登録
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editTarget ? "社員情報の編集" : "社員の新規登録"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <Label className="text-xs font-semibold text-red-600">氏名 *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="例：田中太郎"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">部門</Label>
                  <Select
                    value={form.departmentId || "none"}
                    onValueChange={(v) => setForm({ ...form, departmentId: v === "none" ? "" : v, storeId: "" })}
                  >
                    <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">未設定</SelectItem>
                      {filteredDepartments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                          <span className="text-xs text-slate-400 ml-1">({d.company.name})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">店舗</Label>
                  <Select
                    value={form.storeId || "none"}
                    onValueChange={(v) => setForm({ ...form, storeId: v === "none" ? "" : v })}
                    disabled={!form.departmentId}
                  >
                    <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">未設定</SelectItem>
                      {formStores.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">役職</Label>
                <Input
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                  placeholder="例：主任"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">電話番号</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="090-1234-5678"
                  />
                </div>
                <div>
                  <Label className="text-xs">メール</Label>
                  <Input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="example@test.com"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">備考</Label>
                <Input
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="メモ"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
                <Button onClick={handleSave} disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  {editTarget ? "更新" : "登録"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* テーブル */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="font-semibold">氏名</TableHead>
              <TableHead className="font-semibold hidden sm:table-cell">役職</TableHead>
              <TableHead className="font-semibold hidden sm:table-cell">会社 / 部門</TableHead>
              <TableHead className="font-semibold hidden md:table-cell">店舗</TableHead>
              <TableHead className="font-semibold hidden md:table-cell">電話</TableHead>
              <TableHead className="font-semibold text-center">状態</TableHead>
              <TableHead className="font-semibold text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                  社員が登録されていません
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((emp) => (
                <TableRow key={emp.id} className={cn(!emp.isActive && "opacity-50 bg-slate-50")}>
                  <TableCell className="font-medium">{emp.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-slate-600">
                    {emp.position || "-"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {emp.department ? (
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={
                            emp.department.company.colorCode
                              ? { color: emp.department.company.colorCode, borderColor: emp.department.company.colorCode }
                              : undefined
                          }
                        >
                          {emp.department.company.name}
                        </Badge>
                        <span className="text-xs text-slate-500">{emp.department.name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">未設定</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-slate-600">
                    {emp.store?.name || "-"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-slate-600">
                    {emp.phone || "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={emp.isActive ? "default" : "secondary"}
                      className={cn(
                        "text-xs",
                        emp.isActive
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                          : "bg-slate-200 text-slate-500"
                      )}
                    >
                      {emp.isActive ? "有効" : "無効"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(emp)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-7 w-7 p-0",
                          emp.isActive ? "text-red-500 hover:text-red-600" : "text-emerald-500 hover:text-emerald-600"
                        )}
                        onClick={() => handleToggleActive(emp)}
                      >
                        {emp.isActive ? <Ban className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                      </Button>
                      {isDeveloper && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteTarget(emp)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
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

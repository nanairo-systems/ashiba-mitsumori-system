/**
 * [COMPONENT] 労務・人事システム - 社員一覧（簡略版）
 *
 * 表示: 氏名(詳細リンク) / 社員番号 / 部署 / 雇用形態 / 入社日 / ステータス
 * 編集: 詳細ページへ委譲
 */
"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, Ban, RotateCcw, Loader2, Search, Users, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/utils"

export const EMPLOYMENT_TYPES = [
  { value: "FULL_TIME", label: "正社員" },
  { value: "PART_TIME", label: "パート・アルバイト" },
  { value: "CONTRACT", label: "契約社員" },
  { value: "TEMPORARY", label: "派遣社員" },
  { value: "OTHER", label: "その他" },
]

export function getEmploymentLabel(v: string | null) {
  return EMPLOYMENT_TYPES.find((t) => t.value === v)?.label ?? v ?? "-"
}

export interface EmployeeRow {
  id: string
  name: string
  nameKana: string | null
  employeeNumber: string | null
  hireDate: string | null
  employmentType: string | null
  isActive: boolean
  position: string | null
  departmentId: string | null
  department: {
    id: string
    name: string
    company: { id: string; name: string; colorCode: string | null }
  } | null
  store: { id: string; name: string } | null
}

interface CompanyRow { id: string; name: string; colorCode: string | null }
interface DepartmentRow { id: string; name: string; companyId: string; company: { name: string } }

interface Props {
  initialEmployees: EmployeeRow[]
  companies: CompanyRow[]
  departments: DepartmentRow[]
  stores: { id: string; name: string; departmentId: string }[]
}

export function EmployeeList({ initialEmployees, companies, departments, stores }: Props) {
  const [employees, setEmployees] = useState(initialEmployees)
  const [companyFilter, setCompanyFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("active")
  const [searchQuery, setSearchQuery] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: "", nameKana: "", employeeNumber: "", hireDate: "",
    employmentType: "FULL_TIME", departmentId: "", position: "",
  })

  const filteredDepts = useMemo(() => {
    if (companyFilter === "all") return departments
    return departments.filter((d) => d.companyId === companyFilter)
  }, [departments, companyFilter])

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      if (companyFilter !== "all" && (!e.department || e.department.company.id !== companyFilter)) return false
      if (typeFilter !== "all" && e.employmentType !== typeFilter) return false
      if (statusFilter === "active" && !e.isActive) return false
      if (statusFilter === "inactive" && e.isActive) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const hit = e.name.toLowerCase().includes(q) ||
          (e.nameKana?.toLowerCase().includes(q) ?? false) ||
          (e.employeeNumber?.toLowerCase().includes(q) ?? false) ||
          (e.position?.toLowerCase().includes(q) ?? false)
        if (!hit) return false
      }
      return true
    })
  }, [employees, companyFilter, typeFilter, statusFilter, searchQuery])

  function resetForm() {
    setForm({ name: "", nameKana: "", employeeNumber: "", hireDate: "", employmentType: "FULL_TIME", departmentId: "", position: "" })
  }

  async function handleCreate() {
    if (!form.name.trim()) { toast.error("氏名は必須です"); return }
    setLoading(true)
    try {
      const res = await fetch("/api/labor/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          nameKana: form.nameKana.trim() || null,
          employeeNumber: form.employeeNumber.trim() || null,
          hireDate: form.hireDate || null,
          employmentType: form.employmentType || null,
          departmentId: form.departmentId || null,
          position: form.position.trim() || null,
        }),
      })
      if (!res.ok) { toast.error("登録に失敗しました"); return }
      const created = await res.json()
      setEmployees((prev) => [...prev, created].sort((a, b) =>
        (a.employeeNumber ?? "zzz").localeCompare(b.employeeNumber ?? "zzz") || a.name.localeCompare(b.name, "ja")
      ))
      toast.success("社員を登録しました")
      setCreateOpen(false)
      resetForm()
    } catch {
      toast.error("通信エラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleActive(emp: EmployeeRow) {
    try {
      const res = await fetch(`/api/labor/employees/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !emp.isActive }),
      })
      if (!res.ok) { toast.error("更新に失敗しました"); return }
      setEmployees((prev) => prev.map((e) => e.id === emp.id ? { ...e, isActive: !emp.isActive } : e))
      toast.success(emp.isActive ? "退職処理しました" : "在籍に戻しました")
    } catch {
      toast.error("通信エラーが発生しました")
    }
  }

  const activeCount = employees.filter((e) => e.isActive).length
  const inactiveCount = employees.filter((e) => !e.isActive).length

  return (
    <div className="space-y-4">
      {/* サマリー */}
      <div className="flex gap-3">
        <div className="flex items-center gap-2 bg-violet-50 border border-violet-100 rounded-lg px-4 py-2.5">
          <Users className="w-4 h-4 text-violet-500" />
          <span className="text-sm font-semibold text-violet-700">在籍</span>
          <span className="text-2xl font-bold text-violet-700">{activeCount}</span>
          <span className="text-xs text-violet-500">名</span>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5">
          <Ban className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-500">退職</span>
          <span className="text-2xl font-bold text-slate-500">{inactiveCount}</span>
          <span className="text-xs text-slate-400">名</span>
        </div>
      </div>

      {/* フィルター */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="会社" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全会社</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <div className="flex items-center gap-1.5">
                  {c.colorCode && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.colorCode }} />}
                  {c.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="雇用形態" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全雇用形態</SelectItem>
            {EMPLOYMENT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全員</SelectItem>
            <SelectItem value="active">在籍中</SelectItem>
            <SelectItem value="inactive">退職</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="氏名・社員番号で検索" className="pl-8" />
        </div>

        <div className="ml-auto">
          <Button size="sm" className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
            onClick={() => { resetForm(); setCreateOpen(true) }}>
            <Plus className="w-4 h-4" />社員登録
          </Button>
        </div>
      </div>

      <p className="text-xs text-slate-400">{filtered.length}件表示</p>

      {/* テーブル */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead className="pl-4 font-semibold text-slate-600">氏名</TableHead>
              <TableHead className="font-semibold text-slate-600 hidden sm:table-cell">社員番号</TableHead>
              <TableHead className="font-semibold text-slate-600 hidden md:table-cell">部署</TableHead>
              <TableHead className="font-semibold text-slate-600 hidden lg:table-cell">雇用形態</TableHead>
              <TableHead className="font-semibold text-slate-600 hidden lg:table-cell">入社日</TableHead>
              <TableHead className="font-semibold text-slate-600 text-center">状態</TableHead>
              <TableHead className="font-semibold text-slate-600 text-right pr-4">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                  <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p>該当する社員が見つかりません</p>
                </TableCell>
              </TableRow>
            ) : filtered.map((emp) => (
              <TableRow key={emp.id} className={cn("hover:bg-slate-50 transition-colors", !emp.isActive && "opacity-50 bg-slate-50/50")}>
                <TableCell className="pl-4">
                  <Link href={`/labor/employees/${emp.id}`} className="group flex items-center gap-1.5">
                    <div>
                      <div className="font-medium text-slate-800 group-hover:text-violet-600 transition-colors">
                        {emp.name}
                      </div>
                      {emp.nameKana && <div className="text-xs text-slate-400">{emp.nameKana}</div>}
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-violet-400 transition-colors flex-shrink-0" />
                  </Link>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-sm text-slate-500 font-mono">
                  {emp.employeeNumber || <span className="text-slate-300">-</span>}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {emp.department ? (
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-xs font-normal"
                        style={emp.department.company.colorCode
                          ? { color: emp.department.company.colorCode, borderColor: emp.department.company.colorCode }
                          : undefined}>
                        {emp.department.company.name}
                      </Badge>
                      <span className="text-xs text-slate-500">{emp.department.name}</span>
                    </div>
                  ) : <span className="text-slate-300 text-xs">-</span>}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <Badge variant="secondary" className="text-xs font-normal bg-slate-100 text-slate-600">
                    {getEmploymentLabel(emp.employmentType)}
                  </Badge>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-slate-500">
                  {emp.hireDate ? formatDate(new Date(emp.hireDate), "yyyy/MM/dd") : <span className="text-slate-300">-</span>}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className={cn("text-xs",
                    emp.isActive ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-slate-100 text-slate-400 border-slate-200")}>
                    {emp.isActive ? "在籍" : "退職"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right pr-4">
                  <div className="flex justify-end gap-1 items-center">
                    <Link href={`/labor/employees/${emp.id}`}>
                      <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-violet-600 hover:bg-violet-50">
                        詳細
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm"
                      className={cn("h-7 w-7 p-0", emp.isActive
                        ? "text-slate-400 hover:text-red-500 hover:bg-red-50"
                        : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50")}
                      onClick={() => handleToggleActive(emp)}
                      title={emp.isActive ? "退職処理" : "在籍に戻す"}>
                      {emp.isActive ? <Ban className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* 新規登録ダイアログ */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-violet-600" />社員の新規登録
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">氏名 <span className="text-red-500">*</span></Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="田中太郎" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold">フリガナ</Label>
                <Input value={form.nameKana} onChange={(e) => setForm({ ...form, nameKana: e.target.value })}
                  placeholder="タナカタロウ" className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">社員番号</Label>
                <Input value={form.employeeNumber} onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })}
                  placeholder="EMP001" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold">入社日</Label>
                <Input type="date" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
                  className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold">雇用形態</Label>
              <Select value={form.employmentType} onValueChange={(v) => setForm({ ...form, employmentType: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">部門</Label>
                <Select value={form.departmentId || "none"}
                  onValueChange={(v) => setForm({ ...form, departmentId: v === "none" ? "" : v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="選択" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">未設定</SelectItem>
                    {filteredDepts.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}<span className="text-xs text-slate-400 ml-1">({d.company.name})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold">役職</Label>
                <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })}
                  placeholder="例：職長" className="mt-1" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>キャンセル</Button>
              <Button onClick={handleCreate} disabled={loading}
                className="bg-violet-600 hover:bg-violet-700 text-white">
                {loading && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}登録
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

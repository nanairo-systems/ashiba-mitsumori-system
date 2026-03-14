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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Ban, RotateCcw, Search, Users, ChevronRight, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { cn, formatDate } from "@/lib/utils"

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
          <Link href="/masters">
            <Button size="sm" variant="outline" className="gap-1.5 text-violet-600 border-violet-200 hover:bg-violet-50">
              <ExternalLink className="w-4 h-4" />新規登録はマスター管理へ
            </Button>
          </Link>
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

    </div>
  )
}

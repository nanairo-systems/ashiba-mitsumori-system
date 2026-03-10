/**
 * [COMPONENT] 経理 - 部門マスタ管理
 *
 * 会社選択→部門一覧テーブル・新規登録・編集・無効化・初期データ一括登録
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
import { Plus, Pencil, Ban, RotateCcw, Database, Loader2, Trash2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { CompanyRow, DepartmentRow } from "./MasterTabs"

interface Props {
  initialDepartments: DepartmentRow[]
  companies: CompanyRow[]
  userRole: "ADMIN" | "STAFF" | "DEVELOPER"
}

export function DepartmentMasterList({ initialDepartments, companies, userRole }: Props) {
  const router = useRouter()
  const [departments, setDepartments] = useState(initialDepartments)
  const [companyFilter, setCompanyFilter] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<DepartmentRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [seedLoading, setSeedLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DepartmentRow | null>(null)
  const [deleteConfirmName, setDeleteConfirmName] = useState("")
  const [deleteLoading, setDeleteLoading] = useState(false)
  const isDeveloper = userRole === "DEVELOPER"

  const [form, setForm] = useState({
    companyId: "",
    name: "",
    sortOrder: "0",
  })

  const filtered = useMemo(() => {
    if (companyFilter === "all") return departments
    return departments.filter((d) => d.companyId === companyFilter)
  }, [departments, companyFilter])

  function openCreate() {
    setEditTarget(null)
    setForm({
      companyId: companyFilter !== "all" ? companyFilter : "",
      name: "",
      sortOrder: "0",
    })
    setDialogOpen(true)
  }

  function openEdit(dept: DepartmentRow) {
    setEditTarget(dept)
    setForm({
      companyId: dept.companyId,
      name: dept.name,
      sortOrder: String(dept.sortOrder),
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("部門名は必須です")
      return
    }

    setLoading(true)
    try {
      if (editTarget) {
        const res = await fetch(`/api/accounting/departments/${editTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            sortOrder: parseInt(form.sortOrder) || 0,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          toast.error(err.error || "更新に失敗しました")
          return
        }
        const updated = await res.json()
        setDepartments((prev) =>
          prev.map((d) =>
            d.id === updated.id
              ? { ...d, name: updated.name, sortOrder: updated.sortOrder }
              : d
          )
        )
        toast.success("部門情報を更新しました")
      } else {
        if (!form.companyId) {
          toast.error("会社を選択してください")
          setLoading(false)
          return
        }
        const res = await fetch("/api/accounting/departments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: form.companyId,
            name: form.name.trim(),
            sortOrder: parseInt(form.sortOrder) || 0,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          toast.error(err.error || "登録に失敗しました")
          return
        }
        toast.success("部門を登録しました")
        router.refresh()
      }
      setDialogOpen(false)
    } catch {
      toast.error("通信エラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleActive(dept: DepartmentRow) {
    try {
      const res = await fetch(`/api/accounting/departments/${dept.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !dept.isActive }),
      })
      if (!res.ok) {
        toast.error("更新に失敗しました")
        return
      }
      setDepartments((prev) =>
        prev.map((d) =>
          d.id === dept.id ? { ...d, isActive: !dept.isActive } : d
        )
      )
      toast.success(dept.isActive ? "無効化しました" : "有効化しました")
    } catch {
      toast.error("通信エラーが発生しました")
    }
  }

  async function handleSeedData() {
    if (companyFilter === "all") {
      toast.error("初期データを登録する会社を選択してください")
      return
    }
    setSeedLoading(true)
    try {
      const seeds = [
        { name: "塗装", sortOrder: 1 },
        { name: "リフォーム", sortOrder: 2 },
        { name: "足場", sortOrder: 3 },
        { name: "足場買取販売", sortOrder: 4 },
        { name: "本部経費", sortOrder: 5 },
      ]
      for (const seed of seeds) {
        const exists = departments.find(
          (d) => d.name === seed.name && d.companyId === companyFilter
        )
        if (exists) continue
        const res = await fetch("/api/accounting/departments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId: companyFilter, ...seed }),
        })
        if (!res.ok) {
          const err = await res.json()
          toast.error(`${seed.name}の登録に失敗: ${err.error}`)
          return
        }
      }
      toast.success("初期データを登録しました")
      router.refresh()
    } catch {
      toast.error("通信エラーが発生しました")
    } finally {
      setSeedLoading(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget || deleteConfirmName !== deleteTarget.name) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/accounting/departments/${deleteTarget.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || "削除に失敗しました")
        return
      }
      setDepartments((prev) => prev.filter((d) => d.id !== deleteTarget.id))
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
              部門の完全削除
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
              <p className="text-sm font-bold text-red-700">この操作は取り消せません</p>
              <p className="text-sm text-red-600">
                「<strong>{deleteTarget?.name}</strong>」（{deleteTarget?.company.name}）を完全に削除します。
                関連する店舗がある場合は先にそちらを削除してください。
              </p>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600">
                確認のため部門名「{deleteTarget?.name}」を入力してください
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

      {/* 会社選択 */}
      <div className="flex items-center gap-3">
        <Label className="text-sm font-medium whitespace-nowrap">
          会社選択
        </Label>
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="会社を選択" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全て</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <div className="flex items-center gap-2">
                  {c.colorCode && (
                    <span
                      className="inline-block w-3 h-3 rounded-full"
                      style={{ backgroundColor: c.colorCode }}
                    />
                  )}
                  {c.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{filtered.length}件</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={handleSeedData}
            disabled={seedLoading || companyFilter === "all"}
          >
            {seedLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Database className="w-3.5 h-3.5" />
            )}
            初期データ登録
          </Button>
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
                  {editTarget ? "部門情報の編集" : "部門の新規登録"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {!editTarget && (
                  <div>
                    <Label className="text-xs font-semibold text-red-600">
                      会社 *
                    </Label>
                    <Select
                      value={form.companyId}
                      onValueChange={(v) =>
                        setForm({ ...form, companyId: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label className="text-xs font-semibold text-red-600">
                    部門名 *
                  </Label>
                  <Input
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    placeholder="例：塗装"
                  />
                </div>
                <div>
                  <Label className="text-xs">表示順</Label>
                  <Input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) =>
                      setForm({ ...form, sortOrder: e.target.value })
                    }
                    placeholder="0"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    キャンセル
                  </Button>
                  <Button onClick={handleSave} disabled={loading}>
                    {loading && (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    )}
                    {editTarget ? "更新" : "登録"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* テーブル */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="font-semibold">部門名</TableHead>
              <TableHead className="font-semibold hidden sm:table-cell">
                会社
              </TableHead>
              <TableHead className="font-semibold text-center">
                表示順
              </TableHead>
              <TableHead className="font-semibold text-center">
                状態
              </TableHead>
              <TableHead className="font-semibold text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-8 text-slate-400"
                >
                  {companyFilter === "all"
                    ? "会社を選択してください"
                    : "データがありません"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((d) => {
                const companyColor = companies.find(
                  (c) => c.id === d.companyId
                )?.colorCode
                return (
                  <TableRow
                    key={d.id}
                    className={cn(!d.isActive && "opacity-50 bg-slate-50")}
                  >
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge
                        variant="outline"
                        className="text-xs"
                        style={
                          companyColor
                            ? { color: companyColor, borderColor: companyColor }
                            : undefined
                        }
                      >
                        {d.company.name}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{d.sortOrder}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={d.isActive ? "default" : "secondary"}
                        className={cn(
                          "text-xs",
                          d.isActive
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                            : "bg-slate-200 text-slate-500"
                        )}
                      >
                        {d.isActive ? "有効" : "無効"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => openEdit(d)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "h-7 w-7 p-0",
                            d.isActive
                              ? "text-red-500 hover:text-red-600"
                              : "text-emerald-500 hover:text-emerald-600"
                          )}
                          onClick={() => handleToggleActive(d)}
                        >
                          {d.isActive ? (
                            <Ban className="w-3.5 h-3.5" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                        </Button>
                        {isDeveloper && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => setDeleteTarget(d)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

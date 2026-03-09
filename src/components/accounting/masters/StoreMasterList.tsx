/**
 * [COMPONENT] 経理 - 店舗マスタ管理
 *
 * 会社選択→部門選択→店舗一覧テーブル・新規登録・編集・無効化・初期データ一括登録
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
import { Plus, Pencil, Ban, RotateCcw, Database, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { CompanyRow, DepartmentRow, StoreRow } from "./MasterTabs"

interface Props {
  initialStores: StoreRow[]
  companies: CompanyRow[]
  departments: DepartmentRow[]
}

export function StoreMasterList({
  initialStores,
  companies,
  departments,
}: Props) {
  const router = useRouter()
  const [stores, setStores] = useState(initialStores)
  const [companyFilter, setCompanyFilter] = useState<string>("all")
  const [departmentFilter, setDepartmentFilter] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<StoreRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [seedLoading, setSeedLoading] = useState(false)

  const [form, setForm] = useState({
    departmentId: "",
    name: "",
    sortOrder: "0",
  })

  // 会社に連動した部門リスト
  const filteredDepartments = useMemo(() => {
    if (companyFilter === "all") return departments
    return departments.filter((d) => d.companyId === companyFilter)
  }, [departments, companyFilter])

  // フィルター済み店舗
  const filtered = useMemo(() => {
    return stores.filter((s) => {
      if (departmentFilter !== "all" && s.departmentId !== departmentFilter) {
        return false
      }
      if (companyFilter !== "all") {
        const dept = departments.find((d) => d.id === s.departmentId)
        if (dept && dept.companyId !== companyFilter) return false
      }
      return true
    })
  }, [stores, companyFilter, departmentFilter, departments])

  function openCreate() {
    setEditTarget(null)
    setForm({
      departmentId: departmentFilter !== "all" ? departmentFilter : "",
      name: "",
      sortOrder: "0",
    })
    setDialogOpen(true)
  }

  function openEdit(store: StoreRow) {
    setEditTarget(store)
    setForm({
      departmentId: store.departmentId,
      name: store.name,
      sortOrder: String(store.sortOrder),
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("店舗名は必須です")
      return
    }

    setLoading(true)
    try {
      if (editTarget) {
        const res = await fetch(`/api/accounting/stores/${editTarget.id}`, {
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
        setStores((prev) =>
          prev.map((s) =>
            s.id === updated.id
              ? { ...s, name: updated.name, sortOrder: updated.sortOrder }
              : s
          )
        )
        toast.success("店舗情報を更新しました")
      } else {
        if (!form.departmentId) {
          toast.error("部門を選択してください")
          setLoading(false)
          return
        }
        const res = await fetch("/api/accounting/stores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            departmentId: form.departmentId,
            name: form.name.trim(),
            sortOrder: parseInt(form.sortOrder) || 0,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          toast.error(err.error || "登録に失敗しました")
          return
        }
        toast.success("店舗を登録しました")
        router.refresh()
      }
      setDialogOpen(false)
    } catch {
      toast.error("通信エラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleActive(store: StoreRow) {
    try {
      const res = await fetch(`/api/accounting/stores/${store.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !store.isActive }),
      })
      if (!res.ok) {
        toast.error("更新に失敗しました")
        return
      }
      setStores((prev) =>
        prev.map((s) =>
          s.id === store.id ? { ...s, isActive: !store.isActive } : s
        )
      )
      toast.success(store.isActive ? "無効化しました" : "有効化しました")
    } catch {
      toast.error("通信エラーが発生しました")
    }
  }

  async function handleSeedData() {
    if (departmentFilter === "all") {
      toast.error("初期データを登録する部門を選択してください")
      return
    }
    setSeedLoading(true)
    try {
      const seeds = [
        { name: "本社", sortOrder: 1 },
        { name: "緑店", sortOrder: 2 },
        { name: "春日井店", sortOrder: 3 },
        { name: "横浜店", sortOrder: 4 },
      ]
      for (const seed of seeds) {
        const exists = stores.find(
          (s) => s.name === seed.name && s.departmentId === departmentFilter
        )
        if (exists) continue
        const res = await fetch("/api/accounting/stores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            departmentId: departmentFilter,
            ...seed,
          }),
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

  // ダイアログ用の部門リスト（会社フィルターで絞り込み）
  const dialogDepartments = useMemo(() => {
    if (companyFilter !== "all") {
      return departments.filter((d) => d.companyId === companyFilter)
    }
    return departments
  }, [departments, companyFilter])

  return (
    <div className="space-y-4">
      {/* 会社・部門選択 */}
      <div className="flex items-center gap-3 flex-wrap">
        <Label className="text-sm font-medium whitespace-nowrap">
          会社選択
        </Label>
        <Select
          value={companyFilter}
          onValueChange={(v) => {
            setCompanyFilter(v)
            setDepartmentFilter("all")
          }}
        >
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

        {companyFilter !== "all" && (
          <>
            <Label className="text-sm font-medium whitespace-nowrap">
              部門選択
            </Label>
            <Select
              value={departmentFilter}
              onValueChange={setDepartmentFilter}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="部門を選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全て</SelectItem>
                {filteredDepartments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
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
            disabled={seedLoading || departmentFilter === "all"}
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
                  {editTarget ? "店舗情報の編集" : "店舗の新規登録"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {!editTarget && (
                  <div>
                    <Label className="text-xs font-semibold text-red-600">
                      部門 *
                    </Label>
                    <Select
                      value={form.departmentId}
                      onValueChange={(v) =>
                        setForm({ ...form, departmentId: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        {dialogDepartments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                            <span className="text-xs text-slate-400 ml-1">
                              ({d.company.name})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label className="text-xs font-semibold text-red-600">
                    店舗名 *
                  </Label>
                  <Input
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    placeholder="例：本社"
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
              <TableHead className="font-semibold">店舗名</TableHead>
              <TableHead className="font-semibold hidden sm:table-cell">
                部門
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
                    ? "会社と部門を選択してください"
                    : "データがありません"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => (
                <TableRow
                  key={s.id}
                  className={cn(!s.isActive && "opacity-50 bg-slate-50")}
                >
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-slate-600">
                    {s.department.name}
                  </TableCell>
                  <TableCell className="text-center">{s.sortOrder}</TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={s.isActive ? "default" : "secondary"}
                      className={cn(
                        "text-xs",
                        s.isActive
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                          : "bg-slate-200 text-slate-500"
                      )}
                    >
                      {s.isActive ? "有効" : "無効"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => openEdit(s)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-7 w-7 p-0",
                          s.isActive
                            ? "text-red-500 hover:text-red-600"
                            : "text-emerald-500 hover:text-emerald-600"
                        )}
                        onClick={() => handleToggleActive(s)}
                      >
                        {s.isActive ? (
                          <Ban className="w-3.5 h-3.5" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                      </Button>
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

/**
 * [COMPONENT] 経理 - 会社マスタ管理
 *
 * 会社一覧テーブル・新規登録・編集・無効化・初期データ一括登録
 */
"use client"

import { useState } from "react"
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
import { Badge } from "@/components/ui/badge"
import { Plus, Pencil, Ban, RotateCcw, Database, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { CompanyRow } from "./MasterTabs"

interface Props {
  initialCompanies: CompanyRow[]
}

export function CompanyMasterList({ initialCompanies }: Props) {
  const router = useRouter()
  const [companies, setCompanies] = useState(initialCompanies)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<CompanyRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [seedLoading, setSeedLoading] = useState(false)

  const [form, setForm] = useState({
    name: "",
    colorCode: "#3B82F6",
    sortOrder: "0",
  })

  function openCreate() {
    setEditTarget(null)
    setForm({ name: "", colorCode: "#3B82F6", sortOrder: "0" })
    setDialogOpen(true)
  }

  function openEdit(company: CompanyRow) {
    setEditTarget(company)
    setForm({
      name: company.name,
      colorCode: company.colorCode ?? "#3B82F6",
      sortOrder: String(company.sortOrder),
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("会社名は必須です")
      return
    }

    setLoading(true)
    try {
      if (editTarget) {
        // 編集
        const res = await fetch(`/api/accounting/companies/${editTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            colorCode: form.colorCode || null,
            sortOrder: parseInt(form.sortOrder) || 0,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          toast.error(err.error || "更新に失敗しました")
          return
        }
        const updated = await res.json()
        setCompanies((prev) =>
          prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
        )
        toast.success("会社情報を更新しました")
      } else {
        // 新規登録
        const res = await fetch("/api/accounting/companies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            colorCode: form.colorCode || null,
            sortOrder: parseInt(form.sortOrder) || 0,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          toast.error(err.error || "登録に失敗しました")
          return
        }
        toast.success("会社を登録しました")
        router.refresh()
      }
      setDialogOpen(false)
    } catch {
      toast.error("通信エラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleActive(company: CompanyRow) {
    try {
      const res = await fetch(`/api/accounting/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !company.isActive }),
      })
      if (!res.ok) {
        toast.error("更新に失敗しました")
        return
      }
      setCompanies((prev) =>
        prev.map((c) =>
          c.id === company.id ? { ...c, isActive: !company.isActive } : c
        )
      )
      toast.success(company.isActive ? "無効化しました" : "有効化しました")
    } catch {
      toast.error("通信エラーが発生しました")
    }
  }

  async function handleSeedData() {
    setSeedLoading(true)
    try {
      const seeds = [
        { name: "株式会社七色", colorCode: "#3B82F6", sortOrder: 1 },
        { name: "南施工サービス", colorCode: "#22C55E", sortOrder: 2 },
      ]
      for (const seed of seeds) {
        const exists = companies.find((c) => c.name === seed.name)
        if (exists) continue
        const res = await fetch("/api/accounting/companies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(seed),
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

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{companies.length}件</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={handleSeedData}
            disabled={seedLoading}
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
                  {editTarget ? "会社情報の編集" : "会社の新規登録"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label className="text-xs font-semibold text-red-600">
                    会社名 *
                  </Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="例：株式会社七色"
                  />
                </div>
                <div>
                  <Label className="text-xs">カラーコード</Label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={form.colorCode}
                      onChange={(e) =>
                        setForm({ ...form, colorCode: e.target.value })
                      }
                      className="w-10 h-10 rounded border cursor-pointer"
                    />
                    <Input
                      value={form.colorCode}
                      onChange={(e) =>
                        setForm({ ...form, colorCode: e.target.value })
                      }
                      placeholder="#3B82F6"
                      className="flex-1"
                    />
                  </div>
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
                    {loading && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
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
              <TableHead className="font-semibold">会社名</TableHead>
              <TableHead className="font-semibold">カラー</TableHead>
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
            {companies.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-8 text-slate-400"
                >
                  データがありません
                </TableCell>
              </TableRow>
            ) : (
              companies.map((c) => (
                <TableRow
                  key={c.id}
                  className={cn(!c.isActive && "opacity-50 bg-slate-50")}
                >
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    {c.colorCode ? (
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-5 h-5 rounded-full border"
                          style={{ backgroundColor: c.colorCode }}
                        />
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={{
                            color: c.colorCode,
                            borderColor: c.colorCode,
                          }}
                        >
                          {c.colorCode}
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs">未設定</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{c.sortOrder}</TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={c.isActive ? "default" : "secondary"}
                      className={cn(
                        "text-xs",
                        c.isActive
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                          : "bg-slate-200 text-slate-500"
                      )}
                    >
                      {c.isActive ? "有効" : "無効"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => openEdit(c)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-7 w-7 p-0",
                          c.isActive
                            ? "text-red-500 hover:text-red-600"
                            : "text-emerald-500 hover:text-emerald-600"
                        )}
                        onClick={() => handleToggleActive(c)}
                      >
                        {c.isActive ? (
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

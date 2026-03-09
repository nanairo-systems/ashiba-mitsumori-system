/**
 * [COMPONENT] 項目マスタ管理タブ
 *
 * カテゴリ→項目の2階層で管理。
 * カテゴリ・項目のCRUDとテンプレートからのインポート機能。
 */
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Download,
  Search,
} from "lucide-react"
import { toast } from "sonner"

// ─── 型定義 ──────────────────────────────────

interface UnitItem {
  id: string
  name: string
}

interface MasterItemData {
  id: string
  categoryId: string
  name: string
  unitId: string
  unitPrice: number
  sortOrder: number
  unit: UnitItem
}

interface CategoryData {
  id: string
  name: string
  sortOrder: number
  items: MasterItemData[]
}

interface TemplateData {
  id: string
  name: string
  description: string | null
}

interface Props {
  categories: CategoryData[]
  units: UnitItem[]
  templates: TemplateData[]
  onRefresh: () => void
}

// ─── メインコンポーネント ─────────────────────

export function ItemMasterTab({ categories, units, templates, onRefresh }: Props) {
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")

  // カテゴリ展開状態
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(categories.map((c) => c.id))
  )

  // カテゴリダイアログ
  const [catDialogOpen, setCatDialogOpen] = useState(false)
  const [editingCat, setEditingCat] = useState<CategoryData | null>(null)
  const [catName, setCatName] = useState("")

  // 項目ダイアログ
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MasterItemData | null>(null)
  const [targetCategoryId, setTargetCategoryId] = useState("")
  const [itemName, setItemName] = useState("")
  const [itemUnitId, setItemUnitId] = useState("")
  const [itemUnitPrice, setItemUnitPrice] = useState("")

  // テンプレートインポートダイアログ
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importTemplateId, setImportTemplateId] = useState("")
  const [importCategoryId, setImportCategoryId] = useState("")

  // ─── 検索フィルタ ───────────────────────────

  const filteredCategories = categories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          !search ||
          item.name.toLowerCase().includes(search.toLowerCase()) ||
          cat.name.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter((cat) => !search || cat.items.length > 0 || cat.name.toLowerCase().includes(search.toLowerCase()))

  // ─── カテゴリCRUD ───────────────────────────

  function openCreateCat() {
    setEditingCat(null)
    setCatName("")
    setCatDialogOpen(true)
  }

  function openEditCat(cat: CategoryData) {
    setEditingCat(cat)
    setCatName(cat.name)
    setCatDialogOpen(true)
  }

  async function saveCat() {
    if (!catName.trim()) return
    setSaving(true)
    try {
      if (editingCat) {
        await fetch(`/api/item-categories/${editingCat.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: catName.trim() }),
        }).then(async (r) => {
          if (!r.ok) throw new Error((await r.json()).error || "更新失敗")
        })
        toast.success("カテゴリを更新しました")
      } else {
        await fetch("/api/item-categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: catName.trim(), sortOrder: categories.length }),
        }).then(async (r) => {
          if (!r.ok) throw new Error((await r.json()).error || "作成失敗")
        })
        toast.success("カテゴリを作成しました")
      }
      setCatDialogOpen(false)
      onRefresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "エラーが発生しました")
    } finally {
      setSaving(false)
    }
  }

  async function deleteCat(cat: CategoryData) {
    if (!confirm(`カテゴリ「${cat.name}」を削除しますか？\n含まれる${cat.items.length}件の項目も無効になります。`)) return
    setSaving(true)
    try {
      await fetch(`/api/item-categories/${cat.id}`, { method: "DELETE" })
      toast.success("カテゴリを削除しました")
      onRefresh()
    } catch {
      toast.error("削除に失敗しました")
    } finally {
      setSaving(false)
    }
  }

  // ─── 項目CRUD ───────────────────────────────

  function openCreateItem(categoryId: string) {
    setEditingItem(null)
    setTargetCategoryId(categoryId)
    setItemName("")
    setItemUnitId(units[0]?.id || "")
    setItemUnitPrice("")
    setItemDialogOpen(true)
  }

  function openEditItem(item: MasterItemData) {
    setEditingItem(item)
    setTargetCategoryId(item.categoryId)
    setItemName(item.name)
    setItemUnitId(item.unitId)
    setItemUnitPrice(String(item.unitPrice))
    setItemDialogOpen(true)
  }

  async function saveItem() {
    if (!itemName.trim() || !itemUnitId) return
    const price = Number(itemUnitPrice) || 0
    setSaving(true)
    try {
      if (editingItem) {
        await fetch(`/api/master-items/${editingItem.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: itemName.trim(),
            unitId: itemUnitId,
            unitPrice: price,
            categoryId: targetCategoryId,
          }),
        }).then(async (r) => {
          if (!r.ok) throw new Error((await r.json()).error || "更新失敗")
        })
        toast.success("項目を更新しました")
      } else {
        const cat = categories.find((c) => c.id === targetCategoryId)
        await fetch("/api/master-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId: targetCategoryId,
            name: itemName.trim(),
            unitId: itemUnitId,
            unitPrice: price,
            sortOrder: cat ? cat.items.length : 0,
          }),
        }).then(async (r) => {
          if (!r.ok) throw new Error((await r.json()).error || "作成失敗")
        })
        toast.success("項目を作成しました")
      }
      setItemDialogOpen(false)
      onRefresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "エラーが発生しました")
    } finally {
      setSaving(false)
    }
  }

  async function deleteItem(item: MasterItemData) {
    if (!confirm(`項目「${item.name}」を削除しますか？`)) return
    setSaving(true)
    try {
      await fetch(`/api/master-items/${item.id}`, { method: "DELETE" })
      toast.success("項目を削除しました")
      onRefresh()
    } catch {
      toast.error("削除に失敗しました")
    } finally {
      setSaving(false)
    }
  }

  // ─── テンプレートインポート ─────────────────

  function openImport() {
    setImportTemplateId(templates[0]?.id || "")
    setImportCategoryId(categories[0]?.id || "")
    setImportDialogOpen(true)
  }

  async function doImport() {
    if (!importTemplateId || !importCategoryId) return
    setSaving(true)
    try {
      const res = await fetch("/api/master-items/import-from-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: importTemplateId,
          categoryId: importCategoryId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "インポート失敗")
      toast.success(`${data.imported}件インポートしました${data.skipped > 0 ? `（${data.skipped}件は重複のためスキップ）` : ""}`)
      setImportDialogOpen(false)
      onRefresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "エラーが発生しました")
    } finally {
      setSaving(false)
    }
  }

  // ─── 展開切替 ──────────────────────────────

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ─── Render ─────────────────────────────────

  return (
    <div className="space-y-4">
      {/* 操作バー */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button size="sm" onClick={openCreateCat}>
          <Plus className="w-4 h-4 mr-1" />
          カテゴリ追加
        </Button>
        {templates.length > 0 && categories.length > 0 && (
          <Button size="sm" variant="outline" onClick={openImport}>
            <Download className="w-4 h-4 mr-1" />
            テンプレートから取込
          </Button>
        )}
      </div>

      {/* カテゴリ一覧 */}
      {filteredCategories.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          {categories.length === 0
            ? "カテゴリがまだありません。「カテゴリ追加」から作成してください。"
            : "検索条件に一致する項目がありません。"}
        </div>
      )}

      {filteredCategories.map((cat) => (
        <div key={cat.id} className="border rounded-lg bg-white">
          {/* カテゴリヘッダー */}
          <div
            className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-slate-50"
            onClick={() => toggleExpand(cat.id)}
          >
            {expanded.has(cat.id) ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
            <span className="font-medium text-slate-800 flex-1">{cat.name}</span>
            <span className="text-xs text-slate-400">{cat.items.length}件</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={(e) => {
                e.stopPropagation()
                openEditCat(cat)
              }}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
              onClick={(e) => {
                e.stopPropagation()
                deleteCat(cat)
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* 項目テーブル */}
          {expanded.has(cat.id) && (
            <div className="border-t">
              {cat.items.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">項目名</TableHead>
                      <TableHead className="w-[15%]">単位</TableHead>
                      <TableHead className="w-[20%] text-right">単価</TableHead>
                      <TableHead className="w-[25%] text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cat.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.unit.name}</TableCell>
                        <TableCell className="text-right">
                          {item.unitPrice.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => openEditItem(item)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                            onClick={() => deleteItem(item)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-6 text-sm text-slate-400">
                  項目がありません
                </div>
              )}
              <div className="px-4 py-2 border-t">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-blue-600"
                  onClick={() => openCreateItem(cat.id)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  項目を追加
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* ━━ カテゴリダイアログ ━━━━━━━━━━━━━━━━━━━ */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCat ? "カテゴリ編集" : "カテゴリ追加"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>カテゴリ名</Label>
              <Input
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="例: くさび式足場"
                onKeyDown={(e) => e.key === "Enter" && saveCat()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={saveCat} disabled={saving || !catName.trim()}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editingCat ? "更新" : "作成"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ━━ 項目ダイアログ ━━━━━━━━━━━━━━━━━━━━━ */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "項目編集" : "項目追加"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>カテゴリ</Label>
              <select
                value={targetCategoryId}
                onChange={(e) => setTargetCategoryId(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-white"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>項目名</Label>
              <Input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="例: 単管パイプ"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>単位</Label>
                <select
                  value={itemUnitId}
                  onChange={(e) => setItemUnitId(e.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-white"
                >
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>単価</Label>
                <Input
                  type="number"
                  value={itemUnitPrice}
                  onChange={(e) => setItemUnitPrice(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={saveItem} disabled={saving || !itemName.trim() || !itemUnitId}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editingItem ? "更新" : "作成"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ━━ テンプレートインポートダイアログ ━━━━━━━ */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>テンプレートから取込</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>テンプレート</Label>
              <select
                value={importTemplateId}
                onChange={(e) => setImportTemplateId(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-white"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>取込先カテゴリ</Label>
              <select
                value={importCategoryId}
                onChange={(e) => setImportCategoryId(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm bg-white"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-slate-500">
              テンプレートの全項目を選択したカテゴリに取り込みます。重複する項目名はスキップされます。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={doImport} disabled={saving || !importTemplateId || !importCategoryId}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              取込
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

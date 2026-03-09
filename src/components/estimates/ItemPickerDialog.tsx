/**
 * [COMPONENT] 項目マスタ一括選択ダイアログ
 *
 * マスタ項目をカテゴリごとにチェックボックスで選択し、
 * 見積もりに一括追加するためのダイアログ。
 */
"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Search,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react"

// ─── 型定義 ──────────────────────────────────

interface BulkItem {
  id: string
  name: string
  unitId: string
  unitPrice: number
  unit: { id: string; name: string }
}

interface BulkCategory {
  id: string
  name: string
  items: BulkItem[]
}

export interface PickedItem {
  name: string
  unitId: string
  unitPrice: number
  categoryName: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (items: PickedItem[]) => void
}

// ─── メインコンポーネント ─────────────────────

export function ItemPickerDialog({ open, onOpenChange, onConfirm }: Props) {
  const [categories, setCategories] = useState<BulkCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // ─── データ読み込み ─────────────────────────

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setSearch("")
    setSelected(new Set())
    fetch("/api/master-items/bulk")
      .then((r) => r.json())
      .then((data) => {
        const cats: BulkCategory[] = data.categories || []
        setCategories(cats)
        setExpanded(new Set(cats.map((c) => c.id)))
      })
      .catch(() => setCategories([]))
      .finally(() => setLoading(false))
  }, [open])

  // ─── 検索フィルタ ───────────────────────────

  const filtered = useMemo(() => {
    if (!search) return categories
    const q = search.toLowerCase()
    return categories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) =>
            item.name.toLowerCase().includes(q) ||
            cat.name.toLowerCase().includes(q)
        ),
      }))
      .filter((cat) => cat.items.length > 0)
  }, [categories, search])

  // ─── 全アイテムのID→アイテムマップ ──────────

  const itemMap = useMemo(() => {
    const map = new Map<string, BulkItem>()
    for (const cat of categories) {
      for (const item of cat.items) {
        map.set(item.id, item)
      }
    }
    return map
  }, [categories])

  // ─── チェックボックス操作 ────────────────────

  const toggleItem = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleCategory = useCallback(
    (cat: BulkCategory) => {
      setSelected((prev) => {
        const next = new Set(prev)
        const allSelected = cat.items.every((i) => next.has(i.id))
        if (allSelected) {
          cat.items.forEach((i) => next.delete(i.id))
        } else {
          cat.items.forEach((i) => next.add(i.id))
        }
        return next
      })
    },
    []
  )

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // ─── 確定 ───────────────────────────────────

  // ─── カテゴリ名逆引きマップ ────────────────────
  const itemCategoryMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const cat of categories) {
      for (const item of cat.items) {
        map.set(item.id, cat.name)
      }
    }
    return map
  }, [categories])

  function handleConfirm() {
    const items: PickedItem[] = []
    for (const id of selected) {
      const item = itemMap.get(id)
      if (item) {
        items.push({
          name: item.name,
          unitId: item.unitId,
          unitPrice: item.unitPrice,
          categoryName: itemCategoryMap.get(id) ?? "",
        })
      }
    }
    onConfirm(items)
    onOpenChange(false)
  }

  // ─── Render ─────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>項目追加（マスタから選択）</DialogTitle>
        </DialogHeader>

        {/* 検索 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="項目を検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* 項目リスト */}
        <div className="flex-1 overflow-y-auto min-h-0 border rounded-md">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-400">
              {categories.length === 0
                ? "項目マスタが登録されていません。マスター管理から登録してください。"
                : "検索条件に一致する項目がありません。"}
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((cat) => {
                const allSelected = cat.items.length > 0 && cat.items.every((i) => selected.has(i.id))
                const someSelected = cat.items.some((i) => selected.has(i.id))

                return (
                  <div key={cat.id}>
                    {/* カテゴリヘッダー */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 sticky top-0 z-10">
                      <Checkbox
                        checked={allSelected ? true : someSelected ? "indeterminate" : false}
                        onCheckedChange={() => toggleCategory(cat)}
                      />
                      <button
                        type="button"
                        className="flex items-center gap-1 flex-1 text-left"
                        onClick={() => toggleExpand(cat.id)}
                      >
                        {expanded.has(cat.id) ? (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        )}
                        <span className="text-sm font-medium text-slate-700">
                          {cat.name}
                        </span>
                        <span className="text-xs text-slate-400 ml-1">
                          ({cat.items.length})
                        </span>
                      </button>
                    </div>

                    {/* 項目リスト */}
                    {expanded.has(cat.id) &&
                      cat.items.map((item) => (
                        <label
                          key={item.id}
                          className="flex items-center gap-3 px-3 py-2 pl-8 hover:bg-blue-50/50 cursor-pointer"
                        >
                          <Checkbox
                            checked={selected.has(item.id)}
                            onCheckedChange={() => toggleItem(item.id)}
                          />
                          <span className="flex-1 text-sm">{item.name}</span>
                          <span className="text-xs text-slate-400 w-10 text-center">
                            {item.unit.name}
                          </span>
                          <span className="text-xs text-slate-500 w-20 text-right tabular-nums">
                            ¥{item.unitPrice.toLocaleString()}
                          </span>
                        </label>
                      ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* フッター */}
        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <span className="text-sm text-slate-500">
            {selected.size > 0 ? `${selected.size}件選択中` : "項目を選択してください"}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button onClick={handleConfirm} disabled={selected.size === 0}>
              {selected.size}件を追加
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

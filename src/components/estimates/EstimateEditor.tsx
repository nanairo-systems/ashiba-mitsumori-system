/**
 * [COMPONENT] 見積インライン編集エディター - EstimateEditor
 *
 * 下書き（DRAFT）状態の見積を直接編集する。
 *
 * 操作できること:
 * - セクション（大項目）: 追加・名前変更・削除・並び替え
 * - グループ（中項目）: 追加・名前変更・削除
 * - 明細（項目）: 追加・名前変更・数量変更・単位変更・単価変更・削除
 * - 備考・値引き金額の編集
 * - 合計金額のリアルタイム計算
 *
 * 保存方法: 「保存する」ボタンで PATCH /api/estimates/:id に送信
 */
"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Save,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical,
  ArrowLeft,
} from "lucide-react"
import { toast } from "sonner"

// ─── 型定義 ────────────────────────────────────────────

interface Unit {
  id: string
  name: string
}

interface EditorItem {
  _key: string   // React key用（localで管理）
  id?: string
  name: string
  quantity: number
  unitId: string
  unitPrice: number
  sortOrder: number
}

interface EditorGroup {
  _key: string
  id?: string
  name: string
  sortOrder: number
  items: EditorItem[]
}

interface EditorSection {
  _key: string
  id?: string
  name: string
  sortOrder: number
  groups: EditorGroup[]
}

interface Props {
  estimateId: string
  initialNote: string | null
  initialDiscount: number
  initialValidDays: number
  initialSections: EditorSection[]
  units: Unit[]
  taxRate: number
  onSaved: () => void
  onCancel: () => void
}

// ─── ユーティリティ ────────────────────────────────────

let _keyCounter = 0
function newKey() {
  return `new_${++_keyCounter}`
}

function newItem(sortOrder: number): EditorItem {
  return {
    _key: newKey(),
    name: "",
    quantity: 1,
    unitId: "",
    unitPrice: 0,
    sortOrder,
  }
}

function newGroup(sortOrder: number): EditorGroup {
  return {
    _key: newKey(),
    name: "",
    sortOrder,
    items: [newItem(1)],
  }
}

function newSection(sortOrder: number): EditorSection {
  return {
    _key: newKey(),
    name: "",
    sortOrder,
    groups: [newGroup(1)],
  }
}

// ─── サブコンポーネント: 明細行 ────────────────────────

interface ItemRowProps {
  item: EditorItem
  units: Unit[]
  onChange: (updated: EditorItem) => void
  onDelete: () => void
  isOnly: boolean
}

function ItemRow({ item, units, onChange, onDelete, isOnly }: ItemRowProps) {
  return (
    <div className="flex items-center gap-2 py-1 px-2 rounded hover:bg-slate-50 group">
      <GripVertical className="w-4 h-4 text-slate-300 flex-shrink-0" />

      {/* 項目名 */}
      <Input
        value={item.name}
        onChange={(e) => onChange({ ...item, name: e.target.value })}
        placeholder="項目名を入力"
        className="flex-1 h-8 text-sm border-transparent bg-transparent hover:bg-white focus:bg-white"
      />

      {/* 数量 */}
      <Input
        type="number"
        value={item.quantity}
        onChange={(e) =>
          onChange({ ...item, quantity: Number(e.target.value) || 0 })
        }
        className="w-20 h-8 text-sm text-right border-transparent bg-transparent hover:bg-white focus:bg-white"
        min={0}
        step="0.01"
      />

      {/* 単位 */}
      <Select
        value={item.unitId}
        onValueChange={(v) => onChange({ ...item, unitId: v })}
      >
        <SelectTrigger className="w-20 h-8 text-sm border-transparent bg-transparent hover:bg-white focus:bg-white">
          <SelectValue placeholder="単位" />
        </SelectTrigger>
        <SelectContent>
          {units.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 単価 */}
      <Input
        type="number"
        value={item.unitPrice}
        onChange={(e) =>
          onChange({ ...item, unitPrice: Number(e.target.value) || 0 })
        }
        className="w-28 h-8 text-sm text-right border-transparent bg-transparent hover:bg-white focus:bg-white"
        min={0}
      />

      {/* 金額（読み取り専用） */}
      <div className="w-28 text-sm text-right font-mono text-slate-700 pr-1 flex-shrink-0">
        ¥{formatCurrency(item.quantity * item.unitPrice)}
      </div>

      {/* 削除ボタン */}
      <button
        type="button"
        onClick={onDelete}
        disabled={isOnly}
        className="w-7 h-7 flex items-center justify-center rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-20 disabled:cursor-not-allowed flex-shrink-0"
        title="行を削除"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ─── サブコンポーネント: グループ ──────────────────────

interface GroupBlockProps {
  group: EditorGroup
  units: Unit[]
  onChange: (updated: EditorGroup) => void
  onDelete: () => void
  isOnly: boolean
}

function GroupBlock({
  group,
  units,
  onChange,
  onDelete,
  isOnly,
}: GroupBlockProps) {
  function updateItem(idx: number, updated: EditorItem) {
    const items = [...group.items]
    items[idx] = updated
    onChange({ ...group, items })
  }

  function deleteItem(idx: number) {
    onChange({ ...group, items: group.items.filter((_, i) => i !== idx) })
  }

  function addItem() {
    onChange({
      ...group,
      items: [
        ...group.items,
        newItem(group.items.length + 1),
      ],
    })
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden mb-3">
      {/* グループヘッダー */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-100">
        <Input
          value={group.name}
          onChange={(e) => onChange({ ...group, name: e.target.value })}
          placeholder="グループ名（中項目）"
          className="flex-1 h-7 text-sm font-medium border-transparent bg-transparent hover:bg-white focus:bg-white"
        />
        <button
          type="button"
          onClick={onDelete}
          disabled={isOnly}
          className="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-100 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
          title="グループを削除"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 列ヘッダー */}
      <div className="flex items-center gap-2 px-2 py-1 bg-slate-50 border-b border-slate-200">
        <div className="w-4 flex-shrink-0" />
        <div className="flex-1 text-xs text-slate-400">項目名</div>
        <div className="w-20 text-xs text-slate-400 text-right">数量</div>
        <div className="w-20 text-xs text-slate-400 text-center">単位</div>
        <div className="w-28 text-xs text-slate-400 text-right">単価（円）</div>
        <div className="w-28 text-xs text-slate-400 text-right">金額（円）</div>
        <div className="w-7 flex-shrink-0" />
      </div>

      {/* 明細行 */}
      <div className="divide-y divide-slate-100">
        {group.items.map((item, idx) => (
          <ItemRow
            key={item._key}
            item={item}
            units={units}
            onChange={(updated) => updateItem(idx, updated)}
            onDelete={() => deleteItem(idx)}
            isOnly={group.items.length === 1}
          />
        ))}
      </div>

      {/* 行追加ボタン */}
      <div className="px-3 py-2 border-t border-slate-100">
        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          行を追加
        </button>
      </div>
    </div>
  )
}

// ─── サブコンポーネント: セクション ────────────────────

interface SectionBlockProps {
  section: EditorSection
  units: Unit[]
  onChange: (updated: EditorSection) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  isFirst: boolean
  isLast: boolean
  isOnly: boolean
}

function SectionBlock({
  section,
  units,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  isOnly,
}: SectionBlockProps) {
  function updateGroup(idx: number, updated: EditorGroup) {
    const groups = [...section.groups]
    groups[idx] = updated
    onChange({ ...section, groups })
  }

  function deleteGroup(idx: number) {
    onChange({ ...section, groups: section.groups.filter((_, i) => i !== idx) })
  }

  function addGroup() {
    onChange({
      ...section,
      groups: [...section.groups, newGroup(section.groups.length + 1)],
    })
  }

  const sectionTotal = section.groups.reduce(
    (s, g) =>
      s + g.items.reduce((si, i) => si + i.quantity * i.unitPrice, 0),
    0
  )

  return (
    <Card className="border-2 border-slate-200">
      {/* セクションヘッダー */}
      <CardHeader className="py-3 px-4 bg-slate-800 text-white rounded-t-lg">
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={isFirst}
              className="text-slate-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={isLast}
              className="text-slate-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
          <Input
            value={section.name}
            onChange={(e) => onChange({ ...section, name: e.target.value })}
            placeholder="セクション名（大項目）"
            className="flex-1 h-8 text-sm font-bold bg-transparent border-transparent text-white placeholder:text-slate-400 hover:bg-slate-700 focus:bg-slate-700"
          />
          <span className="text-sm font-mono text-slate-300 whitespace-nowrap">
            小計: ¥{formatCurrency(sectionTotal)}
          </span>
          <button
            type="button"
            onClick={onDelete}
            disabled={isOnly}
            className="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
            title="セクションを削除"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-0">
        {section.groups.map((group, idx) => (
          <GroupBlock
            key={group._key}
            group={group}
            units={units}
            onChange={(updated) => updateGroup(idx, updated)}
            onDelete={() => deleteGroup(idx)}
            isOnly={section.groups.length === 1}
          />
        ))}

        {/* グループ追加ボタン */}
        <button
          type="button"
          onClick={addGroup}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 font-medium mt-2"
        >
          <Plus className="w-4 h-4" />
          グループ（中項目）を追加
        </button>
      </CardContent>
    </Card>
  )
}

// ─── メインコンポーネント ───────────────────────────────

export function EstimateEditor({
  estimateId,
  initialNote,
  initialDiscount,
  initialValidDays,
  initialSections,
  units,
  taxRate,
  onSaved,
  onCancel,
}: Props) {
  const [sections, setSections] = useState<EditorSection[]>(initialSections)
  const [note, setNote] = useState(initialNote ?? "")
  const [discount, setDiscount] = useState(initialDiscount)
  const [validDays, setValidDays] = useState(initialValidDays)
  const [saving, setSaving] = useState(false)

  // ── 合計計算 ──────────────────────────────────────────
  const subtotal = sections.reduce(
    (s, sec) =>
      s +
      sec.groups.reduce(
        (gs, g) =>
          gs + g.items.reduce((is, i) => is + i.quantity * i.unitPrice, 0),
        0
      ),
    0
  )
  const taxable = subtotal - discount
  const tax = Math.floor(taxable * taxRate)
  const total = taxable + tax

  // ── セクション操作 ────────────────────────────────────
  const updateSection = useCallback(
    (idx: number, updated: EditorSection) => {
      setSections((prev) => prev.map((s, i) => (i === idx ? updated : s)))
    },
    []
  )

  const deleteSection = useCallback((idx: number) => {
    setSections((prev) => prev.filter((_, i) => i !== idx))
  }, [])

  const addSection = useCallback(() => {
    setSections((prev) => [...prev, newSection(prev.length + 1)])
  }, [])

  const moveSection = useCallback((idx: number, dir: "up" | "down") => {
    setSections((prev) => {
      const next = [...prev]
      const target = dir === "up" ? idx - 1 : idx + 1
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next.map((s, i) => ({ ...s, sortOrder: i + 1 }))
    })
  }, [])

  // ── 保存 ─────────────────────────────────────────────
  async function handleSave() {
    // バリデーション
    for (const sec of sections) {
      if (!sec.name.trim()) {
        toast.error("セクション名が空のものがあります")
        return
      }
      for (const grp of sec.groups) {
        if (!grp.name.trim()) {
          toast.error("グループ名が空のものがあります")
          return
        }
        for (const item of grp.items) {
          if (!item.name.trim()) {
            toast.error("項目名が空のものがあります")
            return
          }
          if (!item.unitId) {
            toast.error(`「${item.name}」の単位を選択してください`)
            return
          }
        }
      }
    }

    setSaving(true)
    try {
      const payload = {
        note: note || null,
        discountAmount: discount > 0 ? discount : null,
        validDays,
        sections: sections.map((sec, si) => ({
          id: sec.id,
          name: sec.name,
          sortOrder: si + 1,
          groups: sec.groups.map((grp, gi) => ({
            id: grp.id,
            name: grp.name,
            sortOrder: gi + 1,
            items: grp.items.map((item, ii) => ({
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              unitId: item.unitId,
              unitPrice: item.unitPrice,
              sortOrder: ii + 1,
            })),
          })),
        })),
      }

      const res = await fetch(`/api/estimates/${estimateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "保存に失敗しました")
      }

      toast.success("見積を保存しました")
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* アクションバー */}
      <div className="flex items-center gap-3 sticky top-0 z-10 bg-white/90 backdrop-blur-sm py-3 px-4 -mx-4 border-b border-slate-200 shadow-sm">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          キャンセル
        </button>
        <span className="text-slate-300">|</span>
        <span className="text-sm text-orange-600 font-medium">
          編集中（下書き）
        </span>
        <div className="flex-1" />
        <div className="text-sm font-mono font-bold text-slate-700">
          合計: ¥{formatCurrency(total)}
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm">
          <Save className="w-4 h-4 mr-1.5" />
          {saving ? "保存中..." : "保存する"}
        </Button>
      </div>

      {/* セクション一覧 */}
      <div className="space-y-4">
        {sections.map((sec, idx) => (
          <SectionBlock
            key={sec._key}
            section={sec}
            units={units}
            onChange={(updated) => updateSection(idx, updated)}
            onDelete={() => deleteSection(idx)}
            onMoveUp={() => moveSection(idx, "up")}
            onMoveDown={() => moveSection(idx, "down")}
            isFirst={idx === 0}
            isLast={idx === sections.length - 1}
            isOnly={sections.length === 1}
          />
        ))}
      </div>

      {/* セクション追加ボタン */}
      <button
        type="button"
        onClick={addSection}
        className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:text-slate-700 hover:border-slate-400 transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" />
        セクション（大項目）を追加
      </button>

      {/* 備考・値引き・合計 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {/* 備考 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              特記事項・備考
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="見積に関する備考を入力（任意）"
              rows={4}
              className="resize-none"
            />
          </div>
          {/* 有効期限 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              有効期限（日数）
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={validDays}
                onChange={(e) => setValidDays(Number(e.target.value) || 30)}
                className="w-24"
                min={1}
              />
              <span className="text-sm text-slate-500">日間</span>
            </div>
          </div>
        </div>

        {/* 金額サマリー */}
        <div className="bg-slate-50 rounded-xl p-5">
          <h3 className="text-sm font-medium text-slate-700 mb-4">金額サマリー</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">小計（税抜）</span>
              <span className="font-mono font-medium">¥{formatCurrency(subtotal)}</span>
            </div>
            {/* 値引き */}
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">値引き</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">-¥</span>
                <Input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                  className="w-32 h-7 text-sm text-right font-mono"
                  min={0}
                />
              </div>
            </div>
            <div className="flex justify-between text-sm border-t border-slate-200 pt-3">
              <span className="text-slate-500">課税対象額</span>
              <span className="font-mono">¥{formatCurrency(taxable)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">
                消費税（{Math.round(taxRate * 100)}%）
              </span>
              <span className="font-mono">¥{formatCurrency(tax)}</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t-2 border-slate-300 pt-3">
              <span>合計（税込）</span>
              <span className="font-mono text-lg text-blue-700">
                ¥{formatCurrency(total)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 下部保存ボタン */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
        <Button variant="outline" onClick={onCancel}>
          キャンセル
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-1.5" />
          {saving ? "保存中..." : "見積を保存する"}
        </Button>
      </div>
    </div>
  )
}

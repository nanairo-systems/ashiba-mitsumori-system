/**
 * [COMPONENT] 見積インライン編集エディター - EstimateEditor
 *
 * 下書き（DRAFT）状態の見積を直接編集する。
 *
 * 操作できること:
 * - セクション（大項目）: 追加・名前変更・削除・ドラッグ並び替え
 * - グループ（中項目）: 追加・名前変更・削除・ドラッグ並び替え
 * - 明細（項目）: 追加・名前変更・数量変更・単位変更・単価変更・削除・ドラッグ並び替え
 * - 備考・値引き金額の編集
 * - 合計金額のリアルタイム計算
 *
 * 並び替え方法:
 * - 各行の ≡ ハンドルを長押し（モバイル）またはドラッグ（PC）で上下に移動
 * - 並び替えモードボタンで ▲▼ ボタンによるキーボード操作も可能
 *
 * 保存方法: 「保存する」ボタンで PATCH /api/estimates/:id に送信
 */
"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import Sortable from "sortablejs"
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
  ArrowUpDown,
  Tag,
} from "lucide-react"
import { toast } from "sonner"

// ─── 型定義 ────────────────────────────────────────────

interface Unit {
  id: string
  name: string
}

interface EditorItem {
  _key: string
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
  initialTitle: string | null
  initialNote: string | null
  initialDiscount: number
  initialValidDays: number
  initialSections: EditorSection[]
  units: Unit[]
  taxRate: number
  onSaved: () => void
  onCancel: () => void
}

// ─── セルナビゲーション（矢印キー移動） ───────────────

function navigateCell(
  currentInput: HTMLInputElement,
  direction: "up" | "down" | "left" | "right"
) {
  const col = currentInput.dataset.navCol ?? "0"
  if (direction === "up" || direction === "down") {
    const all = Array.from(
      document.querySelectorAll<HTMLInputElement>(`input[data-nav-col="${col}"]`)
    )
    const idx = all.indexOf(currentInput)
    const next = all[direction === "up" ? idx - 1 : idx + 1]
    if (next) { next.focus(); next.select() }
  } else {
    const row = currentInput.closest("[data-nav-row]")
    if (!row) return
    const rowInputs = Array.from(
      row.querySelectorAll<HTMLInputElement>("input[data-nav-col]")
    )
    const idx = rowInputs.indexOf(currentInput)
    const next = rowInputs[direction === "left" ? idx - 1 : idx + 1]
    if (next) { next.focus(); next.select() }
  }
}

/** Enter キーで右→次行先頭へ順送りナビゲーション */
function navigateCellNext(currentInput: HTMLInputElement) {
  const row = currentInput.closest("[data-nav-row]")
  if (!row) return
  const rowInputs = Array.from(
    row.querySelectorAll<HTMLInputElement>("input[data-nav-col]")
  )
  const idx = rowInputs.indexOf(currentInput)
  // 同じ行内に右にまだセルがあればそこへ
  if (idx < rowInputs.length - 1) {
    const next = rowInputs[idx + 1]
    next.focus(); next.select()
    return
  }
  // 行末 → 次の行の先頭セルへ
  const allNavRows = Array.from(
    document.querySelectorAll<HTMLElement>("[data-nav-row]")
  )
  const rowIdx = allNavRows.indexOf(row as HTMLElement)
  if (rowIdx < allNavRows.length - 1) {
    const nextRow = allNavRows[rowIdx + 1]
    const firstInput = nextRow.querySelector<HTMLInputElement>("input[data-nav-col]")
    if (firstInput) { firstInput.focus(); firstInput.select() }
  }
}

// ─── ユーティリティ ────────────────────────────────────

let _keyCounter = 0
function newKey() { return `new_${++_keyCounter}` }

function newItem(sortOrder: number): EditorItem {
  return { _key: newKey(), name: "", quantity: 1, unitId: "", unitPrice: 0, sortOrder }
}
function newGroup(sortOrder: number): EditorGroup {
  return { _key: newKey(), name: "", sortOrder, items: [newItem(1)] }
}
function newSection(sortOrder: number): EditorSection {
  return { _key: newKey(), name: "", sortOrder, groups: [newGroup(1)] }
}

// ─── SortableList: ドラッグ可能なリストコンテナ ────────

interface SortableListProps {
  id: string                        // Sortable グループ ID（ユニーク）
  items: { _key: string }[]         // 並び順の基準
  onReorder: (from: number, to: number) => void
  children: React.ReactNode
  className?: string
  handle?: string                   // CSS セレクター（ドラッグハンドル）
  disabled?: boolean
}

function SortableList({
  id,
  items: _items,
  onReorder,
  children,
  className,
  handle = ".drag-handle",
  disabled = false,
}: SortableListProps) {
  const ref = useRef<HTMLDivElement>(null)
  const sortableRef = useRef<Sortable | null>(null)
  // onReorder を最新に保つ ref（stale closure 対策）
  const onReorderRef = useRef(onReorder)
  useEffect(() => { onReorderRef.current = onReorder }, [onReorder])

  useEffect(() => {
    if (!ref.current) return

    // disabled=true のときは SortableJS を破棄して React に DOM 制御を返す
    if (disabled) {
      sortableRef.current?.destroy()
      sortableRef.current = null
      return
    }

    // disabled=false のとき SortableJS を初期化
    sortableRef.current?.destroy()
    sortableRef.current = Sortable.create(ref.current, {
      handle,
      animation: 150,
      ghostClass: "sortable-ghost",
      chosenClass: "sortable-chosen",
      dragClass: "sortable-drag",
      delay: 150,           // 長押し判定（ms）- モバイル対応
      delayOnTouchOnly: true,
      forceFallback: false,
      onEnd: (evt) => {
        const from = evt.oldIndex ?? 0
        const to = evt.newIndex ?? 0
        if (from !== to) onReorderRef.current(from, to)
      },
    })

    return () => {
      sortableRef.current?.destroy()
      sortableRef.current = null
    }
  }, [id, handle, disabled])

  return (
    <div ref={ref} className={className} data-sortable-id={id}>
      {children}
    </div>
  )
}

// ─── サブコンポーネント: 明細行 ────────────────────────

interface ItemRowProps {
  item: EditorItem
  units: Unit[]
  onChange: (updated: EditorItem) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  isOnly: boolean
  isFirst: boolean
  isLast: boolean
  sortMode: boolean
}

function ItemRow({
  item, units, onChange, onDelete, onMoveUp, onMoveDown,
  isOnly, isFirst, isLast, sortMode,
}: ItemRowProps) {
  return (
    <div
      className="flex items-center gap-2 py-1.5 px-2 rounded group transition-colors hover:bg-slate-50 bg-white"
      data-nav-row
      data-key={item._key}
    >
      {/* ドラッグハンドル（常時表示、sortMode 時は ▲▼ に切り替え） */}
      {sortMode ? (
        <div className="flex flex-col gap-0 flex-shrink-0 drag-handle cursor-default">
          <button type="button" onClick={onMoveUp} disabled={isFirst}
            className="w-5 h-4 flex items-center justify-center rounded text-blue-400 hover:text-blue-700 hover:bg-blue-100 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onMoveDown} disabled={isLast}
            className="w-5 h-4 flex items-center justify-center rounded text-blue-400 hover:text-blue-700 hover:bg-blue-100 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div
          className="drag-handle flex-shrink-0 cursor-grab active:cursor-grabbing touch-none text-slate-300 hover:text-slate-500 transition-colors"
          title="ドラッグで並び替え（長押しでも可）"
        >
          <GripVertical className="w-4 h-4" />
        </div>
      )}

      {/* 項目名 */}
      <Input
        value={item.name}
        onChange={(e) => onChange({ ...item, name: e.target.value })}
        placeholder="項目名を入力"
        className="flex-1 h-8 text-sm border-transparent bg-transparent hover:bg-white focus:bg-white"
        data-nav-col="0"
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return
          if (e.key === "Enter")     { e.preventDefault(); navigateCellNext(e.currentTarget) }
          if (e.key === "ArrowUp")   { e.preventDefault(); navigateCell(e.currentTarget, "up") }
          if (e.key === "ArrowDown") { e.preventDefault(); navigateCell(e.currentTarget, "down") }
          if (e.key === "ArrowRight" && e.currentTarget.selectionStart === e.currentTarget.value.length)
            { e.preventDefault(); navigateCell(e.currentTarget, "right") }
          if (e.key === "ArrowLeft" && e.currentTarget.selectionStart === 0)
            { e.preventDefault(); navigateCell(e.currentTarget, "left") }
        }}
      />

      {/* 数量 */}
      <Input
        type="number" value={item.quantity}
        onChange={(e) => onChange({ ...item, quantity: Number(e.target.value) || 0 })}
        onFocus={(e) => { if (Number(e.target.value) === 0) e.target.select() }}
        className="w-20 h-8 text-sm text-right border-transparent bg-transparent hover:bg-white focus:bg-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        min={0} step="1" data-nav-col="1"
        onKeyDown={(e) => {
          if (e.key === "Enter")      { e.preventDefault(); navigateCellNext(e.currentTarget) }
          if (e.key === "ArrowUp")    { e.preventDefault(); navigateCell(e.currentTarget, "up") }
          if (e.key === "ArrowDown")  { e.preventDefault(); navigateCell(e.currentTarget, "down") }
          if (e.key === "ArrowLeft")  { e.preventDefault(); navigateCell(e.currentTarget, "left") }
          if (e.key === "ArrowRight") { e.preventDefault(); navigateCell(e.currentTarget, "right") }
        }}
      />

      {/* 単位 */}
      <Select value={item.unitId} onValueChange={(v) => onChange({ ...item, unitId: v })}>
        <SelectTrigger className="w-20 h-8 text-sm border-transparent bg-transparent hover:bg-white focus:bg-white">
          <SelectValue placeholder="単位" />
        </SelectTrigger>
        <SelectContent>
          {units.map((u) => (
            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 単価 */}
      <Input
        type="number" value={item.unitPrice}
        onChange={(e) => onChange({ ...item, unitPrice: Number(e.target.value) || 0 })}
        onFocus={(e) => { if (Number(e.target.value) === 0) e.target.select() }}
        className="w-28 h-8 text-sm text-right border-transparent bg-transparent hover:bg-white focus:bg-white"
        min={0} step="10" data-nav-col="2"
        onKeyDown={(e) => {
          if (e.key === "Enter")      { e.preventDefault(); navigateCellNext(e.currentTarget) }
          if (e.key === "ArrowUp")    { e.preventDefault(); navigateCell(e.currentTarget, "up") }
          if (e.key === "ArrowDown")  { e.preventDefault(); navigateCell(e.currentTarget, "down") }
          if (e.key === "ArrowLeft")  { e.preventDefault(); navigateCell(e.currentTarget, "left") }
          if (e.key === "ArrowRight") { e.preventDefault(); navigateCell(e.currentTarget, "right") }
        }}
      />

      {/* 金額 */}
      <div className="w-28 text-sm text-right font-mono text-slate-700 pr-1 flex-shrink-0">
        ¥{formatCurrency(item.quantity * item.unitPrice)}
      </div>

      {/* 削除 */}
      <button type="button" onClick={onDelete} disabled={isOnly}
        className="w-7 h-7 flex items-center justify-center rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-20 disabled:cursor-not-allowed flex-shrink-0"
        title="行を削除">
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
  onMoveUp: () => void
  onMoveDown: () => void
  isOnly: boolean
  isFirst: boolean
  isLast: boolean
  sortMode: boolean
  sectionKey: string   // SortableList の id に使用
  groupIndex: number
}

function GroupBlock({
  group, units, onChange, onDelete,
  onMoveUp, onMoveDown,
  isOnly, isFirst, isLast, sortMode,
  sectionKey, groupIndex,
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
    onChange({ ...group, items: [...group.items, newItem(group.items.length + 1)] })
  }

  function moveItem(idx: number, dir: "up" | "down") {
    const target = dir === "up" ? idx - 1 : idx + 1
    const items = [...group.items]
    ;[items[idx], items[target]] = [items[target], items[idx]]
    onChange({ ...group, items: items.map((it, i) => ({ ...it, sortOrder: i + 1 })) })
  }

  function reorderItems(from: number, to: number) {
    const items = [...group.items]
    const [moved] = items.splice(from, 1)
    items.splice(to, 0, moved)
    onChange({ ...group, items: items.map((it, i) => ({ ...it, sortOrder: i + 1 })) })
  }

  const sortableId = `items-${sectionKey}-${groupIndex}`

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden mb-3">
      {/* グループヘッダー */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-100">
        {/* グループのドラッグハンドル（sortMode 時は ▲▼） */}
        {sortMode ? (
          <div className="flex flex-col flex-shrink-0">
            <button type="button" onClick={onMoveUp} disabled={isFirst}
              className="w-5 h-4 flex items-center justify-center rounded text-blue-400 hover:text-blue-700 hover:bg-blue-100 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={onMoveDown} disabled={isLast}
              className="w-5 h-4 flex items-center justify-center rounded text-blue-400 hover:text-blue-700 hover:bg-blue-100 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="drag-handle flex-shrink-0 cursor-grab active:cursor-grabbing touch-none text-slate-400 hover:text-slate-600 transition-colors"
            title="ドラッグでグループを並び替え">
            <GripVertical className="w-4 h-4" />
          </div>
        )}

        <Input
          value={group.name}
          onChange={(e) => onChange({ ...group, name: e.target.value })}
          placeholder="グループ名（中項目）"
          className="flex-1 h-7 text-sm font-medium border-transparent bg-transparent hover:bg-white focus:bg-white"
        />
        <button type="button" onClick={onDelete} disabled={isOnly}
          className="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-100 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
          title="グループを削除">
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

      {/* 明細行リスト（SortableJS） */}
      <SortableList
        key={sortMode ? `sort-${sortableId}` : `drag-${sortableId}`}
        id={sortableId}
        items={group.items}
        onReorder={reorderItems}
        className="divide-y divide-slate-100"
        handle=".drag-handle"
        disabled={sortMode}   // sortMode 時は ▲▼ ボタン操作に切り替え
      >
        {group.items.map((item, idx) => (
          <ItemRow
            key={item._key}
            item={item}
            units={units}
            onChange={(updated) => updateItem(idx, updated)}
            onDelete={() => deleteItem(idx)}
            onMoveUp={() => moveItem(idx, "up")}
            onMoveDown={() => moveItem(idx, "down")}
            isOnly={group.items.length === 1}
            isFirst={idx === 0}
            isLast={idx === group.items.length - 1}
            sortMode={sortMode}
          />
        ))}
      </SortableList>

      {/* 行追加 */}
      <div className="px-3 py-2 border-t border-slate-100">
        <button type="button" onClick={addItem}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
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
  sortMode: boolean
}

function SectionBlock({
  section, units, onChange, onDelete,
  onMoveUp, onMoveDown,
  isFirst, isLast, isOnly, sortMode,
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
    onChange({ ...section, groups: [...section.groups, newGroup(section.groups.length + 1)] })
  }

  function moveGroup(idx: number, dir: "up" | "down") {
    const target = dir === "up" ? idx - 1 : idx + 1
    const groups = [...section.groups]
    ;[groups[idx], groups[target]] = [groups[target], groups[idx]]
    onChange({ ...section, groups: groups.map((g, i) => ({ ...g, sortOrder: i + 1 })) })
  }

  function reorderGroups(from: number, to: number) {
    const groups = [...section.groups]
    const [moved] = groups.splice(from, 1)
    groups.splice(to, 0, moved)
    onChange({ ...section, groups: groups.map((g, i) => ({ ...g, sortOrder: i + 1 })) })
  }

  const sectionTotal = section.groups.reduce(
    (s, g) => s + g.items.reduce((si, i) => si + i.quantity * i.unitPrice, 0),
    0
  )

  return (
    <Card className="border-2 border-slate-200">
      {/* セクションヘッダー */}
      <CardHeader className="py-3 px-4 bg-slate-800 text-white rounded-t-lg">
        <div className="flex items-center gap-2">
          {sortMode ? (
            <div className="flex flex-col gap-0.5 flex-shrink-0">
              <button type="button" onClick={onMoveUp} disabled={isFirst}
                className="text-slate-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={onMoveDown} disabled={isLast}
                className="text-slate-400 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="drag-handle flex-shrink-0 cursor-grab active:cursor-grabbing touch-none text-slate-500 hover:text-white transition-colors"
              title="ドラッグでセクションを並び替え">
              <GripVertical className="w-4 h-4" />
            </div>
          )}

          <Input
            value={section.name}
            onChange={(e) => onChange({ ...section, name: e.target.value })}
            placeholder="セクション名（大項目）"
            className="flex-1 h-8 text-sm font-bold bg-transparent border-transparent text-white placeholder:text-slate-400 hover:bg-slate-700 focus:bg-slate-700"
          />
          <span className="text-sm font-mono text-slate-300 whitespace-nowrap">
            小計: ¥{formatCurrency(sectionTotal)}
          </span>
          <button type="button" onClick={onDelete} disabled={isOnly}
            className="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
            title="セクションを削除">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-0">
        {/* グループリスト（SortableJS） */}
        <SortableList
          key={sortMode ? `sort-groups-${section._key}` : `drag-groups-${section._key}`}
          id={`groups-${section._key}`}
          items={section.groups}
          onReorder={reorderGroups}
          handle=".drag-handle"
          disabled={sortMode}
        >
          {section.groups.map((group, idx) => (
            <GroupBlock
              key={group._key}
              group={group}
              units={units}
              onChange={(updated) => updateGroup(idx, updated)}
              onDelete={() => deleteGroup(idx)}
              onMoveUp={() => moveGroup(idx, "up")}
              onMoveDown={() => moveGroup(idx, "down")}
              isOnly={section.groups.length === 1}
              isFirst={idx === 0}
              isLast={idx === section.groups.length - 1}
              sortMode={sortMode}
              sectionKey={section._key}
              groupIndex={idx}
            />
          ))}
        </SortableList>

        {/* グループ追加 */}
        <button type="button" onClick={addGroup}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 font-medium mt-2">
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
  initialTitle,
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
  const [title, setTitle] = useState(initialTitle ?? "")
  const [note, setNote] = useState(initialNote ?? "")
  const [discount, setDiscount] = useState(initialDiscount)
  const [validDays, setValidDays] = useState(initialValidDays)
  const [saving, setSaving] = useState(false)
  const [sortMode, setSortMode] = useState(false)

  // ── 合計計算 ──────────────────────────────────────────
  const subtotal = sections.reduce(
    (s, sec) => s + sec.groups.reduce(
      (gs, g) => gs + g.items.reduce((is, i) => is + i.quantity * i.unitPrice, 0), 0
    ), 0
  )
  const taxable = subtotal - discount
  const tax = Math.floor(taxable * taxRate)
  const total = taxable + tax

  // ── セクション操作 ────────────────────────────────────
  const updateSection = useCallback((idx: number, updated: EditorSection) => {
    setSections((prev) => prev.map((s, i) => (i === idx ? updated : s)))
  }, [])

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

  function reorderSections(from: number, to: number) {
    setSections((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next.map((s, i) => ({ ...s, sortOrder: i + 1 }))
    })
  }

  // ── 保存 ─────────────────────────────────────────────
  async function handleSave() {
    if (sortMode) {
      toast.error("並び替えモードを終了してから保存してください")
      return
    }
    for (const sec of sections) {
      if (!sec.name.trim()) { toast.error("セクション名が空のものがあります"); return }
      for (const grp of sec.groups) {
        if (!grp.name.trim()) { toast.error("グループ名が空のものがあります"); return }
        for (const item of grp.items) {
          if (!item.name.trim()) { toast.error("項目名が空のものがあります"); return }
          if (!item.unitId) { toast.error(`「${item.name}」の単位を選択してください`); return }
        }
      }
    }

    setSaving(true)
    try {
      const payload = {
        title: title.trim() || null,
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
    <>
      {/* SortableJS のドラッグ中スタイル */}
      <style>{`
        .sortable-ghost  { opacity: 0.35; background: #eff6ff !important; border-radius: 8px; }
        .sortable-chosen { background: #eff6ff !important; box-shadow: 0 4px 16px 0 rgba(59,130,246,0.18); }
        .sortable-drag   { box-shadow: 0 8px 24px 0 rgba(59,130,246,0.22); }
      `}</style>

      <div className="space-y-6">
        {/* アクションバー */}
        <div className="flex items-center gap-3 sticky top-0 z-10 bg-white/90 backdrop-blur-sm py-3 px-4 -mx-4 border-b border-slate-200 shadow-sm">
          <button type="button" onClick={onCancel}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
            <ArrowLeft className="w-4 h-4" />
            キャンセル
          </button>
          <span className="text-slate-300">|</span>

          {sortMode ? (
            <span className="text-sm text-blue-600 font-semibold flex items-center gap-1.5">
              <ArrowUpDown className="w-4 h-4" />
              並び替えモード（▲▼ボタン）
            </span>
          ) : (
            <span className="text-sm text-orange-600 font-medium">
              編集中（下書き）— ≡ をドラッグで並び替え
            </span>
          )}

          <div className="flex-1" />
          <div className="text-sm font-mono font-bold text-slate-700">
            合計: ¥{formatCurrency(total)}
          </div>

          {/* 並び替えモードトグル */}
          <Button
            type="button"
            variant={sortMode ? "default" : "outline"}
            size="sm"
            onClick={() => setSortMode((v) => !v)}
            className={sortMode
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-600"}
          >
            <ArrowUpDown className="w-4 h-4 mr-1.5" />
            {sortMode ? "▲▼モード終了" : "▲▼ で並び替え"}
          </Button>

          <Button onClick={handleSave} disabled={saving || sortMode} size="sm"
            title={sortMode ? "並び替えモードを終了してから保存してください" : undefined}>
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? "保存中..." : "保存する"}
          </Button>
        </div>

        {/* ドラッグ操作の案内バナー（通常モード時のみ） */}
        {!sortMode && (
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
            <GripVertical className="w-4 h-4 flex-shrink-0" />
            <span>
              各行左端の <strong className="text-slate-600">≡</strong> をドラッグ（PC）または長押し（スマホ）で並び替えできます。
              ボタン操作の場合は「▲▼ で並び替え」をご利用ください。
            </span>
          </div>
        )}

        {/* 見積タイトル編集 */}
        <div className="rounded-xl border-2 border-indigo-200 bg-gradient-to-r from-indigo-50 to-white overflow-hidden">
          <div className="flex items-center gap-2 px-4 pt-3 pb-2">
            <Tag className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-bold text-indigo-700 tracking-wide">見積タイトル</span>
          </div>
          <div className="px-4 pb-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 〇〇邸 足場工事（タイトルを入力してください）"
              className="text-base font-bold border-indigo-300 focus:border-indigo-500 focus:ring-indigo-400 bg-white h-11"
            />
          </div>
        </div>

        {/* セクションリスト（SortableJS） */}
        <SortableList
          key={sortMode ? "sort-sections" : "drag-sections"}
          id="sections"
          items={sections}
          onReorder={reorderSections}
          className="space-y-4"
          handle=".drag-handle"
          disabled={sortMode}
        >
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
              sortMode={sortMode}
            />
          ))}
        </SortableList>

        {/* セクション追加 */}
        <button type="button" onClick={addSection}
          className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:text-slate-700 hover:border-slate-400 transition-colors flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" />
          セクション（大項目）を追加
        </button>

        {/* 備考・値引き・合計 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
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
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                有効期限（日数）
              </label>
              <div className="flex items-center gap-2">
                <Input type="number" value={validDays}
                  onChange={(e) => setValidDays(Number(e.target.value) || 30)}
                  className="w-24" min={1} step="1" />
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
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">値引き</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">-¥</span>
                  <Input type="number" value={discount}
                    onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                    onFocus={(e) => { if (Number(e.target.value) === 0) e.target.select() }}
                    className="w-32 h-7 text-sm text-right font-mono" min={0} step="10" />
                </div>
              </div>
              <div className="flex justify-between items-center text-sm border-t border-slate-200 pt-3">
                <span className="text-slate-500">課税対象額（税抜）</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">¥</span>
                  <Input
                    type="number"
                    value={taxable}
                    onChange={(e) => {
                      const newTaxable = Number(e.target.value) || 0
                      setDiscount(Math.max(0, subtotal - newTaxable))
                    }}
                    className="w-36 h-7 text-sm text-right font-mono"
                    min={0}
                    step="100"
                  />
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">消費税（{Math.round(taxRate * 100)}%）</span>
                <span className="font-mono">¥{formatCurrency(tax)}</span>
              </div>
              <div className="flex justify-between text-base font-bold border-t-2 border-slate-300 pt-3">
                <span>合計（税込）</span>
                <span className="font-mono text-lg text-blue-700">¥{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 下部保存 */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button variant="outline" onClick={onCancel}>キャンセル</Button>
          <Button onClick={handleSave} disabled={saving || sortMode}
            title={sortMode ? "並び替えモードを終了してから保存してください" : undefined}>
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? "保存中..." : "見積を保存する"}
          </Button>
        </div>
      </div>
    </>
  )
}

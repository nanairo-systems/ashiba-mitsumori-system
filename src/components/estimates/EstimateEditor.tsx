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
import { cn, formatCurrency } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
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
  ChevronRight,
  ChevronLeft,
} from "lucide-react"
import { toast } from "sonner"
import { ItemPickerDialog, type PickedItem } from "@/components/estimates/ItemPickerDialog"
import { Package } from "lucide-react"

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
  autoOpenPicker?: boolean
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

// ─── 数値入力ヘルパー: フォーカス時に全選択 + モバイル対応 ──

interface NumericInputProps extends Omit<React.ComponentProps<"input">, "value" | "onChange"> {
  value: number
  onChange: (value: number) => void
  isMobile: boolean
}

function NumericInput({ value, onChange, isMobile, className, ...rest }: NumericInputProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState("")

  if (isMobile) {
    return (
      <Input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={editing ? editValue : (value === 0 ? "0" : formatCurrency(value))}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d]/g, "")
          setEditValue(raw)
          onChange(Number(raw) || 0)
        }}
        onFocus={(e) => {
          setEditing(true)
          setEditValue(value === 0 ? "" : String(value))
          setTimeout(() => e.target.select(), 0)
        }}
        onBlur={() => setEditing(false)}
        className={cn(
          "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          className
        )}
        {...rest}
      />
    )
  }

  return (
    <Input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      onFocus={(e) => e.target.select()}
      className={cn(
        "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        className
      )}
      {...rest}
    />
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
  isMobile: boolean
}

function ItemRow({
  item, units, onChange, onDelete, onMoveUp, onMoveDown,
  isOnly, isFirst, isLast, sortMode, isMobile,
}: ItemRowProps) {
  if (isMobile) {
    return (
      <div className="px-1.5 py-1.5 bg-white" data-key={item._key}>
        <div className="flex items-start gap-1">
          {/* ドラッグハンドル / ソートボタン */}
          {sortMode ? (
            <div className="flex flex-col gap-0 flex-shrink-0 mt-1.5">
              <button type="button" onClick={onMoveUp} disabled={isFirst}
                className="w-6 h-6 flex items-center justify-center rounded text-blue-400 hover:text-blue-700 disabled:opacity-20 disabled:cursor-not-allowed">
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={onMoveDown} disabled={isLast}
                className="w-6 h-6 flex items-center justify-center rounded text-blue-400 hover:text-blue-700 disabled:opacity-20 disabled:cursor-not-allowed">
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="drag-handle flex-shrink-0 cursor-grab active:cursor-grabbing touch-none text-slate-300 mt-2.5">
              <GripVertical className="w-4 h-4" />
            </div>
          )}

          <div className="flex-1 min-w-0 space-y-1">
            {/* 項目名 + 削除ボタン (同じ行) */}
            <div className="flex items-center gap-1">
              <Input
                value={item.name}
                onChange={(e) => onChange({ ...item, name: e.target.value })}
                placeholder="項目名"
                className="h-9 text-sm flex-1 min-w-0"
              />
              <button type="button" onClick={onDelete} disabled={isOnly}
                className="w-7 h-7 flex items-center justify-center rounded text-slate-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-20 disabled:cursor-not-allowed flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {/* 数量 / 単位 / 単価 / 金額 */}
            <div className="flex items-center gap-1">
              <NumericInput
                value={item.quantity}
                onChange={(q) => onChange({ ...item, quantity: q })}
                isMobile={true}
                className="w-14 h-8 text-xs text-right"
                min={0} step="1"
                placeholder="数量"
              />
              <Select value={item.unitId} onValueChange={(v) => onChange({ ...item, unitId: v })}>
                <SelectTrigger className="w-14 h-8 text-xs px-1.5">
                  <SelectValue placeholder="単位" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-slate-400 flex-shrink-0">×</span>
              <NumericInput
                value={item.unitPrice}
                onChange={(p) => onChange({ ...item, unitPrice: p })}
                isMobile={true}
                className="flex-1 min-w-0 h-8 text-xs text-right"
                min={0} step="10"
                placeholder="単価"
              />
              <span className="text-xs font-mono font-semibold text-slate-600 flex-shrink-0 whitespace-nowrap">
                ={formatCurrency(item.quantity * item.unitPrice)}
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

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
        onFocus={(e) => e.target.select()}
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
        onFocus={(e) => e.target.select()}
        className="w-28 h-8 text-sm text-right border-transparent bg-transparent hover:bg-white focus:bg-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
  isMobile: boolean
}

function GroupBlock({
  group, units, onChange, onDelete,
  onMoveUp, onMoveDown,
  isOnly, isFirst, isLast, sortMode,
  sectionKey, groupIndex, isMobile,
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
    <div className={cn(
      isMobile
        ? "border-l-2 border-slate-300 mb-2"
        : "border border-slate-200 rounded-lg overflow-hidden mb-3"
    )}>
      {/* グループヘッダー */}
      <div className={cn(
        "flex items-center gap-1.5",
        isMobile ? "px-2 py-1.5 bg-slate-50" : "px-3 py-2 bg-slate-100"
      )}>
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
          placeholder={isMobile ? "グループ名" : "グループ名（中項目）"}
          className={cn(
            "flex-1 font-medium border-transparent bg-transparent hover:bg-white focus:bg-white",
            isMobile ? "h-7 text-xs min-w-0" : "h-7 text-sm"
          )}
        />
        <button type="button" onClick={onDelete} disabled={isOnly}
          className="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-100 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
          title="グループを削除">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 列ヘッダー（デスクトップのみ） */}
      {!isMobile && (
        <div className="flex items-center gap-2 px-2 py-1 bg-slate-50 border-b border-slate-200">
          <div className="w-4 flex-shrink-0" />
          <div className="flex-1 text-xs text-slate-400">項目名</div>
          <div className="w-20 text-xs text-slate-400 text-right">数量</div>
          <div className="w-20 text-xs text-slate-400 text-center">単位</div>
          <div className="w-28 text-xs text-slate-400 text-right">単価（円）</div>
          <div className="w-28 text-xs text-slate-400 text-right">金額（円）</div>
          <div className="w-7 flex-shrink-0" />
        </div>
      )}

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
            isMobile={isMobile}
          />
        ))}
      </SortableList>

      {/* 行追加 */}
      <div className={cn(isMobile ? "px-2 py-1.5" : "px-3 py-2 border-t border-slate-100")}>
        <div className="flex items-center gap-3">
          <button type="button" onClick={addItem}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
            <Plus className="w-3.5 h-3.5" />
            行を追加
          </button>
        </div>
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
  isMobile: boolean
  onOpenPicker: () => void
}

function SectionBlock({
  section, units, onChange, onDelete,
  onMoveUp, onMoveDown,
  isFirst, isLast, isOnly, sortMode, isMobile,
  onOpenPicker,
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
    <Card className={cn(isMobile ? "border border-slate-200 rounded-lg" : "border-2 border-slate-200")}>
      {/* セクションヘッダー */}
      <CardHeader className={cn("bg-slate-800 text-white rounded-t-lg", isMobile ? "py-2 px-2.5" : "py-3 px-4")}>
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
            placeholder={isMobile ? "セクション名" : "セクション名（大項目）"}
            className={`flex-1 h-8 text-sm font-bold bg-transparent border-transparent text-white placeholder:text-slate-400 hover:bg-slate-700 focus:bg-slate-700 ${isMobile ? "min-w-0" : ""}`}
          />
          <span className={`font-mono text-slate-300 whitespace-nowrap ${isMobile ? "text-xs" : "text-sm"}`}>
            {isMobile ? `¥${formatCurrency(sectionTotal)}` : `小計: ¥${formatCurrency(sectionTotal)}`}
          </span>
          <button type="button" onClick={onDelete} disabled={isOnly}
            className="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
            title="セクションを削除">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </CardHeader>

      <CardContent className={cn(isMobile ? "p-1.5 space-y-0" : "p-4 space-y-0")}>
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
              isMobile={isMobile}
            />
          ))}
        </SortableList>

        {/* グループ追加 / マスタから追加 */}
        <div className="flex items-center gap-4 mt-2">
          <button type="button" onClick={addGroup}
            className={cn("flex items-center gap-1 text-slate-500 hover:text-slate-700 font-medium", isMobile ? "text-xs ml-1" : "text-sm")}>
            <Plus className={isMobile ? "w-3.5 h-3.5" : "w-4 h-4"} />
            グループ（中項目）を追加
          </button>
          <button type="button" onClick={onOpenPicker}
            className={cn("flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium", isMobile ? "text-xs" : "text-sm")}>
            <Package className={isMobile ? "w-3.5 h-3.5" : "w-4 h-4"} />
            マスタから追加
          </button>
        </div>
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
  autoOpenPicker = false,
  onSaved,
  onCancel,
}: Props) {
  const isViewportMobile = useIsMobile()
  // コンテナ幅が狭い場合（スプリットビュー等）もモバイルレイアウトを使う
  const containerRef = useRef<HTMLDivElement>(null)
  const [isNarrow, setIsNarrow] = useState(false)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsNarrow(entry.contentRect.width < 640)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const isMobile = isViewportMobile || isNarrow
  const [sections, setSections] = useState<EditorSection[]>(initialSections)
  const [title, setTitle] = useState(initialTitle ?? "")
  const [note, setNote] = useState(initialNote ?? "")
  const [discount, setDiscount] = useState(initialDiscount)
  const [validDays, setValidDays] = useState(initialValidDays)
  const [saving, setSaving] = useState(false)
  const [sortMode, setSortMode] = useState(false)

  // ── 項目マスタ一括追加 ─────────────────────────
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerTarget, setPickerTarget] = useState<{ sectionIdx: number } | null>(null)

  // ── autoOpenPicker: マスタから作成フロー時に自動でピッカーを開く ──
  const autoPickerDone = useRef(false)
  useEffect(() => {
    if (!autoOpenPicker || autoPickerDone.current) return
    autoPickerDone.current = true

    // URLからopenPickerパラメータを除去
    const url = new URL(window.location.href)
    if (url.searchParams.has("openPicker")) {
      url.searchParams.delete("openPicker")
      window.history.replaceState({}, "", url.pathname + (url.search || ""))
    }

    // セクションがなければデフォルトセクションを作成
    if (sections.length === 0) {
      const defaultSection: EditorSection = {
        _key: newKey(),
        name: "足場工事",
        sortOrder: 1,
        groups: [],
      }
      setSections([defaultSection])
    }

    // 少し遅延してピッカーを開く（state反映を待つ）
    setTimeout(() => {
      setPickerTarget({ sectionIdx: 0 })
      setPickerOpen(true)
    }, 100)
  }, [autoOpenPicker, sections.length])

  function handleBulkAdd(pickedItems: PickedItem[]) {
    if (!pickerTarget || pickedItems.length === 0) return
    const { sectionIdx } = pickerTarget

    // カテゴリ（= グループ名）ごとにアイテムを分類
    const byCategory = new Map<string, PickedItem[]>()
    for (const item of pickedItems) {
      const cat = item.categoryName || "その他"
      if (!byCategory.has(cat)) byCategory.set(cat, [])
      byCategory.get(cat)!.push(item)
    }

    setSections((prev) => {
      const next = prev.map((s) => ({
        ...s,
        groups: s.groups.map((g) => ({ ...g, items: [...g.items] })),
      }))
      const section = next[sectionIdx]
      if (!section) return prev

      for (const [categoryName, items] of byCategory) {
        // 同名のグループがあればそこに追加、なければ新規作成
        let group = section.groups.find((g) => g.name === categoryName)
        if (!group) {
          group = {
            _key: newKey(),
            name: categoryName,
            sortOrder: section.groups.length + 1,
            items: [],
          }
          section.groups.push(group)
        }
        const startOrder = group.items.length + 1
        const newItems = items.map((item, i) => ({
          _key: newKey(),
          name: item.name,
          quantity: 1,
          unitId: item.unitId,
          unitPrice: item.unitPrice,
          sortOrder: startOrder + i,
        }))
        group.items = [...group.items, ...newItems]
      }
      return next
    })
    setPickerTarget(null)
  }

  // ── スワイプで合計画面切替（モバイルのみ） ──────────────
  const [showSummary, setShowSummary] = useState(false)
  const [swipeOffset, setSwipeOffset] = useState(0)        // ドラッグ中の移動px
  const [isTransitioning, setIsTransitioning] = useState(false)
  const touchRef = useRef<{ startX: number; startY: number; tracking: boolean } | null>(null)

  function handleTouchStart(e: React.TouchEvent) {
    if (!isMobile) return
    const t = e.touches[0]
    touchRef.current = { startX: t.clientX, startY: t.clientY, tracking: false }
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!isMobile || !touchRef.current) return
    const t = e.touches[0]
    const dx = t.clientX - touchRef.current.startX
    const dy = t.clientY - touchRef.current.startY

    // 最初の移動で水平/垂直判定（水平優勢ならスワイプ追跡）
    if (!touchRef.current.tracking) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        touchRef.current.tracking = true
      } else if (Math.abs(dy) > 10) {
        touchRef.current = null  // 縦スクロール → 無視
        return
      }
      return
    }

    // 合計画面表示中: 右スワイプのみ許可
    const w = window.innerWidth
    if (showSummary) {
      setSwipeOffset(Math.max(0, Math.min(dx, w)))
    } else {
      // 編集画面表示中: 左スワイプのみ許可
      setSwipeOffset(Math.min(0, Math.max(dx, -w)))
    }
  }

  function handleTouchEnd() {
    if (!isMobile || !touchRef.current?.tracking) {
      touchRef.current = null
      setSwipeOffset(0)
      return
    }
    const w = typeof window !== "undefined" ? window.innerWidth : 375
    const threshold = w * 0.2  // 画面幅の20%で切替判定
    touchRef.current = null

    // アニメーションを有効にしてからオフセットをリセット
    setIsTransitioning(true)

    if (showSummary && swipeOffset > threshold) {
      // 右スワイプ → 編集画面に戻る
      setShowSummary(false)
    } else if (!showSummary && swipeOffset < -threshold) {
      // 左スワイプ → 合計画面を表示
      setShowSummary(true)
    }
    // スワイプオフセットをリセット（CSSトランジションで滑らかに戻る）
    setSwipeOffset(0)
    setTimeout(() => setIsTransitioning(false), 320)
  }

  /** ボタンタップでサマリー画面を開閉（アニメーション付き） */
  function toggleSummary(show: boolean) {
    setIsTransitioning(true)
    setShowSummary(show)
    setTimeout(() => setIsTransitioning(false), 320)
  }

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

  // スワイプのtranslate計算（両画面が指に追従してスライド）
  const screenW = typeof window !== "undefined" ? window.innerWidth : 375
  const swipePct = (swipeOffset / screenW) * 100
  // 編集画面: 通常0% → サマリー表示時-100%
  const editorTranslateX = isMobile
    ? (showSummary ? -100 : 0) + swipePct
    : 0
  // サマリー画面: 通常100%(右に隠れ) → 表示時0%
  const summaryTranslateX = isMobile
    ? (showSummary ? 0 : 100) + swipePct
    : 100

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={isMobile ? "relative overflow-hidden" : ""}
    >
      {/* SortableJS のドラッグ中スタイル */}
      <style>{`
        .sortable-ghost  { opacity: 0.35; background: #eff6ff !important; border-radius: 8px; }
        .sortable-chosen { background: #eff6ff !important; box-shadow: 0 4px 16px 0 rgba(59,130,246,0.18); }
        .sortable-drag   { box-shadow: 0 8px 24px 0 rgba(59,130,246,0.22); }
      `}</style>

      {/* ─── モバイル: 合計サマリー画面（右からスライドイン） ─── */}
      {isMobile && (
        <div
          className="fixed inset-0 z-50 bg-white flex flex-col"
          style={{
            transform: `translateX(${summaryTranslateX}%)`,
            transition: isTransitioning ? "transform 0.3s ease-out" : "none",
            willChange: "transform",
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* サマリーヘッダー */}
          <div className="bg-white border-b border-slate-200 shadow-sm py-2.5 px-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => toggleSummary(false)}
                className="flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-800 shrink-0 font-medium">
                <ChevronLeft className="w-3.5 h-3.5" />
                編集に戻る
              </button>
              <div className="flex-1" />
              <span className="text-xs text-slate-500 font-medium">金額サマリー</span>
            </div>
          </div>

          {/* サマリー内容 - 1画面に収まるよう flex-1 + overflow-y-auto */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* 金額サマリー */}
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">小計（税抜）</span>
                  <span className="font-mono font-medium">¥{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">値引き</span>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 text-xs">-¥</span>
                    <NumericInput
                      value={discount}
                      onChange={(v) => setDiscount(Math.max(0, v))}
                      isMobile={true}
                      className="w-24 h-7 text-sm text-right font-mono"
                      min={0} step="10"
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center text-sm border-t border-slate-200 pt-2">
                  <span className="text-slate-500">課税対象額</span>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 text-xs">¥</span>
                    <NumericInput
                      value={taxable}
                      onChange={(v) => setDiscount(Math.max(0, subtotal - v))}
                      isMobile={true}
                      className="w-28 h-7 text-sm text-right font-mono"
                      min={0} step="100"
                    />
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">消費税（{Math.round(taxRate * 100)}%）</span>
                  <span className="font-mono">¥{formatCurrency(tax)}</span>
                </div>
                <div className="flex justify-between items-baseline border-t-2 border-slate-300 pt-2">
                  <span className="text-sm font-bold">合計（税込）</span>
                  <span className="font-mono text-xl font-bold text-blue-700">¥{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            {/* セクション別小計 */}
            <div className="bg-white rounded-xl border border-slate-200 p-3">
              <h3 className="text-xs font-bold text-slate-500 mb-2">セクション別内訳</h3>
              <div className="space-y-1.5">
                {sections.map((sec) => {
                  const secTotal = sec.groups.reduce(
                    (s, g) => s + g.items.reduce((si, i) => si + i.quantity * i.unitPrice, 0), 0
                  )
                  return (
                    <div key={sec._key} className="flex justify-between text-sm">
                      <span className="text-slate-600 truncate mr-2">{sec.name || "（未入力）"}</span>
                      <span className="font-mono text-slate-700 shrink-0">¥{formatCurrency(secTotal)}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 備考 */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">備考</label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="見積に関する備考を入力（任意）"
                rows={3}
                className="resize-none text-sm"
              />
            </div>

            {/* 有効期限 */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-500 shrink-0">有効期限</label>
              <Input type="number" value={validDays}
                onChange={(e) => setValidDays(Number(e.target.value) || 30)}
                className="w-20 h-7 text-sm" min={1} step="1" />
              <span className="text-xs text-slate-500">日間</span>
            </div>
          </div>

          {/* 固定フッター: 保存ボタン */}
          <div className="flex-shrink-0 border-t border-slate-200 bg-white px-3 py-2.5 flex gap-3">
            <Button variant="outline" onClick={onCancel} size="sm" className="h-9">キャンセル</Button>
            <Button onClick={handleSave} disabled={saving || sortMode} size="sm" className="h-9 flex-1">
              <Save className="w-4 h-4 mr-1.5" />
              {saving ? "保存中..." : "保存する"}
            </Button>
          </div>
        </div>
      )}

      {/* ─── 編集画面（前面レイヤー） ─── */}
      <div
        className={isMobile ? "relative z-10 bg-white min-h-screen" : ""}
        style={isMobile ? {
          transform: `translateX(${editorTranslateX}%)`,
          transition: isTransitioning ? "transform 0.3s ease-out" : "none",
          willChange: "transform",
        } : undefined}
      >
      <div className={isMobile ? "space-y-4" : "space-y-6"}>
        {/* アクションバー */}
        {isMobile ? (
          <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm py-2 px-3 -mx-3 border-b border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center gap-2">
              <button type="button" onClick={onCancel}
                className="flex items-center gap-0.5 text-xs text-slate-500 hover:text-slate-700 shrink-0">
                <ArrowLeft className="w-3.5 h-3.5" />
                戻る
              </button>
              <span className="text-slate-300">|</span>
              {sortMode ? (
                <span className="text-xs text-blue-600 font-semibold flex items-center gap-1">
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  並び替えモード
                </span>
              ) : (
                <span className="text-xs text-orange-600 font-medium truncate">
                  編集中（下書き）
                </span>
              )}
              <div className="flex-1" />
              <button type="button"
                onClick={() => toggleSummary(true)}
                className="flex items-center gap-0.5 text-xs font-mono font-bold text-blue-700 shrink-0 active:bg-blue-50 rounded px-1 -mr-1">
                ¥{formatCurrency(total)}
                <ChevronRight className="w-3 h-3 text-blue-400" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={sortMode ? "default" : "outline"}
                size="sm"
                onClick={() => setSortMode((v) => !v)}
                className={`h-7 text-xs ${sortMode
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "border-slate-300 text-slate-600"}`}
              >
                <ArrowUpDown className="w-3.5 h-3.5 mr-1" />
                {sortMode ? "終了" : "▲▼並替"}
              </Button>
              <div className="flex-1" />
              <Button onClick={handleSave} disabled={saving || sortMode} size="sm" className="h-7 text-xs"
                title={sortMode ? "並び替えモードを終了してから保存してください" : undefined}>
                <Save className="w-3.5 h-3.5 mr-1" />
                {saving ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>
        ) : (
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
        )}

        {/* ドラッグ操作の案内バナー（通常モード時のみ） */}
        {!sortMode && !isMobile && (
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
            <GripVertical className="w-4 h-4 flex-shrink-0" />
            <span>
              各行左端の <strong className="text-slate-600">≡</strong> をドラッグ（PC）または長押し（スマホ）で並び替えできます。ボタン操作の場合は「▲▼ で並び替え」をご利用ください。
            </span>
          </div>
        )}

        {/* 見積タイトル編集 */}
        <div className="rounded-xl border-2 border-indigo-200 bg-gradient-to-r from-indigo-50 to-white overflow-hidden">
          <div className={`flex items-center gap-2 ${isMobile ? "px-3 pt-2 pb-1" : "px-4 pt-3 pb-2"}`}>
            <Tag className={`text-indigo-500 ${isMobile ? "w-3.5 h-3.5" : "w-4 h-4"}`} />
            <span className={`font-bold text-indigo-700 tracking-wide ${isMobile ? "text-xs" : "text-sm"}`}>見積タイトル</span>
          </div>
          <div className={isMobile ? "px-3 pb-2" : "px-4 pb-3"}>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isMobile ? "例: 〇〇邸 足場工事" : "例: 〇〇邸 足場工事（タイトルを入力してください）"}
              className={`font-bold border-indigo-300 focus:border-indigo-500 focus:ring-indigo-400 bg-white ${isMobile ? "text-sm h-9" : "text-base h-11"}`}
            />
          </div>
        </div>

        {/* セクションリスト（SortableJS） */}
        <SortableList
          key={sortMode ? "sort-sections" : "drag-sections"}
          id="sections"
          items={sections}
          onReorder={reorderSections}
          className={isMobile ? "space-y-3" : "space-y-4"}
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
              isMobile={isMobile}
              onOpenPicker={() => {
                setPickerTarget({ sectionIdx: idx })
                setPickerOpen(true)
              }}
            />
          ))}
        </SortableList>

        {/* セクション追加 */}
        <button type="button" onClick={addSection}
          className={cn(
            "w-full border-dashed rounded-lg text-slate-500 hover:text-slate-700 hover:border-slate-400 transition-colors flex items-center justify-center gap-2",
            isMobile ? "py-2 border border-slate-300 text-xs" : "py-3 border-2 border-slate-300 text-sm"
          )}>
          <Plus className={isMobile ? "w-3.5 h-3.5" : "w-4 h-4"} />
          セクション（大項目）を追加
        </button>

        {/* 備考・値引き・合計 */}
        {isMobile ? (
          /* モバイル: サマリー画面へ誘導するヒントバナー */
          <button type="button"
            onClick={() => toggleSummary(true)}
            className="w-full flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg px-3 py-3 active:bg-blue-100 transition-colors"
          >
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-xs font-medium text-blue-700">金額サマリー・備考</span>
              <span className="text-[10px] text-blue-500">← 左スワイプでも表示</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-mono font-bold text-blue-700">¥{formatCurrency(total)}</span>
              <ChevronRight className="w-4 h-4 text-blue-400" />
            </div>
          </button>
        ) : (
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
              <h3 className="font-medium text-slate-700 text-sm mb-4">金額サマリー</h3>
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
                      onFocus={(e) => e.target.select()}
                      className="w-32 h-7 text-sm text-right font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" min={0} step="10" />
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
                      onFocus={(e) => e.target.select()}
                      className="w-36 h-7 text-sm text-right font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
        )}

        {/* 下部保存 */}
        {isMobile ? (
          <div className="flex gap-3 pt-4 border-t border-slate-200 pb-20">
            <Button variant="outline" onClick={onCancel} size="sm">キャンセル</Button>
            <Button onClick={handleSave} disabled={saving || sortMode} size="sm"
              title={sortMode ? "並び替えモードを終了してから保存してください" : undefined}>
              <Save className="w-4 h-4 mr-1.5" />
              {saving ? "保存中..." : "保存する"}
            </Button>
          </div>
        ) : (
          <div className="flex gap-3 pt-4 border-t border-slate-200 justify-end">
            <Button variant="outline" onClick={onCancel}>キャンセル</Button>
            <Button onClick={handleSave} disabled={saving || sortMode}
              title={sortMode ? "並び替えモードを終了してから保存してください" : undefined}>
              <Save className="w-4 h-4 mr-1.5" />
              {saving ? "保存中..." : "見積を保存する"}
            </Button>
          </div>
        )}
      </div>
      </div>{/* 編集画面レイヤー閉じ */}

      {/* 項目マスタ一括追加ダイアログ */}
      <ItemPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onConfirm={handleBulkAdd}
      />
    </div>
  )
}

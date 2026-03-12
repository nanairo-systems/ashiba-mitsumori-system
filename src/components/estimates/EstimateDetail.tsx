/**
 * [COMPONENT] 見積詳細 - EstimateDetail
 *
 * ステータスに応じて「閲覧モード」と「編集モード」を切り替える。
 *
 * - DRAFT  → 編集ボタンで EstimateEditor に切り替え可能
 * - CONFIRMED → 確定済み（表示のみ）/ 送付済ボタン / 改訂版作成
 * - SENT   → 送付済（表示のみ）/ 改訂版作成
 * - OLD    → 旧版（表示のみ・操作なし）
 *
 * 確定・送付済の場合「改訂版を作成」すると新たなDRAFTが生まれ、
 * そこで編集 → 再確定 → 送付 という流れを繰り返す。
 */
"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ArrowLeft,
  CheckCircle2,
  Send,
  Copy,
  FileText,
  Pencil,
  Printer,
  LayoutTemplate,
  Loader2,
  MapPin,
  Tag,
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { KeyboardHint } from "@/components/ui/keyboard-hint"
import { EstimateEditor } from "./EstimateEditor"
import { EstimatePrint } from "./EstimatePrint"
import { EstimatePurchaseOrderSection } from "./EstimatePurchaseOrderSection"
import { EstimateScheduleSection } from "./EstimateScheduleSection"
import type { EstimateStatus, AddressType } from "@prisma/client"

// ─── 型定義 ────────────────────────────────────────────

const statusConfig: Record<
  EstimateStatus,
  { label: string; className: string }
> = {
  DRAFT: { label: "下書き", className: "bg-amber-500 text-white" },
  CONFIRMED: { label: "確定済", className: "bg-blue-500 text-white" },
  SENT: { label: "送付済", className: "bg-emerald-500 text-white" },
  OLD: { label: "旧版", className: "bg-slate-400 text-white" },
}

interface EstimateItem {
  id: string
  name: string
  quantity: number
  unitPrice: number
  unit: { id: string; name: string }
}

interface EstimateGroup {
  id: string
  name: string
  items: EstimateItem[]
}

interface EstimateSection {
  id: string
  name: string
  sortOrder: number
  groups: EstimateGroup[]
}

interface Unit {
  id: string
  name: string
}

interface ContactOption {
  id: string
  name: string
  phone: string
  email: string
}

interface Props {
  estimate: {
    id: string
    estimateNumber: string | null
    title: string | null
    revision: number
    status: EstimateStatus
    addressType: AddressType
    validDays: number
    note: string | null
    discountAmount: number | null
    confirmedAt: Date | null
    sentAt: Date | null
    createdAt: Date
    project: {
      id: string
      shortId: string
      name: string
      address?: string | null
      startDate?: Date | null
      endDate?: Date | null
      branch: { name: string; company: { name: string } }
      contact: { id: string; name: string } | null
    }
    user: { id: string; name: string }
    sections: EstimateSection[]
  }
  taxRate: number
  units: Unit[]
  currentUser: { id: string; name: string }
  contacts: ContactOption[]
  embedded?: boolean
  onClose?: () => void
  onNavigateEstimate?: (id: string) => void
  onEditingChange?: (editing: boolean) => void
  onRefresh?: () => void
  initialOpenPicker?: boolean
  purchaseOrder?: {
    id: string
    subcontractorId: string
    subcontractorName: string
    orderAmount: number
    taxRate: number
    note: string | null
    status: "DRAFT" | "ORDERED" | "COMPLETED"
    orderedAt: Date | null
  } | null
}

// ─── メインコンポーネント ───────────────────────────────

const NO_CONTACT = "__none__"

export function EstimateDetail({ estimate, taxRate, units, contacts, embedded = false, onClose, onNavigateEstimate, onEditingChange, onRefresh, initialOpenPicker = false, purchaseOrder = null }: Props) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [isEditing, setIsEditingRaw] = useState(
    // initialOpenPicker が true の場合は最初から編集モードに入る
    initialOpenPicker && estimate.status === "DRAFT"
  )
  const [showPreview, setShowPreview] = useState(false)

  // モバイル: 編集モード切替時に履歴エントリを追加し、スワイプバックで閲覧に戻れるようにする
  const editingHistoryRef = useRef(false)

  const setIsEditing = useCallback((editing: boolean) => {
    if (editing && isMobile) {
      window.history.pushState({ estimateEditing: true }, "")
      editingHistoryRef.current = true
    } else if (!editing && isMobile && editingHistoryRef.current) {
      // ボタン操作で編集を閉じる場合、pushした履歴を消費
      editingHistoryRef.current = false
      window.history.back()
      // popstate で setIsEditingRaw(false) が呼ばれるので、ここでは呼ばない
      return
    }
    setIsEditingRaw(editing)
  }, [isMobile])

  useEffect(() => {
    if (!isMobile) return
    function handlePopState() {
      if (editingHistoryRef.current) {
        editingHistoryRef.current = false
        setIsEditingRaw(false)
      }
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [isMobile])

  useEffect(() => {
    onEditingChange?.(isEditing)
  }, [isEditing, onEditingChange])
  const [loading, setLoading] = useState(false)

  // ── 現場情報編集ダイアログ ─────────────────────────────
  const [projectEditOpen, setProjectEditOpen] = useState(false)
  const [editProjectName, setEditProjectName] = useState(estimate.project.name)
  const [editProjectAddress, setEditProjectAddress] = useState(estimate.project.address ?? "")
  const [editProjectContactId, setEditProjectContactId] = useState(
    estimate.project.contact
      ? contacts.find((c) => c.id === estimate.project.contact?.id)?.id ?? NO_CONTACT
      : NO_CONTACT
  )
  const [editSaving, setEditSaving] = useState(false)

  function openProjectEdit() {
    setEditProjectName(estimate.project.name)
    setEditProjectAddress(estimate.project.address ?? "")
    setEditProjectContactId(
      estimate.project.contact
        ? contacts.find((c) => c.id === estimate.project.contact?.id)?.id ?? NO_CONTACT
        : NO_CONTACT
    )
    setProjectEditOpen(true)
  }

  async function handleSaveProjectEdit() {
    if (!editProjectName.trim()) { toast.error("現場名は必須です"); return }
    setEditSaving(true)
    try {
      const res = await fetch(`/api/projects/${estimate.project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editProjectName.trim(),
          address: editProjectAddress.trim() || null,
          contactId: editProjectContactId === NO_CONTACT ? null : editProjectContactId,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "更新に失敗しました")
      }
      toast.success("現場情報を更新しました")
      setProjectEditOpen(false)
      refreshData()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "エラーが発生しました")
    } finally {
      setEditSaving(false)
    }
  }

  // ── テンプレート保存ダイアログ ────────────────────────
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [templateDesc, setTemplateDesc] = useState("")
  const [templateSaving, setTemplateSaving] = useState(false)

  async function handleSaveAsTemplate() {
    if (!templateName.trim()) {
      toast.error("テンプレート名を入力してください")
      return
    }
    setTemplateSaving(true)
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName.trim(),
          description: templateDesc.trim() || null,
          estimateId: estimate.id,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "保存に失敗しました")
      }
      toast.success(`テンプレート「${templateName}」を保存しました`)
      setTemplateDialogOpen(false)
      setTemplateName("")
      setTemplateDesc("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました")
    } finally {
      setTemplateSaving(false)
    }
  }

  // ── 金額計算 ──────────────────────────────────────────
  let subtotal = 0
  for (const sec of estimate.sections) {
    for (const grp of sec.groups) {
      for (const item of grp.items) {
        subtotal += item.quantity * item.unitPrice
      }
    }
  }
  const discount = estimate.discountAmount ?? 0
  const taxable = subtotal - discount
  const tax = Math.floor(taxable * taxRate)
  const total = taxable + tax

  const { label, className } = statusConfig[estimate.status]

  /** embedded 時は onRefresh で再フェッチ、通常は router.refresh */
  function refreshData() {
    if (embedded && onRefresh) {
      onRefresh()
    } else {
      router.refresh()
    }
  }

  // ── 確定 ─────────────────────────────────────────────
  async function handleConfirm() {
    setLoading(true)
    try {
      const res = await fetch(`/api/estimates/${estimate.id}/confirm`, {
        method: "POST",
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "エラー")
      }
      toast.success("見積を確定しました")
      refreshData()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "確定に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  // ── 送付済 ───────────────────────────────────────────
  async function handleSend() {
    setLoading(true)
    try {
      const res = await fetch(`/api/estimates/${estimate.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: estimate.project.contact?.id }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "エラー")
      }
      toast.success("送付済にしました。3営業日後にフォロー通知が届きます。")
      refreshData()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  // ── 改訂版作成 ────────────────────────────────────────
  async function handleRevise() {
    setLoading(true)
    try {
      const res = await fetch(`/api/estimates/${estimate.id}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast.success("改訂版（下書き）を作成しました。編集してください。")
      if (embedded && onNavigateEstimate) {
        router.refresh()
        onNavigateEstimate(data.id)
      } else {
        router.push(`/estimates/${data.id}`)
      }
    } catch {
      toast.error("改訂版の作成に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  // ── 編集モード: EditorSection の初期値を組み立てる ────
  let _keyCounter = 0
  function mk() { return `init_${++_keyCounter}` }

  const initialSections = estimate.sections.map((sec) => ({
    _key: mk(),
    id: sec.id,
    name: sec.name,
    sortOrder: sec.sortOrder,
    groups: sec.groups.map((grp) => ({
      _key: mk(),
      id: grp.id,
      name: grp.name,
      sortOrder: 0,
      items: grp.items.map((item) => ({
        _key: mk(),
        id: item.id,
        name: item.name,
        quantity: Number(item.quantity),
        unitId: item.unit.id,
        unitPrice: Number(item.unitPrice),
        sortOrder: 0,
      })),
    })),
  }))

  // ── 編集モード表示 ────────────────────────────────────
  if (isEditing) {
    return (
      <EstimateEditor
        estimateId={estimate.id}
        initialTitle={estimate.title}
        initialNote={estimate.note}
        initialDiscount={discount}
        initialValidDays={estimate.validDays}
        initialSections={initialSections}
        units={units}
        taxRate={taxRate}
        autoOpenPicker={initialOpenPicker}
        onSaved={() => {
          setIsEditing(false)
          refreshData()
        }}
        onCancel={() => setIsEditing(false)}
      />
    )
  }

  // ── 閲覧モード表示 ────────────────────────────────────
  return (
    <div className={`${isMobile ? "space-y-4" : "space-y-6"}`}>
      {/* ━━ ヘッダー: 見積番号 + ステータス ━━ */}
      <div className={`${embedded ? "sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-slate-200 pb-3 -mt-4 pt-3" : ""}`}>
        {/* ナビゲーション */}
        <div className={`flex items-center ${isMobile ? "gap-2 mb-2" : "gap-3 mb-3"}`}>
          {embedded ? (
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors">
                <ArrowLeft className="w-4 h-4" />
                閉じる
              </button>
              <KeyboardHint keyName="Esc" label="閉じる" />
            </div>
          ) : (
            <button
              onClick={() => router.push(`/projects/${estimate.project.id}`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {isMobile ? "戻る" : "現場に戻る"}
            </button>
          )}
        </div>

        {/* 見積タイトル行 */}
        <div className={`${isMobile ? "px-4" : "px-6"}`}>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className={`font-extrabold text-slate-900 ${isMobile ? "text-lg" : embedded ? "text-xl" : "text-2xl"}`}>
              {estimate.estimateNumber
                ? `見積 ${estimate.estimateNumber}`
                : "見積（下書き）"}
            </h1>
            {estimate.revision > 1 && (
              <span className={`font-bold text-slate-500 ${isMobile ? "text-xs" : "text-base"}`}>第{estimate.revision}版</span>
            )}
            <span className={`px-3 py-1 rounded-sm ${isMobile ? "text-xs" : "text-sm"} font-extrabold ${className}`}>
              {label}
            </span>
          </div>
          {!embedded && (
            <p className={`text-slate-500 mt-1 truncate ${isMobile ? "text-xs" : "text-sm"}`}>
              <span className="font-medium">{estimate.project.branch.company.name}</span>
              <span className="mx-1 text-slate-300">|</span>
              {estimate.project.name}
            </p>
          )}
        </div>
      </div>

      {/* ━━ アクションボタン群 ━━ */}
      <div className={`${isMobile ? "px-4" : "px-6"}`}>
        <div className={`grid ${isMobile ? "grid-cols-3 gap-1.5" : "grid-cols-4 gap-2"}`}>
          {estimate.status === "DRAFT" && (
            <button
              onClick={() => setIsEditing(true)}
              className={`flex items-center justify-center gap-1.5 ${isMobile ? "py-2 text-xs" : "py-2.5 text-sm"} rounded-sm font-bold bg-amber-100 text-amber-700 border-2 border-amber-300 hover:bg-amber-200 active:scale-95 transition-all`}
            >
              <Pencil className={isMobile ? "w-3.5 h-3.5" : "w-4 h-4"} />
              編集する
            </button>
          )}
          {estimate.status === "DRAFT" && (
            <button
              onClick={handleConfirm}
              disabled={loading}
              className={`flex items-center justify-center gap-1.5 ${isMobile ? "py-2 text-xs" : "py-2.5 text-sm"} rounded-sm font-bold bg-blue-500 text-white hover:bg-blue-600 active:scale-95 transition-all shadow-sm disabled:opacity-50`}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className={isMobile ? "w-3.5 h-3.5" : "w-4 h-4"} />}
              確定する
            </button>
          )}
          {estimate.status === "CONFIRMED" && (
            <button
              onClick={handleSend}
              disabled={loading}
              className={`flex items-center justify-center gap-1.5 ${isMobile ? "py-2 text-xs" : "py-2.5 text-sm"} rounded-sm font-bold bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95 transition-all shadow-sm disabled:opacity-50`}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className={isMobile ? "w-3.5 h-3.5" : "w-4 h-4"} />}
              {isMobile ? "送付済" : "送付済にする"}
            </button>
          )}
          {(estimate.status === "CONFIRMED" || estimate.status === "SENT") && (
            <button
              onClick={handleRevise}
              disabled={loading}
              className={`flex items-center justify-center gap-1.5 ${isMobile ? "py-2 text-xs" : "py-2.5 text-sm"} rounded-sm font-bold bg-slate-100 text-slate-700 border-2 border-slate-300 hover:bg-slate-200 active:scale-95 transition-all disabled:opacity-50`}
            >
              <Copy className={isMobile ? "w-3.5 h-3.5" : "w-4 h-4"} />
              改訂版
            </button>
          )}

          <button
            onClick={() => {
              if (embedded) {
                setShowPreview((v) => !v)
              } else {
                router.push(`/estimates/${estimate.id}/print`)
              }
            }}
            className={`flex items-center justify-center gap-1.5 ${isMobile ? "py-2 text-xs" : "py-2.5 text-sm"} rounded-sm font-bold active:scale-95 transition-all ${
              showPreview
                ? "bg-slate-700 text-white hover:bg-slate-800"
                : "bg-slate-100 text-slate-600 border-2 border-slate-300 hover:bg-slate-200"
            }`}
          >
            <Printer className={isMobile ? "w-3.5 h-3.5" : "w-4 h-4"} />
            {isMobile ? (showPreview ? "閉じる" : "PDF") : (showPreview ? "閉じる" : "プレビュー")}
          </button>

          {(estimate.status === "CONFIRMED" || estimate.status === "SENT") && (
            <button
              onClick={() => router.push(`/estimates/${estimate.id}/print?print=1`)}
              className={`flex items-center justify-center gap-1.5 ${isMobile ? "py-2 text-xs" : "py-2.5 text-sm"} rounded-sm font-bold bg-slate-800 text-white hover:bg-slate-900 active:scale-95 transition-all`}
            >
              <Printer className={isMobile ? "w-3.5 h-3.5" : "w-4 h-4"} />
              {isMobile ? "印刷" : "印刷・PDF"}
            </button>
          )}

          <button
            onClick={() => {
              setTemplateName(estimate.project.name + "テンプレート")
              setTemplateDesc("")
              setTemplateDialogOpen(true)
            }}
            className={`flex items-center justify-center gap-1.5 ${isMobile ? "py-2 text-xs" : "py-2.5 text-sm"} rounded-sm font-bold bg-purple-100 text-purple-700 border-2 border-purple-300 hover:bg-purple-200 active:scale-95 transition-all`}
          >
            <LayoutTemplate className={isMobile ? "w-3.5 h-3.5" : "w-4 h-4"} />
            {isMobile ? "テンプレ" : "テンプレート保存"}
          </button>
        </div>
      </div>

      {/* ━━ インラインプレビュー ━━ */}
      {showPreview && (
        <div className={`${isMobile ? "mx-4" : "mx-6"} border-2 border-slate-200 rounded-sm overflow-hidden bg-slate-100`}>
          <EstimatePrint
            estimate={estimate}
            taxRate={taxRate}
            isDraft={estimate.status === "DRAFT"}
            embedded
          />
        </div>
      )}

      {/* 見積情報カード */}
      <div className={`${isMobile ? "px-4" : "px-6"} ${showPreview ? "hidden" : ""}`}>
        <div className="bg-slate-50 rounded-sm border-2 border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className={`${isMobile ? "text-base" : "text-lg"} font-extrabold text-slate-800`}>現場情報</h2>
            <button
              onClick={openProjectEdit}
              className="px-3 py-1.5 rounded-sm text-xs font-bold bg-white text-slate-600 border border-slate-300 hover:bg-slate-100 active:scale-95 transition-all"
            >
              <Pencil className="w-3 h-3 inline mr-1" />
              編集
            </button>
          </div>
          <div className={`grid ${isMobile ? "grid-cols-1 gap-3" : "grid-cols-3 gap-4"}`}>
            <div className="bg-white rounded-sm p-3 border border-slate-200">
              <div className="flex items-center gap-1.5 mb-1">
                <MapPin className={`w-4 h-4 ${estimate.project.address ? "text-green-500" : "text-slate-400"}`} />
                <span className="text-xs font-bold text-slate-500">現場</span>
              </div>
              <p className="text-sm font-bold text-slate-900 truncate">{estimate.project.name}</p>
              {estimate.project.address ? (
                <p className="text-xs text-green-600 font-medium mt-0.5 truncate">{estimate.project.address}</p>
              ) : (
                <p className="text-xs text-amber-500 font-medium mt-0.5">住所が未設定</p>
              )}
            </div>
            <div className="bg-white rounded-sm p-3 border border-slate-200">
              <p className="text-xs font-bold text-slate-500 mb-1">先方担当者</p>
              <p className="text-sm font-bold text-slate-900 truncate">
                {estimate.project.contact?.name ?? <span className="text-slate-400 font-medium">未設定</span>}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {estimate.project.branch.company.name}
                {estimate.project.branch.name !== "本社" && ` / ${estimate.project.branch.name}`}
              </p>
            </div>
            <div className="bg-white rounded-sm p-3 border border-slate-200">
              <p className="text-xs font-bold text-slate-500 mb-1">作成</p>
              <p className="text-sm font-bold text-slate-900">{estimate.user.name}</p>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">{formatDate(estimate.createdAt, "yyyy/MM/dd")} 作成</p>
            </div>
          </div>
        </div>
      </div>

      {/* 下書きの場合の編集案内バナー */}
      {!showPreview && estimate.status === "DRAFT" && (
        <div
          className={`${isMobile ? "mx-4" : "mx-6"} flex items-center gap-4 px-5 py-4 bg-amber-50 border-2 border-amber-200 rounded-sm cursor-pointer hover:bg-amber-100 transition-colors`}
          onClick={() => setIsEditing(true)}
        >
          <Pencil className="w-6 h-6 text-amber-500 shrink-0" />
          <div>
            <p className={`${isMobile ? "text-sm" : "text-base"} font-bold text-amber-800`}>
              この見積は下書きです — クリックして編集できます
            </p>
            <p className="text-sm text-amber-600 mt-0.5">
              項目の追加・金額変更・備考の編集が可能です
            </p>
          </div>
        </div>
      )}

      {/* 確定・送付済の場合の改訂案内 */}
      {!showPreview && (estimate.status === "CONFIRMED" || estimate.status === "SENT") && (
        <div className={`${isMobile ? "mx-4" : "mx-6"} flex items-center gap-4 px-5 py-4 bg-blue-50 border-2 border-blue-200 rounded-sm`}>
          <Copy className="w-6 h-6 text-blue-500 shrink-0" />
          <div className="flex-1">
            <p className={`${isMobile ? "text-sm" : "text-base"} font-bold text-blue-800`}>
              内容を変更する場合は「改訂版作成」を使ってください
            </p>
            <p className="text-sm text-blue-600 mt-0.5">この版は履歴として保存されます</p>
          </div>
          <button
            onClick={handleRevise}
            disabled={loading}
            className="px-4 py-2 rounded-sm text-sm font-bold bg-blue-100 text-blue-700 border-2 border-blue-300 hover:bg-blue-200 active:scale-95 transition-all shrink-0 disabled:opacity-50"
          >
            <Copy className="w-4 h-4 inline mr-1" />
            改訂版
          </button>
        </div>
      )}

      {/* 見積タイトル */}
      {!showPreview && estimate.title && (
        <div className={`${isMobile ? "mx-4" : "mx-6"} flex items-center gap-2`}>
          <Tag className="w-5 h-5 text-indigo-500" />
          <span className={`${isMobile ? "text-base" : "text-lg"} font-bold text-slate-800`}>{estimate.title}</span>
        </div>
      )}

      {/* 明細テーブル */}
      {!showPreview && estimate.sections.map((section) => (
        <div key={section.id} className={`${isMobile ? "mx-4" : "mx-6"} rounded-sm overflow-hidden border-2 border-slate-200`}>
          <div className="py-3 px-4 bg-slate-800 text-white">
            <div className="flex items-center gap-2 text-sm font-bold">
              <FileText className="w-4 h-4 text-slate-400" />
              {section.name}
            </div>
          </div>
          <div>
            {section.groups.map((group) => (
              <div key={group.id}>
                <div className="px-4 py-2 bg-slate-100 border-y border-slate-200">
                  <p className="text-sm font-bold text-slate-700">
                    {group.name}
                  </p>
                </div>
                {isMobile ? (
                  /* モバイル: カード形式の明細 */
                  <div className="divide-y divide-slate-100">
                    {group.items.map((item) => (
                      <div key={item.id} className="px-4 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-bold text-slate-800 flex-1 min-w-0">{item.name}</p>
                          <p className="text-sm font-mono font-bold text-slate-900 shrink-0">
                            ¥{formatCurrency(item.quantity * item.unitPrice)}
                          </p>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {item.quantity.toLocaleString()} {item.unit.name} × ¥{formatCurrency(item.unitPrice)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* デスクトップ: テーブル形式 */
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>項目名</TableHead>
                        <TableHead className="w-24 text-right">数量</TableHead>
                        <TableHead className="w-16 text-center">単位</TableHead>
                        <TableHead className="w-32 text-right">単価</TableHead>
                        <TableHead className="w-32 text-right">金額</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {item.quantity.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            {item.unit.name}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            ¥{formatCurrency(item.unitPrice)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-bold">
                            ¥{formatCurrency(item.quantity * item.unitPrice)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* 合計 */}
      {!showPreview && (
      <div className={`${isMobile ? "mx-4" : "mx-6"} bg-white rounded-sm border-2 border-slate-200 p-5`}>
        <div className={`flex flex-col items-end gap-2 ${isMobile ? "text-xs" : "text-sm"}`}>
          <div className={`flex ${isMobile ? "gap-4" : "gap-8"}`}>
            <span className="text-slate-500 font-medium">小計（税抜）</span>
            <span className={`font-mono font-bold text-right ${isMobile ? "w-28" : "w-36"}`}>
              ¥{formatCurrency(subtotal)}
            </span>
          </div>
          {discount > 0 && (
            <div className={`flex ${isMobile ? "gap-4" : "gap-8"}`}>
              <span className="text-slate-500 font-medium">値引き</span>
              <span className={`font-mono font-bold text-red-600 text-right ${isMobile ? "w-28" : "w-36"}`}>
                -¥{formatCurrency(discount)}
              </span>
            </div>
          )}
          <div className={`flex ${isMobile ? "gap-4" : "gap-8"}`}>
            <span className="text-slate-500 font-medium">
              消費税（{Math.round(taxRate * 100)}%）
            </span>
            <span className={`font-mono font-bold text-right ${isMobile ? "w-28" : "w-36"}`}>
              ¥{formatCurrency(tax)}
            </span>
          </div>
          <div className={`flex ${isMobile ? "gap-4" : "gap-8"} pt-3 border-t-2 border-slate-200`}>
            <span className={`font-extrabold ${isMobile ? "text-sm" : "text-base"}`}>合計（税込）</span>
            <span className={`font-mono font-extrabold text-right text-blue-700 ${isMobile ? "text-base w-28" : "text-xl w-36"}`}>
              ¥{formatCurrency(total)}
            </span>
          </div>
        </div>
      </div>
      )}

      {/* 備考 */}
      {!showPreview && estimate.note && (
      <div className={`${isMobile ? "mx-4" : "mx-6"} bg-white rounded-sm border-2 border-slate-200 p-5`}>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">特記事項</p>
        <p className="text-sm whitespace-pre-wrap text-slate-700">{estimate.note}</p>
      </div>
      )}

      {/* 工程セクション */}
      {!showPreview && (
        <EstimateScheduleSection
          projectId={estimate.project.id}
          isMobile={isMobile}
        />
      )}

      {/* 発注情報セクション */}
      {estimate.status !== "OLD" && !showPreview && (
        <EstimatePurchaseOrderSection
          estimateId={estimate.id}
          initialOrder={purchaseOrder ?? null}
          estimateStatus={estimate.status}
          estimateSubtotal={subtotal - discount}
          estimateTotal={total}
        />
      )}

      {/* テンプレート保存ダイアログ */}
      <Dialog open={templateDialogOpen} onOpenChange={(v) => { if (!v) setTemplateDialogOpen(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutTemplate className="w-5 h-5 text-purple-600" />
              テンプレートとして保存
            </DialogTitle>
            <DialogDescription>
              この見積の構成（大項目・中項目・明細・単価）をテンプレートとして保存します。
              次回の見積作成時に呼び出して使えます。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                テンプレート名 <span className="text-red-500">*</span>
              </Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="例：標準足場工事テンプレート"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>説明（任意）</Label>
              <Textarea
                value={templateDesc}
                onChange={(e) => setTemplateDesc(e.target.value)}
                placeholder="例：3〜5階建ビル向けの標準構成"
                rows={2}
                className="resize-none"
              />
            </div>

            {/* 保存される内容のプレビュー */}
            <div className="bg-slate-50 rounded-sm p-3 text-xs text-slate-500 space-y-1">
              <p className="font-medium text-slate-700 mb-2">保存される内容：</p>
              {estimate.sections.map((sec) => (
                <div key={sec.id}>
                  <p className="font-medium text-slate-600">▶ {sec.name}</p>
                  {sec.groups.map((grp) => (
                    <p key={grp.id} className="ml-3 text-slate-500">
                      └ {grp.name}（{grp.items.length} 項目）
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)} disabled={templateSaving}>
              キャンセル
            </Button>
            <Button
              onClick={handleSaveAsTemplate}
              disabled={templateSaving || !templateName.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <LayoutTemplate className="w-4 h-4 mr-2" />
              {templateSaving ? "保存中..." : "テンプレートに保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 現場情報編集ダイアログ */}
      <Dialog open={projectEditOpen} onOpenChange={setProjectEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4" />
              現場情報を編集
            </DialogTitle>
            <DialogDescription>
              現場名・住所・担当者を変更できます。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>現場名 <span className="text-red-500">*</span></Label>
              <Input
                value={editProjectName}
                onChange={(e) => setEditProjectName(e.target.value)}
                placeholder="例：〇〇ビル改修工事"
              />
            </div>
            <div className="space-y-1.5">
              <Label>住所</Label>
              <Input
                value={editProjectAddress}
                onChange={(e) => setEditProjectAddress(e.target.value)}
                placeholder="例：東京都渋谷区〇〇1-1-1"
              />
            </div>
            <div className="space-y-1.5">
              <Label>先方担当者</Label>
              {contacts.length > 0 ? (
                <Select
                  value={editProjectContactId}
                  onValueChange={setEditProjectContactId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="担当者を選択（任意）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CONTACT}>未設定</SelectItem>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.phone && <span className="text-slate-400 ml-2 text-xs">{c.phone}</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-slate-400 py-1">
                  担当者が登録されていません。マスター管理で追加できます。
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setProjectEditOpen(false)} disabled={editSaving}>
              キャンセル
            </Button>
            <Button onClick={handleSaveProjectEdit} disabled={editSaving}>
              {editSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />保存中...</> : "保存する"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

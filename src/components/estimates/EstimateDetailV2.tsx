/**
 * [COMPONENT] 見積詳細 V2 - 商談一覧V2用の大きくシンプルなデザイン
 *
 * EstimateDetailと同じ機能を持つが、V2の統一デザインで作成。
 * - 大きな文字・大きなボタン
 * - シンプルで直感的なレイアウト
 * - すべてのアクションが見えるボタン
 */
"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { formatCurrency, formatDate } from "@/lib/utils"
import { toast } from "sonner"
import {
  CheckCircle2,
  Send,
  Copy,
  FileText,
  Pencil,
  Printer,
  LayoutTemplate,
  Loader2,
  Tag,
  CalendarPlus,
  CalendarCheck,
  User,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { EstimateEditor } from "./EstimateEditor"
import { EstimatePrint } from "./EstimatePrint"
import { EstimatePurchaseOrderSection } from "./EstimatePurchaseOrderSection"
import type { EstimateStatus, AddressType } from "@prisma/client"

// ─── 型定義 ────────────────────────────────────────────

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
  onRefresh?: () => void
  onClose?: () => void
  onNavigateEstimate?: (id: string) => void
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

// ─── ステータス設定 ──────────────────────────────────────

const STATUS_V2: Record<EstimateStatus, {
  label: string
  bg: string
  text: string
  border: string
}> = {
  DRAFT: { label: "下書き", bg: "bg-amber-500", text: "text-white", border: "border-amber-400" },
  CONFIRMED: { label: "確定済", bg: "bg-blue-500", text: "text-white", border: "border-blue-400" },
  SENT: { label: "送付済", bg: "bg-emerald-500", text: "text-white", border: "border-emerald-400" },
  OLD: { label: "旧版", bg: "bg-slate-400", text: "text-white", border: "border-slate-300" },
}

// ─── メインコンポーネント ───────────────────────────────

const NO_CONTACT = "__none__"

export function EstimateDetailV2({ estimate, taxRate, units, contacts, onRefresh, onClose, onNavigateEstimate, purchaseOrder = null }: Props) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [loading, setLoading] = useState(false)

  // 現場情報編集
  const [projectEditOpen, setProjectEditOpen] = useState(false)
  const [editProjectName, setEditProjectName] = useState(estimate.project.name)
  const [editProjectAddress, setEditProjectAddress] = useState(estimate.project.address ?? "")
  const [editProjectContactId, setEditProjectContactId] = useState(
    estimate.project.contact
      ? contacts.find((c) => c.id === estimate.project.contact?.id)?.id ?? NO_CONTACT
      : NO_CONTACT
  )
  const [editSaving, setEditSaving] = useState(false)

  // テンプレート保存
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [templateDesc, setTemplateDesc] = useState("")
  const [templateSaving, setTemplateSaving] = useState(false)

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
  const config = STATUS_V2[estimate.status]

  const refreshData = useCallback(() => {
    if (onRefresh) onRefresh()
    else router.refresh()
  }, [onRefresh, router])

  // ── アクション ─────────────────────────────────────────
  async function handleConfirm() {
    setLoading(true)
    try {
      const res = await fetch(`/api/estimates/${estimate.id}/confirm`, { method: "POST" })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "エラー") }
      toast.success("見積を確定しました")
      refreshData()
    } catch (e) { toast.error(e instanceof Error ? e.message : "確定に失敗しました") }
    finally { setLoading(false) }
  }

  async function handleSend() {
    setLoading(true)
    try {
      const res = await fetch(`/api/estimates/${estimate.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: estimate.project.contact?.id }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "エラー") }
      toast.success("送付済にしました")
      refreshData()
    } catch (e) { toast.error(e instanceof Error ? e.message : "操作に失敗しました") }
    finally { setLoading(false) }
  }

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
      toast.success("改訂版（下書き）を作成しました")
      if (onNavigateEstimate) {
        router.refresh()
        onNavigateEstimate(data.id)
      } else {
        router.push(`/estimates/${data.id}`)
      }
    } catch { toast.error("改訂版の作成に失敗しました") }
    finally { setLoading(false) }
  }

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
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "更新に失敗しました") }
      toast.success("現場情報を更新しました")
      setProjectEditOpen(false)
      refreshData()
    } catch (e) { toast.error(e instanceof Error ? e.message : "エラーが発生しました") }
    finally { setEditSaving(false) }
  }

  async function handleSaveAsTemplate() {
    if (!templateName.trim()) { toast.error("テンプレート名を入力してください"); return }
    setTemplateSaving(true)
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: templateName.trim(), description: templateDesc.trim() || null, estimateId: estimate.id }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "保存に失敗しました") }
      toast.success(`テンプレート「${templateName}」を保存しました`)
      setTemplateDialogOpen(false)
      setTemplateName("")
      setTemplateDesc("")
    } catch (e) { toast.error(e instanceof Error ? e.message : "保存に失敗しました") }
    finally { setTemplateSaving(false) }
  }

  // ── 編集モード ─────────────────────────────────────────
  if (isEditing) {
    let _k = 0
    const mk = () => `init_${++_k}`
    const initialSections = estimate.sections.map((sec) => ({
      _key: mk(), id: sec.id, name: sec.name, sortOrder: sec.sortOrder,
      groups: sec.groups.map((grp) => ({
        _key: mk(), id: grp.id, name: grp.name, sortOrder: 0,
        items: grp.items.map((item) => ({
          _key: mk(), id: item.id, name: item.name,
          quantity: Number(item.quantity), unitId: item.unit.id, unitPrice: Number(item.unitPrice), sortOrder: 0,
        })),
      })),
    }))

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
        onSaved={() => { setIsEditing(false); refreshData() }}
        onCancel={() => setIsEditing(false)}
      />
    )
  }

  // ── 閲覧モード（V2デザイン） ───────────────────────────
  return (
    <div className="space-y-5 pb-8">

      {/* ━━ ヘッダー: 見積番号 + ステータス ━━ */}
      <div className="px-6 pt-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-extrabold text-slate-900">
            {estimate.estimateNumber ? `見積 ${estimate.estimateNumber}` : "見積（下書き）"}
          </h1>
          {estimate.revision > 1 && (
            <span className="text-lg text-slate-500 font-bold">第{estimate.revision}版</span>
          )}
          <span className={`px-4 py-1.5 rounded-sm text-base font-extrabold ${config.bg} ${config.text}`}>
            {config.label}
          </span>
        </div>

        {/* 見積タイトル */}
        {estimate.title && (
          <div className="flex items-center gap-2 mt-2">
            <Tag className="w-5 h-5 text-indigo-500" />
            <span className="text-lg font-bold text-slate-800">{estimate.title}</span>
          </div>
        )}
      </div>

      {/* ━━ アクションボタン群（グリッドで右端を上の4ボタンと揃える） ━━ */}
      <div className="px-6">
        <div className="grid grid-cols-4 gap-2">
          {estimate.status === "DRAFT" && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-sm text-sm font-bold bg-amber-100 text-amber-700 border-2 border-amber-300 hover:bg-amber-200 active:scale-95 transition-all"
            >
              <Pencil className="w-4 h-4" />
              編集する
            </button>
          )}
          {estimate.status === "DRAFT" && (
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-sm text-sm font-bold bg-blue-500 text-white hover:bg-blue-600 active:scale-95 transition-all shadow-sm disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              確定する
            </button>
          )}
          {estimate.status === "CONFIRMED" && (
            <button
              onClick={handleSend}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-sm text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95 transition-all shadow-sm disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              送付済にする
            </button>
          )}
          {(estimate.status === "CONFIRMED" || estimate.status === "SENT") && (
            <button
              onClick={handleRevise}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-sm text-sm font-bold bg-slate-100 text-slate-700 border-2 border-slate-300 hover:bg-slate-200 active:scale-95 transition-all disabled:opacity-50"
            >
              <Copy className="w-4 h-4" />
              改訂版を作成
            </button>
          )}

          <button
            onClick={() => setShowPreview((v) => !v)}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-sm text-sm font-bold active:scale-95 transition-all ${
              showPreview
                ? "bg-slate-700 text-white hover:bg-slate-800"
                : "bg-slate-100 text-slate-600 border-2 border-slate-300 hover:bg-slate-200"
            }`}
          >
            <Printer className="w-4 h-4" />
            {showPreview ? "閉じる" : "プレビュー"}
          </button>

          {(estimate.status === "CONFIRMED" || estimate.status === "SENT") && (
            <button
              onClick={() => router.push(`/estimates/${estimate.id}/print?print=1`)}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-sm text-sm font-bold bg-slate-800 text-white hover:bg-slate-900 active:scale-95 transition-all"
            >
              <Printer className="w-4 h-4" />
              印刷・PDF
            </button>
          )}

          <button
            onClick={() => {
              setTemplateName(estimate.project.name + "テンプレート")
              setTemplateDesc("")
              setTemplateDialogOpen(true)
            }}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-sm text-sm font-bold bg-purple-100 text-purple-700 border-2 border-purple-300 hover:bg-purple-200 active:scale-95 transition-all"
          >
            <LayoutTemplate className="w-4 h-4" />
            テンプレート保存
          </button>
        </div>
      </div>

      {/* ━━ インラインプレビュー ━━ */}
      {showPreview && (
        <div className="mx-6 border-2 border-slate-200 rounded-sm overflow-hidden bg-slate-100">
          <EstimatePrint
            estimate={estimate}
            taxRate={taxRate}
            isDraft={estimate.status === "DRAFT"}
            embedded
          />
        </div>
      )}

      {/* ━━ 見積メタ情報（作成者・日付） ━━ */}
      {!showPreview && (
        <div className="mx-6">
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <User className="w-4 h-4" />
              {estimate.user.name}
            </span>
            <span className="tabular-nums">{formatDate(estimate.createdAt, "yyyy/M/d")} 作成</span>
            {estimate.confirmedAt && (
              <span className="flex items-center gap-1 text-blue-600 font-medium tabular-nums">
                <CalendarCheck className="w-4 h-4" />
                {formatDate(estimate.confirmedAt, "yyyy/M/d")} 確定
              </span>
            )}
            {estimate.sentAt && (
              <span className="flex items-center gap-1 text-emerald-600 font-medium tabular-nums">
                <Send className="w-4 h-4" />
                {formatDate(estimate.sentAt, "yyyy/M/d")} 送付
              </span>
            )}
          </div>
        </div>
      )}

      {/* ━━ 下書きバナー ━━ */}
      {!showPreview && estimate.status === "DRAFT" && (
        <div
          className="mx-6 flex items-center gap-4 px-5 py-4 bg-amber-50 border-2 border-amber-200 rounded-sm cursor-pointer hover:bg-amber-100 transition-colors"
          onClick={() => setIsEditing(true)}
        >
          <Pencil className="w-6 h-6 text-amber-500 shrink-0" />
          <div>
            <p className="text-base font-bold text-amber-800">この見積は下書きです — クリックして編集できます</p>
            <p className="text-sm text-amber-600 mt-0.5">項目の追加・金額変更・備考の編集が可能です</p>
          </div>
        </div>
      )}

      {/* ━━ 確定・送付済バナー ━━ */}
      {!showPreview && (estimate.status === "CONFIRMED" || estimate.status === "SENT") && (
        <div className="mx-6 flex items-center gap-4 px-5 py-4 bg-blue-50 border-2 border-blue-200 rounded-sm">
          <Copy className="w-6 h-6 text-blue-500 shrink-0" />
          <div className="flex-1">
            <p className="text-base font-bold text-blue-800">内容を変更する場合は「改訂版作成」を使ってください</p>
            <p className="text-sm text-blue-600 mt-0.5">この版は履歴として保存されます</p>
          </div>
          <button
            onClick={handleRevise}
            disabled={loading}
            className="px-5 py-2.5 rounded-sm text-sm font-bold bg-blue-100 text-blue-700 border-2 border-blue-300 hover:bg-blue-200 active:scale-95 transition-all shrink-0 disabled:opacity-50"
          >
            <Copy className="w-4 h-4 inline mr-1" />
            改訂版作成
          </button>
        </div>
      )}

      {/* ━━ 明細セクション ━━ */}
      {!showPreview && estimate.sections.map((section) => (
        <div key={section.id} className="mx-6 rounded-sm overflow-hidden border-2 border-slate-200">
          {/* セクションヘッダー */}
          <div className="px-5 py-3 bg-slate-800 text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-400" />
            <span className="text-base font-bold">{section.name}</span>
          </div>

          {section.groups.map((group) => (
            <div key={group.id}>
              {/* グループヘッダー */}
              <div className="px-5 py-2.5 bg-slate-100 border-b border-slate-200">
                <p className="text-base font-bold text-slate-700">{group.name}</p>
              </div>

              {/* 明細テーブル */}
              <div className="divide-y divide-slate-100">
                {group.items.map((item) => (
                  <div key={item.id} className="px-5 py-3 flex items-center gap-4">
                    <span className="text-base font-medium text-slate-800 flex-1 min-w-0 truncate">{item.name}</span>
                    <span className="text-base text-slate-500 tabular-nums shrink-0">
                      {item.quantity.toLocaleString()} {item.unit.name}
                    </span>
                    <span className="text-base text-slate-500 tabular-nums shrink-0 w-28 text-right">
                      ¥{formatCurrency(item.unitPrice)}
                    </span>
                    <span className="text-lg font-bold text-slate-900 tabular-nums shrink-0 w-32 text-right">
                      ¥{formatCurrency(item.quantity * item.unitPrice)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* ━━ 合計 ━━ */}
      {!showPreview && (
        <div className="mx-6 bg-slate-50 rounded-sm border-2 border-slate-200 p-5">
          <div className="flex flex-col items-end gap-3">
            <div className="flex items-center gap-8">
              <span className="text-base text-slate-500 font-medium">小計（税抜）</span>
              <span className="text-lg font-bold text-slate-800 tabular-nums w-40 text-right">
                ¥{formatCurrency(subtotal)}
              </span>
            </div>
            {discount > 0 && (
              <div className="flex items-center gap-8">
                <span className="text-base text-slate-500 font-medium">値引き</span>
                <span className="text-lg font-bold text-red-600 tabular-nums w-40 text-right">
                  -¥{formatCurrency(discount)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-8">
              <span className="text-base text-slate-500 font-medium">消費税（{Math.round(taxRate * 100)}%）</span>
              <span className="text-lg font-bold text-slate-800 tabular-nums w-40 text-right">
                ¥{formatCurrency(tax)}
              </span>
            </div>
            <div className="flex items-center gap-8 pt-3 border-t-2 border-slate-300">
              <span className="text-xl font-extrabold text-slate-900">合計（税込）</span>
              <span className="text-2xl font-black text-blue-700 tabular-nums w-40 text-right">
                ¥{formatCurrency(total)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ━━ 備考 ━━ */}
      {!showPreview && estimate.note && (
        <div className="mx-6 bg-white rounded-sm border-2 border-slate-200 p-5">
          <h3 className="text-base font-bold text-slate-500 mb-2">特記事項</h3>
          <p className="text-base text-slate-800 whitespace-pre-wrap leading-relaxed">{estimate.note}</p>
        </div>
      )}

      {/* ━━ 発注情報 ━━ */}
      {estimate.status !== "OLD" && !showPreview && (
        <div className="mx-6">
          <EstimatePurchaseOrderSection
            estimateId={estimate.id}
            initialOrder={purchaseOrder ?? null}
            estimateStatus={estimate.status}
            estimateSubtotal={subtotal - discount}
            estimateTotal={total}
          />
        </div>
      )}

      {/* ━━ テンプレート保存ダイアログ ━━ */}
      <Dialog open={templateDialogOpen} onOpenChange={(v) => { if (!v) setTemplateDialogOpen(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <LayoutTemplate className="w-5 h-5 text-purple-600" />
              テンプレートとして保存
            </DialogTitle>
            <DialogDescription>この見積の構成をテンプレートとして保存します。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-base font-bold">テンプレート名 <span className="text-red-500">*</span></Label>
              <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="例：標準足場工事テンプレート" autoFocus className="text-base py-3" />
            </div>
            <div className="space-y-2">
              <Label className="text-base font-bold">説明（任意）</Label>
              <Textarea value={templateDesc} onChange={(e) => setTemplateDesc(e.target.value)} placeholder="例：3〜5階建ビル向けの標準構成" rows={2} className="resize-none text-base" />
            </div>
            <div className="bg-slate-50 rounded-sm p-4 text-sm text-slate-500 space-y-1">
              <p className="font-bold text-slate-700 mb-2">保存される内容：</p>
              {estimate.sections.map((sec) => (
                <div key={sec.id}>
                  <p className="font-medium text-slate-600">▶ {sec.name}</p>
                  {sec.groups.map((grp) => (
                    <p key={grp.id} className="ml-4 text-slate-500">└ {grp.name}（{grp.items.length} 項目）</p>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)} disabled={templateSaving}>キャンセル</Button>
            <Button onClick={handleSaveAsTemplate} disabled={templateSaving || !templateName.trim()} className="bg-purple-600 hover:bg-purple-700 text-base px-6 py-3">
              <LayoutTemplate className="w-4 h-4 mr-2" />
              {templateSaving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ━━ 現場情報編集ダイアログ ━━ */}
      <Dialog open={projectEditOpen} onOpenChange={setProjectEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Pencil className="w-5 h-5" />
              現場情報を編集
            </DialogTitle>
            <DialogDescription>現場名・住所・担当者を変更できます。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-base font-bold">現場名 <span className="text-red-500">*</span></Label>
              <Input value={editProjectName} onChange={(e) => setEditProjectName(e.target.value)} className="text-base py-3" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-base font-bold">住所</Label>
              <Input value={editProjectAddress} onChange={(e) => setEditProjectAddress(e.target.value)} className="text-base py-3" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-base font-bold">先方担当者</Label>
              {contacts.length > 0 ? (
                <Select value={editProjectContactId} onValueChange={setEditProjectContactId}>
                  <SelectTrigger className="text-base py-3"><SelectValue placeholder="担当者を選択" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CONTACT}>未設定</SelectItem>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-slate-400 py-1">担当者が登録されていません。</p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setProjectEditOpen(false)} disabled={editSaving} className="text-base px-5 py-3">キャンセル</Button>
            <Button onClick={handleSaveProjectEdit} disabled={editSaving} className="text-base px-5 py-3">
              {editSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              保存する
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

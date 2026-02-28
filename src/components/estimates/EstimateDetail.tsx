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

import { useState } from "react"
import { useRouter } from "next/navigation"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
} from "lucide-react"
import { toast } from "sonner"
import { EstimateEditor } from "./EstimateEditor"
import type { EstimateStatus, AddressType } from "@prisma/client"

// ─── 型定義 ────────────────────────────────────────────

const statusConfig: Record<
  EstimateStatus,
  { label: string; className: string }
> = {
  DRAFT: { label: "下書き", className: "bg-orange-100 text-orange-700" },
  CONFIRMED: { label: "確定", className: "bg-blue-100 text-blue-700" },
  SENT: { label: "送付済", className: "bg-green-100 text-green-700" },
  OLD: { label: "旧版", className: "bg-slate-100 text-slate-500" },
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

interface Props {
  estimate: {
    id: string
    estimateNumber: string | null
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
      branch: { name: string; company: { name: string } }
      contact: { id: string; name: string } | null
    }
    user: { id: string; name: string }
    sections: EstimateSection[]
  }
  taxRate: number
  units: Unit[]
  currentUser: { id: string; name: string }
}

// ─── メインコンポーネント ───────────────────────────────

export function EstimateDetail({ estimate, taxRate, units, currentUser }: Props) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)

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
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "確定に失敗しました")
    } finally {
      setLoading(false)
    }
  }

  // ── 送付済 ───────────────────────────────────────────
  async function handleSend() {
    if (!estimate.project.contact) {
      toast.error("先方担当者が設定されていません")
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/estimates/${estimate.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: estimate.project.contact.id }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "エラー")
      }
      toast.success("送付済にしました。3営業日後にフォロー通知が届きます。")
      router.refresh()
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
      router.push(`/estimates/${data.id}`)
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
        initialNote={estimate.note}
        initialDiscount={discount}
        initialValidDays={estimate.validDays}
        initialSections={initialSections}
        units={units}
        taxRate={taxRate}
        onSaved={() => {
          setIsEditing(false)
          router.refresh()
        }}
        onCancel={() => setIsEditing(false)}
      />
    )
  }

  // ── 閲覧モード表示 ────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/projects/${estimate.project.id}`)}
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          現場に戻る
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">
              {estimate.estimateNumber
                ? `見積 ${estimate.estimateNumber}`
                : "見積（下書き）"}
              {estimate.revision > 1 && (
                <span className="text-base text-slate-500 ml-2">
                  第{estimate.revision}版
                </span>
              )}
            </h1>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium ${className}`}
            >
              {label}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {estimate.project.branch.company.name} / {estimate.project.name}
          </p>
        </div>

        {/* アクションボタン */}
        <div className="flex gap-2 flex-wrap justify-end">
          {/* プレビュー（全ステータス共通） */}
          <Button
            variant="outline"
            onClick={() =>
              window.open(`/estimates/${estimate.id}/print`, "_blank")
            }
            className="border-slate-300 text-slate-600 hover:bg-slate-50"
          >
            <Printer className="w-4 h-4 mr-2" />
            プレビュー
          </Button>

          {/* 印刷・PDF（確定・送付済のみ） */}
          {(estimate.status === "CONFIRMED" || estimate.status === "SENT") && (
            <Button
              onClick={() =>
                window.open(`/estimates/${estimate.id}/print?print=1`, "_blank")
              }
              className="gap-2"
            >
              <Printer className="w-4 h-4" />
              印刷・PDF
            </Button>
          )}

          {estimate.status === "DRAFT" && (
            <Button
              variant="outline"
              onClick={() => setIsEditing(true)}
              className="border-orange-300 text-orange-700 hover:bg-orange-50"
            >
              <Pencil className="w-4 h-4 mr-2" />
              編集する
            </Button>
          )}
          {estimate.status === "DRAFT" && (
            <Button onClick={handleConfirm} disabled={loading}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              確定する
            </Button>
          )}
          {estimate.status === "CONFIRMED" && (
            <Button onClick={handleSend} disabled={loading}>
              <Send className="w-4 h-4 mr-2" />
              送付済にする
            </Button>
          )}
          {(estimate.status === "CONFIRMED" || estimate.status === "SENT") && (
            <Button variant="outline" onClick={handleRevise} disabled={loading}>
              <Copy className="w-4 h-4 mr-2" />
              改訂版作成
            </Button>
          )}
        </div>
      </div>

      {/* 見積情報カード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-slate-400 mb-1">現場</p>
            <p className="font-medium">{estimate.project.name}</p>
            <p className="text-sm text-slate-400">{estimate.project.shortId}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-slate-400 mb-1">先方担当者</p>
            <p className="font-medium">
              {estimate.project.contact?.name ?? "未設定"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-slate-400 mb-1">作成者 / 作成日</p>
            <p className="font-medium">{estimate.user.name}</p>
            <p className="text-sm text-slate-400">
              {formatDate(estimate.createdAt, "yyyy/MM/dd")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 下書きの場合の編集案内バナー */}
      {estimate.status === "DRAFT" && (
        <div
          className="flex items-center gap-3 px-4 py-3 bg-orange-50 border border-orange-200 rounded-lg cursor-pointer hover:bg-orange-100 transition-colors"
          onClick={() => setIsEditing(true)}
        >
          <Pencil className="w-5 h-5 text-orange-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-orange-800">
              この見積は下書きです — クリックして編集できます
            </p>
            <p className="text-xs text-orange-600 mt-0.5">
              項目の追加・金額変更・備考の編集が可能です
            </p>
          </div>
        </div>
      )}

      {/* 確定・送付済の場合の改訂案内 */}
      {(estimate.status === "CONFIRMED" || estimate.status === "SENT") && (
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
          <Copy className="w-5 h-5 text-blue-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-800">
              内容を変更する場合は「改訂版作成」を使ってください
            </p>
            <p className="text-xs text-blue-600 mt-0.5">
              この版は履歴として保存されます。改訂版（下書き）で編集 → 再確定という流れになります。
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRevise}
            disabled={loading}
            className="border-blue-300 text-blue-700 hover:bg-blue-100 flex-shrink-0"
          >
            <Copy className="w-3.5 h-3.5 mr-1.5" />
            改訂版作成
          </Button>
        </div>
      )}

      {/* 明細テーブル */}
      {estimate.sections.map((section) => (
        <Card key={section.id}>
          <CardHeader className="py-3 px-4 bg-slate-800 text-white rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-slate-400" />
              {section.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {section.groups.map((group) => (
              <div key={group.id}>
                <div className="px-4 py-2 bg-slate-100 border-y border-slate-200">
                  <p className="text-sm font-medium text-slate-700">
                    {group.name}
                  </p>
                </div>
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
                        <TableCell>{item.name}</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {item.quantity.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {item.unit.name}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          ¥{formatCurrency(item.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-medium">
                          ¥{formatCurrency(item.quantity * item.unitPrice)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* 合計 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-end gap-2 text-sm">
            <div className="flex gap-8">
              <span className="text-slate-500">小計（税抜）</span>
              <span className="font-mono font-medium w-36 text-right">
                ¥{formatCurrency(subtotal)}
              </span>
            </div>
            {discount > 0 && (
              <div className="flex gap-8">
                <span className="text-slate-500">値引き</span>
                <span className="font-mono text-red-600 w-36 text-right">
                  -¥{formatCurrency(discount)}
                </span>
              </div>
            )}
            <div className="flex gap-8">
              <span className="text-slate-500">
                消費税（{Math.round(taxRate * 100)}%）
              </span>
              <span className="font-mono w-36 text-right">
                ¥{formatCurrency(tax)}
              </span>
            </div>
            <div className="flex gap-8 pt-2 border-t border-slate-200">
              <span className="font-bold text-base">合計（税込）</span>
              <span className="font-mono font-bold text-lg w-36 text-right text-blue-700">
                ¥{formatCurrency(total)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 備考 */}
      {estimate.note && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500">特記事項</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{estimate.note}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

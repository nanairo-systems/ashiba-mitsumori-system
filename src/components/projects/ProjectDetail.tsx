/**
 * [COMPONENT] 現場詳細 - ProjectDetail
 *
 * 現場の基本情報・担当者・見積一覧を表示。
 * 「新規見積作成」ボタンを押すと、テンプレート選択ダイアログが開く。
 *
 * 新規見積の作成フロー:
 * 1. 「新規見積作成」ボタンをクリック
 * 2. ダイアログでテンプレートを選ぶ（またはスキップ）
 * 3. POST /api/estimates → 作成された見積の編集画面へ遷移
 */
"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { formatDate, formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  ArrowLeft,
  Plus,
  FileText,
  Building2,
  MapPin,
  User,
  Calendar,
  LayoutTemplate,
  CheckCircle2,
  Loader2,
  ChevronRight,
} from "lucide-react"
import { toast } from "sonner"
import type { EstimateStatus } from "@prisma/client"

// ─── ステータス表示設定 ────────────────────────────────

const statusConfig: Record<
  EstimateStatus,
  { label: string; className: string }
> = {
  DRAFT: { label: "下書き", className: "bg-orange-100 text-orange-700" },
  CONFIRMED: { label: "確定", className: "bg-blue-100 text-blue-700" },
  SENT: { label: "送付済", className: "bg-green-100 text-green-700" },
  OLD: { label: "旧版", className: "bg-slate-100 text-slate-500" },
}

// ─── 型定義 ────────────────────────────────────────────

interface Template {
  id: string
  name: string
  description: string | null
  /** セクション数（テンプレートの規模感を示す） */
  _count?: { sections: number }
  sections: {
    groups: {
      items: { quantity: number; unitPrice: number }[]
    }[]
  }[]
}

interface Props {
  project: {
    id: string
    shortId: string
    name: string
    address: string | null
    startDate: Date | null
    endDate: Date | null
    branch: {
      name: string
      company: { name: string }
    }
    contact: { name: string; phone: string; email: string } | null
    estimates: {
      id: string
      estimateNumber: string | null
      revision: number
      status: EstimateStatus
      note: string | null
      createdAt: Date
      user: { name: string }
      sections: {
        groups: {
          items: { quantity: number; unitPrice: number }[]
        }[]
      }[]
    }[]
  }
  templates: Template[]
  currentUser: { id: string; name: string }
}

// ─── 見積金額計算 ──────────────────────────────────────

function calcTotal(
  sections: { groups: { items: { quantity: number; unitPrice: number }[] }[] }[]
): number {
  return sections.reduce(
    (s, sec) =>
      s +
      sec.groups.reduce(
        (gs, g) =>
          gs + g.items.reduce((is, i) => is + i.quantity * i.unitPrice, 0),
        0
      ),
    0
  )
}

// ─── テンプレートの想定金額を計算（参考表示用） ──────

function calcTemplateTotal(tpl: Template): number {
  return calcTotal(tpl.sections)
}

// ─── メインコンポーネント ───────────────────────────────

export function ProjectDetail({ project, templates, currentUser }: Props) {
  const router = useRouter()

  // テンプレート選択ダイアログの状態
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  )
  const [creating, setCreating] = useState(false)

  // ── 見積作成 ──────────────────────────────────────────
  async function handleCreateEstimate() {
    setCreating(true)
    try {
      const res = await fetch("/api/estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          templateId: selectedTemplateId ?? undefined,
        }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast.success(
        selectedTemplateId
          ? "テンプレートから見積を作成しました。内容を確認・編集してください。"
          : "空の見積を作成しました。明細を入力してください。"
      )
      setDialogOpen(false)
      router.push(`/estimates/${data.id}`)
    } catch {
      toast.error("見積の作成に失敗しました")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ━━ ヘッダー ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          一覧に戻る
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400 font-mono">
              {project.shortId}
            </span>
            <h1 className="text-2xl font-bold text-slate-900">
              {project.name}
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            {project.branch.company.name} / {project.branch.name}
          </p>
        </div>
        <Button
          onClick={() => {
            setSelectedTemplateId(null)
            setDialogOpen(true)
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          新規見積作成
        </Button>
      </div>

      {/* ━━ 現場情報カード ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500">
              基本情報
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span className="text-slate-600">会社:</span>
              <span className="font-medium">
                {project.branch.company.name}
              </span>
              <span className="text-slate-400">/ {project.branch.name}</span>
            </div>
            {project.address && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600">住所:</span>
                <span>{project.address}</span>
              </div>
            )}
            {(project.startDate || project.endDate) && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600">工期:</span>
                <span>
                  {project.startDate
                    ? formatDate(project.startDate, "yyyy/MM/dd")
                    : "未定"}
                  {" 〜 "}
                  {project.endDate
                    ? formatDate(project.endDate, "yyyy/MM/dd")
                    : "未定"}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500">
              先方担当者
            </CardTitle>
          </CardHeader>
          <CardContent>
            {project.contact ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="font-medium">{project.contact.name}</span>
                </div>
                <p className="text-sm text-slate-500 pl-6">
                  {project.contact.phone}
                </p>
                <p className="text-sm text-slate-500 pl-6">
                  {project.contact.email}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-400">未設定</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ━━ 見積一覧 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            見積一覧
            <Badge variant="secondary" className="ml-2">
              {project.estimates.length}件
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>見積番号</TableHead>
                <TableHead>版</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>金額（税抜）</TableHead>
                <TableHead>作成者</TableHead>
                <TableHead>作成日</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {project.estimates.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-16 text-slate-400"
                  >
                    <LayoutTemplate className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p>見積がまだありません</p>
                    <p className="text-xs mt-1">
                      「新規見積作成」ボタンから作成できます
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                project.estimates.map((est) => {
                  const { label, className } = statusConfig[est.status]
                  const total = calcTotal(est.sections)
                  return (
                    <TableRow key={est.id} className="hover:bg-slate-50">
                      <TableCell>
                        <Link
                          href={`/estimates/${est.id}`}
                          className="text-blue-600 hover:underline font-mono text-sm"
                        >
                          {est.estimateNumber ?? "（下書き）"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        第{est.revision}版
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}
                        >
                          {label}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        ¥{formatCurrency(total)}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {est.user.name}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {formatDate(est.createdAt, "yyyy/MM/dd")}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ━━ テンプレート選択ダイアログ ━━━━━━━━━━━━━━━━━━━━━━ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              新規見積作成
            </DialogTitle>
            <DialogDescription>
              テンプレートを選ぶと明細が自動入力されます。
              後から自由に編集できます。
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {/* テンプレートなし（空の見積） */}
            <button
              type="button"
              onClick={() => setSelectedTemplateId(null)}
              className={`
                w-full text-left p-4 rounded-xl border-2 transition-all
                ${
                  selectedTemplateId === null
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }
              `}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    selectedTemplateId === null
                      ? "bg-blue-500"
                      : "bg-slate-200"
                  }`}
                >
                  {selectedTemplateId === null ? (
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  ) : (
                    <FileText className="w-4 h-4 text-slate-500" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-slate-900">
                    空の見積から作成
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    テンプレートを使わずに一から入力する
                  </p>
                </div>
              </div>
            </button>

            {/* テンプレート一覧 */}
            {templates.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-400 px-1 mb-2">
                  テンプレートから作成
                </p>
                <div className="space-y-2">
                  {templates.map((tpl) => {
                    const isSelected = selectedTemplateId === tpl.id
                    const tplTotal = calcTemplateTotal(tpl)
                    const itemCount = tpl.sections.reduce(
                      (s, sec) =>
                        s +
                        sec.groups.reduce(
                          (gs, g) => gs + g.items.length,
                          0
                        ),
                      0
                    )

                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => setSelectedTemplateId(tpl.id)}
                        className={`
                          w-full text-left p-4 rounded-xl border-2 transition-all
                          ${
                            isSelected
                              ? "border-blue-500 bg-blue-50"
                              : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                          }
                        `}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              isSelected
                                ? "bg-blue-500"
                                : "bg-slate-200"
                            }`}
                          >
                            {isSelected ? (
                              <CheckCircle2 className="w-5 h-5 text-white" />
                            ) : (
                              <LayoutTemplate className="w-4 h-4 text-slate-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900">
                              {tpl.name}
                            </p>
                            {tpl.description && (
                              <p className="text-xs text-slate-500 mt-0.5 truncate">
                                {tpl.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="text-xs text-slate-400">
                                {tpl.sections.length}セクション /{" "}
                                {itemCount}項目
                              </span>
                              {tplTotal > 0 && (
                                <span className="text-xs font-mono text-slate-500">
                                  参考: ¥{formatCurrency(tplTotal)}〜
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0 mt-1" />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {templates.length === 0 && (
              <div className="text-center py-4 text-sm text-slate-400">
                <LayoutTemplate className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p>テンプレートがまだありません</p>
                <p className="text-xs mt-1">
                  テンプレ管理画面から作成できます
                </p>
              </div>
            )}
          </div>

          {/* ボタンエリア */}
          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDialogOpen(false)}
              disabled={creating}
            >
              キャンセル
            </Button>
            <Button
              className="flex-1"
              onClick={handleCreateEstimate}
              disabled={creating}
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  作成中...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  {selectedTemplateId
                    ? "このテンプレートで作成"
                    : "空の見積で作成"}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

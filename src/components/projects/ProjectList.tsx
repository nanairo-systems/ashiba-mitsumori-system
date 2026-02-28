/**
 * [COMPONENT] 現場・見積一覧 - ProjectList
 *
 * 会社ごとにグループ化して現場を表示する。
 * 各行に：現場名 / 見積ステータス / 作成日 / 税込金額 / 先方担当者 / 自社担当者
 * 三点メニューから：詳細 / 見積を開く / 契約処理 / 失注アーカイブ
 */
"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { formatDate, formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Plus,
  Search,
  Archive,
  MoreHorizontal,
  Eye,
  FileText,
  HandshakeIcon,
  ChevronDown,
  ChevronRight,
  Building2,
} from "lucide-react"
import { toast } from "sonner"
import type { EstimateStatus, ContractStatus } from "@prisma/client"

// ─── 型定義 ────────────────────────────────────────────

interface LatestEstimate {
  id: string
  status: EstimateStatus
  confirmedAt: Date | null
  createdAt: Date
  user: { id: string; name: string }
  totalAmount: number | null
  contractId: string | null
  contractStatus: ContractStatus | null
}

interface Project {
  id: string
  name: string
  isArchived: boolean
  createdAt: Date
  updatedAt: Date
  branch: { name: string; company: { id: string; name: string } }
  contact: { name: string } | null
  latestEstimate: LatestEstimate | null
}

interface Props {
  projects: Project[]
  currentUser: { id: string; name: string }
}

// ─── 定数 ──────────────────────────────────────────────

const ESTIMATE_STATUS_LABEL: Record<EstimateStatus, string> = {
  DRAFT: "下書き中",
  CONFIRMED: "確定済",
  SENT: "送付済",
  OLD: "旧版",
}

const ESTIMATE_STATUS_STYLE: Record<EstimateStatus, string> = {
  DRAFT: "bg-slate-200 text-slate-700 border-slate-300",
  CONFIRMED: "bg-blue-500 text-white border-blue-600",
  SENT: "bg-emerald-500 text-white border-emerald-600",
  OLD: "bg-orange-400 text-white border-orange-500",
}

const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  CONTRACTED: "契約済",
  COMPLETED: "完工",
  CANCELLED: "キャンセル",
}

// ─── 契約処理ダイアログ ────────────────────────────────

interface ContractDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  project: Project
  estimate: LatestEstimate
  onContracted: () => void
}

function ContractDialog({ open, onOpenChange, project, estimate, onContracted }: ContractDialogProps) {
  const totalAmount = estimate.totalAmount ?? 0
  // 消費税は合計の約9.09%（税率10%の場合 税抜 = 税込÷1.1）
  const taxExcluded = Math.round(totalAmount / 1.1)
  const taxAmount = totalAmount - taxExcluded

  const today = new Date().toISOString().slice(0, 10)
  const [contractDate, setContractDate] = useState(today)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [paymentTerms, setPaymentTerms] = useState("月末締め翌月末払い")
  const [depositAmount, setDepositAmount] = useState("")
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!contractDate) {
      toast.error("契約日を入力してください")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          estimateId: estimate.id,
          contractAmount: taxExcluded,
          taxAmount,
          totalAmount,
          contractDate,
          startDate: startDate || null,
          endDate: endDate || null,
          paymentTerms: paymentTerms || null,
          depositAmount: depositAmount ? Number(depositAmount) : null,
          note: note || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "契約処理に失敗しました")
      }
      toast.success("契約処理が完了しました")
      onOpenChange(false)
      onContracted()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "エラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandshakeIcon className="w-5 h-5 text-green-600" />
            契約処理
          </DialogTitle>
          <DialogDescription>
            {project.branch.company.name} / {project.name}
          </DialogDescription>
        </DialogHeader>

        {/* 金額確認 */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1 text-sm">
          <div className="flex justify-between text-slate-500">
            <span>税抜金額</span>
            <span className="font-mono">¥{formatCurrency(taxExcluded)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>消費税（10%）</span>
            <span className="font-mono">¥{formatCurrency(taxAmount)}</span>
          </div>
          <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
            <span>契約金額（税込）</span>
            <span className="font-mono text-base">¥{formatCurrency(totalAmount)}</span>
          </div>
        </div>

        {/* 入力フォーム */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">
                契約日 <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                value={contractDate}
                onChange={(e) => setContractDate(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">前払金（任意）</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">¥</span>
                <Input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0"
                  className="pl-6 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">着工予定日</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">完工予定日</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">支払条件</Label>
            <Input
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              placeholder="例：月末締め翌月末払い"
              className="text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">備考</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="特記事項があれば入力"
              rows={2}
              className="text-sm resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-green-600 hover:bg-green-700">
            <HandshakeIcon className="w-4 h-4 mr-2" />
            {loading ? "処理中..." : "契約を確定する"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── メインコンポーネント ───────────────────────────────

export function ProjectList({ projects, currentUser }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [showArchived, setShowArchived] = useState(false)
  const [collapsedCompanies, setCollapsedCompanies] = useState<Set<string>>(new Set())
  const [contractTarget, setContractTarget] = useState<{
    project: Project
    estimate: LatestEstimate
  } | null>(null)

  const filtered = projects.filter((p) => {
    const q = search.toLowerCase()
    const matchSearch =
      q === "" ||
      p.branch.company.name.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      (p.contact?.name.toLowerCase().includes(q) ?? false)
    const matchArchive = showArchived ? p.isArchived : !p.isArchived
    return matchSearch && matchArchive
  })

  // 会社別グループ化
  const grouped = useMemo(() => {
    const map = new Map<string, { companyId: string; companyName: string; projects: Project[] }>()
    for (const p of filtered) {
      const key = p.branch.company.id
      if (!map.has(key)) {
        map.set(key, { companyId: key, companyName: p.branch.company.name, projects: [] })
      }
      map.get(key)!.projects.push(p)
    }
    return Array.from(map.values())
  }, [filtered])

  function toggleCompany(companyId: string) {
    setCollapsedCompanies((prev) => {
      const next = new Set(prev)
      if (next.has(companyId)) next.delete(companyId)
      else next.add(companyId)
      return next
    })
  }

  async function handleArchive(projectId: string) {
    if (!confirm("この現場を失注としてアーカイブしますか？")) return
    const res = await fetch(`/api/projects/${projectId}/archive`, { method: "PATCH" })
    if (res.ok) {
      toast.success("アーカイブしました")
      router.refresh()
    } else {
      toast.error("失敗しました")
    }
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">現場・見積一覧</h1>
          <p className="text-sm text-slate-500 mt-1">
            こんにちは、{currentUser.name} さん
          </p>
        </div>
        <Link href="/projects/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            新規現場作成
          </Button>
        </Link>
      </div>

      {/* 検索・フィルター */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="会社名・現場名・担当者で検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant={showArchived ? "default" : "outline"}
          size="sm"
          onClick={() => setShowArchived(!showArchived)}
        >
          <Archive className="w-4 h-4 mr-2" />
          {showArchived ? "失注を隠す" : "失注を表示"}
        </Button>
      </div>

      {/* 一覧 */}
      {grouped.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-slate-400">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          現場が見つかりません
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ companyId, companyName, projects: companyProjects }) => {
            const isCollapsed = collapsedCompanies.has(companyId)
            return (
              <div key={companyId} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* 会社名ヘッダー */}
                <button
                  onClick={() => toggleCompany(companyId)}
                  className="w-full flex items-center gap-2 px-4 py-3 bg-slate-800 text-white text-left hover:bg-slate-700 transition-colors"
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 flex-shrink-0" />
                  )}
                  <Building2 className="w-4 h-4 flex-shrink-0 text-slate-300" />
                  <span className="font-semibold">{companyName}</span>
                  <span className="ml-auto text-xs text-slate-400 font-normal">
                    {companyProjects.length} 件
                  </span>
                </button>

                {/* 現場行 */}
                {!isCollapsed && (
                  <div>
                    {/* テーブルヘッダー */}
                    <div className="grid grid-cols-[5rem_2fr_1fr_1fr_1.2fr_1fr_1fr_2.5rem] gap-x-2 px-4 py-2 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-400 uppercase tracking-wide">
                      <span>ステータス</span>
                      <span>現場名</span>
                      <span>立ち上げ日</span>
                      <span>見積確定日</span>
                      <span>見積金額（税込）</span>
                      <span>先方担当</span>
                      <span>自社担当</span>
                      <span />
                    </div>

                    {companyProjects.map((project, idx) => {
                      const est = project.latestEstimate
                      const isLast = idx === companyProjects.length - 1
                      return (
                        <div
                          key={project.id}
                          className={`grid grid-cols-[5rem_2fr_1fr_1fr_1.2fr_1fr_1fr_2.5rem] gap-x-2 px-4 py-3 items-center hover:bg-blue-50/40 transition-colors ${
                            !isLast ? "border-b border-slate-100" : ""
                          }`}
                        >
                          {/* ステータス（一番左） */}
                          <div>
                            {est ? (
                              est.contractId ? (
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-green-500 text-white shadow-sm">
                                  {CONTRACT_STATUS_LABEL[est.contractStatus!]}
                                </span>
                              ) : (
                                <span
                                  className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold shadow-sm ${ESTIMATE_STATUS_STYLE[est.status]}`}
                                >
                                  {ESTIMATE_STATUS_LABEL[est.status]}
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-400">
                                未作成
                              </span>
                            )}
                          </div>

                          {/* 現場名 */}
                          <div className="min-w-0">
                            <Link
                              href={`/projects/${project.id}`}
                              className="font-medium text-sm text-slate-800 hover:text-blue-600 hover:underline truncate block"
                            >
                              {project.name}
                            </Link>
                            {project.branch.name !== "本社" && (
                              <span className="text-xs text-slate-400 truncate block">
                                {project.branch.name}
                              </span>
                            )}
                          </div>

                          {/* 現場立ち上げ日 */}
                          <div className="text-sm text-slate-500">
                            {formatDate(project.createdAt, "M/d")}
                          </div>

                          {/* 見積確定日（未確定は空白） */}
                          <div className="text-sm text-slate-500">
                            {est?.confirmedAt
                              ? formatDate(est.confirmedAt, "M/d")
                              : <span className="text-slate-300">—</span>}
                          </div>

                          {/* 見積金額 */}
                          <div className="font-mono text-sm font-semibold text-slate-800">
                            {est?.totalAmount != null
                              ? `¥${formatCurrency(est.totalAmount)}`
                              : <span className="text-slate-300 font-normal">—</span>}
                          </div>

                          {/* 先方担当者 */}
                          <div className="text-sm text-slate-600 truncate">
                            {project.contact?.name ?? <span className="text-slate-300">—</span>}
                          </div>

                          {/* 自社担当者 */}
                          <div className="text-sm text-slate-600 truncate">
                            {est?.user.name ?? <span className="text-slate-300">—</span>}
                          </div>

                          {/* 三点メニュー */}
                          <div className="flex justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem asChild>
                                  <Link href={`/projects/${project.id}`} className="flex items-center gap-2">
                                    <Eye className="w-4 h-4" />
                                    現場詳細を開く
                                  </Link>
                                </DropdownMenuItem>
                                {est && (
                                  <DropdownMenuItem asChild>
                                    <Link href={`/estimates/${est.id}`} className="flex items-center gap-2">
                                      <FileText className="w-4 h-4" />
                                      見積を開く
                                    </Link>
                                  </DropdownMenuItem>
                                )}

                                <DropdownMenuSeparator />

                                {/* 契約処理 */}
                                {est && !est.contractId && (
                                  est.status === "CONFIRMED" || est.status === "SENT" ? (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        setContractTarget({ project, estimate: est })
                                      }
                                      className="flex items-center gap-2 text-green-700 focus:text-green-700 focus:bg-green-50"
                                    >
                                      <HandshakeIcon className="w-4 h-4" />
                                      契約処理
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem
                                      disabled
                                      className="flex items-center gap-2 text-slate-400 cursor-not-allowed"
                                    >
                                      <HandshakeIcon className="w-4 h-4" />
                                      契約処理（確定後に可）
                                    </DropdownMenuItem>
                                  )
                                )}
                                {est?.contractId && (
                                  <DropdownMenuItem asChild>
                                    <Link href={`/contracts`} className="flex items-center gap-2 text-green-700">
                                      <HandshakeIcon className="w-4 h-4" />
                                      契約を確認する
                                    </Link>
                                  </DropdownMenuItem>
                                )}

                                <DropdownMenuSeparator />

                                <DropdownMenuItem
                                  onClick={() => handleArchive(project.id)}
                                  className="flex items-center gap-2 text-orange-600 focus:text-orange-600 focus:bg-orange-50"
                                >
                                  <Archive className="w-4 h-4" />
                                  失注としてアーカイブ
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs text-slate-400 text-right">
        {filtered.length} 件表示
      </p>

      {/* 契約処理ダイアログ */}
      {contractTarget && (
        <ContractDialog
          open={true}
          onOpenChange={(v) => { if (!v) setContractTarget(null) }}
          project={contractTarget.project}
          estimate={contractTarget.estimate}
          onContracted={() => {
            setContractTarget(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

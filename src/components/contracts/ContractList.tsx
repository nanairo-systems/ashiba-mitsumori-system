/**
 * [COMPONENT] 契約一覧 - ContractList
 *
 * 契約処理済み案件の一覧。
 * 会社名ヘッダー → 各契約行（現場名 / 契約金額 / 契約日 / 着工〜完工 / ステータス / 担当者）
 * 三点メニューから契約ステータスの更新（完工・キャンセル）が可能。
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
  Search,
  MoreHorizontal,
  Eye,
  FileText,
  CheckCircle2,
  XCircle,
  Building2,
  ChevronDown,
  ChevronRight,
  HandshakeIcon,
} from "lucide-react"
import { toast } from "sonner"
import type { ContractStatus } from "@prisma/client"

// ─── 型定義 ────────────────────────────────────────────

interface Contract {
  id: string
  contractNumber: string | null
  status: ContractStatus
  contractAmount: number
  taxAmount: number
  totalAmount: number
  depositAmount: number | null
  contractDate: Date
  startDate: Date | null
  endDate: Date | null
  paymentTerms: string | null
  note: string | null
  createdAt: Date
  project: {
    id: string
    name: string
    branch: { name: string; company: { id: string; name: string } }
    contact: { name: string } | null
  }
  estimate: {
    id: string
    estimateNumber: string | null
    user: { id: string; name: string }
  }
}

interface Props {
  contracts: Contract[]
  currentUser: { id: string; name: string }
}

// ─── 定数 ──────────────────────────────────────────────

const STATUS_LABEL: Record<ContractStatus, string> = {
  CONTRACTED: "契約済",
  COMPLETED: "完工",
  CANCELLED: "キャンセル",
}

const STATUS_STYLE: Record<ContractStatus, string> = {
  CONTRACTED: "bg-blue-50 text-blue-700 border-blue-200",
  COMPLETED: "bg-green-50 text-green-700 border-green-200",
  CANCELLED: "bg-slate-100 text-slate-500 border-slate-200",
}

// ─── メインコンポーネント ───────────────────────────────

export function ContractList({ contracts, currentUser }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<ContractStatus | "ALL">("ALL")
  const [collapsedCompanies, setCollapsedCompanies] = useState<Set<string>>(new Set())

  const filtered = contracts.filter((c) => {
    const q = search.toLowerCase()
    const matchSearch =
      q === "" ||
      c.project.branch.company.name.toLowerCase().includes(q) ||
      c.project.name.toLowerCase().includes(q) ||
      (c.contractNumber?.toLowerCase().includes(q) ?? false)
    const matchStatus = statusFilter === "ALL" || c.status === statusFilter
    return matchSearch && matchStatus
  })

  // 会社別グループ化
  const grouped = useMemo(() => {
    const map = new Map<string, { companyId: string; companyName: string; contracts: Contract[] }>()
    for (const c of filtered) {
      const key = c.project.branch.company.id
      if (!map.has(key)) {
        map.set(key, { companyId: key, companyName: c.project.branch.company.name, contracts: [] })
      }
      map.get(key)!.contracts.push(c)
    }
    return Array.from(map.values())
  }, [filtered])

  function toggleCompany(id: string) {
    setCollapsedCompanies((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function updateStatus(contractId: string, status: ContractStatus) {
    const label = STATUS_LABEL[status]
    if (!confirm(`このステータスを「${label}」に変更しますか？`)) return
    const res = await fetch(`/api/contracts/${contractId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      toast.success(`${label}に更新しました`)
      router.refresh()
    } else {
      toast.error("更新に失敗しました")
    }
  }

  // 集計
  const totalContracted = filtered
    .filter((c) => c.status !== "CANCELLED")
    .reduce((sum, c) => sum + c.totalAmount, 0)

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">契約一覧</h1>
          <p className="text-sm text-slate-500 mt-1">
            契約処理済み案件の管理 — こんにちは、{currentUser.name} さん
          </p>
        </div>
        <Link href="/">
          <Button variant="outline" size="sm">
            現場・見積一覧へ
          </Button>
        </Link>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-3 gap-4">
        {(["ALL", "CONTRACTED", "COMPLETED"] as const).map((key) => {
          const count =
            key === "ALL"
              ? contracts.filter((c) => c.status !== "CANCELLED").length
              : contracts.filter((c) => c.status === key).length
          const amount =
            key === "ALL"
              ? contracts.filter((c) => c.status !== "CANCELLED").reduce((s, c) => s + c.totalAmount, 0)
              : contracts.filter((c) => c.status === key).reduce((s, c) => s + c.totalAmount, 0)
          const label = key === "ALL" ? "合計（有効）" : STATUS_LABEL[key]
          const style =
            key === "ALL"
              ? "border-slate-200 bg-slate-50"
              : key === "CONTRACTED"
              ? "border-blue-200 bg-blue-50"
              : "border-green-200 bg-green-50"
          const textStyle =
            key === "ALL" ? "text-slate-700" : key === "CONTRACTED" ? "text-blue-700" : "text-green-700"
          return (
            <div key={key} className={`rounded-xl border p-4 ${style}`}>
              <p className={`text-xs font-medium mb-1 ${textStyle}`}>{label}</p>
              <p className={`text-xl font-bold font-mono ${textStyle}`}>
                ¥{formatCurrency(amount)}
              </p>
              <p className={`text-xs mt-1 ${textStyle} opacity-70`}>{count} 件</p>
            </div>
          )
        })}
      </div>

      {/* 検索・フィルター */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="会社名・現場名・契約番号で検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(["ALL", "CONTRACTED", "COMPLETED", "CANCELLED"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? "default" : "outline"}
              onClick={() => setStatusFilter(s)}
              className="text-xs"
            >
              {s === "ALL" ? "すべて" : STATUS_LABEL[s]}
            </Button>
          ))}
        </div>
      </div>

      {/* 一覧 */}
      {grouped.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center text-slate-400">
          <HandshakeIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
          契約が見つかりません
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ companyId, companyName, contracts: companyContracts }) => {
            const isCollapsed = collapsedCompanies.has(companyId)
            const companyTotal = companyContracts
              .filter((c) => c.status !== "CANCELLED")
              .reduce((s, c) => s + c.totalAmount, 0)
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
                  <span className="ml-auto text-sm font-mono text-slate-300">
                    ¥{formatCurrency(companyTotal)}
                  </span>
                  <span className="text-xs text-slate-400 font-normal ml-3">
                    {companyContracts.length} 件
                  </span>
                </button>

                {!isCollapsed && (
                  <div>
                    {/* テーブルヘッダー */}
                    <div className="grid grid-cols-[2fr_1fr_1.4fr_1fr_1fr_1fr_1fr_2.5rem] gap-x-3 px-4 py-2 bg-slate-50 border-b border-slate-100 text-xs font-medium text-slate-400 uppercase tracking-wide">
                      <span>現場名</span>
                      <span>ステータス</span>
                      <span className="text-right">契約金額（税込）</span>
                      <span>契約日</span>
                      <span>着工〜完工</span>
                      <span>先方担当</span>
                      <span>自社担当</span>
                      <span />
                    </div>

                    {companyContracts.map((contract, idx) => {
                      const isLast = idx === companyContracts.length - 1
                      return (
                        <div
                          key={contract.id}
                          className={`grid grid-cols-[2fr_1fr_1.4fr_1fr_1fr_1fr_1fr_2.5rem] gap-x-3 px-4 py-3 items-center hover:bg-blue-50/40 transition-colors ${
                            !isLast ? "border-b border-slate-100" : ""
                          } ${contract.status === "CANCELLED" ? "opacity-50" : ""}`}
                        >
                          {/* 現場名 */}
                          <div className="min-w-0">
                            <Link
                              href={`/projects/${contract.project.id}`}
                              className="font-medium text-sm text-slate-800 hover:text-blue-600 hover:underline truncate block"
                            >
                              {contract.project.name}
                            </Link>
                            {contract.contractNumber && (
                              <span className="text-xs text-slate-400 font-mono truncate block">
                                {contract.contractNumber}
                              </span>
                            )}
                          </div>

                          {/* ステータス */}
                          <div>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLE[contract.status]}`}
                            >
                              {STATUS_LABEL[contract.status]}
                            </span>
                          </div>

                          {/* 契約金額 */}
                          <div className="text-right font-mono text-sm font-semibold text-slate-800">
                            ¥{formatCurrency(contract.totalAmount)}
                          </div>

                          {/* 契約日 */}
                          <div className="text-sm text-slate-600">
                            {formatDate(contract.contractDate, "yyyy/MM/dd")}
                          </div>

                          {/* 着工〜完工 */}
                          <div className="text-xs text-slate-500">
                            {contract.startDate || contract.endDate ? (
                              <>
                                {contract.startDate
                                  ? formatDate(contract.startDate, "M/d")
                                  : "—"}
                                {" 〜 "}
                                {contract.endDate
                                  ? formatDate(contract.endDate, "M/d")
                                  : "—"}
                              </>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </div>

                          {/* 先方担当者 */}
                          <div className="text-sm text-slate-600 truncate">
                            {contract.project.contact?.name ?? (
                              <span className="text-slate-300">—</span>
                            )}
                          </div>

                          {/* 自社担当者 */}
                          <div className="text-sm text-slate-600 truncate">
                            {contract.estimate.user.name}
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
                                  <Link
                                    href={`/projects/${contract.project.id}`}
                                    className="flex items-center gap-2"
                                  >
                                    <Eye className="w-4 h-4" />
                                    現場詳細を開く
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={`/estimates/${contract.estimate.id}`}
                                    className="flex items-center gap-2"
                                  >
                                    <FileText className="w-4 h-4" />
                                    見積を開く
                                  </Link>
                                </DropdownMenuItem>

                                <DropdownMenuSeparator />

                                {contract.status === "CONTRACTED" && (
                                  <DropdownMenuItem
                                    onClick={() => updateStatus(contract.id, "COMPLETED")}
                                    className="flex items-center gap-2 text-green-700 focus:text-green-700 focus:bg-green-50"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                    完工にする
                                  </DropdownMenuItem>
                                )}
                                {contract.status !== "CANCELLED" && (
                                  <DropdownMenuItem
                                    onClick={() => updateStatus(contract.id, "CANCELLED")}
                                    className="flex items-center gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
                                  >
                                    <XCircle className="w-4 h-4" />
                                    キャンセルにする
                                  </DropdownMenuItem>
                                )}
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
        {filtered.length} 件 / 合計 ¥{formatCurrency(totalContracted)}
      </p>
    </div>
  )
}

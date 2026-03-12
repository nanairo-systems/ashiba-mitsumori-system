/**
 * [現操-05] 見積・発注情報セクション
 *
 * 契約に紐づく見積の金額サマリーと発注情報を表示する。
 * 一括見積（EstimateBundle）にも対応。
 * 「見積詳細を開く」はポップアップダイアログで表示（ページ遷移しない）。
 */
"use client"

import { useState, useEffect, useCallback } from "react"
import { Receipt, ShoppingCart, ChevronDown, ChevronUp, Loader2, FileText, ExternalLink, Package } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { EstimateDetail } from "@/components/estimates/EstimateDetail"
import { formatDate, formatYen } from "@/lib/utils"

interface EstimateItem {
  id: string
  name: string
  quantity: number
  unitPrice: number
  amount: number
  unitName: string
}

interface EstimateGroup {
  id: string
  name: string
  total: number
  items: EstimateItem[]
}

interface EstimateSection {
  id: string
  name: string
  total: number
  groups: EstimateGroup[]
}

interface PurchaseOrder {
  id: string
  subcontractorName: string
  orderAmount: number
  taxRate: number
  taxAmount: number
  totalAmount: number
  status: string
  orderedAt: string | null
  note: string | null
}

interface BundleInfo {
  bundleId: string
  bundleTitle: string | null
  bundleNumber: string | null
}

interface EstimateData {
  id: string
  title: string | null
  estimateNumber: string | null
  revision: number
  status: string
  estimateType: string
  subtotal: number
  discount: number
  taxRate: number
  taxAmount: number
  total: number
  sections: EstimateSection[]
  purchaseOrder: PurchaseOrder | null
  bundles: BundleInfo[]
  createdAt: string
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "下書き", className: "bg-slate-100 text-slate-600" },
  CONFIRMED: { label: "確定", className: "bg-blue-100 text-blue-700" },
  SENT: { label: "送付済", className: "bg-green-100 text-green-700" },
  OLD: { label: "旧版", className: "bg-slate-100 text-slate-400" },
}

const PO_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "下書き", className: "bg-slate-100 text-slate-600" },
  ORDERED: { label: "発注済", className: "bg-blue-100 text-blue-700" },
  COMPLETED: { label: "完了", className: "bg-green-100 text-green-700" },
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return ""
  return formatDate(dateStr, "yyyy/MM/dd")
}

function fmtCurrency(amount: number): string {
  return formatYen(amount)
}

// 見積詳細ダイアログ用の型
interface EstimateDetailData {
  estimate: Record<string, unknown>
  taxRate: number
  units: Array<{ id: string; name: string }>
  contacts: Array<{ id: string; name: string; phone: string; email: string }>
  currentUser: { id: string; name: string }
  purchaseOrder: Record<string, unknown> | null
}

interface Props {
  contractId: string
}

export function SiteOpsEstimateSection({ contractId }: Props) {
  const [estimates, setEstimates] = useState<EstimateData[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedEstimates, setExpandedEstimates] = useState<Set<string>>(new Set())

  // 見積詳細ダイアログ
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [detailData, setDetailData] = useState<EstimateDetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    async function fetchEstimates() {
      setLoading(true)
      try {
        const res = await fetch(`/api/contracts/${contractId}/estimates`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        setEstimates(data.estimates ?? [])
      } catch {
        setEstimates([])
      } finally {
        setLoading(false)
      }
    }
    fetchEstimates()
  }, [contractId])

  function toggleExpand(estimateId: string) {
    setExpandedEstimates((prev) => {
      const next = new Set(prev)
      if (next.has(estimateId)) {
        next.delete(estimateId)
      } else {
        next.add(estimateId)
      }
      return next
    })
  }

  // 見積詳細をダイアログで開く
  const openEstimateDetail = useCallback(async (estimateId: string) => {
    setDetailLoading(true)
    setDetailDialogOpen(true)
    try {
      // 見積データと現在のユーザーを並行取得
      const [estRes, userRes] = await Promise.all([
        fetch(`/api/estimates/${estimateId}`),
        fetch("/api/auth/me"),
      ])
      if (!estRes.ok) throw new Error("見積データの取得に失敗しました")
      const estData = await estRes.json()
      const userData = userRes.ok ? await userRes.json() : { id: "", name: "不明" }

      setDetailData({
        estimate: estData.estimate,
        taxRate: estData.taxRate,
        units: estData.units,
        contacts: estData.contacts ?? [],
        currentUser: userData,
        purchaseOrder: estData.estimate?.purchaseOrder ?? null,
      })
    } catch {
      setDetailDialogOpen(false)
      setDetailData(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  // ダイアログ内で別の見積に遷移
  const handleNavigateEstimate = useCallback((newEstimateId: string) => {
    setDetailData(null)
    openEstimateDetail(newEstimateId)
  }, [openEstimateDetail])

  // ダイアログ内でデータ更新時
  const handleDetailRefresh = useCallback(() => {
    if (detailData?.estimate) {
      const estId = (detailData.estimate as { id: string }).id
      openEstimateDetail(estId)
    }
  }, [detailData, openEstimateDetail])

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
          <Receipt className="w-4 h-4" />
          <span>見積・発注情報</span>
        </div>
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          <span className="text-xs text-slate-400 ml-2">読み込み中...</span>
        </div>
      </div>
    )
  }

  if (estimates.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
          <Receipt className="w-4 h-4" />
          <span>見積・発注情報</span>
        </div>
        <div className="bg-slate-50 rounded-lg p-3 text-center">
          <p className="text-xs text-slate-400">見積が紐づいていません</p>
        </div>
      </div>
    )
  }

  // 束情報をまとめる（同じbundleIdの見積を統合表示用に集計）
  const bundleMap = new Map<string, { title: string | null; number: string | null; estimateIds: string[] }>()
  for (const est of estimates) {
    for (const b of est.bundles) {
      if (!bundleMap.has(b.bundleId)) {
        bundleMap.set(b.bundleId, { title: b.bundleTitle, number: b.bundleNumber, estimateIds: [] })
      }
      bundleMap.get(b.bundleId)!.estimateIds.push(est.id)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
        <Receipt className="w-4 h-4" />
        <span>見積・発注情報</span>
        <span className="text-xs text-slate-400 font-normal">({estimates.length}件)</span>
      </div>

      {/* 一括見積の表示 */}
      {bundleMap.size > 0 && (
        <div className="space-y-1.5">
          {[...bundleMap.entries()].map(([bundleId, bundle]) => {
            const bundleEstimates = estimates.filter((e) => bundle.estimateIds.includes(e.id))
            const bundleTotal = bundleEstimates.reduce((sum, e) => sum + e.total, 0)
            return (
              <div key={bundleId} className="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5">
                <div className="flex items-center gap-2">
                  <Package className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-xs font-bold text-indigo-700">
                    一括見積{bundle.number ? ` (${bundle.number})` : ""}
                  </span>
                  {bundle.title && (
                    <span className="text-xs text-indigo-600">{bundle.title}</span>
                  )}
                  <span className="ml-auto text-xs font-bold text-indigo-700">
                    合計 {fmtCurrency(bundleTotal)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-indigo-500">
                  {bundleEstimates.length}件の見積を含む
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 見積詳細ダイアログ */}
      <Dialog open={detailDialogOpen} onOpenChange={(o) => { if (!o) { setDetailDialogOpen(false); setDetailData(null) } }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          {detailLoading || !detailData ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400 mb-3" />
              <span className="text-sm text-slate-500">見積データを読み込み中...</span>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6">
              <EstimateDetail
                estimate={detailData.estimate as Parameters<typeof EstimateDetail>[0]["estimate"]}
                taxRate={detailData.taxRate}
                units={detailData.units as Parameters<typeof EstimateDetail>[0]["units"]}
                currentUser={detailData.currentUser}
                contacts={detailData.contacts}
                embedded={true}
                onClose={() => { setDetailDialogOpen(false); setDetailData(null) }}
                onNavigateEstimate={handleNavigateEstimate}
                onRefresh={handleDetailRefresh}
                purchaseOrder={detailData.purchaseOrder as Parameters<typeof EstimateDetail>[0]["purchaseOrder"]}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 各見積カード */}
      {estimates.map((est) => {
        const isExpanded = expandedEstimates.has(est.id)
        const statusInfo = STATUS_LABELS[est.status] ?? STATUS_LABELS.DRAFT
        const hasPO = !!est.purchaseOrder
        const inBundle = est.bundles.length > 0

        return (
          <div key={est.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            {/* ヘッダー（クリックで展開） */}
            <button
              onClick={() => toggleExpand(est.id)}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
            >
              <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-semibold text-slate-800 truncate">
                    {est.title || est.estimateNumber || "見積"}
                  </span>
                  {est.revision > 1 && (
                    <span className="text-xs text-slate-400">Rev.{est.revision}</span>
                  )}
                  <Badge className={`text-xs px-1.5 py-0 h-4 border-0 ${statusInfo.className}`}>
                    {statusInfo.label}
                  </Badge>
                  {inBundle && (
                    <Badge className="text-xs px-1.5 py-0 h-4 border-0 bg-indigo-50 text-indigo-600">
                      一括
                    </Badge>
                  )}
                  {hasPO && (
                    <Badge className="text-xs px-1.5 py-0 h-4 border-0 bg-amber-50 text-amber-700">
                      発注あり
                    </Badge>
                  )}
                </div>
              </div>
              <span className="text-sm font-bold text-slate-800 flex-shrink-0">
                {fmtCurrency(est.total)}
              </span>
              {isExpanded
                ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
              }
            </button>

            {/* 展開時の明細 */}
            {isExpanded && (
              <div className="border-t border-slate-100">
                {/* 金額サマリー */}
                <div className="px-3 py-2 bg-slate-50 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">小計</span>
                    <span className="text-slate-700 font-medium">{fmtCurrency(est.subtotal)}</span>
                  </div>
                  {est.discount > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-red-500">値引き</span>
                      <span className="text-red-600 font-medium">-{fmtCurrency(est.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">消費税 ({Math.round(est.taxRate * 100)}%)</span>
                    <span className="text-slate-700 font-medium">{fmtCurrency(est.taxAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-1 border-t border-slate-200">
                    <span className="text-slate-700 font-bold">合計</span>
                    <span className="text-slate-900 font-bold">{fmtCurrency(est.total)}</span>
                  </div>
                </div>

                {/* セクション明細 */}
                <div className="px-3 py-2 space-y-2">
                  {est.sections.map((sec) => (
                    <div key={sec.id}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-slate-700">{sec.name}</span>
                        <span className="text-xs text-slate-500">{fmtCurrency(sec.total)}</span>
                      </div>
                      {sec.groups.map((grp) => (
                        <div key={grp.id} className="ml-2 mb-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-slate-600">{grp.name}</span>
                            <span className="text-xs text-slate-500">{fmtCurrency(grp.total)}</span>
                          </div>
                          {grp.items.map((item) => (
                            <div key={item.id} className="ml-2 flex justify-between items-center text-xs text-slate-400 leading-relaxed">
                              <span className="truncate flex-1 mr-2">
                                {item.name}
                                <span className="text-slate-300 ml-1">
                                  {item.quantity}{item.unitName} × {fmtCurrency(item.unitPrice)}
                                </span>
                              </span>
                              <span className="flex-shrink-0">{fmtCurrency(item.amount)}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* 発注情報 */}
                {est.purchaseOrder && (
                  <div className="px-3 py-2 bg-amber-50 border-t border-amber-100">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <ShoppingCart className="w-3.5 h-3.5 text-amber-600" />
                      <span className="text-xs font-bold text-amber-700">発注情報</span>
                      <Badge className={`text-xs px-1.5 py-0 h-4 border-0 ml-1 ${
                        PO_STATUS_LABELS[est.purchaseOrder.status]?.className ?? "bg-slate-100 text-slate-600"
                      }`}>
                        {PO_STATUS_LABELS[est.purchaseOrder.status]?.label ?? est.purchaseOrder.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div>
                        <span className="text-amber-600">発注先</span>
                        <p className="text-slate-800 font-semibold">{est.purchaseOrder.subcontractorName}</p>
                      </div>
                      <div>
                        <span className="text-amber-600">発注金額</span>
                        <p className="text-slate-800 font-semibold">{fmtCurrency(est.purchaseOrder.orderAmount)}</p>
                      </div>
                      <div>
                        <span className="text-amber-600">税込合計</span>
                        <p className="text-slate-800 font-semibold">{fmtCurrency(est.purchaseOrder.totalAmount)}</p>
                      </div>
                      {est.purchaseOrder.orderedAt && (
                        <div>
                          <span className="text-amber-600">発注日</span>
                          <p className="text-slate-800 font-semibold">{fmtDate(est.purchaseOrder.orderedAt)}</p>
                        </div>
                      )}
                    </div>
                    {est.purchaseOrder.note && (
                      <p className="text-xs text-slate-600 mt-1.5 bg-white/50 rounded p-1.5">{est.purchaseOrder.note}</p>
                    )}
                    {/* 粗利表示 */}
                    <div className="mt-2 pt-1.5 border-t border-amber-200">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-amber-700 font-bold">粗利</span>
                        <span className={`font-bold ${
                          est.total - est.purchaseOrder.totalAmount >= 0 ? "text-green-700" : "text-red-600"
                        }`}>
                          {fmtCurrency(est.total - est.purchaseOrder.totalAmount)}
                          <span className="text-slate-400 font-normal ml-1">
                            ({est.total > 0 ? Math.round((est.total - est.purchaseOrder.totalAmount) / est.total * 100) : 0}%)
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 見積詳細をダイアログで開く */}
                <div className="px-3 py-2 border-t border-slate-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      openEstimateDetail(est.id)
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-semibold transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    見積詳細を開く
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

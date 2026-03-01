/**
 * [COMPONENT] 一括見積書印刷 - BulkEstimatePrint
 *
 * 複数の見積書を1ページにまとめて表示する。
 * 各見積書の間にページ区切り（break-after: page）を挿入する。
 */
"use client"

import { useEffect } from "react"
import { formatDate, formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Printer, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { addDays } from "date-fns"
import type { EstimateStatus, AddressType } from "@prisma/client"

interface EstimateItem {
  id: string
  name: string
  quantity: number
  unitPrice: number
  unit: { name: string }
}

interface EstimateGroup {
  id: string
  name: string
  items: EstimateItem[]
}

interface EstimateSection {
  id: string
  name: string
  groups: EstimateGroup[]
}

interface BulkEstimate {
  id: string
  estimateNumber: string | null
  revision: number
  status: EstimateStatus
  addressType: AddressType
  validDays: number
  note: string | null
  discountAmount: number | null
  confirmedAt: Date | null
  createdAt: Date
  project: {
    name: string
    branch: {
      name: string
      company: { name: string; phone: string | null; taxRate: number }
    }
    contact: { name: string; phone: string } | null
  }
  user: { name: string }
  sections: EstimateSection[]
}

interface Props {
  estimates: BulkEstimate[]
}

export function BulkEstimatePrint({ estimates }: Props) {
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => window.print(), 600)
    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      {/* ━━ ツールバー（印刷時は非表示） ━━ */}
      <div className="print:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 shadow-sm px-6 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (window.history.length > 1) router.back()
            else router.push("/")
          }}
          className="text-slate-600"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          戻る
        </Button>
        <span className="text-sm text-slate-500 flex-1 truncate">
          {estimates.length}件の見積書を印刷
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 hidden md:block">
            「印刷する」→「PDFに保存」でPDF出力できます
          </span>
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="w-4 h-4" />
            印刷する（PDF保存）
          </Button>
        </div>
      </div>

      {/* ━━ 印刷エリア ━━ */}
      <div className="pt-[60px] print:pt-0">
        {estimates.map((estimate, index) => {
          const taxRate = estimate.project.branch.company.taxRate
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

          const issueDate = estimate.confirmedAt ?? estimate.createdAt
          const expiryDate = addDays(new Date(issueDate), estimate.validDays)
          const isLast = index === estimates.length - 1

          return (
            <div
              key={estimate.id}
              className={`relative mx-auto bg-white w-[210mm] min-h-[297mm] px-[15mm] py-[12mm] shadow-xl print:shadow-none print:w-full print:min-h-0${!isLast ? " print:break-after-page" : ""}`}
              style={{ fontFamily: "'Noto Sans JP', sans-serif" }}
            >
              <div className="relative z-0 flex flex-col" style={{ minHeight: "calc(297mm - 24mm)" }}>
                {/* タイトル */}
                <div className="text-center mb-6">
                  <h1 className="text-2xl font-bold tracking-widest">御　見　積　書</h1>
                </div>

                {/* ヘッダー2列 */}
                <div className="flex gap-6 mb-6">
                  <div className="flex-1">
                    <div className="border-b-2 border-slate-800 pb-1 mb-3">
                      <p className="text-lg font-bold">
                        {estimate.project.branch.company.name}
                        <span className="text-sm font-normal ml-1">御中</span>
                      </p>
                      {estimate.project.contact && (
                        <p className="text-sm text-slate-600">
                          {estimate.project.contact.name} 様
                        </p>
                      )}
                    </div>
                    <p className="text-sm text-slate-600">
                      件名：<span className="font-medium text-slate-900">{estimate.project.name}</span>
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      有効期限：<span className="font-medium">{formatDate(expiryDate, "yyyy年MM月dd日")}まで</span>
                    </p>
                  </div>
                  <div className="w-52 flex-shrink-0 text-right">
                    <table className="text-xs text-slate-600 ml-auto">
                      <tbody>
                        <tr>
                          <td className="pr-2 py-0.5 text-right text-slate-400">発行日</td>
                          <td className="font-medium">{formatDate(issueDate, "yyyy年MM月dd日")}</td>
                        </tr>
                        <tr>
                          <td className="pr-2 py-0.5 text-right text-slate-400">見積番号</td>
                          <td className="font-medium font-mono">
                            {estimate.estimateNumber ? (
                              <>
                                {estimate.estimateNumber}
                                {estimate.revision > 1 && (
                                  <span className="text-slate-500"> 第{estimate.revision}版</span>
                                )}
                              </>
                            ) : (
                              <span className="text-slate-400">（未発行）</span>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td className="pr-2 py-0.5 text-right text-slate-400">担当者</td>
                          <td className="font-medium">{estimate.user.name}</td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-500">
                      <p className="font-bold text-sm text-slate-800">株式会社 足場屋</p>
                      <p>〒000-0000 ○○県○○市△△1-1</p>
                      <p>TEL: 000-0000-0000</p>
                    </div>
                  </div>
                </div>

                {/* 合計金額 */}
                <div className="bg-slate-50 border border-slate-300 rounded px-4 py-2 mb-5 flex items-center justify-between">
                  <span className="text-sm text-slate-500">御見積金額（税込）</span>
                  <span className="text-2xl font-bold text-slate-900 font-mono">¥ {formatCurrency(total)}</span>
                </div>

                {/* 明細テーブル */}
                <div className="flex-1">
                  {estimate.sections.map((section, si) => (
                    <div key={section.id} className={si > 0 ? "mt-4" : ""}>
                      <div className="bg-slate-700 text-white px-3 py-1 text-sm font-medium">{section.name}</div>
                      {section.groups.map((group) => (
                        <div key={group.id}>
                          <div className="bg-slate-100 px-3 py-0.5 text-xs font-medium text-slate-600 border-b border-slate-200">
                            {group.name}
                          </div>
                          <table className="w-full text-xs border-b border-slate-200">
                            <thead>
                              <tr className="bg-slate-50 text-slate-500">
                                <th className="text-left px-3 py-1 font-normal border-b border-slate-200">項目</th>
                                <th className="text-right px-2 py-1 font-normal w-14 border-b border-slate-200">数量</th>
                                <th className="text-center px-2 py-1 font-normal w-10 border-b border-slate-200">単位</th>
                                <th className="text-right px-2 py-1 font-normal w-20 border-b border-slate-200">単価</th>
                                <th className="text-right px-3 py-1 font-normal w-24 border-b border-slate-200">金額</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.items.map((item, idx) => {
                                const amount = item.quantity * item.unitPrice
                                return (
                                  <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                                    <td className="px-3 py-1">{item.name}</td>
                                    <td className="px-2 py-1 text-right font-mono">{item.quantity.toLocaleString()}</td>
                                    <td className="px-2 py-1 text-center">{item.unit.name}</td>
                                    <td className="px-2 py-1 text-right font-mono">{formatCurrency(item.unitPrice)}</td>
                                    <td className="px-3 py-1 text-right font-mono font-medium">{formatCurrency(amount)}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* 合計内訳 */}
                <div className="mt-4 flex justify-end">
                  <table className="text-sm border border-slate-200 w-64">
                    <tbody>
                      <tr className="border-b border-slate-100">
                        <td className="px-4 py-1.5 text-slate-500">小計（税抜）</td>
                        <td className="px-4 py-1.5 text-right font-mono">¥{formatCurrency(subtotal)}</td>
                      </tr>
                      {discount > 0 && (
                        <tr className="border-b border-slate-100">
                          <td className="px-4 py-1.5 text-slate-500">値引き</td>
                          <td className="px-4 py-1.5 text-right font-mono text-red-600">-¥{formatCurrency(discount)}</td>
                        </tr>
                      )}
                      <tr className="border-b border-slate-100">
                        <td className="px-4 py-1.5 text-slate-500">消費税（{Math.round(taxRate * 100)}%）</td>
                        <td className="px-4 py-1.5 text-right font-mono">¥{formatCurrency(tax)}</td>
                      </tr>
                      <tr className="bg-slate-800 text-white">
                        <td className="px-4 py-2 font-bold">合計（税込）</td>
                        <td className="px-4 py-2 text-right font-mono font-bold text-base">¥{formatCurrency(total)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {estimate.note && (
                  <div className="mt-5 border border-slate-200 rounded p-3">
                    <p className="text-xs font-medium text-slate-500 mb-1">特記事項</p>
                    <p className="text-xs whitespace-pre-wrap text-slate-700 leading-relaxed">{estimate.note}</p>
                  </div>
                )}

                <div className="mt-8 pt-3 border-t border-slate-200 text-center text-xs text-slate-400">
                  本見積書は有効期限内の再発行が可能です。ご不明な点はお気軽にご連絡ください。
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ━━ 印刷スタイル ━━ */}
      <style>{`
        @page {
          size: A4;
          margin: 0;
        }
        @media print {
          body { margin: 0; padding: 0; }
        }
      `}</style>
    </>
  )
}

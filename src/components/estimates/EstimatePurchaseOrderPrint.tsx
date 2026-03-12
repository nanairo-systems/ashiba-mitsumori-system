/**
 * [COMPONENT] 見積ベース発注書 印刷レイアウト - EstimatePurchaseOrderPrint
 *
 * 見積データに紐づく発注書をA4サイズで表示。
 * 工事内容（見積明細）・金額内訳・外注先情報・現場情報を記載。
 */
"use client"

import { useEffect } from "react"
import { formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Printer, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"

// ─── 型定義 ────────────────────────────────────────────

interface EstimateItem {
  name: string
  quantity: number
  unitPrice: number
  unit: string
}

interface EstimateGroup {
  name: string
  items: EstimateItem[]
}

interface EstimateSection {
  name: string
  groups: EstimateGroup[]
}

interface OrderData {
  id: string
  orderAmount: number
  taxRate: number
  note: string | null
  status: string
  orderedAt: string | null
  subcontractor: {
    name: string
    representative: string | null
    address: string | null
    phone: string | null
  }
  estimate: {
    estimateNumber: string | null
    revision: number
    title: string | null
    subtotal: number
    discountAmount: number
    taxableAmount: number
    taxAmount: number
    total: number
    note: string | null
    sections: EstimateSection[]
    project: {
      name: string
      address: string | null
    }
    company: {
      name: string
      phone: string | null
    }
    user: {
      name: string
    }
  }
}

interface Props {
  order: OrderData
}

// ─── メインコンポーネント ───────────────────────────────

export function EstimatePurchaseOrderPrint({ order }: Props) {
  const router = useRouter()
  const issueDate = order.orderedAt ? new Date(order.orderedAt) : new Date()

  const orderTaxAmount = Math.floor(order.orderAmount * order.taxRate / 100)
  const orderTotalAmount = order.orderAmount + orderTaxAmount

  useEffect(() => {
    const timer = setTimeout(() => window.print(), 600)
    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      {/* ツールバー（印刷時非表示） */}
      <div className="print:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 shadow-sm px-6 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (window.history.length > 1) router.back()
            else router.push("/estimates")
          }}
          className="text-slate-600"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          戻る
        </Button>
        <span className="text-sm text-slate-500 flex-1 truncate">発注書</span>
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

      {/* 印刷エリア */}
      <div className="pt-[60px] print:pt-0">
        <div
          className="relative mx-auto bg-white w-[210mm] min-h-[297mm] px-[15mm] py-[12mm] shadow-xl print:shadow-none print:w-full print:min-h-0"
          style={{ fontFamily: "'Noto Sans JP', sans-serif" }}
        >
          {/* タイトル */}
          <h1 className="text-center text-2xl font-bold tracking-widest mb-8">
            発 注 書
          </h1>

          {/* 外注先情報（左上） & 自社情報（右上） */}
          <div className="flex justify-between mb-8">
            <div className="w-[48%]">
              <p className="text-lg font-bold border-b-2 border-black pb-1 mb-2">
                {order.subcontractor.name}　御中
              </p>
              {order.subcontractor.address && (
                <p className="text-sm text-slate-600">{order.subcontractor.address}</p>
              )}
              {order.subcontractor.representative && (
                <p className="text-sm text-slate-600">代表者: {order.subcontractor.representative}</p>
              )}
              {order.subcontractor.phone && (
                <p className="text-sm text-slate-600">TEL: {order.subcontractor.phone}</p>
              )}
            </div>
            <div className="w-[40%] text-right">
              <p className="text-sm text-slate-500 mb-1">
                発行日: {format(issueDate, "yyyy年MM月dd日")}
              </p>
              {order.estimate.estimateNumber && (
                <p className="text-xs text-slate-400 mb-1">
                  見積番号: {order.estimate.estimateNumber}
                  {order.estimate.revision > 1 && ` 第${order.estimate.revision}版`}
                </p>
              )}
              <p className="text-base font-bold">{order.estimate.company.name}</p>
              {order.estimate.company.phone && (
                <p className="text-sm text-slate-600">TEL: {order.estimate.company.phone}</p>
              )}
              <p className="text-sm text-slate-600 mt-0.5">担当: {order.estimate.user.name}</p>
            </div>
          </div>

          {/* 下記の通り発注いたします */}
          <p className="text-sm text-center mb-4 text-slate-600">
            下記の通り発注いたします。
          </p>

          {/* 合計金額 */}
          <div className="border-2 border-black p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">発注金額（税込）</span>
              <span className="text-2xl font-bold font-mono">
                ¥{formatCurrency(orderTotalAmount)}
              </span>
            </div>
          </div>

          {/* 工事概要 */}
          <table className="w-full mb-6 text-sm border-collapse">
            <tbody>
              {order.estimate.title && (
                <tr className="border-b border-slate-200">
                  <td className="py-2 pr-4 font-medium text-slate-600 w-[100px]">件名</td>
                  <td className="py-2">{order.estimate.title}</td>
                </tr>
              )}
              <tr className="border-b border-slate-200">
                <td className="py-2 pr-4 font-medium text-slate-600 w-[100px]">現場名</td>
                <td className="py-2">{order.estimate.project.name}</td>
              </tr>
              {order.estimate.project.address && (
                <tr className="border-b border-slate-200">
                  <td className="py-2 pr-4 font-medium text-slate-600">現場住所</td>
                  <td className="py-2">{order.estimate.project.address}</td>
                </tr>
              )}
              <tr className="border-b border-slate-200">
                <td className="py-2 pr-4 font-medium text-slate-600">工期</td>
                <td className="py-2">別途協議</td>
              </tr>
            </tbody>
          </table>

          {/* 金額内訳 */}
          <div className="mb-6">
            <h2 className="text-sm font-bold border-b border-slate-300 pb-1 mb-3">金額内訳</h2>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="py-1.5 text-slate-600">見積金額（税抜）</td>
                  <td className="py-1.5 text-right font-mono">¥{formatCurrency(order.estimate.subtotal)}</td>
                </tr>
                {order.estimate.discountAmount > 0 && (
                  <tr className="border-b border-slate-100">
                    <td className="py-1.5 text-slate-600">値引き</td>
                    <td className="py-1.5 text-right font-mono text-red-600">-¥{formatCurrency(order.estimate.discountAmount)}</td>
                  </tr>
                )}
                <tr className="border-b border-slate-100">
                  <td className="py-1.5 text-slate-600">見積金額（税込）</td>
                  <td className="py-1.5 text-right font-mono">¥{formatCurrency(order.estimate.total)}</td>
                </tr>
                <tr className="border-b border-slate-200 h-2"><td colSpan={2}></td></tr>
                <tr className="border-b border-slate-100">
                  <td className="py-1.5 text-slate-600">発注金額（税抜）</td>
                  <td className="py-1.5 text-right font-mono">¥{formatCurrency(order.orderAmount)}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-1.5 text-slate-600">消費税（{order.taxRate}%）</td>
                  <td className="py-1.5 text-right font-mono">¥{formatCurrency(orderTaxAmount)}</td>
                </tr>
                <tr className="border-t-2 border-black">
                  <td className="py-2 font-bold">発注合計（税込）</td>
                  <td className="py-2 text-right font-mono font-bold text-lg">¥{formatCurrency(orderTotalAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 工事内容（見積明細） */}
          <div className="mb-6">
            <h2 className="text-sm font-bold border-b border-slate-300 pb-1 mb-3">工事内容</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="text-left py-1.5 text-xs font-medium text-slate-500 w-[45%]">品名</th>
                  <th className="text-right py-1.5 text-xs font-medium text-slate-500">数量</th>
                  <th className="text-center py-1.5 text-xs font-medium text-slate-500">単位</th>
                  <th className="text-right py-1.5 text-xs font-medium text-slate-500">単価</th>
                  <th className="text-right py-1.5 text-xs font-medium text-slate-500">金額</th>
                </tr>
              </thead>
              <tbody>
                {order.estimate.sections.map((sec, si) => (
                  <SectionRows key={si} section={sec} />
                ))}
              </tbody>
            </table>
          </div>

          {/* 備考 */}
          {(order.note || order.estimate.note) && (
            <div className="mb-6">
              <h2 className="text-sm font-bold border-b border-slate-300 pb-1 mb-2">備考</h2>
              {order.note && (
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{order.note}</p>
              )}
              {order.note && order.estimate.note && <div className="my-2 border-t border-slate-100" />}
              {order.estimate.note && (
                <p className="text-sm text-slate-500 whitespace-pre-wrap">{order.estimate.note}</p>
              )}
            </div>
          )}

          {/* フッター */}
          <div className="absolute bottom-[12mm] left-[15mm] right-[15mm] text-center text-xs text-slate-400">
            上記の通り発注いたします。
          </div>
        </div>
      </div>

      {/* 印刷スタイル */}
      <style>{`
        @page {
          size: A4;
          margin: 0;
        }
        @media print {
          body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  )
}

// ─── サブコンポーネント ────────────────────────────────

function SectionRows({ section }: { section: EstimateSection }) {
  return (
    <>
      <tr className="bg-slate-50">
        <td colSpan={5} className="py-1 px-2 text-xs font-semibold text-slate-600 border-b border-slate-100">
          {section.name}
        </td>
      </tr>
      {section.groups.map((group, gi) => (
        <GroupRows key={gi} group={group} />
      ))}
    </>
  )
}

function GroupRows({ group }: { group: EstimateGroup }) {
  return (
    <>
      <tr>
        <td colSpan={5} className="py-0.5 px-2 pl-4 text-xs text-slate-500 border-b border-slate-50">
          {group.name}
        </td>
      </tr>
      {group.items.map((item, ii) => {
        const amount = item.quantity * item.unitPrice
        return (
          <tr key={ii} className="border-b border-slate-50">
            <td className="py-1 px-2 pl-6 text-sm">{item.name}</td>
            <td className="py-1 px-2 text-right font-mono text-sm">{item.quantity}</td>
            <td className="py-1 px-2 text-center text-sm text-slate-500">{item.unit}</td>
            <td className="py-1 px-2 text-right font-mono text-sm">¥{formatCurrency(item.unitPrice)}</td>
            <td className="py-1 px-2 text-right font-mono text-sm font-medium">¥{formatCurrency(amount)}</td>
          </tr>
        )
      })}
    </>
  )
}

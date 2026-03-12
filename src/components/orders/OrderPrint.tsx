/**
 * [COMPONENT] 発注書印刷レイアウト - OrderPrint
 *
 * A4サイズの発注書。自社情報・外注先情報・現場名・工事内容・金額・工期を記載。
 */
"use client"

import { useEffect } from "react"
import { formatDate, formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Printer, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"

interface OrderItem {
  name: string; quantity: number; unitPrice: number; unit: string
}
interface OrderGroup {
  name: string; items: OrderItem[]
}
interface OrderSection {
  name: string; groups: OrderGroup[]
}

interface OrderData {
  id: string
  orderAmount: number
  orderTaxAmount: number
  orderTotalAmount: number
  orderStatus: string
  orderedAt: string | null
  note: string | null
  subcontractor: {
    name: string; representative: string | null
    address: string | null; phone: string | null
  } | null
  contract: {
    contractNumber: string | null
    project: { name: string; address: string | null }
    company: { name: string; phone: string | null }
    estimate: { sections: OrderSection[] }
  }
}

interface Props {
  order: OrderData
}

export function OrderPrint({ order }: Props) {
  const router = useRouter()
  const issueDate = order.orderedAt ? new Date(order.orderedAt) : new Date()

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
            else router.push("/contracts")
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
              {order.subcontractor && (
                <>
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
                </>
              )}
            </div>
            <div className="w-[40%] text-right">
              <p className="text-sm text-slate-500 mb-1">
                発行日: {format(issueDate, "yyyy年MM月dd日")}
              </p>
              {order.contract.contractNumber && (
                <p className="text-xs text-slate-400 mb-2">
                  契約番号: {order.contract.contractNumber}
                </p>
              )}
              <p className="text-base font-bold">{order.contract.company.name}</p>
              {order.contract.company.phone && (
                <p className="text-sm text-slate-600">TEL: {order.contract.company.phone}</p>
              )}
            </div>
          </div>

          {/* 合計金額 */}
          <div className="border-2 border-black p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">発注金額（税込）</span>
              <span className="text-2xl font-bold font-mono">
                ¥{formatCurrency(order.orderTotalAmount)}
              </span>
            </div>
          </div>

          {/* 工事概要 */}
          <table className="w-full mb-6 text-sm border-collapse">
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="py-2 pr-4 font-medium text-slate-600 w-[100px]">現場名</td>
                <td className="py-2">{order.contract.project.name}</td>
              </tr>
              {order.contract.project.address && (
                <tr className="border-b border-slate-200">
                  <td className="py-2 pr-4 font-medium text-slate-600">現場住所</td>
                  <td className="py-2">{order.contract.project.address}</td>
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
                  <td className="py-1.5 text-slate-600">発注金額（税抜）</td>
                  <td className="py-1.5 text-right font-mono">¥{formatCurrency(order.orderAmount)}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-1.5 text-slate-600">消費税</td>
                  <td className="py-1.5 text-right font-mono">¥{formatCurrency(order.orderTaxAmount)}</td>
                </tr>
                <tr className="border-t-2 border-black">
                  <td className="py-2 font-bold">合計（税込）</td>
                  <td className="py-2 text-right font-mono font-bold text-lg">¥{formatCurrency(order.orderTotalAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 工事内容（見積明細から引用） */}
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
                {order.contract.estimate.sections.map((sec, si) => (
                  <OrderSectionRows key={si} section={sec} />
                ))}
              </tbody>
            </table>
          </div>

          {/* 備考 */}
          {order.note && (
            <div className="mb-6">
              <h2 className="text-sm font-bold border-b border-slate-300 pb-1 mb-2">備考</h2>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{order.note}</p>
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

function OrderSectionRows({ section }: { section: OrderSection }) {
  return (
    <>
      <tr className="bg-slate-50">
        <td colSpan={5} className="py-1 px-2 text-xs font-semibold text-slate-600 border-b border-slate-100">
          {section.name}
        </td>
      </tr>
      {section.groups.map((group, gi) => (
        <OrderGroupRows key={gi} group={group} />
      ))}
    </>
  )
}

function OrderGroupRows({ group }: { group: OrderGroup }) {
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

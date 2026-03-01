/**
 * [COMPONENT] 一括請求書印刷 - InvoiceBulkPrint
 *
 * 複数の請求書をページ区切りで連続印刷する。
 */
"use client"

import { useEffect } from "react"
import { formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Printer, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import type { InvoiceType } from "@prisma/client"

interface InvoiceItem { name: string; quantity: number; unitPrice: number; unit: string }
interface InvoiceGroup { name: string; items: InvoiceItem[] }
interface InvoiceSection { name: string; groups: InvoiceGroup[] }

interface InvoiceData {
  id: string
  invoiceNumber: string | null
  invoiceType: InvoiceType
  amount: number
  taxAmount: number
  totalAmount: number
  invoiceDate: string
  dueDate: string | null
  notes: string | null
  contract: {
    contractNumber: string | null
    project: { name: string; address: string | null }
    company: { name: string; phone: string | null }
    contact: { name: string } | null
    estimate: { sections: InvoiceSection[] }
  }
}

const TYPE_LABEL: Record<InvoiceType, string> = {
  FULL: "一括請求", ASSEMBLY: "組立分請求", DISASSEMBLY: "解体分請求", PROGRESS: "出来高請求",
}

export function InvoiceBulkPrint({ invoices }: { invoices: InvoiceData[] }) {
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => window.print(), 800)
    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      <div className="print:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b shadow-sm px-6 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => { if (window.history.length > 1) router.back(); else router.push("/invoices") }} className="text-slate-600">
          <ArrowLeft className="w-4 h-4 mr-1" />戻る
        </Button>
        <span className="text-sm text-slate-500 flex-1 truncate">{invoices.length}件の請求書</span>
        <Button onClick={() => window.print()} className="gap-2"><Printer className="w-4 h-4" />{invoices.length}件を印刷する（PDF保存）</Button>
      </div>

      <div className="pt-[60px] print:pt-0">
        {invoices.map((invoice, idx) => (
          <div key={invoice.id} className={`relative mx-auto bg-white w-[210mm] min-h-[297mm] px-[15mm] py-[12mm] shadow-xl print:shadow-none print:w-full print:min-h-0 ${idx > 0 ? "mt-8 print:mt-0" : ""}`} style={{ fontFamily: "'Noto Sans JP', sans-serif", pageBreakBefore: idx > 0 ? "always" : "auto" }}>
            <h1 className="text-center text-2xl font-bold tracking-widest mb-8">請 求 書</h1>

            <div className="flex justify-between mb-8">
              <div className="w-[48%]">
                <p className="text-lg font-bold border-b-2 border-black pb-1 mb-2">{invoice.contract.company.name}　御中</p>
                {invoice.contract.contact && <p className="text-sm text-slate-600">{invoice.contract.contact.name} 様</p>}
              </div>
              <div className="w-[40%] text-right">
                <p className="text-sm text-slate-500 mb-1">請求日: {format(new Date(invoice.invoiceDate), "yyyy年MM月dd日")}</p>
                {invoice.invoiceNumber && <p className="text-xs text-slate-400 mb-1">請求番号: {invoice.invoiceNumber}</p>}
                {invoice.dueDate && <p className="text-xs text-slate-500 mb-2">お支払期限: {format(new Date(invoice.dueDate), "yyyy年MM月dd日")}</p>}
                <p className="text-xs text-slate-400">{TYPE_LABEL[invoice.invoiceType]}</p>
              </div>
            </div>

            <div className="border-2 border-black p-4 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">ご請求金額（税込）</span>
                <span className="text-2xl font-bold font-mono">¥{formatCurrency(invoice.totalAmount)}</span>
              </div>
            </div>

            <table className="w-full mb-4 text-sm">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="py-2 pr-4 font-medium text-slate-600 w-[80px]">現場名</td>
                  <td className="py-2">{invoice.contract.project.name}</td>
                </tr>
                {invoice.contract.project.address && (
                  <tr className="border-b border-slate-200">
                    <td className="py-2 pr-4 font-medium text-slate-600">住所</td>
                    <td className="py-2">{invoice.contract.project.address}</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="mb-6">
              <h2 className="text-sm font-bold border-b border-slate-300 pb-1 mb-3">金額内訳</h2>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-slate-100"><td className="py-1.5 text-slate-600">請求金額（税抜）</td><td className="py-1.5 text-right font-mono">¥{formatCurrency(invoice.amount)}</td></tr>
                  <tr className="border-b border-slate-100"><td className="py-1.5 text-slate-600">消費税</td><td className="py-1.5 text-right font-mono">¥{formatCurrency(invoice.taxAmount)}</td></tr>
                  <tr className="border-t-2 border-black"><td className="py-2 font-bold">合計（税込）</td><td className="py-2 text-right font-mono font-bold text-lg">¥{formatCurrency(invoice.totalAmount)}</td></tr>
                </tbody>
              </table>
            </div>

            <div className="mb-6">
              <h2 className="text-sm font-bold border-b border-slate-300 pb-1 mb-3">請求明細</h2>
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
                  {invoice.contract.estimate.sections.map((sec, si) => (
                    <SectionRows key={si} section={sec} />
                  ))}
                </tbody>
              </table>
            </div>

            {invoice.notes && (
              <div className="mb-6">
                <h2 className="text-sm font-bold border-b border-slate-300 pb-1 mb-2">備考</h2>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}

            <div className="absolute bottom-[12mm] left-[15mm] right-[15mm] text-center text-xs text-slate-400">
              上記の通りご請求申し上げます。
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @page { size: A4; margin: 0; }
        @media print { body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      `}</style>
    </>
  )
}

function SectionRows({ section }: { section: InvoiceSection }) {
  return (
    <>
      <tr className="bg-slate-50"><td colSpan={5} className="py-1 px-2 text-xs font-semibold text-slate-600 border-b border-slate-100">{section.name}</td></tr>
      {section.groups.map((g, gi) => (
        <GroupRows key={gi} group={g} />
      ))}
    </>
  )
}

function GroupRows({ group }: { group: InvoiceGroup }) {
  return (
    <>
      <tr><td colSpan={5} className="py-0.5 px-2 pl-4 text-xs text-slate-500 border-b border-slate-50">{group.name}</td></tr>
      {group.items.map((item, ii) => (
        <tr key={ii} className="border-b border-slate-50">
          <td className="py-1 px-2 pl-6 text-sm">{item.name}</td>
          <td className="py-1 px-2 text-right font-mono text-sm">{item.quantity}</td>
          <td className="py-1 px-2 text-center text-sm text-slate-500">{item.unit}</td>
          <td className="py-1 px-2 text-right font-mono text-sm">¥{formatCurrency(item.unitPrice)}</td>
          <td className="py-1 px-2 text-right font-mono text-sm font-medium">¥{formatCurrency(item.quantity * item.unitPrice)}</td>
        </tr>
      ))}
    </>
  )
}

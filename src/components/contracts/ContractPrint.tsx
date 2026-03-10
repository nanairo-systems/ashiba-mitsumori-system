/**
 * [COMPONENT] 統合契約書 印刷レイアウト - ContractPrint
 *
 * 複数見積を統合した契約の書類を印刷用A4レイアウトで表示。
 * 各見積の明細を内訳として表示し、合計金額を表示する。
 */
"use client"

import { useEffect } from "react"
import { formatDate, formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Printer, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

// ─── 型定義 ────────────────────────────────────────────

interface EstimateItem {
  id: string; name: string; quantity: number; unitPrice: number
  unit: { name: string }
}

interface EstimateGroup {
  id: string; name: string; items: EstimateItem[]
}

interface EstimateSection {
  id: string; name: string; groups: EstimateGroup[]
}

interface EstimateData {
  id: string
  estimateNumber: string | null
  title: string | null
  sections: EstimateSection[]
  discountAmount: number | null
  subtotal: number
  taxAmount: number
  total: number
}

interface ContractPrintData {
  id: string
  contractNumber: string | null
  name: string | null
  status: string
  contractAmount: number
  taxAmount: number
  totalAmount: number
  contractDate: string
  startDate: string | null
  endDate: string | null
  paymentTerms: string | null
  note: string | null
  project: {
    name: string
    address: string | null
    branch: {
      name: string
      company: { name: string; phone: string | null }
    }
    contact: { name: string } | null
  }
  estimates: EstimateData[]
}

interface Props {
  contract: ContractPrintData
  autoPrint?: boolean
}

// ─── メインコンポーネント ───────────────────────────────

export function ContractPrint({ contract, autoPrint }: Props) {
  const router = useRouter()

  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => window.print(), 600)
      return () => clearTimeout(timer)
    }
  }, [autoPrint])

  // 全見積の合計
  const grandSubtotal = contract.estimates.reduce((s, e) => s + e.subtotal, 0)
  const grandDiscount = contract.estimates.reduce((s, e) => s + (e.discountAmount ?? 0), 0)
  const grandTax = contract.estimates.reduce((s, e) => s + e.taxAmount, 0)
  const grandTotal = contract.estimates.reduce((s, e) => s + e.total, 0)

  return (
    <>
      {/* ─── 固定ツールバー（印刷時非表示）── */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b px-4 py-2 flex items-center gap-3 print:hidden">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1 text-xs">
          <ArrowLeft className="w-3.5 h-3.5" />戻る
        </Button>
        <div className="flex-1">
          <span className="text-sm font-semibold text-slate-700">契約書</span>
          <span className="text-xs text-slate-400 ml-2">{contract.contractNumber}</span>
        </div>
        <Button size="sm" onClick={() => window.print()} className="gap-1 text-xs">
          <Printer className="w-3.5 h-3.5" />印刷する（PDF保存）
        </Button>
      </div>

      {/* ─── A4 印刷エリア ── */}
      <div className="mt-14 print:mt-0 flex justify-center print:block">
        <div className="w-[210mm] min-h-[297mm] bg-white px-[15mm] py-[12mm] shadow-lg print:shadow-none print:w-full print:min-h-0 print:px-[15mm] print:py-[10mm]">

          {/* ── ヘッダー ── */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold tracking-wider">契 約 書</h1>
            <p className="text-xs text-slate-500 mt-1">Contract Document</p>
          </div>

          {/* ── 契約番号・日付 ── */}
          <div className="flex justify-between items-end mb-6">
            <div>
              <p className="text-xs text-slate-500">契約番号</p>
              <p className="text-sm font-mono font-semibold">{contract.contractNumber ?? "—"}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">契約日</p>
              <p className="text-sm">{formatDate(contract.contractDate, "yyyy年MM月dd日")}</p>
            </div>
          </div>

          {/* ── 宛先・会社情報 ── */}
          <div className="grid grid-cols-2 gap-8 mb-6">
            {/* 左: 宛先（お客様） */}
            <div>
              <div className="border-b-2 border-slate-800 pb-1 mb-2">
                <p className="text-base font-bold">
                  {contract.project.branch.name}
                  {contract.project.contact ? ` ${contract.project.contact.name}` : ""} 様
                </p>
              </div>
              <div className="text-xs text-slate-600 space-y-0.5">
                <p>現場名: {contract.project.name}</p>
                {contract.project.address && <p>現場住所: {contract.project.address}</p>}
              </div>
            </div>

            {/* 右: 自社情報 */}
            <div className="text-right">
              <p className="text-sm font-bold">{contract.project.branch.company.name}</p>
              {contract.project.branch.company.phone && (
                <p className="text-xs text-slate-500">TEL: {contract.project.branch.company.phone}</p>
              )}
            </div>
          </div>

          {/* ── 契約概要 ── */}
          <div className="border border-slate-300 rounded mb-6">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-300">
              <p className="text-sm font-semibold">契約概要</p>
            </div>
            <div className="px-4 py-3 space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500 text-xs">契約名称</span>
                  <p className="font-medium">{contract.name || contract.project.name}</p>
                </div>
                <div>
                  <span className="text-slate-500 text-xs">工期</span>
                  <p>
                    {contract.startDate ? formatDate(contract.startDate, "yyyy年MM月dd日") : "未定"}
                    {" 〜 "}
                    {contract.endDate ? formatDate(contract.endDate, "yyyy年MM月dd日") : "未定"}
                  </p>
                </div>
              </div>
              <div className="border-t border-slate-200 pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">契約金額（税込）</span>
                  <span className="text-xl font-bold">¥{formatCurrency(contract.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500 mt-0.5">
                  <span>税抜: ¥{formatCurrency(contract.contractAmount)}</span>
                  <span>消費税: ¥{formatCurrency(contract.taxAmount)}</span>
                </div>
              </div>
              {contract.paymentTerms && (
                <div className="border-t border-slate-200 pt-2">
                  <span className="text-xs text-slate-500">支払条件</span>
                  <p className="text-sm">{contract.paymentTerms}</p>
                </div>
              )}
            </div>
          </div>

          {/* ── 内訳（見積別）── */}
          {contract.estimates.map((est, estIdx) => (
            <div key={est.id} className="mb-4 break-inside-avoid">
              <div className="bg-slate-700 text-white px-3 py-1.5 rounded-t flex justify-between items-center">
                <span className="text-xs font-semibold">
                  {estIdx === 0 ? "【本工事】" : `【追加工事${estIdx}】`}
                  {est.title || est.estimateNumber || ""}
                </span>
                <span className="text-[10px] opacity-80">{est.estimateNumber}</span>
              </div>

              <table className="w-full border border-slate-300 border-t-0 text-xs">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border-b border-r border-slate-300 px-2 py-1 text-left w-[40%]">項目名</th>
                    <th className="border-b border-r border-slate-300 px-2 py-1 text-center w-[10%]">数量</th>
                    <th className="border-b border-r border-slate-300 px-2 py-1 text-center w-[8%]">単位</th>
                    <th className="border-b border-r border-slate-300 px-2 py-1 text-right w-[18%]">単価</th>
                    <th className="border-b border-slate-300 px-2 py-1 text-right w-[24%]">金額</th>
                  </tr>
                </thead>
                <tbody>
                  {est.sections.map((sec) => (
                    sec.groups.map((grp) => {
                      // グループヘッダー
                      const rows = []
                      if (grp.name) {
                        rows.push(
                          <tr key={`gh-${grp.id}`} className="bg-slate-50">
                            <td colSpan={5} className="border-b border-slate-200 px-2 py-1 font-semibold text-slate-700">
                              {sec.name && sec.name !== grp.name ? `${sec.name} / ` : ""}{grp.name}
                            </td>
                          </tr>
                        )
                      }
                      // 明細行
                      for (const item of grp.items) {
                        const amount = item.quantity * item.unitPrice
                        rows.push(
                          <tr key={item.id}>
                            <td className="border-b border-r border-slate-200 px-2 py-1 pl-4">{item.name}</td>
                            <td className="border-b border-r border-slate-200 px-2 py-1 text-center">{item.quantity}</td>
                            <td className="border-b border-r border-slate-200 px-2 py-1 text-center">{item.unit.name}</td>
                            <td className="border-b border-r border-slate-200 px-2 py-1 text-right font-mono">¥{formatCurrency(item.unitPrice)}</td>
                            <td className="border-b border-slate-200 px-2 py-1 text-right font-mono">¥{formatCurrency(amount)}</td>
                          </tr>
                        )
                      }
                      return rows
                    })
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-semibold">
                    <td colSpan={4} className="border-t border-r border-slate-300 px-2 py-1 text-right">小計</td>
                    <td className="border-t border-slate-300 px-2 py-1 text-right font-mono">¥{formatCurrency(est.subtotal)}</td>
                  </tr>
                  {est.discountAmount != null && est.discountAmount > 0 && (
                    <tr className="text-red-600">
                      <td colSpan={4} className="border-t border-r border-slate-200 px-2 py-1 text-right">値引</td>
                      <td className="border-t border-slate-200 px-2 py-1 text-right font-mono">-¥{formatCurrency(est.discountAmount)}</td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={4} className="border-t border-r border-slate-200 px-2 py-1 text-right">消費税</td>
                    <td className="border-t border-slate-200 px-2 py-1 text-right font-mono">¥{formatCurrency(est.taxAmount)}</td>
                  </tr>
                  <tr className="bg-slate-100 font-bold">
                    <td colSpan={4} className="border-t border-r border-slate-300 px-2 py-1.5 text-right">合計（税込）</td>
                    <td className="border-t border-slate-300 px-2 py-1.5 text-right font-mono">¥{formatCurrency(est.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))}

          {/* ── 総合計（複数見積の場合）── */}
          {contract.estimates.length > 1 && (
            <div className="border-2 border-slate-800 rounded p-3 mt-4 mb-6">
              <table className="w-full text-sm">
                <tbody>
                  <tr>
                    <td className="py-0.5 text-slate-600">見積小計（税抜）</td>
                    <td className="py-0.5 text-right font-mono">¥{formatCurrency(grandSubtotal)}</td>
                  </tr>
                  {grandDiscount > 0 && (
                    <tr className="text-red-600">
                      <td className="py-0.5">値引合計</td>
                      <td className="py-0.5 text-right font-mono">-¥{formatCurrency(grandDiscount)}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="py-0.5 text-slate-600">消費税合計</td>
                    <td className="py-0.5 text-right font-mono">¥{formatCurrency(grandTax)}</td>
                  </tr>
                  <tr className="border-t-2 border-slate-800">
                    <td className="py-1.5 font-bold text-base">ご契約金額（税込）</td>
                    <td className="py-1.5 text-right font-mono font-bold text-lg">¥{formatCurrency(grandTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* ── 備考 ── */}
          {contract.note && (
            <div className="border border-slate-300 rounded p-3 mt-4">
              <p className="text-xs text-slate-500 mb-1">備考</p>
              <p className="text-sm whitespace-pre-wrap">{contract.note}</p>
            </div>
          )}

          {/* ── フッター ── */}
          <div className="mt-8 pt-4 border-t border-slate-300 flex justify-between text-xs text-slate-400">
            <span>本書は{contract.project.branch.company.name}が発行した契約書類です</span>
            <span>{formatDate(new Date().toISOString(), "yyyy年MM月dd日")} 発行</span>
          </div>
        </div>
      </div>

      {/* ── 印刷用CSS ── */}
      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  )
}

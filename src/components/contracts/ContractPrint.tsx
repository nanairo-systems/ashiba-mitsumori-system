/**
 * [COMPONENT] 統合契約書 印刷レイアウト - ContractPrint
 *
 * プロフェッショナルなA4契約書類。
 * 1ページ目: 契約概要（宛先・金額・工期・支払条件）
 * 2ページ目〜: 工事内訳明細（見積別）
 * 最終: 総合計・備考・署名欄
 */
"use client"

import { useEffect } from "react"
import { formatDate, formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Printer, ArrowLeft, Download } from "lucide-react"
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

  const grandSubtotal = contract.estimates.reduce((s, e) => s + e.subtotal, 0)
  const grandDiscount = contract.estimates.reduce((s, e) => s + (e.discountAmount ?? 0), 0)
  const grandTax = contract.estimates.reduce((s, e) => s + e.taxAmount, 0)
  const grandTotal = contract.estimates.reduce((s, e) => s + e.total, 0)
  const totalPages = contract.estimates.length + 1 // 表紙 + 見積ごと

  return (
    <>
      {/* ─── ツールバー（印刷時非表示）── */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-[#1e293b] text-white px-6 py-3 flex items-center gap-4 print:hidden shadow-lg">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1.5 text-white/80 hover:text-white hover:bg-white/10">
          <ArrowLeft className="w-4 h-4" />戻る
        </Button>
        <div className="flex-1 flex items-center gap-3">
          <span className="text-sm font-bold tracking-wide">工事請負契約書</span>
          <span className="text-xs text-white/50 font-mono">{contract.contractNumber}</span>
        </div>
        <Button size="sm" onClick={() => window.print()} className="gap-1.5 bg-white text-slate-800 hover:bg-slate-100 font-medium">
          <Printer className="w-4 h-4" />印刷 / PDF保存
        </Button>
      </div>

      <div className="mt-16 print:mt-0 flex flex-col items-center print:block contract-print-root">

        {/* ================================================================
           1ページ目: 契約書 表紙
        ================================================================ */}
        <div className="page-container">
          {/* ヘッダーライン */}
          <div className="h-1.5 bg-[#1a365d] w-full" />

          <div className="px-[20mm] pt-8 pb-6">
            {/* タイトル */}
            <div className="text-center mb-10">
              <h1 className="text-[28px] font-bold tracking-[0.3em] text-[#1a365d]" style={{ fontFamily: "'Yu Mincho', 'Hiragino Mincho ProN', serif" }}>
                工事請負契約書
              </h1>
              <div className="w-24 h-[2px] bg-[#1a365d] mx-auto mt-3" />
            </div>

            {/* 金額ボックス */}
            <div className="border-2 border-[#1a365d] mx-auto max-w-[400px] mb-10">
              <div className="bg-[#1a365d] text-white text-center py-1.5">
                <span className="text-xs tracking-widest">ご 契 約 金 額</span>
              </div>
              <div className="text-center py-4">
                <span className="text-[26px] font-bold tracking-wide" style={{ fontFamily: "'Yu Mincho', 'Hiragino Mincho ProN', serif" }}>
                  ¥{formatCurrency(contract.totalAmount)}
                </span>
                <span className="text-sm text-slate-500 ml-1">（税込）</span>
              </div>
              <div className="flex justify-center gap-8 pb-3 text-xs text-slate-500">
                <span>税抜 ¥{formatCurrency(contract.contractAmount)}</span>
                <span>消費税 ¥{formatCurrency(contract.taxAmount)}</span>
              </div>
            </div>

            {/* 契約詳細テーブル */}
            <table className="w-full mb-8 text-sm" style={{ fontFamily: "'Yu Mincho', 'Hiragino Mincho ProN', serif" }}>
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="py-3 pl-4 w-[140px] text-slate-500 bg-slate-50 font-medium">工 事 名 称</td>
                  <td className="py-3 pl-6 font-medium">{contract.name || contract.project.name}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-3 pl-4 text-slate-500 bg-slate-50 font-medium">工 事 場 所</td>
                  <td className="py-3 pl-6">{contract.project.address || "—"}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-3 pl-4 text-slate-500 bg-slate-50 font-medium">工　　　期</td>
                  <td className="py-3 pl-6">
                    {contract.startDate ? formatDate(contract.startDate, "yyyy年MM月dd日") : "未定"}
                    {"　〜　"}
                    {contract.endDate ? formatDate(contract.endDate, "yyyy年MM月dd日") : "未定"}
                  </td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-3 pl-4 text-slate-500 bg-slate-50 font-medium">支 払 条 件</td>
                  <td className="py-3 pl-6">{contract.paymentTerms || "別途協議"}</td>
                </tr>
                <tr className="border-b border-slate-200">
                  <td className="py-3 pl-4 text-slate-500 bg-slate-50 font-medium">契 約 番 号</td>
                  <td className="py-3 pl-6 font-mono">{contract.contractNumber || "—"}</td>
                </tr>
                <tr>
                  <td className="py-3 pl-4 text-slate-500 bg-slate-50 font-medium">契　約　日</td>
                  <td className="py-3 pl-6">{formatDate(contract.contractDate, "yyyy年MM月dd日")}</td>
                </tr>
              </tbody>
            </table>

            {/* 合意文 */}
            <div className="text-sm leading-7 text-slate-700 mb-10 px-2" style={{ fontFamily: "'Yu Mincho', 'Hiragino Mincho ProN', serif" }}>
              <p>
                上記工事について、発注者（甲）と受注者（乙）は、各々対等な立場における合意に基づいて、
                別添の工事内訳明細書のとおり工事請負契約を締結し、信義に従って誠実にこれを履行するものとする。
              </p>
              <p className="mt-2">
                本契約の証として本書を作成し、甲乙記名押印のうえ、各自一通を保有する。
              </p>
            </div>

            {/* 署名欄 */}
            <div className="grid grid-cols-2 gap-10 mt-6 px-2">
              {/* 発注者（甲） */}
              <div>
                <p className="text-xs text-slate-500 mb-3 tracking-widest">発注者（甲）</p>
                <div className="space-y-4">
                  <div className="border-b border-slate-300 pb-2">
                    <p className="text-[10px] text-slate-400 mb-0.5">住所</p>
                    <p className="text-sm min-h-[1.2em]">&nbsp;</p>
                  </div>
                  <div className="border-b border-slate-300 pb-2">
                    <p className="text-[10px] text-slate-400 mb-0.5">氏名 / 名称</p>
                    <div className="flex items-end justify-between">
                      <p className="text-sm font-medium">
                        {contract.project.branch.name}
                        {contract.project.contact ? ` ${contract.project.contact.name}` : ""}
                      </p>
                      <span className="text-[10px] text-slate-400 ml-4">㊞</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 受注者（乙） */}
              <div>
                <p className="text-xs text-slate-500 mb-3 tracking-widest">受注者（乙）</p>
                <div className="space-y-4">
                  <div className="border-b border-slate-300 pb-2">
                    <p className="text-[10px] text-slate-400 mb-0.5">住所</p>
                    <p className="text-sm min-h-[1.2em]">&nbsp;</p>
                  </div>
                  <div className="border-b border-slate-300 pb-2">
                    <p className="text-[10px] text-slate-400 mb-0.5">氏名 / 名称</p>
                    <div className="flex items-end justify-between">
                      <p className="text-sm font-medium">{contract.project.branch.company.name}</p>
                      <span className="text-[10px] text-slate-400 ml-4">㊞</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ページフッター */}
          <div className="mt-auto px-[20mm] pb-4 flex justify-between items-end text-[9px] text-slate-400">
            <span>{contract.contractNumber}</span>
            <span>1 / {totalPages}</span>
          </div>
          <div className="h-1 bg-[#1a365d] w-full" />
        </div>

        {/* ================================================================
           2ページ目〜: 工事内訳明細書
        ================================================================ */}
        {contract.estimates.map((est, estIdx) => (
          <div key={est.id} className="page-container">
            <div className="h-1.5 bg-[#1a365d] w-full" />

            <div className="px-[20mm] pt-6 pb-4 flex-1">
              {/* ページヘッダー */}
              <div className="flex items-end justify-between mb-5 pb-2 border-b-2 border-[#1a365d]">
                <div>
                  <p className="text-[10px] text-slate-400 tracking-widest mb-0.5">工事内訳明細書</p>
                  <h2 className="text-base font-bold text-[#1a365d]" style={{ fontFamily: "'Yu Mincho', 'Hiragino Mincho ProN', serif" }}>
                    {estIdx === 0 ? "本工事" : `追加工事 ${estIdx}`}
                    {"　"}
                    <span className="font-normal text-sm text-slate-700">{est.title || est.estimateNumber || ""}</span>
                  </h2>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">{est.estimateNumber}</span>
              </div>

              {/* 明細テーブル */}
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr>
                    <th className="bg-[#1a365d] text-white py-2 px-3 text-left font-medium w-[42%]">項　目</th>
                    <th className="bg-[#1a365d] text-white py-2 px-2 text-center font-medium w-[10%]">数量</th>
                    <th className="bg-[#1a365d] text-white py-2 px-2 text-center font-medium w-[8%]">単位</th>
                    <th className="bg-[#1a365d] text-white py-2 px-2 text-right font-medium w-[17%]">単　価</th>
                    <th className="bg-[#1a365d] text-white py-2 px-3 text-right font-medium w-[23%]">金　額</th>
                  </tr>
                </thead>
                <tbody>
                  {est.sections.map((sec) =>
                    sec.groups.map((grp) => {
                      const rows = []
                      // グループヘッダー
                      if (grp.name) {
                        rows.push(
                          <tr key={`gh-${grp.id}`}>
                            <td colSpan={5} className="bg-[#f0f4f8] py-1.5 px-3 font-bold text-[#1a365d] border-b border-[#d1d9e6]">
                              {sec.name && sec.name !== grp.name ? (
                                <>
                                  <span className="text-slate-400 font-normal">{sec.name}</span>
                                  <span className="text-slate-300 mx-1.5">/</span>
                                </>
                              ) : null}
                              {grp.name}
                            </td>
                          </tr>
                        )
                      }
                      // 明細行
                      grp.items.forEach((item, itemIdx) => {
                        const amount = item.quantity * item.unitPrice
                        const isEven = itemIdx % 2 === 0
                        rows.push(
                          <tr key={item.id} className={isEven ? "" : "bg-[#f9fafb]"}>
                            <td className="py-1.5 px-3 pl-5 border-b border-slate-100">{item.name}</td>
                            <td className="py-1.5 px-2 text-center border-b border-slate-100 font-mono text-slate-600">{item.quantity.toLocaleString()}</td>
                            <td className="py-1.5 px-2 text-center border-b border-slate-100 text-slate-500">{item.unit.name}</td>
                            <td className="py-1.5 px-2 text-right border-b border-slate-100 font-mono text-slate-600">¥{formatCurrency(item.unitPrice)}</td>
                            <td className="py-1.5 px-3 text-right border-b border-slate-100 font-mono font-medium">¥{formatCurrency(amount)}</td>
                          </tr>
                        )
                      })
                      return rows
                    })
                  )}
                </tbody>
              </table>

              {/* 小計・税・合計 */}
              <div className="mt-3 flex justify-end">
                <div className="w-[280px]">
                  <div className="flex justify-between py-1.5 px-3 text-[11px] border-b border-slate-200">
                    <span className="text-slate-500">小　計</span>
                    <span className="font-mono font-medium">¥{formatCurrency(est.subtotal)}</span>
                  </div>
                  {est.discountAmount != null && est.discountAmount > 0 && (
                    <div className="flex justify-between py-1.5 px-3 text-[11px] border-b border-slate-200 text-red-600">
                      <span>値　引</span>
                      <span className="font-mono">-¥{formatCurrency(est.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1.5 px-3 text-[11px] border-b border-slate-200">
                    <span className="text-slate-500">消費税</span>
                    <span className="font-mono">¥{formatCurrency(est.taxAmount)}</span>
                  </div>
                  <div className="flex justify-between py-2 px-3 text-sm bg-[#1a365d] text-white font-bold">
                    <span>合計（税込）</span>
                    <span className="font-mono">¥{formatCurrency(est.total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ページフッター */}
            <div className="px-[20mm] pb-4 flex justify-between items-end text-[9px] text-slate-400">
              <span>{contract.contractNumber}　—　{est.title || est.estimateNumber}</span>
              <span>{estIdx + 2} / {totalPages}</span>
            </div>
            <div className="h-1 bg-[#1a365d] w-full" />
          </div>
        ))}

        {/* ================================================================
           総合計ページ（複数見積の場合、最終見積ページの後に追加）
        ================================================================ */}
        {contract.estimates.length > 1 && (
          <div className="page-container">
            <div className="h-1.5 bg-[#1a365d] w-full" />
            <div className="px-[20mm] pt-6 pb-4 flex-1">
              <div className="flex items-end justify-between mb-5 pb-2 border-b-2 border-[#1a365d]">
                <div>
                  <p className="text-[10px] text-slate-400 tracking-widest mb-0.5">工事内訳明細書</p>
                  <h2 className="text-base font-bold text-[#1a365d]" style={{ fontFamily: "'Yu Mincho', 'Hiragino Mincho ProN', serif" }}>
                    総　括
                  </h2>
                </div>
              </div>

              {/* 工事別サマリーテーブル */}
              <table className="w-full text-[11px] border-collapse mb-6">
                <thead>
                  <tr>
                    <th className="bg-[#1a365d] text-white py-2 px-3 text-left font-medium w-[8%]">No.</th>
                    <th className="bg-[#1a365d] text-white py-2 px-3 text-left font-medium w-[47%]">工事名称</th>
                    <th className="bg-[#1a365d] text-white py-2 px-3 text-right font-medium w-[20%]">税抜金額</th>
                    <th className="bg-[#1a365d] text-white py-2 px-3 text-right font-medium w-[25%]">税込金額</th>
                  </tr>
                </thead>
                <tbody>
                  {contract.estimates.map((est, i) => (
                    <tr key={est.id} className={i % 2 === 0 ? "" : "bg-[#f9fafb]"}>
                      <td className="py-2.5 px-3 border-b border-slate-200 text-center font-mono text-slate-500">{i + 1}</td>
                      <td className="py-2.5 px-3 border-b border-slate-200 font-medium">
                        <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded mr-2 ${i === 0 ? "bg-[#dbeafe] text-[#1a365d]" : "bg-amber-50 text-amber-700"}`}>
                          {i === 0 ? "本工事" : `追加${i}`}
                        </span>
                        {est.title || est.estimateNumber}
                      </td>
                      <td className="py-2.5 px-3 border-b border-slate-200 text-right font-mono">¥{formatCurrency(est.subtotal - (est.discountAmount ?? 0))}</td>
                      <td className="py-2.5 px-3 border-b border-slate-200 text-right font-mono font-medium">¥{formatCurrency(est.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* 総合計ボックス */}
              <div className="border-2 border-[#1a365d] max-w-[360px] ml-auto">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="py-2 px-4 text-slate-500 bg-slate-50 w-[45%]">小計（税抜）</td>
                      <td className="py-2 px-4 text-right font-mono">¥{formatCurrency(grandSubtotal - grandDiscount)}</td>
                    </tr>
                    {grandDiscount > 0 && (
                      <tr className="border-b border-slate-200 text-red-600">
                        <td className="py-2 px-4 bg-slate-50">値引合計</td>
                        <td className="py-2 px-4 text-right font-mono">-¥{formatCurrency(grandDiscount)}</td>
                      </tr>
                    )}
                    <tr className="border-b border-slate-200">
                      <td className="py-2 px-4 text-slate-500 bg-slate-50">消費税</td>
                      <td className="py-2 px-4 text-right font-mono">¥{formatCurrency(grandTax)}</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 bg-[#1a365d] text-white font-bold">ご契約金額（税込）</td>
                      <td className="py-3 px-4 bg-[#1a365d] text-white text-right font-mono font-bold text-lg">¥{formatCurrency(grandTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 備考 */}
              {contract.note && (
                <div className="mt-8 border-t border-slate-200 pt-4">
                  <p className="text-[10px] text-slate-400 tracking-widest mb-1.5">備　考</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-6" style={{ fontFamily: "'Yu Mincho', 'Hiragino Mincho ProN', serif" }}>
                    {contract.note}
                  </p>
                </div>
              )}
            </div>

            <div className="px-[20mm] pb-4 flex justify-between items-end text-[9px] text-slate-400">
              <span>{contract.contractNumber}　—　総括</span>
              <span>{totalPages + 1} / {totalPages + 1}</span>
            </div>
            <div className="h-1 bg-[#1a365d] w-full" />
          </div>
        )}
      </div>

      {/* ─── 印刷用CSS ── */}
      <style jsx global>{`
        .contract-print-root .page-container {
          width: 210mm;
          min-height: 297mm;
          background: white;
          display: flex;
          flex-direction: column;
          box-shadow: 0 4px 24px rgba(0,0,0,0.12);
          margin-bottom: 24px;
        }

        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            margin: 0;
          }
          .contract-print-root .page-container {
            box-shadow: none;
            margin-bottom: 0;
            page-break-after: always;
            min-height: 0;
          }
          .contract-print-root .page-container:last-child {
            page-break-after: auto;
          }
        }
      `}</style>
    </>
  )
}

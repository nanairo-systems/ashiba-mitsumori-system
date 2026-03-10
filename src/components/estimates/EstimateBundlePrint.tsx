/**
 * [COMPONENT] 見積セット 印刷レイアウト - EstimateBundlePrint
 *
 * 複数見積をまとめた提出書類。
 * 1ページ目: 表紙（御見積書 — 一覧+合計）
 * 2ページ目〜: 各見積の明細
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
  userName: string
  sections: EstimateSection[]
  discountAmount: number | null
  subtotal: number
  taxAmount: number
  total: number
}

interface BundlePrintData {
  id: string
  bundleNumber: string | null
  title: string | null
  note: string | null
  createdAt: string
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
  bundle: BundlePrintData
  taxRate: number
  autoPrint?: boolean
}

// ─── メインコンポーネント ───────────────────────────────

export function EstimateBundlePrint({ bundle, taxRate, autoPrint }: Props) {
  const router = useRouter()

  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => window.print(), 600)
      return () => clearTimeout(timer)
    }
  }, [autoPrint])

  const grandSubtotal = bundle.estimates.reduce((s, e) => s + e.subtotal, 0)
  const grandDiscount = bundle.estimates.reduce((s, e) => s + (e.discountAmount ?? 0), 0)
  const grandTax = bundle.estimates.reduce((s, e) => s + e.taxAmount, 0)
  const grandTotal = bundle.estimates.reduce((s, e) => s + e.total, 0)
  const totalPages = bundle.estimates.length + 1

  return (
    <>
      {/* ─── ツールバー ── */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-[#1a365d] text-white px-6 py-3 flex items-center gap-4 print:hidden shadow-lg">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1.5 text-white/80 hover:text-white hover:bg-white/10">
          <ArrowLeft className="w-4 h-4" />戻る
        </Button>
        <div className="flex-1 flex items-center gap-3">
          <span className="text-sm font-bold tracking-wide">御見積書（セット）</span>
          <span className="text-xs text-white/50 font-mono">{bundle.bundleNumber}</span>
        </div>
        <Button size="sm" onClick={() => window.print()} className="gap-1.5 bg-white text-slate-800 hover:bg-slate-100 font-medium">
          <Printer className="w-4 h-4" />印刷 / PDF保存
        </Button>
      </div>

      <div className="mt-16 print:mt-0 flex flex-col items-center print:block bundle-print-root">

        {/* ================================================================
           1ページ目: 表紙
        ================================================================ */}
        <div className="page-container">
          <div className="h-1.5 bg-[#1a365d] w-full" />

          <div className="px-[20mm] pt-8 pb-6 flex-1">
            {/* タイトル */}
            <div className="text-center mb-8">
              <h1 className="text-[28px] font-bold tracking-[0.3em] text-[#1a365d]" style={{ fontFamily: "'Yu Mincho', 'Hiragino Mincho ProN', serif" }}>
                御 見 積 書
              </h1>
              <div className="w-24 h-[2px] bg-[#1a365d] mx-auto mt-3" />
            </div>

            {/* 宛先・自社 */}
            <div className="grid grid-cols-2 gap-10 mb-8">
              <div>
                <div className="border-b-2 border-[#1a365d] pb-1.5 mb-3">
                  <p className="text-lg font-bold" style={{ fontFamily: "'Yu Mincho', 'Hiragino Mincho ProN', serif" }}>
                    {bundle.project.branch.name}
                    {bundle.project.contact ? ` ${bundle.project.contact.name}` : ""} 様
                  </p>
                </div>
                <div className="text-xs text-slate-600 space-y-1 leading-5">
                  <p>現場名称：{bundle.project.name}</p>
                  {bundle.project.address && <p>現場住所：{bundle.project.address}</p>}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold mb-1">{bundle.project.branch.company.name}</p>
                {bundle.project.branch.company.phone && (
                  <p className="text-xs text-slate-500">TEL: {bundle.project.branch.company.phone}</p>
                )}
                <p className="text-xs text-slate-400 mt-2">
                  提出日：{formatDate(bundle.createdAt, "yyyy年MM月dd日")}
                </p>
                <p className="text-xs text-slate-400 font-mono">
                  No. {bundle.bundleNumber}
                </p>
              </div>
            </div>

            {/* 合計金額ボックス */}
            <div className="border-2 border-[#1a365d] mx-auto max-w-[420px] mb-8">
              <div className="bg-[#1a365d] text-white text-center py-1.5">
                <span className="text-xs tracking-widest">お 見 積 金 額</span>
              </div>
              <div className="text-center py-4">
                <span className="text-[28px] font-bold tracking-wide" style={{ fontFamily: "'Yu Mincho', 'Hiragino Mincho ProN', serif" }}>
                  ¥{formatCurrency(grandTotal)}
                </span>
                <span className="text-sm text-slate-500 ml-1">（税込）</span>
              </div>
              <div className="flex justify-center gap-8 pb-3 text-xs text-slate-500">
                <span>税抜 ¥{formatCurrency(grandSubtotal - grandDiscount)}</span>
                <span>消費税 ¥{formatCurrency(grandTax)}</span>
              </div>
            </div>

            {/* 挨拶文 */}
            <p className="text-sm text-slate-600 mb-6 leading-7 px-2" style={{ fontFamily: "'Yu Mincho', 'Hiragino Mincho ProN', serif" }}>
              下記のとおりお見積もり申し上げます。ご検討の程、よろしくお願いいたします。
            </p>

            {/* 見積一覧テーブル */}
            <table className="w-full text-sm border-collapse mb-6">
              <thead>
                <tr>
                  <th className="bg-[#1a365d] text-white py-2 px-3 text-left font-medium w-[6%]">No.</th>
                  <th className="bg-[#1a365d] text-white py-2 px-3 text-left font-medium w-[12%]">見積番号</th>
                  <th className="bg-[#1a365d] text-white py-2 px-3 text-left font-medium w-[40%]">工事名称</th>
                  <th className="bg-[#1a365d] text-white py-2 px-3 text-right font-medium w-[18%]">税抜金額</th>
                  <th className="bg-[#1a365d] text-white py-2 px-3 text-right font-medium w-[24%]">税込金額</th>
                </tr>
              </thead>
              <tbody>
                {bundle.estimates.map((est, i) => (
                  <tr key={est.id} className={i % 2 === 0 ? "" : "bg-[#f9fafb]"}>
                    <td className="py-2.5 px-3 border-b border-slate-200 text-center font-mono text-slate-500">{i + 1}</td>
                    <td className="py-2.5 px-3 border-b border-slate-200 font-mono text-xs text-slate-500">{est.estimateNumber}</td>
                    <td className="py-2.5 px-3 border-b border-slate-200 font-medium">{est.title || est.estimateNumber || "見積"}</td>
                    <td className="py-2.5 px-3 border-b border-slate-200 text-right font-mono">¥{formatCurrency(est.subtotal - (est.discountAmount ?? 0))}</td>
                    <td className="py-2.5 px-3 border-b border-slate-200 text-right font-mono font-semibold">¥{formatCurrency(est.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 合計集計 */}
            <div className="flex justify-end">
              <div className="w-[300px] border-2 border-[#1a365d]">
                <div className="flex justify-between py-1.5 px-4 border-b border-slate-200 text-sm">
                  <span className="text-slate-500">小計（税抜）</span>
                  <span className="font-mono">¥{formatCurrency(grandSubtotal - grandDiscount)}</span>
                </div>
                {grandDiscount > 0 && (
                  <div className="flex justify-between py-1.5 px-4 border-b border-slate-200 text-sm text-red-600">
                    <span>値引合計</span>
                    <span className="font-mono">-¥{formatCurrency(grandDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between py-1.5 px-4 border-b border-slate-200 text-sm">
                  <span className="text-slate-500">消費税</span>
                  <span className="font-mono">¥{formatCurrency(grandTax)}</span>
                </div>
                <div className="flex justify-between py-2.5 px-4 bg-[#1a365d] text-white font-bold text-sm">
                  <span>合計（税込）</span>
                  <span className="font-mono text-base">¥{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* 備考 */}
            {bundle.note && (
              <div className="mt-6 border-t border-slate-200 pt-4">
                <p className="text-[10px] text-slate-400 tracking-widest mb-1">備　考</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-6" style={{ fontFamily: "'Yu Mincho', 'Hiragino Mincho ProN', serif" }}>
                  {bundle.note}
                </p>
              </div>
            )}
          </div>

          <div className="px-[20mm] pb-4 flex justify-between items-end text-[9px] text-slate-400">
            <span>{bundle.bundleNumber}</span>
            <span>1 / {totalPages}</span>
          </div>
          <div className="h-1 bg-[#1a365d] w-full" />
        </div>

        {/* ================================================================
           2ページ目〜: 各見積の明細
        ================================================================ */}
        {bundle.estimates.map((est, estIdx) => (
          <div key={est.id} className="page-container">
            <div className="h-1.5 bg-[#1a365d] w-full" />

            <div className="px-[20mm] pt-6 pb-4 flex-1">
              {/* ページヘッダー */}
              <div className="flex items-end justify-between mb-5 pb-2 border-b-2 border-[#1a365d]">
                <div>
                  <p className="text-[10px] text-slate-400 tracking-widest mb-0.5">見積明細</p>
                  <h2 className="text-base font-bold text-[#1a365d]" style={{ fontFamily: "'Yu Mincho', 'Hiragino Mincho ProN', serif" }}>
                    {est.title || est.estimateNumber || "見積"}
                  </h2>
                </div>
                <div className="text-right text-[10px] text-slate-400">
                  <p className="font-mono">{est.estimateNumber}</p>
                  <p>担当: {est.userName}</p>
                </div>
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
                      if (grp.name) {
                        rows.push(
                          <tr key={`gh-${grp.id}`}>
                            <td colSpan={5} className="bg-[#f0f4f8] py-1.5 px-3 font-bold text-[#1a365d] border-b border-[#d1d9e6]">
                              {sec.name && sec.name !== grp.name ? (
                                <><span className="text-slate-400 font-normal">{sec.name}</span><span className="text-slate-300 mx-1.5">/</span></>
                              ) : null}
                              {grp.name}
                            </td>
                          </tr>
                        )
                      }
                      grp.items.forEach((item, itemIdx) => {
                        const amount = item.quantity * item.unitPrice
                        rows.push(
                          <tr key={item.id} className={itemIdx % 2 === 0 ? "" : "bg-[#f9fafb]"}>
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

              {/* 小計〜合計 */}
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

            <div className="px-[20mm] pb-4 flex justify-between items-end text-[9px] text-slate-400">
              <span>{bundle.bundleNumber}　—　{est.title || est.estimateNumber}</span>
              <span>{estIdx + 2} / {totalPages}</span>
            </div>
            <div className="h-1 bg-[#1a365d] w-full" />
          </div>
        ))}
      </div>

      {/* ─── 印刷用CSS ── */}
      <style jsx global>{`
        .bundle-print-root .page-container {
          width: 210mm;
          min-height: 297mm;
          background: white;
          display: flex;
          flex-direction: column;
          box-shadow: 0 4px 24px rgba(0,0,0,0.12);
          margin-bottom: 24px;
        }
        @media print {
          @page { size: A4; margin: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; }
          .bundle-print-root .page-container {
            box-shadow: none;
            margin-bottom: 0;
            page-break-after: always;
            min-height: 0;
          }
          .bundle-print-root .page-container:last-child {
            page-break-after: auto;
          }
        }
      `}</style>
    </>
  )
}

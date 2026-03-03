/**
 * [COMPONENT] 見積書 印刷・プレビューレイアウト - EstimatePrint
 *
 * isDraft = true  → プレビューモード
 *   - 大きな「プレビュー」透かし（斜め45度）を全面に表示
 *   - 印刷ボタンなし（@media print でも透かしは消えない）
 *   - ページ上部に「下書きです・印刷不可」バナーを表示
 *
 * isDraft = false → 正式印刷モード（CONFIRMED / SENT のみ）
 *   - 透かしなし・クリーンなA4レイアウト
 *   - 「印刷する（PDF保存）」ボタンあり
 *   - autoprint=true のとき自動で印刷ダイアログを開く
 */
"use client"

import { useEffect } from "react"
import { formatDate, formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Printer, ArrowLeft, Eye, AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { addDays } from "date-fns"
import type { EstimateStatus, AddressType } from "@prisma/client"

// ─── 型定義 ────────────────────────────────────────────

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

interface Props {
  estimate: {
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
        company: { name: string; phone?: string | null }
      }
      contact: { name: string; phone?: string } | null
    }
    user: { name: string }
    sections: EstimateSection[]
  }
  taxRate: number
  /** true = プレビューモード（透かし表示・印刷不可） */
  isDraft: boolean
  /** true = ページを開いたとき自動で印刷ダイアログを表示 */
  autoPrint?: boolean
  /** true = EstimateDetail 内にインライン表示（固定ツールバー非表示） */
  embedded?: boolean
}

// ─── メインコンポーネント ───────────────────────────────

export function EstimatePrint({ estimate, taxRate, isDraft, autoPrint, embedded = false }: Props) {
  const router = useRouter()

  // 金額計算
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

  const estimateLabel = estimate.estimateNumber
    ? `見積番号 ${estimate.estimateNumber}${estimate.revision > 1 ? ` (第${estimate.revision}版)` : ""}`
    : "（番号未発行）"

  // autoPrint=true のとき、ページ表示後に印刷ダイアログを開く
  useEffect(() => {
    if (autoPrint && !isDraft) {
      const timer = setTimeout(() => window.print(), 500)
      return () => clearTimeout(timer)
    }
  }, [autoPrint, isDraft])

  return (
    <>
      {/* ━━ ツールバー（印刷時は非表示・embedded時も非表示） ━━━━━━━━━━━━ */}
      {!embedded && (
      <div className="print:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 shadow-sm px-6 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            // 履歴があれば戻る、なければ見積一覧に戻る
            if (window.history.length > 1) {
              router.back()
            } else {
              router.push("/")
            }
          }}
          className="text-slate-600"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          戻る
        </Button>
        <span className="text-sm text-slate-500 flex-1 truncate">
          {estimate.project.branch.company.name} /{" "}
          {estimate.project.name} — {estimateLabel}
        </span>

        {isDraft ? (
          /* プレビューモード: 印刷ボタンなし */
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-300 rounded-lg">
            <Eye className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-700">
              プレビュー（下書き）
            </span>
          </div>
        ) : (
          /* 正式印刷モード */
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 hidden md:block">
              「印刷する」→「PDFに保存」でPDF出力できます
            </span>
            <Button onClick={() => window.print()} className="gap-2">
              <Printer className="w-4 h-4" />
              印刷する（PDF保存）
            </Button>
          </div>
        )}
      </div>
      )}

      {/* ━━ プレビューモードの注意バナー（印刷時は非表示・embedded時も非表示） ━━ */}
      {!embedded && isDraft && (
        <div className="print:hidden fixed top-[57px] left-0 right-0 z-40 bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-bold">これはプレビューです。</span>
            見積が確定（CONFIRMED）するまで印刷・PDF保存はできません。
            確定後に「印刷・PDF」ボタンが表示されます。
          </p>
        </div>
      )}

      {/* ━━ 印刷エリア ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div
        className={`print:bg-white print:min-h-0 print:pt-0 ${
          embedded ? "" : isDraft ? "min-h-screen pt-[100px]" : "min-h-screen pt-[60px]"
        }`}
      >
        <div
          className="
            relative mx-auto bg-white
            w-[210mm] min-h-[297mm]
            px-[15mm] py-[12mm]
            print:w-full print:min-h-0 print:px-[15mm] print:py-[12mm]
            shadow-xl print:shadow-none
            overflow-hidden
          "
          style={{ fontFamily: "'Noto Sans JP', sans-serif" }}
        >
          {/* ━━ 透かし（下書きのみ・印刷時も表示） ━━━━━━━━━ */}
          {isDraft && (
            <div
              className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center"
              aria-hidden
            >
              {/* 斜め透かし テキスト（繰り返し） */}
              <div
                className="absolute inset-0 flex flex-wrap items-center justify-center gap-0 overflow-hidden"
                style={{ transform: "rotate(-35deg) scale(1.5)" }}
              >
                {Array.from({ length: 30 }).map((_, i) => (
                  <span
                    key={i}
                    className="text-4xl font-black text-red-500/20 whitespace-nowrap px-8 py-4 tracking-widest select-none"
                    style={{ opacity: 0.3 }}
                  >
                    プレビュー・下書き
                  </span>
                ))}
              </div>

              {/* 中央の大きな透かし */}
              <div
                className="relative border-4 border-red-400/40 rounded-2xl px-10 py-5 rotate-[-20deg]"
                style={{ opacity: 0.35 }}
              >
                <p className="text-6xl font-black text-red-500 tracking-widest select-none">
                  下書き
                </p>
                <p className="text-xl font-bold text-red-400 text-center tracking-widest select-none">
                  DRAFT / PREVIEW
                </p>
              </div>
            </div>
          )}

          {/* ━━ 見積書本体 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          {/* flex-col で明細エリアを伸縮させ、合計欄を常に下部に押し下げる */}
          <div className="relative z-0 flex flex-col" style={{ minHeight: "calc(297mm - 24mm)" }}>
            {/* タイトル */}
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold tracking-widest">
                御　見　積　書
              </h1>
              {isDraft && (
                <p className="text-xs text-red-500 mt-1 font-medium">
                  ※ これは下書きプレビューです。正式な書類ではありません。
                </p>
              )}
            </div>

            {/* ヘッダー2列 */}
            <div className="flex gap-6 mb-6">
              {/* 左: 宛先 */}
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
                  件名：
                  <span className="font-medium text-slate-900">
                    {estimate.project.name}
                  </span>
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  有効期限：
                  <span className="font-medium">
                    {isDraft
                      ? "（確定後に確定日から算出）"
                      : `${formatDate(expiryDate, "yyyy年MM月dd日")}まで`}
                  </span>
                </p>
              </div>

              {/* 右: 発行情報・自社 */}
              <div className="w-52 flex-shrink-0 text-right">
                <table className="text-xs text-slate-600 ml-auto">
                  <tbody>
                    <tr>
                      <td className="pr-2 py-0.5 text-right text-slate-400">
                        発行日
                      </td>
                      <td className="font-medium">
                        {isDraft
                          ? "（未確定）"
                          : formatDate(issueDate, "yyyy年MM月dd日")}
                      </td>
                    </tr>
                    <tr>
                      <td className="pr-2 py-0.5 text-right text-slate-400">
                        見積番号
                      </td>
                      <td className="font-medium font-mono">
                        {estimate.estimateNumber ? (
                          <>
                            {estimate.estimateNumber}
                            {estimate.revision > 1 && (
                              <span className="text-slate-500">
                                {" "}第{estimate.revision}版
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-400">（未発行）</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="pr-2 py-0.5 text-right text-slate-400">
                        担当者
                      </td>
                      <td className="font-medium">{estimate.user.name}</td>
                    </tr>
                  </tbody>
                </table>
                <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-500">
                  <p className="font-bold text-sm text-slate-800">
                    株式会社 足場屋
                  </p>
                  <p>〒000-0000 ○○県○○市△△1-1</p>
                  <p>TEL: 000-0000-0000</p>
                </div>
              </div>
            </div>

            {/* 合計金額 */}
            <div className="bg-slate-50 border border-slate-300 rounded px-4 py-2 mb-5 flex items-center justify-between">
              <span className="text-sm text-slate-500">御見積金額（税込）</span>
              <span className="text-2xl font-bold text-slate-900 font-mono">
                ¥ {formatCurrency(total)}
              </span>
            </div>

            {/* 明細テーブル（flex-1 で残りスペースを埋める） */}
            <div className="flex-1">
            {estimate.sections.map((section, si) => (
              <div key={section.id} className={si > 0 ? "mt-4" : ""}>
                <div className="bg-slate-700 text-white px-3 py-1 text-sm font-medium">
                  {section.name}
                </div>
                {section.groups.map((group) => (
                  <div key={group.id}>
                    <div className="bg-slate-100 px-3 py-0.5 text-xs font-medium text-slate-600 border-b border-slate-200">
                      {group.name}
                    </div>
                    <table className="w-full text-xs border-b border-slate-200">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500">
                          <th className="text-left px-3 py-1 font-normal border-b border-slate-200">
                            項目
                          </th>
                          <th className="text-right px-2 py-1 font-normal w-14 border-b border-slate-200">
                            数量
                          </th>
                          <th className="text-center px-2 py-1 font-normal w-10 border-b border-slate-200">
                            単位
                          </th>
                          <th className="text-right px-2 py-1 font-normal w-20 border-b border-slate-200">
                            単価
                          </th>
                          <th className="text-right px-3 py-1 font-normal w-24 border-b border-slate-200">
                            金額
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((item, idx) => {
                          const amount = item.quantity * item.unitPrice
                          return (
                            <tr
                              key={item.id}
                              className={
                                idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                              }
                            >
                              <td className="px-3 py-1">{item.name}</td>
                              <td className="px-2 py-1 text-right font-mono">
                                {item.quantity.toLocaleString()}
                              </td>
                              <td className="px-2 py-1 text-center">
                                {item.unit.name}
                              </td>
                              <td className="px-2 py-1 text-right font-mono">
                                {formatCurrency(item.unitPrice)}
                              </td>
                              <td className="px-3 py-1 text-right font-mono font-medium">
                                {formatCurrency(amount)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            ))}
            </div>{/* /明細テーブル */}

            {/* 合計内訳 */}
            <div className="mt-4 flex justify-end">
              <table className="text-sm border border-slate-200 w-64">
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="px-4 py-1.5 text-slate-500">
                      小計（税抜）
                    </td>
                    <td className="px-4 py-1.5 text-right font-mono">
                      ¥{formatCurrency(subtotal)}
                    </td>
                  </tr>
                  {discount > 0 && (
                    <tr className="border-b border-slate-100">
                      <td className="px-4 py-1.5 text-slate-500">値引き</td>
                      <td className="px-4 py-1.5 text-right font-mono text-red-600">
                        -¥{formatCurrency(discount)}
                      </td>
                    </tr>
                  )}
                  <tr className="border-b border-slate-100">
                    <td className="px-4 py-1.5 text-slate-500">
                      消費税（{Math.round(taxRate * 100)}%）
                    </td>
                    <td className="px-4 py-1.5 text-right font-mono">
                      ¥{formatCurrency(tax)}
                    </td>
                  </tr>
                  <tr className="bg-slate-800 text-white">
                    <td className="px-4 py-2 font-bold">合計（税込）</td>
                    <td className="px-4 py-2 text-right font-mono font-bold text-base">
                      ¥{formatCurrency(total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 特記事項 */}
            {estimate.note && (
              <div className="mt-5 border border-slate-200 rounded p-3">
                <p className="text-xs font-medium text-slate-500 mb-1">
                  特記事項
                </p>
                <p className="text-xs whitespace-pre-wrap text-slate-700 leading-relaxed">
                  {estimate.note}
                </p>
              </div>
            )}

            {/* フッター */}
            <div className="mt-8 pt-3 border-t border-slate-200 text-center text-xs text-slate-400">
              {isDraft ? (
                <span className="text-red-400 font-medium">
                  ※ 下書きプレビュー — 正式な見積書ではありません
                </span>
              ) : (
                "本見積書は有効期限内の再発行が可能です。ご不明な点はお気軽にご連絡ください。"
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ━━ 印刷スタイル ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <style>{`
        @page {
          size: A4;
          /* ブラウザのURL・日付・ページ番号を非表示にするため余白をゼロにする */
          margin: 0;
        }
        @media print {
          body {
            /* @page margin:0 の分、印刷時はコンテンツ側でパディングを確保 */
            margin: 0;
            padding: 0;
          }
          ${isDraft ? `.print\\:hidden { display: none !important; }` : ""}
        }
      `}</style>
    </>
  )
}

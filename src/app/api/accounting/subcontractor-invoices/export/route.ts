/**
 * [API] 経理 - 支払一覧CSV出力 GET /api/accounting/subcontractor-invoices/export
 *
 * クエリパラメータ:
 *   yearMonth: 対象年月（必須・例: 2026-03）
 *   closingType: MONTH_END | DAY_15（任意）
 *   companyId: 会社ID（任意）
 *
 * CSV列: 支払予定日, 会社区分, 取引先名, 口座名義, 銀行名, 支店名,
 *         口座種別, 口座番号, 金額（税込）, 支払区分, 備考
 * 文字コード: UTF-8 BOM付き
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

export async function GET(req: NextRequest) {
  // 認証チェック
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // クエリパラメータ取得
  const yearMonth = req.nextUrl.searchParams.get("yearMonth")
  const closingType = req.nextUrl.searchParams.get("closingType")
  const companyId = req.nextUrl.searchParams.get("companyId")

  // yearMonth は必須
  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
    return NextResponse.json(
      { error: "yearMonth は必須です（例: 2026-03）" },
      { status: 400 }
    )
  }

  // 日付範囲を計算
  const [yearStr, monthStr] = yearMonth.split("-")
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)

  // 検索条件の構築
  const where: Prisma.SubcontractorInvoiceWhereInput = {
    billingYearMonth: { gte: start, lt: end },
  }
  if (closingType === "MONTH_END" || closingType === "DAY_15") {
    where.closingType = closingType
  }
  if (companyId) {
    where.companyId = companyId
  }

  // データ取得（取引先の口座情報を含む）
  const invoices = await prisma.subcontractorInvoice.findMany({
    where,
    include: {
      vendor: {
        select: {
          name: true,
          bankName: true,
          branchName: true,
          accountType: true,
          accountNumber: true,
          accountHolder: true,
        },
      },
      company: { select: { name: true } },
    },
    orderBy: [{ paymentDueDate: "asc" }, { vendor: { name: "asc" } }],
  })

  // 口座種別の表示変換
  function accountTypeLabel(type: string | null): string {
    if (type === "ORDINARY") return "普通"
    if (type === "CURRENT") return "当座"
    return ""
  }

  // 支払区分の表示変換
  function closingTypeLabel(type: string): string {
    if (type === "MONTH_END") return "月末"
    if (type === "DAY_15") return "15日"
    return ""
  }

  // 日付フォーマット
  function formatDate(d: Date | string | null): string {
    if (!d) return ""
    const date = new Date(d)
    if (isNaN(date.getTime())) return ""
    const y = date.getFullYear()
    const m = (date.getMonth() + 1).toString().padStart(2, "0")
    const day = date.getDate().toString().padStart(2, "0")
    return `${y}/${m}/${day}`
  }

  // CSVフィールドのエスケープ
  function escapeCSV(value: string): string {
    if (
      value.includes(",") ||
      value.includes('"') ||
      value.includes("\n") ||
      value.includes("\r")
    ) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  // CSV ヘッダー
  const headers = [
    "支払予定日",
    "会社区分",
    "取引先名",
    "口座名義",
    "銀行名",
    "支店名",
    "口座種別",
    "口座番号",
    "金額（税込）",
    "支払区分（月末・15日）",
    "備考",
  ]

  // CSV 行の生成
  const rows = invoices.map((inv) => [
    escapeCSV(formatDate(inv.paymentDueDate)),
    escapeCSV(inv.company.name),
    escapeCSV(inv.vendor.name),
    escapeCSV(inv.vendor.accountHolder ?? ""),
    escapeCSV(inv.vendor.bankName ?? ""),
    escapeCSV(inv.vendor.branchName ?? ""),
    escapeCSV(accountTypeLabel(inv.vendor.accountType)),
    escapeCSV(inv.vendor.accountNumber ?? ""),
    String(Number(inv.amount)),
    escapeCSV(closingTypeLabel(inv.closingType)),
    escapeCSV(inv.note ?? ""),
  ])

  // CSV文字列を構築（BOM付きUTF-8）
  const BOM = "\uFEFF"
  const csvContent =
    BOM +
    headers.map(escapeCSV).join(",") +
    "\r\n" +
    rows.map((row) => row.join(",")).join("\r\n") +
    "\r\n"

  // ファイル名の生成
  const closingSuffix = closingType ? `-${closingType}` : ""
  const fileName = `payment-list-${yearMonth}${closingSuffix}.csv`

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  })
}

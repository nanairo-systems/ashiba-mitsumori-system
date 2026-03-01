/**
 * [API] 入金CSVエクスポート - /api/payments/export
 *
 * 税理士向け：請求額・入金額・差額（手数料/値引き）の一覧をCSV出力
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { format } from "date-fns"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  const where: Record<string, unknown> = {}
  if (from || to) {
    where.paymentDate = {}
    if (from) (where.paymentDate as Record<string, unknown>).gte = new Date(from)
    if (to) (where.paymentDate as Record<string, unknown>).lte = new Date(to + "T23:59:59")
  }

  const payments = await prisma.payment.findMany({
    where,
    include: {
      invoice: {
        include: {
          contract: {
            include: {
              project: {
                include: {
                  branch: { include: { company: { select: { name: true } } } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { paymentDate: "asc" },
  })

  const BOM = "\uFEFF"
  const headers = [
    "入金日", "請求番号", "会社名", "現場名",
    "請求額（税込）", "入金額", "振込手数料", "値引き額", "差額合計",
    "請求ステータス", "備考",
  ]

  const rows = payments.map((p) => {
    const inv = p.invoice
    const invoiceTotal = Number(inv.totalAmount)
    const paymentAmt = Number(p.paymentAmount)
    const fee = Number(p.transferFee)
    const discount = Number(p.discountAmount)
    const totalSettled = paymentAmt + fee + discount

    return [
      format(p.paymentDate, "yyyy/MM/dd"),
      inv.invoiceNumber ?? "",
      inv.contract.project.branch.company.name,
      inv.contract.project.name,
      invoiceTotal,
      paymentAmt,
      fee,
      discount,
      invoiceTotal - totalSettled,
      inv.status === "PAID" ? "入金済" : inv.status === "PARTIAL_PAID" ? "一部入金" : inv.status === "SENT" ? "送付済" : "下書き",
      p.notes ?? "",
    ]
  })

  const csv = BOM + [headers, ...rows].map((r) =>
    r.map((v) => typeof v === "string" && (v.includes(",") || v.includes('"') || v.includes("\n"))
      ? `"${v.replace(/"/g, '""')}"`
      : String(v)
    ).join(",")
  ).join("\r\n")

  const filename = `入金一覧_${format(new Date(), "yyyyMMdd")}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  })
}

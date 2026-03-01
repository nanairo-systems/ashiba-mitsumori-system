/**
 * [API] 入金 GET/POST - /api/payments
 *
 * POST: 入金登録 → 請求の入金額を再計算 → ステータス自動更新
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  invoiceId: z.string().uuid(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentAmount: z.number().positive(),
  transferFee: z.number().nonnegative().default(0),
  discountAmount: z.number().nonnegative().default(0),
  notes: z.string().max(1000).nullable().optional(),
})

async function recalcInvoiceStatus(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true },
  })
  if (!invoice) return

  const totalPaid = invoice.payments.reduce(
    (sum, p) => sum + Number(p.paymentAmount) + Number(p.transferFee) + Number(p.discountAmount),
    0
  )
  const invoiceTotal = Number(invoice.totalAmount)
  const paidAmountOnly = invoice.payments.reduce((sum, p) => sum + Number(p.paymentAmount), 0)

  let newStatus = invoice.status
  if (totalPaid >= invoiceTotal) {
    newStatus = "PAID"
  } else if (totalPaid > 0) {
    newStatus = "PARTIAL_PAID"
  } else if (invoice.status === "PAID" || invoice.status === "PARTIAL_PAID") {
    newStatus = "SENT"
  }

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      paidAmount: paidAmountOnly,
      paidAt: newStatus === "PAID" ? new Date() : invoice.paidAt,
      status: newStatus,
    },
  })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const payments = await prisma.payment.findMany({
    include: {
      invoice: {
        include: {
          contract: {
            include: {
              project: {
                include: {
                  branch: { include: { company: { select: { id: true, name: true } } } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { paymentDate: "desc" },
  })

  return NextResponse.json(payments)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("、")
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const d = parsed.data
  const invoice = await prisma.invoice.findUnique({ where: { id: d.invoiceId } })
  if (!invoice) return NextResponse.json({ error: "請求が見つかりません" }, { status: 404 })

  const payment = await prisma.payment.create({
    data: {
      invoiceId: d.invoiceId,
      paymentDate: new Date(d.paymentDate),
      paymentAmount: d.paymentAmount,
      transferFee: d.transferFee,
      discountAmount: d.discountAmount,
      notes: d.notes ?? null,
    },
  })

  await recalcInvoiceStatus(d.invoiceId)

  return NextResponse.json(payment, { status: 201 })
}

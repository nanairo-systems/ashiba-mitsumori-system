/**
 * [API] 入金 PATCH/DELETE - /api/payments/:id
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const patchSchema = z.object({
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  paymentAmount: z.number().positive().optional(),
  transferFee: z.number().nonnegative().optional(),
  discountAmount: z.number().nonnegative().optional(),
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 })

  const payment = await prisma.payment.findUnique({ where: { id } })
  if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const updateData: Record<string, unknown> = {}
  const d = parsed.data
  if (d.paymentDate !== undefined) updateData.paymentDate = new Date(d.paymentDate)
  if (d.paymentAmount !== undefined) updateData.paymentAmount = d.paymentAmount
  if (d.transferFee !== undefined) updateData.transferFee = d.transferFee
  if (d.discountAmount !== undefined) updateData.discountAmount = d.discountAmount
  if (d.notes !== undefined) updateData.notes = d.notes

  const updated = await prisma.payment.update({ where: { id }, data: updateData })

  await recalcInvoiceStatus(payment.invoiceId)

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const payment = await prisma.payment.findUnique({ where: { id } })
  if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const invoiceId = payment.invoiceId
  await prisma.payment.delete({ where: { id } })

  await recalcInvoiceStatus(invoiceId)

  return NextResponse.json({ ok: true })
}

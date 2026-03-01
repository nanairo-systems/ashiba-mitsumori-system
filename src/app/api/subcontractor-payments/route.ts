/**
 * [API] 下請け支払い GET/POST - /api/subcontractor-payments
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  contractId: z.string().uuid(),
  subcontractorId: z.string().uuid(),
  orderAmount: z.number().nonnegative(),
  taxAmount: z.number().nonnegative(),
  totalAmount: z.number().positive(),
  closingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  paymentDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
})

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const payments = await prisma.subcontractorPayment.findMany({
    include: {
      subcontractor: { select: { id: true, name: true, representative: true, phone: true } },
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
    orderBy: { paymentDueDate: "asc" },
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

  const contract = await prisma.contract.findUnique({ where: { id: d.contractId } })
  if (!contract) return NextResponse.json({ error: "契約が見つかりません" }, { status: 404 })

  const sub = await prisma.subcontractor.findUnique({ where: { id: d.subcontractorId } })
  if (!sub) return NextResponse.json({ error: "外注先が見つかりません" }, { status: 404 })

  const payment = await prisma.subcontractorPayment.create({
    data: {
      contractId: d.contractId,
      subcontractorId: d.subcontractorId,
      orderAmount: d.orderAmount,
      taxAmount: d.taxAmount,
      totalAmount: d.totalAmount,
      closingDate: d.closingDate ? new Date(d.closingDate) : null,
      paymentDueDate: d.paymentDueDate ? new Date(d.paymentDueDate) : null,
      status: "PENDING",
      notes: d.notes ?? null,
    },
  })

  return NextResponse.json(payment, { status: 201 })
}

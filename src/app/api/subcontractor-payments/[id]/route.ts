/**
 * [API] 下請け支払い PATCH/DELETE - /api/subcontractor-payments/:id
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const patchSchema = z.object({
  orderAmount: z.number().nonnegative().optional(),
  taxAmount: z.number().nonnegative().optional(),
  totalAmount: z.number().positive().optional(),
  closingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  paymentDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  paymentAmount: z.number().nonnegative().nullable().optional(),
  status: z.enum(["PENDING", "SCHEDULED", "PAID"]).optional(),
  notes: z.string().max(1000).nullable().optional(),
})

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

  const existing = await prisma.subcontractorPayment.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const updateData: Record<string, unknown> = {}
  const d = parsed.data
  if (d.orderAmount !== undefined) updateData.orderAmount = d.orderAmount
  if (d.taxAmount !== undefined) updateData.taxAmount = d.taxAmount
  if (d.totalAmount !== undefined) updateData.totalAmount = d.totalAmount
  if (d.closingDate !== undefined) updateData.closingDate = d.closingDate ? new Date(d.closingDate) : null
  if (d.paymentDueDate !== undefined) updateData.paymentDueDate = d.paymentDueDate ? new Date(d.paymentDueDate) : null
  if (d.paymentDate !== undefined) updateData.paymentDate = d.paymentDate ? new Date(d.paymentDate) : null
  if (d.paymentAmount !== undefined) updateData.paymentAmount = d.paymentAmount
  if (d.status !== undefined) updateData.status = d.status
  if (d.notes !== undefined) updateData.notes = d.notes

  const updated = await prisma.subcontractorPayment.update({ where: { id }, data: updateData })
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
  const existing = await prisma.subcontractorPayment.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.subcontractorPayment.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

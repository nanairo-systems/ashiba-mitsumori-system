/**
 * [API] 工事区分 更新・削除 - PATCH/DELETE /api/contracts/:id/works/:workId
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const patchSchema = z.object({
  workType: z.enum(["INHOUSE", "SUBCONTRACT"]).optional(),
  workerCount: z.number().int().positive().nullable().optional(),
  workDays: z.number().int().positive().nullable().optional(),
  subcontractorId: z.string().uuid().nullable().optional(),
  orderAmount: z.number().nonnegative().nullable().optional(),
  orderTaxAmount: z.number().nonnegative().nullable().optional(),
  orderTotalAmount: z.number().nonnegative().nullable().optional(),
  orderStatus: z.enum(["NOT_ORDERED", "ORDERED", "COMPLETED"]).optional(),
  note: z.string().max(500).nullable().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; workId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { workId } = await params
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 })
  }

  const work = await prisma.contractWork.findUnique({ where: { id: workId } })
  if (!work) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const updateData: Record<string, unknown> = {}
  const d = parsed.data
  if (d.workType !== undefined) updateData.workType = d.workType
  if (d.workerCount !== undefined) updateData.workerCount = d.workerCount
  if (d.workDays !== undefined) updateData.workDays = d.workDays
  if (d.subcontractorId !== undefined) updateData.subcontractorId = d.subcontractorId
  if (d.orderAmount !== undefined) updateData.orderAmount = d.orderAmount
  if (d.orderTaxAmount !== undefined) updateData.orderTaxAmount = d.orderTaxAmount
  if (d.orderTotalAmount !== undefined) updateData.orderTotalAmount = d.orderTotalAmount
  if (d.orderStatus !== undefined) {
    updateData.orderStatus = d.orderStatus
    if (d.orderStatus === "ORDERED") updateData.orderedAt = new Date()
  }
  if (d.note !== undefined) updateData.note = d.note

  const updated = await prisma.contractWork.update({
    where: { id: workId },
    data: updateData,
    include: { subcontractor: true },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; workId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { workId } = await params
  const work = await prisma.contractWork.findUnique({ where: { id: workId } })
  if (!work) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.contractWork.delete({ where: { id: workId } })
  return NextResponse.json({ ok: true })
}

/**
 * [API] 見積り発注情報 - /api/estimates/[id]/purchase-order
 *
 * GET    - 発注情報取得
 * POST   - 発注情報の作成または更新（upsert）
 * PATCH  - ステータスのみ更新
 * DELETE - 発注情報削除
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const upsertSchema = z.object({
  subcontractorId: z.string().min(1),
  orderAmount: z.number().positive(),
  taxRate: z.number().int().min(0).max(100).default(10),
  note: z.string().max(500).nullable().optional(),
})

const patchSchema = z.object({
  status: z.enum(["DRAFT", "ORDERED", "COMPLETED"]),
})

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const order = await prisma.estimatePurchaseOrder.findUnique({
    where: { estimateId: id },
    include: { subcontractor: { select: { id: true, name: true } } },
  })

  if (!order) return NextResponse.json(null)

  return NextResponse.json({
    ...order,
    orderAmount: Number(order.orderAmount),
    subcontractorName: order.subcontractor.name,
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const body = await req.json()
  const parsed = upsertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { subcontractorId, orderAmount, taxRate, note } = parsed.data

  const order = await prisma.estimatePurchaseOrder.upsert({
    where: { estimateId: id },
    create: {
      estimateId: id,
      subcontractorId,
      orderAmount,
      taxRate,
      note: note ?? null,
    },
    update: {
      subcontractorId,
      orderAmount,
      taxRate,
      note: note ?? null,
    },
    include: { subcontractor: { select: { id: true, name: true } } },
  })

  return NextResponse.json({
    ...order,
    orderAmount: Number(order.orderAmount),
    subcontractorName: order.subcontractor.name,
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { status } = parsed.data

  const order = await prisma.estimatePurchaseOrder.update({
    where: { estimateId: id },
    data: {
      status,
      orderedAt: status === "ORDERED" ? new Date() : undefined,
    },
    include: { subcontractor: { select: { id: true, name: true } } },
  })

  return NextResponse.json({
    ...order,
    orderAmount: Number(order.orderAmount),
    subcontractorName: order.subcontractor.name,
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  await prisma.estimatePurchaseOrder.delete({
    where: { estimateId: id },
  })

  return NextResponse.json({ ok: true })
}

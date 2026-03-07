/**
 * [API] 車両マスタ - PUT/DELETE /api/vehicles/[id]
 *
 * PUT: 車両情報を更新
 * DELETE: isActive=false に変更（論理削除）
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  licensePlate: z.string().max(20).optional(),
  vehicleType: z.string().max(50).nullable().optional(),
  capacity: z.string().max(50).nullable().optional(),
  inspectionDate: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("、") }, { status: 400 })
  }

  const data: Record<string, unknown> = { ...parsed.data }
  if (typeof data.inspectionDate === "string") {
    data.inspectionDate = new Date(data.inspectionDate as string)
  }

  const vehicle = await prisma.vehicle.update({
    where: { id },
    data,
  })

  return NextResponse.json(vehicle)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const vehicle = await prisma.vehicle.update({
    where: { id },
    data: { isActive: false },
  })

  return NextResponse.json(vehicle)
}

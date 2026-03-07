/**
 * [API] 車両詳細 - GET/PUT/DELETE /api/vehicles/:id
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateSchema = z.object({
  name: z.string().min(1, "車両名は必須です").optional(),
  licensePlate: z.string().min(1, "ナンバープレートは必須です").optional(),
  vehicleType: z.string().nullable().optional(),
  capacity: z.string().nullable().optional(),
  inspectionDate: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const vehicle = await prisma.vehicle.findUnique({ where: { id } })
  if (!vehicle) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(vehicle)
}

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
    const msg = parsed.error.issues.map((i) => i.message).join("、")
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const vehicle = await prisma.vehicle.findUnique({ where: { id } })
  if (!vehicle) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const d = parsed.data
  const updated = await prisma.vehicle.update({
    where: { id },
    data: {
      ...(d.name !== undefined && { name: d.name }),
      ...(d.licensePlate !== undefined && { licensePlate: d.licensePlate }),
      ...(d.vehicleType !== undefined && { vehicleType: d.vehicleType }),
      ...(d.capacity !== undefined && { capacity: d.capacity }),
      ...(d.inspectionDate !== undefined && {
        inspectionDate: d.inspectionDate ? new Date(d.inspectionDate) : null,
      }),
      ...(d.isActive !== undefined && { isActive: d.isActive }),
    },
  })

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
  const vehicle = await prisma.vehicle.findUnique({ where: { id } })
  if (!vehicle) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // 物理削除せず isActive=false に変更
  const updated = await prisma.vehicle.update({
    where: { id },
    data: { isActive: false },
  })

  return NextResponse.json(updated)
}

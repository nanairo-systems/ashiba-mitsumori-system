/**
 * [API] 車両マスタ - GET/POST /api/vehicles
 *
 * GET: 車両一覧（?isActive=）
 * POST: 車両新規作成
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  name: z.string().min(1, "車両名は必須です").max(100),
  licensePlate: z.string().min(1, "ナンバープレートは必須です").max(20),
  vehicleType: z.string().max(50).nullable().optional(),
  capacity: z.string().max(50).nullable().optional(),
  inspectionDate: z.string().nullable().optional(),
})

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const isActive = req.nextUrl.searchParams.get("isActive")

  const vehicles = await prisma.vehicle.findMany({
    where: isActive === "true" ? { isActive: true } : isActive === "false" ? { isActive: false } : undefined,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  })

  return NextResponse.json(vehicles)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("、") }, { status: 400 })
  }

  const d = parsed.data
  const vehicle = await prisma.vehicle.create({
    data: {
      name: d.name,
      licensePlate: d.licensePlate,
      vehicleType: d.vehicleType ?? null,
      capacity: d.capacity ?? null,
      inspectionDate: d.inspectionDate ? new Date(d.inspectionDate) : null,
    },
  })

  return NextResponse.json(vehicle, { status: 201 })
}

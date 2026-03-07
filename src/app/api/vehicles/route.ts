/**
 * [API] 車両マスター - GET/POST /api/vehicles
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  name: z.string().min(1, "車両名は必須です"),
  licensePlate: z.string().min(1, "ナンバープレートは必須です"),
  vehicleType: z.string().nullable().optional(),
  capacity: z.string().nullable().optional(),
  inspectionDate: z.string().nullable().optional(), // ISO日付文字列
})

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const isActive = searchParams.get("isActive")

  const where: Record<string, unknown> = {}
  if (isActive === "true") where.isActive = true
  else if (isActive === "false") where.isActive = false

  const vehicles = await prisma.vehicle.findMany({
    where,
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
    const msg = parsed.error.issues.map((i) => i.message).join("、")
    return NextResponse.json({ error: msg }, { status: 400 })
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

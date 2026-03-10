import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const vehicleSchema = z.object({
  plateNumber: z.string().min(1),
  nickname: z.string().optional(),
  vehicleType: z.string().optional(),
  note: z.string().optional(),
})

export async function GET() {
  const vehicles = await prisma.etcVehicle.findMany({
    include: { cards: { include: { driver: true } } },
    orderBy: { plateNumber: "asc" },
  })
  return NextResponse.json(vehicles)
}

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = vehicleSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const vehicle = await prisma.etcVehicle.create({ data: parsed.data })
  return NextResponse.json(vehicle, { status: 201 })
}

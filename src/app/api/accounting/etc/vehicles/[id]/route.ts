import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const patchSchema = z.object({
  plateNumber: z.string().min(1).optional(),
  nickname: z.string().optional(),
  vehicleType: z.string().optional(),
  note: z.string().optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const vehicle = await prisma.etcVehicle.update({ where: { id }, data: parsed.data })
  return NextResponse.json(vehicle)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.etcVehicle.update({ where: { id }, data: { isActive: false } })
  return NextResponse.json({ ok: true })
}

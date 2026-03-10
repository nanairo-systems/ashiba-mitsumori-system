import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const patchSchema = z.object({
  cardNumber: z.string().min(1).optional(),
  vehicleId: z.string().optional().nullable(),
  driverId: z.string().optional().nullable(),
  note: z.string().optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const card = await prisma.etcCard.update({ where: { id }, data: parsed.data })
  return NextResponse.json(card)
}

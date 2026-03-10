import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const cardSchema = z.object({
  cardNumber: z.string().min(1),
  vehicleId: z.string().optional().nullable(),
  driverId: z.string().optional().nullable(),
  note: z.string().optional(),
})

export async function GET() {
  const cards = await prisma.etcCard.findMany({
    include: {
      vehicle: true,
      driver: true,
    },
    orderBy: { cardNumber: "asc" },
  })
  return NextResponse.json(cards)
}

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = cardSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const card = await prisma.etcCard.create({ data: parsed.data })
  return NextResponse.json(card, { status: 201 })
}

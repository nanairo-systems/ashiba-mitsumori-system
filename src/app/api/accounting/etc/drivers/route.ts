import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const driverSchema = z.object({
  name: z.string().min(1),
  note: z.string().optional(),
})

export async function GET() {
  const drivers = await prisma.etcDriver.findMany({
    include: { cards: { include: { vehicle: true } } },
    orderBy: { name: "asc" },
  })
  return NextResponse.json(drivers)
}

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = driverSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const driver = await prisma.etcDriver.create({ data: parsed.data })
  return NextResponse.json(driver, { status: 201 })
}

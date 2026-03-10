import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const driverSchema = z.object({
  name: z.string().min(1),
  departmentId: z.string().optional().nullable(),
  storeId: z.string().optional().nullable(),
  note: z.string().optional(),
})

export async function GET() {
  try {
    // departmentId/storeIdカラムがDB適用済みの場合
    const drivers = await prisma.etcDriver.findMany({
      include: {
        cards: { include: { vehicle: true } },
        department: { include: { company: true } },
        store: true,
      },
      orderBy: { name: "asc" },
    })
    return NextResponse.json(drivers)
  } catch {
    // DB未適用の場合はシンプルなクエリにフォールバック
    const drivers = await prisma.etcDriver.findMany({
      include: { cards: { include: { vehicle: true } } },
      orderBy: { name: "asc" },
    })
    return NextResponse.json(
      drivers.map((d) => ({ ...d, department: null, store: null, departmentId: null, storeId: null }))
    )
  }
}

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = driverSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  try {
    const driver = await prisma.etcDriver.create({
      data: {
        name: parsed.data.name,
        departmentId: parsed.data.departmentId || null,
        storeId: parsed.data.storeId || null,
        note: parsed.data.note,
      },
      include: {
        department: { include: { company: true } },
        store: true,
      },
    })
    return NextResponse.json(driver, { status: 201 })
  } catch {
    // DB未適用の場合
    const driver = await prisma.etcDriver.create({
      data: {
        name: parsed.data.name,
        note: parsed.data.note,
      },
    })
    return NextResponse.json({ ...driver, department: null, store: null, departmentId: null, storeId: null }, { status: 201 })
  }
}

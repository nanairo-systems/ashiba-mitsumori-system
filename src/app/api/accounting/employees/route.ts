import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  name: z.string().min(1),
  departmentId: z.string().optional().nullable(),
  storeId: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  note: z.string().optional(),
})

export async function GET() {
  const employees = await prisma.employee.findMany({
    include: {
      department: { include: { company: true } },
      store: true,
    },
    orderBy: { name: "asc" },
  })
  return NextResponse.json(employees)
}

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const employee = await prisma.employee.create({
    data: {
      name: parsed.data.name,
      departmentId: parsed.data.departmentId || null,
      storeId: parsed.data.storeId || null,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      position: parsed.data.position || null,
      note: parsed.data.note,
    },
    include: {
      department: { include: { company: true } },
      store: true,
    },
  })
  return NextResponse.json(employee, { status: 201 })
}

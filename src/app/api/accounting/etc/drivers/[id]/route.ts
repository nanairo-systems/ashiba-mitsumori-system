import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  departmentId: z.string().optional().nullable(),
  storeId: z.string().optional().nullable(),
  note: z.string().optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  try {
    const driver = await prisma.etcDriver.update({
      where: { id },
      data: parsed.data,
      include: {
        department: { include: { company: true } },
        store: true,
      },
    })
    return NextResponse.json(driver)
  } catch {
    // DB未適用の場合: departmentId/storeIdを除外
    const { departmentId, storeId, ...safeData } = parsed.data
    const driver = await prisma.etcDriver.update({
      where: { id },
      data: safeData,
    })
    return NextResponse.json({ ...driver, department: null, store: null, departmentId: null, storeId: null })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.etcDriver.update({ where: { id }, data: { isActive: false } })
  return NextResponse.json({ ok: true })
}

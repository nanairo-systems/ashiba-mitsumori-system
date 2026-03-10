import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  departmentId: z.string().optional().nullable(),
  storeId: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  note: z.string().optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const employee = await prisma.employee.update({
    where: { id },
    data: parsed.data,
    include: {
      department: { include: { company: true } },
      store: true,
    },
  })
  return NextResponse.json(employee)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // 開発者権限チェック
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 })

  const dbUser = await prisma.user.findUnique({
    where: { authId: user.id },
    select: { role: true },
  })
  if (dbUser?.role !== "DEVELOPER") {
    return NextResponse.json({ error: "開発者権限が必要です" }, { status: 403 })
  }

  // EtcDriverで使用中か確認
  const linkedDrivers = await prisma.etcDriver.count({ where: { employeeId: id } })
  if (linkedDrivers > 0) {
    return NextResponse.json(
      { error: `${linkedDrivers}件のETCドライバーに紐付いています。先にETCドライバーの紐付けを解除してください。` },
      { status: 400 }
    )
  }

  await prisma.employee.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

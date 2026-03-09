/**
 * [API] 経理 - 部門マスタ個別操作 PATCH /api/accounting/departments/[id]
 *
 * PATCH: 部門情報の更新（名前・表示順・有効フラグ）
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("、") },
      { status: 400 }
    )
  }

  const existing = await prisma.department.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "部門が見つかりません" }, { status: 404 })
  }

  const department = await prisma.department.update({
    where: { id },
    data: parsed.data,
    include: {
      company: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(department)
}

/**
 * [API] マスター項目 個別操作 (/api/master-items/[id])
 *
 * PATCH: 項目更新
 * DELETE: 項目無効化（論理削除）
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

const schema = z.object({
  name: z.string().min(1).optional(),
  categoryId: z.string().uuid().optional(),
  unitId: z.string().uuid().optional(),
  unitPrice: z.number().min(0).optional(),
  sortOrder: z.number().int().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const current = await prisma.masterItem.findUnique({ where: { id } })
  if (!current) {
    return NextResponse.json({ error: "項目が見つかりません" }, { status: 404 })
  }

  const checkName = parsed.data.name ?? current.name
  const checkCategoryId = parsed.data.categoryId ?? current.categoryId
  if (parsed.data.name || parsed.data.categoryId) {
    const dup = await prisma.masterItem.findFirst({
      where: { categoryId: checkCategoryId, name: checkName, id: { not: id } },
    })
    if (dup) {
      return NextResponse.json(
        { error: "同じカテゴリ内に同名の項目が存在します" },
        { status: 409 }
      )
    }
  }

  const item = await prisma.masterItem.update({
    where: { id },
    data: parsed.data,
    include: {
      unit: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
  })
  return NextResponse.json({ ...item, unitPrice: Number(item.unitPrice) })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await prisma.masterItem.update({
    where: { id },
    data: { isActive: false },
  })
  return NextResponse.json({ success: true })
}

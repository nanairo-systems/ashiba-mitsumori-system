/**
 * [API] 項目カテゴリ 個別操作 (/api/item-categories/[id])
 *
 * PATCH: カテゴリ更新
 * DELETE: カテゴリ無効化（論理削除）
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

const schema = z.object({
  name: z.string().min(1).optional(),
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

  if (parsed.data.name) {
    const existing = await prisma.itemCategory.findFirst({
      where: { name: parsed.data.name, id: { not: id } },
    })
    if (existing) {
      return NextResponse.json({ error: "同じカテゴリ名が存在します" }, { status: 409 })
    }
  }

  const category = await prisma.itemCategory.update({
    where: { id },
    data: parsed.data,
  })
  return NextResponse.json(category)
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
  await prisma.itemCategory.update({
    where: { id },
    data: { isActive: false },
  })
  return NextResponse.json({ success: true })
}

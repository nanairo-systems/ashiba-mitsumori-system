/**
 * [API] マスター項目 CRUD (/api/master-items)
 *
 * GET: 項目一覧取得
 * POST: 新規項目作成
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

const schema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1, "項目名は必須です"),
  unitId: z.string().uuid(),
  unitPrice: z.number().min(0),
  sortOrder: z.number().int().optional(),
})

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const items = await prisma.masterItem.findMany({
    where: { isActive: true, category: { isActive: true } },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    include: {
      unit: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
  })

  const serialized = items.map((item) => ({
    ...item,
    unitPrice: Number(item.unitPrice),
  }))

  return NextResponse.json(serialized)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const existing = await prisma.masterItem.findUnique({
    where: {
      categoryId_name: {
        categoryId: parsed.data.categoryId,
        name: parsed.data.name,
      },
    },
  })
  if (existing) {
    return NextResponse.json(
      { error: "同じカテゴリ内に同名の項目が存在します" },
      { status: 409 }
    )
  }

  const item = await prisma.masterItem.create({
    data: parsed.data,
    include: {
      unit: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(
    { ...item, unitPrice: Number(item.unitPrice) },
    { status: 201 }
  )
}

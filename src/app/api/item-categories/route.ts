/**
 * [API] 項目カテゴリ CRUD (/api/item-categories)
 *
 * GET: カテゴリ一覧取得（項目含む）
 * POST: 新規カテゴリ作成
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

const schema = z.object({
  name: z.string().min(1, "カテゴリ名は必須です"),
  sortOrder: z.number().int().optional(),
})

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const categories = await prisma.itemCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      items: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: { unit: { select: { id: true, name: true } } },
      },
    },
  })

  const serialized = categories.map((c) => ({
    ...c,
    items: c.items.map((item) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
    })),
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

  const existing = await prisma.itemCategory.findUnique({
    where: { name: parsed.data.name },
  })
  if (existing) {
    return NextResponse.json({ error: "同じカテゴリ名が存在します" }, { status: 409 })
  }

  const category = await prisma.itemCategory.create({ data: parsed.data })
  return NextResponse.json(category, { status: 201 })
}

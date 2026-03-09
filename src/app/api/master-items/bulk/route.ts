/**
 * [API] マスター項目一括取得（項目選択ダイアログ用）
 *
 * GET: カテゴリごとにグループ化した全項目を返す
 */
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const categories = await prisma.itemCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      items: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          unitId: true,
          unitPrice: true,
          unit: { select: { id: true, name: true } },
        },
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

  return NextResponse.json({ categories: serialized })
}

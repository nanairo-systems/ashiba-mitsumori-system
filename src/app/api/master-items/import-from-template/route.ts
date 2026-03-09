/**
 * [API] テンプレートから項目マスタへ一括インポート
 *
 * POST: テンプレートの全項目を指定カテゴリに取り込む
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

const schema = z.object({
  templateId: z.string().uuid(),
  categoryId: z.string().uuid(),
})

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

  const { templateId, categoryId } = parsed.data

  const category = await prisma.itemCategory.findUnique({
    where: { id: categoryId },
  })
  if (!category || !category.isActive) {
    return NextResponse.json({ error: "カテゴリが見つかりません" }, { status: 404 })
  }

  const template = await prisma.template.findUnique({
    where: { id: templateId },
    include: {
      sections: {
        include: {
          groups: {
            include: {
              items: true,
            },
          },
        },
      },
    },
  })
  if (!template) {
    return NextResponse.json({ error: "テンプレートが見つかりません" }, { status: 404 })
  }

  // テンプレートの全項目をフラット化
  const templateItems = template.sections.flatMap((s) =>
    s.groups.flatMap((g) => g.items)
  )

  // 既存の項目名を取得（重複チェック用）
  const existingItems = await prisma.masterItem.findMany({
    where: { categoryId, isActive: true },
    select: { name: true },
  })
  const existingNames = new Set(existingItems.map((i) => i.name))

  // 重複を除外してインポート
  const toImport = templateItems.filter((i) => !existingNames.has(i.name))
  const skipped = templateItems.filter((i) => existingNames.has(i.name))

  // 名前の重複を除外（テンプレート内に同名項目がある場合）
  const seen = new Set<string>()
  const uniqueToImport = toImport.filter((i) => {
    if (seen.has(i.name)) return false
    seen.add(i.name)
    return true
  })

  if (uniqueToImport.length > 0) {
    const maxSort = await prisma.masterItem.aggregate({
      where: { categoryId },
      _max: { sortOrder: true },
    })
    const startOrder = (maxSort._max.sortOrder ?? 0) + 1

    await prisma.masterItem.createMany({
      data: uniqueToImport.map((item, i) => ({
        categoryId,
        name: item.name,
        unitId: item.unitId,
        unitPrice: item.unitPrice,
        sortOrder: startOrder + i,
      })),
    })
  }

  return NextResponse.json({
    imported: uniqueToImport.length,
    skipped: skipped.length,
    skippedNames: skipped.map((i) => i.name),
  })
}

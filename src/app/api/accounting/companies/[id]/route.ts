/**
 * [API] 経理 - 会社マスタ個別操作 PATCH /api/accounting/companies/[id]
 *
 * PATCH: 会社情報の更新（名前・カラーコード・表示順・有効フラグ）
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  colorCode: z.string().max(20).nullable().optional(),
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

  const existing = await prisma.accountingCompany.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "会社が見つかりません" }, { status: 404 })
  }

  const company = await prisma.accountingCompany.update({
    where: { id },
    data: parsed.data,
  })

  return NextResponse.json(company)
}

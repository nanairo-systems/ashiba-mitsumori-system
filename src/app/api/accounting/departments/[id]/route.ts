/**
 * [API] 経理 - 部門マスタ個別操作
 *
 * PATCH: 部門情報の更新（名前・表示順・有効フラグ）
 * DELETE: 部門の完全削除（DEVELOPER権限のみ）
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // DEVELOPER権限チェック
  const dbUser = await prisma.user.findUnique({
    where: { authId: user.id },
    select: { role: true },
  })
  if (dbUser?.role !== "DEVELOPER") {
    return NextResponse.json({ error: "開発者権限が必要です" }, { status: 403 })
  }

  const { id } = await params

  const existing = await prisma.department.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "部門が見つかりません" }, { status: 404 })
  }

  // 関連データの存在チェック
  const relatedStores = await prisma.store.count({ where: { departmentId: id } })
  if (relatedStores > 0) {
    return NextResponse.json(
      { error: `この部門には${relatedStores}件の店舗が紐付いています。先に店舗を削除してください。` },
      { status: 409 }
    )
  }

  await prisma.department.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

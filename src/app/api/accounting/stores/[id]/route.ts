/**
 * [API] 経理 - 店舗マスタ個別操作
 *
 * PATCH: 店舗情報の更新（名前・表示順・有効フラグ）
 * DELETE: 店舗の完全削除（DEVELOPER権限のみ）
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

  const existing = await prisma.store.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "店舗が見つかりません" }, { status: 404 })
  }

  const store = await prisma.store.update({
    where: { id },
    data: parsed.data,
    include: {
      department: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(store)
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

  const existing = await prisma.store.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "店舗が見つかりません" }, { status: 404 })
  }

  await prisma.store.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

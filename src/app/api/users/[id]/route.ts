/**
 * [API] ユーザー個別操作
 *
 * PATCH /api/users/[id] - ロール・有効/無効の更新（ADMIN のみ）
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const patchSchema = z.object({
  role: z.enum(["ADMIN", "STAFF"]).optional(),
  isActive: z.boolean().optional(),
})

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } })
  if (!dbUser || dbUser.role !== "ADMIN") return null
  return dbUser
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // 自分自身の権限を下げることを防止
  if (id === admin.id && parsed.data.role === "STAFF") {
    return NextResponse.json({ error: "自分自身の管理者権限を削除できません" }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id },
    data: parsed.data,
  })

  return NextResponse.json(user)
}

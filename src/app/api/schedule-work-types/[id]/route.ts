/**
 * [API] 工種マスター PATCH/DELETE - /api/schedule-work-types/:id
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const patchSchema = z.object({
  label: z.string().min(1).max(50).optional(),
  shortLabel: z.string().min(1).max(5).optional(),
  colorIndex: z.number().int().min(0).max(9).optional(),
  sortOrder: z.number().int().min(0).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const existing = await prisma.scheduleWorkTypeMaster.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 })

  const updated = await prisma.scheduleWorkTypeMaster.update({
    where: { id },
    data: parsed.data,
  })
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const existing = await prisma.scheduleWorkTypeMaster.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // デフォルト工種は削除不可
  if (existing.isDefault) {
    return NextResponse.json({ error: "デフォルト工種は削除できません" }, { status: 400 })
  }

  // 使用中かチェック
  const usageCount = await prisma.constructionSchedule.count({
    where: { workType: existing.code },
  })

  if (usageCount > 0) {
    // ソフトデリート
    await prisma.scheduleWorkTypeMaster.update({
      where: { id },
      data: { isActive: false },
    })
    return NextResponse.json({ ok: true, softDeleted: true })
  }

  // 未使用なら物理削除
  await prisma.scheduleWorkTypeMaster.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

/**
 * [API] 班マスタ - PUT/DELETE /api/teams/[id]
 *
 * PUT: 班情報を更新
 * DELETE: isActive=false に変更（論理削除）
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  teamType: z.enum(["INDIVIDUAL", "COMPANY"]).optional(),
  leaderId: z.string().nullable().optional(),
  subcontractorId: z.string().nullable().optional(),
  colorCode: z.string().max(20).nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

export async function PUT(
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
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("、") }, { status: 400 })
  }

  const team = await prisma.team.update({
    where: { id },
    data: parsed.data,
    include: {
      workers: true,
      subcontractors: true,
    },
  })

  return NextResponse.json(team)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const team = await prisma.team.update({
    where: { id },
    data: { isActive: false },
  })

  return NextResponse.json(team)
}

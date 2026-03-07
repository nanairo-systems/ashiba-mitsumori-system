/**
 * [API] 班詳細 - GET/PUT/DELETE /api/teams/:id
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateSchema = z.object({
  name: z.string().min(1, "班名は必須です").optional(),
  teamType: z.enum(["INDIVIDUAL", "COMPANY"]).optional(),
  leaderId: z.string().nullable().optional(),
  subcontractorId: z.string().nullable().optional(),
  colorCode: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      leader: { select: { id: true, name: true } },
      subcontractor: { select: { id: true, name: true } },
    },
  })
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(team)
}

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
    const msg = parsed.error.issues.map((i) => i.message).join("、")
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const team = await prisma.team.findUnique({ where: { id } })
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const d = parsed.data
  const teamType = d.teamType ?? team.teamType

  const updated = await prisma.team.update({
    where: { id },
    data: {
      ...d,
      leaderId: teamType === "INDIVIDUAL" ? (d.leaderId !== undefined ? d.leaderId : team.leaderId) : null,
      subcontractorId: teamType === "COMPANY" ? (d.subcontractorId !== undefined ? d.subcontractorId : team.subcontractorId) : null,
    },
    include: {
      leader: { select: { id: true, name: true } },
      subcontractor: { select: { id: true, name: true } },
    },
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
  const team = await prisma.team.findUnique({ where: { id } })
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // 物理削除せず isActive=false に変更
  const updated = await prisma.team.update({
    where: { id },
    data: { isActive: false },
  })

  return NextResponse.json(updated)
}

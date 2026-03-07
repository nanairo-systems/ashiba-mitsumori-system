/**
 * [API] 班マスター - GET/POST /api/teams
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  name: z.string().min(1, "班名は必須です"),
  teamType: z.enum(["INDIVIDUAL", "COMPANY"]),
  leaderId: z.string().nullable().optional(),
  subcontractorId: z.string().nullable().optional(),
  colorCode: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
})

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const isActive = searchParams.get("isActive")

  const where: Record<string, unknown> = {}
  if (isActive === "true") where.isActive = true
  else if (isActive === "false") where.isActive = false

  const teams = await prisma.team.findMany({
    where,
    include: {
      leader: { select: { id: true, name: true } },
      subcontractor: { select: { id: true, name: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })

  return NextResponse.json(teams)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("、")
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const d = parsed.data

  // sortOrder 未指定の場合は末尾に追加
  let sortOrder = d.sortOrder ?? 0
  if (!d.sortOrder && d.sortOrder !== 0) {
    const maxTeam = await prisma.team.findFirst({ orderBy: { sortOrder: "desc" } })
    sortOrder = (maxTeam?.sortOrder ?? 0) + 1
  }

  const team = await prisma.team.create({
    data: {
      name: d.name,
      teamType: d.teamType,
      leaderId: d.teamType === "INDIVIDUAL" ? (d.leaderId ?? null) : null,
      subcontractorId: d.teamType === "COMPANY" ? (d.subcontractorId ?? null) : null,
      colorCode: d.colorCode ?? null,
      sortOrder,
    },
    include: {
      leader: { select: { id: true, name: true } },
      subcontractor: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(team, { status: 201 })
}

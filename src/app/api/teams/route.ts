/**
 * [API] 班マスタ - GET/POST /api/teams
 *
 * GET: 班一覧（?isActive=）リーダー・外注先情報もinclude
 * POST: 班新規作成
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  name: z.string().min(1, "班名は必須です").max(100),
  teamType: z.enum(["INDIVIDUAL", "COMPANY"]),
  leaderId: z.string().nullable().optional(),
  subcontractorId: z.string().nullable().optional(),
  colorCode: z.string().max(20).nullable().optional(),
  sortOrder: z.number().int().default(0),
})

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const isActive = req.nextUrl.searchParams.get("isActive")

  const teams = await prisma.team.findMany({
    where: isActive === "true" ? { isActive: true } : isActive === "false" ? { isActive: false } : undefined,
    include: {
      workers: { select: { id: true, name: true } },
      subcontractors: { select: { id: true, name: true } },
    },
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }],
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
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("、") }, { status: 400 })
  }

  const d = parsed.data
  const team = await prisma.team.create({
    data: {
      name: d.name,
      teamType: d.teamType,
      leaderId: d.leaderId ?? null,
      subcontractorId: d.subcontractorId ?? null,
      colorCode: d.colorCode ?? null,
      sortOrder: d.sortOrder,
    },
    include: {
      workers: { select: { id: true, name: true } },
      subcontractors: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(team, { status: 201 })
}

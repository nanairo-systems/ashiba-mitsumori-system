/**
 * [API] 作業内容 - GET/POST /api/work-contents
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get("projectId")
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 })

  const workContents = await prisma.workContent.findMany({
    where: { projectId },
    include: {
      schedules: {
        orderBy: [{ plannedStartDate: "asc" }, { workType: "asc" }],
      },
    },
    orderBy: { sortOrder: "asc" },
  })

  return NextResponse.json(workContents)
}

const postSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(100),
  notes: z.string().nullable().optional(),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 })

  const { projectId, name, notes } = parsed.data

  // sortOrder: 既存の最大値 + 1
  const maxSort = await prisma.workContent.aggregate({
    where: { projectId },
    _max: { sortOrder: true },
  })

  const workContent = await prisma.workContent.create({
    data: {
      projectId,
      name,
      notes: notes ?? null,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
    include: { schedules: true },
  })

  return NextResponse.json(workContent, { status: 201 })
}

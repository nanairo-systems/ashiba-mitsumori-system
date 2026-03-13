/**
 * [API] 工期スケジュール CRUD - GET/POST /api/contracts/:id/schedules
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  workType: z.string().min(1),
  estimateId: z.string().nullable().optional(),
  name: z.string().max(100).nullable().optional(),
  plannedStartDate: z.string().nullable().optional(),
  plannedEndDate: z.string().nullable().optional(),
  actualStartDate: z.string().nullable().optional(),
  actualEndDate: z.string().nullable().optional(),
  workersCount: z.number().int().positive().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const schedules = await prisma.constructionSchedule.findMany({
    where: { contractId: id },
    orderBy: [{ workType: "asc" }, { plannedStartDate: "asc" }],
  })
  return NextResponse.json(schedules)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const contract = await prisma.contract.findUnique({ where: { id } })
  if (!contract) return NextResponse.json({ error: "契約が見つかりません" }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("、")
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const d = parsed.data
  const schedule = await prisma.constructionSchedule.create({
    data: {
      projectId: contract.projectId,
      contractId: id,
      estimateId: d.estimateId ?? null,
      workType: d.workType,
      name: d.name ?? null,
      plannedStartDate: d.plannedStartDate ? new Date(d.plannedStartDate) : null,
      plannedEndDate: d.plannedEndDate ? new Date(d.plannedEndDate) : null,
      actualStartDate: d.actualStartDate ? new Date(d.actualStartDate) : null,
      actualEndDate: d.actualEndDate ? new Date(d.actualEndDate) : null,
      workersCount: d.workersCount ?? null,
      notes: d.notes ?? null,
    },
  })

  return NextResponse.json(schedule, { status: 201 })
}

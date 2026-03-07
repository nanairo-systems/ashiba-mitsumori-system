/**
 * [API] 人員配置 CRUD - GET/POST /api/worker-assignments
 *
 * GET: 指定期間内の人員配置一覧取得
 *   クエリパラメータ: startDate, endDate
 * POST: 人員配置新規作成
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  scheduleId: z.string().min(1),
  teamId: z.string().min(1),
  workerId: z.string().nullable().optional(),
  vehicleId: z.string().nullable().optional(),
  assignedRole: z.enum(["FOREMAN", "WORKER"]).default("WORKER"),
  sortOrder: z.number().int().default(0),
  note: z.string().max(500).nullable().optional(),
})

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const startDate = req.nextUrl.searchParams.get("startDate")
  const endDate = req.nextUrl.searchParams.get("endDate")

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate と endDate は必須です" }, { status: 400 })
  }

  const assignments = await prisma.workerAssignment.findMany({
    where: {
      schedule: {
        OR: [
          {
            plannedStartDate: { lte: new Date(endDate) },
            plannedEndDate: { gte: new Date(startDate) },
          },
          {
            actualStartDate: { lte: new Date(endDate) },
            actualEndDate: { gte: new Date(startDate) },
          },
        ],
      },
    },
    include: {
      team: true,
      worker: true,
      vehicle: true,
      schedule: {
        include: {
          contract: {
            include: {
              project: {
                include: {
                  branch: { include: { company: { select: { id: true, name: true } } } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ teamId: "asc" }, { sortOrder: "asc" }],
  })

  return NextResponse.json(assignments)
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
  const assignment = await prisma.workerAssignment.create({
    data: {
      scheduleId: d.scheduleId,
      teamId: d.teamId,
      workerId: d.workerId ?? null,
      vehicleId: d.vehicleId ?? null,
      assignedRole: d.assignedRole,
      sortOrder: d.sortOrder,
      note: d.note ?? null,
    },
    include: {
      team: true,
      worker: true,
      vehicle: true,
      schedule: true,
    },
  })

  return NextResponse.json(assignment, { status: 201 })
}

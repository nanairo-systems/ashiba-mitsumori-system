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
  assignedDate: z.string().nullable().optional(),
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

  const startDateObj = new Date(startDate)
  const endDateObj = new Date(endDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const overflowSelect = {
    id: true,
    name: true,
    plannedStartDate: true,
    plannedEndDate: true,
    workType: true,
    project: { select: { name: true } },
  } as const

  // メインデータ取得（Session Poolerの接続数制限のため順次実行）
  const assignments = await prisma.workerAssignment.findMany({
    where: {
      schedule: {
        OR: [
          {
            plannedStartDate: { lte: endDateObj },
            plannedEndDate: { gte: startDateObj },
          },
          {
            actualStartDate: { lte: endDateObj },
            actualEndDate: { gte: startDateObj },
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
          project: {
            include: {
              branch: { include: { company: { select: { id: true, name: true } } } },
              contact: { select: { id: true, name: true, phone: true, email: true } },
            },
          },
          contract: {
            select: {
              id: true,
              contractNumber: true,
              contractAmount: true,
              totalAmount: true,
            },
          },
          estimate: {
            select: {
              id: true,
              estimateNumber: true,
              title: true,
            },
          },
        },
      },
    },
    orderBy: [{ teamId: "asc" }, { sortOrder: "asc" }],
  })

  // オーバーフロー（配置済みで表示範囲外の工程）を取得
  // constructionScheduleから直接取得（旧: workerAssignment経由の4クエリ→2クエリに統合）
  const leftItems = await prisma.constructionSchedule.findMany({
    where: {
      plannedEndDate: { lt: startDateObj },
      plannedStartDate: { gte: today, not: null },
      workerAssignments: { some: {} },
    },
    orderBy: { plannedStartDate: "desc" },
    select: overflowSelect,
  })

  const rightItems = await prisma.constructionSchedule.findMany({
    where: {
      plannedStartDate: { gt: endDateObj, not: null },
      workerAssignments: { some: {} },
    },
    orderBy: { plannedStartDate: "asc" },
    select: overflowSelect,
  })

  return NextResponse.json({
    assignments,
    overflow: {
      left: { count: leftItems.length, items: leftItems },
      right: { count: rightItems.length, items: rightItems },
    },
  })
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
  const assignedDateObj = d.assignedDate ? new Date(`${d.assignedDate}T00:00:00Z`) : null
  const assignment = await prisma.workerAssignment.create({
    data: {
      scheduleId: d.scheduleId,
      teamId: d.teamId,
      workerId: d.workerId ?? null,
      vehicleId: d.vehicleId ?? null,
      assignedRole: d.assignedRole,
      assignedDate: assignedDateObj,
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

/**
 * [API] 工事日程 - GET/POST /api/schedules
 *
 * GET: 全工事日程を現場情報とともに返す。
 * POST: 現場に紐づく ConstructionSchedule を作成する。
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

/** 工事日程の共通 include（project を直接参照） */
const scheduleInclude = {
  _count: { select: { workerAssignments: true } },
  workContent: { select: { id: true, name: true, sortOrder: true } },
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
} as const

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get("projectId")
  const scheduleId = searchParams.get("scheduleId")

  const schedules = await prisma.constructionSchedule.findMany({
    where: scheduleId
      ? { id: scheduleId }
      : projectId
      ? { projectId }
      : undefined,
    include: scheduleInclude,
    orderBy: [{ plannedStartDate: "asc" }, { workType: "asc" }],
  })

  return NextResponse.json(schedules)
}

const postSchema = z.object({
  projectId: z.string().min(1, "現場IDが必要です"),
  estimateId: z.string().nullable().optional(),
  workContentId: z.string().min(1, "作業内容IDが必要です"),
  workType: z.string().min(1, "工事名を入力してください"),
  name: z.string().max(100).nullable().optional(),
  plannedStartDate: z.string().nullable().optional(),
  plannedEndDate: z.string().nullable().optional(),
  contractAmount: z.number().min(0).nullable().optional(),
  teamIds: z.array(z.string()).optional(),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("、")
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const d = parsed.data

  try {
    const result = await prisma.$transaction(async (tx) => {
      // ConstructionSchedule を作成（Contract なし・Project に直接紐づけ）
      const schedule = await tx.constructionSchedule.create({
        data: {
          projectId: d.projectId,
          estimateId: d.estimateId ?? null,
          workContentId: d.workContentId,
          workType: d.workType,
          name: d.name ?? null,
          plannedStartDate: d.plannedStartDate ? new Date(d.plannedStartDate) : null,
          plannedEndDate: d.plannedEndDate ? new Date(d.plannedEndDate) : null,
        },
        include: scheduleInclude,
      })

      // 班アサインを作成（指定された場合）
      if (d.teamIds && d.teamIds.length > 0) {
        await tx.workerAssignment.createMany({
          data: d.teamIds.map((teamId, idx) => ({
            scheduleId: schedule.id,
            teamId,
            assignedRole: "WORKER" as const,
            sortOrder: idx,
          })),
        })
      }

      return schedule
    })

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error("[POST /api/schedules] error:", err)
    return NextResponse.json({ error: "工事日程の作成に失敗しました" }, { status: 500 })
  }
}

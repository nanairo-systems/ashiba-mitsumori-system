/**
 * [API] 工期スケジュール - GET/POST /api/schedules
 *
 * GET: 全契約のスケジュールを契約・現場情報とともに返す。
 * POST: 現場に紐づく Contract + ConstructionSchedule を一括作成する。
 *       人員配置画面からの現場（工程）追加用。
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // projectId が指定された場合、そのプロジェクトに属するスケジュールのみ返す
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get("projectId")

  const schedules = await prisma.constructionSchedule.findMany({
    where: projectId
      ? { contract: { projectId } }
      : undefined,
    include: {
      _count: { select: { workerAssignments: true } },
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
    orderBy: [{ plannedStartDate: "asc" }, { workType: "asc" }],
  })

  return NextResponse.json(schedules)
}

const postSchema = z.object({
  projectId: z.string().min(1, "現場IDが必要です"),
  workType: z.string().min(1, "工事名を入力してください"),
  name: z.string().max(100).nullable().optional(),
  plannedStartDate: z.string().min(1, "開始日を入力してください"),
  plannedEndDate: z.string().min(1, "終了日を入力してください"),
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
  const taxRate = 0.1
  const contractAmount = d.contractAmount ?? 0
  const taxAmount = Math.floor(contractAmount * taxRate)
  const totalAmount = contractAmount + taxAmount

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Contract を作成
      const contract = await tx.contract.create({
        data: {
          projectId: d.projectId,
          contractAmount,
          taxAmount,
          totalAmount,
          contractDate: new Date(),
          startDate: new Date(d.plannedStartDate),
          endDate: new Date(d.plannedEndDate),
          name: d.workType,
          status: "CONTRACTED",
        },
      })

      // 2. ConstructionSchedule を作成
      const schedule = await tx.constructionSchedule.create({
        data: {
          contractId: contract.id,
          workType: d.workType,
          name: d.name ?? null,
          plannedStartDate: new Date(d.plannedStartDate),
          plannedEndDate: new Date(d.plannedEndDate),
        },
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
      })

      // 3. 班アサインを作成（指定された場合）
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
    return NextResponse.json({ error: "工程の作成に失敗しました" }, { status: 500 })
  }
}

/**
 * [API] 人員配置 一括登録 - POST /api/worker-assignments/bulk
 *
 * 複数の職人を一括でアサインする。
 * assignedRole は各職人の defaultRole を使用。
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const bulkSchema = z.object({
  scheduleId: z.string().min(1),
  teamId: z.string().min(1),
  workerIds: z.array(z.string().min(1)).min(1),
  assignedDate: z.string().nullable().optional(), // "YYYY-MM-DD" or null
  forceRole: z.enum(["FOREMAN", "WORKER"]).optional(), // 役割を強制指定
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = bulkSchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("、")
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const { scheduleId, teamId, workerIds, assignedDate, forceRole } = parsed.data
  const assignedDateObj = assignedDate ? new Date(`${assignedDate}T00:00:00Z`) : null

  // 上限チェック（職長含む合計9名まで）
  const currentCount = await prisma.workerAssignment.count({
    where: { scheduleId, teamId, workerId: { not: null } },
  })
  const MAX_TOTAL = 9
  if (currentCount + workerIds.length > MAX_TOTAL) {
    return NextResponse.json(
      { error: `上限${MAX_TOTAL}名を超えます（現在${currentCount}名、追加${workerIds.length}名）`, code: "WORKER_LIMIT_EXCEEDED" },
      { status: 400 }
    )
  }

  const workers = await prisma.worker.findMany({
    where: { id: { in: workerIds } },
    select: { id: true, defaultRole: true },
  })

  const workerMap = new Map(workers.map((w) => [w.id, w.defaultRole]))

  const maxSort = await prisma.workerAssignment.aggregate({
    where: { scheduleId, teamId },
    _max: { sortOrder: true },
  })
  let nextSort = (maxSort._max.sortOrder ?? -1) + 1

  const assignments = await prisma.$transaction(
    workerIds
      .filter((wid) => workerMap.has(wid))
      .map((wid) =>
        prisma.workerAssignment.create({
          data: {
            scheduleId,
            teamId,
            workerId: wid,
            assignedRole: forceRole ?? workerMap.get(wid)!,
            assignedDate: assignedDateObj,
            sortOrder: nextSort++,
          },
          include: { team: true, worker: true, vehicle: true, schedule: true },
        })
      )
  )

  return NextResponse.json(assignments, { status: 201 })
}

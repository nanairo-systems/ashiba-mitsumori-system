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

  try {
    // 上限チェック + 作成をトランザクションで原子的に実行
    const assignments = await prisma.$transaction(async (tx) => {
      // Session Poolerの接続数制限のため順次実行
      const currentCount = await tx.workerAssignment.count({
        where: { scheduleId, teamId, workerId: { not: null } },
      })
      const workers = await tx.worker.findMany({
        where: { id: { in: workerIds } },
        select: { id: true, defaultRole: true },
      })
      const maxSort = await tx.workerAssignment.aggregate({
        where: { scheduleId, teamId },
        _max: { sortOrder: true },
      })

      const MAX_TOTAL = 9
      if (currentCount + workerIds.length > MAX_TOTAL) {
        throw new Error(
          `LIMIT:上限${MAX_TOTAL}名を超えます（現在${currentCount}名、追加${workerIds.length}名）`
        )
      }

      const workerMap = new Map(workers.map((w) => [w.id, w.defaultRole]))
      let nextSort = (maxSort._max.sortOrder ?? -1) + 1

      const results = []
      for (const wid of workerIds) {
        if (!workerMap.has(wid)) continue
        const created = await tx.workerAssignment.create({
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
        results.push(created)
      }
      return results
    })

    return NextResponse.json(assignments, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("LIMIT:")) {
      return NextResponse.json(
        { error: err.message.slice(6), code: "WORKER_LIMIT_EXCEEDED" },
        { status: 400 }
      )
    }
    throw err
  }
}

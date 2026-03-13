/**
 * [API] 職人移動エンドポイント
 *
 * 「この日だけ移動」または「全日程から外す」を処理する。
 * トランザクションで原子性を保証。
 *
 * POST /api/worker-assignments/move-worker
 * body: { assignmentId, targetTeamId, targetScheduleId, moveDate, moveType }
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"

const moveSchema = z.object({
  assignmentId: z.string().min(1),
  targetTeamId: z.string().min(1),
  targetScheduleId: z.string().min(1),
  moveDate: z.string().min(1), // YYYY-MM-DD
  moveType: z.enum(["day-only", "all"]),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = moveSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 })
    }

    const { assignmentId, targetTeamId, targetScheduleId, moveDate, moveType } = parsed.data
    const moveDateObj = new Date(`${moveDate}T00:00:00Z`)

    const result = await prisma.$transaction(async (tx) => {
      // 移動先の上限チェック（職長含む合計9名まで）
      const targetCount = await tx.workerAssignment.count({
        where: { scheduleId: targetScheduleId, teamId: targetTeamId, workerId: { not: null } },
      })
      if (targetCount >= 9) {
        throw new Error("WORKER_LIMIT_EXCEEDED")
      }

      const assignment = await tx.workerAssignment.findUnique({
        where: { id: assignmentId },
      })

      if (!assignment) {
        throw new Error("NOT_FOUND")
      }

      if (moveType === "all") {
        // 全日程から外して移動: 単純に scheduleId と teamId を更新
        return tx.workerAssignment.update({
          where: { id: assignmentId },
          data: {
            scheduleId: targetScheduleId,
            teamId: targetTeamId,
            assignedDate: null,
            excludedDates: [],
          },
        })
      }

      // === この日だけ移動 ===
      // 1. 元のアサインに excludedDate を追加
      const currentExcluded = assignment.excludedDates ?? []
      await tx.workerAssignment.update({
        where: { id: assignmentId },
        data: {
          excludedDates: [...(currentExcluded as Date[]), moveDateObj],
        },
      })

      // 2. 移動先に日付指定のアサインを作成
      return tx.workerAssignment.create({
        data: {
          scheduleId: targetScheduleId,
          teamId: targetTeamId,
          workerId: assignment.workerId,
          vehicleId: assignment.vehicleId,
          assignedRole: assignment.assignedRole,
          assignedDate: moveDateObj,
          sortOrder: 0,
        },
      })
    })

    return NextResponse.json(result, { status: moveType === "day-only" ? 201 : 200 })
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "WORKER_LIMIT_EXCEEDED") {
        return NextResponse.json(
          { error: "移動先の班は上限9名に達しています", code: "WORKER_LIMIT_EXCEEDED" },
          { status: 400 }
        )
      }
      if (err.message === "NOT_FOUND") {
        return NextResponse.json({ error: "アサインが見つかりません" }, { status: 404 })
      }
    }
    console.error("[move-worker] Error:", err)
    return NextResponse.json({ error: "移動に失敗しました" }, { status: 500 })
  }
}

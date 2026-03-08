/**
 * [API] 職人移動エンドポイント
 *
 * 「この日だけ移動」または「全日程から外す」を処理する。
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

    const assignment = await prisma.workerAssignment.findUnique({
      where: { id: assignmentId },
      include: { schedule: true },
    })

    if (!assignment) {
      return NextResponse.json({ error: "アサインが見つかりません" }, { status: 404 })
    }

    const moveDateObj = new Date(`${moveDate}T00:00:00Z`)

    if (moveType === "all") {
      // 全日程から外して移動: 単純に scheduleId と teamId を更新
      const updated = await prisma.workerAssignment.update({
        where: { id: assignmentId },
        data: {
          scheduleId: targetScheduleId,
          teamId: targetTeamId,
          assignedDate: null,
          excludedDates: [],
        },
      })
      return NextResponse.json(updated)
    }

    // === この日だけ移動 ===

    // 1. 元のアサインに excludedDate を追加
    const currentExcluded = assignment.excludedDates ?? []
    await prisma.workerAssignment.update({
      where: { id: assignmentId },
      data: {
        excludedDates: [...currentExcluded, moveDateObj],
      },
    })

    // 2. 移動先に日付指定のアサインを作成
    const newAssignment = await prisma.workerAssignment.create({
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

    return NextResponse.json(newAssignment, { status: 201 })
  } catch (err) {
    console.error("[move-worker] Error:", err)
    return NextResponse.json({ error: "移動に失敗しました" }, { status: 500 })
  }
}

/**
 * [API] 現場スワップエンドポイント
 *
 * 2つのチーム間で現場（schedule）を入れ替える。
 * 職人・車両は元のチームに残り、現場情報のみ入れ替わる。
 *
 * POST /api/worker-assignments/swap-sites
 * body: { groupA: { assignmentIds, scheduleId }, groupB: { assignmentIds, scheduleId } }
 */
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"

const swapSchema = z.object({
  groupA: z.object({
    assignmentIds: z.array(z.string()),
    scheduleId: z.string(),
  }),
  groupB: z.object({
    assignmentIds: z.array(z.string()),
    scheduleId: z.string(),
  }),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = swapSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 })
    }

    const { groupA, groupB } = parsed.data

    // トランザクションで一括更新
    await prisma.$transaction([
      // グループA のアサインを グループB の scheduleId に変更
      ...groupA.assignmentIds.map((id) =>
        prisma.workerAssignment.update({
          where: { id },
          data: { scheduleId: groupB.scheduleId },
        })
      ),
      // グループB のアサインを グループA の scheduleId に変更
      ...groupB.assignmentIds.map((id) =>
        prisma.workerAssignment.update({
          where: { id },
          data: { scheduleId: groupA.scheduleId },
        })
      ),
    ])

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[swap-sites] Error:", err)
    return NextResponse.json({ error: "入替に失敗しました" }, { status: 500 })
  }
}

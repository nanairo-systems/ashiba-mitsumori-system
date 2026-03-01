/**
 * [API] 全工期スケジュール取得 - GET /api/schedules
 *
 * 工期管理ページ用。全契約のスケジュールを契約・現場情報とともに返す。
 * クエリパラメータ: year, month（任意 - フィルタ用）
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const schedules = await prisma.constructionSchedule.findMany({
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
    orderBy: [{ plannedStartDate: "asc" }, { workType: "asc" }],
  })

  return NextResponse.json(schedules)
}

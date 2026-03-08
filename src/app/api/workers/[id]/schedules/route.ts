/**
 * [API] 職人別スケジュール - GET /api/workers/[id]/schedules
 *
 * 指定職人の指定月のアサイン一覧を取得。
 * クエリ: ?year=2026&month=3
 * 工程・班・現場情報をincludeして返す。
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const url = new URL(req.url)
  const yearStr = url.searchParams.get("year")
  const monthStr = url.searchParams.get("month")

  if (!yearStr || !monthStr) {
    return NextResponse.json({ error: "year と month は必須です" }, { status: 400 })
  }

  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "year/month が不正です" }, { status: 400 })
  }

  const startOfMonth = new Date(year, month - 1, 1)
  const endOfMonth = new Date(year, month, 0) // 月末日

  const assignments = await prisma.workerAssignment.findMany({
    where: {
      workerId: id,
      schedule: {
        OR: [
          {
            plannedStartDate: { lte: endOfMonth },
            plannedEndDate: { gte: startOfMonth },
          },
          {
            plannedStartDate: { lte: endOfMonth },
            plannedEndDate: null,
            // 開始日が月末以前なら対象
          },
        ],
      },
    },
    include: {
      team: true,
      schedule: {
        include: {
          contract: {
            include: {
              project: {
                include: {
                  branch: {
                    include: {
                      company: { select: { id: true, name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { schedule: { plannedStartDate: "asc" } },
  })

  return NextResponse.json(assignments)
}

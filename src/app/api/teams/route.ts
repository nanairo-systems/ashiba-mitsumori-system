/**
 * [API] 班一覧取得 - GET /api/teams
 *
 * クエリパラメータ: isActive=true で有効な班のみ取得
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const isActive = req.nextUrl.searchParams.get("isActive")

  const teams = await prisma.team.findMany({
    where: isActive === "true" ? { isActive: true } : undefined,
    include: {
      workers: true,
    },
    orderBy: { sortOrder: "asc" },
  })

  return NextResponse.json(teams)
}

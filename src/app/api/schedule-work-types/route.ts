/**
 * [API] 工種マスター - GET/POST /api/schedule-work-types
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  label: z.string().min(1).max(50),
  shortLabel: z.string().min(1).max(5),
  colorIndex: z.number().int().min(0).max(9),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const workTypes = await prisma.scheduleWorkTypeMaster.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  })
  return NextResponse.json(workTypes)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join("、") }, { status: 400 })
  }

  const d = parsed.data

  // 次の sortOrder を取得
  const maxSort = await prisma.scheduleWorkTypeMaster.aggregate({ _max: { sortOrder: true } })
  const nextSort = (maxSort._max.sortOrder ?? -1) + 1

  // code を自動生成（label からアルファベット大文字化、重複時はサフィックス）
  let baseCode = d.label.toUpperCase().replace(/[^A-Z0-9\u3040-\u9FFF]/g, "")
  if (!baseCode) baseCode = `WT${nextSort}`
  let code = baseCode
  let suffix = 2
  while (await prisma.scheduleWorkTypeMaster.findUnique({ where: { code } })) {
    code = `${baseCode}_${suffix}`
    suffix++
  }

  const workType = await prisma.scheduleWorkTypeMaster.create({
    data: {
      code,
      label: d.label,
      shortLabel: d.shortLabel,
      colorIndex: d.colorIndex,
      sortOrder: nextSort,
      isDefault: false,
    },
  })

  return NextResponse.json(workType, { status: 201 })
}

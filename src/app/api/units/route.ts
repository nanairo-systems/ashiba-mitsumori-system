/**
 * [API] 単位マスター CRUD (/api/units)
 *
 * POST: 新規単位登録
 * GET: 単位一覧取得
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

const schema = z.object({
  name: z.string().min(1, "単位名は必須です"),
  sortOrder: z.number().int().optional(),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const existing = await prisma.unit.findUnique({
    where: { name: parsed.data.name },
  })
  if (existing) {
    return NextResponse.json({ error: "同じ単位名が存在します" }, { status: 409 })
  }

  const unit = await prisma.unit.create({ data: parsed.data })
  return NextResponse.json(unit, { status: 201 })
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const units = await prisma.unit.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  })

  return NextResponse.json(units)
}

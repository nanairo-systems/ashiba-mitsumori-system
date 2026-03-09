/**
 * [API] 経理 - 会社マスタ GET/POST /api/accounting/companies
 *
 * GET: 会社一覧取得（isActive=trueのみ・sortOrder順）
 * POST: 会社新規作成
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  name: z.string().min(1, "会社名は必須です").max(100),
  colorCode: z.string().max(20).nullable().optional(),
  sortOrder: z.number().int().optional(),
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const companies = await prisma.accountingCompany.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  })

  return NextResponse.json(companies)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("、") }, { status: 400 })
  }

  const d = parsed.data
  const company = await prisma.accountingCompany.create({
    data: {
      name: d.name,
      colorCode: d.colorCode ?? null,
      sortOrder: d.sortOrder ?? 0,
    },
  })

  return NextResponse.json(company, { status: 201 })
}

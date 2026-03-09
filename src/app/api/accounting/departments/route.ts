/**
 * [API] 経理 - 部門マスタ GET/POST /api/accounting/departments
 *
 * GET: 部門一覧取得（?companyId=）
 * POST: 部門新規作成
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import type { Prisma } from "@prisma/client"

const createSchema = z.object({
  companyId: z.string().min(1, "会社IDは必須です"),
  name: z.string().min(1, "部門名は必須です").max(100),
  sortOrder: z.number().int().optional(),
})

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const companyId = req.nextUrl.searchParams.get("companyId")

  const where: Prisma.DepartmentWhereInput = { isActive: true }
  if (companyId) where.companyId = companyId

  const departments = await prisma.department.findMany({
    where,
    include: {
      company: { select: { id: true, name: true } },
    },
    orderBy: { sortOrder: "asc" },
  })

  return NextResponse.json(departments)
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
  const department = await prisma.department.create({
    data: {
      companyId: d.companyId,
      name: d.name,
      sortOrder: d.sortOrder ?? 0,
    },
    include: {
      company: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(department, { status: 201 })
}

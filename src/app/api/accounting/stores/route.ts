/**
 * [API] 経理 - 店舗マスタ GET/POST /api/accounting/stores
 *
 * GET: 店舗一覧取得（?departmentId=）
 * POST: 店舗新規作成
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import type { Prisma } from "@prisma/client"

const createSchema = z.object({
  departmentId: z.string().min(1, "部門IDは必須です"),
  name: z.string().min(1, "店舗名は必須です").max(100),
  sortOrder: z.number().int().optional(),
})

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const departmentId = req.nextUrl.searchParams.get("departmentId")

  const where: Prisma.StoreWhereInput = { isActive: true }
  if (departmentId) where.departmentId = departmentId

  const stores = await prisma.store.findMany({
    where,
    include: {
      department: { select: { id: true, name: true } },
    },
    orderBy: { sortOrder: "asc" },
  })

  return NextResponse.json(stores)
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
  const store = await prisma.store.create({
    data: {
      departmentId: d.departmentId,
      name: d.name,
      sortOrder: d.sortOrder ?? 0,
    },
    include: {
      department: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(store, { status: 201 })
}

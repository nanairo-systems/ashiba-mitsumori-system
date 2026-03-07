/**
 * [API] 職人マスター - GET/POST /api/workers
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  name: z.string().min(1, "名前は必須です"),
  furigana: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email("メール形式が不正です").nullable().optional(),
  workerType: z.enum(["EMPLOYEE", "INDEPENDENT"]),
  defaultRole: z.enum(["FOREMAN", "WORKER"]).optional(),
  subcontractorId: z.string().nullable().optional(),
})

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const search = searchParams.get("search")?.trim()
  const isActive = searchParams.get("isActive")
  const workerType = searchParams.get("workerType")

  const where: Record<string, unknown> = {}

  // isActive フィルタ（デフォルトはフィルタなし）
  if (isActive === "true") where.isActive = true
  else if (isActive === "false") where.isActive = false

  // workerType フィルタ
  if (workerType === "EMPLOYEE" || workerType === "INDEPENDENT") {
    where.workerType = workerType
  }

  // 検索
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { furigana: { contains: search, mode: "insensitive" } },
    ]
  }

  const workers = await prisma.worker.findMany({
    where,
    include: {
      subcontractor: { select: { id: true, name: true } },
    },
    orderBy: [{ name: "asc" }],
  })

  return NextResponse.json(workers)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("、")
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const d = parsed.data
  const worker = await prisma.worker.create({
    data: {
      name: d.name,
      furigana: d.furigana ?? null,
      phone: d.phone ?? null,
      email: d.email ?? null,
      workerType: d.workerType,
      defaultRole: d.defaultRole ?? "WORKER",
      subcontractorId: d.subcontractorId ?? null,
    },
  })

  return NextResponse.json(worker, { status: 201 })
}

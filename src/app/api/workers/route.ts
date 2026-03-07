/**
 * [API] 職人マスタ - GET/POST /api/workers
 *
 * GET: 職人一覧（?search=&isActive=&workerType=）
 * POST: 職人新規作成
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import type { Prisma } from "@prisma/client"

const createSchema = z.object({
  name: z.string().min(1, "名前は必須です").max(100),
  furigana: z.string().max(100).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  email: z.string().max(100).nullable().optional(),
  workerType: z.enum(["EMPLOYEE", "INDEPENDENT"]),
  defaultRole: z.enum(["FOREMAN", "WORKER"]).default("WORKER"),
  subcontractorId: z.string().nullable().optional(),
})

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const isActive = req.nextUrl.searchParams.get("isActive")
  const search = req.nextUrl.searchParams.get("search")
  const workerType = req.nextUrl.searchParams.get("workerType")

  const where: Prisma.WorkerWhereInput = {}
  if (isActive === "true") where.isActive = true
  if (isActive === "false") where.isActive = false
  if (workerType) where.workerType = workerType as "EMPLOYEE" | "INDEPENDENT"
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { furigana: { contains: search, mode: "insensitive" } },
    ]
  }

  const workers = await prisma.worker.findMany({
    where,
    include: {
      subcontractors: { select: { id: true, name: true } },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
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
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("、") }, { status: 400 })
  }

  const d = parsed.data
  const worker = await prisma.worker.create({
    data: {
      name: d.name,
      furigana: d.furigana ?? null,
      phone: d.phone ?? null,
      email: d.email ?? null,
      workerType: d.workerType,
      defaultRole: d.defaultRole,
      subcontractorId: d.subcontractorId ?? null,
    },
    include: {
      subcontractors: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(worker, { status: 201 })
}

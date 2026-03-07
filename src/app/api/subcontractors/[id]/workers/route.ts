/**
 * [API] 外注先従業員 - GET/POST /api/subcontractors/:id/workers
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
  defaultRole: z.enum(["FOREMAN", "WORKER"]).optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const sub = await prisma.subcontractor.findUnique({ where: { id } })
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const workers = await prisma.worker.findMany({
    where: { subcontractorId: id },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  })

  return NextResponse.json(workers)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const sub = await prisma.subcontractor.findUnique({ where: { id } })
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 })

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
      workerType: "INDEPENDENT",
      defaultRole: d.defaultRole ?? "WORKER",
      subcontractorId: id,
    },
  })

  return NextResponse.json(worker, { status: 201 })
}

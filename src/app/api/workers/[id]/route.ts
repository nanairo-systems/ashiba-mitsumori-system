/**
 * [API] 職人詳細 - GET/PUT/DELETE /api/workers/:id
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateSchema = z.object({
  name: z.string().min(1, "名前は必須です").optional(),
  furigana: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email("メール形式が不正です").nullable().optional(),
  workerType: z.enum(["EMPLOYEE", "INDEPENDENT"]).optional(),
  defaultRole: z.enum(["FOREMAN", "WORKER"]).optional(),
  subcontractorId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const worker = await prisma.worker.findUnique({
    where: { id },
    include: {
      subcontractor: { select: { id: true, name: true } },
    },
  })
  if (!worker) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(worker)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("、")
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const worker = await prisma.worker.findUnique({ where: { id } })
  if (!worker) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const updated = await prisma.worker.update({
    where: { id },
    data: parsed.data,
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const worker = await prisma.worker.findUnique({ where: { id } })
  if (!worker) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // 物理削除せず isActive=false に変更
  const updated = await prisma.worker.update({
    where: { id },
    data: { isActive: false },
  })

  return NextResponse.json(updated)
}

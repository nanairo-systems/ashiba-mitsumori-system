/**
 * [API] 職人マスタ - PUT/DELETE /api/workers/[id]
 *
 * PUT: 職人情報を更新
 * DELETE: isActive=false に変更（論理削除）
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  furigana: z.string().max(100).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  email: z.string().max(100).nullable().optional(),
  workerType: z.enum(["EMPLOYEE", "INDEPENDENT"]).optional(),
  defaultRole: z.enum(["FOREMAN", "WORKER"]).optional(),
  subcontractorId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

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
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("、") }, { status: 400 })
  }

  const worker = await prisma.worker.update({
    where: { id },
    data: parsed.data,
  })

  return NextResponse.json(worker)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const worker = await prisma.worker.update({
    where: { id },
    data: { isActive: false },
  })

  return NextResponse.json(worker)
}

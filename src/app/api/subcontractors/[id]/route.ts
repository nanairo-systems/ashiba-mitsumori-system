/**
 * [API] 外注先更新 - PATCH /api/subcontractors/:id
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  furigana: z.string().nullable().optional(),
  representative: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  bankInfo: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 })
  }

  const sub = await prisma.subcontractor.findUnique({ where: { id } })
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const updated = await prisma.subcontractor.update({
    where: { id },
    data: parsed.data,
  })

  return NextResponse.json(updated)
}

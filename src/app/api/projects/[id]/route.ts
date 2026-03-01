/**
 * [API] 現場更新 - PATCH /api/projects/:id
 *
 * 現場の名前・住所・担当者・工期を更新する。
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

const patchSchema = z.object({
  name: z.string().min(1, "現場名は必須です").optional(),
  address: z.string().nullable().optional(),
  contactId: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("、")
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const project = await prisma.project.findUnique({ where: { id } })
  if (!project) return NextResponse.json({ error: "現場が見つかりません" }, { status: 404 })

  const updateData: Record<string, unknown> = {}
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name
  if (parsed.data.address !== undefined) updateData.address = parsed.data.address
  if (parsed.data.contactId !== undefined) updateData.contactId = parsed.data.contactId
  if (parsed.data.startDate !== undefined) {
    updateData.startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : null
  }
  if (parsed.data.endDate !== undefined) {
    updateData.endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : null
  }

  const updated = await prisma.project.update({ where: { id }, data: updateData })
  return NextResponse.json(updated)
}

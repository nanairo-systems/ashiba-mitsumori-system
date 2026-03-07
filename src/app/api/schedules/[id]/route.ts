/**
 * [API] 工程スケジュール PATCH/DELETE - /api/schedules/:id
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const patchSchema = z.object({
  workType: z.string().min(1).optional(),
  name: z.string().max(100).nullable().optional(),
  plannedStartDate: z.string().nullable().optional(),
  plannedEndDate: z.string().nullable().optional(),
  actualStartDate: z.string().nullable().optional(),
  actualEndDate: z.string().nullable().optional(),
  workersCount: z.number().int().positive().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const existing = await prisma.constructionSchedule.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 })

  const d = parsed.data
  const updateData: Record<string, unknown> = {}
  if (d.workType !== undefined) updateData.workType = d.workType
  if (d.name !== undefined) updateData.name = d.name
  if (d.plannedStartDate !== undefined) updateData.plannedStartDate = d.plannedStartDate ? new Date(d.plannedStartDate) : null
  if (d.plannedEndDate !== undefined) updateData.plannedEndDate = d.plannedEndDate ? new Date(d.plannedEndDate) : null
  if (d.actualStartDate !== undefined) updateData.actualStartDate = d.actualStartDate ? new Date(d.actualStartDate) : null
  if (d.actualEndDate !== undefined) updateData.actualEndDate = d.actualEndDate ? new Date(d.actualEndDate) : null
  if (d.workersCount !== undefined) updateData.workersCount = d.workersCount
  if (d.notes !== undefined) updateData.notes = d.notes

  const updated = await prisma.constructionSchedule.update({ where: { id }, data: updateData })
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
  const existing = await prisma.constructionSchedule.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.constructionSchedule.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

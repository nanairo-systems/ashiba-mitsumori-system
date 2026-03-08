/**
 * [API] 人員配置 個別操作 - GET/PUT/DELETE /api/worker-assignments/:id
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateSchema = z.object({
  scheduleId: z.string().min(1).optional(),
  teamId: z.string().min(1).optional(),
  workerId: z.string().nullable().optional(),
  vehicleId: z.string().nullable().optional(),
  assignedRole: z.enum(["FOREMAN", "WORKER"]).optional(),
  sortOrder: z.number().int().optional(),
  note: z.string().max(500).nullable().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const assignment = await prisma.workerAssignment.findUnique({
    where: { id },
    include: {
      team: true,
      worker: true,
      vehicle: true,
      schedule: {
        include: {
          contract: {
            include: {
              project: {
                include: {
                  branch: { include: { company: { select: { id: true, name: true } } } },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!assignment) {
    return NextResponse.json({ error: "人員配置が見つかりません" }, { status: 404 })
  }

  return NextResponse.json(assignment)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const existing = await prisma.workerAssignment.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "人員配置が見つかりません" }, { status: 404 })
  }

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("、")
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const d = parsed.data
  const assignment = await prisma.workerAssignment.update({
    where: { id },
    data: {
      ...(d.scheduleId !== undefined && { scheduleId: d.scheduleId }),
      ...(d.teamId !== undefined && { teamId: d.teamId }),
      ...(d.workerId !== undefined && { workerId: d.workerId }),
      ...(d.vehicleId !== undefined && { vehicleId: d.vehicleId }),
      ...(d.assignedRole !== undefined && { assignedRole: d.assignedRole }),
      ...(d.sortOrder !== undefined && { sortOrder: d.sortOrder }),
      ...(d.note !== undefined && { note: d.note }),
    },
    include: {
      team: true,
      worker: true,
      vehicle: true,
      schedule: true,
    },
  })

  return NextResponse.json(assignment)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const existing = await prisma.workerAssignment.findUnique({ where: { id } })
  if (!existing) {
    return NextResponse.json({ error: "人員配置が見つかりません" }, { status: 404 })
  }

  await prisma.workerAssignment.delete({ where: { id } })

  return NextResponse.json({ success: true })
}

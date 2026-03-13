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
          project: {
            include: {
              branch: { include: { company: { select: { id: true, name: true } } } },
            },
          },
          contract: {
            select: {
              id: true,
              contractNumber: true,
              contractAmount: true,
              totalAmount: true,
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

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("、")
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const d = parsed.data

  try {
    // トランザクションで職長降格＋更新を原子的に実行
    const assignment = await prisma.$transaction(async (tx) => {
      const existing = await tx.workerAssignment.findUnique({ where: { id } })
      if (!existing) throw new Error("NOT_FOUND")

      // 職長に変更する場合、同じチーム+スケジュール内の既存の職長を職人に降格
      if (d.assignedRole === "FOREMAN") {
        await tx.workerAssignment.updateMany({
          where: {
            teamId: existing.teamId,
            scheduleId: existing.scheduleId,
            assignedRole: "FOREMAN",
            id: { not: id },
          },
          data: { assignedRole: "WORKER" },
        })
      }

      return tx.workerAssignment.update({
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
    })

    return NextResponse.json(assignment)
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return NextResponse.json({ error: "人員配置が見つかりません" }, { status: 404 })
    }
    throw err
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  try {
    await prisma.workerAssignment.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    // P2025: Record not found
    if (err && typeof err === "object" && "code" in err && err.code === "P2025") {
      return NextResponse.json({ error: "人員配置が見つかりません" }, { status: 404 })
    }
    throw err
  }
}

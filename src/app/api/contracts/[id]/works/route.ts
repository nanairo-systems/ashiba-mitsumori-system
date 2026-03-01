/**
 * [API] 工事区分 CRUD - /api/contracts/:id/works
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  workType: z.enum(["INHOUSE", "SUBCONTRACT"]),
  workerCount: z.number().int().positive().nullable().optional(),
  workDays: z.number().int().positive().nullable().optional(),
  subcontractorId: z.string().uuid().nullable().optional(),
  orderAmount: z.number().nonnegative().nullable().optional(),
  orderTaxAmount: z.number().nonnegative().nullable().optional(),
  orderTotalAmount: z.number().nonnegative().nullable().optional(),
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
  const works = await prisma.contractWork.findMany({
    where: { contractId: id },
    include: { subcontractor: true },
    orderBy: { createdAt: "asc" },
  })
  return NextResponse.json(works)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const contract = await prisma.contract.findUnique({ where: { id } })
  if (!contract) return NextResponse.json({ error: "契約が見つかりません" }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("、")
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const d = parsed.data
  const work = await prisma.contractWork.create({
    data: {
      contractId: id,
      workType: d.workType,
      workerCount: d.workerCount ?? null,
      workDays: d.workDays ?? null,
      subcontractorId: d.subcontractorId ?? null,
      orderAmount: d.orderAmount ?? null,
      orderTaxAmount: d.orderTaxAmount ?? null,
      orderTotalAmount: d.orderTotalAmount ?? null,
      note: d.note ?? null,
    },
    include: { subcontractor: true },
  })

  return NextResponse.json(work, { status: 201 })
}

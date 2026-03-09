/**
 * [API] 経理 - 外注費詳細 GET/PATCH/DELETE /api/accounting/subcontractor-invoices/[id]
 *
 * GET: 外注費詳細取得
 * PATCH: 外注費更新（支払日・ステータス変更含む）
 * DELETE: 削除
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateSchema = z.object({
  vendorId: z.string().optional(),
  companyId: z.string().optional(),
  departmentId: z.string().optional(),
  storeId: z.string().nullable().optional(),
  billingYearMonth: z.string().optional(),
  amount: z.number().min(0).optional(),
  closingType: z.enum(["MONTH_END", "DAY_15"]).optional(),
  paymentDueDate: z.string().nullable().optional(),
  paymentDate: z.string().nullable().optional(),
  status: z.enum(["PENDING", "PAID"]).optional(),
  pdfUrl: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
})

const includeRelations = {
  vendor: { select: { id: true, name: true } },
  company: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  store: { select: { id: true, name: true } },
} as const

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const invoice = await prisma.subcontractorInvoice.findUnique({
    where: { id },
    include: includeRelations,
  })

  if (!invoice) {
    return NextResponse.json({ error: "外注費データが見つかりません" }, { status: 404 })
  }

  return NextResponse.json(invoice)
}

export async function PATCH(
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

  const data: Record<string, unknown> = { ...parsed.data }
  const dateFields = ["billingYearMonth", "paymentDueDate", "paymentDate"] as const
  for (const field of dateFields) {
    if (field in data) {
      data[field] = data[field] ? new Date(data[field] as string) : null
    }
  }

  const invoice = await prisma.subcontractorInvoice.update({
    where: { id },
    data,
    include: includeRelations,
  })

  return NextResponse.json(invoice)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  await prisma.subcontractorInvoice.delete({
    where: { id },
  })

  return NextResponse.json({ success: true })
}

/**
 * [API] 経理 - 外注費 GET/POST /api/accounting/subcontractor-invoices
 *
 * GET: 外注費一覧取得（?companyId=&departmentId=&storeId=&status=&yearMonth=）
 * POST: 外注費新規作成
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import type { Prisma } from "@prisma/client"

const createSchema = z.object({
  vendorId: z.string().min(1, "取引先IDは必須です"),
  companyId: z.string().min(1, "会社IDは必須です"),
  departmentId: z.string().min(1, "部門IDは必須です"),
  storeId: z.string().nullable().optional(),
  billingYearMonth: z.string().min(1, "請求年月は必須です"),
  amount: z.number().min(0, "金額は0以上で入力してください"),
  closingType: z.enum(["MONTH_END", "DAY_15"]),
  paymentDueDate: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
})

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const companyId = req.nextUrl.searchParams.get("companyId")
  const departmentId = req.nextUrl.searchParams.get("departmentId")
  const storeId = req.nextUrl.searchParams.get("storeId")
  const status = req.nextUrl.searchParams.get("status")
  const yearMonth = req.nextUrl.searchParams.get("yearMonth")

  const where: Prisma.SubcontractorInvoiceWhereInput = {}
  if (companyId) where.companyId = companyId
  if (departmentId) where.departmentId = departmentId
  if (storeId) where.storeId = storeId
  if (status) where.status = status as "PENDING" | "PAID"
  if (yearMonth) {
    const date = new Date(yearMonth)
    const start = new Date(date.getFullYear(), date.getMonth(), 1)
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1)
    where.billingYearMonth = { gte: start, lt: end }
  }

  const invoices = await prisma.subcontractorInvoice.findMany({
    where,
    include: {
      vendor: { select: { id: true, name: true } },
      company: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      store: { select: { id: true, name: true } },
    },
    orderBy: { billingYearMonth: "desc" },
  })

  return NextResponse.json(invoices)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join("、") }, { status: 400 })
  }

  const d = parsed.data
  const invoice = await prisma.subcontractorInvoice.create({
    data: {
      vendorId: d.vendorId,
      companyId: d.companyId,
      departmentId: d.departmentId,
      storeId: d.storeId ?? null,
      billingYearMonth: new Date(d.billingYearMonth),
      amount: d.amount,
      closingType: d.closingType,
      paymentDueDate: d.paymentDueDate ? new Date(d.paymentDueDate) : null,
      note: d.note ?? null,
    },
    include: {
      vendor: { select: { id: true, name: true } },
      company: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      store: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(invoice, { status: 201 })
}

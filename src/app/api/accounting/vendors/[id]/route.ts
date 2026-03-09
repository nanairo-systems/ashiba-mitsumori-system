/**
 * [API] 経理 - 取引先詳細 GET/PATCH/DELETE /api/accounting/vendors/[id]
 *
 * GET: 取引先詳細取得（vehicles・employees・departments含む）
 * PATCH: 取引先更新
 * DELETE: 論理削除（isActive=false）
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  furigana: z.string().max(200).nullable().optional(),
  representativeName: z.string().max(100).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  email: z.string().max(200).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  bankName: z.string().max(100).nullable().optional(),
  branchName: z.string().max(100).nullable().optional(),
  accountType: z.enum(["ORDINARY", "CURRENT"]).nullable().optional(),
  accountNumber: z.string().max(20).nullable().optional(),
  accountHolder: z.string().max(100).nullable().optional(),
  closingType: z.enum(["MONTH_END", "DAY_15"]).optional(),
  hasInvoiceRegistration: z.boolean().optional(),
  invoiceNumber: z.string().max(50).nullable().optional(),
  constructionInsuranceCompany: z.string().max(100).nullable().optional(),
  constructionInsuranceNumber: z.string().max(50).nullable().optional(),
  constructionInsuranceExpiry: z.string().nullable().optional(),
  vehicleInsuranceCompany: z.string().max(100).nullable().optional(),
  vehicleInsuranceNumber: z.string().max(50).nullable().optional(),
  vehicleInsuranceExpiry: z.string().nullable().optional(),
  compulsoryInsuranceExpiry: z.string().nullable().optional(),
  constructionLicenseNumber: z.string().max(50).nullable().optional(),
  constructionLicenseExpiry: z.string().nullable().optional(),
  laborInsuranceNumber: z.string().max(50).nullable().optional(),
  employmentInsuranceNumber: z.string().max(50).nullable().optional(),
  hasForeignWorkers: z.boolean().optional(),
  foreignWorkerNote: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  rating: z.string().max(10).nullable().optional(),
  antisocialCheckDone: z.boolean().optional(),
  isSuspended: z.boolean().optional(),
  suspensionReason: z.string().nullable().optional(),
  emergencyContact: z.string().max(100).nullable().optional(),
  note: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

const dateFields = [
  "constructionInsuranceExpiry",
  "vehicleInsuranceExpiry",
  "compulsoryInsuranceExpiry",
  "constructionLicenseExpiry",
  "startDate",
] as const

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const vendor = await prisma.vendor.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true } },
      departments: {
        include: { department: { select: { id: true, name: true } } },
      },
      vehicles: true,
      employees: { where: { isActive: true } },
    },
  })

  if (!vendor) {
    return NextResponse.json({ error: "取引先が見つかりません" }, { status: 404 })
  }

  return NextResponse.json(vendor)
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
  for (const field of dateFields) {
    if (field in data) {
      data[field] = data[field] ? new Date(data[field] as string) : null
    }
  }

  const vendor = await prisma.vendor.update({
    where: { id },
    data,
    include: {
      company: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(vendor)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const vendor = await prisma.vendor.update({
    where: { id },
    data: { isActive: false },
  })

  return NextResponse.json(vendor)
}

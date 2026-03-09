/**
 * [API] 経理 - 取引先マスタ GET/POST /api/accounting/vendors
 *
 * GET: 取引先一覧取得（?search=&companyId=&departmentId=）
 * POST: 取引先新規作成
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import type { Prisma } from "@prisma/client"

const createSchema = z.object({
  companyId: z.string().min(1, "会社IDは必須です"),
  name: z.string().min(1, "取引先名は必須です").max(200),
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
  closingType: z.enum(["MONTH_END", "DAY_15"]).default("MONTH_END"),
  hasInvoiceRegistration: z.boolean().default(false),
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
  hasForeignWorkers: z.boolean().default(false),
  foreignWorkerNote: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  rating: z.string().max(10).nullable().optional(),
  antisocialCheckDone: z.boolean().default(false),
  isSuspended: z.boolean().default(false),
  suspensionReason: z.string().nullable().optional(),
  emergencyContact: z.string().max(100).nullable().optional(),
  note: z.string().nullable().optional(),
})

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const search = req.nextUrl.searchParams.get("search")
  const companyId = req.nextUrl.searchParams.get("companyId")
  const departmentId = req.nextUrl.searchParams.get("departmentId")

  const where: Prisma.VendorWhereInput = { isActive: true }
  if (companyId) where.companyId = companyId
  if (departmentId) {
    where.departments = { some: { departmentId } }
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { furigana: { contains: search, mode: "insensitive" } },
    ]
  }

  const vendors = await prisma.vendor.findMany({
    where,
    include: {
      company: { select: { id: true, name: true } },
      departments: {
        include: { department: { select: { id: true, name: true } } },
      },
    },
    orderBy: { name: "asc" },
  })

  return NextResponse.json(vendors)
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
  const vendor = await prisma.vendor.create({
    data: {
      companyId: d.companyId,
      name: d.name,
      furigana: d.furigana ?? null,
      representativeName: d.representativeName ?? null,
      phone: d.phone ?? null,
      email: d.email ?? null,
      address: d.address ?? null,
      bankName: d.bankName ?? null,
      branchName: d.branchName ?? null,
      accountType: d.accountType ?? null,
      accountNumber: d.accountNumber ?? null,
      accountHolder: d.accountHolder ?? null,
      closingType: d.closingType,
      hasInvoiceRegistration: d.hasInvoiceRegistration,
      invoiceNumber: d.invoiceNumber ?? null,
      constructionInsuranceCompany: d.constructionInsuranceCompany ?? null,
      constructionInsuranceNumber: d.constructionInsuranceNumber ?? null,
      constructionInsuranceExpiry: d.constructionInsuranceExpiry ? new Date(d.constructionInsuranceExpiry) : null,
      vehicleInsuranceCompany: d.vehicleInsuranceCompany ?? null,
      vehicleInsuranceNumber: d.vehicleInsuranceNumber ?? null,
      vehicleInsuranceExpiry: d.vehicleInsuranceExpiry ? new Date(d.vehicleInsuranceExpiry) : null,
      compulsoryInsuranceExpiry: d.compulsoryInsuranceExpiry ? new Date(d.compulsoryInsuranceExpiry) : null,
      constructionLicenseNumber: d.constructionLicenseNumber ?? null,
      constructionLicenseExpiry: d.constructionLicenseExpiry ? new Date(d.constructionLicenseExpiry) : null,
      laborInsuranceNumber: d.laborInsuranceNumber ?? null,
      employmentInsuranceNumber: d.employmentInsuranceNumber ?? null,
      hasForeignWorkers: d.hasForeignWorkers,
      foreignWorkerNote: d.foreignWorkerNote ?? null,
      startDate: d.startDate ? new Date(d.startDate) : null,
      rating: d.rating ?? null,
      antisocialCheckDone: d.antisocialCheckDone,
      isSuspended: d.isSuspended,
      suspensionReason: d.suspensionReason ?? null,
      emergencyContact: d.emergencyContact ?? null,
      note: d.note ?? null,
    },
    include: {
      company: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(vendor, { status: 201 })
}

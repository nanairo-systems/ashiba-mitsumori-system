/**
 * [PAGE] 経理システム - 取引先一覧
 *
 * Server Component: データ取得 → VendorList に渡す
 */
import type { Metadata } from "next"

export const metadata: Metadata = { title: "取引先一覧" }

import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { VendorList } from "@/components/accounting/vendors/VendorList"

export default async function VendorsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [vendors, companies, departments] = await Promise.all([
    prisma.vendor.findMany({
      where: { isActive: true },
      include: {
        company: { select: { id: true, name: true } },
        departments: {
          include: { department: { select: { id: true, name: true } } },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.accountingCompany.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.department.findMany({
      where: { isActive: true },
      include: { company: { select: { id: true, name: true } } },
      orderBy: { sortOrder: "asc" },
    }),
  ])

  const serialized = vendors.map((v) => ({
    ...v,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
    constructionInsuranceExpiry: v.constructionInsuranceExpiry?.toISOString() ?? null,
    vehicleInsuranceExpiry: v.vehicleInsuranceExpiry?.toISOString() ?? null,
    compulsoryInsuranceExpiry: v.compulsoryInsuranceExpiry?.toISOString() ?? null,
    constructionLicenseExpiry: v.constructionLicenseExpiry?.toISOString() ?? null,
    startDate: v.startDate?.toISOString() ?? null,
  }))

  const serializedCompanies = companies.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }))

  const serializedDepartments = departments.map((d) => ({
    ...d,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  }))

  return (
    <VendorList
      initialVendors={serialized}
      companies={serializedCompanies}
      departments={serializedDepartments}
    />
  )
}

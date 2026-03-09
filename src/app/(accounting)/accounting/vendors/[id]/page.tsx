/**
 * [PAGE] 経理システム - 取引先詳細
 *
 * Server Component: データ取得 → VendorDetail に渡す
 */
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import { VendorDetail } from "@/components/accounting/vendors/VendorDetail"

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { id } = await params

  const vendor = await prisma.vendor.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true } },
      departments: {
        include: { department: { select: { id: true, name: true } } },
      },
      vehicles: { orderBy: { createdAt: "desc" } },
      employees: { orderBy: [{ isActive: "desc" }, { name: "asc" }] },
    },
  })

  if (!vendor) notFound()

  const companies = await prisma.accountingCompany.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  })

  // Date → ISO string に変換
  const serializedVendor = {
    ...vendor,
    createdAt: vendor.createdAt.toISOString(),
    updatedAt: vendor.updatedAt.toISOString(),
    constructionInsuranceExpiry: vendor.constructionInsuranceExpiry?.toISOString() ?? null,
    vehicleInsuranceExpiry: vendor.vehicleInsuranceExpiry?.toISOString() ?? null,
    compulsoryInsuranceExpiry: vendor.compulsoryInsuranceExpiry?.toISOString() ?? null,
    constructionLicenseExpiry: vendor.constructionLicenseExpiry?.toISOString() ?? null,
    startDate: vendor.startDate?.toISOString() ?? null,
    vehicles: vendor.vehicles.map((v) => ({
      ...v,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
      compulsoryExpiry: v.compulsoryExpiry?.toISOString() ?? null,
      insuranceExpiry: v.insuranceExpiry?.toISOString() ?? null,
    })),
    employees: vendor.employees.map((e) => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
      birthDate: e.birthDate?.toISOString() ?? null,
    })),
  }

  const serializedCompanies = companies.map((c) => ({
    id: c.id,
    name: c.name,
  }))

  return <VendorDetail vendor={serializedVendor} companies={serializedCompanies} />
}

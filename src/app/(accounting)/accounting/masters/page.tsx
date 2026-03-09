/**
 * [PAGE] 経理システム - マスター管理
 *
 * Server Component: 会社・部門・店舗の全データ（無効含む）を取得 → タブ形式で表示
 */
import { prisma } from "@/lib/prisma"
import { MasterTabs } from "@/components/accounting/masters/MasterTabs"

export default async function MastersPage() {
  const [companies, departments, stores] = await Promise.all([
    prisma.accountingCompany.findMany({
      orderBy: { sortOrder: "asc" },
    }),
    prisma.department.findMany({
      include: { company: { select: { id: true, name: true } } },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.store.findMany({
      include: { department: { select: { id: true, name: true } } },
      orderBy: { sortOrder: "asc" },
    }),
  ])

  const serializedCompanies = companies.map((c) => ({
    id: c.id,
    name: c.name,
    colorCode: c.colorCode,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
  }))

  const serializedDepartments = departments.map((d) => ({
    id: d.id,
    companyId: d.companyId,
    name: d.name,
    sortOrder: d.sortOrder,
    isActive: d.isActive,
    company: d.company,
  }))

  const serializedStores = stores.map((s) => ({
    id: s.id,
    departmentId: s.departmentId,
    name: s.name,
    sortOrder: s.sortOrder,
    isActive: s.isActive,
    department: s.department,
  }))

  return (
    <MasterTabs
      initialCompanies={serializedCompanies}
      initialDepartments={serializedDepartments}
      initialStores={serializedStores}
    />
  )
}

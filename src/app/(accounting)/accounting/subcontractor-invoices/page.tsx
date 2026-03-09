/**
 * [PAGE] 経理システム - 外注費一覧・入力
 *
 * Server Component: データ取得 → SubcontractorInvoiceList に渡す
 */
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { SubcontractorInvoiceList } from "@/components/accounting/subcontractor-invoices/SubcontractorInvoiceList"

export default async function SubcontractorInvoicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [invoices, companies, departments, stores, vendors] = await Promise.all([
    prisma.subcontractorInvoice.findMany({
      include: {
        vendor: { select: { id: true, name: true } },
        company: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        store: { select: { id: true, name: true } },
      },
      orderBy: { billingYearMonth: "desc" },
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
    prisma.store.findMany({
      where: { isActive: true },
      include: { department: { select: { id: true, name: true } } },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.vendor.findMany({
      where: { isActive: true },
      select: { id: true, name: true, closingType: true, companyId: true },
      orderBy: { name: "asc" },
    }),
  ])

  const serializedInvoices = invoices.map((inv) => ({
    ...inv,
    amount: Number(inv.amount),
    billingYearMonth: inv.billingYearMonth.toISOString(),
    paymentDueDate: inv.paymentDueDate?.toISOString() ?? null,
    paymentDate: inv.paymentDate?.toISOString() ?? null,
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
  }))

  const serializedCompanies = companies.map((c) => ({
    id: c.id, name: c.name,
  }))

  const serializedDepartments = departments.map((d) => ({
    id: d.id, name: d.name, company: d.company,
  }))

  const serializedStores = stores.map((s) => ({
    id: s.id, name: s.name, department: s.department,
  }))

  return (
    <SubcontractorInvoiceList
      initialInvoices={serializedInvoices}
      companies={serializedCompanies}
      departments={serializedDepartments}
      stores={serializedStores}
      vendors={vendors}
    />
  )
}

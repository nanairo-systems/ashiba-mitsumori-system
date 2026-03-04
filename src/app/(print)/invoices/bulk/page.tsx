/**
 * [PAGE] 一括請求書印刷 (/invoices/bulk?ids=id1,id2,...)
 */
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import { InvoiceBulkPrint } from "@/components/invoices/InvoiceBulkPrint"

export default async function InvoiceBulkPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const sp = await searchParams
  const ids = sp.ids?.split(",").filter(Boolean) ?? []
  if (ids.length === 0) notFound()

  const invoices = await prisma.invoice.findMany({
    where: { id: { in: ids } },
    include: {
      contract: {
        include: {
          project: {
            include: {
              branch: { include: { company: true } },
              contact: true,
            },
          },
          estimate: {
            include: {
              sections: {
                orderBy: { sortOrder: "asc" },
                include: {
                  groups: {
                    orderBy: { sortOrder: "asc" },
                    include: { items: { orderBy: { sortOrder: "asc" }, include: { unit: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { invoiceDate: "asc" },
  })

  if (invoices.length === 0) notFound()

  const serialized = invoices.map((invoice) => ({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceType: invoice.invoiceType,
    amount: Number(invoice.amount),
    taxAmount: Number(invoice.taxAmount),
    totalAmount: Number(invoice.totalAmount),
    invoiceDate: invoice.invoiceDate.toISOString(),
    dueDate: invoice.dueDate?.toISOString() ?? null,
    status: invoice.status,
    notes: invoice.notes,
    contract: {
      contractNumber: invoice.contract.contractNumber,
      project: {
        name: invoice.contract.project.name,
        address: invoice.contract.project.address,
      },
      company: {
        name: invoice.contract.project.branch.company.name,
        phone: invoice.contract.project.branch.company.phone,
      },
      contact: invoice.contract.project.contact
        ? { name: invoice.contract.project.contact.name }
        : null,
      estimate: invoice.contract.estimate
        ? {
            sections: invoice.contract.estimate.sections.map((sec) => ({
              name: sec.name,
              groups: sec.groups.map((grp) => ({
                name: grp.name,
                items: grp.items.map((item) => ({
                  name: item.name,
                  quantity: Number(item.quantity),
                  unitPrice: Number(item.unitPrice),
                  unit: item.unit.name,
                })),
              })),
            })),
          }
        : { sections: [] },
    },
  }))

  return <InvoiceBulkPrint invoices={serialized} />
}

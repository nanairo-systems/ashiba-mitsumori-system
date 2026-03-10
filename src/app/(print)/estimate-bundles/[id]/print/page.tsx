/**
 * [PAGE] 見積セット 印刷ページ (/estimate-bundles/:id/print)
 */
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import { EstimateBundlePrint } from "@/components/estimates/EstimateBundlePrint"

export default async function EstimateBundlePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ print?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { id } = await params
  const { print: printParam } = await searchParams

  const bundle = await prisma.estimateBundle.findUnique({
    where: { id },
    include: {
      project: {
        include: {
          branch: { include: { company: true } },
          contact: true,
        },
      },
      items: {
        include: {
          estimate: {
            include: {
              user: { select: { id: true, name: true } },
              sections: {
                orderBy: { sortOrder: "asc" },
                include: {
                  groups: {
                    orderBy: { sortOrder: "asc" },
                    include: {
                      items: { orderBy: { sortOrder: "asc" }, include: { unit: true } },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  })

  if (!bundle) notFound()

  const taxRate = Number(bundle.project.branch.company.taxRate)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const estimates = bundle.items.map((bi: any) => {
    let subtotal = 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sections = bi.estimate.sections.map((sec: any) => ({
      id: sec.id,
      name: sec.name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      groups: sec.groups.map((grp: any) => ({
        id: grp.id,
        name: grp.name,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: grp.items.map((item: any) => {
          const qty = Number(item.quantity)
          const price = Number(item.unitPrice)
          subtotal += qty * price
          return { id: item.id, name: item.name, quantity: qty, unitPrice: price, unit: { name: item.unit.name } }
        }),
      })),
    }))

    const discountAmount = bi.estimate.discountAmount ? Number(bi.estimate.discountAmount) : 0
    const taxable = subtotal - discountAmount
    const tax = Math.floor(taxable * taxRate)

    return {
      id: bi.estimate.id,
      estimateNumber: bi.estimate.estimateNumber,
      title: bi.estimate.title,
      userName: bi.estimate.user.name,
      sections,
      discountAmount: discountAmount > 0 ? discountAmount : null,
      subtotal,
      taxAmount: tax,
      total: taxable + tax,
    }
  })

  const serialized = {
    id: bundle.id,
    bundleNumber: bundle.bundleNumber,
    title: bundle.title,
    note: bundle.note,
    createdAt: bundle.createdAt.toISOString(),
    project: {
      name: bundle.project.name,
      address: bundle.project.address,
      branch: {
        name: bundle.project.branch.name,
        company: {
          name: bundle.project.branch.company.name,
          phone: bundle.project.branch.company.phone,
        },
      },
      contact: bundle.project.contact ? { name: bundle.project.contact.name } : null,
    },
    estimates,
  }

  return <EstimateBundlePrint bundle={serialized} taxRate={taxRate} autoPrint={printParam === "1"} />
}

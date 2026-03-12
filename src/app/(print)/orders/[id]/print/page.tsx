/**
 * [PAGE] 発注書印刷 (/orders/:id/print)
 *
 * ContractWork（外注工事）の発注書をA4レイアウトで印刷する。
 */
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import { OrderPrint } from "@/components/orders/OrderPrint"

export default async function OrderPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { id } = await params

  const work = await prisma.contractWork.findUnique({
    where: { id },
    include: {
      subcontractor: true,
      contract: {
        include: {
          project: {
            include: {
              branch: { include: { company: true } },
            },
          },
          estimate: {
            include: {
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
      },
    },
  })

  if (!work || work.workType !== "SUBCONTRACT") notFound()

  const serialized = {
    id: work.id,
    orderAmount: work.orderAmount ? Number(work.orderAmount) : 0,
    orderTaxAmount: work.orderTaxAmount ? Number(work.orderTaxAmount) : 0,
    orderTotalAmount: work.orderTotalAmount ? Number(work.orderTotalAmount) : 0,
    orderStatus: work.orderStatus,
    orderedAt: work.orderedAt?.toISOString() ?? null,
    note: work.note,
    subcontractor: work.subcontractor
      ? {
          name: work.subcontractor.name,
          representative: work.subcontractor.representative,
          address: work.subcontractor.address,
          phone: work.subcontractor.phone,
        }
      : null,
    contract: {
      contractNumber: work.contract.contractNumber,
      project: {
        name: work.contract.project.name,
        address: work.contract.project.address,
      },
      company: {
        name: work.contract.project.branch.company.name,
        phone: work.contract.project.branch.company.phone,
      },
      estimate: work.contract.estimate
        ? {
            sections: work.contract.estimate.sections.map((sec) => ({
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
  }

  return <OrderPrint order={serialized} />
}

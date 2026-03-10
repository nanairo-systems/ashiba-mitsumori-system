/**
 * [PAGE] 見積ベース発注書印刷 (/estimates/:id/purchase-order/print)
 *
 * 見積に紐づく発注情報をA4発注書レイアウトで印刷する。
 * 見積明細（工事内容）・金額内訳・外注先情報を含む。
 */
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import { EstimatePurchaseOrderPrint } from "@/components/estimates/EstimatePurchaseOrderPrint"

export default async function EstimatePurchaseOrderPrintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { id } = await params

  const purchaseOrder = await prisma.estimatePurchaseOrder.findUnique({
    where: { estimateId: id },
    include: {
      subcontractor: true,
      estimate: {
        include: {
          user: { select: { name: true } },
          project: {
            include: {
              branch: { include: { company: true } },
            },
          },
          sections: {
            orderBy: { sortOrder: "asc" },
            include: {
              groups: {
                orderBy: { sortOrder: "asc" },
                include: {
                  items: {
                    orderBy: { sortOrder: "asc" },
                    include: { unit: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!purchaseOrder) notFound()

  // 見積明細から小計を計算
  let subtotal = 0
  for (const sec of purchaseOrder.estimate.sections) {
    for (const grp of sec.groups) {
      for (const item of grp.items) {
        subtotal += Number(item.quantity) * Number(item.unitPrice)
      }
    }
  }

  const discountAmount = purchaseOrder.estimate.discountAmount
    ? Number(purchaseOrder.estimate.discountAmount)
    : 0
  const taxRate = Number(purchaseOrder.estimate.project.branch.company.taxRate)
  const taxableAmount = subtotal - discountAmount
  const estimateTaxAmount = Math.floor(taxableAmount * taxRate)
  const estimateTotal = taxableAmount + estimateTaxAmount

  const serialized = {
    id: purchaseOrder.id,
    orderAmount: Number(purchaseOrder.orderAmount),
    taxRate: purchaseOrder.taxRate,
    note: purchaseOrder.note,
    status: purchaseOrder.status,
    orderedAt: purchaseOrder.orderedAt?.toISOString() ?? null,
    subcontractor: {
      name: purchaseOrder.subcontractor.name,
      representative: purchaseOrder.subcontractor.representative,
      address: purchaseOrder.subcontractor.address,
      phone: purchaseOrder.subcontractor.phone,
    },
    estimate: {
      estimateNumber: purchaseOrder.estimate.estimateNumber,
      revision: purchaseOrder.estimate.revision,
      title: purchaseOrder.estimate.title,
      subtotal,
      discountAmount,
      taxableAmount,
      taxAmount: estimateTaxAmount,
      total: estimateTotal,
      note: purchaseOrder.estimate.note,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sections: purchaseOrder.estimate.sections.map((sec: any) => ({
        name: sec.name,
        groups: sec.groups.map((grp: any) => ({
          name: grp.name,
          items: grp.items.map((item: any) => ({
            name: item.name,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            unit: item.unit.name,
          })),
        })),
      })),
      project: {
        name: purchaseOrder.estimate.project.name,
        address: purchaseOrder.estimate.project.address,
        startDate: purchaseOrder.estimate.project.startDate?.toISOString() ?? null,
        endDate: purchaseOrder.estimate.project.endDate?.toISOString() ?? null,
      },
      company: {
        name: purchaseOrder.estimate.project.branch.company.name,
        phone: purchaseOrder.estimate.project.branch.company.phone,
      },
      user: {
        name: purchaseOrder.estimate.user.name,
      },
    },
  }

  return <EstimatePurchaseOrderPrint order={serialized} />
}

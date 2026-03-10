/**
 * [PAGE] 契約書 印刷ページ (/contracts/:id/print)
 *
 * 統合契約の書類を印刷用レイアウトで表示。
 * 各見積の明細を内訳として含む。
 */
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import { ContractPrint } from "@/components/contracts/ContractPrint"

export default async function ContractPrintPage({
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

  const contract = await prisma.contract.findUnique({
    where: { id },
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
                include: {
                  items: { orderBy: { sortOrder: "asc" }, include: { unit: true } },
                },
              },
            },
          },
        },
      },
      contractEstimates: {
        include: {
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

  if (!contract) notFound()

  const taxRate = Number(contract.project.branch.company.taxRate)

  // 見積データを収集（統合/個別両対応）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawEstimates: any[] = []

  if (contract.contractEstimates.length > 0) {
    // 統合契約: contractEstimatesから取得
    for (const ce of contract.contractEstimates) {
      rawEstimates.push(ce.estimate)
    }
  } else if (contract.estimate) {
    // 個別契約: 直接のestimateから取得
    rawEstimates.push(contract.estimate)
  }

  // 各見積の金額を計算してシリアライズ
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const estimates = rawEstimates.map((est: any) => {
    let subtotal = 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sections = est.sections.map((sec: any) => ({
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
          return {
            id: item.id,
            name: item.name,
            quantity: qty,
            unitPrice: price,
            unit: { name: item.unit.name },
          }
        }),
      })),
    }))

    const discountAmount = est.discountAmount ? Number(est.discountAmount) : 0
    const taxable = subtotal - discountAmount
    const tax = Math.floor(taxable * taxRate)

    return {
      id: est.id,
      estimateNumber: est.estimateNumber,
      title: est.title,
      sections,
      discountAmount: discountAmount > 0 ? discountAmount : null,
      subtotal,
      taxAmount: tax,
      total: taxable + tax,
    }
  })

  const serialized = {
    id: contract.id,
    contractNumber: contract.contractNumber,
    name: contract.name,
    status: contract.status,
    contractAmount: Number(contract.contractAmount),
    taxAmount: Number(contract.taxAmount),
    totalAmount: Number(contract.totalAmount),
    contractDate: contract.contractDate.toISOString(),
    startDate: contract.startDate?.toISOString() ?? null,
    endDate: contract.endDate?.toISOString() ?? null,
    paymentTerms: contract.paymentTerms,
    note: contract.note,
    project: {
      name: contract.project.name,
      address: contract.project.address,
      branch: {
        name: contract.project.branch.name,
        company: {
          name: contract.project.branch.company.name,
          phone: contract.project.branch.company.phone,
        },
      },
      contact: contract.project.contact
        ? { name: contract.project.contact.name }
        : null,
    },
    estimates,
  }

  return <ContractPrint contract={serialized} autoPrint={printParam === "1"} />
}

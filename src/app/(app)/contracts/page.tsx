/**
 * [PAGE] 契約一覧 (/contracts)
 *
 * 現場(プロジェクト)単位で1行にまとめて表示。
 * 1つの現場に複数契約(追加工事等)があっても1行。
 */
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { ContractList } from "@/components/contracts/ContractList"

export default async function ContractsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [dbUser, contracts] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    prisma.contract.findMany({
    include: {
      project: {
        include: {
          branch: { include: { company: true } },
          contact: true,
        },
      },
      estimate: {
        select: {
          id: true,
          estimateNumber: true,
          title: true,
          user: { select: { id: true, name: true } },
        },
      },
      contractEstimates: {
        include: {
          estimate: {
            select: {
              id: true,
              estimateNumber: true,
              title: true,
              user: { select: { id: true, name: true } },
            },
          },
        },
      },
      schedules: {
        select: {
          actualStartDate: true,
          actualEndDate: true,
        },
      },
      invoices: {
        select: {
          status: true,
        },
      },
    },
    orderBy: { contractDate: "asc" },
  }),
  ])
  if (!dbUser) redirect("/login")

  const serialized = contracts.map((c) => {
    // 単体契約: estimate から、一括契約: contractEstimates の先頭から
    const firstEstimate = c.estimate
      ?? c.contractEstimates[0]?.estimate
      ?? null

    return {
      id: c.id,
      contractNumber: c.contractNumber,
      name: c.name,
      status: c.status,
      contractAmount: Number(c.contractAmount),
      taxAmount: Number(c.taxAmount),
      totalAmount: Number(c.totalAmount),
      contractDate: c.contractDate,
      startDate: c.startDate,
      endDate: c.endDate,
      paymentTerms: c.paymentTerms,
      note: c.note,
      createdAt: c.createdAt,
      project: {
        id: c.project.id,
        name: c.project.name,
        address: c.project.address,
        branch: {
          name: c.project.branch.name,
          company: {
            id: c.project.branch.company.id,
            name: c.project.branch.company.name,
          },
        },
        contact: c.project.contact ? { name: c.project.contact.name } : null,
      },
      estimate: firstEstimate
        ? { id: firstEstimate.id, estimateNumber: firstEstimate.estimateNumber, title: firstEstimate.title, user: { id: firstEstimate.user.id, name: firstEstimate.user.name } }
        : { id: "", estimateNumber: null, title: c.name, user: { id: "", name: "" } },
      estimateCount: c.estimate ? 1 : c.contractEstimates.length,
      gate: {
        scheduleCount: c.schedules.length,
        hasActualStart: c.schedules.some((s) => s.actualStartDate !== null),
        allActualEnd: c.schedules.length > 0 && c.schedules.every((s) => s.actualEndDate !== null),
        invoiceCount: c.invoices.length,
        allInvoicesPaid: c.invoices.length > 0 && c.invoices.every((inv) => inv.status === "PAID"),
      },
    }
  })

  return <ContractList contracts={serialized} currentUser={dbUser} />
}

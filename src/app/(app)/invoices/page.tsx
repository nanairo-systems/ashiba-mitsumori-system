/**
 * [PAGE] 請求管理 (/invoices)
 *
 * 元請（会社）ごとに締め日ベースで請求を処理する事務向けページ。
 * 完工済み案件・工程状況・既存請求を横断的に確認し、漏れなく請求を行う。
 */
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { InvoiceList } from "@/components/invoices/InvoiceList"

export default async function InvoicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } })
  if (!dbUser) redirect("/login")

  const contracts = await prisma.contract.findMany({
    where: { status: { not: "CANCELLED" } },
    include: {
      project: {
        include: {
          branch: {
            include: {
              company: {
                select: {
                  id: true, name: true, taxRate: true,
                  paymentClosingDay: true, paymentMonthOffset: true, paymentPayDay: true,
                },
              },
            },
          },
        },
      },
      estimate: {
        select: {
          title: true, estimateType: true,
          user: { select: { id: true, name: true } },
        },
      },
      works: {
        select: { id: true, workType: true, workerCount: true, subcontractor: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
      schedules: {
        select: {
          id: true, workType: true,
          plannedStartDate: true, plannedEndDate: true,
          actualStartDate: true, actualEndDate: true,
          workersCount: true, notes: true,
        },
        orderBy: { plannedStartDate: "asc" },
      },
      invoices: {
        select: {
          id: true, invoiceNumber: true, invoiceType: true,
          amount: true, taxAmount: true, totalAmount: true,
          invoiceDate: true, dueDate: true, status: true, paidAmount: true, notes: true,
        },
        orderBy: { invoiceDate: "desc" },
      },
    },
    orderBy: { contractDate: "asc" },
  })

  const serialized = contracts.map((c) => {
    const co = c.project.branch.company
    return {
      id: c.id,
      contractNumber: c.contractNumber,
      status: c.status,
      contractAmount: Number(c.contractAmount),
      taxAmount: Number(c.taxAmount),
      totalAmount: Number(c.totalAmount),
      contractDate: c.contractDate.toISOString(),
      startDate: c.startDate?.toISOString() ?? null,
      endDate: c.endDate?.toISOString() ?? null,
      projectId: c.project.id,
      projectName: c.project.name,
      projectAddress: c.project.address,
      companyId: co.id,
      companyName: co.name,
      taxRate: Number(co.taxRate),
      closingDay: co.paymentClosingDay,
      paymentMonthOffset: co.paymentMonthOffset,
      paymentPayDay: co.paymentPayDay,
      userName: c.estimate.user.name,
      estimateTitle: c.estimate.title,
      estimateType: c.estimate.estimateType,
      works: c.works.map((w) => ({
        id: w.id,
        workType: w.workType,
        workerCount: w.workerCount,
        subcontractorName: w.subcontractor?.name ?? null,
      })),
      schedules: c.schedules.map((s) => ({
        id: s.id,
        workType: s.workType,
        plannedStartDate: s.plannedStartDate?.toISOString() ?? null,
        plannedEndDate: s.plannedEndDate?.toISOString() ?? null,
        actualStartDate: s.actualStartDate?.toISOString() ?? null,
        actualEndDate: s.actualEndDate?.toISOString() ?? null,
        workersCount: s.workersCount,
        notes: s.notes,
      })),
      invoices: c.invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceType: inv.invoiceType,
        amount: Number(inv.amount),
        taxAmount: Number(inv.taxAmount),
        totalAmount: Number(inv.totalAmount),
        invoiceDate: inv.invoiceDate.toISOString(),
        dueDate: inv.dueDate?.toISOString() ?? null,
        status: inv.status,
        paidAmount: inv.paidAmount ? Number(inv.paidAmount) : null,
        notes: inv.notes,
      })),
    }
  })

  return <InvoiceList contracts={serialized} currentUser={dbUser} />
}

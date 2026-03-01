/**
 * [PAGE] 契約詳細 (/contracts/:id)
 *
 * 契約の基本情報・工事区分・発注管理を表示する。
 */
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import { ContractDetail } from "@/components/contracts/ContractDetail"

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { id } = await params

  const [dbUser, contract] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    prisma.contract.findUnique({
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
        works: {
          include: { subcontractor: true },
          orderBy: { createdAt: "asc" },
        },
        schedules: {
          orderBy: [{ workType: "asc" }, { plannedStartDate: "asc" }],
        },
        invoices: {
          select: { id: true, status: true },
        },
        subcontractorPayments: {
          include: { subcontractor: { select: { id: true, name: true } } },
          orderBy: { paymentDueDate: "asc" },
        },
      },
    }),
  ])

  if (!dbUser) redirect("/login")
  if (!contract) notFound()

  const [siblingContracts, subcontractors] = await Promise.all([
    prisma.contract.findMany({
      where: { projectId: contract.projectId },
      include: {
        estimate: {
          select: {
            id: true,
            estimateNumber: true,
            title: true,
            status: true,
            estimateType: true,
            user: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { contractDate: "asc" },
    }),
    prisma.subcontractor.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
  ])

  const serialized = {
    id: contract.id,
    contractNumber: contract.contractNumber,
    status: contract.status,
    contractAmount: Number(contract.contractAmount),
    taxAmount: Number(contract.taxAmount),
    totalAmount: Number(contract.totalAmount),
    contractDate: contract.contractDate.toISOString(),
    startDate: contract.startDate?.toISOString() ?? null,
    endDate: contract.endDate?.toISOString() ?? null,
    paymentTerms: contract.paymentTerms,
    note: contract.note,
    createdAt: contract.createdAt.toISOString(),
    project: {
      id: contract.project.id,
      name: contract.project.name,
      address: contract.project.address,
      branch: {
        name: contract.project.branch.name,
        company: {
          id: contract.project.branch.company.id,
          name: contract.project.branch.company.name,
          phone: contract.project.branch.company.phone,
          taxRate: Number(contract.project.branch.company.taxRate),
        },
      },
      contact: contract.project.contact
        ? { name: contract.project.contact.name, phone: contract.project.contact.phone, email: contract.project.contact.email }
        : null,
    },
    estimate: {
      id: contract.estimate.id,
      estimateNumber: contract.estimate.estimateNumber,
      user: contract.estimate.user,
      sections: contract.estimate.sections.map((sec) => ({
        id: sec.id,
        name: sec.name,
        groups: sec.groups.map((grp) => ({
          id: grp.id,
          name: grp.name,
          items: grp.items.map((item) => ({
            id: item.id,
            name: item.name,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            unit: { name: item.unit.name },
          })),
        })),
      })),
    },
    works: contract.works.map((w) => ({
      id: w.id,
      workType: w.workType,
      workerCount: w.workerCount,
      workDays: w.workDays,
      subcontractorId: w.subcontractorId,
      orderAmount: w.orderAmount ? Number(w.orderAmount) : null,
      orderTaxAmount: w.orderTaxAmount ? Number(w.orderTaxAmount) : null,
      orderTotalAmount: w.orderTotalAmount ? Number(w.orderTotalAmount) : null,
      orderStatus: w.orderStatus,
      orderedAt: w.orderedAt?.toISOString() ?? null,
      note: w.note,
      createdAt: w.createdAt.toISOString(),
      subcontractor: w.subcontractor
        ? {
            id: w.subcontractor.id,
            name: w.subcontractor.name,
            representative: w.subcontractor.representative,
            address: w.subcontractor.address,
            phone: w.subcontractor.phone,
          }
        : null,
    })),
    schedules: contract.schedules.map((s) => ({
      id: s.id,
      contractId: s.contractId,
      workType: s.workType,
      plannedStartDate: s.plannedStartDate?.toISOString() ?? null,
      plannedEndDate: s.plannedEndDate?.toISOString() ?? null,
      actualStartDate: s.actualStartDate?.toISOString() ?? null,
      actualEndDate: s.actualEndDate?.toISOString() ?? null,
      workersCount: s.workersCount,
      notes: s.notes,
    })),
    invoices: contract.invoices.map((inv) => ({
      id: inv.id,
      status: inv.status,
    })),
    subcontractorPayments: contract.subcontractorPayments.map((sp) => ({
      id: sp.id,
      subcontractorId: sp.subcontractorId,
      subcontractorName: sp.subcontractor.name,
      orderAmount: Number(sp.orderAmount),
      taxAmount: Number(sp.taxAmount),
      totalAmount: Number(sp.totalAmount),
      closingDate: sp.closingDate?.toISOString() ?? null,
      paymentDueDate: sp.paymentDueDate?.toISOString() ?? null,
      paymentDate: sp.paymentDate?.toISOString() ?? null,
      paymentAmount: sp.paymentAmount ? Number(sp.paymentAmount) : null,
      status: sp.status,
      notes: sp.notes,
    })),
  }

  const serializedSubs = subcontractors.map((s) => ({
    id: s.id,
    name: s.name,
    representative: s.representative,
    address: s.address,
    phone: s.phone,
  }))

  const serializedSiblings = siblingContracts.map((sc) => ({
    id: sc.id,
    contractNumber: sc.contractNumber,
    status: sc.status,
    contractAmount: Number(sc.contractAmount),
    taxAmount: Number(sc.taxAmount),
    totalAmount: Number(sc.totalAmount),
    contractDate: sc.contractDate.toISOString(),
    estimate: {
      id: sc.estimate.id,
      estimateNumber: sc.estimate.estimateNumber,
      title: sc.estimate.title,
      status: sc.estimate.status,
      estimateType: sc.estimate.estimateType,
      user: sc.estimate.user,
    },
  }))

  return (
    <ContractDetail
      contract={serialized}
      siblingContracts={serializedSiblings}
      subcontractors={serializedSubs}
      currentUser={dbUser}
    />
  )
}

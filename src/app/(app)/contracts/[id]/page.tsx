/**
 * [PAGE] 契約詳細 (/contracts/:id)
 *
 * 契約の基本情報・工事区分・発注管理を表示する。
 */
import type { Metadata } from "next"

export const metadata: Metadata = { title: "契約詳細" }

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
        contractEstimates: {
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
        },
        works: {
          include: { subcontractor: true },
          orderBy: { createdAt: "asc" },
        },
        schedules: {
          orderBy: [{ workType: "asc" }, { plannedStartDate: "asc" }],
          include: { workContent: { select: { id: true, name: true } } },
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

  const [siblingContracts, subcontractors, scheduleWorkTypes] = await Promise.all([
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
        contractEstimates: {
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
        },
      },
      orderBy: { contractDate: "asc" },
    }),
    prisma.subcontractor.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.scheduleWorkTypeMaster.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }).catch(() => [] as { id: string; code: string; label: string; shortLabel: string; colorIndex: number; sortOrder: number; isDefault: boolean }[]),
  ])

  // 見積データのシリアライズヘルパー
  function serializeEstimateSections(est: { id: string; estimateNumber: string | null; user: { id: string; name: string }; sections: Array<{ id: string; name: string; groups: Array<{ id: string; name: string; items: Array<{ id: string; name: string; quantity: any; unitPrice: any; unit: { name: string } }> }> }> }) {
    return {
      id: est.id,
      estimateNumber: est.estimateNumber,
      user: est.user,
      sections: est.sections.map((sec) => ({
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
    }
  }

  // 単体契約: estimate を使用、一括契約: contractEstimates の先頭を使用
  const firstEstimate = contract.estimate ?? contract.contractEstimates[0]?.estimate ?? null

  const serialized = {
    id: contract.id,
    contractNumber: contract.contractNumber,
    name: contract.name,
    status: contract.status,
    contractAmount: Number(contract.contractAmount),
    taxAmount: Number(contract.taxAmount),
    totalAmount: Number(contract.totalAmount),
    contractDate: contract.contractDate.toISOString(),
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
    estimate: firstEstimate ? serializeEstimateSections(firstEstimate) : null,
    contractEstimates: contract.contractEstimates.map((ce) => ({
      id: ce.id,
      estimate: {
        id: ce.estimate.id,
        estimateNumber: ce.estimate.estimateNumber,
        title: ce.estimate.title ?? null,
        user: ce.estimate.user,
      },
    })),
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
      estimateId: s.estimateId,
      workContentId: s.workContentId,
      workType: s.workType,
      name: s.name ?? null,
      plannedStartDate: s.plannedStartDate?.toISOString() ?? null,
      plannedEndDate: s.plannedEndDate?.toISOString() ?? null,
      actualStartDate: s.actualStartDate?.toISOString() ?? null,
      actualEndDate: s.actualEndDate?.toISOString() ?? null,
      workersCount: s.workersCount,
      notes: s.notes,
      workContent: s.workContent ? { id: s.workContent.id, name: s.workContent.name } : null,
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

  const serializedWorkTypes = scheduleWorkTypes.map((wt) => ({
    id: wt.id,
    code: wt.code,
    label: wt.label,
    shortLabel: wt.shortLabel,
    colorIndex: wt.colorIndex,
    sortOrder: wt.sortOrder,
    isDefault: wt.isDefault,
  }))

  const serializedSiblings = siblingContracts.map((sc) => {
    const scFirstEst = sc.estimate ?? sc.contractEstimates[0]?.estimate ?? null
    return {
      id: sc.id,
      contractNumber: sc.contractNumber,
      name: sc.name,
      status: sc.status,
      contractAmount: Number(sc.contractAmount),
      taxAmount: Number(sc.taxAmount),
      totalAmount: Number(sc.totalAmount),
      contractDate: sc.contractDate.toISOString(),
      estimate: scFirstEst
        ? {
            id: scFirstEst.id,
            estimateNumber: scFirstEst.estimateNumber,
            title: scFirstEst.title,
            status: scFirstEst.status,
            estimateType: scFirstEst.estimateType,
            user: scFirstEst.user,
          }
        : null,
      estimateCount: sc.estimate ? 1 : sc.contractEstimates.length,
    }
  })

  return (
    <ContractDetail
      contract={serialized}
      siblingContracts={serializedSiblings}
      subcontractors={serializedSubs}
      currentUser={dbUser}
      workTypes={serializedWorkTypes}
    />
  )
}

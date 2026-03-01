/**
 * [PAGE] 支払管理 (/subcontractor-payments)
 */
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { SubcontractorPaymentList } from "@/components/subcontractor-payments/SubcontractorPaymentList"

export default async function SubcontractorPaymentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } })
  if (!dbUser) redirect("/login")

  const [payments, contracts, subcontractors] = await Promise.all([
    prisma.subcontractorPayment.findMany({
      include: {
        subcontractor: { select: { id: true, name: true, representative: true, phone: true } },
        contract: {
          include: {
            project: {
              include: {
                branch: { include: { company: { select: { id: true, name: true } } } },
              },
            },
          },
        },
      },
      orderBy: { paymentDueDate: "asc" },
    }),
    prisma.contract.findMany({
      where: {
        status: { not: "CANCELLED" },
        works: { some: { workType: "SUBCONTRACT" } },
      },
      include: {
        project: {
          include: {
            branch: { include: { company: { select: { id: true, name: true, taxRate: true } } } },
          },
        },
        works: {
          where: { workType: "SUBCONTRACT" },
          include: { subcontractor: { select: { id: true, name: true } } },
        },
      },
      orderBy: { contractDate: "desc" },
    }),
    prisma.subcontractor.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])

  const serializedPayments = payments.map((p) => ({
    id: p.id,
    contractId: p.contractId,
    subcontractorId: p.subcontractorId,
    orderAmount: Number(p.orderAmount),
    taxAmount: Number(p.taxAmount),
    totalAmount: Number(p.totalAmount),
    closingDate: p.closingDate?.toISOString() ?? null,
    paymentDueDate: p.paymentDueDate?.toISOString() ?? null,
    paymentDate: p.paymentDate?.toISOString() ?? null,
    paymentAmount: p.paymentAmount ? Number(p.paymentAmount) : null,
    status: p.status,
    notes: p.notes,
    subcontractor: p.subcontractor,
    contract: {
      id: p.contract.id,
      contractNumber: p.contract.contractNumber,
      projectName: p.contract.project.name,
      companyName: p.contract.project.branch.company.name,
    },
  }))

  const serializedContracts = contracts.map((c) => ({
    id: c.id,
    contractNumber: c.contractNumber,
    projectName: c.project.name,
    companyName: c.project.branch.company.name,
    taxRate: Number(c.project.branch.company.taxRate),
    works: c.works.map((w) => ({
      id: w.id,
      subcontractorId: w.subcontractorId,
      subcontractorName: w.subcontractor?.name ?? null,
      orderAmount: w.orderAmount ? Number(w.orderAmount) : 0,
      orderTaxAmount: w.orderTaxAmount ? Number(w.orderTaxAmount) : 0,
      orderTotalAmount: w.orderTotalAmount ? Number(w.orderTotalAmount) : 0,
    })),
  }))

  return (
    <SubcontractorPaymentList
      payments={serializedPayments}
      contracts={serializedContracts}
      subcontractors={subcontractors}
      currentUser={dbUser}
    />
  )
}

/**
 * [PAGE] 入金管理 (/payments)
 */
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { PaymentList } from "@/components/payments/PaymentList"

export default async function PaymentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } })
  if (!dbUser) redirect("/login")

  const invoices = await prisma.invoice.findMany({
    where: { status: { not: "DRAFT" } },
    include: {
      payments: { orderBy: { paymentDate: "asc" } },
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
    orderBy: { invoiceDate: "desc" },
  })

  const serialized = invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    invoiceType: inv.invoiceType,
    amount: Number(inv.amount),
    taxAmount: Number(inv.taxAmount),
    totalAmount: Number(inv.totalAmount),
    invoiceDate: inv.invoiceDate.toISOString(),
    dueDate: inv.dueDate?.toISOString() ?? null,
    status: inv.status,
    paidAmount: inv.paidAmount ? Number(inv.paidAmount) : 0,
    notes: inv.notes,
    companyId: inv.contract.project.branch.company.id,
    companyName: inv.contract.project.branch.company.name,
    projectName: inv.contract.project.name,
    contractNumber: inv.contract.contractNumber,
    contractId: inv.contractId,
    payments: inv.payments.map((p) => ({
      id: p.id,
      paymentDate: p.paymentDate.toISOString(),
      paymentAmount: Number(p.paymentAmount),
      transferFee: Number(p.transferFee),
      discountAmount: Number(p.discountAmount),
      notes: p.notes,
    })),
  }))

  return <PaymentList invoices={serialized} currentUser={dbUser} />
}

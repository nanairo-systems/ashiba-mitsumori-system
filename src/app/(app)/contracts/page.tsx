/**
 * [PAGE] 契約一覧 (/contracts)
 *
 * DEVELOPER ロール（PC）: 元の ContractList（ステータス別・現場単位）
 * STAFF / ADMIN / モバイル: ContractSummary（集計ビュー）
 * ※ モバイル判定はクライアント側で行う
 */
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { ContractsPageClient } from "@/components/contracts/ContractsPageClient"

export default async function ContractsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } })
  if (!dbUser) redirect("/login")

  const userRole = dbUser.role as "ADMIN" | "STAFF" | "DEVELOPER"

  // ── 集計用データ（STAFF / ADMIN / モバイル向け） ──
  const start = new Date("2026-01-01T00:00:00.000Z")
  const end = new Date("2026-12-31T23:59:59.999Z")

  const summaryContracts = await prisma.contract.findMany({
    where: {
      contractDate: { gte: start, lte: end },
    },
    include: {
      project: {
        include: {
          branch: {
            include: { company: { select: { id: true, name: true } } },
          },
        },
      },
    },
    orderBy: { contractDate: "asc" },
  })

  const summaryData = summaryContracts.map((c) => ({
    id: c.id,
    contractDate: c.contractDate.toISOString(),
    contractAmount: Number(c.contractAmount),
    taxAmount: Number(c.taxAmount),
    totalAmount: Number(c.totalAmount),
    startDate: c.startDate?.toISOString() ?? null,
    endDate: c.endDate?.toISOString() ?? null,
    name: c.name,
    projectName: c.project.name,
    companyId: c.project.branch.company.id,
    companyName: c.project.branch.company.name,
  }))

  // ── 一覧用データ（DEVELOPER 向け） ──
  let listData: Parameters<typeof ContractsPageClient>[0]["listContracts"] = null

  if (userRole === "DEVELOPER") {
    const listContracts = await prisma.contract.findMany({
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
    })

    listData = listContracts.map((c) => ({
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
      estimate: {
        id: c.estimate.id,
        estimateNumber: c.estimate.estimateNumber,
        title: c.estimate.title,
        user: { id: c.estimate.user.id, name: c.estimate.user.name },
      },
      estimateCount: 1,
      gate: {
        scheduleCount: c.schedules.length,
        hasActualStart: c.schedules.some((s) => s.actualStartDate !== null),
        allActualEnd: c.schedules.length > 0 && c.schedules.every((s) => s.actualEndDate !== null),
        invoiceCount: c.invoices.length,
        allInvoicesPaid: c.invoices.length > 0 && c.invoices.every((inv) => inv.status === "PAID"),
      },
    }))
  }

  return (
    <ContractsPageClient
      userRole={userRole}
      currentUser={{ id: dbUser.id, name: dbUser.name }}
      summaryContracts={summaryData}
      listContracts={listData}
    />
  )
}

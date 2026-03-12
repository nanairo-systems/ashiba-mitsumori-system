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
      estimate: c.estimate
        ? {
            id: c.estimate.id,
            estimateNumber: c.estimate.estimateNumber,
            title: c.estimate.title,
            user: { id: c.estimate.user.id, name: c.estimate.user.name },
          }
        : null,
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

  // ── 工種マスター ──
  let scheduleWorkTypes: { id: string; code: string; label: string; shortLabel: string; colorIndex: number; sortOrder: number; isDefault: boolean }[] = []
  try {
    scheduleWorkTypes = await prisma.scheduleWorkTypeMaster.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    })
  } catch {
    // テーブル未作成時のフォールバック
    scheduleWorkTypes = [
      { id: "default-1", code: "ASSEMBLY", label: "組立", shortLabel: "組", colorIndex: 0, sortOrder: 0, isDefault: true },
      { id: "default-2", code: "DISASSEMBLY", label: "解体", shortLabel: "解", colorIndex: 1, sortOrder: 1, isDefault: true },
      { id: "default-3", code: "REWORK", label: "その他", shortLabel: "他", colorIndex: 2, sortOrder: 2, isDefault: true },
    ]
  }
  const workTypesData = scheduleWorkTypes.map((wt) => ({
    id: wt.id,
    code: wt.code,
    label: wt.label,
    shortLabel: wt.shortLabel,
    colorIndex: wt.colorIndex,
    sortOrder: wt.sortOrder,
    isDefault: wt.isDefault,
  }))

  return (
    <ContractsPageClient
      userRole={userRole}
      currentUser={{ id: dbUser.id, name: dbUser.name }}
      summaryContracts={summaryData}
      listContracts={listData}
      workTypes={workTypesData}
    />
  )
}

/**
 * [PAGE] 契約集計 (/contracts)
 *
 * 契約の集計・グラフ・月別一覧を表示。
 * 会社別一覧から個別契約のスライドオーバー詳細も確認可能。
 */
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { ContractSummary } from "@/components/contracts/ContractSummary"

export default async function ContractsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } })
  if (!dbUser) redirect("/login")

  const start = new Date("2026-01-01T00:00:00.000Z")
  const end = new Date("2026-12-31T23:59:59.999Z")

  const contracts = await prisma.contract.findMany({
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

  const serialized = contracts.map((c) => ({
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

  return <ContractSummary contracts={serialized} />
}

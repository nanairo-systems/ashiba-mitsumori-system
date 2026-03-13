import type { Metadata } from "next"

export const metadata: Metadata = { title: "契約サマリー" }

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ContractSummary } from "@/components/contracts/ContractSummary"
import { prisma } from "@/lib/prisma"

export default async function ContractSummaryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

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

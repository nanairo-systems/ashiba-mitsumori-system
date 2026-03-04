/**
 * [API] 契約集計 (/api/contracts/summary)
 * 2026年の契約データを月別・会社別に集計して返す
 */
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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

  return NextResponse.json(serialized)
}

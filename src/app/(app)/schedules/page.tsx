/**
 * [PAGE] 工期管理 (/schedules)
 *
 * 全契約案件の工程（組立・解体・その他）をガントチャート形式で表示する。
 */
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { ScheduleGantt } from "@/components/schedules/ScheduleGantt"

export default async function SchedulesPage({
  searchParams,
}: {
  searchParams: Promise<{ contractId?: string }>
}) {
  const { contractId } = await searchParams
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
          branch: { include: { company: { select: { id: true, name: true } } } },
        },
      },
      schedules: {
        orderBy: [{ workType: "asc" }, { plannedStartDate: "asc" }],
      },
    },
    orderBy: { contractDate: "desc" },
  })

  const serialized = contracts.map((c) => ({
    id: c.id,
    contractNumber: c.contractNumber,
    status: c.status,
    startDate: c.startDate?.toISOString() ?? null,
    endDate: c.endDate?.toISOString() ?? null,
    project: {
      id: c.project.id,
      name: c.project.name,
      companyName: c.project.branch.company.name,
    },
    schedules: c.schedules.map((s) => ({
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
  }))

  return <ScheduleGantt contracts={serialized} currentUser={dbUser} focusContractId={contractId ?? undefined} />
}

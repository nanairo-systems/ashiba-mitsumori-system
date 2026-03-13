/**
 * [PAGE] 工期管理 (/schedules)
 *
 * 全契約案件の工程をガントチャート形式で表示する。
 */
import type { Metadata } from "next"

export const metadata: Metadata = { title: "工期管理" }

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

  const [dbUser, contracts, workTypes] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    prisma.contract.findMany({
      where: { status: { not: "CANCELLED" } },
      include: {
        project: {
          include: {
            branch: { include: { company: { select: { id: true, name: true } } } },
          },
        },
        schedules: {
          orderBy: [{ workType: "asc" }, { plannedStartDate: "asc" }],
          include: { workContent: { select: { id: true, name: true } } },
        },
      },
      orderBy: { contractDate: "desc" },
    }),
    prisma.scheduleWorkTypeMaster.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }).catch(() => [] as { id: string; code: string; label: string; shortLabel: string; colorIndex: number; sortOrder: number; isDefault: boolean }[]),
  ])
  if (!dbUser) redirect("/login")

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
  }))

  const serializedWorkTypes = workTypes.map((wt) => ({
    id: wt.id,
    code: wt.code,
    label: wt.label,
    shortLabel: wt.shortLabel,
    colorIndex: wt.colorIndex,
    sortOrder: wt.sortOrder,
    isDefault: wt.isDefault,
  }))

  return (
    <ScheduleGantt
      contracts={serialized}
      currentUser={dbUser}
      focusContractId={contractId ?? undefined}
      workTypes={serializedWorkTypes}
    />
  )
}

/**
 * [PAGE] マスター管理ページ (/masters)
 *
 * 会社・支店・担当者・単位・タグなどのマスターデータを管理する。
 * タブ切り替えで各マスターを表示。
 */
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { MasterManager } from "@/components/masters/MasterManager"

export default async function MastersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [companies, units, tags, subcontractors, scheduleWorkTypes, workers, teams, vehicles, itemCategories, templatesList] = await Promise.all([
    prisma.company.findMany({
      where: { isActive: true },
      include: {
        branches: { where: { isActive: true }, orderBy: { name: "asc" } },
        contacts: {
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true, phone: true, email: true },
        },
      },
      orderBy: [{ furigana: "asc" }, { name: "asc" }],
    }),
    prisma.unit.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.tag.findMany({
      where: { isArchived: false },
      orderBy: { name: "asc" },
    }),
    prisma.subcontractor.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, furigana: true, representative: true, address: true, phone: true, email: true },
    }),
    prisma.scheduleWorkTypeMaster.findMany({
      orderBy: { sortOrder: "asc" },
    }).catch(() => [] as { id: string; code: string; label: string; shortLabel: string; colorIndex: number; sortOrder: number; isDefault: boolean; isActive: boolean; createdAt: Date; updatedAt: Date }[]),
    prisma.worker.findMany({
      include: { subcontractors: { select: { id: true, name: true } } },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    prisma.team.findMany({
      include: {
        workers: { select: { id: true, name: true } },
        subcontractors: { select: { id: true, name: true } },
      },
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }],
    }),
    prisma.vehicle.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    prisma.itemCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        items: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          include: { unit: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.template.findMany({
      where: { isArchived: false },
      select: { id: true, name: true, description: true },
      orderBy: { name: "asc" },
    }),
  ])

  // Decimal → number 変換
  const serializedCompanies = companies.map((c) => ({
    ...c,
    taxRate: Number(c.taxRate),
  }))

  const serializedWorkTypes = scheduleWorkTypes.map((wt) => ({
    id: wt.id,
    code: wt.code,
    label: wt.label,
    shortLabel: wt.shortLabel,
    colorIndex: wt.colorIndex,
    sortOrder: wt.sortOrder,
    isDefault: wt.isDefault,
    isActive: wt.isActive,
  }))

  const serializedWorkers = workers.map((w) => ({
    id: w.id,
    name: w.name,
    furigana: w.furigana,
    phone: w.phone,
    email: w.email,
    workerType: w.workerType,
    defaultRole: w.defaultRole,
    subcontractorId: w.subcontractorId,
    isActive: w.isActive,
    subcontractors: w.subcontractors,
  }))

  const serializedTeams = teams.map((t) => ({
    id: t.id,
    name: t.name,
    teamType: t.teamType,
    leaderId: t.leaderId,
    subcontractorId: t.subcontractorId,
    colorCode: t.colorCode,
    sortOrder: t.sortOrder,
    isActive: t.isActive,
    workers: t.workers,
    subcontractors: t.subcontractors,
  }))

  const serializedVehicles = vehicles.map((v) => ({
    id: v.id,
    name: v.name,
    licensePlate: v.licensePlate,
    vehicleType: v.vehicleType,
    capacity: v.capacity,
    inspectionDate: v.inspectionDate ? v.inspectionDate.toISOString() : null,
    isActive: v.isActive,
  }))

  const serializedItemCategories = itemCategories.map((c) => ({
    ...c,
    items: c.items.map((item) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
    })),
  }))

  return (
    <MasterManager
      companies={serializedCompanies}
      units={units}
      tags={tags}
      subcontractors={subcontractors}
      scheduleWorkTypes={serializedWorkTypes}
      workers={serializedWorkers}
      teams={serializedTeams}
      vehicles={serializedVehicles}
      itemCategories={serializedItemCategories}
      templates={templatesList}
    />
  )
}

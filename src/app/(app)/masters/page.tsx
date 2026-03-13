/**
 * [PAGE] 統合マスター管理ページ (/masters)
 *
 * 足場マスター（9タブ）と経理マスター（4タブ）を統合表示。
 * 全システム（足場・経理・労務）のサイドバーからこのページにアクセスする。
 */
import type { Metadata } from "next"

export const metadata: Metadata = { title: "マスター管理" }

import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { UnifiedMasterManager } from "@/components/masters/UnifiedMasterManager"

export default async function MastersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const dbUser = await prisma.user.findUnique({
    where: { authId: user.id },
    select: { role: true },
  })
  const userRole = (dbUser?.role ?? "STAFF") as "ADMIN" | "STAFF" | "DEVELOPER"

  // ─── 足場マスターデータ取得 ───
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

  // ─── 経理マスターデータ取得 ───
  const [acCompanies, departments, stores, employees] = await Promise.all([
    prisma.accountingCompany.findMany({
      orderBy: { sortOrder: "asc" },
    }),
    prisma.department.findMany({
      include: { company: { select: { id: true, name: true } } },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.store.findMany({
      include: {
        department: {
          select: {
            id: true,
            name: true,
            company: { select: { id: true, name: true, colorCode: true } },
          },
        },
      },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.employee.findMany({
      include: {
        department: {
          include: { company: { select: { id: true, name: true, colorCode: true } } },
        },
        store: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    }),
  ])

  // ─── シリアライズ（足場） ───
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

  // ─── シリアライズ（経理） ───
  const serializedAcCompanies = acCompanies.map((c) => ({
    id: c.id,
    name: c.name,
    colorCode: c.colorCode,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
  }))

  const serializedDepartments = departments.map((d) => ({
    id: d.id,
    companyId: d.companyId,
    name: d.name,
    sortOrder: d.sortOrder,
    isActive: d.isActive,
    company: d.company,
  }))

  const serializedStores = stores.map((s) => ({
    id: s.id,
    departmentId: s.departmentId,
    name: s.name,
    sortOrder: s.sortOrder,
    isActive: s.isActive,
    department: {
      id: s.department.id,
      name: s.department.name,
      company: s.department.company,
    },
  }))

  const serializedEmployees = employees.map((e) => ({
    id: e.id,
    name: e.name,
    departmentId: e.departmentId,
    storeId: e.storeId,
    phone: e.phone,
    email: e.email,
    position: e.position,
    note: e.note,
    isActive: e.isActive,
    department: e.department ? {
      id: e.department.id,
      name: e.department.name,
      company: e.department.company,
    } : null,
    store: e.store,
  }))

  return (
    <UnifiedMasterManager
      scaffold={{
        companies: serializedCompanies,
        units,
        tags,
        subcontractors,
        scheduleWorkTypes: serializedWorkTypes,
        workers: serializedWorkers,
        teams: serializedTeams,
        vehicles: serializedVehicles,
        itemCategories: serializedItemCategories,
        templates: templatesList,
      }}
      accounting={{
        initialCompanies: serializedAcCompanies,
        initialDepartments: serializedDepartments,
        initialStores: serializedStores,
        initialEmployees: serializedEmployees,
        userRole,
      }}
    />
  )
}

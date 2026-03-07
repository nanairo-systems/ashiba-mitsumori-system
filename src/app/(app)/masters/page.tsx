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

  const [companies, units, tags, subcontractors, scheduleWorkTypes] = await Promise.all([
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

  return <MasterManager companies={serializedCompanies} units={units} tags={tags} subcontractors={subcontractors} scheduleWorkTypes={serializedWorkTypes} />
}

/**
 * [PAGE] 新規見積作成ページ (/estimates/new)
 *
 * 現場を選択して見積を新規作成する。
 * テンプレートの選択も可能（任意）。
 */
import type { Metadata } from "next"

export const metadata: Metadata = { title: "新規見積作成" }

import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { NewEstimateForm } from "@/components/estimates/NewEstimateForm"

export default async function NewEstimatePage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>
}) {
  const resolvedParams = await searchParams
  const presetProjectId = resolvedParams.projectId ?? undefined
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [projects, templates, companies, dbUser] = await Promise.all([
    prisma.project.findMany({
      where: { isArchived: false },
      include: {
        branch: { include: { company: true } },
        contact: true,
        _count: { select: { estimates: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.template.findMany({
      where: { isArchived: false },
      orderBy: { name: "asc" },
      include: {
        sections: {
          orderBy: { sortOrder: "asc" },
          include: {
            groups: {
              orderBy: { sortOrder: "asc" },
              include: {
                items: {
                  orderBy: { sortOrder: "asc" },
                  include: { unit: { select: { name: true } } },
                },
              },
            },
          },
        },
      },
    }),
    prisma.company.findMany({
      where: { isActive: true },
      include: {
        branches: { where: { isActive: true }, orderBy: { name: "asc" } },
        contacts: { where: { isActive: true }, orderBy: { name: "asc" } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.user.findUnique({ where: { authId: user.id } }),
  ])

  if (!dbUser) redirect("/login")

  // Decimal → number 変換（Server→Client シリアライズエラー対策）
  const serializedTemplates = templates.map((t) => ({
    ...t,
    sections: t.sections.map((sec) => ({
      ...sec,
      groups: sec.groups.map((grp) => ({
        ...grp,
        items: grp.items.map((item) => ({
          ...item,
          quantity: item.quantity != null ? Number(item.quantity) : 0,
          unitPrice: Number(item.unitPrice),
        })),
      })),
    })),
  }))

  // companies の Decimal/Date を plain object に変換
  const serializedCompanies = companies.map((c) => ({
    id: c.id,
    name: c.name,
    branches: c.branches.map((b) => ({ id: b.id, name: b.name })),
    contacts: c.contacts.map((ct) => ({
      id: ct.id,
      name: ct.name,
      phone: ct.phone ?? "",
      email: ct.email ?? "",
    })),
  }))

  // projects の Decimal/Date を plain object に変換
  const serializedProjects = projects.map((p) => ({
    id: p.id,
    name: p.name,
    branch: {
      name: p.branch.name,
      company: { name: p.branch.company.name },
    },
    contact: p.contact ? { name: p.contact.name } : null,
    estimateCount: p._count.estimates,
  }))

  return (
    <NewEstimateForm
      projects={serializedProjects}
      templates={serializedTemplates}
      companies={serializedCompanies}
      currentUser={dbUser}
      presetProjectId={presetProjectId}
    />
  )
}

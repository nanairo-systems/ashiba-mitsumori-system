/**
 * [PAGE] 現場詳細ページ (/projects/:id)
 *
 * 現場の情報と見積一覧を表示。
 * テンプレート一覧も取得して「新規見積作成ダイアログ」に渡す。
 * Decimal 型は number に変換してクライアントへ渡す。
 */
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import { ProjectDetail } from "@/components/projects/ProjectDetail"

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ newEstimate?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { id } = await params
  const { newEstimate } = await searchParams
  const autoOpenDialog = newEstimate === "1"

  const [project, dbUser, templates] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: {
        branch: { include: { company: { include: { contacts: { where: { isActive: true }, orderBy: { name: "asc" } } } } } },
        contact: true,
        estimates: {
          where: { status: { not: "OLD" } },
          orderBy: [{ estimateType: "asc" }, { createdAt: "asc" }],
          include: {
            user: { select: { name: true } },
            contract: { select: { id: true, status: true } },
            sections: {
              include: {
                groups: {
                  include: { items: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.user.findUnique({ where: { authId: user.id } }),
    // テンプレート一覧（ダイアログの選択肢・プレビューに使う）
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
  ])

  if (!project || !dbUser) notFound()

  // 会社の担当者一覧（編集ダイアログ用）
  const contacts = project.branch.company.contacts.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone ?? "",
    email: c.email ?? "",
  }))

  // Decimal を number に変換
  const serializedProject = {
    ...project,
    branch: {
      ...project.branch,
      company: {
        id: project.branch.company.id,
        name: project.branch.company.name,
        taxRate: Number(project.branch.company.taxRate),
      },
    },
    estimates: project.estimates.map((est) => ({
      ...est,
      contract: est.contract ? { id: est.contract.id, status: est.contract.status } : null,
      sections: est.sections.map((sec) => ({
        ...sec,
        groups: sec.groups.map((grp) => ({
          ...grp,
          items: grp.items.map((item) => ({
            ...item,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
          })),
        })),
      })),
    })),
  }

  const serializedTemplates = templates.map((tpl) => ({
    ...tpl,
    sections: tpl.sections.map((sec) => ({
      ...sec,
      groups: sec.groups.map((grp) => ({
        ...grp,
        items: grp.items.map((item) => ({
          ...item,
          quantity: Number(item.quantity ?? 1),
          unitPrice: Number(item.unitPrice),
        })),
      })),
    })),
  }))

  return (
    <ProjectDetail
      project={serializedProject}
      templates={serializedTemplates}
      currentUser={dbUser}
      autoOpenDialog={autoOpenDialog}
      contacts={contacts}
    />
  )
}

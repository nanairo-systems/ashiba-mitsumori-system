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

  const [project, dbUser, templates, units] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: {
        branch: { include: { company: { include: { contacts: { where: { isActive: true }, orderBy: { name: "asc" } } } } } },
        contact: true,
        estimates: {
          orderBy: [{ estimateType: "asc" }, { createdAt: "asc" }],
          include: {
            user: { select: { id: true, name: true } },
            contract: { select: { id: true, status: true } },
            sections: {
              orderBy: { sortOrder: "asc" },
              include: {
                groups: {
                  orderBy: { sortOrder: "asc" },
                  include: {
                    items: {
                      orderBy: { sortOrder: "asc" },
                      include: { unit: { select: { id: true, name: true } } },
                    },
                  },
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
    prisma.unit.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ])

  // EstimateBundleテーブルが未作成の場合に備えてエラー耐性を持たせる
  let estimateBundles: Awaited<ReturnType<typeof prisma.estimateBundle.findMany>> = []
  try {
    estimateBundles = await prisma.estimateBundle.findMany({
      where: { projectId: id },
      include: {
        items: {
          include: {
            estimate: { select: { id: true, estimateNumber: true, title: true } },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    })
  } catch {
    // テーブル未作成時は空配列で続行
  }

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
    contact: project.contact
      ? { id: project.contact.id, name: project.contact.name, phone: project.contact.phone ?? "", email: project.contact.email ?? "" }
      : null,
    estimates: project.estimates.map((est) => ({
      ...est,
      discountAmount: est.discountAmount ? Number(est.discountAmount) : null,
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

  const taxRate = Number(project.branch.company.taxRate)

  const serializedBundles = estimateBundles.map((b) => ({
    id: b.id,
    bundleNumber: b.bundleNumber,
    title: b.title,
    createdAt: b.createdAt.toISOString(),
    items: b.items.map((bi) => ({
      estimateId: bi.estimateId,
      estimateNumber: bi.estimate.estimateNumber,
      title: bi.estimate.title,
    })),
  }))

  return (
    <ProjectDetail
      project={serializedProject}
      templates={serializedTemplates}
      currentUser={dbUser}
      autoOpenDialog={autoOpenDialog}
      contacts={contacts}
      units={units}
      taxRate={taxRate}
      estimateBundles={serializedBundles}
    />
  )
}

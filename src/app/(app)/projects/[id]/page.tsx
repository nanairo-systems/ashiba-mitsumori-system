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
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { id } = await params

  const [project, dbUser, templates] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: {
        branch: { include: { company: true } },
        contact: true,
        estimates: {
          orderBy: [{ revision: "desc" }],
          include: {
            user: { select: { name: true } },
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
    // テンプレート一覧（ダイアログの選択肢に使う）
    prisma.template.findMany({
      where: { isArchived: false },
      orderBy: { name: "asc" },
      include: {
        sections: {
          include: {
            groups: {
              include: { items: true },
            },
          },
        },
      },
    }),
  ])

  if (!project || !dbUser) notFound()

  // Decimal を number に変換
  const serializedProject = {
    ...project,
    estimates: project.estimates.map((est) => ({
      ...est,
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
    />
  )
}

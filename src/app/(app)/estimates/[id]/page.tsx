/**
 * [PAGE] 見積詳細ページ (/estimates/:id)
 *
 * Prisma の Decimal 型はクライアントコンポーネントに渡せないため、
 * このページで JSON シリアライズして渡す。
 */
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import { EstimateDetail } from "@/components/estimates/EstimateDetail"

export default async function EstimateDetailPage({
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

  const [estimate, dbUser, units] = await Promise.all([
    prisma.estimate.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            branch: { include: { company: { include: { contacts: { where: { isActive: true }, orderBy: { name: "asc" } } } } } },
            contact: true,
          },
        },
        user: { select: { id: true, name: true } },
        sections: {
          orderBy: { sortOrder: "asc" },
          include: {
            groups: {
              orderBy: { sortOrder: "asc" },
              include: {
                items: {
                  orderBy: { sortOrder: "asc" },
                  include: { unit: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.user.findUnique({ where: { authId: user.id } }),
    prisma.unit.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ])

  if (!estimate || !dbUser) notFound()

  const taxRate = Number(estimate.project.branch.company.taxRate)

  // 会社の担当者一覧（編集ダイアログ用）
  const contacts = estimate.project.branch.company.contacts.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone ?? "",
    email: c.email ?? "",
  }))

  // Decimal 型を number に変換（クライアントコンポーネントへの受け渡しに必要）
  const serialized = {
    ...estimate,
    discountAmount: estimate.discountAmount ? Number(estimate.discountAmount) : null,
    project: {
      ...estimate.project,
      branch: {
        ...estimate.project.branch,
        company: {
          id: estimate.project.branch.company.id,
          name: estimate.project.branch.company.name,
          taxRate: Number(estimate.project.branch.company.taxRate),
        },
      },
    },
    sections: estimate.sections.map((sec) => ({
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
  }

  return (
    <EstimateDetail
      estimate={serialized}
      taxRate={taxRate}
      units={units}
      currentUser={dbUser}
      contacts={contacts}
    />
  )
}

/**
 * [PAGE] ダッシュボード - 現場・見積一覧 (/)
 *
 * 認証済みユーザーの現場一覧を会社別にグループ化して表示する。
 * 各現場の最新見積（OLD以外）の合計金額・担当者・契約状態も取得する。
 */
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { ProjectList } from "@/components/projects/ProjectList"

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const dbUser = await prisma.user.findUnique({
    where: { authId: user.id },
  })

  if (!dbUser) redirect("/login")

  const projects = await prisma.project.findMany({
    where: { isArchived: false },
    include: {
      branch: { include: { company: true } },
      contact: true,
      estimates: {
        where: { status: { not: "OLD" } },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          user: { select: { id: true, name: true } },
          contract: { select: { id: true, status: true } },
          sections: {
            include: {
              groups: {
                include: {
                  items: { select: { quantity: true, unitPrice: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [
      { branch: { company: { name: "asc" } } },
      { updatedAt: "desc" },
    ],
  })

  // Decimal → number 変換 + 見積合計を計算して渡す
  const serialized = projects.map((p) => {
    const est = p.estimates[0]
    let totalAmount: number | null = null
    if (est) {
      let subtotal = 0
      for (const sec of est.sections) {
        for (const grp of sec.groups) {
          for (const item of grp.items) {
            subtotal += Number(item.quantity) * Number(item.unitPrice)
          }
        }
      }
      const taxRate = Number(p.branch.company.taxRate)
      const discount = 0 // 一覧では値引き前の小計を表示
      const tax = Math.floor(subtotal * taxRate)
      totalAmount = subtotal + tax
    }
    return {
      id: p.id,
      name: p.name,
      isArchived: p.isArchived,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      branch: {
        name: p.branch.name,
        company: {
          id: p.branch.companyId,
          name: p.branch.company.name,
        },
      },
      contact: p.contact ? { name: p.contact.name } : null,
      latestEstimate: est
        ? {
            id: est.id,
            status: est.status,
            confirmedAt: est.confirmedAt,
            createdAt: est.createdAt,
            user: est.user,
            totalAmount,
            contractId: est.contract?.id ?? null,
            contractStatus: est.contract?.status ?? null,
          }
        : null,
    }
  })

  return <ProjectList projects={serialized} currentUser={dbUser} />
}

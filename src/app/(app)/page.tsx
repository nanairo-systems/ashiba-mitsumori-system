/**
 * [PAGE] ダッシュボード - 現場・見積一覧 (/)
 *
 * 認証済みユーザーの現場一覧を会社別にグループ化して表示する。
 * 各現場に紐づく全見積（OLD以外）を取得し、複数見積に対応する。
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

  const [dbUser, projects] = await Promise.all([
    prisma.user.findUnique({ where: { authId: user.id } }),
    prisma.project.findMany({
    where: { isArchived: false },
    include: {
      branch: { include: { company: true } },
      contact: true,
      estimates: {
        // OLD（旧版）・契約済み見積を除外（契約後は契約一覧で管理）
        where: {
          status: { not: "OLD" },
          contract: null,          // 契約が紐づいていない見積のみ
        },
        orderBy: [{ estimateType: "asc" }, { createdAt: "asc" }],
        include: {
          user: { select: { id: true, name: true } },
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
  }),
  ])
  if (!dbUser) redirect("/login")

  // 未契約見積が1件以上ある現場のみを表示対象とする
  const activeProjects = projects.filter((p) => p.estimates.length > 0)

  // Decimal → number 変換 + 各見積の合計金額を計算
  const serialized = activeProjects.map((p) => {
    const taxRate = Number(p.branch.company.taxRate)

    const estimates = p.estimates.map((est, idx) => {
      let subtotal = 0
      for (const sec of est.sections) {
        for (const grp of sec.groups) {
          for (const item of grp.items) {
            subtotal += Number(item.quantity) * Number(item.unitPrice)
          }
        }
      }
      const tax = Math.floor(subtotal * taxRate)
      const totalAmount = subtotal + tax

      // タイトルが未設定の場合、連番で表示する (見積①, 見積②...)
      const displayTitle = est.title ?? (p.estimates.length === 1 ? null : `見積${idx + 1}`)

      return {
        id: est.id,
        title: displayTitle,
        estimateType: est.estimateType,
        status: est.status,
        confirmedAt: est.confirmedAt,
        createdAt: est.createdAt,
        user: est.user,
        totalAmount,
      }
    })

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
          paymentClosingDay: p.branch.company.paymentClosingDay,
          paymentMonthOffset: p.branch.company.paymentMonthOffset,
          paymentPayDay: p.branch.company.paymentPayDay,
          paymentNetDays: p.branch.company.paymentNetDays,
        },
      },
      contact: p.contact ? { name: p.contact.name } : null,
      estimates,
    }
  })

  return <ProjectList projects={serialized} currentUser={dbUser} />
}

/**
 * [PAGE] 一括印刷ページ (/estimates/bulk?ids=a,b,c)
 *
 * 複数の見積書を1ページにまとめて印刷する。
 * 各見積書はA4ページ区切りで表示される。
 */
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import { BulkEstimatePrint } from "@/components/estimates/BulkEstimatePrint"

export default async function BulkEstimatePrintPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { ids: idsParam } = await searchParams
  if (!idsParam) notFound()

  const ids = idsParam.split(",").filter(Boolean)
  if (ids.length === 0) notFound()

  const estimates = await prisma.estimate.findMany({
    where: { id: { in: ids } },
    orderBy: { confirmedAt: "asc" },
    include: {
      project: {
        include: {
          branch: { include: { company: true } },
          contact: true,
        },
      },
      user: { select: { name: true } },
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
  })

  if (estimates.length === 0) notFound()

  const serialized = estimates.map((est) => ({
    ...est,
    discountAmount: est.discountAmount ? Number(est.discountAmount) : null,
    project: {
      ...est.project,
      branch: {
        ...est.project.branch,
        company: {
          ...est.project.branch.company,
          taxRate: Number(est.project.branch.company.taxRate),
        },
      },
    },
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
  }))

  return <BulkEstimatePrint estimates={serialized} />
}

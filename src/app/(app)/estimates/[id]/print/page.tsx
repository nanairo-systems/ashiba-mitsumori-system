/**
 * [PAGE] 見積書 印刷・PDFプレビューページ (/estimates/:id/print)
 *
 * 印刷に最適化されたレイアウトで見積書を表示する。
 * ブラウザの「印刷 → PDFで保存」でPDFとして保存できる。
 * @media print で余計なUIを非表示にする。
 */
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import { EstimatePrint } from "@/components/estimates/EstimatePrint"

export default async function EstimatePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ print?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { id } = await params

  const estimate = await prisma.estimate.findUnique({
    where: { id },
    include: {
      project: {
        include: {
          branch: { include: { company: true } },
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
  })

  if (!estimate) notFound()

  const { print: printParam } = await searchParams

  // DRAFT の場合はプレビューモード。print=1 クエリが付いていても DRAFT は印刷不可。
  const isDraft = estimate.status === "DRAFT"
  // autoPrint: 確定済み（CONFIRMED/SENT）かつ ?print=1 が付いているとき自動印刷
  const autoPrint = !isDraft && printParam === "1"

  const taxRate = Number(estimate.project.branch.company.taxRate)

  // Decimal を number に変換
  const serialized = {
    ...estimate,
    discountAmount: estimate.discountAmount ? Number(estimate.discountAmount) : null,
    project: {
      ...estimate.project,
      branch: {
        ...estimate.project.branch,
        company: {
          ...estimate.project.branch.company,
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
    <EstimatePrint
      estimate={serialized}
      taxRate={taxRate}
      isDraft={isDraft}
      autoPrint={autoPrint}
    />
  )
}

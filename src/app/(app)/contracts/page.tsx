/**
 * [PAGE] 契約一覧 (/contracts)
 *
 * 契約処理済みの案件を一覧表示する。
 * 現場・見積一覧とは分離した専用ページ。
 */
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { ContractList } from "@/components/contracts/ContractList"

export default async function ContractsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const dbUser = await prisma.user.findUnique({
    where: { authId: user.id },
  })
  if (!dbUser) redirect("/login")

  const contracts = await prisma.contract.findMany({
    include: {
      project: {
        include: {
          branch: { include: { company: true } },
          contact: true,
        },
      },
      estimate: {
        select: {
          id: true,
          estimateNumber: true,
          user: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { contractDate: "desc" },
  })

  // Decimal → number 変換、Date/クラスインスタンスを含まない純粋なオブジェクトに変換
  const serialized = contracts.map((c: typeof contracts[number]) => ({
    id: c.id,
    contractNumber: c.contractNumber,
    status: c.status,
    contractAmount: Number(c.contractAmount),
    taxAmount: Number(c.taxAmount),
    totalAmount: Number(c.totalAmount),
    contractDate: c.contractDate,
    startDate: c.startDate,
    endDate: c.endDate,
    paymentTerms: c.paymentTerms,
    note: c.note,
    createdAt: c.createdAt,
    project: {
      id: c.project.id,
      name: c.project.name,
      branch: {
        name: c.project.branch.name,
        company: {
          id: c.project.branch.company.id,
          name: c.project.branch.company.name,
        },
      },
      contact: c.project.contact ? { name: c.project.contact.name } : null,
    },
    estimate: {
      id: c.estimate.id,
      estimateNumber: c.estimate.estimateNumber,
      user: { id: c.estimate.user.id, name: c.estimate.user.name },
    },
  }))

  return <ContractList contracts={serialized} currentUser={dbUser} />
}

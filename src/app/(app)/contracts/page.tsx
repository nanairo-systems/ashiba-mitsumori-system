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

  // Decimal → number 変換
  const serialized = contracts.map((c) => ({
    ...c,
    contractAmount: Number(c.contractAmount),
    taxAmount: Number(c.taxAmount),
    totalAmount: Number(c.totalAmount),
    depositAmount: c.depositAmount ? Number(c.depositAmount) : null,
    project: {
      ...c.project,
      branch: {
        ...c.project.branch,
        company: {
          ...c.project.branch.company,
          taxRate: Number(c.project.branch.company.taxRate),
        },
      },
    },
  }))

  return <ContractList contracts={serialized} currentUser={dbUser} />
}

/**
 * [API] 契約統合 - POST /api/contracts/consolidate
 *
 * 同一プロジェクト内の複数契約を1つの統合契約にまとめる。
 * - 新しい統合契約を作成
 * - 各契約の見積をContractEstimateとして紐づけ
 * - 元の個別契約は削除（工事区分・工程・請求書は統合契約に移行）
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const consolidateSchema = z.object({
  contractIds: z.array(z.string()).min(2, "2件以上の契約を選択してください"),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = consolidateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 })
  }

  const { contractIds } = parsed.data

  // 対象契約を全取得
  const contracts = await prisma.contract.findMany({
    where: { id: { in: contractIds } },
    include: {
      estimate: true,
      contractEstimates: true,
      works: true,
      schedules: true,
      invoices: { include: { payments: true } },
      subcontractorPayments: true,
      project: true,
    },
    orderBy: { contractDate: "asc" },
  })

  if (contracts.length < 2) {
    return NextResponse.json({ error: "2件以上の契約が見つかりません" }, { status: 400 })
  }

  // 同一プロジェクトか確認
  const projectIds = new Set(contracts.map(c => c.projectId))
  if (projectIds.size > 1) {
    return NextResponse.json({ error: "異なるプロジェクトの契約は統合できません" }, { status: 400 })
  }

  // キャンセル済みは除外
  const activeContracts = contracts.filter(c => c.status !== "CANCELLED")
  if (activeContracts.length < 2) {
    return NextResponse.json({ error: "有効な契約が2件以上必要です" }, { status: 400 })
  }

  // 金額合計
  let totalContractAmount = BigInt(0)
  let totalTaxAmount = BigInt(0)
  let totalTotalAmount = BigInt(0)

  // Decimalの合算（Prismaから返るDecimalをBigInt変換してから集計）
  for (const c of activeContracts) {
    totalContractAmount += BigInt(Math.round(Number(c.contractAmount) * 100))
    totalTaxAmount += BigInt(Math.round(Number(c.taxAmount) * 100))
    totalTotalAmount += BigInt(Math.round(Number(c.totalAmount) * 100))
  }

  const contractAmountNum = Number(totalContractAmount) / 100
  const taxAmountNum = Number(totalTaxAmount) / 100
  const totalAmountNum = Number(totalTotalAmount) / 100

  // 最も早い契約日・工期
  const earliestContract = activeContracts[0]
  const startDates = activeContracts.map(c => c.startDate).filter(Boolean) as Date[]
  const endDates = activeContracts.map(c => c.endDate).filter(Boolean) as Date[]
  const earliestStart = startDates.length > 0 ? new Date(Math.min(...startDates.map(d => d.getTime()))) : null
  const latestEnd = endDates.length > 0 ? new Date(Math.max(...endDates.map(d => d.getTime()))) : null

  // 契約番号生成
  const now = new Date()
  const prefix = `C-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`
  const lastContract = await prisma.contract.findFirst({
    where: { contractNumber: { startsWith: prefix } },
    orderBy: { contractNumber: "desc" },
  })
  const seq = lastContract?.contractNumber
    ? parseInt(lastContract.contractNumber.split("-")[2] || "0", 10) + 1
    : 1
  const contractNumber = `${prefix}-${String(seq).padStart(3, "0")}`

  // 見積IDを収集
  const estimateIds: string[] = []
  for (const c of activeContracts) {
    if (c.estimateId) {
      estimateIds.push(c.estimateId)
    }
    for (const ce of c.contractEstimates) {
      estimateIds.push(ce.estimateId)
    }
  }

  // 統合名称
  const name = earliestContract.name || activeContracts[0].project.name

  // トランザクションで実行
  const result = await prisma.$transaction(async (tx) => {
    // 1. 統合契約を作成
    const newContract = await tx.contract.create({
      data: {
        contractNumber,
        name,
        projectId: earliestContract.projectId,
        estimateId: null, // 統合契約はestimateId = NULL
        status: earliestContract.status,
        contractAmount: contractAmountNum,
        taxAmount: taxAmountNum,
        totalAmount: totalAmountNum,
        contractDate: earliestContract.contractDate,
        startDate: earliestStart,
        endDate: latestEnd,
        paymentTerms: earliestContract.paymentTerms,
        note: activeContracts.map(c => c.note).filter(Boolean).join("\n") || null,
      },
    })

    // 2. ContractEstimate を作成
    for (const estId of estimateIds) {
      await tx.contractEstimate.create({
        data: {
          contractId: newContract.id,
          estimateId: estId,
        },
      })
    }

    // 3. 工事区分を移行
    for (const c of activeContracts) {
      for (const w of c.works) {
        await tx.contractWork.update({
          where: { id: w.id },
          data: { contractId: newContract.id },
        })
      }
    }

    // 4. 工程を移行
    for (const c of activeContracts) {
      for (const s of c.schedules) {
        await tx.constructionSchedule.update({
          where: { id: s.id },
          data: { contractId: newContract.id },
        })
      }
    }

    // 5. 請求書を移行
    for (const c of activeContracts) {
      for (const inv of c.invoices) {
        await tx.invoice.update({
          where: { id: inv.id },
          data: { contractId: newContract.id },
        })
      }
    }

    // 6. 下請支払を移行
    for (const c of activeContracts) {
      for (const sp of c.subcontractorPayments) {
        await tx.subcontractorPayment.update({
          where: { id: sp.id },
          data: { contractId: newContract.id },
        })
      }
    }

    // 7. 元の個別契約を削除（関連レコードは移行済み）
    for (const c of activeContracts) {
      // まずcontractEstimatesを削除
      await tx.contractEstimate.deleteMany({
        where: { contractId: c.id },
      })
      await tx.contract.delete({
        where: { id: c.id },
      })
    }

    return newContract
  })

  return NextResponse.json({ id: result.id, contractNumber: result.contractNumber })
}

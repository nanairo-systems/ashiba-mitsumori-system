/**
 * [API] 一括契約処理 - POST /api/contracts/bulk
 *
 * 複数の見積（CONFIRMED / SENT）を1つの契約にまとめる。
 * 契約名（現場名）と総合金額を指定して、1件の契約を作成。
 * 各見積は ContractEstimate 中間テーブルで紐付ける。
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const bulkContractSchema = z.object({
  name: z.string().min(1, "契約名を入力してください").max(100),
  estimateIds: z.array(z.string().uuid()).min(1, "見積を1件以上選択してください"),
  contractAmount: z.number().nonnegative("契約金額は0以上を指定してください"),
  paymentType: z.enum(["FULL", "TWO_PHASE", "PROGRESS"]).default("FULL"),
  contractDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  paymentTerms: z.string().max(200).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
})

/** 契約番号を採番: C-YYMM-NNN 形式 */
async function generateContractNumber(): Promise<string> {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const prefix = `C-${yy}${mm}-`

  const latest = await prisma.contract.findFirst({
    where: { contractNumber: { startsWith: prefix } },
    orderBy: { contractNumber: "desc" },
    select: { contractNumber: true },
  })

  let seq = 1
  if (latest?.contractNumber) {
    const n = parseInt(latest.contractNumber.slice(prefix.length), 10)
    if (!isNaN(n)) seq = n + 1
  }

  return `${prefix}${String(seq).padStart(3, "0")}`
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = bulkContractSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", detail: parsed.error.flatten() }, { status: 400 })
  }

  const { name, estimateIds, contractAmount, paymentType, contractDate, startDate, endDate, paymentTerms, note } = parsed.data

  // 対象見積を一括取得
  const estimates = await prisma.estimate.findMany({
    where: { id: { in: estimateIds } },
    include: {
      contract: { select: { id: true } },
      contractEstimates: { select: { id: true } },
      project: {
        include: {
          branch: {
            include: {
              company: { select: { taxRate: true } },
            },
          },
        },
      },
    },
  })

  // バリデーション
  const errors: string[] = []
  for (const est of estimates) {
    if (est.status !== "CONFIRMED" && est.status !== "SENT") {
      errors.push(`見積「${est.id}」は確定済みまたは送付済みではありません`)
    }
    if (est.contract) {
      errors.push(`見積「${est.id}」にはすでに契約が紐付いています`)
    }
    if (est.contractEstimates.length > 0) {
      errors.push(`見積「${est.id}」にはすでに一括契約が紐付いています`)
    }
  }
  if (estimates.length !== estimateIds.length) {
    errors.push("一部の見積が見つかりませんでした")
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" / ") }, { status: 422 })
  }

  // 税率は最初の見積の会社から取得
  const taxRate = Number(estimates[0].project.branch.company.taxRate)
  const taxAmount = Math.floor(contractAmount * taxRate)
  const totalAmount = contractAmount + taxAmount

  // トランザクションで1件の契約 + N件の中間レコードを作成
  const contractNumber = await generateContractNumber()

  const result = await prisma.$transaction(async (tx) => {
    const contract = await tx.contract.create({
      data: {
        contractNumber,
        name,
        projectId: estimates[0].projectId,
        estimateId: null,
        contractAmount,
        taxAmount,
        totalAmount,
        discountAmount: 0,
        adjustedAmount: null,
        adjustedTotal: null,
        paymentType,
        contractDate: new Date(contractDate),
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        paymentTerms: paymentTerms ?? null,
        note: note ?? null,
        status: "CONTRACTED",
      },
    })

    await tx.contractEstimate.createMany({
      data: estimateIds.map((estimateId) => ({
        contractId: contract.id,
        estimateId,
      })),
    })

    return contract
  })

  return NextResponse.json({ count: 1, contract: result }, { status: 201 })
}

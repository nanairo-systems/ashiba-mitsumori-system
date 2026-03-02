/**
 * [API] 一括契約処理 - POST /api/contracts/bulk
 *
 * 複数の見積（CONFIRMED / SENT）を一括で契約に変換する。
 * 共通の契約日・支払条件・備考を全件に適用し、
 * 各見積の金額はそれぞれの見積から自動計算する。
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const itemOverrideSchema = z.object({
  estimateId: z.string().uuid(),
  discountAmount: z.number().nonnegative().default(0),
  adjustedAmount: z.number().nonnegative().nullable().optional(),
  adjustedTotal: z.number().nonnegative().nullable().optional(),
  paymentType: z.enum(["FULL", "TWO_PHASE", "PROGRESS"]).default("FULL"),
})

const bulkContractSchema = z.object({
  estimateIds: z.array(z.string().uuid()).min(1, "見積を1件以上選択してください"),
  overrides: z.array(itemOverrideSchema).optional(),
  contractDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  paymentTerms: z.string().max(200).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
})

/** 契約番号を採番: C-YYMM-NNN 形式 */
async function generateContractNumbers(count: number): Promise<string[]> {
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

  return Array.from({ length: count }, (_, i) =>
    `${prefix}${String(seq + i).padStart(3, "0")}`
  )
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

  const { estimateIds, overrides, contractDate, startDate, endDate, paymentTerms, note } = parsed.data
  const overrideMap = new Map(
    (overrides ?? []).map((o) => [o.estimateId, o])
  )

  // 対象見積を一括取得
  const estimates = await prisma.estimate.findMany({
    where: { id: { in: estimateIds } },
    include: {
      contract: { select: { id: true } },
      sections: {
        include: {
          groups: {
            include: {
              items: { select: { quantity: true, unitPrice: true } },
            },
          },
        },
      },
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
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" / ") }, { status: 422 })
  }

  // 各見積の金額を計算（個別オーバーライド対応）
  const contractNumbers = await generateContractNumbers(estimates.length)

  const contractInputs = estimates.map((est, i) => {
    const taxRate = Number(est.project.branch.company.taxRate)
    const subtotal = est.sections.reduce(
      (s, sec) => s + sec.groups.reduce(
        (gs, g) => gs + g.items.reduce((is, item) => is + Number(item.quantity) * Number(item.unitPrice), 0), 0
      ), 0
    )
    const taxAmount = Math.floor(subtotal * taxRate)
    const totalAmount = subtotal + taxAmount

    const ovr = overrideMap.get(est.id)
    const discount = ovr?.discountAmount ?? 0
    const adjAmt = ovr?.adjustedAmount ?? null
    const adjTotal = ovr?.adjustedTotal ?? null
    const pType = ovr?.paymentType ?? "FULL" as const

    return {
      contractNumber: contractNumbers[i],
      projectId: est.projectId,
      estimateId: est.id,
      contractAmount: subtotal,
      taxAmount,
      totalAmount,
      discountAmount: discount,
      adjustedAmount: adjAmt,
      adjustedTotal: adjTotal,
      paymentType: pType,
      contractDate: new Date(contractDate),
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      paymentTerms: paymentTerms ?? null,
      note: note ?? null,
      status: "CONTRACTED" as const,
    }
  })

  // トランザクションで一括作成
  const created = await prisma.$transaction(
    contractInputs.map((data) => prisma.contract.create({ data }))
  )

  return NextResponse.json({ count: created.length, contracts: created }, { status: 201 })
}

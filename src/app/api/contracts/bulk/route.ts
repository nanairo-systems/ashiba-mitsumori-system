/**
 * [API] 一括契約処理 - POST /api/contracts/bulk
 *
 * 2つのサブモードをサポート:
 *
 * ■ consolidated（統合モード）:
 *   複数の見積（CONFIRMED / SENT）を1つの契約にまとめる。
 *   契約名（現場名）と総合金額を指定して、1件の契約を作成。
 *   各見積は ContractEstimate 中間テーブルで紐付ける。
 *
 * ■ individual（個別モード）:
 *   複数の見積それぞれに個別の契約を作成する。
 *   見積ごとに値引き額・支払サイクルをオーバーライド可能。
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

// ─── スキーマ ─────────────────────────────────────────

const paymentTypeEnum = z.enum(["FULL", "TWO_PHASE", "PROGRESS"])
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/** 統合モード: 複数見積 → 1 契約 */
const consolidatedSchema = z.object({
  mode: z.literal("consolidated"),
  name: z.string().min(1, "契約名を入力してください").max(100),
  estimateIds: z.array(z.string().uuid()).min(1, "見積を1件以上選択してください"),
  contractAmount: z.number().nonnegative("契約金額は0以上を指定してください"),
  paymentType: paymentTypeEnum.default("FULL"),
  contractDate: dateStr,
  startDate: dateStr.nullable().optional(),
  endDate: dateStr.nullable().optional(),
  paymentTerms: z.string().max(200).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
})

/** 個別モード: 見積ごとに個別の契約 */
const individualSchema = z.object({
  mode: z.literal("individual"),
  estimateIds: z.array(z.string().uuid()).min(1, "見積を1件以上選択してください"),
  overrides: z.array(z.object({
    estimateId: z.string().uuid(),
    discountAmount: z.number().nonnegative().default(0),
    adjustedAmount: z.number().nonnegative().nullable().optional(),
    adjustedTotal: z.number().nonnegative().nullable().optional(),
    paymentType: paymentTypeEnum.default("FULL"),
  })).min(1),
  contractDate: dateStr,
  startDate: dateStr.nullable().optional(),
  endDate: dateStr.nullable().optional(),
  paymentTerms: z.string().max(200).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
})

const bulkContractSchema = z.discriminatedUnion("mode", [consolidatedSchema, individualSchema])

// ─── 採番 ──────────────────────────────────────────────

/** 契約番号を採番: C-YYMM-NNN 形式 */
async function generateContractNumber(tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]): Promise<string> {
  const db = tx ?? prisma
  const now = new Date()
  const yy = String(now.getFullYear()).slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const prefix = `C-${yy}${mm}-`

  const latest = await db.contract.findFirst({
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

// ─── ハンドラー ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = bulkContractSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", detail: parsed.error.flatten() }, { status: 400 })
  }

  const data = parsed.data

  // 対象見積を一括取得
  const estimates = await prisma.estimate.findMany({
    where: { id: { in: data.estimateIds } },
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
  })

  // 共通バリデーション
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
  if (estimates.length !== data.estimateIds.length) {
    errors.push("一部の見積が見つかりませんでした")
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join(" / ") }, { status: 422 })
  }

  // ── モード別処理 ────────────────────────────────

  if (data.mode === "consolidated") {
    // 統合モード: 1 契約 + N 中間レコード
    const taxRate = Number(estimates[0].project.branch.company.taxRate)
    const taxAmount = Math.floor(data.contractAmount * taxRate)
    const totalAmount = data.contractAmount + taxAmount

    const result = await prisma.$transaction(async (tx) => {
      const contractNumber = await generateContractNumber(tx)
      const contract = await tx.contract.create({
        data: {
          contractNumber,
          name: data.name,
          projectId: estimates[0].projectId,
          estimateId: null,
          contractAmount: data.contractAmount,
          taxAmount,
          totalAmount,
          discountAmount: 0,
          adjustedAmount: null,
          adjustedTotal: null,
          paymentType: data.paymentType,
          contractDate: new Date(data.contractDate),
          startDate: data.startDate ? new Date(data.startDate) : null,
          endDate: data.endDate ? new Date(data.endDate) : null,
          paymentTerms: data.paymentTerms ?? null,
          note: data.note ?? null,
          status: "CONTRACTED",
        },
      })

      await tx.contractEstimate.createMany({
        data: data.estimateIds.map((estimateId) => ({
          contractId: contract.id,
          estimateId,
        })),
      })

      return contract
    })

    return NextResponse.json({ count: 1, contract: result }, { status: 201 })
  }

  // ── individual モード: 見積ごとに個別の契約 ────────

  // overrides をマップ化
  const overrideMap = new Map(data.overrides.map((o) => [o.estimateId, o]))

  const results = await prisma.$transaction(async (tx) => {
    const contracts = []
    for (const est of estimates) {
      const override = overrideMap.get(est.id)
      const taxRate = Number(est.project.branch.company.taxRate)

      // 見積の税抜金額を算出
      const origTaxExcl = est.sections.reduce(
        (s, sec) => s + sec.groups.reduce(
          (gs, g) => gs + g.items.reduce(
            (is, i) => is + Number(i.quantity) * Number(i.unitPrice), 0
          ), 0
        ), 0
      )

      const discountAmount = override?.discountAmount ?? 0
      const adjustedAmount = override?.adjustedAmount ?? null
      const adjustedTotal = override?.adjustedTotal ?? null
      const paymentType = override?.paymentType ?? "FULL"

      const contractAmount = origTaxExcl
      const taxAmount = Math.floor(origTaxExcl * taxRate)
      const totalAmount = origTaxExcl + taxAmount

      const contractNumber = await generateContractNumber(tx)

      const contract = await tx.contract.create({
        data: {
          contractNumber,
          projectId: est.projectId,
          estimateId: est.id,
          contractAmount,
          taxAmount,
          totalAmount,
          discountAmount,
          adjustedAmount,
          adjustedTotal,
          paymentType,
          contractDate: new Date(data.contractDate),
          startDate: data.startDate ? new Date(data.startDate) : null,
          endDate: data.endDate ? new Date(data.endDate) : null,
          paymentTerms: data.paymentTerms ?? null,
          note: data.note ?? null,
          status: "CONTRACTED",
        },
      })

      contracts.push(contract)
    }
    return contracts
  })

  return NextResponse.json({ count: results.length, contracts: results }, { status: 201 })
}

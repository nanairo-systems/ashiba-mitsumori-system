/**
 * [API] 契約 - POST /api/contracts
 *
 * 見積（CONFIRMED / SENT）から契約を作成する。
 * - 契約番号を自動採番（C-YYMM-NNN 形式）
 * - Estimate にはすでに contract が紐付いていないことを確認
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const contractSchema = z.object({
  projectId: z.string().uuid(),
  estimateId: z.string().uuid(),
  contractAmount: z.number().nonnegative(),
  taxAmount: z.number().nonnegative(),
  totalAmount: z.number().positive(),
  contractDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  paymentTerms: z.string().max(200).nullable().optional(),
  depositAmount: z.number().nonnegative().nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
})

/**
 * 契約番号を採番する: C-YYMM-NNN 形式
 * 例: C-2502-001
 */
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
    const num = parseInt(latest.contractNumber.slice(prefix.length), 10)
    if (!isNaN(num)) seq = num + 1
  }
  return `${prefix}${String(seq).padStart(3, "0")}`
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = contractSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", detail: parsed.error.flatten() }, { status: 400 })
  }

  const {
    projectId, estimateId, contractAmount, taxAmount, totalAmount,
    contractDate, startDate, endDate, paymentTerms, depositAmount, note,
  } = parsed.data

  // 見積の存在・ステータス確認
  const estimate = await prisma.estimate.findUnique({
    where: { id: estimateId },
    select: { id: true, status: true, projectId: true, contract: { select: { id: true } } },
  })
  if (!estimate) {
    return NextResponse.json({ error: "見積が見つかりません" }, { status: 404 })
  }
  if (estimate.projectId !== projectId) {
    return NextResponse.json({ error: "現場と見積が一致しません" }, { status: 400 })
  }
  if (estimate.status !== "CONFIRMED" && estimate.status !== "SENT") {
    return NextResponse.json({ error: "確定済みまたは送付済みの見積のみ契約処理できます" }, { status: 422 })
  }
  if (estimate.contract) {
    return NextResponse.json({ error: "この見積にはすでに契約が紐付いています" }, { status: 409 })
  }

  const contractNumber = await generateContractNumber()

  const contract = await prisma.contract.create({
    data: {
      contractNumber,
      projectId,
      estimateId,
      contractAmount,
      taxAmount,
      totalAmount,
      contractDate: new Date(contractDate),
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      paymentTerms: paymentTerms ?? null,
      depositAmount: depositAmount ?? null,
      note: note ?? null,
      status: "CONTRACTED",
    },
  })

  return NextResponse.json(contract, { status: 201 })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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

  return NextResponse.json(contracts)
}

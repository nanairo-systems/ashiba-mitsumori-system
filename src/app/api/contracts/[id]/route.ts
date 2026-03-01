/**
 * [API] 契約詳細取得・ステータス更新 - GET/PATCH /api/contracts/:id
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const patchSchema = z.object({
  status: z.enum(["CONTRACTED", "SCHEDULE_CREATED", "IN_PROGRESS", "COMPLETED", "BILLED", "PAID", "CANCELLED"]),
})

type ContractWithRelations = {
  schedules: { actualStartDate: Date | null; actualEndDate: Date | null }[]
  invoices: { status: string }[]
}

function checkGateCondition(contract: ContractWithRelations, newStatus: string): string | null {
  const { schedules, invoices } = contract

  switch (newStatus) {
    case "SCHEDULE_CREATED":
      if (schedules.length === 0) return "工程が1件も登録されていません。先に工程を作成してください。"
      break
    case "IN_PROGRESS":
      if (schedules.length === 0) return "工程が1件も登録されていません。"
      if (!schedules.some((s) => s.actualStartDate)) return "実績開始日が1件も入力されていません。着工するには実績を入力してください。"
      break
    case "COMPLETED":
      if (schedules.length === 0) return "工程が1件も登録されていません。"
      if (!schedules.every((s) => s.actualEndDate)) return "全工程の実績終了日が入力されていません。完工にするには全工程を完了してください。"
      break
    case "BILLED":
      if (invoices.length === 0) return "請求書が1件も作成されていません。先に請求書を作成してください。"
      break
    case "PAID":
      if (invoices.length === 0) return "請求書が1件も作成されていません。"
      if (!invoices.every((inv) => inv.status === "PAID")) return "未入金の請求書があります。全ての請求書が入金済みになるまで進められません。"
      break
  }
  return null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      project: {
        include: {
          branch: { include: { company: true } },
          contact: true,
        },
      },
      estimate: {
        include: {
          user: { select: { id: true, name: true } },
          sections: {
            orderBy: { sortOrder: "asc" },
            include: {
              groups: {
                orderBy: { sortOrder: "asc" },
                include: {
                  items: { orderBy: { sortOrder: "asc" }, include: { unit: true } },
                },
              },
            },
          },
        },
      },
      works: {
        include: { subcontractor: true },
        orderBy: { createdAt: "asc" },
      },
      invoices: {
        orderBy: { invoiceDate: "desc" },
        include: { payments: { orderBy: { paymentDate: "asc" } } },
      },
      schedules: {
        orderBy: [{ workType: "asc" }, { plannedStartDate: "asc" }],
      },
    },
  })
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(contract)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 })
  }

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      schedules: true,
      invoices: true,
    },
  })
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const newStatus = parsed.data.status
  if (newStatus !== "CANCELLED") {
    const gateError = checkGateCondition(contract, newStatus)
    if (gateError) {
      return NextResponse.json({ error: gateError }, { status: 400 })
    }
  }

  const updated = await prisma.contract.update({
    where: { id },
    data: { status: newStatus, updatedAt: new Date() },
  })

  return NextResponse.json(updated)
}

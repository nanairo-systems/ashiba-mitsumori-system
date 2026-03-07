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
      contractEstimates: {
        include: {
          estimate: {
            select: {
              id: true, estimateNumber: true, title: true,
              user: { select: { id: true, name: true } },
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
      subcontractorPayments: {
        include: { subcontractor: { select: { id: true, name: true } } },
        orderBy: { paymentDueDate: "asc" },
      },
    },
  })
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const includeFull = _req.nextUrl.searchParams.get("include") === "full"

  if (!includeFull) {
    return NextResponse.json(contract)
  }

  const [siblingContracts, subcontractors] = await Promise.all([
    prisma.contract.findMany({
      where: { projectId: contract.projectId },
      include: {
        estimate: {
          select: {
            id: true, estimateNumber: true, title: true,
            status: true, estimateType: true,
            user: { select: { id: true, name: true } },
          },
        },
        contractEstimates: {
          include: {
            estimate: {
              select: {
                id: true, estimateNumber: true, title: true,
                user: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { contractDate: "asc" },
    }),
    prisma.subcontractor.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
  ])

  const toNum = (v: unknown) => v != null ? Number(v) : null

  const serialized = {
    id: contract.id,
    contractNumber: contract.contractNumber,
    name: contract.name,
    status: contract.status,
    contractAmount: Number(contract.contractAmount),
    taxAmount: Number(contract.taxAmount),
    totalAmount: Number(contract.totalAmount),
    contractDate: contract.contractDate.toISOString(),
    startDate: contract.startDate?.toISOString() ?? null,
    endDate: contract.endDate?.toISOString() ?? null,
    paymentTerms: contract.paymentTerms,
    note: contract.note,
    createdAt: contract.createdAt.toISOString(),
    project: {
      id: contract.project.id,
      name: contract.project.name,
      address: contract.project.address,
      branch: {
        name: contract.project.branch.name,
        company: {
          id: contract.project.branch.company.id,
          name: contract.project.branch.company.name,
          phone: contract.project.branch.company.phone,
          taxRate: Number(contract.project.branch.company.taxRate),
        },
      },
      contact: contract.project.contact
        ? { name: contract.project.contact.name, phone: contract.project.contact.phone, email: contract.project.contact.email }
        : null,
    },
    estimate: contract.estimate ? {
      id: contract.estimate.id,
      estimateNumber: contract.estimate.estimateNumber,
      user: contract.estimate.user,
      sections: contract.estimate.sections.map((sec) => ({
        id: sec.id, name: sec.name,
        groups: sec.groups.map((grp) => ({
          id: grp.id, name: grp.name,
          items: grp.items.map((item) => ({
            id: item.id, name: item.name,
            quantity: Number(item.quantity), unitPrice: Number(item.unitPrice),
            unit: { name: item.unit.name },
          })),
        })),
      })),
    } : null,
    contractEstimates: contract.contractEstimates.map((ce) => ({
      id: ce.id,
      estimate: {
        id: ce.estimate.id,
        estimateNumber: ce.estimate.estimateNumber,
        title: ce.estimate.title,
        user: ce.estimate.user,
      },
    })),
    works: contract.works.map((w) => ({
      id: w.id, workType: w.workType,
      workerCount: w.workerCount, workDays: w.workDays,
      subcontractorId: w.subcontractorId,
      orderAmount: toNum(w.orderAmount),
      orderTaxAmount: toNum(w.orderTaxAmount),
      orderTotalAmount: toNum(w.orderTotalAmount),
      orderStatus: w.orderStatus,
      orderedAt: w.orderedAt?.toISOString() ?? null,
      note: w.note, createdAt: w.createdAt.toISOString(),
      subcontractor: w.subcontractor
        ? { id: w.subcontractor.id, name: w.subcontractor.name, representative: w.subcontractor.representative, address: w.subcontractor.address, phone: w.subcontractor.phone }
        : null,
    })),
    schedules: contract.schedules.map((s) => ({
      id: s.id, contractId: s.contractId, workType: s.workType, name: s.name ?? null,
      plannedStartDate: s.plannedStartDate?.toISOString() ?? null,
      plannedEndDate: s.plannedEndDate?.toISOString() ?? null,
      actualStartDate: s.actualStartDate?.toISOString() ?? null,
      actualEndDate: s.actualEndDate?.toISOString() ?? null,
      workersCount: s.workersCount, notes: s.notes,
    })),
    invoices: contract.invoices.map((inv) => ({ id: inv.id, status: inv.status })),
    subcontractorPayments: contract.subcontractorPayments.map((sp) => ({
      id: sp.id, subcontractorId: sp.subcontractorId,
      subcontractorName: sp.subcontractor.name,
      orderAmount: Number(sp.orderAmount), taxAmount: Number(sp.taxAmount),
      totalAmount: Number(sp.totalAmount),
      closingDate: sp.closingDate?.toISOString() ?? null,
      paymentDueDate: sp.paymentDueDate?.toISOString() ?? null,
      paymentDate: sp.paymentDate?.toISOString() ?? null,
      paymentAmount: sp.paymentAmount ? Number(sp.paymentAmount) : null,
      status: sp.status, notes: sp.notes,
    })),
  }

  const serializedSiblings = siblingContracts.map((sc) => {
    const firstEstimate = sc.estimate ?? sc.contractEstimates[0]?.estimate ?? null
    return {
      id: sc.id, contractNumber: sc.contractNumber, name: sc.name, status: sc.status,
      contractAmount: Number(sc.contractAmount), taxAmount: Number(sc.taxAmount),
      totalAmount: Number(sc.totalAmount), contractDate: sc.contractDate.toISOString(),
      estimate: firstEstimate ? {
        id: firstEstimate.id, estimateNumber: firstEstimate.estimateNumber,
        title: firstEstimate.title,
        status: sc.estimate?.status ?? null,
        estimateType: sc.estimate?.estimateType ?? null,
        user: firstEstimate.user,
      } : null,
      estimateCount: sc.estimate ? 1 : sc.contractEstimates.length,
    }
  })

  const serializedSubs = subcontractors.map((s) => ({
    id: s.id, name: s.name, representative: s.representative, address: s.address, phone: s.phone,
  }))

  return NextResponse.json({
    contract: serialized,
    siblingContracts: serializedSiblings,
    subcontractors: serializedSubs,
  })
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

/**
 * [API] 契約に紐づく見積一覧 - GET /api/contracts/[id]/estimates
 *
 * 契約に紐づく全見積（直接紐付け + ContractEstimate経由）を返す。
 * 各見積にはセクション・グループ・明細の合計金額、発注情報、
 * 見積束（EstimateBundle）情報を含む。
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: contractId } = await params

  // 契約を取得（直接見積ID + ContractEstimate経由）
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      estimateId: true,
      contractEstimates: { select: { estimateId: true } },
    },
  })

  if (!contract) {
    return NextResponse.json({ error: "契約が見つかりません" }, { status: 404 })
  }

  // 見積IDを収集（直接 + ContractEstimate経由、重複排除）
  const estimateIds = new Set<string>()
  if (contract.estimateId) estimateIds.add(contract.estimateId)
  for (const ce of contract.contractEstimates) {
    estimateIds.add(ce.estimateId)
  }

  if (estimateIds.size === 0) {
    return NextResponse.json({ estimates: [], bundles: [] })
  }

  // 見積一覧を取得（セクション・グループ・明細 + 発注情報 + 束情報）
  const estimates = await prisma.estimate.findMany({
    where: { id: { in: [...estimateIds] } },
    include: {
      sections: {
        orderBy: { sortOrder: "asc" },
        include: {
          groups: {
            orderBy: { sortOrder: "asc" },
            include: {
              items: {
                orderBy: { sortOrder: "asc" },
                include: { unit: { select: { id: true, name: true } } },
              },
            },
          },
        },
      },
      purchaseOrder: {
        include: {
          subcontractor: { select: { id: true, name: true } },
        },
      },
      bundleItems: {
        include: {
          bundle: {
            select: { id: true, title: true, bundleNumber: true },
          },
        },
      },
      project: {
        select: {
          branch: {
            select: {
              company: { select: { taxRate: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  })

  // シリアライズ
  const serialized = estimates.map((est) => {
    const taxRate = Number(est.project.branch.company.taxRate)

    // 明細合計を計算
    let subtotal = 0
    const sections = est.sections.map((sec) => {
      let sectionTotal = 0
      const groups = sec.groups.map((grp) => {
        let groupTotal = 0
        const items = grp.items.map((item) => {
          const qty = Number(item.quantity)
          const price = Number(item.unitPrice)
          const amount = qty * price
          groupTotal += amount
          return {
            id: item.id,
            name: item.name,
            quantity: qty,
            unitPrice: price,
            amount,
            unitName: item.unit?.name ?? "",
          }
        })
        sectionTotal += groupTotal
        return {
          id: grp.id,
          name: grp.name,
          total: groupTotal,
          items,
        }
      })
      subtotal += sectionTotal
      return {
        id: sec.id,
        name: sec.name,
        total: sectionTotal,
        groups,
      }
    })

    const discount = est.discountAmount ? Number(est.discountAmount) : 0
    const afterDiscount = subtotal - discount
    const taxAmount = Math.floor(afterDiscount * taxRate)
    const total = afterDiscount + taxAmount

    // 発注情報
    const po = est.purchaseOrder
    const purchaseOrder = po
      ? {
          id: po.id,
          subcontractorName: po.subcontractor.name,
          orderAmount: Number(po.orderAmount),
          taxRate: po.taxRate,
          taxAmount: Math.floor(Number(po.orderAmount) * po.taxRate / 100),
          totalAmount: Number(po.orderAmount) + Math.floor(Number(po.orderAmount) * po.taxRate / 100),
          status: po.status,
          orderedAt: po.orderedAt,
          note: po.note,
        }
      : null

    // 束情報
    const bundles = est.bundleItems.map((bi) => ({
      bundleId: bi.bundle.id,
      bundleTitle: bi.bundle.title,
      bundleNumber: bi.bundle.bundleNumber,
    }))

    return {
      id: est.id,
      title: est.title,
      estimateNumber: est.estimateNumber,
      revision: est.revision,
      status: est.status,
      estimateType: est.estimateType,
      subtotal,
      discount,
      taxRate,
      taxAmount,
      total,
      sections,
      purchaseOrder,
      bundles,
      createdAt: est.createdAt,
    }
  })

  return NextResponse.json({ estimates: serialized })
}

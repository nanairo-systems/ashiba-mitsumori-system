import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

/** 改訂版を作成する。元版を「旧版」にして版番号を上げる。 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { keepOldPdf = false } = await req.json().catch(() => ({}))

  const original = await prisma.estimate.findUnique({
    where: { id },
    include: {
      sections: {
        include: {
          groups: {
            include: { items: true },
          },
        },
      },
    },
  })

  if (!original) {
    return NextResponse.json({ error: "見積が見つかりません" }, { status: 404 })
  }

  // 防衛ゲート：確定または送付済のみ改訂可
  if (!["CONFIRMED", "SENT"].includes(original.status)) {
    return NextResponse.json(
      { error: "確定または送付済の見積のみ改訂できます" },
      { status: 400 }
    )
  }

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } })
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 })

  // トランザクションで元版を旧版にして新版を作成
  const [, newEstimate] = await prisma.$transaction([
    // 元版を旧版に
    prisma.estimate.update({
      where: { id },
      data: {
        status: "OLD",
        pdfUrl: keepOldPdf ? original.pdfUrl : null,
        keepPdf: keepOldPdf,
      },
    }),
    // 新版を作成（明細をコピー）
    prisma.estimate.create({
      data: {
        projectId: original.projectId,
        userId: dbUser.id,
        estimateNumber: original.estimateNumber,
        revision: original.revision + 1,
        status: "DRAFT",
        addressType: original.addressType,
        validDays: original.validDays,
        note: original.note,
        discountAmount: original.discountAmount,
        sections: {
          create: original.sections.map((sec) => ({
            name: sec.name,
            sortOrder: sec.sortOrder,
            groups: {
              create: sec.groups.map((grp) => ({
                name: grp.name,
                sortOrder: grp.sortOrder,
                items: {
                  create: grp.items.map((item) => ({
                    name: item.name,
                    quantity: item.quantity,
                    unitId: item.unitId,
                    unitPrice: item.unitPrice,
                    sortOrder: item.sortOrder,
                  })),
                },
              })),
            },
          })),
        },
      },
    }),
  ])

  await prisma.auditLog.create({
    data: {
      userId: dbUser.id,
      action: "estimate.revise",
      targetId: newEstimate.id,
      detail: { originalId: id, revision: newEstimate.revision },
    },
  })

  return NextResponse.json(newEstimate)
}

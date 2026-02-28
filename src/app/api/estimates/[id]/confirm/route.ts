import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { formatEstimateNumber } from "@/lib/utils"

/** 見積を「確定」にする。見積番号を発行する。 */
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

  const estimate = await prisma.estimate.findUnique({
    where: { id },
    include: { project: { include: { branch: true, contact: true } } },
  })

  if (!estimate) {
    return NextResponse.json({ error: "見積が見つかりません" }, { status: 404 })
  }

  // 防衛ゲート：下書きのみ確定可能
  if (estimate.status !== "DRAFT") {
    return NextResponse.json(
      { error: "下書き状態の見積のみ確定できます" },
      { status: 400 }
    )
  }

  // 確定必須チェック：現場名・支店・先方担当者
  const project = estimate.project
  if (!project.name || !project.branchId || !project.contactId) {
    return NextResponse.json(
      {
        error:
          "確定には現場名・支店・先方担当者の設定が必要です",
      },
      { status: 400 }
    )
  }

  const now = new Date()

  // 月次連番を計算（確定日の年月で採番）
  const yearMonth = `${String(now.getFullYear()).slice(2)}${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`

  const count = await prisma.estimate.count({
    where: {
      estimateNumber: { startsWith: yearMonth },
      status: { not: "DRAFT" },
    },
  })
  const estimateNumber = formatEstimateNumber(now, count + 1)

  const updated = await prisma.estimate.update({
    where: { id },
    data: {
      status: "CONFIRMED",
      estimateNumber,
      confirmedAt: now,
    },
  })

  // 監査ログ
  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } })
  if (dbUser) {
    await prisma.auditLog.create({
      data: {
        userId: dbUser.id,
        action: "estimate.confirm",
        targetId: id,
        detail: { estimateNumber },
      },
    })
  }

  return NextResponse.json(updated)
}

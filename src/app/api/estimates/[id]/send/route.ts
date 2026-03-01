import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { calcFollowUpAt } from "@/lib/utils"
import { z } from "zod"

const schema = z.object({
  contactId: z.string().optional(),
  note: z.string().optional(),
})

/** 送付済にする。フォロー通知を自動セット。 */
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
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const estimate = await prisma.estimate.findUnique({ where: { id } })
  if (!estimate) {
    return NextResponse.json({ error: "見積が見つかりません" }, { status: 404 })
  }

  // 防衛ゲート：確定状態のみ送付済にできる
  if (estimate.status !== "CONFIRMED") {
    return NextResponse.json(
      { error: "確定状態の見積のみ送付済にできます" },
      { status: 400 }
    )
  }

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } })
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const now = new Date()
  const followUpAt = calcFollowUpAt(now)

  await prisma.$transaction([
    // 見積ステータスを送付済に
    prisma.estimate.update({
      where: { id },
      data: {
        status: "SENT",
        sentAt: now,
        followUpAt,
      },
    }),
    // 送付ログを記録
    prisma.sendLog.create({
      data: {
        estimateId: id,
        userId: dbUser.id,
        contactId: parsed.data.contactId ?? null,
        note: parsed.data.note,
        sentAt: now,
      },
    }),
    // フォロー通知を作成
    prisma.notification.create({
      data: {
        userId: estimate.userId,
        estimateId: id,
        type: "FOLLOW_UP",
        message: "見積のフォローアップ期日です。先方に確認を入れましょう。",
        scheduledAt: followUpAt,
      },
    }),
  ])

  // 監査ログ
  await prisma.auditLog.create({
    data: {
      userId: dbUser.id,
      action: "estimate.send",
      targetId: id,
      detail: { contactId: parsed.data.contactId ?? null, followUpAt },
    },
  })

  return NextResponse.json({ success: true, followUpAt })
}

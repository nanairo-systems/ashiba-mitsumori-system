import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

/** 自分の通知一覧を取得 */
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } })
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const notifications = await prisma.notification.findMany({
    where: {
      userId: dbUser.id,
      scheduledAt: { lte: new Date() },
    },
    include: {
      estimate: {
        include: {
          project: {
            include: { branch: { include: { company: true } } },
          },
        },
      },
    },
    orderBy: { scheduledAt: "desc" },
  })

  return NextResponse.json(notifications)
}

/** 通知を既読にする */
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } })
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const { ids } = await req.json()

  await prisma.notification.updateMany({
    where: {
      id: { in: ids },
      userId: dbUser.id,
    },
    data: { isRead: true, sentAt: new Date() },
  })

  return NextResponse.json({ success: true })
}

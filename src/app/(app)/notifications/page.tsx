/**
 * [PAGE] 通知一覧ページ (/notifications)
 *
 * フォローアップ通知の一覧を表示。未読/既読の管理。
 */
import type { Metadata } from "next"

export const metadata: Metadata = { title: "通知" }

import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { NotificationList } from "@/components/notifications/NotificationList"

export default async function NotificationsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } })
  if (!dbUser) redirect("/login")

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

  const serialized = notifications
    .filter((n) => n.estimate?.project?.branch?.company)
    .map((n) => ({
      id: n.id,
      message: n.message,
      isRead: n.isRead,
      scheduledAt: n.scheduledAt,
      estimate: {
        id: n.estimate!.id,
        estimateNumber: n.estimate!.estimateNumber,
        project: {
          name: n.estimate!.project.name,
          branch: {
            company: { name: n.estimate!.project.branch.company.name },
          },
        },
      },
    }))

  return <NotificationList notifications={serialized} />
}

/**
 * [PAGE] 通知一覧ページ (/notifications)
 *
 * フォローアップ通知の一覧を表示。未読/既読の管理。
 */
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

  return <NotificationList notifications={notifications} />
}

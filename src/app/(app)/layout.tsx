import { Sidebar } from "@/components/layout/Sidebar"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  // 未読通知数を取得
  const unreadCount = await prisma.notification.count({
    where: {
      user: { authId: user.id },
      isRead: false,
      scheduledAt: { lte: new Date() },
    },
  }).catch(() => 0)

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar unreadCount={unreadCount} />
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  )
}

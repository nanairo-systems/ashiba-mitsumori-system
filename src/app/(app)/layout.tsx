/**
 * [LAYOUT] アプリケーション共通レイアウト
 *
 * 認証チェック → サイドバー + メインコンテンツ の構成。
 * 未認証ユーザーは /login にリダイレクト。
 * サイドバーに未読通知数を渡す。
 */
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

  const [unreadCount, dbUser] = await Promise.all([
    prisma.notification
      .count({
        where: {
          user: { authId: user.id },
          isRead: false,
          scheduledAt: { lte: new Date() },
        },
      })
      .catch(() => 0),
    prisma.user.findUnique({
      where: { authId: user.id },
      select: { role: true },
    }),
  ])
  const userRole = (dbUser?.role ?? "STAFF") as "ADMIN" | "STAFF" | "DEVELOPER"

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar unreadCount={unreadCount} userRole={userRole} />
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div id="app-content" className="max-w-7xl mx-auto px-0 py-2 pb-20 md:px-6 md:py-8 md:pb-8">{children}</div>
      </main>
    </div>
  )
}

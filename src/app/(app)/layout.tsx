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

  const unreadCount = await prisma.notification
    .count({
      where: {
        user: { authId: user.id },
        isRead: false,
        scheduledAt: { lte: new Date() },
      },
    })
    .catch(() => 0)

  // ユーザーの権限を取得してサイドバーに渡す
  const dbUser = await prisma.user.findUnique({
    where: { authId: user.id },
    select: { role: true },
  })
  const userRole = (dbUser?.role ?? "STAFF") as "ADMIN" | "STAFF"

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar unreadCount={unreadCount} userRole={userRole} />
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  )
}

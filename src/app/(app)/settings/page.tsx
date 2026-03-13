/**
 * [PAGE] 設定ページ (/settings)
 *
 * ADMIN のみアクセス可。STAFF がアクセスすると権限なし画面を表示。
 * - 自分のプロフィール確認
 * - ユーザー管理（新規アカウント発行・権限変更）
 */
import type { Metadata } from "next"

export const metadata: Metadata = { title: "設定" }

import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { SettingsForm } from "@/components/settings/SettingsForm"
import { ShieldOff } from "lucide-react"

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } })
  if (!dbUser) redirect("/login")

  // STAFF はアクセス拒否（ページを見せる必要なし）
  if (dbUser.role !== "ADMIN" && dbUser.role !== "DEVELOPER") {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-slate-400">
        <ShieldOff className="w-16 h-16" />
        <p className="text-xl font-semibold">アクセス権限がありません</p>
        <p className="text-sm">このページは管理者のみ閲覧できます。</p>
      </div>
    )
  }

  // 全ユーザー一覧を取得（管理者のみ）
  const allUsers = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  })

  return (
    <SettingsForm
      currentUser={{ ...dbUser, role: dbUser.role as "ADMIN" | "STAFF" | "DEVELOPER" }}
      allUsers={allUsers.map((u) => ({
        ...u,
        role: u.role as "ADMIN" | "STAFF" | "DEVELOPER",
        createdAt: u.createdAt,
      }))}
    />
  )
}

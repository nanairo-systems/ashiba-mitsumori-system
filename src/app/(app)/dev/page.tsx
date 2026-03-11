/**
 * [PAGE] 開発メニュー (/dev)
 *
 * DEVELOPER ロールのみアクセス可。
 * 変更履歴とタスク管理の開発者専用ダッシュボード。
 */
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { DevDashboard } from "@/components/dev/DevDashboard"
import { ShieldOff } from "lucide-react"

export default async function DevPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const dbUser = await prisma.user.findUnique({ where: { authId: user.id } })
  if (!dbUser) redirect("/login")

  if (dbUser.role !== "DEVELOPER") {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-slate-400">
        <ShieldOff className="w-16 h-16" />
        <p className="text-xl font-semibold">アクセス権限がありません</p>
        <p className="text-sm">このページは開発者のみ閲覧できます。</p>
      </div>
    )
  }

  return <DevDashboard />
}

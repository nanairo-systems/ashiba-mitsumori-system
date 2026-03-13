/**
 * [LAYOUT] 労務・人事システム共通レイアウト
 *
 * 認証チェック → LaborSidebar + メインコンテンツ の構成。
 * 未認証ユーザーは /login にリダイレクト。
 */
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: { default: "労務・人事", template: "%s | 労務・人事" },
}

import { LaborSidebar } from "@/components/labor/layout/LaborSidebar"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function LaborLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <LaborSidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-0 py-2 pb-20 md:px-6 md:py-8 md:pb-8">
          {children}
        </div>
      </main>
    </div>
  )
}

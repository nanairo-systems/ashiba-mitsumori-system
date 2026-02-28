/**
 * [COMPONENT] サイドバーナビゲーション - Sidebar
 *
 * 全ページ共通のサイドバー。ルーティング定義もここに集約。
 * 通知バッジ・サインアウト機能を含む。
 *
 * ナビゲーション項目を追加・変更する場合は navItems を編集してください。
 */
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Building2,
  FileText,
  FolderOpen,
  LayoutTemplate,
  LogOut,
  Settings,
  Bell,
  HandshakeIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"

/**
 * サイドバーのナビゲーション定義
 * href: ルートパス, label: 表示ラベル, icon: Lucide アイコン
 */
const navItems = [
  { href: "/", label: "現場・見積一覧", icon: FolderOpen },
  { href: "/contracts", label: "契約一覧", icon: HandshakeIcon },
  { href: "/estimates/new", label: "新規見積作成", icon: FileText },
  { href: "/templates", label: "テンプレ管理", icon: LayoutTemplate },
  { href: "/masters", label: "マスター管理", icon: Building2 },
  { href: "/notifications", label: "通知", icon: Bell },
  { href: "/settings", label: "設定", icon: Settings },
]

interface SidebarProps {
  unreadCount?: number
}

export function Sidebar({ unreadCount = 0 }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <aside className="flex flex-col w-60 min-h-screen bg-slate-900 text-slate-100">
      {/* ロゴ */}
      <div className="px-5 py-4 border-b border-slate-700/60">
        <div className="flex items-center gap-3">
          {/* アイコンマーク */}
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-900/40">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* 足場を表す格子状アイコン */}
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="3" y1="15" x2="21" y2="15" />
              <line x1="9" y1="3" x2="9" y2="21" />
              <line x1="15" y1="3" x2="15" y2="21" />
            </svg>
          </div>
          {/* テキスト */}
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-wide text-white">
              足場見積
            </p>
            <p className="text-[10px] font-medium text-blue-400 tracking-widest uppercase">
              Management
            </p>
          </div>
        </div>
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {label === "通知" && unreadCount > 0 && (
                <Badge className="bg-red-500 text-white text-xs px-1.5 py-0 min-w-[20px] flex items-center justify-center">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Badge>
              )}
            </Link>
          )
        })}
      </nav>

      {/* サインアウト */}
      <div className="px-3 py-4 border-t border-slate-700">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          ログアウト
        </button>
      </div>
    </aside>
  )
}

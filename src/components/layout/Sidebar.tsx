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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"

const navItems = [
  {
    href: "/",
    label: "現場・見積一覧",
    icon: FolderOpen,
  },
  {
    href: "/estimates/new",
    label: "新規見積作成",
    icon: FileText,
  },
  {
    href: "/templates",
    label: "テンプレ管理",
    icon: LayoutTemplate,
  },
  {
    href: "/masters",
    label: "マスター管理",
    icon: Building2,
  },
  {
    href: "/notifications",
    label: "通知",
    icon: Bell,
  },
  {
    href: "/settings",
    label: "設定",
    icon: Settings,
  },
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
      <div className="px-6 py-5 border-b border-slate-700">
        <h1 className="text-base font-bold leading-tight">
          足場見積
          <span className="block text-xs font-normal text-slate-400 mt-0.5">
            管理システム
          </span>
        </h1>
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

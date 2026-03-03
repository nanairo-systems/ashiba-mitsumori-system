/**
 * [COMPONENT] サイドバーナビゲーション - Sidebar
 *
 * ロゴ（9マスアイコン）をクリックして開閉するサイドバー。
 */
"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Building2,
  CalendarDays,
  FileText,
  FolderOpen,
  LayoutTemplate,
  LogOut,
  Receipt,
  Settings,
  Bell,
  HandshakeIcon,
  Wallet,
  Truck,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"

const navItems = [
  { href: "/", label: "商談一覧", icon: FolderOpen, adminOnly: false },
  { href: "/contracts", label: "契約一覧", icon: HandshakeIcon, adminOnly: false },
  { href: "/schedules", label: "工期管理", icon: CalendarDays, adminOnly: false },
  { href: "/invoices", label: "請求管理", icon: Receipt, adminOnly: false },
  { href: "/payments", label: "入金管理", icon: Wallet, adminOnly: false },
  { href: "/subcontractor-payments", label: "支払管理", icon: Truck, adminOnly: false },
  { href: "/estimates/new", label: "新規見積作成", icon: FileText, adminOnly: false },
  { href: "/templates", label: "テンプレ管理", icon: LayoutTemplate, adminOnly: false },
  { href: "/masters", label: "マスター管理", icon: Building2, adminOnly: false },
  { href: "/notifications", label: "通知", icon: Bell, adminOnly: false },
  { href: "/settings", label: "設定", icon: Settings, adminOnly: true },
]

interface SidebarProps {
  unreadCount?: number
  userRole?: "ADMIN" | "STAFF"
}

export function Sidebar({ unreadCount = 0, userRole = "STAFF" }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [expanded, setExpanded] = useState(false)

  function toggleSidebar() {
    setExpanded((prev) => !prev)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <div
      className={cn(
        "flex h-screen sticky top-0 bg-slate-900 text-slate-100 transition-all duration-200 ease-out shrink-0",
        expanded ? "w-60 shadow-xl shadow-black/20" : "w-14",
      )}
    >
      {/* 折り畳み時: 左端の薄いストリップ（マウスを近づけるとポンと出る） */}
      <aside className="flex flex-col flex-1 h-screen overflow-hidden">
        {/* ヘッダー */}
        <div className="px-2 py-3 border-b border-slate-700/60 flex items-center justify-center min-h-[52px]">
          {expanded ? (
            <div className="flex items-center gap-2.5 min-w-0 w-full">
              <button
                onClick={toggleSidebar}
                className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-900/40 hover:from-blue-400 hover:to-blue-600 transition-colors cursor-pointer"
                title="メニューを閉じる"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="3" y1="15" x2="21" y2="15" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                  <line x1="15" y1="3" x2="15" y2="21" />
                </svg>
              </button>
              <Link href="/" className="leading-tight min-w-0 flex-1">
                <p className="text-sm font-bold tracking-wide text-white truncate">足場見積</p>
                <p className="text-[10px] font-medium text-blue-400 tracking-widest uppercase">Management</p>
              </Link>
            </div>
          ) : (
            <button
              onClick={toggleSidebar}
              className="flex flex-col items-center gap-0.5 cursor-pointer"
              title="メニューを開く"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-900/40 hover:from-blue-400 hover:to-blue-600 transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="3" y1="15" x2="21" y2="15" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                  <line x1="15" y1="3" x2="15" y2="21" />
                </svg>
              </div>
              <ChevronRight className={cn("w-3 h-3 text-slate-400 transition-transform", expanded ? "-rotate-90" : "rotate-90")} />
            </button>
          )}
        </div>

        {/* ナビゲーション */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {navItems
            .filter(({ adminOnly }) => !adminOnly || userRole === "ADMIN")
            .map(({ href, label, icon: Icon }) => {
              const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  title={!expanded ? label : undefined}
                  className={cn(
                    "flex items-center rounded-lg text-sm font-medium transition-colors relative group",
                    expanded ? "gap-3 px-3 py-2.5" : "justify-center px-2 py-2.5",
                    isActive ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white",
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {expanded && <span className="flex-1 truncate">{label}</span>}
                  {expanded && label === "通知" && unreadCount > 0 && (
                    <Badge className="bg-red-500 text-white text-xs px-1.5 py-0 min-w-[20px] flex items-center justify-center">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </Badge>
                  )}
                  {!expanded && label === "通知" && unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                  {!expanded && (
                    <span className="absolute left-full ml-2 px-2.5 py-1.5 rounded-md bg-slate-800 text-white text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 shadow-lg border border-slate-700">
                      {label}
                    </span>
                  )}
                </Link>
              )
            })}
        </nav>

        {/* サインアウト */}
        <div className="px-2 py-3 border-t border-slate-700">
          <button
            onClick={handleSignOut}
            title={!expanded ? "ログアウト" : undefined}
            className={cn(
              "flex items-center w-full rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors relative group",
              expanded ? "gap-3 px-3 py-2.5" : "justify-center px-2 py-2.5",
            )}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {expanded && <span>ログアウト</span>}
            {!expanded && (
              <span className="absolute left-full ml-2 px-2.5 py-1.5 rounded-md bg-slate-800 text-white text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 shadow-lg border border-slate-700">
                ログアウト
              </span>
            )}
          </button>
        </div>
      </aside>
    </div>
  )
}

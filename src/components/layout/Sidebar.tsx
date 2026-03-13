/**
 * [COMPONENT] ナビゲーション - Sidebar + BottomNav
 *
 * デスクトップ（md以上）: 左サイドバー（従来通り）
 * モバイル（md未満）: ボトムナビゲーション + ドロワーメニュー
 */
"use client"

import { useState, useEffect, useCallback } from "react"
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
  ChevronDown,
  Menu,
  X,
  BarChart2,
  Code2,
  Users,
  Calculator,
  Palette,
  PieChart,
  Layers,
  UserCog,
  ClipboardList,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"

const DEV_VIEW_MODE_KEY = "dev_view_mode"
type DevViewMode = "DEVELOPER" | "ADMIN" | "STAFF"

const navItems = [
  { href: "/", label: "商談一覧", shortLabel: "商談", icon: FolderOpen, adminOnly: false },
  { href: "/contracts", label: "契約一覧", shortLabel: "契約", icon: HandshakeIcon, adminOnly: false },
  { href: "/estimates/new", label: "新規見積作成", shortLabel: "見積作成", icon: FileText, adminOnly: false },
  { href: "/notifications", label: "通知", shortLabel: "通知", icon: Bell, adminOnly: false },
  // スタッフ＋管理者共通
  { href: "/templates", label: "テンプレ管理", shortLabel: "テンプレ", icon: LayoutTemplate, adminOnly: false },
  // マスター管理は下部のシステム切替エリアに移動
  // 管理者のみ表示
  { href: "/schedules", label: "工期管理", shortLabel: "工期", icon: CalendarDays, adminOnly: true },
  { href: "/worker-assignments", label: "人員配置", shortLabel: "配置", icon: Users, adminOnly: true },
  { href: "/invoices", label: "請求管理", shortLabel: "請求", icon: Receipt, adminOnly: true },
  { href: "/payments", label: "入金管理", shortLabel: "入金", icon: Wallet, adminOnly: true },
  { href: "/subcontractor-payments", label: "支払管理", shortLabel: "支払", icon: Truck, adminOnly: true },
  { href: "/settings", label: "設定", shortLabel: "設定", icon: Settings, adminOnly: false },
  { href: "/color-palette", label: "カラーパレット", shortLabel: "カラー", icon: Palette, adminOnly: false },
  { href: "/ui-samples", label: "UIサンプル", shortLabel: "UI", icon: Layers, adminOnly: false },
  { href: "/dev", label: "開発メニュー", shortLabel: "開発", icon: Code2, adminOnly: false, devOnly: true },
]

// 集計メニューのサブアイテム
const reportItems = [
  { href: "/reports/contract-summary", label: "契約集計", shortLabel: "契約集計", icon: BarChart2 },
]

// ボトムナビに常時表示する項目のhref
const BOTTOM_NAV_HREFS = ["/worker-assignments", "/estimates/new"]

interface SidebarProps {
  unreadCount?: number
  userRole?: "ADMIN" | "STAFF" | "DEVELOPER"
}

export function Sidebar({ unreadCount = 0, userRole = "STAFF" }: SidebarProps) {
  const pathname = usePathname()

  // 開発者モード: localStorageから表示モードを読み込む
  const [devViewMode, setDevViewMode] = useState<DevViewMode>("DEVELOPER")
  useEffect(() => {
    if (userRole === "DEVELOPER") {
      const stored = localStorage.getItem(DEV_VIEW_MODE_KEY) as DevViewMode | null
      setDevViewMode(stored ?? "DEVELOPER")
    }
  }, [userRole])

  // 実効ロール: DEVELOPERは選択中の表示モードで判定
  const effectiveRole = userRole === "DEVELOPER" ? devViewMode : userRole
  const router = useRouter()
  const supabase = createClient()
  const [expanded, setExpanded] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [reportsOpen, setReportsOpen] = useState(() => pathname.startsWith("/reports"))

  // パス変更時にドロワーを閉じる
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  // 外部からサイドバーを閉じるイベントをリッスン
  useEffect(() => {
    const handler = () => setExpanded(false)
    window.addEventListener("collapse-sidebar", handler)
    return () => window.removeEventListener("collapse-sidebar", handler)
  }, [])

  // ドロワーが開いている時にbodyスクロールを防止
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [drawerOpen])

  function toggleSidebar() {
    setExpanded((prev) => !prev)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  // effectiveRole が ADMIN or DEVELOPER なら adminOnly アイテムも表示
  // devOnly は DEVELOPER ロール（実ロール）のみ表示
  const filteredNavItems = navItems.filter((item) => {
    if ('devOnly' in item && (item as { devOnly?: boolean }).devOnly) {
      return userRole === "DEVELOPER"
    }
    return !item.adminOnly || effectiveRole === "ADMIN" || effectiveRole === "DEVELOPER"
  })

  // ボトムナビ用: 主要4項目 + メニューボタン
  const bottomNavItems = filteredNavItems.filter((item) => BOTTOM_NAV_HREFS.includes(item.href))
  // ドロワー用（デスクトップ参考）: ボトムナビに含まれない残りの項目
  const drawerNavItems = filteredNavItems.filter((item) => !BOTTOM_NAV_HREFS.includes(item.href))
  // モバイルドロワー用: マスター管理と設定のみ表示
  const MOBILE_DRAWER_HREFS = ["/masters", "/settings"]
  const mobileDrawerItems = drawerNavItems.filter((item) => MOBILE_DRAWER_HREFS.includes(item.href))

  // 現在のパスがドロワー内のメニュー項目にマッチするか（メニューアイコンをアクティブにする）
  const isDrawerItemActive = mobileDrawerItems.some(({ href }) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href)
  )

  return (
    <>
      {/* ===== デスクトップ: サイドバー（md以上で表示） ===== */}
      <div
        className={cn(
          "hidden md:flex h-screen sticky top-0 bg-slate-900 text-slate-100 transition-all duration-200 ease-out shrink-0",
          expanded ? "w-60 shadow-xl shadow-black/20" : "w-14",
        )}
      >
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
                  {userRole === "DEVELOPER" ? (
                    <p className="text-xs font-bold text-violet-400 tracking-widest uppercase flex items-center gap-1">
                      <Code2 className="w-2.5 h-2.5" />
                      {devViewMode === "STAFF" ? "Staff View" : devViewMode === "ADMIN" ? "Admin View" : "Dev Mode"}
                    </p>
                  ) : (
                    <p className="text-xs font-medium text-blue-400 tracking-widest uppercase">Management</p>
                  )}
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
            {filteredNavItems.map(({ href, label, icon: Icon }) => {
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

            {/* 集計メニュー（展開式） */}
            <div>
              <button
                onClick={() => { setReportsOpen(!reportsOpen); if (!expanded) setExpanded(true) }}
                title={!expanded ? "集計" : undefined}
                className={cn(
                  "flex items-center w-full rounded-lg text-sm font-medium transition-colors relative group",
                  expanded ? "gap-3 px-3 py-2.5" : "justify-center px-2 py-2.5",
                  pathname.startsWith("/reports")
                    ? "bg-blue-600/30 text-blue-300"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white",
                )}
              >
                <PieChart className="w-4 h-4 flex-shrink-0" />
                {expanded && <span className="flex-1 truncate text-left">集計</span>}
                {expanded && (
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", reportsOpen ? "" : "-rotate-90")} />
                )}
                {!expanded && (
                  <span className="absolute left-full ml-2 px-2.5 py-1.5 rounded-md bg-slate-800 text-white text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 shadow-lg border border-slate-700">
                    集計
                  </span>
                )}
              </button>
              {reportsOpen && expanded && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l border-slate-700 pl-2">
                  {reportItems.map(({ href, label, icon: SubIcon }) => {
                    const isActive = pathname.startsWith(href)
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={cn(
                          "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors",
                          isActive ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white",
                        )}
                      >
                        <SubIcon className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </nav>

          {/* マスター管理 / 経理システムへ / 労務システムへ */}
          <div className="px-2 py-2 border-t border-slate-700 space-y-0.5">
            <Link
              href="/masters"
              title={!expanded ? "マスター管理" : undefined}
              className={cn(
                "flex items-center w-full rounded-lg text-sm font-medium transition-colors relative group",
                pathname === "/masters"
                  ? "bg-amber-600 text-white"
                  : "text-amber-400 hover:bg-slate-800 hover:text-amber-300",
                expanded ? "gap-3 px-3 py-2.5" : "justify-center px-2 py-2.5",
              )}
            >
              <ClipboardList className="w-4 h-4 flex-shrink-0" />
              {expanded && <span>マスター管理</span>}
              {!expanded && (
                <span className="absolute left-full ml-2 px-2.5 py-1.5 rounded-md bg-slate-800 text-white text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 shadow-lg border border-slate-700">
                  マスター管理
                </span>
              )}
            </Link>
            <Link
              href="/accounting"
              title={!expanded ? "経理システムへ" : undefined}
              className={cn(
                "flex items-center w-full rounded-lg text-sm font-medium text-emerald-400 hover:bg-slate-800 hover:text-emerald-300 transition-colors relative group",
                expanded ? "gap-3 px-3 py-2.5" : "justify-center px-2 py-2.5",
              )}
            >
              <Calculator className="w-4 h-4 flex-shrink-0" />
              {expanded && <span>経理システムへ</span>}
              {!expanded && (
                <span className="absolute left-full ml-2 px-2.5 py-1.5 rounded-md bg-slate-800 text-white text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 shadow-lg border border-slate-700">
                  経理システムへ
                </span>
              )}
            </Link>
            <Link
              href="/labor"
              title={!expanded ? "労務システムへ" : undefined}
              className={cn(
                "flex items-center w-full rounded-lg text-sm font-medium text-violet-400 hover:bg-slate-800 hover:text-violet-300 transition-colors relative group",
                expanded ? "gap-3 px-3 py-2.5" : "justify-center px-2 py-2.5",
              )}
            >
              <UserCog className="w-4 h-4 flex-shrink-0" />
              {expanded && <span>労務システムへ</span>}
              {!expanded && (
                <span className="absolute left-full ml-2 px-2.5 py-1.5 rounded-md bg-slate-800 text-white text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 shadow-lg border border-slate-700">
                  労務システムへ
                </span>
              )}
            </Link>
          </div>

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

      {/* ===== モバイル: ボトムナビゲーション（md未満で表示） ===== */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 safe-area-bottom">
        <div className="flex items-center justify-around h-14">
          {bottomNavItems.map(({ href, shortLabel, label, icon: Icon }) => {
            const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative transition-colors",
                  isActive ? "text-blue-600" : "text-slate-500 active:text-slate-700",
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-tight">{shortLabel}</span>
                {label === "通知" && unreadCount > 0 && (
                  <span className="absolute top-1.5 left-1/2 ml-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
            )
          })}

          {/* メニューボタン */}
          <button
            onClick={() => setDrawerOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors",
              isDrawerItemActive ? "text-blue-600" : "text-slate-500 active:text-slate-700",
            )}
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-tight">メニュー</span>
          </button>
        </div>
      </nav>

      {/* ===== モバイル: ドロワーメニュー ===== */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-[60]">
          {/* オーバーレイ */}
          <div
            className="absolute inset-0 bg-black/40 transition-opacity"
            onClick={() => setDrawerOpen(false)}
          />
          {/* ドロワー本体 */}
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom duration-200 max-h-[80vh] overflow-y-auto safe-area-bottom">
            {/* ハンドル */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-300" />
            </div>

            {/* ヘッダー */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">メニュー</h2>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* ナビリンク（モバイル: マスター管理・設定のみ） */}
            <nav className="px-3 py-2">
              {mobileDrawerItems.map(({ href, label, icon: Icon }) => {
                const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors",
                      isActive
                        ? "bg-blue-50 text-blue-600"
                        : "text-slate-700 active:bg-slate-50",
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span>{label}</span>
                  </Link>
                )
              })}
            </nav>

            {/* マスター管理 / 経理システムへ / 労務システムへ + ログアウト */}
            <div className="px-3 py-2 border-t border-slate-100 mb-2">
              <Link
                href="/masters"
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-amber-600 active:bg-amber-50 transition-colors w-full"
              >
                <ClipboardList className="w-5 h-5 flex-shrink-0" />
                <span>マスター管理</span>
              </Link>
              <Link
                href="/accounting"
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-emerald-600 active:bg-emerald-50 transition-colors w-full"
              >
                <Calculator className="w-5 h-5 flex-shrink-0" />
                <span>経理システムへ</span>
              </Link>
              <Link
                href="/labor"
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-violet-600 active:bg-violet-50 transition-colors w-full"
              >
                <UserCog className="w-5 h-5 flex-shrink-0" />
                <span>労務システムへ</span>
              </Link>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-slate-500 active:bg-slate-50 transition-colors w-full"
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                <span>ログアウト</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

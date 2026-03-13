/**
 * [COMPONENT] 経理システム - サイドバー + モバイルボトムナビ
 *
 * デスクトップ（md以上）: 左サイドバー
 * モバイル（md未満）: ボトムナビゲーション + ドロワーメニュー
 */
"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  FileText,
  Wallet,
  Settings,
  LogOut,
  ChevronRight,
  Menu,
  X,
  ArrowLeftRight,
  Car,
  Fuel,
  Palette,
  Layers,
  Landmark,
  UserCog,
  ClipboardList,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

const navItems = [
  { href: "/accounting", label: "ダッシュボード", shortLabel: "ホーム", icon: LayoutDashboard },
  { href: "/accounting/vendors", label: "取引先管理", shortLabel: "取引先", icon: Users },
  { href: "/accounting/subcontractor-invoices", label: "外注費入力", shortLabel: "外注費", icon: FileText },
  { href: "/accounting/subcontractor-invoices?status=pending", label: "支払管理", shortLabel: "支払", icon: Wallet, matchHref: "/accounting/subcontractor-invoices" },
  { href: "/accounting/etc", label: "ETC管理", shortLabel: "ETC", icon: Car },
  { href: "/accounting/fuel", label: "ガソリン管理", shortLabel: "ガソリン", icon: Fuel },
  { href: "/accounting/bank", label: "銀行入出金", shortLabel: "銀行", icon: Landmark },
  // マスター管理は下部のシステム切替エリアに移動
  { href: "/accounting/color-palette", label: "カラーパレット", shortLabel: "カラー", icon: Palette },
  { href: "/accounting/ui-samples", label: "UIサンプル", shortLabel: "UI", icon: Layers },
]

const BOTTOM_NAV_HREFS = ["/accounting", "/accounting/vendors", "/accounting/etc", "/accounting/fuel"]

export function AccountingSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [expanded, setExpanded] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

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

  function isActive(href: string, matchHref?: string) {
    const checkPath = matchHref || href
    if (checkPath === "/accounting") return pathname === "/accounting"
    return pathname.startsWith(checkPath)
  }

  const bottomNavItems = navItems.filter((item) => BOTTOM_NAV_HREFS.includes(item.href))
  const drawerNavItems = navItems.filter((item) => !BOTTOM_NAV_HREFS.includes(item.href))
  const isDrawerItemActive = drawerNavItems.some(({ href, matchHref }) => isActive(href, matchHref))

  return (
    <>
      {/* ===== デスクトップ: サイドバー（md以上） ===== */}
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
                  className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-900/40 hover:from-emerald-400 hover:to-emerald-600 transition-colors cursor-pointer"
                  title="メニューを閉じる"
                >
                  <Wallet className="w-5 h-5 text-white" />
                </button>
                <Link href="/accounting" className="leading-tight min-w-0 flex-1">
                  <p className="text-sm font-bold tracking-wide text-white truncate">経理システム</p>
                  <p className="text-[10px] font-medium text-emerald-400 tracking-widest uppercase">Accounting</p>
                </Link>
              </div>
            ) : (
              <button
                onClick={toggleSidebar}
                className="flex flex-col items-center gap-0.5 cursor-pointer"
                title="メニューを開く"
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-900/40 hover:from-emerald-400 hover:to-emerald-600 transition-colors">
                  <Wallet className="w-[18px] h-[18px] text-white" />
                </div>
                <ChevronRight className={cn("w-3 h-3 text-slate-400 transition-transform", expanded ? "-rotate-90" : "rotate-90")} />
              </button>
            )}
          </div>

          {/* 会社区分表示 */}
          {expanded && (
            <div className="px-3 py-2 border-b border-slate-700/60">
              <div className="flex gap-1.5">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium">七色</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 font-medium">南施工</span>
              </div>
            </div>
          )}

          {/* ナビゲーション */}
          <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden">
            {navItems.map(({ href, label, icon: Icon, matchHref }) => {
              const active = isActive(href, matchHref)
              return (
                <Link
                  key={href}
                  href={href}
                  title={!expanded ? label : undefined}
                  className={cn(
                    "flex items-center rounded-lg text-sm font-medium transition-colors relative group",
                    expanded ? "gap-3 px-3 py-2.5" : "justify-center px-2 py-2.5",
                    active ? "bg-emerald-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white",
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {expanded && <span className="flex-1 truncate">{label}</span>}
                  {!expanded && (
                    <span className="absolute left-full ml-2 px-2.5 py-1.5 rounded-md bg-slate-800 text-white text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 shadow-lg border border-slate-700">
                      {label}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* マスター管理 / 足場システムへ / 労務システムへ + サインアウト */}
          <div className="px-2 py-3 border-t border-slate-700 space-y-0.5">
            <Link
              href="/masters"
              title={!expanded ? "マスター管理" : undefined}
              className={cn(
                "flex items-center w-full rounded-lg text-sm font-medium text-amber-400 hover:bg-slate-800 hover:text-amber-300 transition-colors relative group",
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
              href="/"
              title={!expanded ? "足場システムへ" : undefined}
              className={cn(
                "flex items-center w-full rounded-lg text-sm font-medium text-blue-300 hover:bg-slate-800 hover:text-blue-200 transition-colors relative group",
                expanded ? "gap-3 px-3 py-2.5" : "justify-center px-2 py-2.5",
              )}
            >
              <ArrowLeftRight className="w-4 h-4 flex-shrink-0" />
              {expanded && <span>足場システムへ</span>}
              {!expanded && (
                <span className="absolute left-full ml-2 px-2.5 py-1.5 rounded-md bg-slate-800 text-white text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 shadow-lg border border-slate-700">
                  足場システムへ
                </span>
              )}
            </Link>
            <Link
              href="/labor"
              title={!expanded ? "労務システムへ" : undefined}
              className={cn(
                "flex items-center w-full rounded-lg text-sm font-medium text-violet-300 hover:bg-slate-800 hover:text-violet-200 transition-colors relative group",
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

      {/* ===== モバイル: ボトムナビゲーション ===== */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 safe-area-bottom">
        <div className="flex items-center justify-around h-14">
          {bottomNavItems.map(({ href, shortLabel, icon: Icon, matchHref }) => {
            const active = isActive(href, matchHref)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors",
                  active ? "text-emerald-600" : "text-slate-500 active:text-slate-700",
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-tight">{shortLabel}</span>
              </Link>
            )
          })}
          <button
            onClick={() => setDrawerOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors",
              isDrawerItemActive ? "text-emerald-600" : "text-slate-500 active:text-slate-700",
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
          <div className="absolute inset-0 bg-black/40 transition-opacity" onClick={() => setDrawerOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom duration-200 max-h-[80vh] overflow-y-auto safe-area-bottom">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-300" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">メニュー</h2>
              <button onClick={() => setDrawerOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <nav className="px-3 py-2">
              {drawerNavItems.map(({ href, label, icon: Icon, matchHref }) => {
                const active = isActive(href, matchHref)
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors",
                      active ? "bg-emerald-50 text-emerald-600" : "text-slate-700 active:bg-slate-50",
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span>{label}</span>
                  </Link>
                )
              })}
            </nav>
            <div className="px-3 py-2 border-t border-slate-100">
              <Link
                href="/masters"
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-amber-600 active:bg-amber-50 transition-colors w-full"
              >
                <ClipboardList className="w-5 h-5 flex-shrink-0" />
                <span>マスター管理</span>
              </Link>
              <Link
                href="/"
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-blue-600 active:bg-blue-50 transition-colors w-full"
              >
                <ArrowLeftRight className="w-5 h-5 flex-shrink-0" />
                <span>足場システムへ</span>
              </Link>
              <Link
                href="/labor"
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-violet-600 active:bg-violet-50 transition-colors w-full"
              >
                <UserCog className="w-5 h-5 flex-shrink-0" />
                <span>労務システムへ</span>
              </Link>
            </div>
            <div className="px-3 py-2 border-t border-slate-100 mb-2">
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

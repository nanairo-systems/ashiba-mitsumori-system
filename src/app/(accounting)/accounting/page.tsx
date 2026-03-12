/**
 * [PAGE] 経理システム - トップページ（ダッシュボード）
 *
 * メニューカード一覧表示。後からダッシュボードに変更しやすいレイアウト。
 */
import Link from "next/link"
import { Users, FileText, Wallet, Settings } from "lucide-react"

const menuCards = [
  {
    href: "/accounting/vendors",
    icon: Users,
    title: "取引先管理",
    description: "取引先の登録・編集、保険情報・車両・従業員の管理",
    color: "bg-blue-50 text-blue-600 border-blue-200",
    iconBg: "bg-blue-100",
  },
  {
    href: "/accounting/subcontractor-invoices",
    icon: FileText,
    title: "外注費入力",
    description: "月次外注費の入力・管理、PDF保存",
    color: "bg-emerald-50 text-emerald-600 border-emerald-200",
    iconBg: "bg-emerald-100",
  },
  {
    href: "/accounting/subcontractor-invoices?status=pending",
    icon: Wallet,
    title: "支払管理",
    description: "未払い外注費の確認・支払処理",
    color: "bg-amber-50 text-amber-600 border-amber-200",
    iconBg: "bg-amber-100",
  },
  {
    href: "/accounting/masters",
    icon: Settings,
    title: "マスター管理",
    description: "会社・部門・店舗の登録・編集",
    color: "bg-slate-50 text-slate-600 border-slate-200",
    iconBg: "bg-slate-100",
  },
]

export default function AccountingDashboardPage() {
  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="relative">
        <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">AD-1</span>
        <h1 className="text-2xl font-bold text-slate-800 ml-7">経理システム</h1>
        <p className="text-sm text-slate-500 mt-1">経理業務に関する各機能へアクセスできます</p>
      </div>

      {/* メニューカード一覧 */}
      <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">AD-2</span>
        {menuCards.map(({ href, icon: Icon, title, description, color, iconBg }) => (
          <Link
            key={href}
            href={href}
            className={`block rounded-xl border p-5 transition-all hover:shadow-md hover:-translate-y-0.5 ${color}`}
          >
            <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center mb-3`}>
              <Icon className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold mb-1">{title}</h2>
            <p className="text-xs opacity-75 leading-relaxed">{description}</p>
          </Link>
        ))}
      </div>

      {/* ダッシュボード用のスペース（将来拡張） */}
      <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-4">
        <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">AD-3</span>
        {/* 将来的に集計ウィジェット等を配置 */}
      </div>
    </div>
  )
}

/**
 * [PAGE] 労務・人事システム - ダッシュボード
 */
import type { Metadata } from "next"

export const metadata: Metadata = { title: "ダッシュボード" }

export default function LaborDashboardPage() {
  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">労務・人事ダッシュボード</h1>
        <p className="text-sm text-slate-500 mt-1">社員・勤怠・給与の概要</p>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500">在籍社員数</p>
          <p className="text-3xl font-bold text-violet-600 mt-1">--</p>
          <p className="text-xs text-slate-400 mt-1">名</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500">今月の出勤日数</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">--</p>
          <p className="text-xs text-slate-400 mt-1">日</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500">今月の残業時間</p>
          <p className="text-3xl font-bold text-amber-600 mt-1">--</p>
          <p className="text-xs text-slate-400 mt-1">時間</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500">今月の給与総額</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">--</p>
          <p className="text-xs text-slate-400 mt-1">円</p>
        </div>
      </div>

      {/* クイックリンク */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">クイックアクセス</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { href: "/labor/employees", label: "社員管理", desc: "社員情報・雇用管理", color: "violet" },
            { href: "/labor/attendance", label: "勤怠管理", desc: "出退勤・有給管理", color: "blue" },
            { href: "/labor/payroll", label: "給与管理", desc: "給与計算・明細", color: "amber" },
            { href: "/labor/insurance", label: "社会保険管理", desc: "健保・厚年・雇用保険", color: "green" },
            { href: "/labor/documents", label: "労務書類管理", desc: "契約書・届出書類", color: "rose" },
            { href: "/labor/masters", label: "マスター管理", desc: "部門・職種・手当", color: "slate" },
          ].map(({ href, label, desc }) => (
            <a
              key={href}
              href={href}
              className="flex flex-col gap-1 p-4 rounded-lg border border-slate-100 hover:border-violet-200 hover:bg-violet-50 transition-colors"
            >
              <span className="text-sm font-semibold text-slate-700">{label}</span>
              <span className="text-xs text-slate-400">{desc}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

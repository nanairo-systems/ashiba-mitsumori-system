"use client"

import { useState } from "react"
import { Landmark, Upload, List, Download, Settings, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { BankImport } from "./BankImport"
import { BankTransactionList } from "./BankTransactionList"
import { BankAccountManager } from "./BankAccountManager"
import { BankExport } from "./BankExport"
import { useBankStore } from "./useBankStore"

type Tab = "transactions" | "import" | "export" | "accounts"

export function BankDashboard() {
  const [tab, setTab] = useState<Tab>("transactions")
  const { transactions } = useBankStore()

  const now = new Date()
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const currentMonthTxns = transactions.filter((t) => t.date.startsWith(currentYM))
  const totalDeposit = currentMonthTxns.filter((t) => t.type === "deposit").reduce((s, t) => s + t.amount, 0)
  const totalWithdrawal = currentMonthTxns.filter((t) => t.type === "withdrawal").reduce((s, t) => s + t.amount, 0)

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "transactions", label: "明細一覧", icon: <List className="w-4 h-4" /> },
    { id: "import", label: "取込", icon: <Upload className="w-4 h-4" /> },
    { id: "export", label: "出力", icon: <Download className="w-4 h-4" /> },
    { id: "accounts", label: "口座管理", icon: <Settings className="w-4 h-4" /> },
  ]

  return (
    <div className="flex flex-col h-full min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Landmark className="w-5 h-5 text-sky-500" />
              銀行入出金管理
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">各銀行の入出金明細を管理・出力</p>
          </div>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <ArrowDownRight className="w-3.5 h-3.5 text-emerald-500" />
            <span>今月入金</span>
          </div>
          <p className="text-xl font-bold text-emerald-600">¥{totalDeposit.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1">{currentMonthTxns.filter((t) => t.type === "deposit").length} 件</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-red-500" />
            <span>今月出金</span>
          </div>
          <p className="text-xl font-bold text-red-600">¥{totalWithdrawal.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1">{currentMonthTxns.filter((t) => t.type === "withdrawal").length} 件</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Landmark className="w-3.5 h-3.5" />
            <span>差引</span>
          </div>
          <p className={`text-xl font-bold ${totalDeposit - totalWithdrawal >= 0 ? "text-slate-800" : "text-red-600"}`}>
            ¥{(totalDeposit - totalWithdrawal).toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <List className="w-3.5 h-3.5" />
            <span>全登録件数</span>
          </div>
          <p className="text-xl font-bold text-slate-700">{transactions.length} 件</p>
        </div>
      </div>

      {/* タブ */}
      <div className="px-6">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
          {tabs.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                tab === id
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {icon}
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 px-6 py-4">
        {tab === "transactions" && <BankTransactionList />}
        {tab === "import" && <BankImport />}
        {tab === "export" && <BankExport />}
        {tab === "accounts" && <BankAccountManager />}
      </div>
    </div>
  )
}

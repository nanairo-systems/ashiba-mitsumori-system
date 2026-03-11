"use client"

import { useState, useMemo } from "react"
import { Search, ArrowDownRight, ArrowUpRight, ChevronDown, ChevronUp, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useBankStore, ACCOUNTING_CATEGORIES } from "./useBankStore"

export function BankTransactionList() {
  const { transactions, accounts, updateMemo, clearTransactions } = useBankStore()

  // フィルター
  const [filterCompany, setFilterCompany] = useState("all")
  const [filterBank, setFilterBank] = useState("all")
  const [filterType, setFilterType] = useState<"all" | "deposit" | "withdrawal">("all")
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })
  const [searchText, setSearchText] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // 編集中のメモ
  const [editMemo, setEditMemo] = useState("")
  const [editCategory, setEditCategory] = useState("")

  // ユニーク値
  const companies = useMemo(() => [...new Set(transactions.map((t) => t.company).filter(Boolean))], [transactions])
  const banks = useMemo(() => {
    const filtered = filterCompany === "all" ? transactions : transactions.filter((t) => t.company === filterCompany)
    return [...new Set(filtered.map((t) => t.bankName))]
  }, [transactions, filterCompany])
  const months = useMemo(() => {
    const set = new Set(transactions.map((t) => t.date.slice(0, 7)))
    return [...set].sort().reverse()
  }, [transactions])

  // フィルタリング
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (filterCompany !== "all" && t.company !== filterCompany) return false
      if (filterBank !== "all" && t.bankName !== filterBank) return false
      if (filterType !== "all" && t.type !== filterType) return false
      if (filterMonth && !t.date.startsWith(filterMonth)) return false
      if (searchText) {
        const q = searchText.toLowerCase()
        if (
          !t.description.toLowerCase().includes(q) &&
          !t.bankName.toLowerCase().includes(q) &&
          !t.memo?.toLowerCase().includes(q) &&
          !t.accountingCategory?.toLowerCase().includes(q) &&
          !String(t.amount).includes(q)
        ) return false
      }
      return true
    })
  }, [transactions, filterCompany, filterBank, filterType, filterMonth, searchText])

  // 集計
  const totalDeposit = filtered.filter((t) => t.type === "deposit").reduce((s, t) => s + t.amount, 0)
  const totalWithdrawal = filtered.filter((t) => t.type === "withdrawal").reduce((s, t) => s + t.amount, 0)

  function handleExpand(txnId: string) {
    if (expandedId === txnId) {
      setExpandedId(null)
    } else {
      setExpandedId(txnId)
      const txn = transactions.find((t) => t.id === txnId)
      setEditMemo(txn?.memo ?? "")
      setEditCategory(txn?.accountingCategory ?? "")
    }
  }

  function handleSaveMemo(txnId: string) {
    updateMemo(txnId, editMemo, editCategory)
    toast.success("保存しました")
  }

  function handleClearAll() {
    if (confirm("全ての取込データを削除しますか？この操作は元に戻せません。")) {
      clearTransactions()
      toast.success("全データを削除しました")
    }
  }

  if (transactions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <Search className="w-10 h-10 mx-auto text-slate-300 mb-2" />
        <p className="text-sm text-slate-500">データがありません。「取込」タブからExcelファイルを取り込んでください。</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* フィルター */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-slate-500 block mb-1">会社</label>
            <select value={filterCompany} onChange={(e) => { setFilterCompany(e.target.value); setFilterBank("all") }} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400">
              <option value="all">全て</option>
              {companies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">銀行</label>
            <select value={filterBank} onChange={(e) => setFilterBank(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400">
              <option value="all">全て</option>
              {banks.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">種別</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value as "all" | "deposit" | "withdrawal")} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400">
              <option value="all">入出金</option>
              <option value="deposit">入金のみ</option>
              <option value="withdrawal">出金のみ</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">月</label>
            <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400">
              <option value="">全期間</option>
              {months.map((m) => <option key={m} value={m}>{m.replace("-", "年")}月</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-slate-500 block mb-1">検索</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="取引先名・金額・メモ..."
                className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
          </div>
          <button onClick={handleClearAll} className="flex items-center gap-1 px-3 py-2 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
            全削除
          </button>
        </div>
      </div>

      {/* 集計バー */}
      <div className="flex items-center gap-4 px-1 text-sm">
        <span className="text-slate-500">{filtered.length}件</span>
        <span className="text-emerald-600 font-medium">入金: ¥{totalDeposit.toLocaleString()}</span>
        <span className="text-red-600 font-medium">出金: ¥{totalWithdrawal.toLocaleString()}</span>
        <span className={`font-bold ${totalDeposit - totalWithdrawal >= 0 ? "text-slate-800" : "text-red-600"}`}>
          差引: ¥{(totalDeposit - totalWithdrawal).toLocaleString()}
        </span>
      </div>

      {/* 明細テーブル */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500 w-8"></th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500">日付</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500">銀行</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500">摘要</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-slate-500">入金</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-slate-500">出金</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-slate-500">残高</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500">勘定科目</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-slate-500">メモ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.slice(0, 500).map((txn) => {
                const isExpanded = expandedId === txn.id
                return (
                  <tr key={txn.id} className="group">
                    <td className="px-3 py-2">
                      <button onClick={() => handleExpand(txn.id)} className="p-0.5 text-slate-400 hover:text-slate-600 transition-colors">
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-slate-700 whitespace-nowrap text-xs">{txn.date}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="text-xs text-slate-700">{txn.bankName}</div>
                      <div className="text-[10px] text-slate-400">{txn.company}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600 max-w-[250px] truncate" title={txn.description}>
                      {txn.description || "—"}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {txn.type === "deposit" ? (
                        <span className="text-xs font-bold text-emerald-600 flex items-center justify-end gap-0.5">
                          <ArrowDownRight className="w-3 h-3" />
                          ¥{txn.amount.toLocaleString()}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {txn.type === "withdrawal" ? (
                        <span className="text-xs font-bold text-red-600 flex items-center justify-end gap-0.5">
                          <ArrowUpRight className="w-3 h-3" />
                          ¥{txn.amount.toLocaleString()}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-slate-500 whitespace-nowrap">
                      {txn.balance != null ? `¥${txn.balance.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">{txn.accountingCategory || "—"}</td>
                    <td className="px-3 py-2 text-xs text-slate-400 max-w-[120px] truncate">{txn.memo || "—"}</td>
                    {/* 展開行 */}
                    {isExpanded && (
                      <td colSpan={9} className="px-3 py-3 bg-slate-50 border-t border-slate-100">
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div>
                              <span className="text-slate-400 block">口座番号</span>
                              <span className="text-slate-700 font-mono">{txn.accountNumber}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block">取引区分</span>
                              <span className="text-slate-700">{txn.category || "—"}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block">シート名</span>
                              <span className="text-slate-700">{txn.sheetName}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block">会社</span>
                              <span className="text-slate-700">{txn.company}</span>
                            </div>
                          </div>
                          <div className="flex items-end gap-3 flex-wrap">
                            <div className="flex-1 min-w-[200px]">
                              <label className="text-xs text-slate-500 block mb-1">勘定科目</label>
                              <select
                                value={editCategory}
                                onChange={(e) => setEditCategory(e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                              >
                                {ACCOUNTING_CATEGORIES.map((c) => (
                                  <option key={c} value={c}>{c || "（未設定）"}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex-[2] min-w-[250px]">
                              <label className="text-xs text-slate-500 block mb-1">メモ</label>
                              <input
                                value={editMemo}
                                onChange={(e) => setEditMemo(e.target.value)}
                                placeholder="メモを入力..."
                                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                              />
                            </div>
                            <button
                              onClick={() => handleSaveMemo(txn.id)}
                              className="flex items-center gap-1.5 px-4 py-1.5 bg-sky-500 text-white rounded-lg text-sm font-medium hover:bg-sky-600 transition-colors"
                            >
                              <Save className="w-3.5 h-3.5" />
                              保存
                            </button>
                          </div>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

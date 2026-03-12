"use client"

import { useState, useMemo } from "react"
import { Download, FileSpreadsheet } from "lucide-react"
import { toast } from "sonner"
import { useBankStore } from "./useBankStore"

export function BankExport() {
  const { transactions } = useBankStore()

  const [filterCompany, setFilterCompany] = useState("all")
  const [filterBank, setFilterBank] = useState("all")
  const [filterType, setFilterType] = useState<"all" | "deposit" | "withdrawal">("all")
  const [filterMonth, setFilterMonth] = useState("")

  const companies = useMemo(() => [...new Set(transactions.map((t) => t.company).filter(Boolean))], [transactions])
  const banks = useMemo(() => {
    const f = filterCompany === "all" ? transactions : transactions.filter((t) => t.company === filterCompany)
    return [...new Set(f.map((t) => t.bankName))]
  }, [transactions, filterCompany])
  const months = useMemo(() => {
    return [...new Set(transactions.map((t) => t.date.slice(0, 7)))].sort().reverse()
  }, [transactions])

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (filterCompany !== "all" && t.company !== filterCompany) return false
      if (filterBank !== "all" && t.bankName !== filterBank) return false
      if (filterType !== "all" && t.type !== filterType) return false
      if (filterMonth && !t.date.startsWith(filterMonth)) return false
      return true
    })
  }, [transactions, filterCompany, filterBank, filterType, filterMonth])

  const totalDeposit = filtered.filter((t) => t.type === "deposit").reduce((s, t) => s + t.amount, 0)
  const totalWithdrawal = filtered.filter((t) => t.type === "withdrawal").reduce((s, t) => s + t.amount, 0)

  function exportCSV() {
    if (filtered.length === 0) {
      toast.error("出力対象のデータがありません")
      return
    }
    const header = "日付,会社,銀行,口座番号,種別,金額,残高,摘要,勘定科目,メモ"
    const rows = filtered.map((t) => [
      t.date,
      t.company,
      t.bankName,
      t.accountNumber,
      t.type === "deposit" ? "入金" : "出金",
      t.amount,
      t.balance ?? "",
      `"${t.description.replace(/"/g, '""')}"`,
      t.accountingCategory ?? "",
      `"${(t.memo ?? "").replace(/"/g, '""')}"`,
    ].join(","))

    const bom = "\uFEFF"
    const blob = new Blob([bom + header + "\n" + rows.join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url

    const typeSuffix = filterType === "deposit" ? "_入金" : filterType === "withdrawal" ? "_出金" : ""
    const companySuffix = filterCompany !== "all" ? `_${filterCompany}` : ""
    const bankSuffix = filterBank !== "all" ? `_${filterBank}` : ""
    a.download = `銀行明細${companySuffix}${bankSuffix}${typeSuffix}_${filterMonth || "全期間"}.csv`

    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${filtered.length}件をCSV出力しました`)
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-sky-500" />
          CSV出力設定
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="text-xs text-slate-500 block mb-1">会社</label>
            <select value={filterCompany} onChange={(e) => { setFilterCompany(e.target.value); setFilterBank("all") }} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400">
              <option value="all">全て</option>
              {companies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">銀行</label>
            <select value={filterBank} onChange={(e) => setFilterBank(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400">
              <option value="all">全て</option>
              {banks.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">種別</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value as "all" | "deposit" | "withdrawal")} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400">
              <option value="all">入出金</option>
              <option value="deposit">入金のみ</option>
              <option value="withdrawal">出金のみ</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">月</label>
            <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400">
              <option value="">全期間</option>
              {months.map((m) => <option key={m} value={m}>{m.replace("-", "年")}月</option>)}
            </select>
          </div>
        </div>

        {/* プレビュー */}
        <div className="bg-slate-50 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-500">対象件数</p>
              <p className="font-bold text-slate-700">{filtered.length} 件</p>
            </div>
            <div>
              <p className="text-xs text-emerald-600">入金合計</p>
              <p className="font-bold text-emerald-700">¥{totalDeposit.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-red-600">出金合計</p>
              <p className="font-bold text-red-700">¥{totalWithdrawal.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">差引</p>
              <p className={`font-bold ${totalDeposit - totalWithdrawal >= 0 ? "text-slate-800" : "text-red-600"}`}>
                ¥{(totalDeposit - totalWithdrawal).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={exportCSV}
          disabled={filtered.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-sky-500 text-white rounded-lg text-sm font-medium hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Download className="w-4 h-4" />
          CSV ダウンロード
        </button>
      </div>

      <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-xs text-slate-600 space-y-1">
        <p className="font-bold text-sky-700">出力形式について</p>
        <p>CSV（UTF-8 BOM付き）で出力します。Excelで直接開けます。</p>
        <p>税理士への提出時は、会社別・種別（入金のみ/出金のみ）で分けて出力できます。</p>
      </div>
    </div>
  )
}

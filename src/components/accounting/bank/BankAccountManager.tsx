"use client"

import { useState } from "react"
import { Plus, Trash2, Building2, CheckCircle, XCircle } from "lucide-react"
import { toast } from "sonner"
import { useBankStore, type BankAccount } from "./useBankStore"

export function BankAccountManager() {
  const { accounts, addAccount, removeAccount, updateAccount } = useBankStore()
  const [showAdd, setShowAdd] = useState(false)
  const [newCompany, setNewCompany] = useState("")
  const [newBank, setNewBank] = useState("")
  const [newBranch, setNewBranch] = useState("")
  const [newType, setNewType] = useState("普通")
  const [newNumber, setNewNumber] = useState("")

  function handleAdd() {
    if (!newCompany || !newBank) {
      toast.error("会社名と銀行名は必須です")
      return
    }
    const id = `custom-${Date.now()}`
    addAccount({
      id,
      company: newCompany,
      bankName: newBank,
      branchName: newBranch,
      accountType: newType,
      accountNumber: newNumber,
      isActive: true,
    })
    setNewCompany("")
    setNewBank("")
    setNewBranch("")
    setNewType("普通")
    setNewNumber("")
    setShowAdd(false)
    toast.success("口座を追加しました")
  }

  function handleDelete(acct: BankAccount) {
    if (confirm(`「${acct.bankName} ${acct.accountNumber}」を削除しますか？`)) {
      removeAccount(acct.id)
      toast.success("削除しました")
    }
  }

  function handleToggleActive(acct: BankAccount) {
    updateAccount(acct.id, { isActive: !acct.isActive })
  }

  // 会社別にグループ化
  const grouped = accounts.reduce<Record<string, BankAccount[]>>((acc, a) => {
    const key = a.company || "未設定"
    if (!acc[key]) acc[key] = []
    acc[key].push(a)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">登録済み口座: {accounts.length}件</p>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-4 py-2 bg-sky-500 text-white rounded-lg text-sm font-medium hover:bg-sky-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          口座を追加
        </button>
      </div>

      {/* 追加フォーム */}
      {showAdd && (
        <div className="bg-white rounded-xl border border-sky-200 p-5">
          <h3 className="text-sm font-bold text-sky-700 mb-3">新規口座登録</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">会社名 *</label>
              <input
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                placeholder="(株)七色"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                list="company-list"
              />
              <datalist id="company-list">
                {[...new Set(accounts.map((a) => a.company))].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">銀行名 *</label>
              <input value={newBank} onChange={(e) => setNewBank(e.target.value)} placeholder="名古屋銀行" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">支店名</label>
              <input value={newBranch} onChange={(e) => setNewBranch(e.target.value)} placeholder="荒子支店" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">口座種別</label>
              <select value={newType} onChange={(e) => setNewType(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400">
                <option>普通</option>
                <option>当座</option>
                <option>貯蓄</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">口座番号</label>
              <input value={newNumber} onChange={(e) => setNewNumber(e.target.value)} placeholder="1234567" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-400" />
            </div>
            <div className="flex items-end gap-2">
              <button onClick={handleAdd} className="px-4 py-2 bg-sky-500 text-white rounded-lg text-sm font-medium hover:bg-sky-600 transition-colors">登録</button>
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm hover:bg-slate-200 transition-colors">キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {/* 口座一覧 */}
      {Object.entries(grouped).map(([company, accts]) => (
        <div key={company} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-700">{company}</h3>
            <span className="text-xs text-slate-400">{accts.length}口座</span>
          </div>
          <div className="divide-y divide-slate-100">
            {accts.map((acct) => (
              <div key={acct.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors">
                <button onClick={() => handleToggleActive(acct)} title={acct.isActive ? "有効" : "無効"}>
                  {acct.isActive ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-slate-300" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${acct.isActive ? "text-slate-800" : "text-slate-400"}`}>{acct.bankName}</span>
                    {acct.branchName && <span className="text-xs text-slate-400">{acct.branchName}</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                    <span>{acct.accountType}</span>
                    <span className="font-mono">{acct.accountNumber}</span>
                  </div>
                </div>
                <button onClick={() => handleDelete(acct)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

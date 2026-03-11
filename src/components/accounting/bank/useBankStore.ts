"use client"

import { useState, useEffect, useCallback } from "react"

// ========================================
// 型定義
// ========================================
export interface BankTransaction {
  id: string
  date: string
  type: "deposit" | "withdrawal"
  amount: number
  balance: number | null
  description: string
  category: string | null
  bankName: string
  accountNumber: string
  company: string
  sheetName: string
  raw: string
  // ユーザー追加情報
  memo: string
  accountingCategory: string // 勘定科目
}

export interface BankAccount {
  id: string
  company: string
  bankName: string
  branchName: string
  accountType: string // 普通, 当座
  accountNumber: string
  isActive: boolean
}

// ========================================
// localStorage キー
// ========================================
const TRANSACTIONS_KEY = "ashiba-bank-transactions"
const ACCOUNTS_KEY = "ashiba-bank-accounts"
const MEMOS_KEY = "ashiba-bank-memos" // { [txnId]: { memo, accountingCategory } }

// ========================================
// デフォルト口座（現在のExcelから判明分）
// ========================================
const DEFAULT_ACCOUNTS: BankAccount[] = [
  { id: "nanairo-nagoya", company: "(株)七色", bankName: "名古屋銀行", branchName: "荒子支店", accountType: "普通", accountNumber: "3242084", isActive: true },
  { id: "nanairo-aichi", company: "(株)七色", bankName: "あいち銀行", branchName: "東知多央支店", accountType: "普通", accountNumber: "5099949", isActive: true },
  { id: "nanairo-aichi-yachin", company: "(株)七色", bankName: "あいち銀行(家賃)", branchName: "東知多央支店", accountType: "普通", accountNumber: "5195909", isActive: true },
  { id: "nanairo-ufj", company: "(株)七色", bankName: "三菱UFJ銀行", branchName: "高畑支店", accountType: "普通", accountNumber: "173248", isActive: true },
  { id: "nanairo-hyakugo", company: "(株)七色", bankName: "百五銀行", branchName: "当知支店", accountType: "普通", accountNumber: "0199251", isActive: true },
  { id: "nanairo-yucho", company: "(株)七色", bankName: "ゆうちょ銀行", branchName: "", accountType: "普通", accountNumber: "109272", isActive: true },
  { id: "nanairo-sbi", company: "(株)七色", bankName: "住信SBIネット銀行", branchName: "", accountType: "普通", accountNumber: "1219253", isActive: true },
  { id: "nanairo-paypay", company: "(株)七色", bankName: "PayPay銀行", branchName: "", accountType: "普通", accountNumber: "3021505", isActive: true },
  { id: "nanairo-rakuten", company: "(株)七色", bankName: "楽天銀行", branchName: "", accountType: "普通", accountNumber: "3021505", isActive: true },
  { id: "minami-nagoya", company: "南施工サービス", bankName: "名古屋銀行", branchName: "荒子支店", accountType: "普通", accountNumber: "3272684", isActive: true },
  { id: "minami-aichi", company: "南施工サービス", bankName: "あいち銀行", branchName: "東知多央支店", accountType: "普通", accountNumber: "5016893", isActive: true },
  { id: "minami-hyakugo", company: "南施工サービス", bankName: "百五銀行", branchName: "当知支店", accountType: "普通", accountNumber: "0219491", isActive: true },
  { id: "minami-sbi", company: "南施工サービス", bankName: "住信SBIネット銀行", branchName: "", accountType: "普通", accountNumber: "", isActive: true },
]

// ========================================
// 勘定科目一覧
// ========================================
export const ACCOUNTING_CATEGORIES = [
  "",
  "売上高",
  "売掛金回収",
  "前受金",
  "借入金",
  "利息",
  "雑収入",
  "仕入高",
  "外注費",
  "給料手当",
  "賞与",
  "法定福利費",
  "福利厚生費",
  "旅費交通費",
  "通信費",
  "水道光熱費",
  "消耗品費",
  "修繕費",
  "地代家賃",
  "保険料",
  "租税公課",
  "支払利息",
  "雑費",
  "借入金返済",
  "設備投資",
  "その他",
]

// ========================================
// フック
// ========================================
export function useBankStore() {
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loaded, setLoaded] = useState(false)

  // 初期ロード
  useEffect(() => {
    // Accounts
    const savedAccounts = localStorage.getItem(ACCOUNTS_KEY)
    if (savedAccounts) {
      setAccounts(JSON.parse(savedAccounts))
    } else {
      setAccounts(DEFAULT_ACCOUNTS)
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(DEFAULT_ACCOUNTS))
    }

    // Transactions + memos
    const savedTxns = localStorage.getItem(TRANSACTIONS_KEY)
    const savedMemos = localStorage.getItem(MEMOS_KEY)
    const memos: Record<string, { memo: string; accountingCategory: string }> = savedMemos ? JSON.parse(savedMemos) : {}

    if (savedTxns) {
      const txns: BankTransaction[] = JSON.parse(savedTxns)
      // Merge memos
      const merged = txns.map((t) => ({
        ...t,
        memo: memos[t.id]?.memo ?? t.memo ?? "",
        accountingCategory: memos[t.id]?.accountingCategory ?? t.accountingCategory ?? "",
      }))
      setTransactions(merged)
    }
    setLoaded(true)
  }, [])

  // Save transactions
  const saveTransactions = useCallback((txns: BankTransaction[]) => {
    setTransactions(txns)
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(txns))
  }, [])

  // Add transactions (from import, dedup by id)
  const addTransactions = useCallback((newTxns: BankTransaction[]) => {
    setTransactions((prev) => {
      const existingIds = new Set(prev.map((t) => t.id))
      const added = newTxns.filter((t) => !existingIds.has(t.id))
      const merged = [...prev, ...added]
      merged.sort((a, b) => b.date.localeCompare(a.date))
      localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(merged))
      return merged
    })
  }, [])

  // Update memo/category for a transaction
  const updateMemo = useCallback((txnId: string, memo: string, accountingCategory: string) => {
    // Save to memos storage
    const savedMemos = localStorage.getItem(MEMOS_KEY)
    const memos: Record<string, { memo: string; accountingCategory: string }> = savedMemos ? JSON.parse(savedMemos) : {}
    memos[txnId] = { memo, accountingCategory }
    localStorage.setItem(MEMOS_KEY, JSON.stringify(memos))

    // Update state
    setTransactions((prev) => {
      const updated = prev.map((t) => t.id === txnId ? { ...t, memo, accountingCategory } : t)
      localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  // Clear all transactions
  const clearTransactions = useCallback(() => {
    setTransactions([])
    localStorage.removeItem(TRANSACTIONS_KEY)
    localStorage.removeItem(MEMOS_KEY)
  }, [])

  // Accounts CRUD
  const saveAccounts = useCallback((accts: BankAccount[]) => {
    setAccounts(accts)
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accts))
  }, [])

  const addAccount = useCallback((account: BankAccount) => {
    setAccounts((prev) => {
      const updated = [...prev, account]
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const removeAccount = useCallback((id: string) => {
    setAccounts((prev) => {
      const updated = prev.filter((a) => a.id !== id)
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const updateAccount = useCallback((id: string, data: Partial<BankAccount>) => {
    setAccounts((prev) => {
      const updated = prev.map((a) => a.id === id ? { ...a, ...data } : a)
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  return {
    transactions,
    accounts,
    loaded,
    addTransactions,
    saveTransactions,
    updateMemo,
    clearTransactions,
    saveAccounts,
    addAccount,
    removeAccount,
    updateAccount,
  }
}

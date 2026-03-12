"use client"

import { useState, useCallback } from "react"
import { Upload, FileSpreadsheet, Loader2, CheckCircle, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { useBankStore, type BankTransaction } from "./useBankStore"

export function BankImport() {
  const { addTransactions } = useBankStore()
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{
    total: number; deposits: number; withdrawals: number
    totalDeposit: number; totalWithdrawal: number; company: string; sheets: number
  } | null>(null)

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter((f) => f.name.match(/\.(xlsx|xls|csv)$/i))
    if (validFiles.length === 0) {
      toast.error("Excel (.xlsx, .xls) または CSV ファイルを選択してください")
      return
    }
    setUploading(true)
    setResult(null)
    let totalTxns = 0
    let totalDeposit = 0
    let totalWithdrawal = 0
    let depositCount = 0
    let withdrawalCount = 0
    let lastCompany = ""
    let fileCount = 0

    for (const file of validFiles) {
      try {
        const formData = new FormData()
        formData.append("file", file)
        const res = await fetch("/api/accounting/bank/parse", { method: "POST", body: formData })
        const data = await res.json()

        if (!res.ok) {
          toast.error(`${file.name}: ${data.error || "解析に失敗"}`)
          continue
        }

        const txns: BankTransaction[] = data.transactions.map((t: BankTransaction) => ({
          ...t,
          memo: "",
          accountingCategory: "",
        }))

        addTransactions(txns)
        totalTxns += txns.length
        totalDeposit += data.summary.totalDeposit
        totalWithdrawal += data.summary.totalWithdrawal
        depositCount += data.summary.deposits
        withdrawalCount += data.summary.withdrawals
        if (data.summary.company) lastCompany = data.summary.company
        fileCount++
      } catch {
        toast.error(`${file.name}: 解析に失敗しました`)
      }
    }

    if (totalTxns > 0) {
      setResult({
        total: totalTxns,
        deposits: depositCount,
        withdrawals: withdrawalCount,
        totalDeposit,
        totalWithdrawal,
        company: lastCompany,
        sheets: fileCount,
      })
      toast.success(`${fileCount}ファイルから${totalTxns}件の明細を取り込みました`)
    }
    setUploading(false)
  }, [addTransactions])

  return (
    <div className="space-y-4">
      {/* ドロップゾーン */}
      <div
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
          dragging
            ? "border-sky-400 bg-sky-50"
            : "border-slate-300 bg-white hover:border-sky-300 hover:bg-sky-50/30"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
        }}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-sky-500" />
            <p className="text-sm text-slate-500">解析中...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="w-10 h-10 text-slate-400" />
            <div>
              <p className="text-sm font-medium text-slate-700">
                銀行の入出金明細ファイルをドロップ
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Excel (.xlsx) / CSV 対応 — 複数ファイルの同時取込もOK
              </p>
            </div>
            <label className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-sky-500 text-white rounded-lg text-sm font-medium hover:bg-sky-600 cursor-pointer transition-colors">
              <FileSpreadsheet className="w-4 h-4" />
              ファイルを選択
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files)
                  e.target.value = ""
                }}
              />
            </label>
          </div>
        )}
      </div>

      {/* 結果表示 */}
      {result && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-800">取込完了</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">会社</p>
              <p className="font-bold text-slate-700">{result.company || "不明"}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">ファイル数</p>
              <p className="font-bold text-slate-700">{result.sheets}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3">
              <p className="text-xs text-emerald-600">入金</p>
              <p className="font-bold text-emerald-700">{result.deposits}件 / ¥{result.totalDeposit.toLocaleString()}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-xs text-red-600">出金</p>
              <p className="font-bold text-red-700">{result.withdrawals}件 / ¥{result.totalWithdrawal.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {/* 注意事項 */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-slate-600 space-y-1">
          <p className="font-bold text-amber-700">対応銀行フォーマット</p>
          <p>名古屋銀行・あいち銀行・百五銀行・三菱UFJ銀行・ゆうちょ銀行・住信SBIネット銀行・PayPay銀行・楽天銀行</p>
          <p>各銀行からダウンロードしたExcelをそのまま取り込めます。複数銀行をまとめた1ファイルも対応。</p>
          <p className="text-amber-600">※データはブラウザに保存されます。別のブラウザやPCからはアクセスできません。</p>
        </div>
      </div>
    </div>
  )
}

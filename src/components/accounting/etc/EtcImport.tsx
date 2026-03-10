"use client"

import { useState, useRef } from "react"
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"

export function EtcImport() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ message: string; imported: number; skipped: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      setResult(null)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f && (f.name.endsWith(".xlsx") || f.name.endsWith(".xls") || f.name.endsWith(".csv"))) {
      setFile(f)
      setResult(null)
    }
  }

  async function handleImport() {
    if (!file) return
    setLoading(true)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/accounting/etc/import", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "インポートに失敗しました")
      } else {
        setResult(data)
        toast.success(data.message)
      }
    } catch {
      toast.error("通信エラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-1">ETC明細 取込</h2>
        <p className="text-sm text-slate-500 mb-4">
          ETCカード会社からダウンロードした Excel / CSV ファイルをアップロードしてください。
          同一データの重複取込は自動的にスキップされます。
        </p>

        {/* ドロップエリア */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-colors"
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFileChange}
          />
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <FileSpreadsheet className="w-10 h-10 text-emerald-500" />
              <p className="text-sm font-medium text-slate-700">{file.name}</p>
              <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-10 h-10 text-slate-300" />
              <p className="text-sm text-slate-500">クリックまたはドラッグ&ドロップ</p>
              <p className="text-xs text-slate-400">.xlsx / .xls / .csv</p>
            </div>
          )}
        </div>

        {/* 対応フォーマット説明 */}
        <div className="mt-4 p-3 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-500 font-medium mb-1">対応列（1行目がヘッダー）</p>
          <div className="grid grid-cols-2 gap-x-4 text-xs text-slate-400">
            <span>• 利用日</span>
            <span>• カード番号</span>
            <span>• 曜日</span>
            <span>• 登録番号</span>
            <span>• 利用内容</span>
            <span>• 金額（税込）</span>
            <span>• 納車先名</span>
            <span>• 利用情報</span>
          </div>
        </div>

        {/* インポートボタン */}
        <button
          onClick={handleImport}
          disabled={!file || loading}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> 取込中...</>
          ) : (
            <><Upload className="w-4 h-4" /> 取込実行</>
          )}
        </button>

        {/* 結果表示 */}
        {result && (
          <div className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${
            result.imported > 0 ? "bg-emerald-50 border border-emerald-200" : "bg-slate-50 border border-slate-200"
          }`}>
            {result.imported > 0 ? (
              <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-medium text-slate-700">{result.message}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                取込: {result.imported} 件 / スキップ: {result.skipped} 件
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

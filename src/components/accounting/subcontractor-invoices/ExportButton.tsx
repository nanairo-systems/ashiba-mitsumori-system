/**
 * [COMPONENT] 経理 - CSV出力ボタン
 *
 * 「15日払いCSV出力」「月末払いCSV出力」の2ボタン。
 * 現在選択中の年月・会社区分フィルターを引き継いでCSVダウンロードを実行する。
 */
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface ExportButtonProps {
  /** 選択中の年月フィルター（例: "2026-03"） */
  yearMonth: string
  /** 選択中の会社ID フィルター（"all" の場合は未指定扱い） */
  companyId: string
}

export function ExportButton({ yearMonth, companyId }: ExportButtonProps) {
  const [loadingType, setLoadingType] = useState<string | null>(null)

  async function handleExport(closingType: "DAY_15" | "MONTH_END") {
    if (!yearMonth) {
      toast.error("年月を選択してからCSV出力してください")
      return
    }

    setLoadingType(closingType)

    try {
      const params = new URLSearchParams()
      params.set("yearMonth", yearMonth)
      params.set("closingType", closingType)
      if (companyId && companyId !== "all") {
        params.set("companyId", companyId)
      }

      const res = await fetch(
        `/api/accounting/subcontractor-invoices/export?${params.toString()}`
      )

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "ダウンロードに失敗しました" }))
        toast.error(err.error || "ダウンロードに失敗しました")
        return
      }

      // Blobとしてレスポンスを取得
      const blob = await res.blob()

      // Content-Dispositionからファイル名を取得
      const disposition = res.headers.get("Content-Disposition")
      let fileName = `payment-list-${yearMonth}-${closingType}.csv`
      if (disposition) {
        const match = disposition.match(/filename="?(.+?)"?$/)
        if (match) fileName = match[1]
      }

      // ダウンロード実行
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast.success(`${closingType === "DAY_15" ? "15日払い" : "月末払い"}のCSVをダウンロードしました`)
    } catch {
      toast.error("通信エラーが発生しました")
    } finally {
      setLoadingType(null)
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => handleExport("DAY_15")}
        disabled={loadingType !== null || !yearMonth}
      >
        {loadingType === "DAY_15" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        15日払いCSV出力
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => handleExport("MONTH_END")}
        disabled={loadingType !== null || !yearMonth}
      >
        {loadingType === "MONTH_END" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        月末払いCSV出力
      </Button>
    </div>
  )
}

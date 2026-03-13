/**
 * [PAGE] 労務・人事システム - 労務書類管理
 */
import type { Metadata } from "next"

export const metadata: Metadata = { title: "労務書類管理" }

export default function LaborDocumentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">労務書類管理</h1>
          <p className="text-sm text-slate-500 mt-1">雇用契約書・各種届出書類の管理</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <p className="text-slate-400 text-sm">労務書類管理機能は今後実装予定です</p>
      </div>
    </div>
  )
}

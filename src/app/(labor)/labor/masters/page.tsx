/**
 * [PAGE] 労務・人事システム - マスター管理
 */
import type { Metadata } from "next"

export const metadata: Metadata = { title: "マスター管理" }

export default function LaborMastersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">マスター管理</h1>
          <p className="text-sm text-slate-500 mt-1">部門・職種・雇用区分・手当区分</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <p className="text-slate-400 text-sm">マスター管理機能は今後実装予定です</p>
      </div>
    </div>
  )
}

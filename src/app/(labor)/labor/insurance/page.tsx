/**
 * [PAGE] 労務・人事システム - 社会保険管理
 */
import type { Metadata } from "next"

export const metadata: Metadata = { title: "社会保険管理" }

export default function LaborInsurancePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">社会保険管理</h1>
          <p className="text-sm text-slate-500 mt-1">健康保険・厚生年金・雇用保険・労災保険</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <p className="text-slate-400 text-sm">社会保険管理機能は今後実装予定です</p>
      </div>
    </div>
  )
}

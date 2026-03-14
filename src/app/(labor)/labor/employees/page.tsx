/**
 * [PAGE] 労務・人事システム - 社員管理
 */
import type { Metadata } from "next"
import { EmployeeListClient } from "@/components/labor/employees/EmployeeListClient"

export const metadata: Metadata = { title: "社員管理" }

export default function LaborEmployeesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">社員管理（詳細情報）</h1>
        <p className="text-sm text-slate-500 mt-1">給与・保険・勤怠など社員の詳細情報を管理します。社員の新規登録・基本情報編集はマスター管理で行います。</p>
      </div>
      <EmployeeListClient />
    </div>
  )
}

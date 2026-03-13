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
        <h1 className="text-2xl font-bold text-slate-800">社員管理</h1>
        <p className="text-sm text-slate-500 mt-1">社員情報・雇用状況の管理</p>
      </div>
      <EmployeeListClient />
    </div>
  )
}

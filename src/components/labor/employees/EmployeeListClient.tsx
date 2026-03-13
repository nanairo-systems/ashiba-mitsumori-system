/**
 * [COMPONENT] 労務・人事システム - 社員一覧 (Client Component)
 *
 * 既存の /api/accounting/employees, /api/accounting/companies,
 * /api/accounting/departments, /api/accounting/stores API を再利用
 */
"use client"

import { useState, useEffect, useMemo } from "react"
import { EmployeeList } from "./EmployeeList"
import { Loader2 } from "lucide-react"

export function EmployeeListClient() {
  const [employees, setEmployees] = useState([])
  const [companies, setCompanies] = useState([])
  const [departments, setDepartments] = useState([])
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [empRes, compRes, deptRes, storeRes] = await Promise.all([
          fetch("/api/labor/employees"),
          fetch("/api/accounting/companies"),
          fetch("/api/accounting/departments"),
          fetch("/api/accounting/stores"),
        ])
        if (!empRes.ok) throw new Error("社員データの取得に失敗しました")
        const [empData, compData, deptData, storeData] = await Promise.all([
          empRes.json(),
          compRes.json(),
          deptRes.json(),
          storeRes.json(),
        ])
        setEmployees(empData)
        setCompanies(compData)
        setDepartments(deptData.map((d: any) => ({
          ...d,
          company: d.company ?? { name: "" },
        })))
        setStores(storeData)
      } catch (e: any) {
        setError(e.message || "データの取得に失敗しました")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
        <span className="ml-2 text-sm text-slate-500">読み込み中...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <EmployeeList
      initialEmployees={employees}
      companies={companies}
      departments={departments}
      stores={stores}
    />
  )
}

/**
 * [COMPONENT] 統合マスター管理 - UnifiedMasterManager
 *
 * 足場マスター（9タブ）と経理マスター（4タブ）を
 * 上部の切替タブで1画面に統合する。
 */
"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Building2, Calculator } from "lucide-react"
import { MasterManager } from "./MasterManager"
import { MasterTabs } from "@/components/accounting/masters/MasterTabs"
import type { CompanyRow, DepartmentRow, StoreRow } from "@/components/accounting/masters/MasterTabs"
import type { EmployeeRow } from "@/components/accounting/masters/EmployeeMasterList"

// MasterManager の props 型（既存コンポーネントの型をそのまま使用）
interface ScaffoldMasterProps {
  companies: Parameters<typeof MasterManager>[0]["companies"]
  units: Parameters<typeof MasterManager>[0]["units"]
  tags: Parameters<typeof MasterManager>[0]["tags"]
  subcontractors: Parameters<typeof MasterManager>[0]["subcontractors"]
  scheduleWorkTypes: Parameters<typeof MasterManager>[0]["scheduleWorkTypes"]
  workers: Parameters<typeof MasterManager>[0]["workers"]
  teams: Parameters<typeof MasterManager>[0]["teams"]
  vehicles: Parameters<typeof MasterManager>[0]["vehicles"]
  itemCategories: Parameters<typeof MasterManager>[0]["itemCategories"]
  templates: Parameters<typeof MasterManager>[0]["templates"]
}

interface AccountingMasterProps {
  initialCompanies: CompanyRow[]
  initialDepartments: DepartmentRow[]
  initialStores: StoreRow[]
  initialEmployees: EmployeeRow[]
  userRole: "ADMIN" | "STAFF" | "DEVELOPER"
}

interface Props {
  scaffold: ScaffoldMasterProps
  accounting: AccountingMasterProps
}

const SYSTEM_TABS = [
  { key: "scaffold", label: "足場マスター", icon: Building2, color: "blue" },
  { key: "accounting", label: "経理マスター", icon: Calculator, color: "emerald" },
] as const

type SystemTab = (typeof SYSTEM_TABS)[number]["key"]

export function UnifiedMasterManager({ scaffold, accounting }: Props) {
  const [activeSystem, setActiveSystem] = useState<SystemTab>("scaffold")

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="relative">
        <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">UM-1</span>
        <h1 className="text-2xl font-bold text-slate-900 ml-7">マスター管理</h1>
        <p className="text-sm text-slate-500 mt-1">
          すべてのマスターデータを一元管理します
        </p>
      </div>

      {/* システム切替タブ */}
      <div className="relative flex gap-2">
        <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">UM-2</span>
        {SYSTEM_TABS.map(({ key, label, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => setActiveSystem(key)}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all border-2",
              key === "scaffold" && "ml-7",
              activeSystem === key
                ? color === "blue"
                  ? "bg-blue-600 text-white border-blue-600 shadow-md"
                  : "bg-emerald-600 text-white border-emerald-600 shadow-md"
                : color === "blue"
                  ? "bg-white text-blue-700 border-blue-200 hover:bg-blue-50 hover:border-blue-400"
                  : "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-400"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* コンテンツ */}
      {activeSystem === "scaffold" && (
        <MasterManager {...scaffold} hideHeader />
      )}
      {activeSystem === "accounting" && (
        <MasterTabs {...accounting} hideHeader />
      )}
    </div>
  )
}

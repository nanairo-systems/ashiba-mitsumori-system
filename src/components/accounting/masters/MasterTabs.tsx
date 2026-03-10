/**
 * [COMPONENT] 経理 - マスター管理タブ
 *
 * 会社管理・部門管理・店舗管理を切り替えるタブUI
 */
"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Building2, GitBranch, Store } from "lucide-react"
import { CompanyMasterList } from "./CompanyMasterList"
import { DepartmentMasterList } from "./DepartmentMasterList"
import { StoreMasterList } from "./StoreMasterList"

export interface CompanyRow {
  id: string
  name: string
  colorCode: string | null
  sortOrder: number
  isActive: boolean
}

export interface DepartmentRow {
  id: string
  companyId: string
  name: string
  sortOrder: number
  isActive: boolean
  company: { id: string; name: string }
}

export interface StoreRow {
  id: string
  departmentId: string
  name: string
  sortOrder: number
  isActive: boolean
  department: {
    id: string
    name: string
    company: { id: string; name: string; colorCode: string | null }
  }
}

interface Props {
  initialCompanies: CompanyRow[]
  initialDepartments: DepartmentRow[]
  initialStores: StoreRow[]
  userRole: "ADMIN" | "STAFF" | "DEVELOPER"
}

export function MasterTabs({
  initialCompanies,
  initialDepartments,
  initialStores,
  userRole,
}: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">マスター管理</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          会社・部門・店舗の基本データを管理します
        </p>
      </div>

      <Tabs defaultValue="company" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="company" className="gap-1.5 text-xs sm:text-sm">
            <Building2 className="w-4 h-4" />
            会社管理
          </TabsTrigger>
          <TabsTrigger value="department" className="gap-1.5 text-xs sm:text-sm">
            <GitBranch className="w-4 h-4" />
            部門管理
          </TabsTrigger>
          <TabsTrigger value="store" className="gap-1.5 text-xs sm:text-sm">
            <Store className="w-4 h-4" />
            店舗管理
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-4">
          <CompanyMasterList initialCompanies={initialCompanies} userRole={userRole} />
        </TabsContent>

        <TabsContent value="department" className="mt-4">
          <DepartmentMasterList
            initialDepartments={initialDepartments}
            companies={initialCompanies.filter((c) => c.isActive)}
            userRole={userRole}
          />
        </TabsContent>

        <TabsContent value="store" className="mt-4">
          <StoreMasterList
            initialStores={initialStores}
            companies={initialCompanies.filter((c) => c.isActive)}
            departments={initialDepartments.filter((d) => d.isActive)}
            userRole={userRole}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/**
 * [COMPONENT] 統合マスター管理 - UnifiedMasterManager
 *
 * 全マスターデータをカテゴリ別カードで一覧表示。
 * カードをクリックすると該当マスターの編集画面に切替。
 */
"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  Building2,
  GitBranch,
  Store,
  Users,
  HardHat,
  Truck,
  Layers,
  Ruler,
  Tag,
  ArrowLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { MasterManager } from "./MasterManager"
import { MasterTabs } from "@/components/accounting/masters/MasterTabs"
import type { CompanyRow, DepartmentRow, StoreRow } from "@/components/accounting/masters/MasterTabs"
import type { EmployeeRow } from "@/components/accounting/masters/EmployeeMasterList"

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

// カード定義: system=どのコンポーネントを開くか, tab=開くタブ名
interface MasterCard {
  id: string
  label: string
  description: string
  icon: React.ElementType
  color: string
  bgColor: string
  borderColor: string
  system: "scaffold" | "accounting"
  tab: string
  count?: number
}

export function UnifiedMasterManager({ scaffold, accounting }: Props) {
  const [activeCard, setActiveCard] = useState<MasterCard | null>(null)

  // カード定義（カテゴリ別）
  const categories: { title: string; cards: MasterCard[] }[] = [
    {
      title: "組織",
      cards: [
        {
          id: "companies",
          label: "取引先（会社）",
          description: "会社・支店・担当者",
          icon: Building2,
          color: "text-blue-700",
          bgColor: "bg-blue-50 hover:bg-blue-100",
          borderColor: "border-blue-200 hover:border-blue-400",
          system: "scaffold",
          tab: "companies",
          count: scaffold.companies.length,
        },
        {
          id: "ac-company",
          label: "会社区分",
          description: "経理用の会社区分マスター",
          icon: Building2,
          color: "text-emerald-700",
          bgColor: "bg-emerald-50 hover:bg-emerald-100",
          borderColor: "border-emerald-200 hover:border-emerald-400",
          system: "accounting",
          tab: "company",
          count: accounting.initialCompanies.length,
        },
        {
          id: "departments",
          label: "部門",
          description: "会社区分ごとの部門",
          icon: GitBranch,
          color: "text-emerald-700",
          bgColor: "bg-emerald-50 hover:bg-emerald-100",
          borderColor: "border-emerald-200 hover:border-emerald-400",
          system: "accounting",
          tab: "department",
          count: accounting.initialDepartments.length,
        },
        {
          id: "stores",
          label: "店舗",
          description: "部門ごとの店舗・営業所",
          icon: Store,
          color: "text-emerald-700",
          bgColor: "bg-emerald-50 hover:bg-emerald-100",
          borderColor: "border-emerald-200 hover:border-emerald-400",
          system: "accounting",
          tab: "store",
          count: accounting.initialStores.length,
        },
      ],
    },
    {
      title: "人",
      cards: [
        {
          id: "employees",
          label: "社員",
          description: "社員名簿・部門/店舗紐付け",
          icon: Users,
          color: "text-violet-700",
          bgColor: "bg-violet-50 hover:bg-violet-100",
          borderColor: "border-violet-200 hover:border-violet-400",
          system: "accounting",
          tab: "employee",
          count: accounting.initialEmployees.length,
        },
        {
          id: "workers",
          label: "職人",
          description: "現場作業の職人マスター",
          icon: HardHat,
          color: "text-amber-700",
          bgColor: "bg-amber-50 hover:bg-amber-100",
          borderColor: "border-amber-200 hover:border-amber-400",
          system: "scaffold",
          tab: "workers",
          count: scaffold.workers.length,
        },
        {
          id: "subcontractors",
          label: "外注先・協力業者",
          description: "下請け業者・協力会社",
          icon: Truck,
          color: "text-orange-700",
          bgColor: "bg-orange-50 hover:bg-orange-100",
          borderColor: "border-orange-200 hover:border-orange-400",
          system: "scaffold",
          tab: "subcontractors",
          count: scaffold.subcontractors.length,
        },
        {
          id: "teams",
          label: "班",
          description: "班構成・班長設定",
          icon: Users,
          color: "text-cyan-700",
          bgColor: "bg-cyan-50 hover:bg-cyan-100",
          borderColor: "border-cyan-200 hover:border-cyan-400",
          system: "scaffold",
          tab: "teams",
          count: scaffold.teams.length,
        },
      ],
    },
    {
      title: "モノ・設定",
      cards: [
        {
          id: "vehicles",
          label: "車両",
          description: "社用車・車検管理",
          icon: Truck,
          color: "text-sky-700",
          bgColor: "bg-sky-50 hover:bg-sky-100",
          borderColor: "border-sky-200 hover:border-sky-400",
          system: "scaffold",
          tab: "vehicles",
          count: scaffold.vehicles.length,
        },
        {
          id: "workTypes",
          label: "工種",
          description: "工程の作業種別マスター",
          icon: Layers,
          color: "text-pink-700",
          bgColor: "bg-pink-50 hover:bg-pink-100",
          borderColor: "border-pink-200 hover:border-pink-400",
          system: "scaffold",
          tab: "workTypes",
          count: scaffold.scheduleWorkTypes.length,
        },
        {
          id: "units",
          label: "単位",
          description: "見積の数量単位",
          icon: Ruler,
          color: "text-slate-700",
          bgColor: "bg-slate-50 hover:bg-slate-100",
          borderColor: "border-slate-200 hover:border-slate-400",
          system: "scaffold",
          tab: "units",
          count: scaffold.units.length,
        },
        {
          id: "tags",
          label: "タグ",
          description: "見積・案件のタグ分類",
          icon: Tag,
          color: "text-slate-700",
          bgColor: "bg-slate-50 hover:bg-slate-100",
          borderColor: "border-slate-200 hover:border-slate-400",
          system: "scaffold",
          tab: "tags",
          count: scaffold.tags.length,
        },
        {
          id: "itemMaster",
          label: "項目マスタ",
          description: "見積テンプレートの項目",
          icon: Layers,
          color: "text-indigo-700",
          bgColor: "bg-indigo-50 hover:bg-indigo-100",
          borderColor: "border-indigo-200 hover:border-indigo-400",
          system: "scaffold",
          tab: "itemMaster",
          count: scaffold.itemCategories.length,
        },
      ],
    },
  ]

  // カード一覧（トップ画面）
  if (!activeCard) {
    return (
      <div className="space-y-6">
        <div className="relative">
          <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded bg-red-500 text-white text-[10px] font-black leading-none">UM-1</span>
          <h1 className="text-2xl font-bold text-slate-900 ml-7">マスター管理</h1>
          <p className="text-sm text-slate-500 mt-1">
            すべてのマスターデータを一元管理します
          </p>
        </div>

        {categories.map((cat) => (
          <div key={cat.title}>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
              {cat.title}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {cat.cards.map((card) => {
                const Icon = card.icon
                return (
                  <button
                    key={card.id}
                    onClick={() => setActiveCard(card)}
                    className={cn(
                      "text-left p-4 rounded-xl border-2 transition-all",
                      card.bgColor,
                      card.borderColor,
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon className={cn("w-5 h-5", card.color)} />
                      <span className={cn("font-semibold text-sm", card.color)}>
                        {card.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {card.description}
                    </p>
                    {card.count !== undefined && (
                      <div className="mt-2">
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                          card.bgColor, card.color,
                        )}>
                          {card.count}件
                        </span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // 編集画面
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setActiveCard(null)}
          className="gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          マスター一覧へ
        </Button>
        <div className="flex items-center gap-2">
          <activeCard.icon className={cn("w-5 h-5", activeCard.color)} />
          <span className="font-semibold text-lg text-slate-900">{activeCard.label}</span>
        </div>
      </div>

      {activeCard.system === "scaffold" && (
        <MasterManager {...scaffold} hideHeader defaultTab={activeCard.tab} />
      )}
      {activeCard.system === "accounting" && (
        <MasterTabs {...accounting} hideHeader defaultTab={activeCard.tab} />
      )}
    </div>
  )
}

"use client"

import { useState } from "react"
import { Fuel, Users, CreditCard, Upload, TrendingUp, Receipt, ArrowUpRight, ArrowDownRight, BarChart3, Table2 } from "lucide-react"
import { FuelRecordList } from "./FuelRecordList"
import { FuelMonthlySummary } from "./FuelMonthlySummary"
import { FuelVehicleMonthlyTable } from "./FuelVehicleMonthlyTable"
import { FuelImport } from "./FuelImport"
import { FuelCardManager } from "./FuelCardManager"

type Tab = "records" | "monthly" | "vehicle-monthly" | "cards" | "import"

interface Vehicle {
  id: string
  plateNumber: string
  nickname: string | null
}

interface Driver {
  id: string
  name: string
}

interface Card {
  id: string
  cardNumber: string
  note: string | null
  isActive: boolean
  vehicle: { id: string; plateNumber: string; nickname: string | null } | null
  driver: { id: string; name: string } | null
}

interface Props {
  vehicles: Vehicle[]
  drivers: Driver[]
  cards: Card[]
  currentMonthAmount: number
  currentMonthCount: number
  prevMonthAmount: number
  prevMonthCount: number
  currentYearMonth: string
}

export function FuelDashboard({
  vehicles,
  drivers,
  cards,
  currentMonthAmount,
  currentMonthCount,
  prevMonthAmount,
  prevMonthCount,
  currentYearMonth,
}: Props) {
  const [tab, setTab] = useState<Tab>("records")

  const amountDiff = currentMonthAmount - prevMonthAmount
  const isUp = amountDiff >= 0

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "records", label: "利用明細", icon: <Receipt className="w-4 h-4" /> },
    { id: "monthly", label: "月別集計", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "vehicle-monthly", label: "車両別月次", icon: <Table2 className="w-4 h-4" /> },
    { id: "import", label: "取込", icon: <Upload className="w-4 h-4" /> },
    { id: "cards", label: "カード管理", icon: <CreditCard className="w-4 h-4" /> },
  ]

  return (
    <div className="flex flex-col h-full min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">ガソリン管理</h1>
            <p className="text-sm text-slate-500 mt-0.5">車両・ドライバー別 燃料利用明細管理</p>
          </div>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>今月合計</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            ¥{currentMonthAmount.toLocaleString()}
          </p>
          <div className="flex items-center gap-1 mt-1">
            {isUp ? (
              <ArrowUpRight className="w-3.5 h-3.5 text-red-500" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5 text-emerald-500" />
            )}
            <span className={`text-xs font-medium ${isUp ? "text-red-500" : "text-emerald-500"}`}>
              前月比 ¥{Math.abs(amountDiff).toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">{currentMonthCount} 件</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Receipt className="w-3.5 h-3.5" />
            <span>前月合計</span>
          </div>
          <p className="text-xl font-bold text-slate-700">
            ¥{prevMonthAmount.toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-1">{prevMonthCount} 件</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Fuel className="w-3.5 h-3.5" />
            <span>登録車両</span>
          </div>
          <p className="text-xl font-bold text-slate-700">{vehicles.length} 台</p>
          <p className="text-xs text-slate-400 mt-1">カード {cards.length} 枚</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Users className="w-3.5 h-3.5" />
            <span>ドライバー</span>
          </div>
          <p className="text-xl font-bold text-slate-700">{drivers.length} 人</p>
        </div>
      </div>

      {/* タブ */}
      <div className="px-6">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
          {tabs.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                tab === id
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {icon}
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 px-6 py-4">
        {tab === "records" && (
          <FuelRecordList defaultYearMonth={currentYearMonth} />
        )}
        {tab === "monthly" && <FuelMonthlySummary />}
        {tab === "vehicle-monthly" && <FuelVehicleMonthlyTable />}
        {tab === "import" && <FuelImport />}
        {tab === "cards" && <FuelCardManager initialCards={cards} vehicles={vehicles} drivers={drivers} />}
      </div>
    </div>
  )
}

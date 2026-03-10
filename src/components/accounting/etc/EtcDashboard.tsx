"use client"

import { useState } from "react"
import { Car, Users, CreditCard, Upload, TrendingUp, Receipt, ArrowUpRight, ArrowDownRight, BarChart3, Database, Table2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { EtcVehicleManager } from "./EtcVehicleManager"
import { EtcDriverManager } from "./EtcDriverManager"
import { EtcCardManager } from "./EtcCardManager"
import { EtcRecordList } from "./EtcRecordList"
import { EtcImport } from "./EtcImport"
import { EtcMonthlySummary } from "./EtcMonthlySummary"
import { EtcVehicleMonthlyTable } from "./EtcVehicleMonthlyTable"
import { EtcAlerts } from "./EtcAlerts"

type Tab = "records" | "monthly" | "vehicle-monthly" | "alerts" | "vehicles" | "drivers" | "cards" | "import"

interface Vehicle {
  id: string
  plateNumber: string
  nickname: string | null
  vehicleType: string | null
  note: string | null
  isActive: boolean
  cards: { id: string; cardNumber: string; driver: { id: string; name: string } | null }[]
}

interface Driver {
  id: string
  name: string
  departmentId: string | null
  storeId: string | null
  note: string | null
  isActive: boolean
  department: { id: string; name: string; company: { id: string; name: string; colorCode: string | null } } | null
  store: { id: string; name: string; departmentId: string } | null
  cards: { id: string; cardNumber: string; vehicle: { id: string; plateNumber: string; nickname: string | null } | null }[]
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
  vehicleSummary: { cardNumber: string; amount: number; count: number }[]
}

export function EtcDashboard({
  vehicles,
  drivers,
  cards,
  currentMonthAmount,
  currentMonthCount,
  prevMonthAmount,
  prevMonthCount,
  currentYearMonth,
  vehicleSummary,
}: Props) {
  const [tab, setTab] = useState<Tab>("records")
  const [seeding, setSeeding] = useState(false)

  const handleSeed = async () => {
    if (!confirm("サンプルデータを投入しますか？")) return
    setSeeding(true)
    try {
      const res = await fetch("/api/accounting/etc/seed", { method: "POST" })
      const data = await res.json()
      toast.success(`${data.message}（記録: ${data.records}件）`)
      window.location.reload()
    } catch {
      toast.error("投入に失敗しました")
    } finally {
      setSeeding(false)
    }
  }

  const amountDiff = currentMonthAmount - prevMonthAmount
  const isUp = amountDiff >= 0

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "records", label: "利用明細", icon: <Receipt className="w-4 h-4" /> },
    { id: "monthly", label: "月別集計", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "vehicle-monthly", label: "車両別月次", icon: <Table2 className="w-4 h-4" /> },
    { id: "alerts", label: "アラート", icon: <AlertTriangle className="w-4 h-4" /> },
    { id: "import", label: "取込", icon: <Upload className="w-4 h-4" /> },
    { id: "vehicles", label: "車両管理", icon: <Car className="w-4 h-4" /> },
    { id: "drivers", label: "ドライバー管理", icon: <Users className="w-4 h-4" /> },
    { id: "cards", label: "カード管理", icon: <CreditCard className="w-4 h-4" /> },
  ]

  return (
    <div className="flex flex-col h-full min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">ETC管理</h1>
            <p className="text-sm text-slate-500 mt-0.5">車両・ドライバー別ETC利用明細管理</p>
          </div>
          {currentMonthCount === 0 && prevMonthCount === 0 && (
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-colors"
            >
              <Database className="w-4 h-4" />
              {seeding ? "投入中..." : "サンプルデータ投入"}
            </button>
          )}
        </div>
      </div>

      {/* サマリーカード */}
      <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* 今月合計 */}
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

        {/* 前月合計 */}
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

        {/* 車両数 */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Car className="w-3.5 h-3.5" />
            <span>登録車両</span>
          </div>
          <p className="text-xl font-bold text-slate-700">{vehicles.length} 台</p>
          <p className="text-xs text-slate-400 mt-1">カード {cards.length} 枚</p>
        </div>

        {/* ドライバー数 */}
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
          <EtcRecordList
            vehicles={vehicles}
            drivers={drivers}
            cards={cards}
            defaultYearMonth={currentYearMonth}
            vehicleSummary={vehicleSummary}
          />
        )}
        {tab === "monthly" && <EtcMonthlySummary />}
        {tab === "vehicle-monthly" && <EtcVehicleMonthlyTable />}
        {tab === "alerts" && <EtcAlerts />}
        {tab === "import" && <EtcImport />}
        {tab === "vehicles" && <EtcVehicleManager initialVehicles={vehicles} />}
        {tab === "drivers" && <EtcDriverManager initialDrivers={drivers} />}
        {tab === "cards" && <EtcCardManager initialCards={cards} vehicles={vehicles} drivers={drivers} />}
      </div>
    </div>
  )
}

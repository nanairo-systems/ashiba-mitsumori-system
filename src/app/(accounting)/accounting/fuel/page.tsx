/**
 * [PAGE] 経理システム - ガソリン管理
 */
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { FuelDashboard } from "@/components/accounting/fuel/FuelDashboard"

export default async function FuelPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // ドライバー（ETC共有）
  let drivers: any[]
  try {
    const rawDrivers = await prisma.etcDriver.findMany({
      where: { isActive: true },
      include: {
        department: { include: { company: true } },
        store: true,
      },
      orderBy: { name: "asc" },
    })
    drivers = rawDrivers
  } catch {
    const rawDrivers = await prisma.etcDriver.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    })
    drivers = rawDrivers.map((d) => ({ ...d, department: null, store: null }))
  }

  // 車両（ETC共有）
  const vehicles = await prisma.etcVehicle.findMany({
    where: { isActive: true },
    orderBy: { plateNumber: "asc" },
  })

  // ガソリンカード
  const cards = await prisma.fuelCard.findMany({
    include: { vehicle: true, driver: true },
    orderBy: { cardNumber: "asc" },
  })

  // 今月のサマリー
  const now = new Date()
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevYearMonth = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`

  const [currentMonthRecords, prevMonthRecords] = await Promise.all([
    prisma.fuelRecord.aggregate({
      where: { yearMonth: currentYearMonth },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.fuelRecord.aggregate({
      where: { yearMonth: prevYearMonth },
      _sum: { amount: true },
      _count: true,
    }),
  ])

  return (
    <FuelDashboard
      vehicles={vehicles.map((v) => ({
        id: v.id,
        plateNumber: v.plateNumber,
        nickname: v.nickname,
      }))}
      drivers={drivers.map((d: any) => ({
        id: d.id,
        name: d.name,
      }))}
      cards={cards.map((c) => ({
        id: c.id,
        cardNumber: c.cardNumber,
        note: c.note,
        isActive: c.isActive,
        vehicle: c.vehicle ? { id: c.vehicle.id, plateNumber: c.vehicle.plateNumber, nickname: c.vehicle.nickname } : null,
        driver: c.driver ? { id: c.driver.id, name: c.driver.name } : null,
      }))}
      currentMonthAmount={Number(currentMonthRecords._sum.amount ?? 0)}
      currentMonthCount={currentMonthRecords._count}
      prevMonthAmount={Number(prevMonthRecords._sum.amount ?? 0)}
      prevMonthCount={prevMonthRecords._count}
      currentYearMonth={currentYearMonth}
    />
  )
}

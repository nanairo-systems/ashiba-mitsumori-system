/**
 * [PAGE] 経理システム - ETC管理
 */
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { EtcDashboard } from "@/components/accounting/etc/EtcDashboard"

export default async function EtcPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // ドライバー取得（departmentId/storeIdカラムがDB未適用の場合はフォールバック）
  let drivers: any[]
  try {
    const rawDrivers = await prisma.etcDriver.findMany({
      where: { isActive: true },
      include: {
        cards: { include: { vehicle: true } },
        department: { include: { company: true } },
        store: true,
      },
      orderBy: { name: "asc" },
    })
    drivers = rawDrivers
  } catch {
    const rawDrivers = await prisma.etcDriver.findMany({
      where: { isActive: true },
      include: {
        cards: { include: { vehicle: true } },
      },
      orderBy: { name: "asc" },
    })
    drivers = rawDrivers.map((d) => ({
      ...d,
      department: null,
      store: null,
      departmentId: null,
      storeId: null,
    }))
  }

  const [vehicles, cards] = await Promise.all([
    prisma.etcVehicle.findMany({
      where: { isActive: true },
      include: { cards: { include: { driver: true } } },
      orderBy: { plateNumber: "asc" },
    }),
    prisma.etcCard.findMany({
      include: { vehicle: true, driver: true },
      orderBy: { cardNumber: "asc" },
    }),
  ])

  // 今月のサマリー
  const now = new Date()
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevYearMonth = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`

  const [currentMonthRecords, prevMonthRecords] = await Promise.all([
    prisma.etcRecord.aggregate({
      where: { yearMonth: currentYearMonth },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.etcRecord.aggregate({
      where: { yearMonth: prevYearMonth },
      _sum: { amount: true },
      _count: true,
    }),
  ])

  // 車両別今月集計
  const vehicleSummary = await prisma.etcRecord.groupBy({
    by: ["cardNumber"],
    where: { yearMonth: currentYearMonth },
    _sum: { amount: true },
    _count: true,
  })

  return (
    <EtcDashboard
      vehicles={vehicles.map((v) => ({
        ...v,
        cards: v.cards.map((c) => ({
          ...c,
          driver: c.driver ? { id: c.driver.id, name: c.driver.name } : null,
        })),
      }))}
      drivers={drivers.map((d: any) => {
        const dept = d.department
        const st = d.store
        return {
          ...d,
          department: dept ? {
            id: dept.id,
            name: dept.name,
            company: { id: dept.company.id, name: dept.company.name, colorCode: dept.company.colorCode },
          } : null,
          store: st ? { id: st.id, name: st.name, departmentId: st.departmentId } : null,
          cards: (d.cards ?? []).map((c: any) => ({
            ...c,
            vehicle: c.vehicle ? { id: c.vehicle.id, plateNumber: c.vehicle.plateNumber, nickname: c.vehicle.nickname } : null,
          })),
        }
      })}
      cards={cards.map((c) => ({
        ...c,
        vehicle: c.vehicle ? { id: c.vehicle.id, plateNumber: c.vehicle.plateNumber, nickname: c.vehicle.nickname } : null,
        driver: c.driver ? { id: c.driver.id, name: c.driver.name } : null,
      }))}
      currentMonthAmount={Number(currentMonthRecords._sum.amount ?? 0)}
      currentMonthCount={currentMonthRecords._count}
      prevMonthAmount={Number(prevMonthRecords._sum.amount ?? 0)}
      prevMonthCount={prevMonthRecords._count}
      currentYearMonth={currentYearMonth}
      vehicleSummary={vehicleSummary.map((v) => ({
        cardNumber: v.cardNumber,
        amount: Number(v._sum.amount ?? 0),
        count: v._count,
      }))}
    />
  )
}

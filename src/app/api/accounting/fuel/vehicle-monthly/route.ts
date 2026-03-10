import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/accounting/fuel/vehicle-monthly?from=YYYY-MM&to=YYYY-MM
 * 給油カード×月のクロス集計データを返す
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  // 期間内の月リストを生成
  const months: string[] = []
  if (from && to) {
    const [fy, fm] = from.split("-").map(Number)
    const [ty, tm] = to.split("-").map(Number)
    let cur = new Date(fy, fm - 1, 1)
    const end = new Date(ty, tm - 1, 1)
    while (cur <= end) {
      months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`)
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
    }
  } else {
    // デフォルト: 直近6ヶ月
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
    }
  }

  // カード番号 × 月の集計
  const records = await prisma.fuelRecord.groupBy({
    by: ["yearMonth", "cardNumber"],
    where: { yearMonth: { in: months } },
    _sum: { amount: true },
    _count: true,
  })

  // カード→車両・ドライバー紐付け
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cards: any[]
  try {
    cards = await prisma.fuelCard.findMany({
      include: {
        vehicle: true,
        driver: {
          include: {
            department: { include: { company: true } },
            store: true,
          },
        },
      },
    })
  } catch {
    cards = await prisma.fuelCard.findMany({
      include: { vehicle: true, driver: true },
    })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cardMap = Object.fromEntries(cards.map((c: any) => [c.cardNumber, c]))

  // カード別に月次データをまとめる
  const vehicleMap = new Map<string, {
    cardNumber: string
    vehicleName: string
    driverName: string
    plateNumber: string
    monthly: Record<string, { amount: number; count: number }>
  }>()

  for (const r of records) {
    const card = cardMap[r.cardNumber]
    const vehicleName = card?.vehicle?.nickname ?? card?.vehicle?.plateNumber ?? r.cardNumber
    const driverName = card?.driver?.name ?? "未設定"
    const plateNumber = card?.vehicle?.plateNumber ?? r.cardNumber

    if (!vehicleMap.has(r.cardNumber)) {
      vehicleMap.set(r.cardNumber, {
        cardNumber: r.cardNumber,
        vehicleName,
        driverName,
        plateNumber,
        monthly: {},
      })
    }

    const entry = vehicleMap.get(r.cardNumber)!
    if (!entry.monthly[r.yearMonth]) {
      entry.monthly[r.yearMonth] = { amount: 0, count: 0 }
    }
    entry.monthly[r.yearMonth].amount += Number(r._sum.amount ?? 0)
    entry.monthly[r.yearMonth].count += r._count
  }

  // 車両別合計を計算
  const vehicles = Array.from(vehicleMap.values()).map((v) => {
    const total = { amount: 0, count: 0 }
    for (const data of Object.values(v.monthly)) {
      total.amount += data.amount
      total.count += data.count
    }
    return { ...v, total }
  })

  // 月別合計
  const monthlyTotals: Record<string, { amount: number; count: number }> = {}
  for (const ym of months) {
    monthlyTotals[ym] = { amount: 0, count: 0 }
  }
  for (const v of vehicles) {
    for (const [ym, data] of Object.entries(v.monthly)) {
      if (monthlyTotals[ym]) {
        monthlyTotals[ym].amount += data.amount
        monthlyTotals[ym].count += data.count
      }
    }
  }

  return NextResponse.json({
    months,
    vehicles: vehicles.sort((a, b) =>
      a.plateNumber.localeCompare(b.plateNumber) || a.driverName.localeCompare(b.driverName)
    ),
    monthlyTotals,
  })
}

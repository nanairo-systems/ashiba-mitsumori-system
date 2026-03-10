import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/accounting/fuel/monthly-summary
 * 月別燃料費集計データを返す（過去12ヶ月分）
 */
export async function GET() {
  const now = new Date()
  const months: string[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }

  // 月別合計
  const monthlyTotals = await prisma.fuelRecord.groupBy({
    by: ["yearMonth"],
    where: { yearMonth: { in: months } },
    _sum: { amount: true },
    _count: true,
  })

  // 月別 × カード番号別（車両・ドライバー紐付け用）
  const monthlyByCard = await prisma.fuelRecord.groupBy({
    by: ["yearMonth", "cardNumber"],
    where: { yearMonth: { in: months } },
    _sum: { amount: true },
    _count: true,
  })

  // カード情報（車両・ドライバー紐付け）
  const cards = await prisma.fuelCard.findMany({
    include: { vehicle: true, driver: true },
  })
  const cardMap = Object.fromEntries(cards.map((c) => [c.cardNumber, c]))

  // 月別集計の整形
  const data = months.map((ym) => {
    const total = monthlyTotals.find((t) => t.yearMonth === ym)
    const cardBreakdown = monthlyByCard
      .filter((r) => r.yearMonth === ym)
      .map((r) => {
        const card = cardMap[r.cardNumber]
        return {
          cardNumber: r.cardNumber,
          amount: Number(r._sum.amount ?? 0),
          count: r._count,
          vehicleName: card?.vehicle?.nickname ?? card?.vehicle?.plateNumber ?? null,
          driverName: card?.driver?.name ?? null,
        }
      })
      .sort((a, b) => b.amount - a.amount)

    return {
      yearMonth: ym,
      totalAmount: Number(total?._sum.amount ?? 0),
      count: total?._count ?? 0,
      cards: cardBreakdown,
    }
  })

  return NextResponse.json({ months, data })
}

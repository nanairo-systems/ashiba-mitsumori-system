import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const yearMonth = searchParams.get("yearMonth")
  const cardNumber = searchParams.get("cardNumber")
  const plateNumber = searchParams.get("plateNumber")

  const [records, cards] = await Promise.all([
    prisma.fuelRecord.findMany({
      where: {
        ...(yearMonth ? { yearMonth } : {}),
        ...(cardNumber ? { cardNumber } : {}),
        ...(plateNumber ? { plateNumber } : {}),
      },
      orderBy: { usageDate: "desc" },
    }),
    prisma.fuelCard.findMany({
      include: { vehicle: true, driver: true },
    }),
  ])

  const cardMap = Object.fromEntries(cards.map((c) => [c.cardNumber, c]))

  const enrichedRecords = records.map((record) => {
    const card = cardMap[record.cardNumber]
    return {
      ...record,
      vehicleName: card?.vehicle?.nickname ?? card?.vehicle?.plateNumber ?? null,
      driverName: card?.driver?.name ?? null,
    }
  })

  return NextResponse.json(enrichedRecords)
}

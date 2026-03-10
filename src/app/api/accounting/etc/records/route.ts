import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const yearMonth = searchParams.get("yearMonth")
  const vehicleId = searchParams.get("vehicleId")
  const driverId = searchParams.get("driverId")
  const cardId = searchParams.get("cardId")

  const records = await prisma.etcRecord.findMany({
    where: {
      ...(yearMonth ? { yearMonth } : {}),
      ...(cardId ? { cardId } : {}),
      ...(vehicleId ? { card: { vehicleId } } : {}),
      ...(driverId ? { card: { driverId } } : {}),
    },
    include: {
      card: {
        include: { vehicle: true, driver: true },
      },
    },
    orderBy: [{ usageDate: "desc" }, { importedAt: "desc" }],
  })

  return NextResponse.json(records)
}

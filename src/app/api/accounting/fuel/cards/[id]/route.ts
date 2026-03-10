import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()

  const updated = await prisma.fuelCard.update({
    where: { id },
    data: {
      vehicleId: body.vehicleId ?? undefined,
      driverId: body.driverId ?? undefined,
      note: body.note ?? undefined,
    },
    include: { vehicle: true, driver: true },
  })

  return NextResponse.json(updated)
}

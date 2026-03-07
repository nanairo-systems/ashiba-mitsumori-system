/**
 * [API] 車両マスタ - GET /api/vehicles
 *
 * アクティブな車両一覧を返す。
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const isActive = req.nextUrl.searchParams.get("isActive")

  const vehicles = await prisma.vehicle.findMany({
    where: isActive === "true" ? { isActive: true } : undefined,
    orderBy: [{ name: "asc" }],
  })

  return NextResponse.json(vehicles)
}

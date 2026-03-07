/**
 * [API] 車検期限チェック - GET /api/vehicles/check-inspection
 *
 * 車検期限が30日以内の車両を検出し、通知を生成する。
 * 同一車両・同一期限の重複通知は生成しない。
 * Vercel Cron Job で毎日実行される。
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  // Vercel Cron の認証チェック
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const threshold30 = new Date(now)
  threshold30.setDate(threshold30.getDate() + 30)

  // 車検期限が30日以内のアクティブ車両を取得
  const vehicles = await prisma.vehicle.findMany({
    where: {
      isActive: true,
      inspectionDate: {
        lte: threshold30,
        gte: now, // 既に期限切れのものも含めたい場合はこの行を削除
      },
    },
  })

  // 期限切れの車両も取得（期限切れは更に重要）
  const expiredVehicles = await prisma.vehicle.findMany({
    where: {
      isActive: true,
      inspectionDate: {
        lt: now,
      },
    },
  })

  const allVehicles = [...vehicles, ...expiredVehicles]

  if (allVehicles.length === 0) {
    return NextResponse.json({
      created: 0,
      skipped: 0,
      executedAt: now.toISOString(),
    })
  }

  // 全ユーザーに通知を送る（ADMIN/STAFF問わず）
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  })

  let created = 0
  let skipped = 0

  for (const vehicle of allVehicles) {
    for (const user of users) {
      // 同じ車両に対する未読の車検通知が既にあればスキップ
      const existing = await prisma.notification.findFirst({
        where: {
          userId: user.id,
          vehicleId: vehicle.id,
          type: "VEHICLE_INSPECTION",
          isRead: false,
        },
      })

      if (existing) {
        skipped++
        continue
      }

      const isExpired = vehicle.inspectionDate && vehicle.inspectionDate < now
      const daysLeft = vehicle.inspectionDate
        ? Math.ceil((vehicle.inspectionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 0

      const message = isExpired
        ? `${vehicle.name}（${vehicle.licensePlate}）の車検期限が切れています。至急対応してください。`
        : `${vehicle.name}（${vehicle.licensePlate}）の車検期限が${daysLeft}日後です。`

      await prisma.notification.create({
        data: {
          userId: user.id,
          vehicleId: vehicle.id,
          type: "VEHICLE_INSPECTION",
          message,
          scheduledAt: now,
        },
      })
      created++
    }
  }

  return NextResponse.json({
    created,
    skipped,
    vehiclesChecked: allVehicles.length,
    executedAt: now.toISOString(),
  })
}

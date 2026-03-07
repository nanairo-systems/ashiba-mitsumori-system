/**
 * [API] 車検通知チェック Cron Job - GET /api/cron/check-inspection
 *
 * 毎朝8時にVercel Cronで実行。
 * - 車検期限が60日以内のアクティブな車両を取得
 * - 30日以内: 「【要対応】…」通知を生成
 * - 31〜60日以内: 「【確認】…」通知を生成
 * - 同じ車両の未読通知が既にある場合はスキップ
 * - 全ADMINユーザーに通知を送信
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
  const in60Days = new Date(now)
  in60Days.setDate(in60Days.getDate() + 60)

  // 車検期限が60日以内のアクティブな車両を取得
  const vehicles = await prisma.vehicle.findMany({
    where: {
      isActive: true,
      inspectionDate: {
        gte: now,
        lte: in60Days,
      },
    },
  })

  // 通知先: ADMIN・DEVELOPERユーザー全員
  const adminUsers = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: ["ADMIN", "DEVELOPER"] },
    },
    select: { id: true },
  })

  if (adminUsers.length === 0) {
    return NextResponse.json({
      checked: vehicles.length,
      created: 0,
      skipped: vehicles.length,
      executedAt: now.toISOString(),
    })
  }

  let created = 0
  let skipped = 0

  for (const vehicle of vehicles) {
    if (!vehicle.inspectionDate) continue

    const diffMs = vehicle.inspectionDate.getTime() - now.getTime()
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    const prefix = daysLeft <= 30 ? "【要対応】" : "【確認】"
    const message = `${prefix}${vehicle.name}（${vehicle.licensePlate}）の車検期限が${daysLeft}日後です`

    for (const user of adminUsers) {
      // 同じ車両の未読通知が既にあればスキップ
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
    checked: vehicles.length,
    created,
    skipped,
    executedAt: now.toISOString(),
  })
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * Vercel Cron Job で毎日実行
 * - 14日間更新なしの下書きを自動アーカイブ
 * - アーカイブ後30日復元されなかった下書きを自動削除
 */
export async function GET(req: NextRequest) {
  // Vercel Cron の認証チェック
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()

  // 14日前
  const archiveThreshold = new Date(now)
  archiveThreshold.setDate(archiveThreshold.getDate() - 14)

  // アーカイブ後30日前
  const deleteThreshold = new Date(now)
  deleteThreshold.setDate(deleteThreshold.getDate() - 30)

  // 1. 下書き → 自動アーカイブ（14日更新なし）
  const archived = await prisma.estimate.updateMany({
    where: {
      status: "DRAFT",
      isArchived: false,
      updatedAt: { lte: archiveThreshold },
    },
    data: {
      isArchived: true,
      archivedAt: now,
    },
  })

  // 2. アーカイブ済み下書き → 自動削除（アーカイブ後30日）
  const toDelete = await prisma.estimate.findMany({
    where: {
      status: "DRAFT",
      isArchived: true,
      archivedAt: { lte: deleteThreshold },
    },
    select: { id: true },
  })

  let deletedCount = 0
  for (const estimate of toDelete) {
    await prisma.estimate.delete({ where: { id: estimate.id } })
    deletedCount++
  }

  return NextResponse.json({
    archived: archived.count,
    deleted: deletedCount,
    executedAt: now.toISOString(),
  })
}

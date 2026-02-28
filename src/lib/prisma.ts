/**
 * [LIB] Prisma クライアント シングルトン
 *
 * Prisma v7 では PrismaPg アダプターが必須。
 * DIRECT_URL（直接接続・ポート5432）で接続する。
 * 開発環境ではグローバル変数にキャッシュして HMR 時の接続リークを防止。
 */
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const connectionString = process.env.DIRECT_URL
  if (!connectionString) {
    throw new Error("DIRECT_URL environment variable is not set")
  }

  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

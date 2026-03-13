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
  prismaVersion: string | undefined
}

/** スキーマ変更時にこのバージョンを上げると、キャッシュされた古いクライアントが破棄される */
const PRISMA_CLIENT_VERSION = "3"

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL
  if (!connectionString) {
    throw new Error("DIRECT_URL or DATABASE_URL environment variable is not set")
  }

  const adapter = new PrismaPg({ connectionString, pool: { max: 5 } })
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  })
}

// バージョンが変わったら古いキャッシュを破棄して再作成
if (globalForPrisma.prismaVersion !== PRISMA_CLIENT_VERSION) {
  globalForPrisma.prisma = undefined
  globalForPrisma.prismaVersion = PRISMA_CLIENT_VERSION
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

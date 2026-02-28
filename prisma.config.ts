/**
 * [CONFIG] Prisma設定ファイル
 *
 * マイグレーション実行時はDIRECT_URL（直接接続・ポート5432）を使用。
 * .env.local から環境変数を読み込む。
 */
import { config } from "dotenv"
config({ path: ".env.local" })

import { defineConfig } from "prisma/config"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DIRECT_URL"],
  },
})

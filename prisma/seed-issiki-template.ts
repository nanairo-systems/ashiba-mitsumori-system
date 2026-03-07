/**
 * [SEED] 足場工事一式テンプレート投入スクリプト
 *
 * 合計金額のみで見積るシンプルな「一式見積り」テンプレートを作成。
 * 冪等: 既存の同名テンプレートがあればスキップ。
 *
 * 実行: npx tsx prisma/seed-issiki-template.ts
 */
import { config } from "dotenv"
config({ path: ".env.local" })

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("🌱 足場工事一式テンプレートの投入を開始します...")

  // 既存チェック
  const existing = await prisma.template.findFirst({ where: { name: "足場工事一式" } })
  if (existing) {
    console.log("⏭️ テンプレート「足場工事一式」は既に存在します。スキップします。")
    return
  }

  // 単位「一式」を取得（なければ作成）
  const unit = await prisma.unit.upsert({
    where: { name: "一式" },
    update: {},
    create: { name: "一式", sortOrder: 1 },
  })

  // テンプレート作成
  const tpl = await prisma.template.create({
    data: {
      name: "足場工事一式",
      description: "合計金額のみで見積るシンプルな一式見積り",
      estimateType: "BOTH",
      sections: {
        create: [
          {
            name: "足場工事",
            sortOrder: 1,
            groups: {
              create: [
                {
                  name: "足場工事",
                  sortOrder: 1,
                  items: {
                    create: [
                      {
                        name: "足場工事一式",
                        quantity: 1,
                        unitId: unit.id,
                        unitPrice: 0,
                        sortOrder: 1,
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  })

  console.log(`✅ テンプレート作成完了: ${tpl.name} (ID: ${tpl.id})`)
}

main()
  .catch((e) => {
    console.error("❌ エラー:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
